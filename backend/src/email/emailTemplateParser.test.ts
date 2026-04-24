/**
 * Tests for EmailTemplateParser and EmailTemplateRenderer
 * Requirements: 67.1-67.10
 */

import { EmailTemplateParser, EmailTemplateRenderer } from './emailTemplateParser';

describe('EmailTemplateParser', () => {
  let parser: EmailTemplateParser;

  beforeEach(() => {
    parser = new EmailTemplateParser();
  });

  // ── parse() ────────────────────────────────────────────────────────────────

  describe('parse()', () => {
    it('tokenizes plain text as a single text token', () => {
      const { tokens } = parser.parse('Hello world');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({ type: 'text', value: 'Hello world' });
    });

    it('tokenizes a single variable', () => {
      const { tokens } = parser.parse('Hello {{name}}!');
      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toEqual({ type: 'text', value: 'Hello ' });
      expect(tokens[1]).toEqual({ type: 'variable', value: 'name' });
      expect(tokens[2]).toEqual({ type: 'text', value: '!' });
    });

    it('trims whitespace inside {{ }}', () => {
      const { tokens } = parser.parse('{{ name }}');
      expect(tokens[0]).toEqual({ type: 'variable', value: 'name' });
    });

    it('tokenizes multiple variables', () => {
      const { tokens } = parser.parse('{{first}} {{last}}');
      expect(tokens.filter((t) => t.type === 'variable')).toHaveLength(2);
    });

    it('tokenizes if_start and if_end', () => {
      const { tokens } = parser.parse('{{#if show}}yes{{/if}}');
      expect(tokens[0]).toEqual({ type: 'if_start', value: 'show' });
      expect(tokens[1]).toEqual({ type: 'text', value: 'yes' });
      expect(tokens[2]).toEqual({ type: 'if_end', value: '' });
    });

    it('tokenizes each_start and each_end', () => {
      const { tokens } = parser.parse('{{#each items}}x{{/each}}');
      expect(tokens[0]).toEqual({ type: 'each_start', value: 'items' });
      expect(tokens[1]).toEqual({ type: 'text', value: 'x' });
      expect(tokens[2]).toEqual({ type: 'each_end', value: '' });
    });

    it('returns variables list from ParsedTemplate', () => {
      const { variables } = parser.parse('{{a}} {{b}} {{a}}');
      // unique variables
      expect(variables).toContain('a');
      expect(variables).toContain('b');
      expect(variables.filter((v) => v === 'a')).toHaveLength(1);
    });

    it('includes if_start and each_start values in variables', () => {
      const { variables } = parser.parse('{{#if flag}}x{{/if}}{{#each list}}y{{/each}}');
      expect(variables).toContain('flag');
      expect(variables).toContain('list');
    });

    it('throws on unmatched {{/if}}', () => {
      expect(() => parser.parse('text{{/if}}')).toThrow(/Unexpected {{\/if}}/);
    });

    it('throws on unmatched {{/each}}', () => {
      expect(() => parser.parse('text{{/each}}')).toThrow(/Unexpected {{\/each}}/);
    });

    it('throws on unclosed {{#if}}', () => {
      expect(() => parser.parse('{{#if cond}}content')).toThrow(/Unclosed block/);
    });

    it('throws on unclosed {{#each}}', () => {
      expect(() => parser.parse('{{#each items}}content')).toThrow(/Unclosed block/);
    });

    it('handles nested if blocks', () => {
      const { tokens } = parser.parse('{{#if a}}{{#if b}}x{{/if}}{{/if}}');
      expect(tokens[0]).toEqual({ type: 'if_start', value: 'a' });
      expect(tokens[1]).toEqual({ type: 'if_start', value: 'b' });
      expect(tokens[tokens.length - 1]).toEqual({ type: 'if_end', value: '' });
    });

    it('handles nested each blocks', () => {
      const { tokens } = parser.parse('{{#each outer}}{{#each inner}}x{{/each}}{{/each}}');
      expect(tokens[0]).toEqual({ type: 'each_start', value: 'outer' });
      expect(tokens[1]).toEqual({ type: 'each_start', value: 'inner' });
    });

    it('handles empty template', () => {
      const { tokens, variables } = parser.parse('');
      expect(tokens).toHaveLength(0);
      expect(variables).toHaveLength(0);
    });

    it('handles multiline templates', () => {
      const tmpl = 'Line1: {{v1}}\nLine2: {{v2}}';
      const { variables } = parser.parse(tmpl);
      expect(variables).toContain('v1');
      expect(variables).toContain('v2');
    });
  });

  // ── extractVariables() ─────────────────────────────────────────────────────

  describe('extractVariables()', () => {
    it('returns unique variable names', () => {
      const vars = parser.extractVariables('{{x}} {{y}} {{x}}');
      expect(vars).toEqual(expect.arrayContaining(['x', 'y']));
      expect(vars.filter((v) => v === 'x')).toHaveLength(1);
    });

    it('includes dotted paths as-is', () => {
      const vars = parser.extractVariables('{{#each items}}{{this.name}}{{/each}}');
      expect(vars).toContain('items');
      expect(vars).toContain('this.name');
    });

    it('returns empty array for plain text', () => {
      expect(parser.extractVariables('no variables here')).toHaveLength(0);
    });
  });

  // ── validate() ─────────────────────────────────────────────────────────────

  describe('validate()', () => {
    it('returns valid when all variables are defined', () => {
      const result = parser.validate('Hello {{name}}!', ['name']);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.undefinedVars).toHaveLength(0);
    });

    it('returns invalid when a variable is missing', () => {
      const result = parser.validate('Hello {{name}} {{missing}}!', ['name']);
      expect(result.valid).toBe(false);
      expect(result.undefinedVars).toContain('missing');
      expect(result.errors.some((e) => e.includes('missing'))).toBe(true);
    });

    it('reports multiple undefined variables', () => {
      const result = parser.validate('{{a}} {{b}} {{c}}', ['a']);
      expect(result.undefinedVars).toContain('b');
      expect(result.undefinedVars).toContain('c');
      expect(result.errors).toHaveLength(2);
    });

    it('does not flag "this" as undefined inside each blocks', () => {
      const result = parser.validate('{{#each items}}{{this.name}}{{/each}}', ['items']);
      expect(result.valid).toBe(true);
    });

    it('validates if condition variable', () => {
      const result = parser.validate('{{#if flag}}yes{{/if}}', []);
      expect(result.valid).toBe(false);
      expect(result.undefinedVars).toContain('flag');
    });

    it('validates each collection variable', () => {
      const result = parser.validate('{{#each list}}x{{/each}}', []);
      expect(result.valid).toBe(false);
      expect(result.undefinedVars).toContain('list');
    });

    it('returns parse error when template has invalid syntax', () => {
      const result = parser.validate('{{#if cond}}unclosed', ['cond']);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

// ── EmailTemplateRenderer ────────────────────────────────────────────────────

describe('EmailTemplateRenderer', () => {
  let renderer: EmailTemplateRenderer;

  beforeEach(() => {
    renderer = new EmailTemplateRenderer();
  });

  // ── render() ───────────────────────────────────────────────────────────────

  describe('render()', () => {
    it('substitutes a simple variable', () => {
      expect(renderer.render('Hello {{name}}!', { name: 'Alice' })).toBe('Hello Alice!');
    });

    it('substitutes multiple variables', () => {
      const result = renderer.render('{{first}} {{last}}', { first: 'John', last: 'Doe' });
      expect(result).toBe('John Doe');
    });

    it('renders empty string for undefined variable', () => {
      expect(renderer.render('{{missing}}', {})).toBe('');
    });

    it('renders conditional block when truthy', () => {
      const result = renderer.render('{{#if show}}visible{{/if}}', { show: true });
      expect(result).toBe('visible');
    });

    it('omits conditional block when falsy', () => {
      const result = renderer.render('{{#if show}}visible{{/if}}', { show: false });
      expect(result).toBe('');
    });

    it('omits conditional block when value is empty array', () => {
      const result = renderer.render('{{#if items}}has items{{/if}}', { items: [] });
      expect(result).toBe('');
    });

    it('renders conditional block when value is non-empty array', () => {
      const result = renderer.render('{{#if items}}has items{{/if}}', { items: ['a'] });
      expect(result).toBe('has items');
    });

    it('renders each loop over array', () => {
      const result = renderer.render('{{#each names}}{{this}} {{/each}}', { names: ['A', 'B', 'C'] });
      expect(result).toBe('A B C ');
    });

    it('renders each loop with dotted property access', () => {
      const result = renderer.render(
        '{{#each users}}{{this.name}},{{/each}}',
        { users: [{ name: 'Alice' }, { name: 'Bob' }] },
      );
      expect(result).toBe('Alice,Bob,');
    });

    it('renders empty string for each over non-array', () => {
      const result = renderer.render('{{#each items}}x{{/each}}', { items: null });
      expect(result).toBe('');
    });

    it('renders nested if inside each', () => {
      const result = renderer.render(
        '{{#each items}}{{#if this.active}}{{this.name}}{{/if}}{{/each}}',
        { items: [{ name: 'A', active: true }, { name: 'B', active: false }] },
      );
      expect(result).toBe('A');
    });

    it('does NOT escape HTML in render()', () => {
      const result = renderer.render('{{content}}', { content: '<b>bold</b>' });
      expect(result).toBe('<b>bold</b>');
    });

    it('resolves dotted path variables', () => {
      const result = renderer.render('{{user.email}}', { user: { email: 'a@b.com' } });
      expect(result).toBe('a@b.com');
    });
  });

  // ── renderHtml() ───────────────────────────────────────────────────────────

  describe('renderHtml()', () => {
    it('escapes & in variable values', () => {
      expect(renderer.renderHtml('{{v}}', { v: 'a & b' })).toBe('a &amp; b');
    });

    it('escapes < in variable values', () => {
      expect(renderer.renderHtml('{{v}}', { v: '<script>' })).toBe('&lt;script&gt;');
    });

    it('escapes > in variable values', () => {
      expect(renderer.renderHtml('{{v}}', { v: 'a>b' })).toBe('a&gt;b');
    });

    it('escapes " in variable values', () => {
      expect(renderer.renderHtml('{{v}}', { v: '"quoted"' })).toBe('&quot;quoted&quot;');
    });

    it("escapes ' in variable values", () => {
      expect(renderer.renderHtml('{{v}}', { v: "it's" })).toBe('it&#x27;s');
    });

    it('escapes / in variable values', () => {
      expect(renderer.renderHtml('{{v}}', { v: 'a/b' })).toBe('a&#x2F;b');
    });

    it('escapes XSS payload', () => {
      const result = renderer.renderHtml('{{v}}', { v: '<script>alert("xss")</script>' });
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('does not escape literal template text', () => {
      const result = renderer.renderHtml('<p>Hello {{name}}</p>', { name: 'Alice' });
      expect(result).toBe('<p>Hello Alice</p>');
    });

    it('escapes values inside each loops', () => {
      const result = renderer.renderHtml(
        '{{#each items}}{{this}}{{/each}}',
        { items: ['<b>', '&'] },
      );
      expect(result).toBe('&lt;b&gt;&amp;');
    });

    it('escapes values inside if blocks', () => {
      const result = renderer.renderHtml(
        '{{#if show}}{{val}}{{/if}}',
        { show: true, val: '<evil>' },
      );
      expect(result).toBe('&lt;evil&gt;');
    });
  });

  // ── renderText() ───────────────────────────────────────────────────────────

  describe('renderText()', () => {
    it('renders plain text without HTML tags', () => {
      const result = renderer.renderText('<p>Hello {{name}}</p>', { name: 'Alice' });
      expect(result).toBe('Hello Alice');
    });

    it('substitutes variables in plain text', () => {
      const result = renderer.renderText('Dear {{name}},', { name: 'Bob' });
      expect(result).toBe('Dear Bob,');
    });

    it('strips HTML tags from output', () => {
      const result = renderer.renderText('<b>{{title}}</b>', { title: 'Test' });
      expect(result).not.toContain('<b>');
      expect(result).toContain('Test');
    });
  });

  // ── complex templates ──────────────────────────────────────────────────────

  describe('complex templates', () => {
    it('renders a full invitation email template', () => {
      const template = `Dear {{recipient_name}},

You have been invited to join {{company_name}}.

{{#if has_role}}Your role will be: {{role}}{{/if}}

Please click the link below to set up your account:
{{registration_link}}

This link expires in {{expiry_hours}} hours.

Best regards,
{{sender_name}}`;

      const data = {
        recipient_name: 'Jane Doe',
        company_name: 'TechSwiftTrix',
        has_role: true,
        role: 'Agent',
        registration_link: 'https://example.com/register/abc123',
        expiry_hours: 72,
        sender_name: 'Admin',
      };

      const result = renderer.render(template, data);
      expect(result).toContain('Jane Doe');
      expect(result).toContain('TechSwiftTrix');
      expect(result).toContain('Your role will be: Agent');
      expect(result).toContain('https://example.com/register/abc123');
      expect(result).toContain('72');
    });

    it('renders payment confirmation with loop', () => {
      const template = `Payment confirmed for:
{{#each items}}
- {{this.description}}: {{this.amount}}
{{/each}}
Total: {{total}}`;

      const data = {
        items: [
          { description: 'Service fee', amount: '$500' },
          { description: 'Setup fee', amount: '$100' },
        ],
        total: '$600',
      };

      const result = renderer.render(template, data);
      expect(result).toContain('Service fee');
      expect(result).toContain('$500');
      expect(result).toContain('Setup fee');
      expect(result).toContain('$600');
    });

    it('renders HTML email with XSS prevention', () => {
      const template = '<p>Hello {{name}}, your message: {{message}}</p>';
      const data = { name: 'Alice', message: '<script>alert(1)</script>' };

      const result = renderer.renderHtml(template, data);
      expect(result).toContain('Alice');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });
  });
});
