/**
 * Tests for EmailDeliveryService
 * Requirements: 38.10, 28.6-28.7
 */

import { EmailDeliveryService, SendGridEvent } from './emailDeliveryService';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
}));

jest.mock('../database/connection', () => ({
  db: {
    query: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock('./emailTemplateService', () => ({
  emailTemplateService: {
    getTemplate: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

import sgMail from '@sendgrid/mail';
import { db } from '../database/connection';
import { emailTemplateService } from './emailTemplateService';

const mockDb = db as jest.Mocked<typeof db>;
const mockSgMail = sgMail as jest.Mocked<typeof sgMail>;
const mockTemplateService = emailTemplateService as jest.Mocked<typeof emailTemplateService>;

// ============================================================================
// Helpers
// ============================================================================

function makeRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'rec-1',
    to_address: 'user@example.com',
    template_name: 'invitation',
    language: 'en',
    subject: 'You have been invited',
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

// ============================================================================
// Tests
// ============================================================================

describe('EmailDeliveryService', () => {
  let service: EmailDeliveryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailDeliveryService();
  });

  // --------------------------------------------------------------------------
  // sendEmail
  // --------------------------------------------------------------------------

  describe('sendEmail', () => {
    it('creates a PENDING record, sends via SendGrid, and returns a SENT record', async () => {
      mockTemplateService.getTemplate.mockResolvedValue({
        id: 'tpl-1',
        name: 'invitation',
        subject: 'You have been invited to {{organization_name}}',
        htmlContent: '<p>Hello {{recipient_name}}</p>',
        textContent: 'Hello {{recipient_name}}',
        variables: ['recipient_name', 'organization_name'],
        language: 'en',
        version: 1,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const pendingRow = makeRecord();
      const sentRow = makeRecord({ status: 'SENT', sendgrid_message_id: 'msg-123', sent_at: new Date() });

      mockDb.query
        .mockResolvedValueOnce({ rows: [pendingRow], rowCount: 1 } as any) // INSERT
        .mockResolvedValueOnce({ rows: [sentRow], rowCount: 1 } as any);   // UPDATE

      (mockSgMail.send as jest.Mock).mockResolvedValue([
        { headers: { 'x-message-id': 'msg-123' }, statusCode: 202 },
      ]);

      const result = await service.sendEmail(
        'user@example.com',
        'invitation',
        { recipient_name: 'Alice', organization_name: 'Acme' },
      );

      expect(mockTemplateService.getTemplate).toHaveBeenCalledWith('invitation', 'en');
      expect(mockSgMail.send).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('SENT');
      expect(result.sendgridMessageId).toBe('msg-123');
    });

    it('marks record as FAILED when SendGrid throws', async () => {
      mockTemplateService.getTemplate.mockResolvedValue({
        id: 'tpl-1',
        name: 'password_reset',
        subject: 'Reset your password',
        htmlContent: '<p>Reset</p>',
        textContent: 'Reset',
        variables: [],
        language: 'en',
        version: 1,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const pendingRow = makeRecord({ template_name: 'password_reset', subject: 'Reset your password' });
      const failedRow = makeRecord({ template_name: 'password_reset', status: 'FAILED', error_message: 'API error' });

      mockDb.query
        .mockResolvedValueOnce({ rows: [pendingRow], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [failedRow], rowCount: 1 } as any);

      (mockSgMail.send as jest.Mock).mockRejectedValue(new Error('API error'));

      const result = await service.sendEmail('user@example.com', 'password_reset', {});

      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toBe('API error');
    });

    it('uses provided language when fetching template', async () => {
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

      const row = makeRecord({ language: 'fr', subject: 'Vous avez été invité' });
      mockDb.query
        .mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [{ ...row, status: 'SENT' }], rowCount: 1 } as any);

      (mockSgMail.send as jest.Mock).mockResolvedValue([{ headers: {}, statusCode: 202 }]);

      await service.sendEmail('user@example.com', 'invitation', {}, 'fr', 'user-1');

      expect(mockTemplateService.getTemplate).toHaveBeenCalledWith('invitation', 'fr');
    });
  });

  // --------------------------------------------------------------------------
  // handleSendGridWebhook
  // --------------------------------------------------------------------------

  describe('handleSendGridWebhook', () => {
    const baseEvent: SendGridEvent = {
      event: 'delivered',
      email: 'user@example.com',
      sg_message_id: 'msg-abc.filter001',
      timestamp: 1700000000,
    };

    it('updates status to DELIVERED on delivered event', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'rec-1' }], rowCount: 1 } as any) // SELECT
        .mockResolvedValueOnce({ rows: [makeRecord({ status: 'DELIVERED' })], rowCount: 1 } as any); // UPDATE

      await service.handleSendGridWebhook([baseEvent]);

      // First query should look up by the stripped message ID
      expect(mockDb.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('sendgrid_message_id'),
        ['msg-abc'],
      );
    });

    it('updates status to OPENED on open event', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'rec-1' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [makeRecord({ status: 'OPENED' })], rowCount: 1 } as any);

      await service.handleSendGridWebhook([{ ...baseEvent, event: 'open' }]);

      const updateCall = (mockDb.query as jest.Mock).mock.calls[1];
      expect(updateCall[0]).toContain('UPDATE');
    });

    it('updates status to CLICKED on click event', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'rec-1' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [makeRecord({ status: 'CLICKED' })], rowCount: 1 } as any);

      await service.handleSendGridWebhook([{ ...baseEvent, event: 'click' }]);

      const updateCall = (mockDb.query as jest.Mock).mock.calls[1];
      expect(updateCall[0]).toContain('UPDATE');
    });

    it('updates status to BOUNCED on bounce event', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'rec-1' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [makeRecord({ status: 'BOUNCED' })], rowCount: 1 } as any);

      await service.handleSendGridWebhook([{ ...baseEvent, event: 'bounce', reason: 'Invalid address' }]);

      const updateCall = (mockDb.query as jest.Mock).mock.calls[1];
      expect(updateCall[0]).toContain('UPDATE');
    });

    it('skips events with no matching record', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await service.handleSendGridWebhook([baseEvent]);

      // Only the SELECT should have been called, no UPDATE
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('processes multiple events in sequence', async () => {
      const events: SendGridEvent[] = [
        { ...baseEvent, sg_message_id: 'msg-1', event: 'delivered' },
        { ...baseEvent, sg_message_id: 'msg-2', event: 'open' },
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'rec-1' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [makeRecord({ status: 'DELIVERED' })], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'rec-2' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [makeRecord({ status: 'OPENED' })], rowCount: 1 } as any);

      await service.handleSendGridWebhook(events);

      expect(mockDb.query).toHaveBeenCalledTimes(4);
    });
  });

  // --------------------------------------------------------------------------
  // getDeliveryStats
  // --------------------------------------------------------------------------

  describe('getDeliveryStats', () => {
    const statsRow = { sent: '10', delivered: '8', opened: '5', clicked: '2', bounced: '1', failed: '1', total: '12' };

    it('returns parsed stats with no filters', async () => {
      mockDb.query.mockResolvedValue({ rows: [statsRow], rowCount: 1 } as any);

      const stats = await service.getDeliveryStats();

      expect(stats).toEqual({ sent: 10, delivered: 8, opened: 5, clicked: 2, bounced: 1, failed: 1, total: 12 });
    });

    it('applies templateName filter', async () => {
      mockDb.query.mockResolvedValue({ rows: [statsRow], rowCount: 1 } as any);

      await service.getDeliveryStats({ templateName: 'invitation' });

      const [sql, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('template_name');
      expect(params).toContain('invitation');
    });

    it('applies userId filter', async () => {
      mockDb.query.mockResolvedValue({ rows: [statsRow], rowCount: 1 } as any);

      await service.getDeliveryStats({ userId: 'user-42' });

      const [sql, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('user_id');
      expect(params).toContain('user-42');
    });

    it('applies date range filters', async () => {
      mockDb.query.mockResolvedValue({ rows: [statsRow], rowCount: 1 } as any);

      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');
      await service.getDeliveryStats({ fromDate: from, toDate: to });

      const [sql, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('sent_at');
      expect(params).toContain(from);
      expect(params).toContain(to);
    });
  });

  // --------------------------------------------------------------------------
  // getDeliveryHistory
  // --------------------------------------------------------------------------

  describe('getDeliveryHistory', () => {
    it('returns mapped records with default limit', async () => {
      const rows = [makeRecord({ status: 'SENT' }), makeRecord({ id: 'rec-2', status: 'DELIVERED' })];
      mockDb.query.mockResolvedValue({ rows, rowCount: 2 } as any);

      const history = await service.getDeliveryHistory();

      expect(history).toHaveLength(2);
      expect(history[0].status).toBe('SENT');
      expect(history[1].status).toBe('DELIVERED');
    });

    it('filters by userId', async () => {
      mockDb.query.mockResolvedValue({ rows: [makeRecord({ user_id: 'user-1' })], rowCount: 1 } as any);

      await service.getDeliveryHistory('user-1');

      const [sql, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('user_id');
      expect(params).toContain('user-1');
    });

    it('filters by templateName', async () => {
      mockDb.query.mockResolvedValue({ rows: [makeRecord()], rowCount: 1 } as any);

      await service.getDeliveryHistory(undefined, 'payment_confirmation');

      const [sql, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('template_name');
      expect(params).toContain('payment_confirmation');
    });

    it('respects custom limit', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await service.getDeliveryHistory(undefined, undefined, 10);

      const [, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(params).toContain(10);
    });

    it('maps all fields correctly', async () => {
      const now = new Date();
      const row = makeRecord({
        id: 'rec-xyz',
        to_address: 'test@example.com',
        template_name: 'report_reminder',
        language: 'es',
        subject: 'Recordatorio',
        status: 'CLICKED',
        sendgrid_message_id: 'sg-999',
        user_id: 'user-99',
        sent_at: now,
        delivered_at: now,
        opened_at: now,
        clicked_at: now,
        bounced_at: null,
        error_message: null,
      });

      mockDb.query.mockResolvedValue({ rows: [row], rowCount: 1 } as any);

      const [record] = await service.getDeliveryHistory('user-99');

      expect(record.id).toBe('rec-xyz');
      expect(record.to).toBe('test@example.com');
      expect(record.templateName).toBe('report_reminder');
      expect(record.language).toBe('es');
      expect(record.status).toBe('CLICKED');
      expect(record.sendgridMessageId).toBe('sg-999');
      expect(record.userId).toBe('user-99');
    });
  });
});
