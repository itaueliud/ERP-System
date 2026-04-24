import { MetricType, HealthMetric } from './healthService';

export type AlertSeverity = 'warning' | 'critical';

export type AlertType =
  | 'cpu_high'
  | 'memory_high'
  | 'disk_high'
  | 'api_slow'
  | 'error_rate_high'
  | 'db_connections_high';

export interface SystemAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  metricValue: number;
  threshold: number;
  triggeredAt: Date;
  resolvedAt?: Date;
  acknowledged: boolean;
}

export interface AlertRule {
  type: AlertType;
  metricType: MetricType;
  threshold: number;
  severity: AlertSeverity;
  message: string;
}

export const ALERT_RULES: AlertRule[] = [
  {
    type: 'cpu_high',
    metricType: 'cpu_usage',
    threshold: 80,
    severity: 'critical',
    message: 'CPU usage exceeded threshold',
  },
  {
    type: 'memory_high',
    metricType: 'memory_usage',
    threshold: 85,
    severity: 'critical',
    message: 'Memory usage exceeded threshold',
  },
  {
    type: 'disk_high',
    metricType: 'disk_usage',
    threshold: 90,
    severity: 'critical',
    message: 'Disk usage exceeded threshold',
  },
  {
    type: 'api_slow',
    metricType: 'api_response_time',
    threshold: 2000,
    severity: 'critical',
    message: 'API response time exceeded threshold',
  },
  {
    type: 'error_rate_high',
    metricType: 'error_rate',
    threshold: 5,
    severity: 'critical',
    message: 'Error rate exceeded threshold',
  },
  {
    type: 'db_connections_high',
    metricType: 'db_connections',
    threshold: 95,
    severity: 'critical',
    message: 'Database connections exceeded threshold',
  },
];

export class AlertService {
  checkAlerts(metrics: HealthMetric[]): SystemAlert[] {
    const alerts: SystemAlert[] = [];

    for (const rule of ALERT_RULES) {
      const metric = metrics.find((m) => m.type === rule.metricType);
      if (metric && metric.value > rule.threshold) {
        alerts.push({
          id: `${rule.type}-${Date.now()}`,
          type: rule.type,
          severity: rule.severity,
          message: `${rule.message}: ${metric.value} (threshold: ${rule.threshold})`,
          metricValue: metric.value,
          threshold: rule.threshold,
          triggeredAt: new Date(),
          acknowledged: false,
        });
      }
    }

    return alerts;
  }

  acknowledgeAlert(alert: SystemAlert): SystemAlert {
    return { ...alert, acknowledged: true };
  }

  resolveAlert(alert: SystemAlert): SystemAlert {
    return { ...alert, resolvedAt: new Date() };
  }

  logAlert(alert: SystemAlert): string {
    const status = alert.resolvedAt ? 'RESOLVED' : 'ACTIVE';
    return `[${alert.severity.toUpperCase()}] ${alert.triggeredAt.toISOString()} | ${alert.type} | ${alert.message} | value=${alert.metricValue} threshold=${alert.threshold} | status=${status}`;
  }

  getActiveAlerts(alerts: SystemAlert[]): SystemAlert[] {
    return alerts.filter((a) => !a.resolvedAt);
  }
}
