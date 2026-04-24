import { HealthCheckService, HealthCheckResult } from './healthCheckService';

describe('HealthCheckService', () => {
  let service: HealthCheckService;

  beforeEach(() => {
    service = new HealthCheckService();
  });

  describe('runHealthCheck', () => {
    it('returns pass result when check function returns true', async () => {
      const result = await service.runHealthCheck(async () => true);
      expect(result.status).toBe('pass');
      expect(result.checkId).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('returns fail result when check function returns false', async () => {
      const result = await service.runHealthCheck(async () => false);
      expect(result.status).toBe('fail');
    });

    it('returns fail result when check function throws', async () => {
      const result = await service.runHealthCheck(async () => {
        throw new Error('connection refused');
      });
      expect(result.status).toBe('fail');
      expect(result.details).toContain('connection refused');
    });
  });

  describe('calculateUptimePercentage', () => {
    const makeRecord = (status: 'pass' | 'fail', daysAgo = 0): HealthCheckResult => {
      const ts = new Date();
      ts.setDate(ts.getDate() - daysAgo);
      return { checkId: 'x', timestamp: ts, status, responseTimeMs: 10, details: '' };
    };

    it('returns 100 when all checks pass', () => {
      const records = [makeRecord('pass'), makeRecord('pass'), makeRecord('pass')];
      expect(service.calculateUptimePercentage(records, 30)).toBe(100);
    });

    it('returns 0 when all checks fail', () => {
      const records = [makeRecord('fail'), makeRecord('fail')];
      expect(service.calculateUptimePercentage(records, 30)).toBe(0);
    });

    it('returns correct percentage for mixed results', () => {
      const records = [makeRecord('pass'), makeRecord('pass'), makeRecord('fail')];
      expect(service.calculateUptimePercentage(records, 30)).toBeCloseTo(66.67, 1);
    });

    it('returns 100 when no records exist', () => {
      expect(service.calculateUptimePercentage([], 30)).toBe(100);
    });

    it('excludes records outside the window', () => {
      const records = [
        makeRecord('pass', 1),
        makeRecord('fail', 40), // outside 30-day window
      ];
      expect(service.calculateUptimePercentage(records, 30)).toBe(100);
    });
  });

  describe('getUptimeRecordsByDay', () => {
    it('groups records correctly by day', () => {
      const day1 = new Date('2024-01-01T10:00:00Z');
      const day2 = new Date('2024-01-02T10:00:00Z');
      const records: HealthCheckResult[] = [
        { checkId: '1', timestamp: day1, status: 'pass', responseTimeMs: 10, details: '' },
        { checkId: '2', timestamp: new Date('2024-01-01T14:00:00Z'), status: 'fail', responseTimeMs: 10, details: '' },
        { checkId: '3', timestamp: day2, status: 'pass', responseTimeMs: 10, details: '' },
      ];

      const uptimeRecords = service.getUptimeRecordsByDay(records);
      expect(uptimeRecords).toHaveLength(2);

      const jan1 = uptimeRecords.find((r) => r.date.toISOString().startsWith('2024-01-01'));
      expect(jan1).toBeDefined();
      expect(jan1!.totalChecks).toBe(2);
      expect(jan1!.passedChecks).toBe(1);
      expect(jan1!.uptimePercentage).toBe(50);

      const jan2 = uptimeRecords.find((r) => r.date.toISOString().startsWith('2024-01-02'));
      expect(jan2).toBeDefined();
      expect(jan2!.totalChecks).toBe(1);
      expect(jan2!.passedChecks).toBe(1);
      expect(jan2!.uptimePercentage).toBe(100);
    });

    it('returns empty array for no records', () => {
      expect(service.getUptimeRecordsByDay([])).toEqual([]);
    });
  });

  describe('buildWebhookPayload', () => {
    it('creates correct payload structure', () => {
      const details = { checkId: 'abc', metric: 'cpu' };
      const payload = service.buildWebhookPayload('health_check', 'pass', details);

      expect(payload.event).toBe('health_check');
      expect(payload.status).toBe('pass');
      expect(payload.details).toEqual(details);
      expect(payload.timestamp).toBeInstanceOf(Date);
    });

    it('supports all event types', () => {
      expect(service.buildWebhookPayload('alert_triggered', 'fail', {}).event).toBe('alert_triggered');
      expect(service.buildWebhookPayload('system_recovered', 'pass', {}).event).toBe('system_recovered');
    });
  });

  describe('sendWebhook', () => {
    it('returns success for valid HTTP URL', async () => {
      const payload = service.buildWebhookPayload('health_check', 'pass', {});
      const result = await service.sendWebhook('https://example.com/webhook', payload);
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    it('returns failure for invalid URL', async () => {
      const payload = service.buildWebhookPayload('health_check', 'pass', {});
      const result = await service.sendWebhook('not-a-url', payload);
      expect(result.success).toBe(false);
    });

    it('returns failure for empty URL', async () => {
      const payload = service.buildWebhookPayload('health_check', 'pass', {});
      const result = await service.sendWebhook('', payload);
      expect(result.success).toBe(false);
    });
  });
});
