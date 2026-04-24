import { db } from '../database/connection';
import logger from '../utils/logger';

// ============================================================================
// Types and Enums
// ============================================================================

export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  EXECUTE = 'EXECUTE',
  EXPORT = 'EXPORT',
}

export enum AuditResult {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
}

export interface AuditLogInput {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  ipAddress: string;
  userAgent?: string;
  result: AuditResult | 'SUCCESS' | 'FAILURE';
  metadata?: Record<string, any>;
}

export interface AuditLog extends AuditLogInput {
  id: string;
  createdAt: Date;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  result?: AuditResult | 'SUCCESS' | 'FAILURE';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface PaginatedAuditLogs {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Audit Logging Service
 * Provides immutable audit log storage and querying.
 * Requirements: 15.1-15.13
 */
export class AuditLoggingService {
  /**
   * Log a user action to the audit log (immutable — INSERT only, no UPDATE/DELETE).
   * Requirements: 15.1, 15.2, 15.3
   */
  async log(entry: AuditLogInput): Promise<void> {
    try {
      const query = `
        INSERT INTO audit_logs (
          user_id, action, resource_type, resource_id,
          ip_address, user_agent, result, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;

      await db.query(query, [
        entry.userId,
        entry.action,
        entry.resourceType,
        entry.resourceId ?? null,
        entry.ipAddress,
        entry.userAgent ?? null,
        entry.result,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ]);

      logger.debug('Audit log entry created', {
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        result: entry.result,
      });
    } catch (error) {
      // Log the error but do not throw — audit failures must not break the main flow
      logger.error('Failed to write audit log entry', { error, entry });
    }
  }

  /**
   * Query audit logs with filters.
   * Requirements: 15.9, 15.10
   */
  async query(filters: AuditLogFilters): Promise<PaginatedAuditLogs> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters.userId) {
        conditions.push(`user_id = $${paramIndex++}`);
        values.push(filters.userId);
      }

      if (filters.action) {
        conditions.push(`action = $${paramIndex++}`);
        values.push(filters.action);
      }

      if (filters.resourceType) {
        conditions.push(`resource_type = $${paramIndex++}`);
        values.push(filters.resourceType);
      }

      if (filters.resourceId) {
        conditions.push(`resource_id = $${paramIndex++}`);
        values.push(filters.resourceId);
      }

      if (filters.result) {
        conditions.push(`result = $${paramIndex++}`);
        values.push(filters.result);
      }

      if (filters.startDate) {
        conditions.push(`created_at >= $${paramIndex++}`);
        values.push(filters.startDate);
      }

      if (filters.endDate) {
        conditions.push(`created_at <= $${paramIndex++}`);
        values.push(filters.endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count total matching records
      const countResult = await db.query(
        `SELECT COUNT(*) FROM audit_logs ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Fetch paginated results
      const limit = filters.limit ?? 50;
      const offset = filters.offset ?? 0;

      const dataResult = await db.query(
        `SELECT id, user_id, action, resource_type, resource_id,
                ip_address, user_agent, result, metadata, created_at
         FROM audit_logs
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...values, limit, offset]
      );

      const logs = dataResult.rows.map((row) => this.mapFromDb(row));

      return { logs, total, limit, offset };
    } catch (error) {
      logger.error('Failed to query audit logs', { error, filters });
      throw error;
    }
  }

  /**
   * Get a specific audit log entry by ID.
   * Requirements: 15.9
   */
  async getLogById(id: string): Promise<AuditLog | null> {
    try {
      const result = await db.query(
        `SELECT id, user_id, action, resource_type, resource_id,
                ip_address, user_agent, result, metadata, created_at
         FROM audit_logs
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get audit log by ID', { error, id });
      throw error;
    }
  }

  /**
   * Export audit logs to CSV format.
   * Requirements: 15.11
   */
  async exportToCSV(filters: AuditLogFilters): Promise<string> {
    try {
      // Fetch all matching records (no pagination for export)
      const exportFilters: AuditLogFilters = { ...filters, limit: 100000, offset: 0 };
      const { logs } = await this.query(exportFilters);

      const header = [
        'id',
        'user_id',
        'action',
        'resource_type',
        'resource_id',
        'ip_address',
        'user_agent',
        'result',
        'metadata',
        'created_at',
      ].join(',');

      const rows = logs.map((log) => {
        const fields = [
          this.csvEscape(log.id),
          this.csvEscape(log.userId),
          this.csvEscape(log.action),
          this.csvEscape(log.resourceType),
          this.csvEscape(log.resourceId ?? ''),
          this.csvEscape(log.ipAddress),
          this.csvEscape(log.userAgent ?? ''),
          this.csvEscape(log.result),
          this.csvEscape(log.metadata ? JSON.stringify(log.metadata) : ''),
          this.csvEscape(log.createdAt.toISOString()),
        ];
        return fields.join(',');
      });

      return [header, ...rows].join('\n');
    } catch (error) {
      logger.error('Failed to export audit logs to CSV', { error, filters });
      throw error;
    }
  }

  /**
   * Return the data retention policy for audit logs.
   * Requirements: 15.12
   */
  getRetentionPolicy(): RetentionPolicy {
    return {
      minimumYears: 7,
      description:
        'Audit log entries must be retained for a minimum of 7 years to comply with regulatory requirements.',
    };
  }

  /**
   * Retrieve audit log entries older than the specified number of years.
   * Useful for retention management (e.g., archiving or verifying compliance).
   * Requirements: 15.12
   */
  async getLogsOlderThan(years: number): Promise<AuditLog[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - years);

      const result = await db.query(
        `SELECT id, user_id, action, resource_type, resource_id,
                ip_address, user_agent, result, metadata, created_at
         FROM audit_logs
         WHERE created_at < $1
         ORDER BY created_at ASC`,
        [cutoffDate]
      );

      return result.rows.map((row) => this.mapFromDb(row));
    } catch (error) {
      logger.error('Failed to get audit logs older than years', { error, years });
      throw error;
    }
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private mapFromDb(row: any): AuditLog {
    return {
      id: row.id,
      userId: row.user_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id ?? undefined,
      ipAddress: row.ip_address,
      userAgent: row.user_agent ?? undefined,
      result: row.result as AuditResult,
      metadata: row.metadata ?? undefined,
      createdAt: row.created_at,
    };
  }

  /** Escape a value for CSV output */
  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

export interface RetentionPolicy {
  minimumYears: number;
  description: string;
}

export const auditService = new AuditLoggingService();
export default auditService;
