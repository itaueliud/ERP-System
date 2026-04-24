import { HealthService, HealthMetric } from './healthService';

const service = new HealthService();

describe('HealthService.evaluateMetricStatus', () => {
  it('returns healthy below warning threshold', () => {
    expect(service.evaluateMetricStatus('cpu_usage', 50)).toBe('healthy');
  });

  it('returns warning between warning and critical thresholds', () => {
    expect(service.evaluateMetricStatus('cpu_usage', 75)).toBe('warning');
  });

  it('returns critical at or above critical threshold', () => {
    expect(service.evaluateMetricStatus('cpu_usage', 85)).toBe('critical');
  });

  it('returns healthy for memory_usage below warning', () => {
    expect(service.evaluateMetricStatus('memory_usage', 50)).toBe('healthy');
  });

  it('returns warning for api_response_time between thresholds', () => {
    expect(service.evaluateMetricStatus('api_response_time', 1500)).toBe('warning');
  });

  it('returns critical for error_rate at critical threshold', () => {
    expect(service.evaluateMetricStatus('error_rate', 5)).toBe('critical');
  });
});

describe('HealthService.createMetric', () => {
  it('creates metric with correct type, value, unit and evaluated status', () => {
    const metric = service.createMetric('disk_usage', 85, '%');
    expect(metric.type).toBe('disk_usage');
    expect(metric.value).toBe(85);
    expect(metric.unit).toBe('%');
    expect(metric.status).toBe('warning');
    expect(metric.timestamp).toBeInstanceOf(Date);
  });

  it('creates healthy metric when value is below warning threshold', () => {
    const metric = service.createMetric('db_connections', 50, '%');
    expect(metric.status).toBe('healthy');
  });
});

describe('HealthService.evaluateSystemHealth', () => {
  const makeMetric = (status: HealthMetric['status']): HealthMetric => ({
    type: 'cpu_usage',
    value: 0,
    unit: '%',
    timestamp: new Date(),
    status,
  });

  it('returns critical if any metric is critical', () => {
    const metrics = [makeMetric('healthy'), makeMetric('warning'), makeMetric('critical')];
    const health = service.evaluateSystemHealth(metrics, 3600);
    expect(health.overallStatus).toBe('critical');
  });

  it('returns warning if any metric is warning and none are critical', () => {
    const metrics = [makeMetric('healthy'), makeMetric('warning')];
    const health = service.evaluateSystemHealth(metrics, 3600);
    expect(health.overallStatus).toBe('warning');
  });

  it('returns healthy if all metrics are healthy', () => {
    const metrics = [makeMetric('healthy'), makeMetric('healthy')];
    const health = service.evaluateSystemHealth(metrics, 3600);
    expect(health.overallStatus).toBe('healthy');
  });

  it('includes uptimeSeconds and collectedAt in result', () => {
    const health = service.evaluateSystemHealth([], 7200);
    expect(health.uptimeSeconds).toBe(7200);
    expect(health.collectedAt).toBeInstanceOf(Date);
  });
});

describe('HealthService.isHealthy', () => {
  it('returns true when overall status is healthy', () => {
    const health = service.evaluateSystemHealth([], 100);
    expect(service.isHealthy(health)).toBe(true);
  });

  it('returns false when overall status is warning', () => {
    const metric: HealthMetric = {
      type: 'cpu_usage',
      value: 75,
      unit: '%',
      timestamp: new Date(),
      status: 'warning',
    };
    const health = service.evaluateSystemHealth([metric], 100);
    expect(service.isHealthy(health)).toBe(false);
  });

  it('returns false when overall status is critical', () => {
    const metric: HealthMetric = {
      type: 'cpu_usage',
      value: 90,
      unit: '%',
      timestamp: new Date(),
      status: 'critical',
    };
    const health = service.evaluateSystemHealth([metric], 100);
    expect(service.isHealthy(health)).toBe(false);
  });
});
