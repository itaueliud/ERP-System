/**
 * Unit tests for ConfigService
 * Requirements: 35.1–35.10
 */

import { ConfigService, ConfigChange } from './configService';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockQuery = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../database/connection', () => ({
  db: {
    query: (...args: any[]) => mockQuery(...args),
    transaction: (cb: any) => mockTransaction(cb),
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeHistoryRow(overrides: Partial<{
  id: string;
  environment: string;
  key: string;
  old_value: string | null;
  new_value: string;
  updated_by: string;
  updated_at: Date;
  version: number;
}> = {}) {
  return {
    id: 'hist-1',
    environment: 'production',
    key: 'feature.flag',
    old_value: JSON.stringify(false),
    new_value: JSON.stringify(true),
    updated_by: 'admin',
    updated_at: new Date('2024-06-01T10:00:00Z'),
    version: 2,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(() => {
    service = new ConfigService();
    mockQuery.mockReset();
    mockTransaction.mockReset();
    // Default transaction mock: execute the callback with a mock client
    mockTransaction.mockImplementation(async (cb: any) => {
      const client = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
      return cb(client);
    });
  });

  // ── get() ──────────────────────────────────────────────────────────────────

  describe('get()', () => {
    it('returns the value for an existing key', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'smtp.host', value: JSON.stringify('mail.example.com') }],
      });

      const value = await service.get('smtp.host', 'production');
      expect(value).toBe('mail.example.com');
    });

    it('returns undefined for a missing key', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const value = await service.get('nonexistent.key', 'production');
      expect(value).toBeUndefined();
    });

    it('uses the in-memory cache on second call (only one DB query)', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'app.name', value: JSON.stringify('ERP') }],
      });

      await service.get('app.name', 'staging');
      await service.get('app.name', 'staging');

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('defaults to NODE_ENV environment when none is specified', async () => {
      process.env.NODE_ENV = 'development';
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'debug', value: JSON.stringify(true) }],
      });

      const value = await service.get('debug');
      expect(value).toBe(true);
    });

    it('resolves dot-notation path within a stored object value', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'db', value: JSON.stringify({ host: 'localhost', port: 5432 }) }],
      });

      // 'db' key holds an object; dot-notation traversal should reach db.host
      const value = await service.get('db.host', 'development');
      expect(value).toBe('localhost');
    });
  });

  // ── set() ──────────────────────────────────────────────────────────────────

  describe('set()', () => {
    it('upserts the config and records history inside a transaction', async () => {
      // _fetchOne returns null (new key)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const clientQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 1 });
      mockTransaction.mockImplementationOnce(async (cb: any) => cb({ query: clientQuery }));

      await service.set('feature.x', true, 'production', 'admin');

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      // Two queries inside the transaction: upsert + history insert
      expect(clientQuery).toHaveBeenCalledTimes(2);

      const [upsertSql] = clientQuery.mock.calls[0];
      expect(upsertSql).toContain('INSERT INTO system_config');
      expect(upsertSql).toContain('ON CONFLICT');

      const [historySql] = clientQuery.mock.calls[1];
      expect(historySql).toContain('INSERT INTO config_history');
    });

    it('increments version on update', async () => {
      // _fetchOne returns existing row at version 3
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: JSON.stringify('old'), version: 3 }],
      });

      const clientQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 1 });
      mockTransaction.mockImplementationOnce(async (cb: any) => cb({ query: clientQuery }));

      await service.set('key', 'new', 'staging', 'user1');

      const [, params] = clientQuery.mock.calls[0];
      // version param should be 4
      expect(params[4]).toBe(4);
    });

    it('invalidates the cache after a successful set', async () => {
      // Prime the cache
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'x', value: JSON.stringify(1) }],
      });
      await service.getAll('production');

      // set() — _fetchOne + transaction
      mockQuery.mockResolvedValueOnce({ rows: [] }); // _fetchOne
      const clientQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 1 });
      mockTransaction.mockImplementationOnce(async (cb: any) => cb({ query: clientQuery }));

      await service.set('x', 2, 'production', 'admin');

      // After invalidation, next getAll should hit DB again
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'x', value: JSON.stringify(2) }],
      });
      const all = await service.getAll('production');
      expect(all['x']).toBe(2);
      // DB was queried twice total for getAll (before + after invalidation)
      expect(mockQuery).toHaveBeenCalledTimes(3); // prime + fetchOne + reload
    });
  });

  // ── getAll() ───────────────────────────────────────────────────────────────

  describe('getAll()', () => {
    it('returns all key-value pairs for the environment', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { key: 'a', value: JSON.stringify(1) },
          { key: 'b', value: JSON.stringify('hello') },
        ],
      });

      const all = await service.getAll('development');
      expect(all).toEqual({ a: 1, b: 'hello' });
    });

    it('returns an empty object when no config exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const all = await service.getAll('staging');
      expect(all).toEqual({});
    });
  });

  // ── rollback() ─────────────────────────────────────────────────────────────

  describe('rollback()', () => {
    it('restores each key to its old_value at the given version', async () => {
      // getHistory query for version 2
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'flag', old_value: JSON.stringify(false) }],
      });
      // _fetchOne for set() inside rollback
      mockQuery.mockResolvedValueOnce({ rows: [{ value: JSON.stringify(true), version: 2 }] });

      const clientQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 1 });
      mockTransaction.mockImplementationOnce(async (cb: any) => cb({ query: clientQuery }));

      await service.rollback('production', 2, 'admin');

      expect(clientQuery).toHaveBeenCalledTimes(2); // upsert + history
    });

    it('throws when no history exists for the given version', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(service.rollback('production', 99, 'admin')).rejects.toThrow(
        /No config history found/
      );
    });

    it('skips keys whose old_value is null (newly created keys)', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'new.key', old_value: null }],
      });

      // Should not call set() at all — no transaction expected
      await service.rollback('production', 1, 'admin');

      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  // ── getHistory() ───────────────────────────────────────────────────────────

  describe('getHistory()', () => {
    it('returns mapped ConfigChange objects', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeHistoryRow()] });

      const history = await service.getHistory('production');

      expect(history).toHaveLength(1);
      const change: ConfigChange = history[0];
      expect(change.id).toBe('hist-1');
      expect(change.environment).toBe('production');
      expect(change.key).toBe('feature.flag');
      expect(change.oldValue).toBe(false);
      expect(change.newValue).toBe(true);
      expect(change.updatedBy).toBe('admin');
      expect(change.version).toBe(2);
      expect(change.updatedAt).toBeInstanceOf(Date);
    });

    it('uses default limit of 50', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.getHistory('staging');

      const [, params] = mockQuery.mock.calls[0];
      expect(params[1]).toBe(50);
    });

    it('accepts a custom limit', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.getHistory('development', 10);

      const [, params] = mockQuery.mock.calls[0];
      expect(params[1]).toBe(10);
    });

    it('handles null old_value (new key creation)', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [makeHistoryRow({ old_value: null })],
      });

      const history = await service.getHistory('production');
      expect(history[0].oldValue).toBeNull();
    });

    it('returns empty array when no history exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const history = await service.getHistory('production');
      expect(history).toEqual([]);
    });
  });

  // ── reload() ───────────────────────────────────────────────────────────────

  describe('reload()', () => {
    it('re-fetches config from DB after reload', async () => {
      // Prime cache for 'production'
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'x', value: JSON.stringify(1) }],
      });
      await service.getAll('production');

      // reload() should invalidate and re-fetch
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'x', value: JSON.stringify(2) }],
      });
      await service.reload();

      // Cache should now hold updated value
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'x', value: JSON.stringify(2) }],
      });
      const all = await service.getAll('production');
      expect(all['x']).toBe(2);
    });

    it('does nothing when cache is empty', async () => {
      await service.reload();
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  // ── Cache TTL ──────────────────────────────────────────────────────────────

  describe('Cache TTL', () => {
    it('re-fetches from DB after cache expires (simulated)', async () => {
      // First load
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'ttl.test', value: JSON.stringify('v1') }],
      });
      await service.getAll('staging');

      // Manually expire the cache
      const cache = (service as any).cache as Map<string, { data: any; loadedAt: number }>;
      const entry = cache.get('staging')!;
      entry.loadedAt = Date.now() - 61_000; // 61 seconds ago

      // Second load should hit DB again
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'ttl.test', value: JSON.stringify('v2') }],
      });
      const all = await service.getAll('staging');

      expect(all['ttl.test']).toBe('v2');
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });
});
