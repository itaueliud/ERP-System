/**
 * Tests for WebhookDeliveryService
 * Requirements: 45.7-45.10
 */

import { WebhookDeliveryService } from './webhookDeliveryService';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('../database/connection', () => ({
  db: { query: jest.fn() },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('axios');

jest.mock('./webhookService', () => ({
  webhookService: {
    signPayload: jest.fn().mockReturnValue('abc123signature'),
  },
}));

jest.mock('../utils/retryHandler', () => ({
  withRetry: jest.fn(async (fn: () => Promise<any>) => fn()),
}));

import { db } from '../database/connection';
import axios from 'axios';
import { withRetry } from '../utils/retryHandler';

const mockDb = db as jest.Mocked<typeof db>;
const mockAxios = axios as jest.Mocked<typeof axios>;
const mockWithRetry = withRetry as jest.MockedFunction<typeof withRetry>;

// ============================================================================
// Helpers
// ============================================================================

function makeService() {
  return new WebhookDeliveryService();
}

const activeWebhookRow = {
  id: 'wh-1',
  url: 'https://example.com/hook',
  secret: 'secret123',
  active: true,
};

// ============================================================================
// deliver
// ============================================================================

describe('WebhookDeliveryService.deliver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default withRetry: just call fn
    mockWithRetry.mockImplementation(async (fn: () => Promise<any>) => fn());
  });

  it('returns success=false when webhook not found', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const result = await makeService().deliver('nonexistent', 'client_created', {});

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
    expect(result.attemptCount).toBe(0);
  });

  it('returns success=false when webhook is disabled', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [{ ...activeWebhookRow, active: false }],
      rowCount: 1,
    } as any);

    const result = await makeService().deliver('wh-1', 'client_created', {});

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/disabled/i);
  });

  it('delivers successfully and logs the attempt', async () => {
    // SELECT webhook, INSERT log
    mockDb.query
      .mockResolvedValueOnce({ rows: [activeWebhookRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    (mockAxios.post as jest.Mock).mockResolvedValueOnce({ status: 200, data: 'ok' });

    const result = await makeService().deliver('wh-1', 'payment_completed', { amount: 100 });

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.attemptCount).toBeGreaterThanOrEqual(1);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO webhook_delivery_logs'),
      expect.arrayContaining(['wh-1', 'payment_completed', 200, true])
    );
  });

  it('returns failure result when delivery throws', async () => {
    // SELECT webhook, INSERT log, SELECT consecutive failures
    mockDb.query
      .mockResolvedValueOnce({ rows: [activeWebhookRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ success: false }, { success: false }], rowCount: 2 } as any);

    const networkError = new Error('ECONNREFUSED');
    (networkError as any).code = 'ECONNREFUSED';

    mockWithRetry.mockImplementationOnce(async (fn: () => Promise<any>) => {
      await fn().catch(() => {});
      throw networkError;
    });
    (mockAxios.post as jest.Mock).mockRejectedValueOnce(networkError);

    const result = await makeService().deliver('wh-1', 'client_created', {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('disables webhook after 10 consecutive failures', async () => {
    // SELECT webhook, INSERT log, SELECT consecutive failures (10), UPDATE disable
    mockDb.query
      .mockResolvedValueOnce({ rows: [activeWebhookRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
      .mockResolvedValueOnce({
        rows: Array.from({ length: 10 }, () => ({ success: false })),
        rowCount: 10,
      } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    mockWithRetry.mockImplementationOnce(async (fn: () => Promise<any>) => {
      await fn().catch(() => {});
      throw new Error('timeout');
    });
    (mockAxios.post as jest.Mock).mockRejectedValueOnce(new Error('timeout'));

    const result = await makeService().deliver('wh-1', 'lead_converted', {});

    expect(result.success).toBe(false);

    const updateCall = (mockDb.query as jest.Mock).mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('active = FALSE')
    );
    expect(updateCall).toBeDefined();
  });
});

// ============================================================================
// testWebhook
// ============================================================================

describe('WebhookDeliveryService.testWebhook', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns success=false when webhook not found', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const result = await makeService().testWebhook('nonexistent');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('sends test payload and returns success on 200', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [activeWebhookRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    (mockAxios.post as jest.Mock).mockResolvedValueOnce({ status: 200, data: { received: true } });

    const result = await makeService().testWebhook('wh-1');

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.attemptCount).toBe(1);

    const logCall = (mockDb.query as jest.Mock).mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO webhook_delivery_logs')
    );
    expect(logCall).toBeDefined();
    expect(logCall[1][1]).toBe('test');
  });

  it('returns success=false when endpoint is unreachable', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [activeWebhookRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    (mockAxios.post as jest.Mock).mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

    const result = await makeService().testWebhook('wh-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
  });
});

// ============================================================================
// getDeliveryLogs
// ============================================================================

describe('WebhookDeliveryService.getDeliveryLogs', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns empty array when no logs exist', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const logs = await makeService().getDeliveryLogs('wh-1');

    expect(logs).toEqual([]);
  });

  it('returns mapped delivery logs', async () => {
    const now = new Date();
    mockDb.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'log-1',
          webhook_id: 'wh-1',
          event_type: 'client_created',
          status_code: 200,
          success: true,
          error: null,
          attempt_count: 1,
          created_at: now,
        },
        {
          id: 'log-2',
          webhook_id: 'wh-1',
          event_type: 'payment_completed',
          status_code: 500,
          success: false,
          error: 'Internal Server Error',
          attempt_count: 3,
          created_at: now,
        },
      ],
      rowCount: 2,
    } as any);

    const logs = await makeService().getDeliveryLogs('wh-1');

    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      id: 'log-1',
      webhookId: 'wh-1',
      eventType: 'client_created',
      statusCode: 200,
      success: true,
      attemptCount: 1,
    });
    expect(logs[1]).toMatchObject({
      id: 'log-2',
      success: false,
      error: 'Internal Server Error',
      attemptCount: 3,
    });
  });

  it('respects the limit parameter', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    await makeService().getDeliveryLogs('wh-1', 10);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT $2'),
      ['wh-1', 10]
    );
  });
});

// ============================================================================
// getConsecutiveFailureCount
// ============================================================================

describe('WebhookDeliveryService.getConsecutiveFailureCount', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 0 when no logs exist', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const count = await makeService().getConsecutiveFailureCount('wh-1');

    expect(count).toBe(0);
  });

  it('counts consecutive failures from most recent', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [
        { success: false },
        { success: false },
        { success: false },
        { success: true },
        { success: false },
      ],
      rowCount: 5,
    } as any);

    const count = await makeService().getConsecutiveFailureCount('wh-1');

    expect(count).toBe(3); // stops at the first success
  });

  it('returns full count when all recent logs are failures', async () => {
    const rows = Array.from({ length: 5 }, () => ({ success: false }));
    mockDb.query.mockResolvedValueOnce({ rows, rowCount: 5 } as any);

    const count = await makeService().getConsecutiveFailureCount('wh-1');

    expect(count).toBe(5);
  });

  it('returns 0 when most recent log is a success', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [{ success: true }, { success: false }],
      rowCount: 2,
    } as any);

    const count = await makeService().getConsecutiveFailureCount('wh-1');

    expect(count).toBe(0);
  });
});

// ============================================================================
// disableWebhook
// ============================================================================

describe('WebhookDeliveryService.disableWebhook', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sets active=false on the webhook', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    await makeService().disableWebhook('wh-1', 'Too many failures');

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('active = FALSE'),
      ['wh-1']
    );
  });
});
