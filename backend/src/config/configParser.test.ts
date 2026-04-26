import { ConfigParser, ConfigSchema } from './configParser';

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

// We instantiate a fresh parser for each test group
let parser: ConfigParser;

beforeEach(() => {
  parser = new ConfigParser();
});

// ─── parseJSON ────────────────────────────────────────────────────────────────

describe('parseJSON', () => {
  it('parses a flat JSON object', () => {
    const json = JSON.stringify({ host: 'localhost', port: 5432, debug: true });
    const result = parser.parseJSON(json);
    expect(result).toEqual({ host: 'localhost', port: 5432, debug: true });
  });

  it('parses a nested JSON object', () => {
    const json = JSON.stringify({ database: { host: 'db', port: 5432 }, cache: { ttl: 300 } });
    const result = parser.parseJSON(json);
    expect(result.database.host).toBe('db');
    expect(result.cache.ttl).toBe(300);
  });

  it('parses JSON with arrays', () => {
    const json = JSON.stringify({ allowedTypes: ['pdf', 'docx', 'xlsx'] });
    const result = parser.parseJSON(json);
    expect(result.allowedTypes).toEqual(['pdf', 'docx', 'xlsx']);
  });

  it('throws on invalid JSON', () => {
    expect(() => parser.parseJSON('{ not valid json')).toThrow(/Invalid JSON configuration/);
  });

  it('throws when JSON root is not an object', () => {
    expect(() => parser.parseJSON('"just a string"')).toThrow(/Invalid JSON configuration/);
    expect(() => parser.parseJSON('[1, 2, 3]')).toThrow(/Invalid JSON configuration/);
  });
});

// ─── parseYAML ────────────────────────────────────────────────────────────────

describe('parseYAML', () => {
  it('parses flat key: value pairs', () => {
    const yaml = `host: localhost\nport: 5432\ndebug: true`;
    const result = parser.parseYAML(yaml);
    expect(result.host).toBe('localhost');
    expect(result.port).toBe(5432);
    expect(result.debug).toBe(true);
  });

  it('parses nested objects via indentation', () => {
    const yaml = `database:\n  host: db\n  port: 5432\ncache:\n  ttl: 300`;
    const result = parser.parseYAML(yaml);
    expect(result.database).toEqual({ host: 'db', port: 5432 });
    expect(result.cache).toEqual({ ttl: 300 });
  });

  it('parses arrays with - item syntax', () => {
    const yaml = `allowedTypes:\n  - pdf\n  - docx\n  - xlsx`;
    const result = parser.parseYAML(yaml);
    expect(result.allowedTypes).toEqual(['pdf', 'docx', 'xlsx']);
  });

  it('parses double-quoted strings', () => {
    const yaml = `message: "hello world"`;
    const result = parser.parseYAML(yaml);
    expect(result.message).toBe('hello world');
  });

  it('parses single-quoted strings', () => {
    const yaml = `message: 'hello world'`;
    const result = parser.parseYAML(yaml);
    expect(result.message).toBe('hello world');
  });

  it('parses boolean values', () => {
    const yaml = `enabled: true\ndisabled: false\nyes_val: yes\nno_val: no`;
    const result = parser.parseYAML(yaml);
    expect(result.enabled).toBe(true);
    expect(result.disabled).toBe(false);
    expect(result.yes_val).toBe(true);
    expect(result.no_val).toBe(false);
  });

  it('parses integer and float numbers', () => {
    const yaml = `count: 42\nratio: 3.14`;
    const result = parser.parseYAML(yaml);
    expect(result.count).toBe(42);
    expect(result.ratio).toBeCloseTo(3.14);
  });

  it('parses null values', () => {
    const yaml = `value: null\nother: ~`;
    const result = parser.parseYAML(yaml);
    expect(result.value).toBeNull();
    expect(result.other).toBeNull();
  });

  it('ignores comment lines', () => {
    const yaml = `# This is a comment\nhost: localhost\n# Another comment\nport: 3000`;
    const result = parser.parseYAML(yaml);
    expect(result.host).toBe('localhost');
    expect(result.port).toBe(3000);
  });

  it('handles deeply nested structures', () => {
    const yaml = `app:\n  server:\n    host: 0.0.0.0\n    port: 8080`;
    const result = parser.parseYAML(yaml);
    expect(result.app.server.host).toBe('0.0.0.0');
    expect(result.app.server.port).toBe(8080);
  });

  it('throws on non-object root', () => {
    // A bare scalar is not a valid config root
    expect(() => parser.parseYAML('- item1\n- item2')).toThrow(/Invalid YAML configuration/);
  });

  it('parses arrays of objects', () => {
    const yaml = `users:\n  - name: Alice\n    role: admin\n  - name: Bob\n    role: user`;
    const result = parser.parseYAML(yaml);
    expect(result.users).toHaveLength(2);
    expect(result.users[0]).toEqual({ name: 'Alice', role: 'admin' });
    expect(result.users[1]).toEqual({ name: 'Bob', role: 'user' });
  });
});

// ─── serialize ────────────────────────────────────────────────────────────────

describe('serialize', () => {
  const config = {
    host: 'localhost',
    port: 5432,
    debug: false,
    database: { name: 'mydb', pool: 10 },
    tags: ['a', 'b'],
  };

  it('serializes to JSON with 2-space indent', () => {
    const output = parser.serialize(config, 'json');
    const parsed = JSON.parse(output);
    expect(parsed).toEqual(config);
    expect(output).toContain('  '); // indented
  });

  it('serializes to YAML string', () => {
    const output = parser.serialize(config, 'yaml');
    expect(typeof output).toBe('string');
    expect(output).toContain('host:');
    expect(output).toContain('port:');
  });

  it('YAML output can be re-parsed', () => {
    const output = parser.serialize(config, 'yaml');
    const reparsed = parser.parseYAML(output);
    expect(reparsed.host).toBe(config.host);
    expect(reparsed.port).toBe(config.port);
    expect(reparsed.debug).toBe(config.debug);
    expect(reparsed.database).toEqual(config.database);
  });

  it('JSON round-trip preserves all values', () => {
    const output = parser.serialize(config, 'json');
    const reparsed = parser.parseJSON(output);
    expect(reparsed).toEqual(config);
  });
});

// ─── validate ─────────────────────────────────────────────────────────────────

describe('validate', () => {
  const schema: ConfigSchema = {
    host: { type: 'string', required: true },
    port: { type: 'number', required: true },
    debug: { type: 'boolean' },
    database: {
      type: 'object',
      required: true,
      nested: {
        name: { type: 'string', required: true },
        pool: { type: 'number' },
      },
    },
    tags: { type: 'array' },
  };

  it('returns valid for a correct config', () => {
    const config = { host: 'localhost', port: 5432, database: { name: 'mydb' } };
    const result = parser.validate(config, schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports missing required fields', () => {
    const config = { port: 5432, database: { name: 'mydb' } };
    const result = parser.validate(config, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('host'))).toBe(true);
  });

  it('reports type mismatch', () => {
    const config = { host: 123, port: 5432, database: { name: 'mydb' } };
    const result = parser.validate(config, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('host') && e.includes('string'))).toBe(true);
  });

  it('validates nested required fields', () => {
    const config = { host: 'localhost', port: 5432, database: {} };
    const result = parser.validate(config, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('database.name'))).toBe(true);
  });

  it('validates nested type mismatches', () => {
    const config = { host: 'localhost', port: 5432, database: { name: 'mydb', pool: 'ten' } };
    const result = parser.validate(config, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('database.pool'))).toBe(true);
  });

  it('accepts optional fields when absent', () => {
    const config = { host: 'localhost', port: 5432, database: { name: 'mydb' } };
    const result = parser.validate(config, schema);
    expect(result.valid).toBe(true);
  });

  it('validates array type', () => {
    const config = { host: 'localhost', port: 5432, database: { name: 'mydb' }, tags: 'not-array' };
    const result = parser.validate(config, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('tags'))).toBe(true);
  });

  it('accumulates multiple errors', () => {
    const config = {};
    const result = parser.validate(config, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

// ─── applyDefaults ────────────────────────────────────────────────────────────

describe('applyDefaults', () => {
  const schema: ConfigSchema = {
    host: { type: 'string', required: true },
    port: { type: 'number', default: 3000 },
    debug: { type: 'boolean', default: false },
    database: {
      type: 'object',
      nested: {
        pool: { type: 'number', default: 10 },
        name: { type: 'string', required: true },
      },
    },
  };

  it('fills in missing optional fields with defaults', () => {
    const config = { host: 'localhost', database: { name: 'mydb' } };
    const result = parser.applyDefaults(config, schema);
    expect(result.port).toBe(3000);
    expect(result.debug).toBe(false);
  });

  it('does not overwrite existing values', () => {
    const config = { host: 'localhost', port: 8080, database: { name: 'mydb' } };
    const result = parser.applyDefaults(config, schema);
    expect(result.port).toBe(8080);
  });

  it('applies nested defaults', () => {
    const config = { host: 'localhost', database: { name: 'mydb' } };
    const result = parser.applyDefaults(config, schema);
    expect(result.database.pool).toBe(10);
  });

  it('does not overwrite existing nested values', () => {
    const config = { host: 'localhost', database: { name: 'mydb', pool: 50 } };
    const result = parser.applyDefaults(config, schema);
    expect(result.database.pool).toBe(50);
  });

  it('returns a new object (non-destructive)', () => {
    const config = { host: 'localhost', database: { name: 'mydb' } };
    const result = parser.applyDefaults(config, schema);
    expect(result).not.toBe(config);
    expect((config as any).port).toBeUndefined();
  });

  it('creates nested object when missing and applies defaults', () => {
    const config = { host: 'localhost' };
    const result = parser.applyDefaults(config, schema);
    expect(result.database).toBeDefined();
    expect(result.database.pool).toBe(10);
  });
});

// ─── Round-trip (JSON and YAML) ───────────────────────────────────────────────

describe('round-trip', () => {
  const configs = [
    { host: 'localhost', port: 5432, debug: true },
    { app: { name: 'erp', version: '1.0.0' }, features: ['auth', 'payments'] },
    { nested: { deep: { value: 42 } }, flag: false },
  ];

  for (const config of configs) {
    it(`JSON round-trip: ${JSON.stringify(config).slice(0, 40)}`, () => {
      const serialized = parser.serialize(config, 'json');
      const reparsed = parser.parseJSON(serialized);
      expect(reparsed).toEqual(config);
    });

    it(`YAML round-trip: ${JSON.stringify(config).slice(0, 40)}`, () => {
      const serialized = parser.serialize(config, 'yaml');
      const reparsed = parser.parseYAML(serialized);
      expect(reparsed.host ?? reparsed.app ?? reparsed.nested).toBeDefined();
      // Verify key values match
      for (const [k, v] of Object.entries(config)) {
        if (typeof v !== 'object') {
          expect(reparsed[k]).toEqual(v);
        }
      }
    });
  }
});
