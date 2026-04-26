import logger from '../utils/logger';

export interface ParseOptions {
  delimiter?: ',' | ';' | '\t';
  hasHeader?: boolean;
  encoding?: string;
}

export interface SerializeOptions {
  delimiter?: ',' | ';' | '\t';
  includeHeader?: boolean;
}

export interface ParseError {
  line: number;
  message: string;
  rawLine: string;
}

export interface ParseResult {
  rows: Record<string, any>[];
  headers: string[];
  errors: ParseError[];
  totalLines: number;
}

export class CSVParser {
  /**
   * Detect the delimiter used in the first line of a CSV file.
   */
  detectDelimiter(firstLine: string): ',' | ';' | '\t' {
    const counts = {
      ',': 0,
      ';': 0,
      '\t': 0,
    };

    let inQuotes = false;
    for (const ch of firstLine) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes) {
        if (ch === ',') counts[',']++;
        else if (ch === ';') counts[';']++;
        else if (ch === '\t') counts['\t']++;
      }
    }

    if (counts['\t'] > 0 && counts['\t'] >= counts[','] && counts['\t'] >= counts[';']) return '\t';
    if (counts[';'] > 0 && counts[';'] >= counts[',']) return ';';
    return ',';
  }

  /**
   * Detect the encoding of a buffer by checking for BOM markers and byte patterns.
   */
  detectEncoding(buffer: Buffer): 'utf-8' | 'iso-8859-1' {
    // Check for UTF-8 BOM (EF BB BF)
    if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      return 'utf-8';
    }

    // Heuristic: scan for invalid UTF-8 sequences
    let i = 0;
    while (i < buffer.length) {
      const byte = buffer[i];
      if (byte <= 0x7f) {
        i++;
      } else if ((byte & 0xe0) === 0xc0) {
        // 2-byte sequence
        if (i + 1 >= buffer.length || (buffer[i + 1] & 0xc0) !== 0x80) {
          return 'iso-8859-1';
        }
        i += 2;
      } else if ((byte & 0xf0) === 0xe0) {
        // 3-byte sequence
        if (
          i + 2 >= buffer.length ||
          (buffer[i + 1] & 0xc0) !== 0x80 ||
          (buffer[i + 2] & 0xc0) !== 0x80
        ) {
          return 'iso-8859-1';
        }
        i += 3;
      } else if ((byte & 0xf8) === 0xf0) {
        // 4-byte sequence
        if (
          i + 3 >= buffer.length ||
          (buffer[i + 1] & 0xc0) !== 0x80 ||
          (buffer[i + 2] & 0xc0) !== 0x80 ||
          (buffer[i + 3] & 0xc0) !== 0x80
        ) {
          return 'iso-8859-1';
        }
        i += 4;
      } else {
        return 'iso-8859-1';
      }
    }

    return 'utf-8';
  }

  /**
   * Parse a CSV string into structured rows.
   */
  parse(content: string, options: ParseOptions = {}): ParseResult {
    const errors: ParseError[] = [];
    const rows: Record<string, any>[] = [];

    // Strip UTF-8 BOM if present
    let text = content;
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }

    // Normalize line endings
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Remove trailing newline to avoid phantom empty line
    if (text.endsWith('\n')) {
      text = text.slice(0, -1);
    }

    if (text.length === 0) {
      return { rows: [], headers: [], errors: [], totalLines: 0 };
    }

    // Detect delimiter from first line if not provided
    const firstNewline = text.indexOf('\n');
    const firstLine = firstNewline === -1 ? text : text.slice(0, firstNewline);
    const delimiter = options.delimiter ?? this.detectDelimiter(firstLine);
    const hasHeader = options.hasHeader !== false; // default true

    // Tokenize all fields with their line numbers
    const { records, lineNumbers } = this._tokenize(text, delimiter, errors);

    const totalLines = records.length;

    if (totalLines === 0) {
      return { rows: [], headers: [], errors, totalLines: 0 };
    }

    let headers: string[] = [];
    let dataStartIndex = 0;

    if (hasHeader) {
      headers = records[0].map((h) => h.trim());
      dataStartIndex = 1;
    } else {
      // Generate column names col0, col1, ...
      const colCount = Math.max(...records.map((r) => r.length));
      headers = Array.from({ length: colCount }, (_, i) => `col${i}`);
    }

    for (let i = dataStartIndex; i < records.length; i++) {
      const record = records[i];
      const lineNum = lineNumbers[i];

      if (record.length === 1 && record[0] === '') {
        // Skip completely empty lines
        continue;
      }

      if (record.length !== headers.length) {
        errors.push({
          line: lineNum,
          message: `Expected ${headers.length} fields but got ${record.length}`,
          rawLine: record.join(delimiter),
        });
        logger.warn('CSV parse warning', {
          line: lineNum,
          expected: headers.length,
          got: record.length,
        });
      }

      const row: Record<string, any> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = record[j] ?? '';
      }
      rows.push(row);
    }

    logger.debug('CSV parsed', { totalLines, rowCount: rows.length, errorCount: errors.length });

    return { rows, headers, errors, totalLines };
  }

  /**
   * Serialize rows to a CSV string.
   */
  serialize(
    rows: Record<string, any>[],
    columns: string[],
    options: SerializeOptions = {}
  ): string {
    const delimiter = options.delimiter ?? ',';
    const includeHeader = options.includeHeader !== false;

    const lines: string[] = [];

    if (includeHeader) {
      lines.push(columns.map((c) => this._quoteField(c, delimiter)).join(delimiter));
    }

    for (const row of rows) {
      const fields = columns.map((col) => {
        const val = row[col] ?? '';
        return this._quoteField(String(val), delimiter);
      });
      lines.push(fields.join(delimiter));
    }

    return lines.join('\n');
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Tokenize CSV text into records (arrays of fields), tracking line numbers.
   * Handles quoted fields with embedded delimiters, newlines, and escaped quotes ("").
   */
  private _tokenize(
    text: string,
    delimiter: string,
    errors: ParseError[]
  ): { records: string[][]; lineNumbers: number[] } {
    const records: string[][] = [];
    const lineNumbers: number[] = [];

    let pos = 0;
    let lineNum = 1;
    let recordStartLine = 1;
    let currentRecord: string[] = [];

    while (pos <= text.length) {
      // End of input
      if (pos === text.length) {
        currentRecord.push('');
        records.push(currentRecord);
        lineNumbers.push(recordStartLine);
        currentRecord = [];
        break;
      }

      const ch = text[pos];

      if (ch === '"') {
        // Quoted field
        const { value, endPos, linesConsumed, error } = this._parseQuotedField(
          text,
          pos,
          lineNum
        );
        if (error) {
          errors.push({ line: lineNum, message: error, rawLine: '' });
        }
        lineNum += linesConsumed;
        pos = endPos;
        currentRecord.push(value);

        // After quoted field, expect delimiter or newline or end
        if (pos < text.length && text[pos] === delimiter) {
          pos++;
        } else if (pos < text.length && text[pos] === '\n') {
          records.push(currentRecord);
          lineNumbers.push(recordStartLine);
          currentRecord = [];
          recordStartLine = lineNum + 1;
          lineNum++;
          pos++;
        } else if (pos === text.length) {
          records.push(currentRecord);
          lineNumbers.push(recordStartLine);
          currentRecord = [];
          break;
        }
      } else if (ch === '\n') {
        // End of record
        currentRecord.push('');
        records.push(currentRecord);
        lineNumbers.push(recordStartLine);
        currentRecord = [];
        recordStartLine = lineNum + 1;
        lineNum++;
        pos++;
      } else if (ch === delimiter) {
        // Empty field
        currentRecord.push('');
        pos++;
      } else {
        // Unquoted field
        const { value, endPos } = this._parseUnquotedField(text, pos, delimiter);
        currentRecord.push(value);
        pos = endPos;

        if (pos < text.length && text[pos] === delimiter) {
          pos++;
        } else if (pos < text.length && text[pos] === '\n') {
          records.push(currentRecord);
          lineNumbers.push(recordStartLine);
          currentRecord = [];
          recordStartLine = lineNum + 1;
          lineNum++;
          pos++;
        } else if (pos === text.length) {
          records.push(currentRecord);
          lineNumbers.push(recordStartLine);
          currentRecord = [];
          break;
        }
      }
    }

    // Push any remaining record (shouldn't normally happen but safety net)
    if (currentRecord.length > 0) {
      records.push(currentRecord);
      lineNumbers.push(recordStartLine);
    }

    return { records, lineNumbers };
  }

  private _parseQuotedField(
    text: string,
    start: number,
    lineNum: number
  ): { value: string; endPos: number; linesConsumed: number; error?: string } {
    let pos = start + 1; // skip opening quote
    let value = '';
    let linesConsumed = 0;

    while (pos < text.length) {
      const ch = text[pos];

      if (ch === '"') {
        if (pos + 1 < text.length && text[pos + 1] === '"') {
          // Escaped quote
          value += '"';
          pos += 2;
        } else {
          // Closing quote
          pos++;
          return { value, endPos: pos, linesConsumed };
        }
      } else if (ch === '\n') {
        value += '\n';
        linesConsumed++;
        pos++;
      } else {
        value += ch;
        pos++;
      }
    }

    // Reached end without closing quote
    return {
      value,
      endPos: pos,
      linesConsumed,
      error: `Unclosed quoted field starting at line ${lineNum}`,
    };
  }

  private _parseUnquotedField(
    text: string,
    start: number,
    delimiter: string
  ): { value: string; endPos: number } {
    let pos = start;
    while (pos < text.length && text[pos] !== delimiter && text[pos] !== '\n') {
      pos++;
    }
    return { value: text.slice(start, pos), endPos: pos };
  }

  private _quoteField(value: string, delimiter: string): string {
    const needsQuoting =
      value.includes('"') ||
      value.includes(delimiter) ||
      value.includes('\n') ||
      value.includes('\r');

    if (!needsQuoting) return value;

    return '"' + value.replace(/"/g, '""') + '"';
  }
}

export const csvParser = new CSVParser();
