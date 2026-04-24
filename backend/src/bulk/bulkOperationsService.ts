import ExcelJS from 'exceljs';
import { db } from '../database/connection';
import logger from '../utils/logger';
import { auditService, AuditAction, AuditResult } from '../audit/auditService';
import { csvParser } from './csvParser';
import type { EntityType } from './bulkImportService';

// ============================================================================
// Types
// ============================================================================

export interface BulkResult {
  successCount: number;
  failedCount: number;
  errors: string[];
  totalRequested: number;
}

export interface BulkFilters {
  status?: string;
  assignedUserId?: string;
  startDate?: Date;
  endDate?: Date;
  [key: string]: any;
}

const BULK_LIMIT = 1000;

// ============================================================================
// Column definitions per entity type for export
// ============================================================================

const EXPORT_COLUMNS: Record<EntityType, string[]> = {
  users: ['id', 'email', 'first_name', 'last_name', 'role', 'status', 'created_at'],
  clients: ['id', 'name', 'email', 'phone', 'status', 'created_at'],
  properties: ['id', 'title', 'address', 'price', 'type', 'status', 'created_at'],
};

const TABLE_NAMES: Record<EntityType, string> = {
  users: 'users',
  clients: 'clients',
  properties: 'properties',
};

// ============================================================================
// BulkOperationsService
// Requirements: 25.8-25.12
// ============================================================================

export class BulkOperationsService {
  /**
   * Update the status of multiple records in bulk.
   * Enforces a 1,000-record limit per operation.
   * Requirements: 25.8, 25.11, 25.12
   */
  async bulkUpdateStatus(
    entityType: EntityType,
    ids: string[],
    newStatus: string,
    requestedBy: string
  ): Promise<BulkResult> {
    if (ids.length > BULK_LIMIT) {
      throw new Error(
        `Bulk operation limit exceeded: requested ${ids.length}, maximum allowed is ${BULK_LIMIT}`
      );
    }

    const result: BulkResult = {
      successCount: 0,
      failedCount: 0,
      errors: [],
      totalRequested: ids.length,
    };

    const table = TABLE_NAMES[entityType];

    try {
      const queryResult = await db.query(
        `UPDATE ${table} SET status = $1 WHERE id = ANY($2::uuid[]) RETURNING id`,
        [newStatus, ids]
      );

      result.successCount = queryResult.rowCount ?? 0;
      result.failedCount = ids.length - result.successCount;

      if (result.failedCount > 0) {
        const updatedIds = new Set(queryResult.rows.map((r: any) => r.id));
        const notFound = ids.filter((id) => !updatedIds.has(id));
        result.errors.push(`${result.failedCount} record(s) not found or not updated: ${notFound.slice(0, 10).join(', ')}`);
      }

      logger.info('Bulk status update completed', {
        entityType,
        newStatus,
        requestedBy,
        successCount: result.successCount,
        failedCount: result.failedCount,
      });
    } catch (error: any) {
      result.failedCount = ids.length;
      result.errors.push(`Database error: ${error.message}`);
      logger.error('Bulk status update failed', { entityType, error: error.message });
    }

    await auditService.log({
      userId: requestedBy,
      action: AuditAction.EXECUTE,
      resourceType: entityType,
      ipAddress: '0.0.0.0',
      result: result.failedCount === 0 ? AuditResult.SUCCESS : AuditResult.FAILURE,
      metadata: {
        operation: 'bulkUpdateStatus',
        newStatus,
        totalRequested: result.totalRequested,
        successCount: result.successCount,
        failedCount: result.failedCount,
      },
    });

    return result;
  }

  /**
   * Assign multiple records to a user in bulk.
   * Enforces a 1,000-record limit per operation.
   * Requirements: 25.9, 25.11, 25.12
   */
  async bulkAssign(
    entityType: EntityType,
    ids: string[],
    assignedUserId: string,
    requestedBy: string
  ): Promise<BulkResult> {
    if (ids.length > BULK_LIMIT) {
      throw new Error(
        `Bulk operation limit exceeded: requested ${ids.length}, maximum allowed is ${BULK_LIMIT}`
      );
    }

    const result: BulkResult = {
      successCount: 0,
      failedCount: 0,
      errors: [],
      totalRequested: ids.length,
    };

    const table = TABLE_NAMES[entityType];

    try {
      const queryResult = await db.query(
        `UPDATE ${table} SET assigned_user_id = $1 WHERE id = ANY($2::uuid[]) RETURNING id`,
        [assignedUserId, ids]
      );

      result.successCount = queryResult.rowCount ?? 0;
      result.failedCount = ids.length - result.successCount;

      if (result.failedCount > 0) {
        const updatedIds = new Set(queryResult.rows.map((r: any) => r.id));
        const notFound = ids.filter((id) => !updatedIds.has(id));
        result.errors.push(`${result.failedCount} record(s) not found or not updated: ${notFound.slice(0, 10).join(', ')}`);
      }

      logger.info('Bulk assign completed', {
        entityType,
        assignedUserId,
        requestedBy,
        successCount: result.successCount,
        failedCount: result.failedCount,
      });
    } catch (error: any) {
      result.failedCount = ids.length;
      result.errors.push(`Database error: ${error.message}`);
      logger.error('Bulk assign failed', { entityType, error: error.message });
    }

    await auditService.log({
      userId: requestedBy,
      action: AuditAction.EXECUTE,
      resourceType: entityType,
      ipAddress: '0.0.0.0',
      result: result.failedCount === 0 ? AuditResult.SUCCESS : AuditResult.FAILURE,
      metadata: {
        operation: 'bulkAssign',
        assignedUserId,
        totalRequested: result.totalRequested,
        successCount: result.successCount,
        failedCount: result.failedCount,
      },
    });

    return result;
  }

  /**
   * Export filtered records to CSV format.
   * Requirements: 25.10, 25.12
   */
  async bulkExportCSV(
    entityType: EntityType,
    filters: BulkFilters,
    requestedBy: string
  ): Promise<string> {
    const rows = await this._fetchFilteredRows(entityType, filters);
    const columns = EXPORT_COLUMNS[entityType];
    const csv = csvParser.serialize(rows, columns, { includeHeader: true });

    logger.info('Bulk CSV export completed', { entityType, requestedBy, rowCount: rows.length });

    await auditService.log({
      userId: requestedBy,
      action: AuditAction.EXPORT,
      resourceType: entityType,
      ipAddress: '0.0.0.0',
      result: AuditResult.SUCCESS,
      metadata: { operation: 'bulkExportCSV', rowCount: rows.length, filters },
    });

    return csv;
  }

  /**
   * Export filtered records to Excel (XLSX) format.
   * Requirements: 25.10, 25.12
   */
  async bulkExportExcel(
    entityType: EntityType,
    filters: BulkFilters,
    requestedBy: string
  ): Promise<Buffer> {
    const rows = await this._fetchFilteredRows(entityType, filters);
    const columns = EXPORT_COLUMNS[entityType];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TechSwiftTrix ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(entityType);

    // Header row
    sheet.columns = columns.map((col) => ({
      header: col,
      key: col,
      width: 20,
    }));

    // Data rows
    for (const row of rows) {
      sheet.addRow(row);
    }

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };

    const buffer = await workbook.xlsx.writeBuffer();

    logger.info('Bulk Excel export completed', { entityType, requestedBy, rowCount: rows.length });

    await auditService.log({
      userId: requestedBy,
      action: AuditAction.EXPORT,
      resourceType: entityType,
      ipAddress: '0.0.0.0',
      result: AuditResult.SUCCESS,
      metadata: { operation: 'bulkExportExcel', rowCount: rows.length, filters },
    });

    return Buffer.from(buffer);
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private async _fetchFilteredRows(
    entityType: EntityType,
    filters: BulkFilters
  ): Promise<Record<string, any>[]> {
    const table = TABLE_NAMES[entityType];
    const columns = EXPORT_COLUMNS[entityType];
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(filters.status);
    }

    if (filters.assignedUserId) {
      conditions.push(`assigned_user_id = $${paramIndex++}`);
      values.push(filters.assignedUserId);
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
    const colList = columns.map((c) => `"${c}"`).join(', ');

    const result = await db.query(
      `SELECT ${colList} FROM ${table} ${whereClause} ORDER BY created_at DESC LIMIT ${BULK_LIMIT}`,
      values
    );

    return result.rows;
  }
}

export const bulkOperationsService = new BulkOperationsService();
export default bulkOperationsService;
