import logger from '../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  default?: any;
  nested?: ConfigSchema;
}

export type ConfigSchema = Record<string, SchemaField>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── ConfigParser ─────────────────────────────────────────────────────────────

export class ConfigParser {
  /**
   * Parse a JSON configuration string.
   */
  parseJSON(content: string): Record<string, any> {
    try {
      const result = JSON.parse(content);
      if (typeof result !== 'object' || result === null || Array.isArray(result)) {
        throw new Error('JSON config must be an object');
      }
      logger.debug('ConfigParser: parsed JSON config');
      return result;
    } catch (err: any) {
      logger.error('ConfigParser: failed to parse JSON', { error: err.message });
      throw new Error(`Invalid JSON configuration: ${err.message}`);
    }
  }

  /**
   * Parse a YAML configuration string.
   * Supports:
   *   - key: value pairs
   *   - nested objects (indentation-based)
   *   - arrays (- item syntax)
   *   - quoted strings (single and double)
   *   - numbers and booleans
   */
  parseYAML(content: string): Record<string, any> {
    try {
      const result = this._parseYAML(content);
      if (typeof result !== 'object' || result === null || Array.isArray(result)) {
        throw new Error('YAML config must be an object');
      }
      // If the result is an empty object but the content has array items at root level, throw
      if (
        Object.keys(result).length === 0 &&
        content.trim().split('\n').some((l) => l.trimStart().startsWith('- '))
      ) {
        throw new Error('YAML config must be an object, not an array');
      }
      logger.debug('ConfigParser: parsed YAML config');
      return result as Record<string, any>;
    } catch (err: any) {
      logger.error('ConfigParser: failed to parse YAML', { error: err.message });
      throw new Error(`Invalid YAML configuration: ${err.message}`);
    }
  }

  /**
   * Serialize a config object to JSON or YAML format.
   */
  serialize(config: Record<string, any>, format: 'json' | 'yaml'): string {
    if (format === 'json') {
      return JSON.stringify(config, null, 2);
    }
    return this._serializeYAML(config, 0);
  }

  /**
   * Validate a config object against a schema.
   */
  validate(config: Record<string, any>, schema: ConfigSchema): ValidationResult {
    const errors: string[] = [];
    this._validateObject(config, schema, '', errors);
    const valid = errors.length === 0;
    if (!valid) {
      logger.debug('ConfigParser: validation failed', { errors });
    }
    return { valid, errors };
  }

  /**
   * Apply default values from schema to config (non-destructive — only fills missing fields).
   */
  applyDefaults(config: Record<string, any>, schema: ConfigSchema): Record<string, any> {
    const result: Record<string, any> = { ...config };

    for (const [key, field] of Object.entries(schema)) {
      if (result[key] === undefined && field.default !== undefined) {
        result[key] = field.default;
      }

      if (field.type === 'object' && field.nested) {
        const nested = typeof result[key] === 'object' && result[key] !== null ? result[key] : {};
        result[key] = this.applyDefaults(nested, field.nested);
      }
    }

    return result;
  }

  // ─── Private: YAML parser ──────────────────────────────────────────────────

  private _parseYAML(content: string): any {
    // Normalize line endings and strip trailing whitespace per line
    const lines = content
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n');

    const { value } = this._parseYAMLLines(lines, 0, 0);
    return value;
  }

  /**
   * Parse YAML lines starting at `lineIndex` with expected `baseIndent`.
   * Returns the parsed value and the next line index to process.
   */
  private _parseYAMLLines(
    lines: string[],
    lineIndex: number,
    baseIndent: number
  ): { value: any; nextLine: number } {
    const obj: Record<string, any> = {};
    let i = lineIndex;

    while (i < lines.length) {
      const raw = lines[i];
      const trimmed = raw.trimEnd();

      // Skip blank lines and comments
      if (trimmed.trim() === '' || trimmed.trim().startsWith('#')) {
        i++;
        continue;
      }

      const indent = this._getIndent(trimmed);

      // If we've dedented past our base, stop
      if (indent < baseIndent) {
        break;
      }

      // Array item at this level
      if (trimmed.trimStart().startsWith('- ') || trimmed.trimStart() === '-') {
        // Caller should handle arrays; if we hit one unexpectedly, break
        break;
      }

      // Key: value pair
      const colonIdx = this._findKeyColon(trimmed.trimStart());
      if (colonIdx === -1) {
        i++;
        continue;
      }

      const keyPart = trimmed.trimStart().slice(0, colonIdx).trim();
      const valuePart = trimmed.trimStart().slice(colonIdx + 1).trim();

      if (valuePart === '' || valuePart === '|' || valuePart === '>') {
        // Value is on next lines (nested object or block scalar)
        // Look ahead to determine if it's an object or array
        const nextContentLine = this._nextNonEmpty(lines, i + 1);
        if (nextContentLine !== -1) {
          const nextTrimmed = lines[nextContentLine].trimEnd();
          const nextIndent = this._getIndent(nextTrimmed);

          if (nextIndent > indent && nextTrimmed.trimStart().startsWith('- ')) {
            // Array
            const { value: arr, nextLine } = this._parseYAMLArray(lines, nextContentLine, nextIndent);
            obj[keyPart] = arr;
            i = nextLine;
          } else if (nextIndent > indent) {
            // Nested object
            const { value: nested, nextLine } = this._parseYAMLLines(lines, nextContentLine, nextIndent);
            obj[keyPart] = nested;
            i = nextLine;
          } else {
            obj[keyPart] = null;
            i++;
          }
        } else {
          obj[keyPart] = null;
          i++;
        }
      } else {
        obj[keyPart] = this._parseScalar(valuePart);
        i++;
      }
    }

    return { value: obj, nextLine: i };
  }

  private _parseYAMLArray(
    lines: string[],
    lineIndex: number,
    baseIndent: number
  ): { value: any[]; nextLine: number } {
    const arr: any[] = [];
    let i = lineIndex;

    while (i < lines.length) {
      const raw = lines[i];
      const trimmed = raw.trimEnd();

      if (trimmed.trim() === '' || trimmed.trim().startsWith('#')) {
        i++;
        continue;
      }

      const indent = this._getIndent(trimmed);
      if (indent < baseIndent) break;

      const content = trimmed.trimStart();
      if (!content.startsWith('- ') && content !== '-') break;

      const itemContent = content.startsWith('- ') ? content.slice(2).trim() : '';

      if (itemContent === '') {
        // Multi-line item (object)
        const nextContentLine = this._nextNonEmpty(lines, i + 1);
        if (nextContentLine !== -1) {
          const nextIndent = this._getIndent(lines[nextContentLine].trimEnd());
          if (nextIndent > indent) {
            const { value: nested, nextLine } = this._parseYAMLLines(lines, nextContentLine, nextIndent);
            arr.push(nested);
            i = nextLine;
          } else {
            arr.push(null);
            i++;
          }
        } else {
          arr.push(null);
          i++;
        }
      } else {
        // Check if item is an inline object (key: value on same line)
        const colonIdx = this._findKeyColon(itemContent);
        if (colonIdx !== -1) {
          // Inline key: value — parse as single-entry object, then check for more keys below
          const key = itemContent.slice(0, colonIdx).trim();
          const val = itemContent.slice(colonIdx + 1).trim();
          const itemObj: Record<string, any> = {};
          itemObj[key] = val !== '' ? this._parseScalar(val) : null;

          // Check if next lines at deeper indent add more keys to this object
          const nextContentLine = this._nextNonEmpty(lines, i + 1);
          if (nextContentLine !== -1) {
            const nextIndent = this._getIndent(lines[nextContentLine].trimEnd());
            if (nextIndent > indent && !lines[nextContentLine].trimStart().startsWith('- ')) {
              const { value: nested, nextLine } = this._parseYAMLLines(lines, nextContentLine, nextIndent);
              Object.assign(itemObj, nested);
              arr.push(itemObj);
              i = nextLine;
              continue;
            }
          }
          arr.push(itemObj);
        } else {
          arr.push(this._parseScalar(itemContent));
        }
        i++;
      }
    }

    return { value: arr, nextLine: i };
  }

  /** Find the colon that separates a YAML key from its value (not inside quotes). */
  private _findKeyColon(s: string): number {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
      else if (ch === ':' && !inSingle && !inDouble) {
        // Must be followed by space, end of string, or newline to be a key separator
        if (i + 1 >= s.length || s[i + 1] === ' ' || s[i + 1] === '\t') {
          return i;
        }
      }
    }
    return -1;
  }

  private _getIndent(line: string): number {
    let count = 0;
    for (const ch of line) {
      if (ch === ' ') count++;
      else if (ch === '\t') count += 2;
      else break;
    }
    return count;
  }

  private _nextNonEmpty(lines: string[], from: number): number {
    for (let i = from; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t !== '' && !t.startsWith('#')) return i;
    }
    return -1;
  }

  private _parseScalar(value: string): any {
    // Null
    if (value === 'null' || value === '~') return null;

    // Boolean
    if (value === 'true' || value === 'yes' || value === 'on') return true;
    if (value === 'false' || value === 'no' || value === 'off') return false;

    // Double-quoted string
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      return value
        .slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }

    // Single-quoted string
    if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      return value.slice(1, -1).replace(/''/g, "'");
    }

    // Integer
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);

    // Float
    if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);

    // Plain string
    return value;
  }

  // ─── Private: YAML serializer ─────────────────────────────────────────────

  private _serializeYAML(value: any, indent: number): string {
    const pad = ' '.repeat(indent);

    if (value === null || value === undefined) {
      return 'null';
    }

    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);

    if (typeof value === 'string') {
      // Quote strings that could be misinterpreted
      if (
        value === '' ||
        /^(true|false|yes|no|on|off|null|~)$/i.test(value) ||
        /^-?\d+(\.\d+)?$/.test(value) ||
        value.includes(':') ||
        value.includes('#') ||
        value.includes('\n') ||
        value.startsWith(' ') ||
        value.endsWith(' ')
      ) {
        return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
      }
      return value;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      const lines: string[] = [];
      for (const item of value) {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          const entries = Object.entries(item);
          if (entries.length === 0) {
            lines.push(`${pad}- {}`);
          } else {
            const [firstKey, firstVal] = entries[0];
            const firstLine = `${pad}- ${firstKey}: ${this._serializeYAML(firstVal, indent + 2)}`;
            lines.push(firstLine);
            for (let i = 1; i < entries.length; i++) {
              const [k, v] = entries[i];
              lines.push(`${pad}  ${k}: ${this._serializeYAML(v, indent + 2)}`);
            }
          }
        } else {
          lines.push(`${pad}- ${this._serializeYAML(item, indent + 2)}`);
        }
      }
      return lines.join('\n');
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) return '{}';
      const lines: string[] = [];
      for (const [k, v] of entries) {
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          lines.push(`${pad}${k}:`);
          lines.push(this._serializeYAML(v, indent + 2));
        } else if (Array.isArray(v)) {
          lines.push(`${pad}${k}:`);
          lines.push(this._serializeYAML(v, indent + 2));
        } else {
          lines.push(`${pad}${k}: ${this._serializeYAML(v, indent)}`);
        }
      }
      return lines.join('\n');
    }

    return String(value);
  }

  // ─── Private: validation ──────────────────────────────────────────────────

  private _validateObject(
    config: Record<string, any>,
    schema: ConfigSchema,
    path: string,
    errors: string[]
  ): void {
    for (const [key, field] of Object.entries(schema)) {
      const fullPath = path ? `${path}.${key}` : key;
      const value = config[key];

      if (value === undefined || value === null) {
        if (field.required) {
          errors.push(`Missing required field: ${fullPath}`);
        }
        continue;
      }

      // Type check
      if (!this._checkType(value, field.type)) {
        errors.push(
          `Field "${fullPath}" must be of type ${field.type}, got ${this._typeOf(value)}`
        );
        continue;
      }

      // Recurse into nested objects
      if (field.type === 'object' && field.nested) {
        this._validateObject(value, field.nested, fullPath, errors);
      }
    }
  }

  private _checkType(value: any, type: SchemaField['type']): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
    }
  }

  private _typeOf(value: any): string {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    return typeof value;
  }
}

export const configParser = new ConfigParser();
