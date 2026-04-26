export interface HealthCheckResult {
  checkId: string;
  timestamp: Date;
  status: 'pass' | 'fail';
  responseTimeMs: number;
  details: string;
}

export interface UptimeRecord {
  date: Date;
  totalChecks: number;
  passedChecks: number;
  uptimePercentage: number;
}

export interface WebhookPayload {
  event: 'health_check' | 'alert_triggered' | 'system_recovered';
  timestamp: Date;
  status: string;
  details: object;
}

export class HealthCheckService {
  async runHealthCheck(checkFn: () => Promise<boolean>): Promise<HealthCheckResult> {
    const checkId = `check-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const start = Date.now();
    let status: 'pass' | 'fail' = 'fail';
    let details = '';

    try {
      const result = await checkFn();
      status = result ? 'pass' : 'fail';
      details = result ? 'Health check passed' : 'Health check returned false';
    } catch (err) {
      status = 'fail';
      details = err instanceof Error ? err.message : 'Health check threw an error';
    }

    return {
      checkId,
      timestamp: new Date(),
      status,
      responseTimeMs: Date.now() - start,
      details,
    };
  }

  calculateUptimePercentage(records: HealthCheckResult[], windowDays: number): number {
    if (records.length === 0) return 100;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - windowDays);

    const windowRecords = records.filter((r) => r.timestamp >= cutoff);
    if (windowRecords.length === 0) return 100;

    const passed = windowRecords.filter((r) => r.status === 'pass').length;
    return (passed / windowRecords.length) * 100;
  }

  getUptimeRecordsByDay(records: HealthCheckResult[]): UptimeRecord[] {
    const byDay = new Map<string, HealthCheckResult[]>();

    for (const record of records) {
      const day = record.timestamp.toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(record);
    }

    return Array.from(byDay.entries()).map(([day, dayRecords]) => {
      const passedChecks = dayRecords.filter((r) => r.status === 'pass').length;
      return {
        date: new Date(day),
        totalChecks: dayRecords.length,
        passedChecks,
        uptimePercentage: (passedChecks / dayRecords.length) * 100,
      };
    });
  }

  buildWebhookPayload(
    event: WebhookPayload['event'],
    status: string,
    details: object,
  ): WebhookPayload {
    return {
      event,
      timestamp: new Date(),
      status,
      details,
    };
  }

  async sendWebhook(
    url: string,
    _payload: WebhookPayload,
  ): Promise<{ success: boolean; statusCode?: number }> {
    // Mock implementation - returns success for valid URLs
    if (!url || !url.startsWith('http')) {
      return { success: false };
    }
    return { success: true, statusCode: 200 };
  }
}
