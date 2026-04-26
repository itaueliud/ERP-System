import { CSVParser } from './csvParser';

jest.mock('../utils/logger', () => {
  const mockLogger = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  };
  return { __esModule: true, default: mockLogger };
});

describe('CSVParser', () => {
  let parser: CSVParser;

  beforeEach(() => {
    parser = new CSVParser();
  });

  // ─── detectDelimiter ────────────────────────────────────────────────────────

  describe('detectDelimiter', () => {
    it('detects comma delimiter', () => {
      expect(parser.detectDelimiter('name,age,city')).toBe(',');
    });

    it('detects semicolon delimiter', () => {
      expect(parser.detectDelimiter('name;age;city')).toBe(';');
    });

    it('detects tab delimiter', () => {
      expect(parser.detectDelimiter('name\tage\tcity')).toBe('\t');
    });

    it('prefers tab over comma when counts are equal', () => {
      expect(parser.detectDelimiter('a\tb,c')).toBe('\t');
    });

    it('ignores delimiters inside quoted fields', () => {
      expect(parser.detectDelimiter('"a,b,c";d;e')).toBe(';');
    });

    it('defaults to comma when no delimiter found', () => {
      expect(parser.detectDelimiter('justonevalue')).toBe(',');
    });
  });

  // ─── detectEncoding ─────────────────────────────────────────────────────────

  describe('detectEncoding', () => {
    it('detects UTF-8 BOM', () => {
      const buf = Buffer.from([0xef, 0xbb, 0xbf, 0x68, 0x65, 0x6c, 0x6c, 0x6f]);
      expect(parser.detectEncoding(buf)).toBe('utf-8');
    });

    it('detects valid UTF-8 without BOM', () => {
      const buf = Buffer.from('hello world', 'utf-8');
      expect(parser.detectEncoding(buf)).toBe('utf-8');
    });

    it('detects UTF-8 multibyte sequences', () => {
      const buf = Buffer.from('héllo', 'utf-8');
      expect(parser.detectEncoding(buf)).toBe('utf-8');
    });

    it('detects ISO-8859-1 for invalid UTF-8 bytes', () => {
      // 0x80 is invalid as a leading UTF-8 byte
      const buf = Buffer.from([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x80]);
      expect(parser.detectEncoding(buf)).toBe('iso-8859-1');
    });

    it('detects ISO-8859-1 for truncated multibyte sequence', () => {
      // 0xc3 starts a 2-byte sequence but nothing follows
      const buf = Buffer.from([0x68, 0xc3]);
      expect(parser.detectEncoding(buf)).toBe('iso-8859-1');
    });
  });

  // ─── parse – basic ──────────────────────────────────────────────────────────

  describe('parse – basic', () => {
    it('parses simple comma-separated CSV with header', () => {
      const csv = 'name,age,city\nAlice,30,NYC\nBob,25,LA';
      const result = parser.parse(csv);
      expect(result.headers).toEqual(['name', 'age', 'city']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({ name: 'Alice', age: '30', city: 'NYC' });
      expect(result.rows[1]).toEqual({ name: 'Bob', age: '25', city: 'LA' });
      expect(result.errors).toHaveLength(0);
      expect(result.totalLines).toBe(3);
    });

    it('parses semicolon-separated CSV', () => {
      const csv = 'name;age\nAlice;30';
      const result = parser.parse(csv, { delimiter: ';' });
      expect(result.headers).toEqual(['name', 'age']);
      expect(result.rows[0]).toEqual({ name: 'Alice', age: '30' });
    });

    it('parses tab-separated CSV', () => {
      const csv = 'name\tage\nAlice\t30';
      const result = parser.parse(csv, { delimiter: '\t' });
      expect(result.headers).toEqual(['name', 'age']);
      expect(result.rows[0]).toEqual({ name: 'Alice', age: '30' });
    });

    it('auto-detects delimiter', () => {
      const csv = 'name;age;city\nAlice;30;NYC';
      const result = parser.parse(csv);
      expect(result.headers).toEqual(['name', 'age', 'city']);
      expect(result.rows[0]).toEqual({ name: 'Alice', age: '30', city: 'NYC' });
    });

    it('handles CRLF line endings', () => {
      const csv = 'name,age\r\nAlice,30\r\nBob,25';
      const result = parser.parse(csv);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({ name: 'Alice', age: '30' });
    });

    it('handles CR-only line endings', () => {
      const csv = 'name,age\rAlice,30';
      const result = parser.parse(csv);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({ name: 'Alice', age: '30' });
    });

    it('returns empty result for empty string', () => {
      const result = parser.parse('');
      expect(result.rows).toHaveLength(0);
      expect(result.headers).toHaveLength(0);
      expect(result.totalLines).toBe(0);
    });

    it('parses without header when hasHeader is false', () => {
      const csv = 'Alice,30,NYC\nBob,25,LA';
      const result = parser.parse(csv, { hasHeader: false });
      expect(result.headers).toEqual(['col0', 'col1', 'col2']);
      expect(result.rows[0]).toEqual({ col0: 'Alice', col1: '30', col2: 'NYC' });
    });
  });

  // ─── parse – quoted fields ───────────────────────────────────────────────────

  describe('parse – quoted fields', () => {
    it('handles quoted fields containing delimiter', () => {
      const csv = 'name,address\nAlice,"123 Main St, Apt 4"';
      const result = parser.parse(csv);
      expect(result.rows[0]).toEqual({ name: 'Alice', address: '123 Main St, Apt 4' });
    });

    it('handles quoted fields containing newlines', () => {
      const csv = 'name,bio\nAlice,"Line one\nLine two"';
      const result = parser.parse(csv);
      expect(result.rows[0].bio).toBe('Line one\nLine two');
    });

    it('handles escaped quotes (doubled quotes)', () => {
      const csv = 'name,quote\nAlice,"She said ""hello"""';
      const result = parser.parse(csv);
      expect(result.rows[0].quote).toBe('She said "hello"');
    });

    it('handles empty quoted fields', () => {
      const csv = 'a,b,c\n"",x,""';
      const result = parser.parse(csv);
      expect(result.rows[0]).toEqual({ a: '', b: 'x', c: '' });
    });

    it('handles quoted field at end of line', () => {
      const csv = 'a,b\n1,"end"';
      const result = parser.parse(csv);
      expect(result.rows[0]).toEqual({ a: '1', b: 'end' });
    });
  });

  // ─── parse – edge cases ──────────────────────────────────────────────────────

  describe('parse – edge cases', () => {
    it('strips UTF-8 BOM from content', () => {
      const csv = '\uFEFFname,age\nAlice,30';
      const result = parser.parse(csv);
      expect(result.headers[0]).toBe('name');
      expect(result.rows[0]).toEqual({ name: 'Alice', age: '30' });
    });

    it('handles empty fields (trailing comma)', () => {
      const csv = 'a,b,c\n1,,3\n4,5,';
      const result = parser.parse(csv);
      expect(result.rows[0]).toEqual({ a: '1', b: '', c: '3' });
      expect(result.rows[1]).toEqual({ a: '4', b: '5', c: '' });
    });

    it('reports error for mismatched column count', () => {
      const csv = 'a,b,c\n1,2\n4,5,6';
      const result = parser.parse(csv);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].line).toBe(2);
      expect(result.errors[0].message).toMatch(/Expected 3 fields but got 2/);
    });

    it('provides line numbers in parse errors', () => {
      const csv = 'a,b\n1,2\nbad\n4,5';
      const result = parser.parse(csv);
      expect(result.errors[0].line).toBe(3);
    });

    it('reports unclosed quoted field error', () => {
      const csv = 'a,b\n"unclosed,value';
      const result = parser.parse(csv);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toMatch(/Unclosed quoted field/);
    });

    it('handles single column CSV', () => {
      const csv = 'name\nAlice\nBob';
      const result = parser.parse(csv);
      expect(result.headers).toEqual(['name']);
      expect(result.rows).toHaveLength(2);
    });

    it('handles single row (header only)', () => {
      const csv = 'name,age,city';
      const result = parser.parse(csv);
      expect(result.headers).toEqual(['name', 'age', 'city']);
      expect(result.rows).toHaveLength(0);
    });

    it('skips blank lines in data', () => {
      const csv = 'a,b\n1,2\n\n3,4';
      const result = parser.parse(csv);
      expect(result.rows).toHaveLength(2);
    });
  });

  // ─── serialize ───────────────────────────────────────────────────────────────

  describe('serialize', () => {
    it('serializes rows to CSV with header', () => {
      const rows = [
        { name: 'Alice', age: '30' },
        { name: 'Bob', age: '25' },
      ];
      const result = parser.serialize(rows, ['name', 'age']);
      expect(result).toBe('name,age\nAlice,30\nBob,25');
    });

    it('serializes with semicolon delimiter', () => {
      const rows = [{ name: 'Alice', age: '30' }];
      const result = parser.serialize(rows, ['name', 'age'], { delimiter: ';' });
      expect(result).toBe('name;age\nAlice;30');
    });

    it('quotes fields containing delimiter', () => {
      const rows = [{ name: 'Alice', address: '123 Main St, Apt 4' }];
      const result = parser.serialize(rows, ['name', 'address']);
      expect(result).toBe('name,address\nAlice,"123 Main St, Apt 4"');
    });

    it('quotes fields containing newlines', () => {
      const rows = [{ name: 'Alice', bio: 'Line one\nLine two' }];
      const result = parser.serialize(rows, ['name', 'bio']);
      expect(result).toContain('"Line one\nLine two"');
    });

    it('escapes double quotes in fields', () => {
      const rows = [{ name: 'Alice', quote: 'She said "hello"' }];
      const result = parser.serialize(rows, ['name', 'quote']);
      expect(result).toContain('"She said ""hello"""');
    });

    it('omits header when includeHeader is false', () => {
      const rows = [{ name: 'Alice', age: '30' }];
      const result = parser.serialize(rows, ['name', 'age'], { includeHeader: false });
      expect(result).toBe('Alice,30');
    });

    it('handles empty rows array', () => {
      const result = parser.serialize([], ['name', 'age']);
      expect(result).toBe('name,age');
    });

    it('handles missing field values as empty string', () => {
      const rows = [{ name: 'Alice' }];
      const result = parser.serialize(rows, ['name', 'age']);
      expect(result).toBe('name,age\nAlice,');
    });
  });

  // ─── round-trip ──────────────────────────────────────────────────────────────

  describe('round-trip', () => {
    it('parse → serialize → parse produces same data', () => {
      const original = 'name,age,city\nAlice,30,"New York, NY"\nBob,25,LA';
      const parsed = parser.parse(original);
      const serialized = parser.serialize(parsed.rows, parsed.headers);
      const reparsed = parser.parse(serialized);
      expect(reparsed.rows).toEqual(parsed.rows);
      expect(reparsed.headers).toEqual(parsed.headers);
    });

    it('round-trips data with embedded newlines', () => {
      const rows = [{ name: 'Alice', bio: 'Line one\nLine two' }];
      const serialized = parser.serialize(rows, ['name', 'bio']);
      const parsed = parser.parse(serialized);
      expect(parsed.rows[0].bio).toBe('Line one\nLine two');
    });
  });
});
