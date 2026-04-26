import Bull from 'bull';
import { db } from '../database/connection';
import logger from '../utils/logger';
import { auditService } from '../audit/auditService';
import { csvParser } from './csvParser';

// ============================================================================
// Types
// ============================================================================

export type EntityType = 'users' | 'clients' | 'properties';
export type ImportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ImportError {
  row: number;
  field?: string;
  message: string;
}

export interface ImportJob {
  id: string;
  entityType: EntityType;
  status: ImportStatus;
  totalRecords: number;
  processedRecords: number;
  successCount: number;
  failedCount: number;
  errors: ImportError[];
  requestedBy: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface ValidationResult {
  valid: boolean;
  errors: ImportError[];
  rowCount: number;
}

// ============================================================================
// Required headers per entity type
// ============================================================================

const REQUIRED_HEADERS: Record<EntityType, string[]> = {
  users: ['email', 'first_name', 'last_name', 'role'],
  clients: ['name', 'email', 'phone'],
  properties: ['title', 'address', 'price', 'type'],
};

// ============================================================================
// Bull Queue
// ============================================================================

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const importQueue = new Bull<{ jobId: string }>('bulk-imports', redisUrl);

importQueue.process(async (job) => {
  const { jobId } = job.data;
  logger.info('Processing import job', { jobId });
  const { bulkImportService } = await import('./bulkImportService');
  await bulkImportService.processImport(jobId);
});

importQueue.on('completed', (job) => {
  logger.info('Import job completed', { jobId: job.data.jobId });
});

importQueue.on('failed', (job, err) => {
  logger.error('Import job failed', { jobId: job.data.jobId, error: err.message });
});

// ============================================================================
// BulkImportService
// Requirements: 25.1-25.7
// ============================================================================

export class BulkImportService {
  /**
   * Validate CSV rows against required headers and field rules for the entity type.
   * Requirements: 25.2
   */
  validateImport(
    entityType: EntityType,
    rows: Record<string, any>[],
    headers: string[]
  ): ValidationResult {
    const errors: ImportError[] = [];
    const required = REQUIRED_HEADERS[entityType];

    // Check that all required headers are present
    const missingHeaders = required.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      errors.push({
        row: 0,
        message: `Missing required columns: ${missingHeaders.join(', ')}`,
      });
      return { valid: false, errors, rowCount: rows.length };
    }

    // Validate each row
    rows.forEach((row, index) => {
      const rowNum = index + 2; // 1-based + header row

      for (const field of required) {
        const value = row[field];
        if (value === undefined || value === null || String(value).trim() === '') {
          errors.push({ row: rowNum, field, message: `Required field "${field}" is empty` });
        }
      }

      // Entity-specific validation
      if (entityType === 'users' || entityType === 'clients') {
        const email = row['email'];
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
          errors.push({ row: rowNum, field: 'email', message: `Invalid email address: ${email}` });
        }
      }

      if (entityType === 'properties') {
        const price = row['price'];
        if (price !== undefined && price !== '' && isNaN(Number(price))) {
          errors.push({ row: rowNum, field: 'price', message: `Price must be a number: ${price}` });
        }
      }
    });

    return { valid: errors.length === 0, errors, rowCount: rows.length };
  }

  /**
   * Parse CSV content, validate it, create an ImportJob record, and queue async processing.
   * Requirements: 25.1, 25.3, 25.5
   */
  async startImport(
    entityType: EntityType,
    csvContent: string,
    requestedBy: string
  ): Promise<ImportJob> {
    // Parse CSV
    const parsed = csvParser.parse(csvContent);

    if (parsed.errors.length > 0) {
      logger.warn('CSV parse errors during import start', { entityType, errors: parsed.errors });
    }

    // Validate
    const validation = this.validateImport(entityType, parsed.rows, parsed.headers);

    // Create job record
    const result = await db.query<any>(
      `INSERT INTO import_jobs
         (entity_type, status, total_records, processed_records, success_count, failed_count, errors, requested_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        entityType,
        validation.valid ? 'PENDING' : 'FAILED',
        parsed.rows.length,
        0,
        0,
        validation.valid ? 0 : parsed.rows.length,
        JSON.stringify(validation.errors),
        requestedBy,
      ]
    );

    const job = this.mapFromDb(result.rows[0]);

    // Only queue if validation passed
    if (validation.valid) {
      // Store CSV content in job metadata via a separate update so processImport can retrieve it
      await db.query(
        `UPDATE import_jobs SET errors = $1 WHERE id = $2`,
        [JSON.stringify({ _csvContent: csvContent, validationErrors: [] }), job.id]
      );

      await importQueue.add({ jobId: job.id });
      logger.info('Import job queued', { jobId: job.id, entityType, totalRecords: job.totalRecords });
    } else {
      logger.warn('Import job failed validation', { jobId: job.id, entityType, errors: validation.errors });
    }

    await auditService.log({
      userId: requestedBy,
      action: 'EXECUTE',
      resourceType: 'import_job',
      resourceId: job.id,
      ipAddress: '0.0.0.0',
      result: validation.valid ? 'SUCCESS' : 'FAILURE',
      metadata: { entityType, totalRecords: job.totalRecords, validationErrors: validation.errors.length },
    });

    return job;
  }

  /**
   * Process an import job: read CSV, insert records, update progress.
   * Requirements: 25.3, 25.4, 25.6, 25.7
   */
  async processImport(jobId: string): Promise<void> {
    // Mark as PROCESSING
    await db.query(
      `UPDATE import_jobs SET status = 'PROCESSING' WHERE id = $1`,
      [jobId]
    );

    const jobRow = await db.query<any>(`SELECT * FROM import_jobs WHERE id = $1`, [jobId]);
    if (jobRow.rows.length === 0) {
      logger.error('Import job not found', { jobId });
      return;
    }

    const jobData = jobRow.rows[0];
    const entityType: EntityType = jobData.entity_type;

    // Retrieve stored CSV content
    let csvContent: string;
    try {
      const stored = JSON.parse(jobData.errors);
      csvContent = stored._csvContent;
    } catch {
      await this.failJob(jobId, [{ row: 0, message: 'Failed to retrieve CSV content for processing' }]);
      return;
    }

    const parsed = csvParser.parse(csvContent);
    const rows = parsed.rows;
    const errors: ImportError[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        await this.insertRecord(entityType, row);
        successCount++;
      } catch (err: any) {
        failedCount++;
        errors.push({ row: rowNum, message: err.message ?? 'Insert failed' });
        logger.warn('Import row failed', { jobId, rowNum, error: err.message });
      }

      // Update progress every 10 records or on last record
      if ((i + 1) % 10 === 0 || i === rows.length - 1) {
        await db.query(
          `UPDATE import_jobs
           SET processed_records = $1, success_count = $2, failed_count = $3, errors = $4
           WHERE id = $5`,
          [i + 1, successCount, failedCount, JSON.stringify(errors), jobId]
        );
      }
    }

    // Mark completed
    await db.query(
      `UPDATE import_jobs
       SET status = 'COMPLETED', processed_records = $1, success_count = $2,
           failed_count = $3, errors = $4, completed_at = NOW()
       WHERE id = $5`,
      [rows.length, successCount, failedCount, JSON.stringify(errors), jobId]
    );

    logger.info('Import job completed', { jobId, successCount, failedCount });
  }

  /**
   * Return the current status and progress of an import job.
   * Requirements: 25.4
   */
  async getImportStatus(jobId: string): Promise<ImportJob | null> {
    const result = await db.query<any>(`SELECT * FROM import_jobs WHERE id = $1`, [jobId]);
    if (result.rows.length === 0) return null;
    return this.mapFromDb(result.rows[0]);
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private async insertRecord(entityType: EntityType, row: Record<string, any>): Promise<void> {
    switch (entityType) {
      case 'users':
        await db.query(
          `INSERT INTO users (email, first_name, last_name, role, status, created_at)
           VALUES ($1, $2, $3, $4, 'active', NOW())
           ON CONFLICT (email) DO NOTHING`,
          [
            String(row['email']).trim().toLowerCase(),
            String(row['first_name']).trim(),
            String(row['last_name']).trim(),
            String(row['role']).trim(),
          ]
        );
        break;

      case 'clients':
        await db.query(
          `INSERT INTO clients (name, email, phone, status, created_at)
           VALUES ($1, $2, $3, 'active', NOW())
           ON CONFLICT (email) DO NOTHING`,
          [
            String(row['name']).trim(),
            String(row['email']).trim().toLowerCase(),
            String(row['phone']).trim(),
          ]
        );
        break;

      case 'properties':
        await db.query(
          `INSERT INTO properties (title, address, price, type, status, created_at)
           VALUES ($1, $2, $3, $4, 'available', NOW())`,
          [
            String(row['title']).trim(),
            String(row['address']).trim(),
            Number(row['price']),
            String(row['type']).trim(),
          ]
        );
        break;

      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  private async failJob(jobId: string, errors: ImportError[]): Promise<void> {
    await db.query(
      `UPDATE import_jobs SET status = 'FAILED', errors = $1, completed_at = NOW() WHERE id = $2`,
      [JSON.stringify(errors), jobId]
    );
  }

  private mapFromDb(row: any): ImportJob {
    let errors: ImportError[] = [];
    try {
      const parsed = typeof row.errors === 'string' ? JSON.parse(row.errors) : row.errors;
      // Strip internal _csvContent storage key
      if (Array.isArray(parsed)) {
        errors = parsed;
      } else if (parsed && Array.isArray(parsed.validationErrors)) {
        errors = parsed.validationErrors;
      }
    } catch {
      errors = [];
    }

    return {
      id: row.id,
      entityType: row.entity_type as EntityType,
      status: row.status as ImportStatus,
      totalRecords: row.total_records,
      processedRecords: row.processed_records,
      successCount: row.success_count,
      failedCount: row.failed_count,
      errors,
      requestedBy: row.requested_by,
      createdAt: row.created_at,
      completedAt: row.completed_at ?? undefined,
    };
  }

  /**
   * Get import job by ID
   */
  async getImportJob(jobId: string): Promise<ImportJob | null> {
    const result = await db.query(`SELECT * FROM import_jobs WHERE id = $1`, [jobId]);
    return result.rows.length > 0 ? this.mapFromDb(result.rows[0]) : null;
  }

  /**
   * Process rows in batches to avoid memory pressure on large imports
   * Requirements: batch processing for bulk operations
   */
  async processBatch<T>(
    items: T[],
    batchSize: number,
    handler: (batch: T[], batchIndex: number) => Promise<void>
  ): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await handler(batch, Math.floor(i / batchSize));
    }
  }
}

export const bulkImportService = new BulkImportService();
export default bulkImportService;
