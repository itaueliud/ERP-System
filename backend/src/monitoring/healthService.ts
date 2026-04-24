export type MetricType =
  | 'cpu_usage'
  | 'memory_usage'
  | 'disk_usage'
  | 'db_connections'
  | 'api_response_time'
  | 'error_rate';

export type HealthStatus = 'healthy' | 'warning' | 'critical';

export interface HealthMetric {
  type: MetricType;
  value: number;
  unit: string;
  timestamp: Date;
  status: HealthStatus;
}

export interface SystemHealth {
  metrics: HealthMetric[];
  overallStatus: HealthStatus;
  collectedAt: Date;
  uptimeSeconds: number;
}

export const ALERT_THRESHOLDS: Record<MetricType, { warning: number; critical: number }> = {
  cpu_usage: { warning: 70, critical: 80 },
  memory_usage: { warning: 75, critical: 85 },
  disk_usage: { warning: 80, critical: 90 },
  db_connections: { warning: 80, critical: 95 },
  api_response_time: { warning: 1000, critical: 2000 },
  error_rate: { warning: 2, critical: 5 },
};

export class HealthService {
  evaluateMetricStatus(type: MetricType, value: number): HealthStatus {
    const thresholds = ALERT_THRESHOLDS[type];
    if (value >= thresholds.critical) return 'critical';
    if (value >= thresholds.warning) return 'warning';
    return 'healthy';
  }

  createMetric(type: MetricType, value: number, unit: string): HealthMetric {
    return {
      type,
      value,
      unit,
      timestamp: new Date(),
      status: this.evaluateMetricStatus(type, value),
    };
  }

  evaluateSystemHealth(metrics: HealthMetric[], uptimeSeconds: number): SystemHealth {
    let overallStatus: HealthStatus = 'healthy';
    for (const metric of metrics) {
      if (metric.status === 'critical') {
        overallStatus = 'critical';
        break;
      }
      if (metric.status === 'warning') {
        overallStatus = 'warning';
      }
    }

    return {
      metrics,
      overallStatus,
      collectedAt: new Date(),
      uptimeSeconds,
    };
  }

  collectMockMetrics(): HealthMetric[] {
    return [
      this.createMetric('cpu_usage', 45, '%'),
      this.createMetric('memory_usage', 60, '%'),
      this.createMetric('disk_usage', 55, '%'),
      this.createMetric('db_connections', 30, '%'),
      this.createMetric('api_response_time', 250, 'ms'),
      this.createMetric('error_rate', 0.5, '%'),
    ];
  }

  isHealthy(health: SystemHealth): boolean {
    return health.overallStatus === 'healthy';
  }
}
