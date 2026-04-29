import axios from 'axios';
import { db } from '../database/connection';
import logger from '../utils/logger';
import { notificationService, NotificationType, NotificationPriority } from '../notifications/notificationService';

interface HealthCheckResult {
  service: string;
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  timestamp: Date;
  error?: string;
}

interface UptimeAlert {
  service: string;
  status: string;
  message: string;
  timestamp: Date;
}

class UptimeMonitor {
  private checkInterval: NodeJS.Timeout | null = null;
  private services: Map<string, { url: string; method: string; expectedStatus: number }> = new Map();
  private lastStatus: Map<string, 'up' | 'down' | 'degraded'> = new Map();

  constructor() {
    // Register services to monitor
    this.registerService('api', `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/v1/health`, 'GET', 200);
    this.registerService('database', 'internal://database', 'CHECK', 200);
    this.registerService('redis', 'internal://redis', 'CHECK', 200);
  }

  /**
   * Register a service for monitoring
   */
  registerService(name: string, url: string, method: string = 'GET', expectedStatus: number = 200): void {
    this.services.set(name, { url, method, expectedStatus });
    logger.info('Service registered for uptime monitoring', { name, url });
  }

  /**
   * Start monitoring
   */
  start(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      logger.warn('Uptime monitor already running');
      return;
    }

    logger.info('Starting uptime monitor', { intervalMs, serviceCount: this.services.size });

    // Run initial check
    this.runHealthChecks();

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.runHealthChecks();
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Uptime monitor stopped');
    }
  }

  /**
   * Run health checks for all services
   */
  private async runHealthChecks(): Promise<void> {
    const results: HealthCheckResult[] = [];

    for (const [name, config] of this.services) {
      const result = await this.checkService(name, config);
      results.push(result);

      // Store result in database
      await this.storeHealthCheck(result);

      // Check for status changes and send alerts
      await this.checkStatusChange(result);
    }

    logger.info('Health checks completed', {
      total: results.length,
      up: results.filter(r => r.status === 'up').length,
      down: results.filter(r => r.status === 'down').length,
      degraded: results.filter(r => r.status === 'degraded').length,
    });
  }

  /**
   * Check a single service
   */
  private async checkService(
    name: string,
    config: { url: string; method: string; expectedStatus: number }
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Handle internal checks
      if (config.url.startsWith('internal://')) {
        return await this.checkInternalService(name, config.url);
      }

      // HTTP check
      const response = await axios({
        method: config.method as any,
        url: config.url,
        timeout: 10000,
        validateStatus: () => true, // Don't throw on any status
      });

      const responseTime = Date.now() - startTime;
      const status = response.status === config.expectedStatus ? 'up' : 'degraded';

      return {
        service: name,
        status,
        responseTime,
        timestamp: new Date(),
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      return {
        service: name,
        status: 'down',
        responseTime,
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Check internal services (database, redis, etc.)
   */
  private async checkInternalService(name: string, url: string): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      if (url === 'internal://database') {
        await db.query('SELECT 1');
        return {
          service: name,
          status: 'up',
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
        };
      }

      if (url === 'internal://redis') {
        const { redis } = await import('../cache/connection');
        await redis.getClient().ping();
        return {
          service: name,
          status: 'up',
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
        };
      }

      throw new Error(`Unknown internal service: ${url}`);
    } catch (error: any) {
      return {
        service: name,
        status: 'down',
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Store health check result in database
   */
  private async storeHealthCheck(result: HealthCheckResult): Promise<void> {
    try {
      await db.query(
        `INSERT INTO uptime_checks (service, status, response_time_ms, error_message, checked_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [result.service, result.status, result.responseTime, result.error || null, result.timestamp]
      );
    } catch (error) {
      logger.error('Failed to store health check', { error, service: result.service });
    }
  }

  /**
   * Check for status changes and send alerts
   */
  private async checkStatusChange(result: HealthCheckResult): Promise<void> {
    const lastStatus = this.lastStatus.get(result.service);

    if (lastStatus && lastStatus !== result.status) {
      // Status changed - send alert
      await this.sendAlert({
        service: result.service,
        status: result.status,
        message: `Service ${result.service} changed from ${lastStatus} to ${result.status}`,
        timestamp: result.timestamp,
      });
    }

    this.lastStatus.set(result.service, result.status);
  }

  /**
   * Send uptime alert
   */
  private async sendAlert(alert: UptimeAlert): Promise<void> {
    logger.warn('Uptime alert', alert);

    // Get admin users to notify
    try {
      const adminUsers = await db.query(
        `SELECT id FROM users WHERE role IN ('CEO', 'CTO', 'TECH_STAFF')`
      );

      for (const user of adminUsers.rows) {
        await notificationService.sendNotification({
          userId: user.id,
          type: NotificationType.SYSTEM_ALERT,
          priority: alert.status === 'down' ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
          title: `Service ${alert.status}: ${alert.service}`,
          message: alert.message,
        });
      }
    } catch (error) {
      logger.error('Failed to send uptime alert', { error, alert });
    }
  }

  /**
   * Get uptime statistics
   */
  async getUptimeStats(service: string, hours: number = 24): Promise<{
    uptime: number;
    avgResponseTime: number;
    totalChecks: number;
    downtime: number;
  }> {
    try {
      const result = await db.query(
        `SELECT 
           COUNT(*) as total_checks,
           COUNT(*) FILTER (WHERE status = 'up') as up_checks,
           AVG(response_time_ms) as avg_response_time
         FROM uptime_checks
         WHERE service = $1 AND checked_at > NOW() - INTERVAL '${hours} hours'`,
        [service]
      );

      const row = result.rows[0];
      const totalChecks = parseInt(row.total_checks, 10);
      const upChecks = parseInt(row.up_checks, 10);
      const uptime = totalChecks > 0 ? (upChecks / totalChecks) * 100 : 0;

      return {
        uptime,
        avgResponseTime: parseFloat(row.avg_response_time) || 0,
        totalChecks,
        downtime: 100 - uptime,
      };
    } catch (error) {
      logger.error('Failed to get uptime stats', { error, service });
      return { uptime: 0, avgResponseTime: 0, totalChecks: 0, downtime: 100 };
    }
  }
}

// Singleton instance
export const uptimeMonitor = new UptimeMonitor();

// Auto-start monitoring if not in test environment
if (process.env.NODE_ENV !== 'test') {
  uptimeMonitor.start(60000); // Check every minute
}
