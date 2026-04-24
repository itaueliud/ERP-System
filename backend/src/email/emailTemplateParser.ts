/**
 * Email Template Parser and Renderer
 * Parses email templates with Handlebars-like syntax
 * Supports variables {{variable_name}}, conditionals {{#if}}, and loops {{#each}}
 * Requirements: 67.1-67.10
 */

// Token types for the email template AST
export type TokenType = 'text' | 'variable' | 'if_start' | 'if_end' | 'each_start' | 'each_end';

export interface Token {
  type: TokenType;
  value: string;
}

export interface ParsedTemplate {
  tokens: Token[];
  variables: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  undefinedVars: string[];
}

// HTML characters that must be escaped to prevent XSS
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

/**
 * Escapes HTML special characters in a string to prevent XSS.
 * Requirement 67.6: Escape HTML special characters in variable values
 */
function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"'/]/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

/**
 * EmailTemplateParser
 * Parses email templates into a flat token list and extracts variable names.
 * Requirements: 67.1, 67.2, 67.3, 67.4, 67.8, 67.9, 67.10
 */
export class EmailTemplateParser {
  /**
   * Tokenizes the template string into a flat list of tokens.
   * Requirement 67.1: Parse template into a Template_Object
   * Requirement 67.2: Identify template variables {{variable_name}}
   * Requirement 67.9: Support conditional blocks {{#if}}...{{/if}}
   * Requirement 67.10: Support loops {{#each}}...{{/each}}
   */
  parse(template: string): ParsedTemplate {
    const tokens: Token[] = [];
    const regex = /\{\{([^}]+)\}\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(template)) !== null) {
      // Capture any literal text before this tag
      if (match.index > lastIndex) {
        tokens.push({ type: 'text', value: template.substring(lastIndex, match.index) });
      }

      const inner = match[1].trim();

      if (inner.startsWith('#if ')) {
        tokens.push({ type: 'if_start', value: inner.substring(4).trim() });
      } else if (inner === '/if') {
        tokens.push({ type: 'if_end', value: '' });
      } else if (inner.startsWith('#each ')) {
        tokens.push({ type: 'each_start', value: inner.substring(6).trim() });
      } else if (inner === '/each') {
        tokens.push({ type: 'each_end', value: '' });
      } else {
        tokens.push({ type: 'variable', value: inner });
      }

      lastIndex = regex.lastIndex;
    }

    // Capture any trailing literal text
    if (lastIndex < template.length) {
      tokens.push({ type: 'text', value: template.substring(lastIndex) });
    }

    // Validate block structure (matching open/close tags)
    this._validateBlockStructure(tokens);

    const variables = this._collectVariables(tokens);

    return { tokens, variables };
  }

  /**
   * Returns the unique list of variable names referenced in the template.
   * Requirement 67.2: Identify template variables
   */
  extractVariables(template: string): string[] {
    const { variables } = this.parse(template);
    return variables;
  }

  /**
   * Validates that all variables referenced in the template are in availableVars.
   * Requirement 67.3: Validate all referenced variables are defined
   * Requirement 67.4: Return validation errors for undefined variables
   * Requirement 67.8: Validate template syntax before saving
   */
  validate(template: string, availableVars: string[]): ValidationResult {
    const errors: string[] = [];
    const undefinedVars: string[] = [];

    let tokens: Token[];
    try {
      ({ tokens } = this.parse(template));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown parse error';
      return { valid: false, errors: [msg], undefinedVars: [] };
    }

    const availableSet = new Set(availableVars);

    for (const token of tokens) {
      if (token.type === 'variable' || token.type === 'if_start' || token.type === 'each_start') {
        // For dotted paths like "this.name", check the root segment
        const rootVar = token.value.split('.')[0];
        if (rootVar !== 'this' && !availableSet.has(rootVar) && !undefinedVars.includes(rootVar)) {
          undefinedVars.push(rootVar);
          errors.push(`Undefined variable: "${rootVar}"`);
        }
      }
    }

    const valid = errors.length === 0;
    return { valid, errors, undefinedVars };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private _validateBlockStructure(tokens: Token[]): void {
    const stack: string[] = [];

    for (const token of tokens) {
      if (token.type === 'if_start') {
        stack.push('if');
      } else if (token.type === 'each_start') {
        stack.push('each');
      } else if (token.type === 'if_end') {
        if (stack[stack.length - 1] !== 'if') {
          throw new Error('Unexpected {{/if}} without matching {{#if}}');
        }
        stack.pop();
      } else if (token.type === 'each_end') {
        if (stack[stack.length - 1] !== 'each') {
          throw new Error('Unexpected {{/each}} without matching {{#each}}');
        }
        stack.pop();
      }
    }

    if (stack.length > 0) {
      const unclosed = stack[stack.length - 1];
      throw new Error(`Unclosed block: missing {{/${unclosed}}}`);
    }
  }

  private _collectVariables(tokens: Token[]): string[] {
    const seen = new Set<string>();
    const variables: string[] = [];

    for (const token of tokens) {
      if (token.type === 'variable' || token.type === 'if_start' || token.type === 'each_start') {
        if (token.value && !seen.has(token.value)) {
          seen.add(token.value);
          variables.push(token.value);
        }
      }
    }

    return variables;
  }
}

/**
 * EmailTemplateRenderer
 * Renders parsed templates by substituting variables with actual data.
 * Requirements: 67.5, 67.6
 */
export class EmailTemplateRenderer {
  private readonly parser: EmailTemplateParser;

  constructor() {
    this.parser = new EmailTemplateParser();
  }

  /**
   * Renders the template with the provided data (no HTML escaping).
   * Requirement 67.5: Replace template variables with actual values
   */
  render(template: string, data: Record<string, unknown>): string {
    const { tokens } = this.parser.parse(template);
    return this._renderTokens(tokens, data, false);
  }

  /**
   * Renders the template with HTML escaping applied to all variable values.
   * Requirement 67.6: Escape HTML special characters to prevent XSS
   */
  renderHtml(template: string, data: Record<string, unknown>): string {
    const { tokens } = this.parser.parse(template);
    return this._renderTokens(tokens, data, true);
  }

  /**
   * Renders a plain-text version of the template (strips any HTML tags from output).
   */
  renderText(template: string, data: Record<string, unknown>): string {
    const rendered = this.render(template, data);
    // Strip HTML tags for plain-text output
    return rendered.replace(/<[^>]*>/g, '');
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private _renderTokens(tokens: Token[], data: Record<string, unknown>, escape: boolean): string {
    let output = '';
    let i = 0;

    while (i < tokens.length) {
      const token = tokens[i];

      if (token.type === 'text') {
        output += token.value;
        i++;
      } else if (token.type === 'variable') {
        const val = this._resolve(token.value, data);
        const str = val === null || val === undefined ? '' : String(val);
        output += escape ? escapeHtml(str) : str;
        i++;
      } else if (token.type === 'if_start') {
        // Collect tokens until matching if_end
        const { block, consumed } = this._collectBlock(tokens, i + 1, 'if');
        const condition = this._resolve(token.value, data);
        if (this._isTruthy(condition)) {
          output += this._renderTokens(block, data, escape);
        }
        i += consumed + 2; // skip if_start + block + if_end
      } else if (token.type === 'each_start') {
        const { block, consumed } = this._collectBlock(tokens, i + 1, 'each');
        const collection = this._resolve(token.value, data);
        if (Array.isArray(collection)) {
          for (const item of collection) {
            const itemData = { ...data, this: item };
            output += this._renderTokens(block, itemData, escape);
          }
        }
        i += consumed + 2; // skip each_start + block + each_end
      } else {
        // if_end / each_end encountered at top level — skip (shouldn't happen after validation)
        i++;
      }
    }

    return output;
  }

  /**
   * Collects the tokens belonging to a block (if/each) until the matching end tag.
   * Handles nesting correctly.
   */
  private _collectBlock(
    tokens: Token[],
    startIndex: number,
    blockType: 'if' | 'each',
  ): { block: Token[]; consumed: number } {
    const block: Token[] = [];
    let depth = 0;
    let i = startIndex;
    const startTag = `${blockType}_start` as TokenType;
    const endTag = `${blockType}_end` as TokenType;

    while (i < tokens.length) {
      const token = tokens[i];
      if (token.type === startTag) {
        depth++;
        block.push(token);
      } else if (token.type === endTag) {
        if (depth === 0) {
          break;
        }
        depth--;
        block.push(token);
      } else {
        block.push(token);
      }
      i++;
    }

    return { block, consumed: i - startIndex };
  }

  /**
   * Resolves a dot-notation path against the data object.
   * e.g. "this.name" → data["this"]["name"]
   */
  private _resolve(path: string, data: Record<string, unknown>): unknown {
    const parts = path.split('.');
    let current: unknown = data;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private _isTruthy(value: unknown): boolean {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  }
}

// Singleton exports for convenience
export const emailTemplateParser = new EmailTemplateParser();
export const emailTemplateRenderer = new EmailTemplateRenderer();
