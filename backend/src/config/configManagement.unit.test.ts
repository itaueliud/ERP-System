/**
 * Unit tests for Configuration Management
 * Task: 27.4
 * Requirements: 35.1-35.10, 68.1-68.10
 *
 * Covers:
 *  - JSON parsing (valid, invalid, nested)
 *  - YAML parsing (valid, invalid, nested)
 *  - Schema validation (required fields, type checking, default values)
 *  - Configuration change application (update settings, apply within 60 seconds)
 *  - Rollback (revert to previous version, maintain change history)
 */

import { ConfigParser, ConfigSchema } from './configParser';
import { ConfigService } from './configService';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockQuery = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../database/connection', () => ({
  db: {
    query: (...args: any[]) => mockQuery(...args),
    transaction: (cb: any) => mockTransaction(cb),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeClientQuery() {
  return jest.fn().mockResolvedValue({ rows: [], rowCount: 1 });
}

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
    key: 'app.name',
    old_value: JSON.stringify('OldName'),
    new_value: JSON.stringify('NewName'),
    updated_by: 'admin',
    updated_at: new Date('2024-01-01T10:00:00Z'),
    version: 2,
    ...overrides,
  };
}

// ─── 1. JSON Parsing ──────────────────────────────────────────────────────────
// Requirements: 68.1, 68.2, 68.3, 68.8

describe('JSON Parsing (Req 68.1, 68.2, 68.3, 68.8)', () => {
  let parser: ConfigParser;

  beforeEach(() => {
    parser = new ConfigParser();
  });

  it('parses a valid flat JSON config object', () => {
    const json = JSON.stringify({ host: 'localhost', port: 5432, debug: true });
    const result = parser.parseJSON(json);
    expect(result).toEqual({ host: 'localhost', port: 5432, debug: true });
  });

  it('parses a valid nested JSON config object (Req 68.8)', () => {
    const json = JSON.stringify({
      database: { host: 'db.example.com', port: 5432, pool: { min: 2, max: 20 } },
      cache: { ttl: 300, maxSize: 1000 },
    });
    const result = parser.parseJSON(json);
    expect(result.database.host).toBe('db.example.com');
    expect(result.database.pool.max).toBe(20);
    expect(result.cache.ttl).toBe(300);
  });

  it('parses JSON with arrays', () => {
    const json = JSON.stringify({ allowedRoles: ['admin', 'user'], maxRetries: 3 });
    const result = parser.parseJSON(json);
    expect(result.allowedRoles).toEqual(['admin', 'user']);
    expect(result.maxRetries).toBe(3);
  });

  it('throws a descriptive error for invalid JSON syntax (Req 68.3)', () => {
    expect(() => parser.parseJSON('{ host: localhost }')).toThrow(/Invalid JSON configuration/);
  });

  it('throws when JSON root is an array, not an object (Req 68.1)', () => {
    expect(() => parser.parseJSON('[1, 2, 3]')).toThrow(/Invalid JSON configuration/);
  });

  it('throws when JSON root is a primitive string (Req 68.1)', () => {
    expect(() => parser.parseJSON('"just a string"')).toThrow(/Invalid JSON configuration/);
  });

  it('throws on empty/truncated JSON (Req 68.3)', () => {
    expect(() => parser.parseJSON('{')).toThrow(/Invalid JSON configuration/);
  });

  it('parses JSON with all supported config value types', () => {
    const json = JSON.stringify({
      sessionTimeout: 28800,
      rateLimit: 100,
      debugMode: false,
      apiKey: 'secret-key',
      allowedTypes: ['pdf', 'docx'],
    });
    const result = parser.parseJSON(json);
    expect(typeof result.sessionTimeout).toBe('number');
    expect(typeof result.debugMode).toBe('boolean');
    expect(typeof result.apiKey).toBe('string');
    expect(Array.isArray(result.allowedTypes)).toBe(true);
  });
});

// ─── 2. YAML Parsing ──────────────────────────────────────────────────────────
// Requirements: 68.1, 68.2, 68.3, 68.8

describe('YAML Parsing (Req 68.1, 68.2, 68.3, 68.8)', () => {
  let parser: ConfigParser;

  beforeEach(() => {
    parser = new ConfigParser();
  });

  it('parses a valid flat YAML config', () => {
    const yaml = `host: localhost\nport: 5432\ndebug: true`;
    const result = parser.parseYAML(yaml);
    expect(result.host).toBe('localhost');
    expect(result.port).toBe(5432);
    expect(result.debug).toBe(true);
  });

  it('parses a valid nested YAML config (Req 68.8)', () => {
    const yaml = [
      'database:',
      '  host: db.example.com',
      '  port: 5432',
      '  pool:',
      '    min: 2',
      '    max: 20',
      'cache:',
      '  ttl: 300',
    ].join('\n');
    const result = parser.parseYAML(yaml);
    expect(result.database.host).toBe('db.example.com');
    expect(result.database.pool.max).toBe(20);
    expect(result.cache.ttl).toBe(300);
  });

  it('parses YAML boolean values (true/false/yes/no)', () => {
    const yaml = `enabled: true\ndisabled: false\nactive: yes\ninactive: no`;
    const result = parser.parseYAML(yaml);
    expect(result.enabled).toBe(true);
    expect(result.disabled).toBe(false);
    expect(result.active).toBe(true);
    expect(result.inactive).toBe(false);
  });

  it('parses YAML integer and float numbers', () => {
    const yaml = `timeout: 3600\nratio: 0.75`;
    const result = parser.parseYAML(yaml);
    expect(result.timeout).toBe(3600);
    expect(result.ratio).toBeCloseTo(0.75);
  });

  it('parses YAML null values', () => {
    const yaml = `apiKey: null\ntoken: ~`;
    const result = parser.parseYAML(yaml);
    expect(result.apiKey).toBeNull();
    expect(result.token).toBeNull();
  });

  it('parses YAML arrays', () => {
    const yaml = `allowedTypes:\n  - pdf\n  - docx\n  - xlsx`;
    const result = parser.parseYAML(yaml);
    expect(result.allowedTypes).toEqual(['pdf', 'docx', 'xlsx']);
  });

  it('ignores YAML comment lines', () => {
    const yaml = `# Config file\nhost: localhost\n# Port setting\nport: 3000`;
    const result = parser.parseYAML(yaml);
    expect(result.host).toBe('localhost');
    expect(result.port).toBe(3000);
    expect(Object.keys(result)).not.toContain('#');
  });

  it('throws a descriptive error for non-object root YAML (Req 68.3)', () => {
    expect(() => parser.parseYAML('- item1\n- item2')).toThrow(/Invalid YAML configuration/);
  });

  it('parses deeply nested YAML structures (Req 68.8)', () => {
    const yaml = `app:\n  server:\n    http:\n      port: 8080\n      host: 0.0.0.0`;
    const result = parser.parseYAML(yaml);
    expect(result.app.server.http.port).toBe(8080);
    expect(result.app.server.http.host).toBe('0.0.0.0');
  });

  it('parses YAML with quoted strings containing special characters', () => {
    const yaml = `message: "hello: world"\npath: '/usr/local/bin'`;
    const result = parser.parseYAML(yaml);
    expect(result.message).toBe('hello: world');
    expect(result.path).toBe('/usr/local/bin');
  });
});

// ─── 3. Schema Validation ─────────────────────────────────────────────────────
// Requirements: 35.5, 35.6, 68.4, 68.9, 68.10

describe('Schema Validation (Req 35.5, 35.6, 68.4, 68.9, 68.10)', () => {
  let parser: ConfigParser;

  const erpConfigSchema: ConfigSchema = {
    sessionTimeout: { type: 'number', required: true },
    rateLimit: { type: 'number', required: true },
    debugMode: { type: 'boolean', default: false },
    fileSizeLimit: { type: 'number', default: 52428800 }, // 50 MB
    database: {
      type: 'object',
      required: true,
      nested: {
        host: { type: 'string', required: true },
        port: { type: 'number', required: true },
        poolSize: { type: 'number', default: 10 },
      },
    },
    notifications: {
      type: 'object',
      nested: {
        email: { type: 'boolean', default: true },
        sms: { type: 'boolean', default: false },
      },
    },
    allowedFileTypes: { type: 'array' },
  };

  beforeEach(() => {
    parser = new ConfigParser();
  });

  it('validates a fully correct config as valid (Req 68.4)', () => {
    const config = {
      sessionTimeout: 28800,
      rateLimit: 100,
      database: { host: 'localhost', port: 5432 },
    };
    const result = parser.validate(config, erpConfigSchema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports missing required top-level fields (Req 68.9)', () => {
    const config = { database: { host: 'localhost', port: 5432 } };
    const result = parser.validate(config, erpConfigSchema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('sessionTimeout'))).toBe(true);
    expect(result.errors.some((e) => e.includes('rateLimit'))).toBe(true);
  });

  it('reports missing required nested fields (Req 68.9)', () => {
    const config = {
      sessionTimeout: 28800,
      rateLimit: 100,
      database: { host: 'localhost' }, // missing port
    };
    const result = parser.validate(config, erpConfigSchema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('database.port'))).toBe(true);
  });

  it('reports type mismatch for top-level field (Req 35.5, 35.6)', () => {
    const config = {
      sessionTimeout: 'not-a-number', // wrong type
      rateLimit: 100,
      database: { host: 'localhost', port: 5432 },
    };
    const result = parser.validate(config, erpConfigSchema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('sessionTimeout') && e.includes('number'))).toBe(true);
  });

  it('reports type mismatch for nested field', () => {
    const config = {
      sessionTimeout: 28800,
      rateLimit: 100,
      database: { host: 123, port: 5432 }, // host should be string
    };
    const result = parser.validate(config, erpConfigSchema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('database.host') && e.includes('string'))).toBe(true);
  });

  it('accepts optional fields when absent (Req 68.10)', () => {
    const config = {
      sessionTimeout: 28800,
      rateLimit: 100,
      database: { host: 'localhost', port: 5432 },
      // debugMode, fileSizeLimit, notifications, allowedFileTypes are optional
    };
    const result = parser.validate(config, erpConfigSchema);
    expect(result.valid).toBe(true);
  });

  it('validates array type field', () => {
    const config = {
      sessionTimeout: 28800,
      rateLimit: 100,
      database: { host: 'localhost', port: 5432 },
      allowedFileTypes: 'pdf', // should be array
    };
    const result = parser.validate(config, erpConfigSchema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('allowedFileTypes'))).toBe(true);
  });

  it('accumulates multiple validation errors (Req 35.6)', () => {
    const config = {};
    const result = parser.validate(config, erpConfigSchema);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('applies default values for optional fields (Req 68.10)', () => {
    const config = {
      sessionTimeout: 28800,
      rateLimit: 100,
      database: { host: 'localhost', port: 5432 },
    };
    const withDefaults = parser.applyDefaults(config, erpConfigSchema);
    expect(withDefaults.debugMode).toBe(false);
    expect(withDefaults.fileSizeLimit).toBe(52428800);
    expect(withDefaults.database.poolSize).toBe(10);
  });

  it('does not overwrite existing values when applying defaults', () => {
    const config = {
      sessionTimeout: 28800,
      rateLimit: 100,
      debugMode: true, // explicitly set
      database: { host: 'localhost', port: 5432, poolSize: 50 },
    };
    const withDefaults = parser.applyDefaults(config, erpConfigSchema);
    expect(withDefaults.debugMode).toBe(true);
    expect(withDefaults.database.poolSize).toBe(50);
  });

  it('applyDefaults is non-destructive (returns new object)', () => {
    const config = { sessionTimeout: 28800, rateLimit: 100, database: { host: 'localhost', port: 5432 } };
    const withDefaults = parser.applyDefaults(config, erpConfigSchema);
    expect(withDefaults).not.toBe(config);
    expect((config as any).debugMode).toBeUndefined();
  });
});

// ─── 4. Configuration Change Application ─────────────────────────────────────
// Requirements: 35.1, 35.2, 35.3, 35.4, 35.5, 35.6, 35.7, 35.9

describe('Configuration Change Application (Req 35.1-35.9)', () => {
  let service: ConfigService;

  beforeEach(() => {
    service = new ConfigService();
    mockQuery.mockReset();
    mockTransaction.mockReset();
    mockTransaction.mockImplementation(async (cb: any) => {
      const clientQuery = makeClientQuery();
      return cb({ query: clientQuery });
    });
  });

  it('stores a new config key in the database (Req 35.1)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // _fetchOne: key does not exist
    const clientQuery = makeClientQuery();
    mockTransaction.mockImplementationOnce(async (cb: any) => cb({ query: clientQuery }));

    await service.set('session_timeout', 28800, 'production', 'admin');

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    const [upsertSql] = clientQuery.mock.calls[0];
    expect(upsertSql).toContain('INSERT INTO system_config');
  });

  it('supports environment-specific configuration (Req 35.2)', async () => {
    // dev config
    mockQuery.mockResolvedValueOnce({
      rows: [{ key: 'debug', value: JSON.stringify(true) }],
    });
    const devAll = await service.getAll('development');
    expect(devAll.debug).toBe(true);

    // prod config (separate cache entry)
    mockQuery.mockResolvedValueOnce({
      rows: [{ key: 'debug', value: JSON.stringify(false) }],
    });
    const prodAll = await service.getAll('production');
    expect(prodAll.debug).toBe(false);
  });

  it('records change history with timestamp and user (Req 35.7)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // _fetchOne
    const clientQuery = makeClientQuery();
    mockTransaction.mockImplementationOnce(async (cb: any) => cb({ query: clientQuery }));

    await service.set('rate_limit', 200, 'staging', 'admin-user');

    const [historySql, historyParams] = clientQuery.mock.calls[1];
    expect(historySql).toContain('INSERT INTO config_history');
    expect(historyParams).toContain('admin-user');
    expect(historyParams).toContain('staging');
    expect(historyParams).toContain('rate_limit');
  });

  it('increments version number on each update (Req 35.7)', async () => {
    // Existing key at version 5
    mockQuery.mockResolvedValueOnce({
      rows: [{ value: JSON.stringify(100), version: 5 }],
    });
    const clientQuery = makeClientQuery();
    mockTransaction.mockImplementationOnce(async (cb: any) => cb({ query: clientQuery }));

    await service.set('rate_limit', 200, 'production', 'admin');

    const [, upsertParams] = clientQuery.mock.calls[0];
    expect(upsertParams[4]).toBe(6); // version should be 6
  });

  it('invalidates cache after set so next read reflects new value (Req 35.4)', async () => {
    // Prime cache
    mockQuery.mockResolvedValueOnce({
      rows: [{ key: 'file_size_limit', value: JSON.stringify(52428800) }],
    });
    await service.getAll('production');

    // set() — _fetchOne + transaction
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const clientQuery = makeClientQuery();
    mockTransaction.mockImplementationOnce(async (cb: any) => cb({ query: clientQuery }));
    await service.set('file_size_limit', 104857600, 'production', 'admin');

    // After cache invalidation, next read hits DB
    mockQuery.mockResolvedValueOnce({
      rows: [{ key: 'file_size_limit', value: JSON.stringify(104857600) }],
    });
    const all = await service.getAll('production');
    expect(all.file_size_limit).toBe(104857600);
  });

  it('cache TTL is 60 seconds — re-fetches after expiry (Req 35.4)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ key: 'session_timeout', value: JSON.stringify(28800) }],
    });
    await service.getAll('production');

    // Simulate cache expiry (61 seconds)
    const cache = (service as any).cache as Map<string, { data: any; loadedAt: number }>;
    const entry = cache.get('production')!;
    entry.loadedAt = Date.now() - 61_000;

    mockQuery.mockResolvedValueOnce({
      rows: [{ key: 'session_timeout', value: JSON.stringify(14400) }],
    });
    const all = await service.getAll('production');
    expect(all.session_timeout).toBe(14400);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('retrieves a config value by dot-notation key (Req 35.9)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ key: 'payment', value: JSON.stringify({ threshold: 10000, currency: 'KES' }) }],
    });
    const value = await service.get('payment.threshold', 'production');
    expect(value).toBe(10000);
  });

  it('returns undefined for a non-existent key', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const value = await service.get('nonexistent.key', 'production');
    expect(value).toBeUndefined();
  });

  it('uses in-memory cache on repeated reads (Req 35.4)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ key: 'app.name', value: JSON.stringify('TechSwiftTrix ERP') }],
    });
    await service.get('app.name', 'production');
    await service.get('app.name', 'production');
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('reload() re-fetches config from DB for all cached environments', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ key: 'x', value: JSON.stringify(1) }],
    });
    await service.getAll('production');

    mockQuery.mockResolvedValueOnce({
      rows: [{ key: 'x', value: JSON.stringify(2) }],
    });
    await service.reload();

    mockQuery.mockResolvedValueOnce({
      rows: [{ key: 'x', value: JSON.stringify(2) }],
    });
    const all = await service.getAll('production');
    expect(all.x).toBe(2);
  });
});

// ─── 5. Rollback Functionality ────────────────────────────────────────────────
// Requirements: 35.7, 35.8

describe('Rollback Functionality (Req 35.7, 35.8)', () => {
  let service: ConfigService;

  beforeEach(() => {
    service = new ConfigService();
    mockQuery.mockReset();
    mockTransaction.mockReset();
    mockTransaction.mockImplementation(async (cb: any) => {
      const clientQuery = makeClientQuery();
      return cb({ query: clientQuery });
    });
  });

  it('rolls back a key to its previous value at the given version (Req 35.8)', async () => {
    // getHistory query for version 3
    mockQuery.mockResolvedValueOnce({
      rows: [{ key: 'session_timeout', old_value: JSON.stringify(28800) }],
    });
    // _fetchOne for set() inside rollback
    mockQuery.mockResolvedValueOnce({
      rows: [{ value: JSON.stringify(14400), version: 3 }],
    });
    const clientQuery = makeClientQuery();
    mockTransaction.mockImplementationOnce(async (cb: any) => cb({ query: clientQuery }));

    await service.rollback('production', 3, 'admin');

    expect(clientQuery).toHaveBeenCalledTimes(2); // upsert + history
    const [, upsertParams] = clientQuery.mock.calls[0];
    // Restored value should be 28800
    expect(upsertParams[2]).toBe(JSON.stringify(28800));
  });

  it('throws when no history exists for the given version (Req 35.8)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(service.rollback('production', 999, 'admin')).rejects.toThrow(
      /No config history found/
    );
  });

  it('skips keys whose old_value is null (newly created keys have no prior state)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ key: 'new.feature.flag', old_value: null }],
    });

    await service.rollback('production', 1, 'admin');

    // No transaction should be called since there's nothing to restore
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rolls back multiple keys at once', async () => {
    // History has two keys at version 5
    mockQuery.mockResolvedValueOnce({
      rows: [
        { key: 'rate_limit', old_value: JSON.stringify(100) },
        { key: 'file_size_limit', old_value: JSON.stringify(52428800) },
      ],
    });
    // _fetchOne for rate_limit
    mockQuery.mockResolvedValueOnce({ rows: [{ value: JSON.stringify(200), version: 5 }] });
    const clientQuery1 = makeClientQuery();
    mockTransaction.mockImplementationOnce(async (cb: any) => cb({ query: clientQuery1 }));

    // _fetchOne for file_size_limit
    mockQuery.mockResolvedValueOnce({ rows: [{ value: JSON.stringify(104857600), version: 5 }] });
    const clientQuery2 = makeClientQuery();
    mockTransaction.mockImplementationOnce(async (cb: any) => cb({ query: clientQuery2 }));

    await service.rollback('production', 5, 'admin');

    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });

  it('maintains change history after rollback (Req 35.7)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ key: 'debug', old_value: JSON.stringify(false) }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ value: JSON.stringify(true), version: 2 }] });
    const clientQuery = makeClientQuery();
    mockTransaction.mockImplementationOnce(async (cb: any) => cb({ query: clientQuery }));

    await service.rollback('staging', 2, 'admin');

    // History insert should have been called
    const [historySql] = clientQuery.mock.calls[1];
    expect(historySql).toContain('INSERT INTO config_history');
  });

  it('getHistory() returns mapped ConfigChange objects with correct fields (Req 35.7)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeHistoryRow({ key: 'session_timeout', old_value: JSON.stringify(28800), new_value: JSON.stringify(14400), version: 3 }),
        makeHistoryRow({ id: 'hist-2', key: 'rate_limit', old_value: JSON.stringify(100), new_value: JSON.stringify(200), version: 2 }),
      ],
    });

    const history = await service.getHistory('production');

    expect(history).toHaveLength(2);
    const [first, second] = history;

    expect(first.key).toBe('session_timeout');
    expect(first.oldValue).toBe(28800);
    expect(first.newValue).toBe(14400);
    expect(first.version).toBe(3);
    expect(first.updatedBy).toBe('admin');
    expect(first.updatedAt).toBeInstanceOf(Date);

    expect(second.key).toBe('rate_limit');
    expect(second.oldValue).toBe(100);
    expect(second.newValue).toBe(200);
  });

  it('getHistory() handles null old_value for newly created keys', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [makeHistoryRow({ old_value: null })],
    });

    const history = await service.getHistory('production');
    expect(history[0].oldValue).toBeNull();
  });

  it('getHistory() uses default limit of 50', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await service.getHistory('production');

    const [, params] = mockQuery.mock.calls[0];
    expect(params[1]).toBe(50);
  });

  it('getHistory() accepts a custom limit', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await service.getHistory('staging', 10);

    const [, params] = mockQuery.mock.calls[0];
    expect(params[1]).toBe(10);
  });

  it('getHistory() returns empty array when no history exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const history = await service.getHistory('development');
    expect(history).toEqual([]);
  });
});
