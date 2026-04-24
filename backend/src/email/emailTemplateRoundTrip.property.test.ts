/**
 * Property-Based Tests: Email Template Round-Trip
 *
 * Property 10: Email Template Round-Trip
 * Validates: Requirements 67.1-67.10
 *
 * FOR ALL valid email templates, parsing then rendering with test data then
 * parsing again SHALL preserve the template structure (token types and values).
 *
 * Uses Math.random-based generation (no fast-check).
 */

import { EmailTemplateParser, EmailTemplateRenderer } from './emailTemplateParser';

// ─── Generators ──────────────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Safe identifier characters for variable names */
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz_';
const ID_CHARS_FULL = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';

/** Generate a valid template variable name */
function randVarName(maxLen = 10): string {
  const len = randInt(1, maxLen);
  let name = ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  for (let i = 1; i < len; i++) {
    name += ID_CHARS_FULL[Math.floor(Math.random() * ID_CHARS_FULL.length)];
  }
  return name;
}

/** Safe text characters that won't be mistaken for template syntax */
const TEXT_CHARS = 'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?:;-_\n';

/** Generate safe literal text (no {{ or }}) */
function randText(maxLen = 30): string {
  const len = randInt(0, maxLen);
  let s = '';
  for (let i = 0; i < len; i++) {
    s += TEXT_CHARS[Math.floor(Math.random() * TEXT_CHARS.length)];
  }
  return s;
}

/** Generate a safe scalar value for a variable (no HTML special chars to keep round-trip clean) */
const SAFE_VALUE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,_-';

function randSafeValue(maxLen = 20): string {
  const len = randInt(1, maxLen);
  let s = '';
  for (let i = 0; i < len; i++) {
    s += SAFE_VALUE_CHARS[Math.floor(Math.random() * SAFE_VALUE_CHARS.length)];
  }
  return s.trim() || 'value';
}

/** Generate a value that contains HTML special characters (for XSS testing) */
const HTML_SPECIAL_CHARS = ['<', '>', '&', '"', "'", '/'];

function randHtmlValue(): string {
  const base = randSafeValue(10);
  const special = randChoice(HTML_SPECIAL_CHARS);
  const pos = randInt(0, base.length);
  return base.slice(0, pos) + special + base.slice(pos);
}

// ─── Template AST node types for generation ──────────────────────────────────

type TemplateNode =
  | { kind: 'text'; value: string }
  | { kind: 'variable'; name: string }
  | { kind: 'if'; condition: string; body: TemplateNode[] }
  | { kind: 'each'; collection: string; body: TemplateNode[] };

/**
 * Generate a random template AST with bounded depth to avoid infinite recursion.
 * Variables are drawn from the provided pool.
 */
function randTemplateNodes(
  varPool: string[],
  depth: number,
  maxNodes: number,
): TemplateNode[] {
  const nodes: TemplateNode[] = [];
  const count = randInt(1, Math.min(maxNodes, 4));

  for (let i = 0; i < count; i++) {
    const roll = Math.random();

    if (roll < 0.35) {
      // text node
      nodes.push({ kind: 'text', value: randText(20) });
    } else if (roll < 0.60) {
      // variable node
      const name = randChoice(varPool);
      nodes.push({ kind: 'variable', name });
    } else if (roll < 0.80 && depth > 0 && varPool.length > 0) {
      // if block
      const condition = randChoice(varPool);
      const body = randTemplateNodes(varPool, depth - 1, 3);
      nodes.push({ kind: 'if', condition, body });
    } else if (depth > 0 && varPool.length > 0) {
      // each block
      const collection = randChoice(varPool);
      const body = randTemplateNodes(varPool, depth - 1, 3);
      nodes.push({ kind: 'each', collection, body });
    } else {
      // fallback to text
      nodes.push({ kind: 'text', value: randText(10) });
    }
  }

  return nodes;
}

/** Serialize a template AST back to a template string */
function serializeNodes(nodes: TemplateNode[]): string {
  let s = '';
  for (const node of nodes) {
    switch (node.kind) {
      case 'text':
        s += node.value;
        break;
      case 'variable':
        s += `{{${node.name}}}`;
        break;
      case 'if':
        s += `{{#if ${node.condition}}}${serializeNodes(node.body)}{{/if}}`;
        break;
      case 'each':
        s += `{{#each ${node.collection}}}${serializeNodes(node.body)}{{/each}}`;
        break;
    }
  }
  return s;
}



/**
 * Build a data object that satisfies the template's variable requirements.
 * - if-condition variables get boolean true (so the block renders)
 * - each-collection variables get a small array of objects with 'this' properties
 * - plain variables get safe string values
 */
function buildTestData(nodes: TemplateNode[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  function visit(nodeList: TemplateNode[]): void {
    for (const node of nodeList) {
      if (node.kind === 'variable') {
        if (!(node.name in data)) {
          data[node.name] = randSafeValue();
        }
      } else if (node.kind === 'if') {
        if (!(node.condition in data)) {
          data[node.condition] = true;
        }
        visit(node.body);
      } else if (node.kind === 'each') {
        if (!(node.collection in data)) {
          // Provide 1-3 items; each item is a plain string (accessed via {{this}})
          const items = Array.from({ length: randInt(1, 3) }, () => randSafeValue(8));
          data[node.collection] = items;
        }
        visit(node.body);
      }
    }
  }

  visit(nodes);
  return data;
}

// ─── Token comparison helpers ─────────────────────────────────────────────────

// ─── Property 10: Email Template Round-Trip ───────────────────────────────────

/**
 * Validates: Requirements 67.1-67.10
 */
describe('Property 10: Email Template Round-Trip', () => {
  const parser = new EmailTemplateParser();
  const renderer = new EmailTemplateRenderer();

  // ── Sub-property A: plain variable templates ────────────────────────────────

  it('round-trip preserves token structure for templates with only variables (100 iterations)', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      // Build a template with 1-5 variables interspersed with text
      const varCount = randInt(1, 5);
      const varNames = Array.from({ length: varCount }, () => randVarName());
      const nodes = randTemplateNodes(varNames, 0, varCount + 2); // depth=0 → no blocks
      const template = serializeNodes(nodes);

      // Build data where every variable has a safe (non-template-syntax) value
      const data: Record<string, unknown> = {};
      for (const name of varNames) {
        data[name] = randSafeValue();
      }

      let rendered: string;
      let secondParsed: ReturnType<EmailTemplateParser['parse']>;

      try {
        parser.parse(template); // validate template is parseable
        rendered = renderer.render(template, data);
        secondParsed = parser.parse(rendered);
      } catch (err) {
        failures.push(`iter ${i}: unexpected error — ${err}`);
        continue;
      }

      // The rendered output should not contain any template syntax (all vars substituted)
      // so re-parsing should yield only text tokens
      const hasTemplateSyntax = secondParsed.tokens.some(
        (t) => t.type !== 'text',
      );
      if (hasTemplateSyntax) {
        failures.push(
          `iter ${i}: rendered output still contains template tokens after substitution. ` +
            `template="${template}", rendered="${rendered}"`,
        );
      }

      // The text content of the second parse should equal the rendered string
      const reconstructed = secondParsed.tokens.map((t) => t.value).join('');
      if (reconstructed !== rendered) {
        failures.push(
          `iter ${i}: re-parsed text reconstruction differs from rendered output. ` +
            `rendered="${rendered}", reconstructed="${reconstructed}"`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  // ── Sub-property B: conditional block templates ─────────────────────────────

  it('round-trip preserves structure for templates with conditional blocks (100 iterations)', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const varNames = Array.from({ length: randInt(1, 4) }, () => randVarName());
      const nodes = randTemplateNodes(varNames, 1, 5);
      const template = serializeNodes(nodes);
      const data = buildTestData(nodes);

      let rendered: string;
      let secondParsed: ReturnType<EmailTemplateParser['parse']>;

      try {
        parser.parse(template); // validate template is parseable
        rendered = renderer.render(template, data);
        secondParsed = parser.parse(rendered);
      } catch (err) {
        failures.push(`iter ${i}: unexpected error — ${err}`);
        continue;
      }

      // After rendering, no template syntax should remain in the output
      const hasTemplateSyntax = secondParsed.tokens.some((t) => t.type !== 'text');
      if (hasTemplateSyntax) {
        failures.push(
          `iter ${i}: rendered output contains template tokens. ` +
            `template="${template}", rendered="${rendered}"`,
        );
      }

      // Re-parsed text should reconstruct the rendered string exactly
      const reconstructed = secondParsed.tokens.map((t) => t.value).join('');
      if (reconstructed !== rendered) {
        failures.push(
          `iter ${i}: reconstruction mismatch. rendered="${rendered}", reconstructed="${reconstructed}"`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  // ── Sub-property C: loop (each) block templates ─────────────────────────────

  it('round-trip preserves structure for templates with loop blocks (100 iterations)', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const collectionName = randVarName();
      const itemCount = randInt(1, 4);
      const items = Array.from({ length: itemCount }, () => randSafeValue(8));

      // Simple each template: {{#each <collection>}}{{this}} {{/each}}
      const template = `{{#each ${collectionName}}}{{this}} {{/each}}`;
      const data: Record<string, unknown> = { [collectionName]: items };

      let rendered: string;
      let secondParsed: ReturnType<EmailTemplateParser['parse']>;

      try {
        rendered = renderer.render(template, data);
        secondParsed = parser.parse(rendered);
      } catch (err) {
        failures.push(`iter ${i}: unexpected error — ${err}`);
        continue;
      }

      // Rendered output should be plain text (no template syntax)
      const hasTemplateSyntax = secondParsed.tokens.some((t) => t.type !== 'text');
      if (hasTemplateSyntax) {
        failures.push(
          `iter ${i}: rendered loop output contains template tokens. rendered="${rendered}"`,
        );
      }

      // Rendered output should contain each item value
      for (const item of items) {
        if (!rendered.includes(item)) {
          failures.push(
            `iter ${i}: rendered output missing item "${item}". rendered="${rendered}"`,
          );
        }
      }
    }

    expect(failures).toHaveLength(0);
  });

  // ── Sub-property D: XSS escaping consistency ────────────────────────────────

  it('XSS escaping is consistent: renderHtml escapes all HTML special chars (100 iterations)', () => {
    const failures: string[] = [];

    const HTML_ESCAPE_MAP: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };

    for (let i = 0; i < 100; i++) {
      const varName = randVarName();
      const rawValue = randHtmlValue();
      const template = `{{${varName}}}`;
      const data: Record<string, unknown> = { [varName]: rawValue };

      let htmlRendered: string;
      try {
        htmlRendered = renderer.renderHtml(template, data);
      } catch (err) {
        failures.push(`iter ${i}: unexpected error — ${err}`);
        continue;
      }

      // Every HTML special character in rawValue must be escaped in the output
      for (const [char, escaped] of Object.entries(HTML_ESCAPE_MAP)) {
        if (rawValue.includes(char)) {
          // The escaped form must be present
          if (!htmlRendered.includes(escaped)) {
            failures.push(
              `iter ${i}: expected escaped form "${escaped}" not found. ` +
                `rawValue="${rawValue}", htmlRendered="${htmlRendered}"`,
            );
          }
          // The raw char must not appear outside of its escaped form
          // (replace all escaped occurrences, then check no raw char remains)
          const withoutEscaped = htmlRendered.split(escaped).join('');
          if (withoutEscaped.includes(char)) {
            failures.push(
              `iter ${i}: char "${char}" appears unescaped in renderHtml output. ` +
                `rawValue="${rawValue}", htmlRendered="${htmlRendered}"`,
            );
          }
        }
      }

      // render() (non-HTML) must NOT escape the value
      const plainRendered = renderer.render(template, data);
      if (plainRendered !== rawValue) {
        failures.push(
          `iter ${i}: render() should not escape. expected="${rawValue}", got="${plainRendered}"`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  // ── Sub-property E: parse → render → parse token-type invariant ─────────────

  it('parse → render → parse: second parse has only text tokens (no template syntax remains)', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const varNames = Array.from({ length: randInt(1, 4) }, () => randVarName());
      const nodes = randTemplateNodes(varNames, 1, 6);
      const template = serializeNodes(nodes);
      const data = buildTestData(nodes);

      let rendered: string;
      let secondParsed: ReturnType<EmailTemplateParser['parse']>;

      try {
        rendered = renderer.render(template, data);
        secondParsed = parser.parse(rendered);
      } catch (err) {
        failures.push(`iter ${i}: error — ${err}`);
        continue;
      }

      const nonTextTokens = secondParsed.tokens.filter((t) => t.type !== 'text');
      if (nonTextTokens.length > 0) {
        failures.push(
          `iter ${i}: second parse has non-text tokens: ${JSON.stringify(nonTextTokens)}. ` +
            `template="${template}", rendered="${rendered}"`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  // ── Sub-property F: idempotency of rendering ────────────────────────────────

  it('rendering is idempotent: render(render(template, data), {}) === render(template, data)', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const varNames = Array.from({ length: randInt(1, 3) }, () => randVarName());
      const nodes = randTemplateNodes(varNames, 0, 4); // depth=0 → no blocks
      const template = serializeNodes(nodes);
      const data: Record<string, unknown> = {};
      for (const name of varNames) {
        data[name] = randSafeValue();
      }

      let firstRender: string;
      let secondRender: string;

      try {
        firstRender = renderer.render(template, data);
        // Render the already-rendered output with empty data — should be unchanged
        secondRender = renderer.render(firstRender, {});
      } catch (err) {
        failures.push(`iter ${i}: error — ${err}`);
        continue;
      }

      if (firstRender !== secondRender) {
        failures.push(
          `iter ${i}: render not idempotent. ` +
            `first="${firstRender}", second="${secondRender}"`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  // ── Sub-property G: variable extraction consistency ─────────────────────────

  it('extractVariables is consistent with parse().variables across random templates', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const varNames = Array.from({ length: randInt(1, 5) }, () => randVarName());
      const nodes = randTemplateNodes(varNames, 1, 5);
      const template = serializeNodes(nodes);

      let fromParse: string[];
      let fromExtract: string[];

      try {
        fromParse = parser.parse(template).variables;
        fromExtract = parser.extractVariables(template);
      } catch (err) {
        failures.push(`iter ${i}: error — ${err}`);
        continue;
      }

      if (JSON.stringify(fromParse) !== JSON.stringify(fromExtract)) {
        failures.push(
          `iter ${i}: parse().variables !== extractVariables(). ` +
            `parse=${JSON.stringify(fromParse)}, extract=${JSON.stringify(fromExtract)}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  // ── Edge cases ───────────────────────────────────────────────────────────────

  it('empty template round-trips correctly', () => {
    const firstParsed = parser.parse('');
    const rendered = renderer.render('', {});
    const secondParsed = parser.parse(rendered);

    expect(rendered).toBe('');
    expect(secondParsed.tokens).toHaveLength(0);
    expect(secondParsed.variables).toHaveLength(0);
    expect(firstParsed.tokens).toHaveLength(0);
  });

  it('plain text template (no variables) round-trips correctly', () => {
    const template = 'Hello, World! This is a plain text email.';
    const firstParsed = parser.parse(template);
    const rendered = renderer.render(template, {});
    const secondParsed = parser.parse(rendered);

    expect(rendered).toBe(template);
    expect(secondParsed.tokens).toEqual(firstParsed.tokens);
  });

  it('template with all variable types renders and re-parses to plain text', () => {
    const template =
      'Dear {{name}},\n' +
      '{{#if has_items}}Your items:\n{{#each items}}  - {{this}}\n{{/each}}{{/if}}\n' +
      'Total: {{total}}';

    const data = {
      name: 'Alice',
      has_items: true,
      items: ['Widget A', 'Widget B'],
      total: '200',
    };

    const rendered = renderer.render(template, data);
    const secondParsed = parser.parse(rendered);

    // All tokens in second parse should be text
    expect(secondParsed.tokens.every((t) => t.type === 'text')).toBe(true);
    expect(rendered).toContain('Alice');
    expect(rendered).toContain('Widget A');
    expect(rendered).toContain('Widget B');
    expect(rendered).toContain('200');
  });

  it('XSS: renderHtml escapes all 6 HTML special characters consistently', () => {
    const chars = ['&', '<', '>', '"', "'", '/'];
    const expected = ['&amp;', '&lt;', '&gt;', '&quot;', '&#x27;', '&#x2F;'];

    for (let i = 0; i < chars.length; i++) {
      const template = '{{v}}';
      const result = renderer.renderHtml(template, { v: chars[i] });
      expect(result).toBe(expected[i]);
      // Verify the raw char does not appear outside of its escaped form
      const withoutEscaped = result.split(expected[i]).join('');
      expect(withoutEscaped).not.toContain(chars[i]);
    }
  });
});
