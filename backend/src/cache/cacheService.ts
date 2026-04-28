import { redis } from './connection';
import logger from '../utils/logger';

/**
 * Cache TTL constants (in seconds)
 * Requirements: 21.2, 21.3, 21.4
 */
export const CacheTTL = {
  SESSION: 8 * 60 * 60, // 8 hours
  DASHBOARD_METRICS: 5 * 60, // 5 minutes
  PERMISSIONS: 1 * 60 * 60, // 1 hour
  STATIC_DATA: 24 * 60 * 60, // 24 hours (countries, currencies)
  SEARCH_RESULTS: 10 * 60, // 10 minutes
} as const;

/**
 * Cache key prefixes for different data types
 */
export const CachePrefix = {
  SESSION: 'session:',
  DASHBOARD: 'dashboard:',
  PERMISSIONS: 'permissions:',
  USER: 'user:',
  STATIC: 'static:',
  SEARCH: 'search:',
} as const;

export class CacheService {
  private client = redis.getClient();

  /**
   * Set a value in cache with TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setEx(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      logger.debug('Cache set', { key, ttl });
    } catch (error) {
      logger.error('Cache set failed', { key, error });
      throw error;
    }
  }

  /**
   * Get a value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) {
        logger.debug('Cache miss', { key });
        return null;
      }
      logger.debug('Cache hit', { key });
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get failed', { key, error });
      return null;
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
      logger.debug('Cache deleted', { key });
    } catch (error) {
      logger.error('Cache delete failed', { key, error });
      throw error;
    }
  }

  /**
   * Delete multiple keys matching a pattern using SCAN to avoid blocking Redis.
   * KEYS is O(N) and blocks the event loop; SCAN iterates incrementally.
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      let cursor = 0;
      let totalDeleted = 0;
      do {
        const reply = await this.client.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = reply.cursor;
        if (reply.keys.length > 0) {
          await this.client.del(reply.keys);
          totalDeleted += reply.keys.length;
        }
      } while (cursor !== 0);
      logger.debug('Cache pattern deleted', { pattern, count: totalDeleted });
    } catch (error) {
      logger.error('Cache pattern delete failed', { pattern, error });
      throw error;
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists check failed', { key, error });
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error('Cache TTL check failed', { key, error });
      return -1;
    }
  }

  /**
   * Set multiple values in cache
   */
  async mset(entries: Record<string, any>, ttl?: number): Promise<void> {
    try {
      const pipeline = this.client.multi();
      for (const [key, value] of Object.entries(entries)) {
        const serialized = JSON.stringify(value);
        if (ttl) {
          pipeline.setEx(key, ttl, serialized);
        } else {
          pipeline.set(key, serialized);
        }
      }
      await pipeline.exec();
      logger.debug('Cache mset', { count: Object.keys(entries).length, ttl });
    } catch (error) {
      logger.error('Cache mset failed', { error });
      throw error;
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.client.mGet(keys);
      return values.map((value) => (value ? JSON.parse(value) : null));
    } catch (error) {
      logger.error('Cache mget failed', { keys, error });
      return keys.map(() => null);
    }
  }

  /**
   * Increment a counter in cache
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.client.incrBy(key, amount);
    } catch (error) {
      logger.error('Cache increment failed', { key, error });
      throw error;
    }
  }

  /**
   * Decrement a counter in cache
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.client.decrBy(key, amount);
    } catch (error) {
      logger.error('Cache decrement failed', { key, error });
      throw error;
    }
  }

  /**
   * Clear all cache
   */
  async flush(): Promise<void> {
    try {
      await this.client.flushDb();
      logger.info('Cache flushed');
    } catch (error) {
      logger.error('Cache flush failed', { error });
      throw error;
    }
  }
}

export const cacheService = new CacheService();
export default cacheService;
