/**
 * Property-Based Tests: CSV Import/Export Round-Trip
 *
 * Property 9: CSV Import/Export Round-Trip
 * Validates: Requirements 66.8
 *
 * FOR ALL valid data sets, exporting to CSV then importing SHALL produce
 * equivalent data with all records and fields preserved.
 *
 * Uses Math.random-based generation (consistent with existing property tests).
 */

import { CSVParser } from './csvParser';

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

// ─── Generators ──────────────────────────────────────────────────────────────

type Delimiter = ',' | ';' | '\t';

const DELIMITERS: Delimiter[] = [',', ';', '\t'];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Safe printable ASCII characters that don't need special CSV handling */
const SAFE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';

/** Safe chars including space (for field values only, not headers) */
const SAFE_CHARS_WITH_SPACE = SAFE_CHARS + ' ';

/** Unicode characters for testing */
const UNICODE_SAMPLES = ['café', 'naïve', 'résumé', 'Ünïcödé', '日本語', 'العربية', 'Ελληνικά'];

function randSafeString(maxLen = 12): string {
  const len = randInt(1, maxLen);
  let s = '';
  for (let i = 0; i < len; i++) {
    s += SAFE_CHARS_WITH_SPACE[Math.floor(Math.random() * SAFE_CHARS_WITH_SPACE.length)];
  }
  // Trim to avoid leading/trailing spaces that the parser would strip from headers
  return s.trim() || 'x';
}

function randStringWithSpecials(maxLen = 20): string {
  const len = randInt(1, maxLen);
  const allChars = SAFE_CHARS + ',";\t\n"';
  let s = '';
  for (let i = 0; i < len; i++) {
    s += allChars[Math.floor(Math.random() * allChars.length)];
  }
  return s;
}

function randFieldValue(kind: 'string' | 'number' | 'date' | 'null' | 'special' | 'unicode'): string {
  switch (kind) {
    case 'string':
      return randSafeString();
    case 'number':
      // integers and decimals
      return Math.random() < 0.5
        ? String(randInt(-9999, 9999))
        : (Math.random() * 10000 - 5000).toFixed(2);
    case 'date':
      // ISO date strings
      return new Date(Date.now() - randInt(0, 365 * 24 * 3600 * 1000)).toISOString().slice(0, 10);
    case 'null':
      return '';
    case 'special':
      return randStringWithSpecials(15);
    case 'unicode':
      return randChoice(UNICODE_SAMPLES);
  }
}

const FIELD_KINDS = ['string', 'number', 'date', 'null', 'special', 'unicode'] as const;

/** Generate a random set of column headers (no spaces — parser trims headers) */
function randomHeaders(count: number): string[] {
  const headers: string[] = [];
  for (let i = 0; i < count; i++) {
    // Use only alphanumeric + underscore/dash for headers to avoid trim issues
    const suffix = Array.from({ length: randInt(2, 5) }, () =>
      SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)],
    ).join('');
    headers.push(`field_${i}_${suffix}`);
  }
  return headers;
}

/** Generate a random dataset */
function randomDataset(
  rowCount: number,
  headers: string[],
): Record<string, string>[] {
  return Array.from({ length: rowCount }, () => {
    const row: Record<string, string> = {};
    let allEmpty = true;
    for (const h of headers) {
      // Avoid 'null' (empty) kind for single-column datasets to prevent blank-line ambiguity
      const availableKinds = headers.length === 1
        ? FIELD_KINDS.filter(k => k !== 'null')
        : [...FIELD_KINDS];
      const kind = randChoice(availableKinds);
      const val = randFieldValue(kind);
      row[h] = val;
      if (val !== '') allEmpty = false;
    }
    // If all fields ended up empty (possible with 'null' kind), set first field to a safe value
    if (allEmpty) {
      row[headers[0]] = 'nonempty';
    }
    return row;
  });
}

// ─── Round-trip helper ───────────────────────────────────────────────────────

function roundTrip(
  parser: CSVParser,
  rows: Record<string, string>[],
  headers: string[],
  delimiter: Delimiter,
): { headers: string[]; rows: Record<string, string>[] } {
  const csv = parser.serialize(rows, headers, { delimiter });
  const result = parser.parse(csv, { delimiter });
  return { headers: result.headers, rows: result.rows as Record<string, string>[] };
}

// ─── Property 9: CSV Import/Export Round-Trip ─────────────────────────────────

/**
 * Validates: Requirements 66.8
 */
describe('Property 9: CSV Import/Export Round-Trip', () => {
  const parser = new CSVParser();

  it('round-trip preserves all records for 100 random datasets with comma delimiter', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const colCount = randInt(1, 8);
      const rowCount = randInt(0, 20);
      const headers = randomHeaders(colCount);
      const rows = randomDataset(rowCount, headers);

      const result = roundTrip(parser, rows, headers, ',');

      if (result.headers.join(',') !== headers.join(',')) {
        failures.push(`iter ${i}: headers mismatch — expected [${headers}], got [${result.headers}]`);
        continue;
      }

      if (result.rows.length !== rows.length) {
        failures.push(`iter ${i}: row count mismatch — expected ${rows.length}, got ${result.rows.length}`);
        continue;
      }

      for (let r = 0; r < rows.length; r++) {
        for (const h of headers) {
          if (result.rows[r][h] !== rows[r][h]) {
            failures.push(
              `iter ${i}, row ${r}, field "${h}": expected ${JSON.stringify(rows[r][h])}, got ${JSON.stringify(result.rows[r][h])}`,
            );
          }
        }
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('round-trip preserves all records for 100 random datasets with semicolon delimiter', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const colCount = randInt(1, 8);
      const rowCount = randInt(0, 20);
      const headers = randomHeaders(colCount);
      const rows = randomDataset(rowCount, headers);

      const result = roundTrip(parser, rows, headers, ';');

      if (result.headers.join(';') !== headers.join(';')) {
        failures.push(`iter ${i}: headers mismatch`);
        continue;
      }

      if (result.rows.length !== rows.length) {
        failures.push(`iter ${i}: row count mismatch — expected ${rows.length}, got ${result.rows.length}`);
        continue;
      }

      for (let r = 0; r < rows.length; r++) {
        for (const h of headers) {
          if (result.rows[r][h] !== rows[r][h]) {
            failures.push(
              `iter ${i}, row ${r}, field "${h}": expected ${JSON.stringify(rows[r][h])}, got ${JSON.stringify(result.rows[r][h])}`,
            );
          }
        }
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('round-trip preserves all records for 100 random datasets with tab delimiter', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const colCount = randInt(1, 8);
      const rowCount = randInt(0, 20);
      const headers = randomHeaders(colCount);
      const rows = randomDataset(rowCount, headers);

      const result = roundTrip(parser, rows, headers, '\t');

      if (result.headers.join('\t') !== headers.join('\t')) {
        failures.push(`iter ${i}: headers mismatch`);
        continue;
      }

      if (result.rows.length !== rows.length) {
        failures.push(`iter ${i}: row count mismatch — expected ${rows.length}, got ${result.rows.length}`);
        continue;
      }

      for (let r = 0; r < rows.length; r++) {
        for (const h of headers) {
          if (result.rows[r][h] !== rows[r][h]) {
            failures.push(
              `iter ${i}, row ${r}, field "${h}": expected ${JSON.stringify(rows[r][h])}, got ${JSON.stringify(result.rows[r][h])}`,
            );
          }
        }
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('round-trip preserves records with special characters across all delimiters', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const delimiter = randChoice(DELIMITERS);
      const headers = ['name', 'description', 'value'];

      // Build rows with special characters relevant to the chosen delimiter
      const rows: Record<string, string>[] = [
        { name: 'Alice "The Great"', description: 'Has, commas; and\ttabs', value: '42.00' },
        { name: 'Line\nBreak', description: 'Multi\nline\nfield', value: '-1.5' },
        { name: '', description: 'empty name', value: '0' },
        { name: randChoice(UNICODE_SAMPLES), description: randSafeString(), value: String(randInt(0, 999)) },
      ];

      const result = roundTrip(parser, rows, headers, delimiter);

      if (result.rows.length !== rows.length) {
        failures.push(
          `iter ${i} (delimiter=${JSON.stringify(delimiter)}): row count mismatch — expected ${rows.length}, got ${result.rows.length}`,
        );
        continue;
      }

      for (let r = 0; r < rows.length; r++) {
        for (const h of headers) {
          if (result.rows[r][h] !== rows[r][h]) {
            failures.push(
              `iter ${i} (delimiter=${JSON.stringify(delimiter)}), row ${r}, field "${h}": ` +
                `expected ${JSON.stringify(rows[r][h])}, got ${JSON.stringify(result.rows[r][h])}`,
            );
          }
        }
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('round-trip is idempotent: parse(serialize(parse(serialize(data)))) === parse(serialize(data))', () => {
    const failures: string[] = [];

    for (let i = 0; i < 50; i++) {
      const delimiter = randChoice(DELIMITERS);
      const colCount = randInt(1, 5);
      const rowCount = randInt(1, 10);
      const headers = randomHeaders(colCount);
      const rows = randomDataset(rowCount, headers);

      // First round-trip
      const first = roundTrip(parser, rows, headers, delimiter);
      // Second round-trip (on the result of the first)
      const second = roundTrip(parser, first.rows, first.headers, delimiter);

      if (JSON.stringify(first.rows) !== JSON.stringify(second.rows)) {
        failures.push(
          `iter ${i}: second round-trip differs from first (not idempotent)`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('empty dataset round-trips to empty dataset', () => {
    for (const delimiter of DELIMITERS) {
      const headers = ['col_a', 'col_b', 'col_c'];
      const result = roundTrip(parser, [], headers, delimiter);
      expect(result.headers).toEqual(headers);
      expect(result.rows).toHaveLength(0);
    }
  });

  it('single-row dataset round-trips correctly for all delimiters', () => {
    const failures: string[] = [];

    for (let i = 0; i < 50; i++) {
      const delimiter = randChoice(DELIMITERS);
      const headers = randomHeaders(randInt(1, 6));
      const rows = randomDataset(1, headers);

      const result = roundTrip(parser, rows, headers, delimiter);

      if (result.rows.length !== 1) {
        failures.push(`iter ${i}: expected 1 row, got ${result.rows.length}`);
        continue;
      }

      for (const h of headers) {
        if (result.rows[0][h] !== rows[0][h]) {
          failures.push(
            `iter ${i}, field "${h}": expected ${JSON.stringify(rows[0][h])}, got ${JSON.stringify(result.rows[0][h])}`,
          );
        }
      }
    }

    expect(failures).toHaveLength(0);
  });
});
