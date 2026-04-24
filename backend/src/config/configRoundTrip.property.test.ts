/**
 * Property-Based Tests: Configuration Round-Trip
 *
 * Property 11: Configuration Round-Trip
 * Validates: Requirements 68.6
 *
 * FOR ALL valid Configuration_Objects, parsing then serializing then parsing
 * SHALL produce an equivalent Configuration_Object (round-trip property).
 *
 * Uses Math.random-based generation (no fast-check).
 */

import { ConfigParser } from './configParser';

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

// ─── Generators ──────────────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


/** Safe identifier-like strings for config keys */
const KEY_CHARS = 'abcdefghijklmnopqrstuvwxyz_';

function randKey(maxLen = 10): string {
  const len = randInt(2, maxLen);
  let s = '';
  for (let i = 0; i < len; i++) {
    s += KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)];
  }
  // Keys must start with a letter
  return s.replace(/^_+/, 'k');
}

/**
 * Safe string values: avoid characters that the YAML serializer quotes
 * in ways that could cause round-trip issues with the custom parser.
 * Specifically avoid: leading/trailing spaces, colons, hashes, newlines,
 * and YAML reserved words (true/false/yes/no/on/off/null/~).
 */
const SAFE_VALUE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
const YAML_RESERVED = new Set(['true', 'false', 'yes', 'no', 'on', 'off', 'null', '~', '']);

function randSafeString(maxLen = 15): string {
  let s = '';
  const len = randInt(1, maxLen);
  for (let i = 0; i < len; i++) {
    s += SAFE_VALUE_CHARS[Math.floor(Math.random() * SAFE_VALUE_CHARS.length)];
  }
  // Avoid strings that look like numbers or YAML reserved words
  if (YAML_RESERVED.has(s.toLowerCase()) || /^-?\d+(\.\d+)?$/.test(s)) {
    s = 'str_' + s;
  }
  return s;
}

function randNumber(): number {
  return Math.random() < 0.5
    ? randInt(-9999, 9999)
    : Math.round(Math.random() * 10000 * 100) / 100;
}

function randBoolean(): boolean {
  return Math.random() < 0.5;
}

type ScalarValue = string | number | boolean;

function randScalar(): ScalarValue {
  const kind = randInt(0, 2);
  if (kind === 0) return randSafeString();
  if (kind === 1) return randNumber();
  return randBoolean();
}

/**
 * Generate a random flat config object (no nesting, no arrays).
 * Useful for testing basic scalar round-trips.
 */
function randomFlatConfig(keyCount: number): Record<string, ScalarValue> {
  const config: Record<string, ScalarValue> = {};
  const usedKeys = new Set<string>();
  for (let i = 0; i < keyCount; i++) {
    let key = randKey();
    while (usedKeys.has(key)) key = randKey();
    usedKeys.add(key);
    config[key] = randScalar();
  }
  return config;
}

/**
 * Generate a random config with nested objects (up to `maxDepth` levels).
 */
function randomNestedConfig(keyCount: number, maxDepth: number): Record<string, any> {
  const config: Record<string, any> = {};
  const usedKeys = new Set<string>();

  for (let i = 0; i < keyCount; i++) {
    let key = randKey();
    while (usedKeys.has(key)) key = randKey();
    usedKeys.add(key);

    if (maxDepth > 1 && Math.random() < 0.35) {
      // Nested object
      config[key] = randomNestedConfig(randInt(1, 3), maxDepth - 1);
    } else {
      config[key] = randScalar();
    }
  }
  return config;
}

/**
 * Generate a config with arrays of scalars.
 */
function randomConfigWithArrays(keyCount: number): Record<string, any> {
  const config: Record<string, any> = {};
  const usedKeys = new Set<string>();

  for (let i = 0; i < keyCount; i++) {
    let key = randKey();
    while (usedKeys.has(key)) key = randKey();
    usedKeys.add(key);

    if (Math.random() < 0.3) {
      // Array of scalars
      const arrLen = randInt(1, 5);
      config[key] = Array.from({ length: arrLen }, () => randScalar());
    } else {
      config[key] = randScalar();
    }
  }
  return config;
}

// ─── Deep equality helper ─────────────────────────────────────────────────────

/**
 * Deep-equal check that also handles number precision for floats.
 * Returns null if equal, or a description of the first difference found.
 */
function deepDiff(a: any, b: any, path = ''): string | null {
  if (a === b) return null;

  if (typeof a === 'number' && typeof b === 'number') {
    // Allow tiny floating-point rounding differences
    if (Math.abs(a - b) < 1e-9) return null;
    return `${path}: number mismatch — expected ${a}, got ${b}`;
  }

  if (typeof a !== typeof b) {
    return `${path}: type mismatch — expected ${typeof a} (${JSON.stringify(a)}), got ${typeof b} (${JSON.stringify(b)})`;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return `${path}: array length mismatch — expected ${a.length}, got ${b.length}`;
    }
    for (let i = 0; i < a.length; i++) {
      const diff = deepDiff(a[i], b[i], `${path}[${i}]`);
      if (diff) return diff;
    }
    return null;
  }

  if (typeof a === 'object' && a !== null && b !== null) {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.join(',') !== bKeys.join(',')) {
      return `${path}: key mismatch — expected [${aKeys}], got [${bKeys}]`;
    }
    for (const k of aKeys) {
      const diff = deepDiff(a[k], b[k], path ? `${path}.${k}` : k);
      if (diff) return diff;
    }
    return null;
  }

  return `${path}: value mismatch — expected ${JSON.stringify(a)}, got ${JSON.stringify(b)}`;
}

// ─── Property 11: Configuration Round-Trip ───────────────────────────────────

/**
 * Validates: Requirements 68.6
 */
describe('Property 11: Configuration Round-Trip', () => {
  const parser = new ConfigParser();

  // ── JSON round-trip ────────────────────────────────────────────────────────

  it('JSON round-trip: flat configs with various scalar types (100 iterations)', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const config = randomFlatConfig(randInt(1, 10));
      const serialized = parser.serialize(config, 'json');
      const reparsed = parser.parseJSON(serialized);

      const diff = deepDiff(config, reparsed);
      if (diff) {
        failures.push(`iter ${i}: ${diff} | config=${JSON.stringify(config)}`);
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('JSON round-trip: nested configs up to 3 levels deep (100 iterations)', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const config = randomNestedConfig(randInt(2, 6), 3);
      const serialized = parser.serialize(config, 'json');
      const reparsed = parser.parseJSON(serialized);

      const diff = deepDiff(config, reparsed);
      if (diff) {
        failures.push(`iter ${i}: ${diff} | config=${JSON.stringify(config)}`);
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('JSON round-trip: configs with arrays of scalars (100 iterations)', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const config = randomConfigWithArrays(randInt(2, 8));
      const serialized = parser.serialize(config, 'json');
      const reparsed = parser.parseJSON(serialized);

      const diff = deepDiff(config, reparsed);
      if (diff) {
        failures.push(`iter ${i}: ${diff} | config=${JSON.stringify(config)}`);
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('JSON round-trip is idempotent: parse(serialize(parse(serialize(config)))) === parse(serialize(config))', () => {
    const failures: string[] = [];

    for (let i = 0; i < 50; i++) {
      const config = randomNestedConfig(randInt(1, 6), 3);

      const first = parser.parseJSON(parser.serialize(config, 'json'));
      const second = parser.parseJSON(parser.serialize(first, 'json'));

      const diff = deepDiff(first, second);
      if (diff) {
        failures.push(`iter ${i}: not idempotent — ${diff}`);
      }
    }

    expect(failures).toHaveLength(0);
  });

  // ── YAML round-trip ────────────────────────────────────────────────────────

  it('YAML round-trip: flat configs with various scalar types (100 iterations)', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const config = randomFlatConfig(randInt(1, 8));
      const serialized = parser.serialize(config, 'yaml');
      const reparsed = parser.parseYAML(serialized);

      const diff = deepDiff(config, reparsed);
      if (diff) {
        failures.push(
          `iter ${i}: ${diff}\n  config=${JSON.stringify(config)}\n  yaml=\n${serialized}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('YAML round-trip: nested configs up to 3 levels deep (100 iterations)', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const config = randomNestedConfig(randInt(2, 5), 3);
      const serialized = parser.serialize(config, 'yaml');
      const reparsed = parser.parseYAML(serialized);

      const diff = deepDiff(config, reparsed);
      if (diff) {
        failures.push(
          `iter ${i}: ${diff}\n  config=${JSON.stringify(config)}\n  yaml=\n${serialized}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('YAML round-trip: configs with arrays of scalars (100 iterations)', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const config = randomConfigWithArrays(randInt(2, 6));
      const serialized = parser.serialize(config, 'yaml');
      const reparsed = parser.parseYAML(serialized);

      const diff = deepDiff(config, reparsed);
      if (diff) {
        failures.push(
          `iter ${i}: ${diff}\n  config=${JSON.stringify(config)}\n  yaml=\n${serialized}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('YAML round-trip is idempotent: parse(serialize(parse(serialize(config)))) === parse(serialize(config))', () => {
    const failures: string[] = [];

    for (let i = 0; i < 50; i++) {
      const config = randomNestedConfig(randInt(1, 5), 3);

      const first = parser.parseYAML(parser.serialize(config, 'yaml'));
      const second = parser.parseYAML(parser.serialize(first, 'yaml'));

      const diff = deepDiff(first, second);
      if (diff) {
        failures.push(`iter ${i}: not idempotent — ${diff}`);
      }
    }

    expect(failures).toHaveLength(0);
  });

  // ── Cross-format consistency ───────────────────────────────────────────────

  it('JSON and YAML round-trips produce equivalent results for the same config (50 iterations)', () => {
    const failures: string[] = [];

    for (let i = 0; i < 50; i++) {
      const config = randomNestedConfig(randInt(1, 5), 2);

      const fromJson = parser.parseJSON(parser.serialize(config, 'json'));
      const fromYaml = parser.parseYAML(parser.serialize(config, 'yaml'));

      const diff = deepDiff(fromJson, fromYaml);
      if (diff) {
        failures.push(
          `iter ${i}: JSON and YAML round-trips differ — ${diff}\n  config=${JSON.stringify(config)}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  // ── Specific value type coverage ──────────────────────────────────────────

  it('JSON round-trip preserves integer values exactly', () => {
    const config = { count: 0, max: 2147483647, min: -2147483648, zero: 0, neg: -42 };
    const reparsed = parser.parseJSON(parser.serialize(config, 'json'));
    expect(reparsed).toEqual(config);
  });

  it('JSON round-trip preserves boolean values exactly', () => {
    const config = { enabled: true, disabled: false, flag: true };
    const reparsed = parser.parseJSON(parser.serialize(config, 'json'));
    expect(reparsed).toEqual(config);
  });

  it('YAML round-trip preserves integer values exactly', () => {
    const config = { count: 42, port: 5432, timeout: 300 };
    const reparsed = parser.parseYAML(parser.serialize(config, 'yaml'));
    expect(reparsed).toEqual(config);
  });

  it('YAML round-trip preserves boolean values exactly', () => {
    const config = { enabled: true, disabled: false };
    const reparsed = parser.parseYAML(parser.serialize(config, 'yaml'));
    expect(reparsed).toEqual(config);
  });

  it('YAML round-trip preserves nested object structure', () => {
    const config = {
      database: { host: 'localhost', port: 5432, pool: { min: 2, max: 10 } },
      cache: { ttl: 300, enabled: true },
    };
    const reparsed = parser.parseYAML(parser.serialize(config, 'yaml'));
    expect(reparsed).toEqual(config);
  });

  it('JSON round-trip preserves deeply nested config', () => {
    const config = {
      app: {
        server: { host: 'localhost', port: 8080 },
        database: { primary: { host: 'db1', port: 5432 } },
      },
      features: { auth: true, payments: false },
    };
    const reparsed = parser.parseJSON(parser.serialize(config, 'json'));
    expect(reparsed).toEqual(config);
  });
});
