import { db } from '../database/connection';
import { notificationService } from '../notifications/notificationService';
import { NotificationPriority, NotificationType } from '../notifications/notificationService';
import { AuditLog, AuditResult } from './auditService';
import logger from '../utils/logger';

// ============================================================================
// Types and Enums
// ============================================================================

export enum SecurityAlertType {
  MULTIPLE_FAILED_LOGINS = 'MULTIPLE_FAILED_LOGINS',
  UNUSUAL_ACCESS_HOURS = 'UNUSUAL_ACCESS_HOURS',
  UNAUTHORIZED_ATTEMPTS = 'UNAUTHORIZED_ATTEMPTS',
  LARGE_SERVICE_AMOUNT_CHANGE = 'LARGE_SERVICE_AMOUNT_CHANGE',
  SUSPICIOUS_FINANCIAL_ACCESS = 'SUSPICIOUS_FINANCIAL_ACCESS',
}

export enum SecurityAlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum SecurityAlertStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

export interface SecurityAlert {
  id: string;
  type: SecurityAlertType;
  severity: SecurityAlertSeverity;
  status: SecurityAlertStatus;
  details: Record<string, any>;
  affectedUserId?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface SecurityAlertFilters {
  type?: SecurityAlertType;
  severity?: SecurityAlertSeverity;
  status?: SecurityAlertStatus;
  affectedUserId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface PaginatedSecurityAlerts {
  alerts: SecurityAlert[];
  total: number;
  limit: number;
  offset: number;
}

// Normal working hours: 9 AM – 6 PM (inclusive)
const WORK_HOUR_START = 9;
const WORK_HOUR_END = 18;

// Thresholds
const FAILED_LOGIN_THRESHOLD = 5;
const FAILED_LOGIN_WINDOW_MINUTES = 15;
const UNAUTHORIZED_ATTEMPT_THRESHOLD = 3;
const UNAUTHORIZED_ATTEMPT_WINDOW_MINUTES = 10;
const SERVICE_AMOUNT_CHANGE_THRESHOLD_PCT = 0.2; // 20%

// Sensitive resource types for financial access checks
const FINANCIAL_RESOURCE_TYPES = new Set(['financial_data', 'payments', 'audit_logs']);

// ============================================================================
// FraudDetectionService
// ============================================================================

/**
 * Fraud Detection and Security Alert Service
 * Monitors audit logs for suspicious patterns and generates security alerts.
 * Requirements: 36.1-36.12
 */
export class FraudDetectionService {
  // --------------------------------------------------------------------------
  // Detection methods
  // --------------------------------------------------------------------------

  /**
   * Detect multiple failed login attempts for a user within a time window.
   * Requirement 36.4: Flag multiple failed login attempts from the same IP address.
   * Threshold: 5 failures in 15 minutes (default).
   */
  async checkFailedLogins(
    userId: string,
    windowMinutes: number = FAILED_LOGIN_WINDOW_MINUTES
  ): Promise<boolean> {
    try {
      const result = await db.query(
        `SELECT COUNT(*) AS cnt
         FROM audit_logs
         WHERE user_id = $1
           AND action = 'LOGIN'
           AND result = 'FAILURE'
           AND created_at >= NOW() - INTERVAL '1 minute' * $2`,
        [userId, windowMinutes]
      );
      const count = parseInt(result.rows[0].cnt, 10);
      return count >= FAILED_LOGIN_THRESHOLD;
    } catch (error) {
      logger.error('FraudDetection.checkFailedLogins error', { error, userId });
      return false;
    }
  }

  /**
   * Detect access to a resource outside normal working hours (9 AM – 6 PM).
   * Requirement 36.3: Flag financial data access outside normal working hours.
   *
   * NOTE: Uses server UTC time. Per-user timezone support can be added by
   * passing the user's UTC offset and adjusting `hour` accordingly.
   */
  checkUnusualAccess(resourceType: string): boolean {
    const hour = new Date().getUTCHours();
    const isOutsideHours = hour < WORK_HOUR_START || hour >= WORK_HOUR_END;
    return isOutsideHours && FINANCIAL_RESOURCE_TYPES.has(resourceType);
  }

  /**
   * Detect repeated unauthorized access attempts within a time window.
   * Requirement 36.1: Monitor for suspicious patterns indicating potential fraud.
   * Threshold: 3 unauthorized attempts in 10 minutes (default).
   */
  async checkUnauthorizedAttempts(
    userId: string,
    windowMinutes: number = UNAUTHORIZED_ATTEMPT_WINDOW_MINUTES
  ): Promise<boolean> {
    try {
      const result = await db.query(
        `SELECT COUNT(*) AS cnt
         FROM audit_logs
         WHERE user_id = $1
           AND result = 'FAILURE'
           AND action != 'LOGIN'
           AND created_at >= NOW() - INTERVAL '1 minute' * $2`,
        [userId, windowMinutes]
      );
      const count = parseInt(result.rows[0].cnt, 10);
      return count >= UNAUTHORIZED_ATTEMPT_THRESHOLD;
    } catch (error) {
      logger.error('FraudDetection.checkUnauthorizedAttempts error', { error, userId });
      return false;
    }
  }

  /**
   * Flag service amount changes exceeding 20% without CEO approval.
   * Requirement 36.2: Flag transactions where Service_Amount changes exceed 20% without CEO approval.
   */
  checkServiceAmountChange(
    _projectId: string,
    originalAmount: number,
    newAmount: number
  ): boolean {
    if (originalAmount <= 0) return false;
    const changePct = Math.abs(newAmount - originalAmount) / originalAmount;
    return changePct > SERVICE_AMOUNT_CHANGE_THRESHOLD_PCT;
  }

  /**
   * Analyze a single audit log entry for suspicious patterns.
   * Generates security alerts for any detected patterns.
   * Requirement 36.6: Create a security alert if a suspicious pattern is detected.
   *
   * Each check is mutually exclusive to avoid duplicate alerts for the same event:
   *  - Failed LOGIN → check for brute-force
   *  - Successful access to financial resource → SUSPICIOUS_FINANCIAL_ACCESS
   *  - Successful VIEW of non-financial resource outside hours → UNUSUAL_ACCESS_HOURS
   *  - Failed non-LOGIN action → check for repeated unauthorized attempts
   */
  async analyzeAuditLog(logEntry: AuditLog): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];

    try {
      if (logEntry.action === 'LOGIN' && logEntry.result === AuditResult.FAILURE) {
        // Brute-force login detection
        const suspicious = await this.checkFailedLogins(logEntry.userId);
        if (suspicious) {
          alerts.push(await this.generateSecurityAlert(
            SecurityAlertType.MULTIPLE_FAILED_LOGINS,
            {
              userId: logEntry.userId,
              ipAddress: logEntry.ipAddress,
              windowMinutes: FAILED_LOGIN_WINDOW_MINUTES,
              threshold: FAILED_LOGIN_THRESHOLD,
            },
            logEntry.userId
          ));
        }
      } else if (logEntry.result === AuditResult.SUCCESS && FINANCIAL_RESOURCE_TYPES.has(logEntry.resourceType)) {
        // Successful access to a financial resource outside working hours
        if (this.checkUnusualAccess(logEntry.resourceType)) {
          alerts.push(await this.generateSecurityAlert(
            SecurityAlertType.SUSPICIOUS_FINANCIAL_ACCESS,
            {
              userId: logEntry.userId,
              resourceType: logEntry.resourceType,
              resourceId: logEntry.resourceId,
              accessTime: new Date().toISOString(),
            },
            logEntry.userId
          ));
        }
      } else if (logEntry.result === AuditResult.SUCCESS && logEntry.action === 'VIEW' && !FINANCIAL_RESOURCE_TYPES.has(logEntry.resourceType)) {
        // Successful VIEW of a non-financial resource outside working hours
        const hour = new Date().getUTCHours();
        if (hour < WORK_HOUR_START || hour >= WORK_HOUR_END) {
          alerts.push(await this.generateSecurityAlert(
            SecurityAlertType.UNUSUAL_ACCESS_HOURS,
            {
              userId: logEntry.userId,
              resourceType: logEntry.resourceType,
              resourceId: logEntry.resourceId,
              accessTime: new Date().toISOString(),
            },
            logEntry.userId
          ));
        }
      } else if (logEntry.result === AuditResult.FAILURE && logEntry.action !== 'LOGIN') {
        // Repeated unauthorized access attempts
        const suspicious = await this.checkUnauthorizedAttempts(logEntry.userId);
        if (suspicious) {
          alerts.push(await this.generateSecurityAlert(
            SecurityAlertType.UNAUTHORIZED_ATTEMPTS,
            {
              userId: logEntry.userId,
              action: logEntry.action,
              resourceType: logEntry.resourceType,
              windowMinutes: UNAUTHORIZED_ATTEMPT_WINDOW_MINUTES,
              threshold: UNAUTHORIZED_ATTEMPT_THRESHOLD,
            },
            logEntry.userId
          ));
        }
      }
    } catch (error) {
      logger.error('FraudDetection.analyzeAuditLog error', { error, logId: logEntry.id });
    }

    return alerts;
  }

  /**
   * Create and persist a security alert, then route it to CEO and CoS.
   * Requirements: 36.6, 36.7
   */
  async generateSecurityAlert(
    type: SecurityAlertType,
    details: Record<string, any>,
    affectedUserId?: string
  ): Promise<SecurityAlert> {
    const severity = this.severityForType(type);

    const result = await db.query(
      `INSERT INTO security_alerts (type, severity, status, details, affected_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, type, severity, status, details, affected_user_id, resolved_by, resolved_at, created_at`,
      [
        type,
        severity,
        SecurityAlertStatus.OPEN,
        JSON.stringify(details),
        affectedUserId ?? null,
      ]
    );

    const alert = this.mapAlertFromDb(result.rows[0]);

    // Route alert to CEO and CoS (Requirement 36.7)
    await this.routeAlertToExecutives(alert);

    logger.warn('Security alert generated', { alertId: alert.id, type, severity });

    return alert;
  }

  /**
   * Get security alerts with optional filters (for CEO/CoS).
   * Requirement 36.7: Route security alerts to CEO and CoS.
   */
  async getSecurityAlerts(filters: SecurityAlertFilters = {}): Promise<PaginatedSecurityAlerts> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (filters.type) {
        conditions.push(`type = $${idx++}`);
        values.push(filters.type);
      }
      if (filters.severity) {
        conditions.push(`severity = $${idx++}`);
        values.push(filters.severity);
      }
      if (filters.status) {
        conditions.push(`status = $${idx++}`);
        values.push(filters.status);
      }
      if (filters.affectedUserId) {
        conditions.push(`affected_user_id = $${idx++}`);
        values.push(filters.affectedUserId);
      }
      if (filters.startDate) {
        conditions.push(`created_at >= $${idx++}`);
        values.push(filters.startDate);
      }
      if (filters.endDate) {
        conditions.push(`created_at <= $${idx++}`);
        values.push(filters.endDate);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await db.query(
        `SELECT COUNT(*) FROM security_alerts ${where}`,
        values
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const limit = filters.limit ?? 50;
      const offset = filters.offset ?? 0;
      const limitIdx = idx++;
      const offsetIdx = idx++;

      const dataResult = await db.query(
        `SELECT id, type, severity, status, details, affected_user_id, resolved_by, resolved_at, created_at
         FROM security_alerts
         ${where}
         ORDER BY created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...values, limit, offset]
      );

      return {
        alerts: dataResult.rows.map((r) => this.mapAlertFromDb(r)),
        total,
        limit,
        offset,
      };
    } catch (error) {
      logger.error('FraudDetection.getSecurityAlerts error', { error, filters });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private severityForType(type: SecurityAlertType): SecurityAlertSeverity {
    switch (type) {
      case SecurityAlertType.MULTIPLE_FAILED_LOGINS:
        return SecurityAlertSeverity.HIGH;
      case SecurityAlertType.UNUSUAL_ACCESS_HOURS:
        return SecurityAlertSeverity.MEDIUM;
      case SecurityAlertType.UNAUTHORIZED_ATTEMPTS:
        return SecurityAlertSeverity.HIGH;
      case SecurityAlertType.LARGE_SERVICE_AMOUNT_CHANGE:
        return SecurityAlertSeverity.CRITICAL;
      case SecurityAlertType.SUSPICIOUS_FINANCIAL_ACCESS:
        return SecurityAlertSeverity.CRITICAL;
    }
  }

  /**
   * Route a security alert to CEO and CoS via the notification service.
   * Requirement 36.7
   */
  private async routeAlertToExecutives(alert: SecurityAlert): Promise<void> {
    try {
      const executives = await db.query(
        `SELECT u.id
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE r.name IN ('CEO', 'CoS')`
      );

      const title = `Security Alert: ${alert.type.replace(/_/g, ' ')}`;
      const message = `A ${alert.severity} severity security alert has been detected. Type: ${alert.type}`;

      // Send all notifications in parallel — avoid sequential await in loop
      await Promise.allSettled(
        executives.rows.map((row) =>
          notificationService.sendNotification({
            userId: row.id,
            type: NotificationType.SECURITY_ALERT,
            priority: NotificationPriority.HIGH,
            title,
            message,
            data: { alertId: alert.id, alertType: alert.type },
          })
        )
      );
    } catch (error) {
      // Non-fatal — alert is already persisted
      logger.error('FraudDetection.routeAlertToExecutives error', { error, alertId: alert.id });
    }
  }

  private mapAlertFromDb(row: any): SecurityAlert {
    return {
      id: row.id,
      type: row.type as SecurityAlertType,
      severity: row.severity as SecurityAlertSeverity,
      status: row.status as SecurityAlertStatus,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details ?? {},
      affectedUserId: row.affected_user_id ?? undefined,
      resolvedBy: row.resolved_by ?? undefined,
      resolvedAt: row.resolved_at ?? undefined,
      createdAt: row.created_at,
    };
  }
}

export const fraudDetectionService = new FraudDetectionService();
export default fraudDetectionService;
