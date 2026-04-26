/**
 * Unit tests for WebhookService
 * Requirements: 45.1-45.6
 */

import { WebhookService, WebhookEvent } from './webhookService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockQuery = jest.fn();

jest.mock('../database/connection', () => ({
  db: {
    query: (...args: any[]) => mockQuery(...args),
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockAxiosPost = jest.fn();
jest.mock('axios', () => ({
  post: (...args: any[]) => mockAxiosPost(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbRow(overrides: Partial<any> = {}): any {
  return {
    id: 'wh-1',
    url: 'https://example.com/hook',
    events: ['client_created', 'payment_completed'],
    secret: 'test-secret',
    active: true,
    created_by: 'user-1',
    created_at: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(() => {
    service = new WebhookService();
    mockQuery.mockReset();
    mockAxiosPost.mockReset();
  });

  // -------------------------------------------------------------------------
  // registerWebhook()
  // -------------------------------------------------------------------------

  describe('registerWebhook()', () => {
    it('inserts a new webhook and returns the created record', async () => {
      const row = makeDbRow();
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const webhook = await service.registerWebhook(
        'https://example.com/hook',
        ['client_created', 'payment_completed'],
        'test-secret',
        'user-1'
      );

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql.trim().toUpperCase()).toMatch(/^INSERT INTO WEBHOOKS/);
      expect(params[0]).toBe('https://example.com/hook');
      expect(params[1]).toEqual(['client_created', 'payment_completed']);
      expect(params[2]).toBe('test-secret');
      expect(params[3]).toBe('user-1');

      expect(webhook.id).toBe('wh-1');
      expect(webhook.url).toBe('https://example.com/hook');
      expect(webhook.active).toBe(true);
      expect(webhook.createdBy).toBe('user-1');
    });

    it('maps all supported event types', async () => {
      const events: WebhookEvent[] = [
        'client_created',
        'lead_converted',
        'payment_completed',
        'contract_generated',
        'project_status_changed',
      ];
      mockQuery.mockResolvedValueOnce({ rows: [makeDbRow({ events })] });

      const webhook = await service.registerWebhook(
        'https://example.com/hook',
        events,
        'secret',
        'user-1'
      );

      expect(webhook.events).toEqual(events);
    });
  });

  // -------------------------------------------------------------------------
  // listWebhooks()
  // -------------------------------------------------------------------------

  describe('listWebhooks()', () => {
    it('returns all webhooks when no createdBy filter is given', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeDbRow(), makeDbRow({ id: 'wh-2' })] });

      const webhooks = await service.listWebhooks();

      expect(webhooks).toHaveLength(2);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).not.toContain('WHERE');
      expect(params).toHaveLength(0);
    });

    it('filters by createdBy when provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeDbRow()] });

      await service.listWebhooks('user-1');

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('WHERE');
      expect(params[0]).toBe('user-1');
    });

    it('returns empty array when no webhooks exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const webhooks = await service.listWebhooks();
      expect(webhooks).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // deleteWebhook()
  // -------------------------------------------------------------------------

  describe('deleteWebhook()', () => {
    it('returns true when the webhook is deleted', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await service.deleteWebhook('wh-1', 'user-1');

      expect(result).toBe(true);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql.trim().toUpperCase()).toMatch(/^DELETE FROM WEBHOOKS/);
      expect(params[0]).toBe('wh-1');
      expect(params[1]).toBe('user-1');
    });

    it('returns false when the webhook does not exist or is not owned by user', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const result = await service.deleteWebhook('wh-999', 'user-1');
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // signPayload() and verifySignature()
  // -------------------------------------------------------------------------

  describe('signPayload()', () => {
    it('returns a hex string', () => {
      const sig = service.signPayload('hello', 'secret');
      expect(typeof sig).toBe('string');
      expect(sig).toMatch(/^[0-9a-f]+$/);
    });

    it('produces the same signature for the same inputs', () => {
      const sig1 = service.signPayload('payload', 'secret');
      const sig2 = service.signPayload('payload', 'secret');
      expect(sig1).toBe(sig2);
    });

    it('produces different signatures for different payloads', () => {
      const sig1 = service.signPayload('payload-a', 'secret');
      const sig2 = service.signPayload('payload-b', 'secret');
      expect(sig1).not.toBe(sig2);
    });

    it('produces different signatures for different secrets', () => {
      const sig1 = service.signPayload('payload', 'secret-a');
      const sig2 = service.signPayload('payload', 'secret-b');
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verifySignature()', () => {
    it('returns true for a valid signature', () => {
      const payload = 'test-payload';
      const secret = 'my-secret';
      const sig = service.signPayload(payload, secret);

      expect(service.verifySignature(payload, sig, secret)).toBe(true);
    });

    it('returns false for a tampered payload', () => {
      const secret = 'my-secret';
      const sig = service.signPayload('original', secret);

      expect(service.verifySignature('tampered', sig, secret)).toBe(false);
    });

    it('returns false for a wrong secret', () => {
      const payload = 'test-payload';
      const sig = service.signPayload(payload, 'correct-secret');

      expect(service.verifySignature(payload, sig, 'wrong-secret')).toBe(false);
    });

    it('returns false for an invalid signature string', () => {
      expect(service.verifySignature('payload', 'not-valid-hex!!', 'secret')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // triggerEvent()
  // -------------------------------------------------------------------------

  describe('triggerEvent()', () => {
    it('sends POST requests to all active webhooks subscribed to the event', async () => {
      const rows = [
        makeDbRow({ id: 'wh-1', url: 'https://a.com/hook' }),
        makeDbRow({ id: 'wh-2', url: 'https://b.com/hook' }),
      ];
      mockQuery.mockResolvedValueOnce({ rows });
      mockAxiosPost.mockResolvedValue({ status: 200 });

      await service.triggerEvent('client_created', { clientId: 'c-1' });

      expect(mockAxiosPost).toHaveBeenCalledTimes(2);
      const [url, body, config] = mockAxiosPost.mock.calls[0];
      expect(url).toBe('https://a.com/hook');
      expect(config.headers['Content-Type']).toBe('application/json');
      expect(config.headers['X-Webhook-Signature']).toMatch(/^sha256=/);
      expect(config.headers['X-Webhook-Event']).toBe('client_created');

      const parsed = JSON.parse(body);
      expect(parsed.event).toBe('client_created');
      expect(parsed.data).toEqual({ clientId: 'c-1' });
      expect(parsed.timestamp).toBeDefined();
    });

    it('does nothing when no webhooks are subscribed to the event', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.triggerEvent('lead_converted', {});

      expect(mockAxiosPost).not.toHaveBeenCalled();
    });

    it('continues delivering to other webhooks when one fails', async () => {
      const rows = [
        makeDbRow({ id: 'wh-1', url: 'https://a.com/hook' }),
        makeDbRow({ id: 'wh-2', url: 'https://b.com/hook' }),
      ];
      mockQuery.mockResolvedValueOnce({ rows });
      mockAxiosPost
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce({ status: 200 });

      // Should not throw even if one delivery fails
      await expect(service.triggerEvent('payment_completed', {})).resolves.toBeUndefined();
      expect(mockAxiosPost).toHaveBeenCalledTimes(2);
    });

    it('includes a valid HMAC-SHA256 signature in the header', async () => {
      const secret = 'webhook-secret';
      mockQuery.mockResolvedValueOnce({ rows: [makeDbRow({ secret })] });
      mockAxiosPost.mockResolvedValue({ status: 200 });

      await service.triggerEvent('contract_generated', { contractId: 'ct-1' });

      const [, body, config] = mockAxiosPost.mock.calls[0];
      const headerSig = config.headers['X-Webhook-Signature'].replace('sha256=', '');
      const expectedSig = service.signPayload(body, secret);
      expect(headerSig).toBe(expectedSig);
    });

    it('queries only active webhooks matching the event type', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.triggerEvent('project_status_changed', {});

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('active = TRUE');
      expect(params[0]).toBe('project_status_changed');
    });
  });
});
