import { AlertService, SystemAlert } from './alertService';
import { HealthMetric } from './healthService';

const service = new AlertService();

const makeMetric = (type: HealthMetric['type'], value: number): HealthMetric => ({
  type,
  value,
  unit: type === 'api_response_time' ? 'ms' : '%',
  timestamp: new Date(),
  status: 'critical',
});

const makeAlert = (overrides: Partial<SystemAlert> = {}): SystemAlert => ({
  id: 'test-1',
  type: 'cpu_high',
  severity: 'critical',
  message: 'CPU usage exceeded threshold: 90 (threshold: 80)',
  metricValue: 90,
  threshold: 80,
  triggeredAt: new Date(),
  acknowledged: false,
  ...overrides,
});

describe('AlertService.checkAlerts', () => {
  it('returns alert when CPU exceeds 80%', () => {
    const alerts = service.checkAlerts([makeMetric('cpu_usage', 85)]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('cpu_high');
    expect(alerts[0].metricValue).toBe(85);
    expect(alerts[0].threshold).toBe(80);
  });

  it('returns alert when memory exceeds 85%', () => {
    const alerts = service.checkAlerts([makeMetric('memory_usage', 90)]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('memory_high');
    expect(alerts[0].metricValue).toBe(90);
    expect(alerts[0].threshold).toBe(85);
  });

  it('returns alert when API response time exceeds 2000ms', () => {
    const alerts = service.checkAlerts([makeMetric('api_response_time', 2500)]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('api_slow');
    expect(alerts[0].metricValue).toBe(2500);
    expect(alerts[0].threshold).toBe(2000);
  });

  it('returns alert when error rate exceeds 5%', () => {
    const alerts = service.checkAlerts([makeMetric('error_rate', 6)]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('error_rate_high');
    expect(alerts[0].metricValue).toBe(6);
    expect(alerts[0].threshold).toBe(5);
  });

  it('returns empty array when all metrics are within thresholds', () => {
    const metrics: HealthMetric[] = [
      makeMetric('cpu_usage', 50),
      makeMetric('memory_usage', 60),
      makeMetric('api_response_time', 500),
      makeMetric('error_rate', 1),
    ];
    const alerts = service.checkAlerts(metrics);
    expect(alerts).toHaveLength(0);
  });

  it('does not alert when metric is exactly at threshold', () => {
    const alerts = service.checkAlerts([makeMetric('cpu_usage', 80)]);
    expect(alerts).toHaveLength(0);
  });
});

describe('AlertService.acknowledgeAlert', () => {
  it('sets acknowledged to true', () => {
    const alert = makeAlert({ acknowledged: false });
    const result = service.acknowledgeAlert(alert);
    expect(result.acknowledged).toBe(true);
  });

  it('does not mutate the original alert', () => {
    const alert = makeAlert({ acknowledged: false });
    service.acknowledgeAlert(alert);
    expect(alert.acknowledged).toBe(false);
  });
});

describe('AlertService.resolveAlert', () => {
  it('sets resolvedAt timestamp', () => {
    const alert = makeAlert();
    const result = service.resolveAlert(alert);
    expect(result.resolvedAt).toBeInstanceOf(Date);
  });

  it('does not mutate the original alert', () => {
    const alert = makeAlert();
    service.resolveAlert(alert);
    expect(alert.resolvedAt).toBeUndefined();
  });
});

describe('AlertService.logAlert', () => {
  it('returns formatted string with metric value and threshold', () => {
    const alert = makeAlert();
    const log = service.logAlert(alert);
    expect(log).toContain('CRITICAL');
    expect(log).toContain('cpu_high');
    expect(log).toContain('value=90');
    expect(log).toContain('threshold=80');
  });

  it('includes ACTIVE status for unresolved alert', () => {
    const alert = makeAlert();
    expect(service.logAlert(alert)).toContain('status=ACTIVE');
  });

  it('includes RESOLVED status for resolved alert', () => {
    const alert = makeAlert({ resolvedAt: new Date() });
    expect(service.logAlert(alert)).toContain('status=RESOLVED');
  });
});

describe('AlertService.getActiveAlerts', () => {
  it('returns only unresolved alerts', () => {
    const active = makeAlert({ id: 'a1' });
    const resolved = makeAlert({ id: 'a2', resolvedAt: new Date() });
    const result = service.getActiveAlerts([active, resolved]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1');
  });

  it('returns empty array when all alerts are resolved', () => {
    const alerts = [makeAlert({ resolvedAt: new Date() }), makeAlert({ resolvedAt: new Date() })];
    expect(service.getActiveAlerts(alerts)).toHaveLength(0);
  });

  it('returns all alerts when none are resolved', () => {
    const alerts = [makeAlert({ id: 'a1' }), makeAlert({ id: 'a2' })];
    expect(service.getActiveAlerts(alerts)).toHaveLength(2);
  });
});
