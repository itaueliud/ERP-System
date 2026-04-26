/**
 * Unit tests for the Webhook System
 * Covers: webhook registration, payload signing, retry logic, automatic disabling, testing endpoint
 * Requirements: 45.1-45.10
 */

import { WebhookService, WebhookEvent, WEBHOOK_EVENTS } from './webhookService';
import { WebhookDeliveryService } from './webhookDeliveryService';

// ============================================================================
// Mocks
// ============================================================================

const mockQuery = jest.fn();

jest.mock('../database/connection', () => ({
  db: { query: (...args: any[]) => mockQuery(...args) },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockAxiosPost = jest.fn();
jest.mock('axios', () => ({ post: (...args: any[]) => mockAxiosPost(...args) }));

jest.mock('./webhookService', () => {
  const actual = jest.requireActual('./webhookService');
  return {
    ...actual,
    webhookService: {
      signPayload: jest.fn().mockReturnValue('mockedsignature'),
    },
  };
});

// Controllable withRetry mock
const mockWithRetry = jest.fn();
jest.mock('../utils/retryHandler', () => ({
  withRetry: (...args: any[]) => mockWithRetry(...args),
}));

// ============================================================================
// Helpers
// ============================================================================

function makeWebhookRow(overrides: Partial<Record<string, any>> = {}): Record<string, any> {
  return {
    id: 'wh-1',
    url: 'https://example.com/webhook',
    events: ['client_created', 'payment_completed'],
    secret: 'test-secret',
    active: true,
    created_by: 'user-1',
    created_at: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ============================================================================
// 1. Webhook Registration (Requirements 45.1, 45.2, 45.3)
// ============================================================================

describe('Webhook Registration', () => {
  let service: WebhookService;

  beforeEach(() => {
    service = new WebhookService();
    mockQuery.mockReset();
  });

  it('registers a webhook URL and returns the created record (Req 45.2)', async () => {
    const row = makeWebhookRow();
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const webhook = await service.registerWebhook(
      'https://example.com/webhook',
      ['client_created', 'payment_completed'],
      'test-secret',
      'user-1'
    );

    expect(webhook.id).toBe('wh-1');
    expect(webhook.url).toBe('https://example.com/webhook');
    expect(webhook.active).toBe(true);
    expect(webhook.createdBy).toBe('user-1');
    expect(webhook.secret).toBe('test-secret');
  });

  it('persists the webhook to the database with correct parameters (Req 45.1)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeWebhookRow()] });

    await service.registerWebhook(
      'https://example.com/webhook',
      ['client_created'],
      'secret',
      'user-1'
    );

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql.trim().toUpperCase()).toMatch(/^INSERT INTO WEBHOOKS/);
    expect(params[0]).toBe('https://example.com/webhook');
    expect(params[1]).toEqual(['client_created']);
    expect(params[2]).toBe('secret');
    expect(params[3]).toBe('user-1');
  });

  it('supports all 5 required webhook event types (Req 45.3)', () => {
    const requiredEvents: WebhookEvent[] = [
      'client_created',
      'lead_converted',
      'payment_completed',
      'contract_generated',
      'project_status_changed',
    ];

    expect(WEBHOOK_EVENTS).toEqual(expect.arrayContaining(requiredEvents));
    expect(WEBHOOK_EVENTS).toHaveLength(5);
  });

  it('registers a webhook with all supported event types (Req 45.3)', async () => {
    const allEvents: WebhookEvent[] = [
      'client_created',
      'lead_converted',
      'payment_completed',
      'contract_generated',
      'project_status_changed',
    ];
    mockQuery.mockResolvedValueOnce({ rows: [makeWebhookRow({ events: allEvents })] });

    const webhook = await service.registerWebhook(
      'https://example.com/webhook',
      allEvents,
      'secret',
      'user-1'
    );

    expect(webhook.events).toEqual(allEvents);
  });

  it('lists registered webhooks (Req 45.1)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [makeWebhookRow({ id: 'wh-1' }), makeWebhookRow({ id: 'wh-2' })],
    });

    const webhooks = await service.listWebhooks();

    expect(webhooks).toHaveLength(2);
  });

  it('filters webhooks by creator (Req 45.2)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeWebhookRow()] });

    await service.listWebhooks('user-1');

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('WHERE');
    expect(params[0]).toBe('user-1');
  });

  it('deletes a webhook by ID (Req 45.1)', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const deleted = await service.deleteWebhook('wh-1', 'user-1');

    expect(deleted).toBe(true);
  });

  it('returns false when deleting a non-existent webhook (Req 45.1)', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });

    const deleted = await service.deleteWebhook('wh-999', 'user-1');

    expect(deleted).toBe(false);
  });
});

// ============================================================================
// 2. Payload Signing (Requirements 45.5, 45.6)
// ============================================================================

describe('Payload Signing', () => {
  let service: WebhookService;

  beforeEach(() => {
    // Use the real WebhookService for signing tests (not the mocked one)
    const { WebhookService: RealWebhookService } = jest.requireActual('./webhookService');
    service = new RealWebhookService();
  });

  it('generates an HMAC-SHA256 signature as a hex string (Req 45.6)', () => {
    const sig = service.signPayload('{"event":"client_created"}', 'my-secret');

    expect(typeof sig).toBe('string');
    expect(sig).toMatch(/^[0-9a-f]{64}$/); // SHA-256 produces 64 hex chars
  });

  it('produces a deterministic signature for the same inputs (Req 45.6)', () => {
    const payload = '{"event":"payment_completed","data":{}}';
    const secret = 'webhook-secret';

    const sig1 = service.signPayload(payload, secret);
    const sig2 = service.signPayload(payload, secret);

    expect(sig1).toBe(sig2);
  });

  it('produces different signatures for different payloads (Req 45.6)', () => {
    const secret = 'webhook-secret';

    const sig1 = service.signPayload('payload-a', secret);
    const sig2 = service.signPayload('payload-b', secret);

    expect(sig1).not.toBe(sig2);
  });

  it('produces different signatures for different secrets (Req 45.6)', () => {
    const payload = 'same-payload';

    const sig1 = service.signPayload(payload, 'secret-a');
    const sig2 = service.signPayload(payload, 'secret-b');

    expect(sig1).not.toBe(sig2);
  });

  it('verifies a valid HMAC-SHA256 signature (Req 45.6)', () => {
    const payload = '{"event":"lead_converted"}';
    const secret = 'my-secret';
    const sig = service.signPayload(payload, secret);

    expect(service.verifySignature(payload, sig, secret)).toBe(true);
  });

  it('rejects a signature for a tampered payload (Req 45.6)', () => {
    const secret = 'my-secret';
    const sig = service.signPayload('original-payload', secret);

    expect(service.verifySignature('tampered-payload', sig, secret)).toBe(false);
  });

  it('rejects a signature generated with a different secret (Req 45.6)', () => {
    const payload = 'test-payload';
    const sig = service.signPayload(payload, 'correct-secret');

    expect(service.verifySignature(payload, sig, 'wrong-secret')).toBe(false);
  });

  it('rejects a malformed (non-hex) signature string (Req 45.6)', () => {
    const { WebhookService: RealWebhookService } = jest.requireActual('./webhookService');
    const realService = new RealWebhookService();

    expect(realService.verifySignature('payload', 'not-valid-hex!!', 'secret')).toBe(false);
  });

  it('includes sha256= prefixed signature in webhook delivery headers (Req 45.6)', async () => {
    const { WebhookService: RealWebhookService } = jest.requireActual('./webhookService');
    const realService = new RealWebhookService();
    const secret = 'webhook-secret';

    mockQuery.mockResolvedValueOnce({ rows: [makeWebhookRow({ secret })] });
    mockAxiosPost.mockResolvedValue({ status: 200 });

    await realService.triggerEvent('client_created', { clientId: 'c-1' });

    const [, body, config] = mockAxiosPost.mock.calls[0];
    const headerSig = config.headers['X-Webhook-Signature'];
    expect(headerSig).toMatch(/^sha256=/);

    const hexSig = headerSig.replace('sha256=', '');
    const expectedSig = realService.signPayload(body, secret);
    expect(hexSig).toBe(expectedSig);
  });
});

// ============================================================================
// 3. Retry Logic (Requirements 45.7)
// ============================================================================

describe('Retry Logic', () => {
  let service: WebhookDeliveryService;

  beforeEach(() => {
    service = new WebhookDeliveryService();
    mockQuery.mockReset();
    mockAxiosPost.mockReset();
    mockWithRetry.mockReset();
  });

  it('uses withRetry for delivery (Req 45.7)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeWebhookRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    mockWithRetry.mockImplementationOnce(async (fn: () => Promise<any>) => fn());
    mockAxiosPost.mockResolvedValueOnce({ status: 200, data: 'ok' });

    await service.deliver('wh-1', 'client_created', {});

    expect(mockWithRetry).toHaveBeenCalledTimes(1);
  });

  it('passes maxAttempts: 3 to withRetry (Req 45.7)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeWebhookRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    mockWithRetry.mockImplementationOnce(async (fn: () => Promise<any>) => fn());
    mockAxiosPost.mockResolvedValueOnce({ status: 200, data: 'ok' });

    await service.deliver('wh-1', 'payment_completed', {});

    const [, options] = mockWithRetry.mock.calls[0];
    expect(options?.maxAttempts).toBe(3);
  });

  it('records attempt count in the delivery result (Req 45.7)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeWebhookRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    let callCount = 0;
    mockWithRetry.mockImplementationOnce(async (fn: () => Promise<any>) => {
      callCount++;
      return fn();
    });
    mockAxiosPost.mockResolvedValueOnce({ status: 200, data: 'ok' });

    const result = await service.deliver('wh-1', 'lead_converted', {});

    expect(result.attemptCount).toBeGreaterThanOrEqual(1);
  });

  it('returns failure result after all retries are exhausted (Req 45.7)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeWebhookRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ success: false }, { success: false }], rowCount: 2 });

    const networkError = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
    mockWithRetry.mockImplementationOnce(async (fn: () => Promise<any>) => {
      await fn().catch(() => {});
      throw networkError;
    });
    mockAxiosPost.mockRejectedValue(networkError);

    const result = await service.deliver('wh-1', 'contract_generated', {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('logs each delivery attempt (Req 45.8)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeWebhookRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    mockWithRetry.mockImplementationOnce(async (fn: () => Promise<any>) => fn());
    mockAxiosPost.mockResolvedValueOnce({ status: 200, data: 'ok' });

    await service.deliver('wh-1', 'project_status_changed', { status: 'ACTIVE' });

    const logInsertCall = mockQuery.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO webhook_delivery_logs')
    );
    expect(logInsertCall).toBeDefined();
    expect(logInsertCall![1]).toEqual(
      expect.arrayContaining(['wh-1', 'project_status_changed'])
    );
  });
});

// ============================================================================
// 4. Automatic Disabling (Requirements 45.9)
// ============================================================================

describe('Automatic Disabling', () => {
  let service: WebhookDeliveryService;

  beforeEach(() => {
    service = new WebhookDeliveryService();
    mockQuery.mockReset();
    mockWithRetry.mockReset();
    mockAxiosPost.mockReset();
  });

  it('disables webhook after 10 consecutive failures (Req 45.9)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeWebhookRow()], rowCount: 1 }) // SELECT webhook
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })                  // INSERT log
      .mockResolvedValueOnce({                                            // SELECT consecutive failures
        rows: Array.from({ length: 10 }, () => ({ success: false })),
        rowCount: 10,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });                  // UPDATE active=FALSE

    mockWithRetry.mockImplementationOnce(async (fn: () => Promise<any>) => {
      await fn().catch(() => {});
      throw new Error('timeout');
    });
    mockAxiosPost.mockRejectedValue(new Error('timeout'));

    await service.deliver('wh-1', 'client_created', {});

    const disableCall = mockQuery.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('active = FALSE')
    );
    expect(disableCall).toBeDefined();
    expect(disableCall![1]).toEqual(['wh-1']);
  });

  it('does NOT disable webhook with fewer than 10 consecutive failures (Req 45.9)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeWebhookRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: Array.from({ length: 9 }, () => ({ success: false })),
        rowCount: 9,
      });

    mockWithRetry.mockImplementationOnce(async (fn: () => Promise<any>) => {
      await fn().catch(() => {});
      throw new Error('timeout');
    });
    mockAxiosPost.mockRejectedValue(new Error('timeout'));

    await service.deliver('wh-1', 'client_created', {});

    const disableCall = mockQuery.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('active = FALSE')
    );
    expect(disableCall).toBeUndefined();
  });

  it('resets consecutive failure count on a successful delivery (Req 45.9)', async () => {
    // A successful delivery should not trigger disable check
    mockQuery
      .mockResolvedValueOnce({ rows: [makeWebhookRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    mockWithRetry.mockImplementationOnce(async (fn: () => Promise<any>) => fn());
    mockAxiosPost.mockResolvedValueOnce({ status: 200, data: 'ok' });

    const result = await service.deliver('wh-1', 'payment_completed', {});

    expect(result.success).toBe(true);
    // No disable query should have been issued
    const disableCall = mockQuery.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('active = FALSE')
    );
    expect(disableCall).toBeUndefined();
  });

  it('counts consecutive failures correctly — stops at first success (Req 45.9)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { success: false },
        { success: false },
        { success: false },
        { success: true },
        { success: false },
      ],
      rowCount: 5,
    });

    const count = await service.getConsecutiveFailureCount('wh-1');

    expect(count).toBe(3);
  });

  it('returns 0 consecutive failures when most recent delivery succeeded (Req 45.9)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ success: true }, { success: false }, { success: false }],
      rowCount: 3,
    });

    const count = await service.getConsecutiveFailureCount('wh-1');

    expect(count).toBe(0);
  });

  it('disableWebhook sets active=FALSE in the database (Req 45.9)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await service.disableWebhook('wh-1', 'Auto-disabled after 10 consecutive failures');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('active = FALSE'),
      ['wh-1']
    );
  });

  it('skips delivery when webhook is already disabled (Req 45.9)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [makeWebhookRow({ active: false })],
      rowCount: 1,
    });

    const result = await service.deliver('wh-1', 'client_created', {});

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/disabled/i);
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 5. Testing Endpoint (Requirements 45.10)
// ============================================================================

describe('Testing Endpoint', () => {
  let service: WebhookDeliveryService;

  beforeEach(() => {
    service = new WebhookDeliveryService();
    mockQuery.mockReset();
    mockAxiosPost.mockReset();
  });

  it('sends a test payload to the webhook URL (Req 45.10)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeWebhookRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    mockAxiosPost.mockResolvedValueOnce({ status: 200, data: { received: true } });

    const result = await service.testWebhook('wh-1');

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.attemptCount).toBe(1);
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
  });

  it('uses event type "test" in the test payload (Req 45.10)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeWebhookRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    mockAxiosPost.mockResolvedValueOnce({ status: 200, data: 'ok' });

    await service.testWebhook('wh-1');

    const [, body, config] = mockAxiosPost.mock.calls[0];
    const parsed = JSON.parse(body);
    expect(parsed.event).toBe('test');
    expect(config.headers['X-Webhook-Event']).toBe('test');
  });

  it('includes a signed payload in the test request (Req 45.10)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeWebhookRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    mockAxiosPost.mockResolvedValueOnce({ status: 200, data: 'ok' });

    await service.testWebhook('wh-1');

    const [, , config] = mockAxiosPost.mock.calls[0];
    expect(config.headers['X-Webhook-Signature']).toBeDefined();
    expect(config.headers['X-Webhook-Signature']).toMatch(/^sha256=/);
  });

  it('logs the test delivery attempt (Req 45.10)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeWebhookRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    mockAxiosPost.mockResolvedValueOnce({ status: 200, data: 'ok' });

    await service.testWebhook('wh-1');

    const logCall = mockQuery.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO webhook_delivery_logs')
    );
    expect(logCall).toBeDefined();
    expect(logCall![1][1]).toBe('test');
  });

  it('returns failure when the test endpoint is unreachable (Req 45.10)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeWebhookRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    mockAxiosPost.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

    const result = await service.testWebhook('wh-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('returns failure when webhook is not found (Req 45.10)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await service.testWebhook('nonexistent');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  it('does not retry on test delivery failure (Req 45.10)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeWebhookRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    mockAxiosPost.mockRejectedValueOnce(new Error('timeout'));

    const result = await service.testWebhook('wh-1');

    // testWebhook makes exactly 1 attempt (no retry)
    expect(result.attemptCount).toBe(1);
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// 6. Event Triggering (Requirements 45.3, 45.4, 45.5)
// ============================================================================

describe('Event Triggering', () => {
  let service: WebhookService;

  beforeEach(() => {
    const { WebhookService: RealWebhookService } = jest.requireActual('./webhookService');
    service = new RealWebhookService();
    mockQuery.mockReset();
    mockAxiosPost.mockReset();
  });

  it('sends POST to all active webhooks subscribed to the event (Req 45.4)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeWebhookRow({ id: 'wh-1', url: 'https://a.com/hook' }),
        makeWebhookRow({ id: 'wh-2', url: 'https://b.com/hook' }),
      ],
    });
    mockAxiosPost.mockResolvedValue({ status: 200 });

    await service.triggerEvent('client_created', { clientId: 'c-1' });

    expect(mockAxiosPost).toHaveBeenCalledTimes(2);
  });

  it('sends JSON payload with event, timestamp, and data fields (Req 45.5)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeWebhookRow()] });
    mockAxiosPost.mockResolvedValue({ status: 200 });

    await service.triggerEvent('payment_completed', { amount: 500 });

    const [, body] = mockAxiosPost.mock.calls[0];
    const parsed = JSON.parse(body);
    expect(parsed.event).toBe('payment_completed');
    expect(parsed.timestamp).toBeDefined();
    expect(parsed.data).toEqual({ amount: 500 });
  });

  it('only queries active webhooks matching the event type (Req 45.3)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await service.triggerEvent('lead_converted', {});

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('active = TRUE');
    expect(params[0]).toBe('lead_converted');
  });

  it('does nothing when no webhooks are subscribed to the event (Req 45.4)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await service.triggerEvent('contract_generated', {});

    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  it('continues delivering to remaining webhooks when one fails (Req 45.4)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeWebhookRow({ id: 'wh-1', url: 'https://a.com/hook' }),
        makeWebhookRow({ id: 'wh-2', url: 'https://b.com/hook' }),
      ],
    });
    mockAxiosPost
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockResolvedValueOnce({ status: 200 });

    await expect(service.triggerEvent('project_status_changed', {})).resolves.toBeUndefined();
    expect(mockAxiosPost).toHaveBeenCalledTimes(2);
  });
});
