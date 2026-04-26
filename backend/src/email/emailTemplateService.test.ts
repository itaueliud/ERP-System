/**
 * Unit tests for EmailTemplateService
 * Requirements: 38.1-38.9
 */

import { EmailTemplateService, CreateTemplateInput, UpdateTemplateInput } from './emailTemplateService';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockQuery = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../database/connection', () => ({
  db: {
    query: (...args: any[]) => mockQuery(...args),
    transaction: (cb: any) => mockTransaction(cb),
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbRow(overrides: Partial<Record<string, any>> = {}) {
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
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeVersionRow(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'ver-1',
    template_id: 'tpl-1',
    version: 1,
    subject: 'Old subject',
    html_content: '<p>Old</p>',
    text_content: 'Old',
    created_by: 'user-1',
    created_at: new Date('2024-01-01'),
    change_summary: 'Initial version',
    ...overrides,
  };
}

function makeCreateInput(overrides: Partial<CreateTemplateInput> = {}): CreateTemplateInput {
  return {
    name: 'invitation',
    subject: 'Welcome {{recipient_name}}',
    htmlContent: '<p>Hello {{recipient_name}}</p>',
    textContent: 'Hello {{recipient_name}}',
    variables: ['recipient_name'],
    language: 'en',
    createdBy: 'user-1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;

  beforeEach(() => {
    service = new EmailTemplateService();
    mockQuery.mockReset();
    mockTransaction.mockReset();
  });

  // -------------------------------------------------------------------------
  // getTemplate()
  // -------------------------------------------------------------------------

  describe('getTemplate()', () => {
    it('returns a template by name and default language "en"', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeDbRow()] });

      const tpl = await service.getTemplate('invitation');

      expect(tpl.name).toBe('invitation');
      expect(tpl.language).toBe('en');
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ['invitation', 'en']);
    });

    it('returns a template for a specific language', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeDbRow({ language: 'fr' })] });

      const tpl = await service.getTemplate('invitation', 'fr');

      expect(tpl.language).toBe('fr');
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ['invitation', 'fr']);
    });

    it('throws when template is not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(service.getTemplate('nonexistent')).rejects.toThrow(
        'Email template not found: nonexistent (en)',
      );
    });

    it('maps all fields correctly', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeDbRow()] });

      const tpl = await service.getTemplate('invitation');

      expect(tpl.id).toBe('tpl-1');
      expect(tpl.subject).toBe('Welcome {{recipient_name}}');
      expect(tpl.htmlContent).toBe('<p>Hello {{recipient_name}}</p>');
      expect(tpl.textContent).toBe('Hello {{recipient_name}}');
      expect(tpl.variables).toEqual(['recipient_name']);
      expect(tpl.version).toBe(1);
      expect(tpl.createdBy).toBe('user-1');
    });
  });

  // -------------------------------------------------------------------------
  // listTemplates()
  // -------------------------------------------------------------------------

  describe('listTemplates()', () => {
    it('returns all templates ordered by name and language', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeDbRow(), makeDbRow({ id: 'tpl-2', name: 'password_reset' })] });

      const templates = await service.listTemplates();

      expect(templates).toHaveLength(2);
      expect(templates[0].name).toBe('invitation');
      expect(templates[1].name).toBe('password_reset');
    });

    it('returns empty array when no templates exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const templates = await service.listTemplates();

      expect(templates).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // createTemplate()
  // -------------------------------------------------------------------------

  describe('createTemplate()', () => {
    it('inserts a new template and returns it', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeDbRow()] });

      const tpl = await service.createTemplate(makeCreateInput());

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql] = mockQuery.mock.calls[0];
      expect(sql.trim().toUpperCase()).toMatch(/^INSERT INTO EMAIL_TEMPLATES/);
      expect(tpl.name).toBe('invitation');
    });

    it('defaults language to "en" when not provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeDbRow()] });

      await service.createTemplate(makeCreateInput({ language: undefined }));

      const [, params] = mockQuery.mock.calls[0];
      expect(params[1]).toBe('en');
    });

    it('auto-extracts variables from htmlContent when not provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeDbRow()] });

      await service.createTemplate(makeCreateInput({ variables: undefined }));

      const [, params] = mockQuery.mock.calls[0];
      // variables param is JSON-stringified array
      const vars = JSON.parse(params[5]);
      expect(vars).toContain('recipient_name');
    });

    it('uses provided variables when supplied', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeDbRow()] });

      await service.createTemplate(makeCreateInput({ variables: ['custom_var'] }));

      const [, params] = mockQuery.mock.calls[0];
      const vars = JSON.parse(params[5]);
      expect(vars).toEqual(['custom_var']);
    });
  });

  // -------------------------------------------------------------------------
  // updateTemplate()
  // -------------------------------------------------------------------------

  describe('updateTemplate()', () => {
    it('archives current version and increments version number', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [makeDbRow()] })          // SELECT FOR UPDATE
          .mockResolvedValueOnce({ rows: [] })                      // INSERT version
          .mockResolvedValueOnce({ rows: [makeDbRow({ version: 2 })] }), // UPDATE
      };
      mockTransaction.mockImplementationOnce((cb: any) => cb(mockClient));

      const input: UpdateTemplateInput = {
        subject: 'New subject',
        createdBy: 'user-2',
        changeSummary: 'Updated subject',
      };

      const tpl = await service.updateTemplate('tpl-1', input);

      expect(tpl.version).toBe(2);

      // Verify version was archived
      const insertCall = mockClient.query.mock.calls[1];
      expect(insertCall[0].trim().toUpperCase()).toMatch(/^INSERT INTO EMAIL_TEMPLATE_VERSIONS/);
    });

    it('throws when template is not found', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [] }),
      };
      mockTransaction.mockImplementationOnce((cb: any) => cb(mockClient));

      await expect(service.updateTemplate('nonexistent', { createdBy: 'user-1' })).rejects.toThrow(
        'Email template not found: nonexistent',
      );
    });

    it('preserves existing fields when partial update is provided', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [makeDbRow()] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [makeDbRow({ version: 2 })] }),
      };
      mockTransaction.mockImplementationOnce((cb: any) => cb(mockClient));

      await service.updateTemplate('tpl-1', { createdBy: 'user-2' });

      const updateCall = mockClient.query.mock.calls[2];
      // subject should be the original
      expect(updateCall[1][0]).toBe('Welcome {{recipient_name}}');
    });
  });

  // -------------------------------------------------------------------------
  // previewTemplate()
  // -------------------------------------------------------------------------

  describe('previewTemplate()', () => {
    it('renders html and text with provided sample data', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          html_content: '<p>Hello {{recipient_name}}</p>',
          text_content: 'Hello {{recipient_name}}',
        }],
      });

      const preview = await service.previewTemplate('tpl-1', { recipient_name: 'Alice' });

      expect(preview.html).toContain('Alice');
      expect(preview.text).toContain('Alice');
    });

    it('throws when template is not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(service.previewTemplate('nonexistent', {})).rejects.toThrow(
        'Email template not found: nonexistent',
      );
    });

    it('escapes HTML in rendered html output', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          html_content: '<p>Hello {{recipient_name}}</p>',
          text_content: 'Hello {{recipient_name}}',
        }],
      });

      const preview = await service.previewTemplate('tpl-1', { recipient_name: '<script>xss</script>' });

      expect(preview.html).not.toContain('<script>');
      expect(preview.html).toContain('&lt;script&gt;');
    });

    it('strips HTML tags from text output', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          html_content: '<p>Hello {{recipient_name}}</p>',
          text_content: 'Hello {{recipient_name}}',
        }],
      });

      const preview = await service.previewTemplate('tpl-1', { recipient_name: 'Bob' });

      expect(preview.text).not.toContain('<p>');
      expect(preview.text).toContain('Bob');
    });
  });

  // -------------------------------------------------------------------------
  // getVersionHistory()
  // -------------------------------------------------------------------------

  describe('getVersionHistory()', () => {
    it('returns version history ordered by version descending', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          makeVersionRow({ version: 2, change_summary: 'Second update' }),
          makeVersionRow({ version: 1, change_summary: 'Initial version' }),
        ],
      });

      const history = await service.getVersionHistory('invitation');

      expect(history).toHaveLength(2);
      expect(history[0].version).toBe(2);
      expect(history[1].version).toBe(1);
    });

    it('returns empty array when no versions exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const history = await service.getVersionHistory('invitation');

      expect(history).toHaveLength(0);
    });

    it('maps version fields correctly', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeVersionRow()] });

      const history = await service.getVersionHistory('invitation');
      const v = history[0];

      expect(v.id).toBe('ver-1');
      expect(v.templateId).toBe('tpl-1');
      expect(v.version).toBe(1);
      expect(v.changeSummary).toBe('Initial version');
    });

    it('queries by template name', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.getVersionHistory('password_reset');

      const [, params] = mockQuery.mock.calls[0];
      expect(params[0]).toBe('password_reset');
    });
  });

  // -------------------------------------------------------------------------
  // seedDefaultTemplates()
  // -------------------------------------------------------------------------

  describe('seedDefaultTemplates()', () => {
    // Helper: alternate SELECT (empty) and INSERT (row) responses for 6 templates
    function mockSeedResponses() {
      const templateNames = [
        'invitation', 'password_reset', 'payment_confirmation',
        'contract_generated', 'report_reminder', 'notification_digest',
      ];
      for (const name of templateNames) {
        mockQuery
          .mockResolvedValueOnce({ rows: [] })                          // SELECT — not found
          .mockResolvedValueOnce({ rows: [makeDbRow({ name })] });      // INSERT — returns row
      }
    }

    it('creates all 6 default templates when none exist', async () => {
      mockSeedResponses();

      await service.seedDefaultTemplates();

      // 6 templates × 2 queries each = 12 calls
      expect(mockQuery).toHaveBeenCalledTimes(12);
    });

    it('skips templates that already exist', async () => {
      // All templates already exist
      mockQuery.mockResolvedValue({ rows: [{ id: 'existing' }] });

      await service.seedDefaultTemplates();

      // Only SELECT queries, no INSERTs
      expect(mockQuery).toHaveBeenCalledTimes(6);
      for (const call of mockQuery.mock.calls) {
        expect(call[0].trim().toUpperCase()).not.toMatch(/^INSERT/);
      }
    });

    it('seeds the 6 required template names', async () => {
      mockSeedResponses();

      await service.seedDefaultTemplates();

      const seededNames = mockQuery.mock.calls
        .filter((call: any[]) => call[0].trim().toUpperCase().startsWith('INSERT'))
        .map((call: any[]) => call[1][0]);

      expect(seededNames).toContain('invitation');
      expect(seededNames).toContain('password_reset');
      expect(seededNames).toContain('payment_confirmation');
      expect(seededNames).toContain('contract_generated');
      expect(seededNames).toContain('report_reminder');
      expect(seededNames).toContain('notification_digest');
    });
  });
});
