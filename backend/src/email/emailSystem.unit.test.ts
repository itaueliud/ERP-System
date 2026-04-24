/**
 * Unit Tests: Email System
 * Covers: template parsing, variable substitution, XSS prevention,
 *         multi-language support, and email delivery tracking.
 * Requirements: 38.1-38.10, 67.1-67.10
 */

import { EmailTemplateParser, EmailTemplateRenderer } from './emailTemplateParser';
import { EmailTemplateService } from './emailTemplateService';
import { EmailDeliveryService, SendGridEvent } from './emailDeliveryService';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
}));

const mockQuery = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../database/connection', () => ({
  db: {
    query: (...args: any[]) => mockQuery(...args),
    transaction: (cb: any) => mockTransaction(cb),
  },
}));

jest.mock('./emailTemplateService', () => {
  const actual = jest.requireActual('./emailTemplateService');
  return {
    ...actual,
    emailTemplateService: { getTemplate: jest.fn() },
  };
});

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import sgMail from '@sendgrid/mail';
import { emailTemplateService } from './emailTemplateService';

const mockSgMail = sgMail as jest.Mocked<typeof sgMail>;
const mockTemplateService = emailTemplateService as jest.Mocked<typeof emailTemplateService>;

// ============================================================================
// Helpers
// ============================================================================

function makeDeliveryRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'rec-1',
    to_address: 'user@example.com',
    template_name: 'invitation',
    language: 'en',
    subject: 'Welcome',
    status: 'PENDING',
    sendgrid_message_id: null,
    user_id: null,
    sent_at: null,
    delivered_at: null,
    opened_at: null,
    clicked_at: null,
    bounced_at: null,
    error_message: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeTemplateRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tpl-1',
    name: 'invitation',
    subject: 'Welcome {{recipient_name}}',
    html_content: '<p>Hello {{recipient_name}}</p>',
    text_content: 'Hello {{recipient_name}}',
    variables: ['recipient_name'],
    language: 'en',
    version: 1,
    created_by: 'user-1',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ============================================================================
// 1. Template Parsing
// ============================================================================

describe('1. Template Parsing', () => {
  let parser: EmailTemplateParser;

  beforeEach(() => {
    parser = new EmailTemplateParser();
  });

  describe('valid syntax', () => {
    it('parses a template with only plain text', () => {
      const { tokens, variables } = parser.parse('Hello, World!');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({ type: 'text', value: 'Hello, World!' });
      expect(variables).toHaveLength(0);
    });

    it('parses a template with a single variable', () => {
      const { tokens } = parser.parse('Dear {{name}},');
      expect(tokens).toHaveLength(3);
      expect(tokens[1]).toEqual({ type: 'variable', value: 'name' });
    });

    it('trims whitespace inside {{ }}', () => {
      const { tokens } = parser.parse('{{ name }}');
      expect(tokens[0]).toEqual({ type: 'variable', value: 'name' });
    });

    it('parses multiple variables in one template', () => {
      const { variables } = parser.parse('{{first}} {{last}} <{{email}}>');
      expect(variables).toContain('first');
      expect(variables).toContain('last');
      expect(variables).toContain('email');
    });

    it('handles empty template without error', () => {
      const { tokens, variables } = parser.parse('');
      expect(tokens).toHaveLength(0);
      expect(variables).toHaveLength(0);
    });

    it('handles multiline templates', () => {
      const { variables } = parser.parse('Line 1: {{v1}}\nLine 2: {{v2}}');
      expect(variables).toContain('v1');
      expect(variables).toContain('v2');
    });
  });

  describe('conditional blocks', () => {
    it('parses {{#if}}...{{/if}} block', () => {
      const { tokens } = parser.parse('{{#if show}}visible{{/if}}');
      expect(tokens[0]).toEqual({ type: 'if_start', value: 'show' });
      expect(tokens[1]).toEqual({ type: 'text', value: 'visible' });
      expect(tokens[2]).toEqual({ type: 'if_end', value: '' });
    });

    it('parses nested if blocks', () => {
      const { tokens } = parser.parse('{{#if a}}{{#if b}}inner{{/if}}{{/if}}');
      expect(tokens[0]).toEqual({ type: 'if_start', value: 'a' });
      expect(tokens[1]).toEqual({ type: 'if_start', value: 'b' });
      expect(tokens[tokens.length - 1]).toEqual({ type: 'if_end', value: '' });
    });

    it('throws on unmatched {{/if}}', () => {
      expect(() => parser.parse('text{{/if}}')).toThrow(/Unexpected {{\/if}}/);
    });

    it('throws on unclosed {{#if}}', () => {
      expect(() => parser.parse('{{#if cond}}content')).toThrow(/Unclosed block/);
    });
  });

  describe('loop blocks', () => {
    it('parses {{#each}}...{{/each}} block', () => {
      const { tokens } = parser.parse('{{#each items}}{{this}}{{/each}}');
      expect(tokens[0]).toEqual({ type: 'each_start', value: 'items' });
      expect(tokens[tokens.length - 1]).toEqual({ type: 'each_end', value: '' });
    });

    it('parses nested each blocks', () => {
      const { tokens } = parser.parse('{{#each outer}}{{#each inner}}x{{/each}}{{/each}}');
      expect(tokens[0]).toEqual({ type: 'each_start', value: 'outer' });
      expect(tokens[1]).toEqual({ type: 'each_start', value: 'inner' });
    });

    it('throws on unmatched {{/each}}', () => {
      expect(() => parser.parse('text{{/each}}')).toThrow(/Unexpected {{\/each}}/);
    });

    it('throws on unclosed {{#each}}', () => {
      expect(() => parser.parse('{{#each items}}content')).toThrow(/Unclosed block/);
    });
  });

  describe('variable extraction', () => {
    it('extractVariables returns unique variable names', () => {
      const vars = parser.extractVariables('{{x}} {{y}} {{x}}');
      expect(vars.filter((v) => v === 'x')).toHaveLength(1);
      expect(vars).toContain('y');
    });

    it('extractVariables includes if-condition and each-collection names', () => {
      const vars = parser.extractVariables('{{#if flag}}x{{/if}}{{#each list}}y{{/each}}');
      expect(vars).toContain('flag');
      expect(vars).toContain('list');
    });

    it('extractVariables returns empty array for plain text', () => {
      expect(parser.extractVariables('no variables here')).toHaveLength(0);
    });

    it('extractVariables includes dotted paths as-is', () => {
      const vars = parser.extractVariables('{{#each items}}{{this.name}}{{/each}}');
      expect(vars).toContain('this.name');
    });
  });

  describe('validate()', () => {
    it('returns valid when all variables are defined', () => {
      const result = parser.validate('Hello {{name}}!', ['name']);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns invalid with error for undefined variable', () => {
      const result = parser.validate('{{name}} {{missing}}', ['name']);
      expect(result.valid).toBe(false);
      expect(result.undefinedVars).toContain('missing');
    });

    it('does not flag "this" as undefined inside each blocks', () => {
      const result = parser.validate('{{#each items}}{{this.name}}{{/each}}', ['items']);
      expect(result.valid).toBe(true);
    });

    it('returns parse error for invalid syntax', () => {
      const result = parser.validate('{{#if cond}}unclosed', ['cond']);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// 2. Variable Substitution
// ============================================================================

describe('2. Variable Substitution', () => {
  let renderer: EmailTemplateRenderer;

  beforeEach(() => {
    renderer = new EmailTemplateRenderer();
  });

  it('replaces all variables in a template', () => {
    const result = renderer.render('{{first}} {{last}} <{{email}}>', {
      first: 'John',
      last: 'Doe',
      email: 'john@example.com',
    });
    expect(result).toBe('John Doe <john@example.com>');
  });

  it('renders empty string for missing variables', () => {
    expect(renderer.render('Hello {{missing}}!', {})).toBe('Hello !');
  });

  it('renders empty string for null variable value', () => {
    expect(renderer.render('{{v}}', { v: null })).toBe('');
  });

  it('renders empty string for undefined variable value', () => {
    expect(renderer.render('{{v}}', { v: undefined })).toBe('');
  });

  it('coerces numeric values to string', () => {
    expect(renderer.render('Amount: {{amount}}', { amount: 1500 })).toBe('Amount: 1500');
  });

  it('coerces boolean values to string', () => {
    expect(renderer.render('Active: {{active}}', { active: true })).toBe('Active: true');
  });

  it('resolves nested data via dot notation', () => {
    const result = renderer.render('{{user.name}} <{{user.email}}>', {
      user: { name: 'Alice', email: 'alice@example.com' },
    });
    expect(result).toBe('Alice <alice@example.com>');
  });

  it('resolves deeply nested data', () => {
    const result = renderer.render('{{a.b.c}}', { a: { b: { c: 'deep' } } });
    expect(result).toBe('deep');
  });

  it('renders empty string for missing nested path', () => {
    expect(renderer.render('{{a.b.c}}', { a: {} })).toBe('');
  });

  it('renders conditional block when condition is truthy', () => {
    expect(renderer.render('{{#if show}}visible{{/if}}', { show: true })).toBe('visible');
  });

  it('omits conditional block when condition is falsy', () => {
    expect(renderer.render('{{#if show}}visible{{/if}}', { show: false })).toBe('');
  });

  it('renders each loop substituting {{this}} for each item', () => {
    const result = renderer.render('{{#each names}}{{this}},{{/each}}', { names: ['A', 'B', 'C'] });
    expect(result).toBe('A,B,C,');
  });

  it('renders each loop with object items using dot notation', () => {
    const result = renderer.render(
      '{{#each users}}{{this.name}}:{{this.role}} {{/each}}',
      { users: [{ name: 'Alice', role: 'Agent' }, { name: 'Bob', role: 'CEO' }] },
    );
    expect(result).toBe('Alice:Agent Bob:CEO ');
  });

  it('renders empty string for each over empty array', () => {
    expect(renderer.render('{{#each items}}x{{/each}}', { items: [] })).toBe('');
  });

  it('renders empty string for each over non-array value', () => {
    expect(renderer.render('{{#each items}}x{{/each}}', { items: null })).toBe('');
  });

  it('renders a full invitation email template correctly', () => {
    const template = `Dear {{recipient_name}},\n\nYou are invited to {{company}}.\n{{#if has_role}}Role: {{role}}{{/if}}\nLink: {{link}}`;
    const data = {
      recipient_name: 'Jane',
      company: 'TechSwiftTrix',
      has_role: true,
      role: 'Agent',
      link: 'https://example.com/register',
    };
    const result = renderer.render(template, data);
    expect(result).toContain('Jane');
    expect(result).toContain('TechSwiftTrix');
    expect(result).toContain('Role: Agent');
    expect(result).toContain('https://example.com/register');
  });
});

// ============================================================================
// 3. XSS Prevention
// ============================================================================

describe('3. XSS Prevention', () => {
  let renderer: EmailTemplateRenderer;

  beforeEach(() => {
    renderer = new EmailTemplateRenderer();
  });

  const HTML_CHARS: Array<[string, string]> = [
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#x27;'],
    ['/', '&#x2F;'],
  ];

  it.each(HTML_CHARS)(
    'renderHtml escapes "%s" to "%s"',
    (raw, escaped) => {
      expect(renderer.renderHtml('{{v}}', { v: raw })).toBe(escaped);
    },
  );

  it('renderHtml escapes a full XSS payload', () => {
    const result = renderer.renderHtml('{{v}}', { v: '<script>alert("xss")</script>' });
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('&quot;');
  });

  it('renderHtml does NOT escape literal template text (only variable values)', () => {
    const result = renderer.renderHtml('<p>Hello {{name}}</p>', { name: 'Alice' });
    expect(result).toBe('<p>Hello Alice</p>');
  });

  it('renderHtml escapes values inside {{#each}} loops', () => {
    const result = renderer.renderHtml(
      '{{#each items}}{{this}}{{/each}}',
      { items: ['<b>', '&'] },
    );
    expect(result).toBe('&lt;b&gt;&amp;');
  });

  it('renderHtml escapes values inside {{#if}} blocks', () => {
    const result = renderer.renderHtml(
      '{{#if show}}{{val}}{{/if}}',
      { show: true, val: '<evil>' },
    );
    expect(result).toBe('&lt;evil&gt;');
  });

  it('render() does NOT escape HTML special characters', () => {
    const result = renderer.render('{{content}}', { content: '<b>bold</b>' });
    expect(result).toBe('<b>bold</b>');
  });

  it('render() preserves & without escaping', () => {
    expect(renderer.render('{{v}}', { v: 'a & b' })).toBe('a & b');
  });

  it('renderHtml escapes nested object property values', () => {
    const result = renderer.renderHtml('{{user.bio}}', {
      user: { bio: '<script>evil()</script>' },
    });
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });
});

// ============================================================================
// 4. Multi-Language Support
// ============================================================================

describe('4. Multi-Language Support', () => {
  let service: EmailTemplateService;

  beforeEach(() => {
    service = new EmailTemplateService();
    mockQuery.mockReset();
  });

  it('retrieves English template by default (language="en")', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeTemplateRow()] });

    const tpl = await service.getTemplate('invitation');

    expect(tpl.language).toBe('en');
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ['invitation', 'en']);
  });

  it('retrieves Swahili template when language="sw"', async () => {
    const swRow = makeTemplateRow({
      language: 'sw',
      subject: 'Umealikwa kujiunga na {{organization_name}}',
      html_content: '<p>Habari {{recipient_name}},</p><p>Umealikwa kujiunga na {{organization_name}}.</p>',
      text_content: 'Habari {{recipient_name}}, Umealikwa kujiunga na {{organization_name}}.',
    });
    mockQuery.mockResolvedValueOnce({ rows: [swRow] });

    const tpl = await service.getTemplate('invitation', 'sw');

    expect(tpl.language).toBe('sw');
    expect(tpl.subject).toContain('Umealikwa');
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ['invitation', 'sw']);
  });

  it('retrieves French template when language="fr"', async () => {
    const frRow = makeTemplateRow({
      language: 'fr',
      subject: 'Vous avez été invité à rejoindre {{organization_name}}',
      html_content: '<p>Bonjour {{recipient_name}},</p><p>Vous avez été invité à rejoindre {{organization_name}}.</p>',
      text_content: 'Bonjour {{recipient_name}}, Vous avez été invité à rejoindre {{organization_name}}.',
    });
    mockQuery.mockResolvedValueOnce({ rows: [frRow] });

    const tpl = await service.getTemplate('invitation', 'fr');

    expect(tpl.language).toBe('fr');
    expect(tpl.subject).toContain('Vous avez été invité');
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ['invitation', 'fr']);
  });

  it('throws when template is not found for the requested language', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(service.getTemplate('invitation', 'sw')).rejects.toThrow(
      'Email template not found: invitation (sw)',
    );
  });

  it('creates a template with a specific language', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeTemplateRow({ language: 'sw' })] });

    const tpl = await service.createTemplate({
      name: 'invitation',
      subject: 'Umealikwa',
      htmlContent: '<p>Habari {{recipient_name}}</p>',
      textContent: 'Habari {{recipient_name}}',
      language: 'sw',
      createdBy: 'admin-1',
    });

    const [, params] = mockQuery.mock.calls[0];
    expect(params[1]).toBe('sw');
    expect(tpl.language).toBe('sw');
  });

  it('renders Swahili template content correctly with variable substitution', () => {
    const renderer = new EmailTemplateRenderer();
    const swTemplate = 'Habari {{recipient_name}}, karibu {{organization_name}}!';
    const result = renderer.render(swTemplate, {
      recipient_name: 'Amina',
      organization_name: 'TechSwiftTrix',
    });
    expect(result).toBe('Habari Amina, karibu TechSwiftTrix!');
  });

  it('renders French template content correctly with variable substitution', () => {
    const renderer = new EmailTemplateRenderer();
    const frTemplate = 'Bonjour {{recipient_name}}, bienvenue chez {{organization_name}}!';
    const result = renderer.render(frTemplate, {
      recipient_name: 'Marie',
      organization_name: 'TechSwiftTrix',
    });
    expect(result).toBe('Bonjour Marie, bienvenue chez TechSwiftTrix!');
  });

  it('sendEmail uses the provided language when fetching template', async () => {
    const deliveryService = new EmailDeliveryService();

    mockTemplateService.getTemplate.mockResolvedValue({
      id: 'tpl-fr',
      name: 'invitation',
      subject: 'Vous avez été invité',
      htmlContent: '<p>Bonjour</p>',
      textContent: 'Bonjour',
      variables: [],
      language: 'fr',
      version: 1,
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const row = makeDeliveryRow({ language: 'fr' });
    mockQuery
      .mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ ...row, status: 'SENT' }], rowCount: 1 } as any);

    (mockSgMail.send as jest.Mock).mockResolvedValue([{ headers: {}, statusCode: 202 }]);

    await deliveryService.sendEmail('user@example.com', 'invitation', {}, 'fr');

    expect(mockTemplateService.getTemplate).toHaveBeenCalledWith('invitation', 'fr');
  });
});

// ============================================================================
// 5. Email Delivery Tracking
// ============================================================================

describe('5. Email Delivery Tracking', () => {
  let service: EmailDeliveryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailDeliveryService();
  });

  // --------------------------------------------------------------------------
  // Sent / Failed tracking
  // --------------------------------------------------------------------------

  describe('sent tracking', () => {
    it('records SENT status and SendGrid message ID on successful send', async () => {
      mockTemplateService.getTemplate.mockResolvedValue({
        id: 'tpl-1',
        name: 'invitation',
        subject: 'Welcome',
        htmlContent: '<p>Hi</p>',
        textContent: 'Hi',
        variables: [],
        language: 'en',
        version: 1,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const pendingRow = makeDeliveryRow();
      const sentRow = makeDeliveryRow({ status: 'SENT', sendgrid_message_id: 'sg-msg-1', sent_at: new Date() });

      mockQuery
        .mockResolvedValueOnce({ rows: [pendingRow], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [sentRow], rowCount: 1 } as any);

      (mockSgMail.send as jest.Mock).mockResolvedValue([
        { headers: { 'x-message-id': 'sg-msg-1' }, statusCode: 202 },
      ]);

      const result = await service.sendEmail('user@example.com', 'invitation', {});

      expect(result.status).toBe('SENT');
      expect(result.sendgridMessageId).toBe('sg-msg-1');
      expect(result.sentAt).not.toBeNull();
    });

    it('records FAILED status and error message when SendGrid throws', async () => {
      mockTemplateService.getTemplate.mockResolvedValue({
        id: 'tpl-1',
        name: 'invitation',
        subject: 'Welcome',
        htmlContent: '<p>Hi</p>',
        textContent: 'Hi',
        variables: [],
        language: 'en',
        version: 1,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const pendingRow = makeDeliveryRow();
      const failedRow = makeDeliveryRow({ status: 'FAILED', error_message: 'Network error' });

      mockQuery
        .mockResolvedValueOnce({ rows: [pendingRow], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [failedRow], rowCount: 1 } as any);

      (mockSgMail.send as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.sendEmail('user@example.com', 'invitation', {});

      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toBe('Network error');
    });
  });

  // --------------------------------------------------------------------------
  // Webhook delivery status updates
  // --------------------------------------------------------------------------

  describe('delivered tracking', () => {
    it('updates status to DELIVERED on SendGrid delivered event', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'rec-1' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [makeDeliveryRow({ status: 'DELIVERED', delivered_at: new Date() })], rowCount: 1 } as any);

      const event: SendGridEvent = {
        event: 'delivered',
        email: 'user@example.com',
        sg_message_id: 'sg-msg-1.filter001',
        timestamp: Date.now() / 1000,
      };

      await service.handleSendGridWebhook([event]);

      expect(mockQuery).toHaveBeenCalledTimes(2);
      const updateSql = (mockQuery as jest.Mock).mock.calls[1][0];
      expect(updateSql).toContain('UPDATE');
    });
  });

  describe('opened tracking', () => {
    it('updates status to OPENED on SendGrid open event', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'rec-1' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [makeDeliveryRow({ status: 'OPENED', opened_at: new Date() })], rowCount: 1 } as any);

      await service.handleSendGridWebhook([{
        event: 'open',
        email: 'user@example.com',
        sg_message_id: 'sg-msg-1',
        timestamp: Date.now() / 1000,
      }]);

      const updateSql = (mockQuery as jest.Mock).mock.calls[1][0];
      expect(updateSql).toContain('UPDATE');
    });
  });

  describe('clicked tracking', () => {
    it('updates status to CLICKED on SendGrid click event', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'rec-1' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [makeDeliveryRow({ status: 'CLICKED', clicked_at: new Date() })], rowCount: 1 } as any);

      await service.handleSendGridWebhook([{
        event: 'click',
        email: 'user@example.com',
        sg_message_id: 'sg-msg-1',
        timestamp: Date.now() / 1000,
      }]);

      const updateSql = (mockQuery as jest.Mock).mock.calls[1][0];
      expect(updateSql).toContain('UPDATE');
    });
  });

  describe('bounced tracking', () => {
    it('updates status to BOUNCED on SendGrid bounce event', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'rec-1' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [makeDeliveryRow({ status: 'BOUNCED', bounced_at: new Date() })], rowCount: 1 } as any);

      await service.handleSendGridWebhook([{
        event: 'bounce',
        email: 'user@example.com',
        sg_message_id: 'sg-msg-1',
        timestamp: Date.now() / 1000,
        reason: 'Invalid address',
      }]);

      const updateSql = (mockQuery as jest.Mock).mock.calls[1][0];
      expect(updateSql).toContain('UPDATE');
    });

    it('updates status to BOUNCED on SendGrid blocked event', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'rec-1' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [makeDeliveryRow({ status: 'BOUNCED' })], rowCount: 1 } as any);

      await service.handleSendGridWebhook([{
        event: 'blocked',
        email: 'user@example.com',
        sg_message_id: 'sg-msg-1',
        timestamp: Date.now() / 1000,
      }]);

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('strips SendGrid message ID suffix before lookup', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'rec-1' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [makeDeliveryRow({ status: 'DELIVERED' })], rowCount: 1 } as any);

      await service.handleSendGridWebhook([{
        event: 'delivered',
        email: 'user@example.com',
        sg_message_id: 'msg-abc.filter0001p1las1',
        timestamp: Date.now() / 1000,
      }]);

      const [, params] = (mockQuery as jest.Mock).mock.calls[0];
      expect(params[0]).toBe('msg-abc');
    });

    it('skips update when no matching record is found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await service.handleSendGridWebhook([{
        event: 'delivered',
        email: 'user@example.com',
        sg_message_id: 'unknown-msg',
        timestamp: Date.now() / 1000,
      }]);

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // Delivery stats (sent/delivered/opened/clicked/bounced metrics)
  // --------------------------------------------------------------------------

  describe('getDeliveryStats()', () => {
    const statsRow = {
      sent: '20', delivered: '18', opened: '10',
      clicked: '5', bounced: '2', failed: '1', total: '23',
    };

    it('returns all metrics parsed as integers', async () => {
      mockQuery.mockResolvedValue({ rows: [statsRow], rowCount: 1 } as any);

      const stats = await service.getDeliveryStats();

      expect(stats.sent).toBe(20);
      expect(stats.delivered).toBe(18);
      expect(stats.opened).toBe(10);
      expect(stats.clicked).toBe(5);
      expect(stats.bounced).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.total).toBe(23);
    });

    it('filters stats by templateName', async () => {
      mockQuery.mockResolvedValue({ rows: [statsRow], rowCount: 1 } as any);

      await service.getDeliveryStats({ templateName: 'invitation' });

      const [sql, params] = (mockQuery as jest.Mock).mock.calls[0];
      expect(sql).toContain('template_name');
      expect(params).toContain('invitation');
    });

    it('filters stats by userId', async () => {
      mockQuery.mockResolvedValue({ rows: [statsRow], rowCount: 1 } as any);

      await service.getDeliveryStats({ userId: 'user-42' });

      const [sql, params] = (mockQuery as jest.Mock).mock.calls[0];
      expect(sql).toContain('user_id');
      expect(params).toContain('user-42');
    });

    it('filters stats by date range', async () => {
      mockQuery.mockResolvedValue({ rows: [statsRow], rowCount: 1 } as any);

      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');
      await service.getDeliveryStats({ fromDate: from, toDate: to });

      const [sql, params] = (mockQuery as jest.Mock).mock.calls[0];
      expect(sql).toContain('sent_at');
      expect(params).toContain(from);
      expect(params).toContain(to);
    });

    it('returns zero counts when no records match', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ sent: '0', delivered: '0', opened: '0', clicked: '0', bounced: '0', failed: '0', total: '0' }],
        rowCount: 1,
      } as any);

      const stats = await service.getDeliveryStats();

      expect(stats.sent).toBe(0);
      expect(stats.total).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Delivery history
  // --------------------------------------------------------------------------

  describe('getDeliveryHistory()', () => {
    it('returns mapped delivery records', async () => {
      const rows = [
        makeDeliveryRow({ status: 'SENT' }),
        makeDeliveryRow({ id: 'rec-2', status: 'DELIVERED' }),
      ];
      mockQuery.mockResolvedValue({ rows, rowCount: 2 } as any);

      const history = await service.getDeliveryHistory();

      expect(history).toHaveLength(2);
      expect(history[0].status).toBe('SENT');
      expect(history[1].status).toBe('DELIVERED');
    });

    it('maps all delivery record fields correctly', async () => {
      const now = new Date();
      const row = makeDeliveryRow({
        id: 'rec-xyz',
        to_address: 'test@example.com',
        template_name: 'payment_confirmation',
        language: 'fr',
        subject: 'Paiement confirmé',
        status: 'CLICKED',
        sendgrid_message_id: 'sg-999',
        user_id: 'user-99',
        sent_at: now,
        delivered_at: now,
        opened_at: now,
        clicked_at: now,
      });
      mockQuery.mockResolvedValue({ rows: [row], rowCount: 1 } as any);

      const [record] = await service.getDeliveryHistory('user-99');

      expect(record.id).toBe('rec-xyz');
      expect(record.to).toBe('test@example.com');
      expect(record.templateName).toBe('payment_confirmation');
      expect(record.language).toBe('fr');
      expect(record.status).toBe('CLICKED');
      expect(record.sendgridMessageId).toBe('sg-999');
      expect(record.userId).toBe('user-99');
    });

    it('filters history by userId', async () => {
      mockQuery.mockResolvedValue({ rows: [makeDeliveryRow({ user_id: 'user-1' })], rowCount: 1 } as any);

      await service.getDeliveryHistory('user-1');

      const [sql, params] = (mockQuery as jest.Mock).mock.calls[0];
      expect(sql).toContain('user_id');
      expect(params).toContain('user-1');
    });

    it('filters history by templateName', async () => {
      mockQuery.mockResolvedValue({ rows: [makeDeliveryRow()], rowCount: 1 } as any);

      await service.getDeliveryHistory(undefined, 'report_reminder');

      const [sql, params] = (mockQuery as jest.Mock).mock.calls[0];
      expect(sql).toContain('template_name');
      expect(params).toContain('report_reminder');
    });

    it('respects custom limit parameter', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await service.getDeliveryHistory(undefined, undefined, 25);

      const [, params] = (mockQuery as jest.Mock).mock.calls[0];
      expect(params).toContain(25);
    });
  });
});
