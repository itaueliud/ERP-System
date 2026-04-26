/**
 * ConfigService — centralized configuration management
 * Requirements: 35.1–35.10
 *
 * Features:
 *  - Per-environment config (development | staging | production)
 *  - In-memory cache with 60-second TTL
 *  - Full change history with versioning
 *  - Rollback to any previous version
 */

import logger from '../utils/logger';

// Lazy db import to break circular dependency: config → db → config
let _db: typeof import('../database/connection')['db'] | null = null;
async function getDb() {
  if (!_db) {
    const mod = await import('../database/connection');
    _db = mod.db;
  }
  return _db;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Environment = 'development' | 'staging' | 'production';

export interface ConfigChange {
  id: string;
  environment: Environment;
  key: string;
  oldValue: any;
  newValue: any;
  updatedBy: string;
  updatedAt: Date;
  version: number;
}

interface CacheEntry {
  data: Record<string, any>;
  loadedAt: number;
}

// ─── ConfigService ────────────────────────────────────────────────────────────

export class ConfigService {
  /** Cache TTL in milliseconds (60 seconds per requirement 35.5) */
  private readonly CACHE_TTL_MS = 60_000;

  /** In-memory cache keyed by environment */
  private cache: Map<Environment, CacheEntry> = new Map();

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Get a config value by dot-notation key.
   * Uses the in-memory cache; falls back to DB if cache is stale.
   *
   * @param key         Dot-notation path, e.g. "email.smtp.host"
   * @param environment Target environment (defaults to current NODE_ENV)
   */
  async get(key: string, environment?: Environment): Promise<any> {
    const env = environment ?? this._currentEnv();
    const all = await this._getCached(env);
    return this._getByPath(all, key);
  }

  /**
   * Set (create or update) a config value.
   * Records the change in config_history and bumps the version.
   */
  async set(key: string, value: any, environment: Environment, updatedBy: string): Promise<void> {
    const existing = await this._fetchOne(environment, key);
    const oldValue = existing?.value ?? null;
    const newVersion = (existing?.version ?? 0) + 1;

    await (await getDb()).transaction(async (client) => {
      // Upsert into system_config
      await client.query(
        `INSERT INTO system_config (environment, key, value, updated_by, updated_at, version)
         VALUES ($1, $2, $3::jsonb, $4, NOW(), $5)
         ON CONFLICT (environment, key)
         DO UPDATE SET value = $3::jsonb, updated_by = $4, updated_at = NOW(), version = $5`,
        [environment, key, JSON.stringify(value), updatedBy, newVersion]
      );

      // Record history
      await client.query(
        `INSERT INTO config_history (environment, key, old_value, new_value, updated_by, updated_at, version)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, NOW(), $6)`,
        [
          environment,
          key,
          oldValue !== null ? JSON.stringify(oldValue) : null,
          JSON.stringify(value),
          updatedBy,
          newVersion,
        ]
      );
    });

    // Invalidate cache for this environment
    this.cache.delete(environment);

    logger.info('ConfigService: config updated', { environment, key, updatedBy, version: newVersion });
  }

  /**
   * Get all config values for an environment as a flat key→value map.
   * Uses the in-memory cache.
   */
  async getAll(environment: Environment): Promise<Record<string, any>> {
    return this._getCached(environment);
  }

  /**
   * Rollback a specific environment to a previous version.
   * Replays the config_history entry at the given version number.
   */
  async rollback(environment: Environment, version: number, updatedBy: string): Promise<void> {
    // Fetch all history entries at the target version for this environment
    const result = await (await getDb()).query<{
      key: string;
      old_value: string | null;
    }>(
      `SELECT key, old_value
       FROM config_history
       WHERE environment = $1 AND version = $2`,
      [environment, version]
    );

    if (result.rows.length === 0) {
      throw new Error(`No config history found for environment "${environment}" at version ${version}`);
    }

    // Restore each key to its old_value at that version
    for (const row of result.rows) {
      const restoredValue = row.old_value !== null ? JSON.parse(row.old_value as string) : null;
      if (restoredValue !== null) {
        await this.set(row.key, restoredValue, environment, updatedBy);
      }
    }

    logger.info('ConfigService: rolled back', { environment, version, updatedBy });
  }

  /**
   * Get the change history for an environment, newest first.
   */
  async getHistory(environment: Environment, limit = 50): Promise<ConfigChange[]> {
    const result = await (await getDb()).query<{
      id: string;
      environment: string;
      key: string;
      old_value: string | null;
      new_value: string;
      updated_by: string;
      updated_at: Date;
      version: number;
    }>(
      `SELECT id, environment, key, old_value, new_value, updated_by, updated_at, version
       FROM config_history
       WHERE environment = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [environment, limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      environment: row.environment as Environment,
      key: row.key,
      oldValue: row.old_value !== null ? JSON.parse(row.old_value as string) : null,
      newValue: JSON.parse(row.new_value as string),
      updatedBy: row.updated_by,
      updatedAt: row.updated_at,
      version: row.version,
    }));
  }

  /**
   * Reload config from the database for all cached environments.
   * Should be called periodically (≤60 s) to pick up changes.
   */
  async reload(): Promise<void> {
    const environments = Array.from(this.cache.keys());
    for (const env of environments) {
      this.cache.delete(env);
      await this._getCached(env);
    }
    logger.debug('ConfigService: reloaded config from DB', { environments });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _currentEnv(): Environment {
    const env = process.env.NODE_ENV as Environment;
    if (env === 'development' || env === 'staging' || env === 'production') {
      return env;
    }
    return 'development';
  }

  /** Return cached config, refreshing from DB if stale. */
  private async _getCached(environment: Environment): Promise<Record<string, any>> {
    const entry = this.cache.get(environment);
    const now = Date.now();

    if (entry && now - entry.loadedAt < this.CACHE_TTL_MS) {
      return entry.data;
    }

    const data = await this._fetchAll(environment);
    this.cache.set(environment, { data, loadedAt: now });
    return data;
  }

  /** Fetch all config rows for an environment from the DB. */
  private async _fetchAll(environment: Environment): Promise<Record<string, any>> {
    const result = await (await getDb()).query<{ key: string; value: string }>(
      `SELECT key, value FROM system_config WHERE environment = $1`,
      [environment]
    );

    const out: Record<string, any> = {};
    for (const row of result.rows) {
      out[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    }
    return out;
  }

  /** Fetch a single config row. */
  private async _fetchOne(
    environment: Environment,
    key: string
  ): Promise<{ value: any; version: number } | null> {
    const result = await (await getDb()).query<{ value: string; version: number }>(
      `SELECT value, version FROM system_config WHERE environment = $1 AND key = $2`,
      [environment, key]
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      value: typeof row.value === 'string' ? JSON.parse(row.value) : row.value,
      version: row.version,
    };
  }

  /** Resolve a dot-notation path against a flat config map. */
  private _getByPath(config: Record<string, any>, key: string): any {
    // First try exact key match (keys may contain dots)
    if (key in config) return config[key];

    // Then try dot-notation traversal
    const parts = key.split('.');
    let current: any = config;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = current[part];
    }
    return current;
  }
}

export const configService = new ConfigService();
export default configService;
