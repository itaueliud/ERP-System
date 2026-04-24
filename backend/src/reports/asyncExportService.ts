import sgMail from '@sendgrid/mail';
import { db } from '../database/connection';
import { auditService, AuditAction, AuditResult } from '../audit/auditService';
import { fileStorageService } from '../files/fileService';
import { reportGenerationService, ReportType, ReportFormat, ReportFilters } from './reportGenerationService';
import logger from '../utils/logger';

// ============================================================================
// Constants
// ============================================================================

/** Records threshold above which exports are processed asynchronously (Requirement 40.8) */
export const ASYNC_EXPORT_THRESHOLD = parseInt(
  process.env.ASYNC_EXPORT_THRESHOLD || '10000',
  10
);

/** Export file retention in days (Requirement 40.10) */
export const EXPORT_RETENTION_DAYS = 7;

// ============================================================================
// Types
// ============================================================================

export type ExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ExportJob {
  id: string;
  userId: string;
  reportType: ReportType;
  format: ReportFormat;
  filters: ReportFilters;
  status: ExportStatus;
  fileUrl?: string;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
  expiresAt: Date;
}

export interface RequestExportResult {
  jobId: string;
  async: boolean;
  fileUrl?: string;
  message: string;
}

// ============================================================================
// AsyncExportService
// ============================================================================

/**
 * Asynchronous Export Service
 * Handles large report exports asynchronously via Bull queue.
 * Requirements: 40.6-40.11
 */
export class AsyncExportService {
  /**
   * Request an export. For large datasets (>ASYNC_EXPORT_THRESHOLD records),
   * the job is queued and the caller receives a jobId immediately.
   * For smaller datasets, the export is processed synchronously.
   * Requirements: 40.6, 40.7, 40.8
   */
  async requestExport(
    type: ReportType,
    format: ReportFormat,
    filters: ReportFilters,
    requestedBy: string,
    userEmail: string
  ): Promise<RequestExportResult> {
    // Generate report data to determine record count
    const report = await reportGenerationService.generateReport(type, filters, requestedBy);
    const totalRecords = report.metadata.totalRecords;

    // Requirement 40.6: limit export size to 10,000 records
    if (totalRecords > ASYNC_EXPORT_THRESHOLD) {
      // Create a PENDING job record
      const jobResult = await db.query<{ id: string }>(
        `INSERT INTO export_jobs (user_id, report_type, format, filters, status)
         VALUES ($1, $2, $3, $4, 'PENDING')
         RETURNING id`,
        [requestedBy, type, format, JSON.stringify(filters)]
      );
      const jobId = jobResult.rows[0].id;

      // Queue the job via Bull (imported lazily to avoid circular deps)
      const { exportQueue } = await import('./exportQueue');
      await exportQueue.add({ jobId, userEmail }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });

      logger.info('Export job queued', { jobId, type, format, totalRecords, requestedBy });

      // Audit log (Requirement 40.11)
      await auditService.log({
        userId: requestedBy,
        action: AuditAction.EXPORT,
        resourceType: 'export_job',
        resourceId: jobId,
        ipAddress: '0.0.0.0',
        result: AuditResult.SUCCESS,
        metadata: { type, format, totalRecords, async: true },
      });

      return {
        jobId,
        async: true,
        message: `Export queued. You will receive an email at ${userEmail} when it is ready.`,
      };
    }

    // Synchronous path for small exports
    const jobResult = await db.query<{ id: string }>(
      `INSERT INTO export_jobs (user_id, report_type, format, filters, status)
       VALUES ($1, $2, $3, $4, 'PROCESSING')
       RETURNING id`,
      [requestedBy, type, format, JSON.stringify(filters)]
    );
    const jobId = jobResult.rows[0].id;

    try {
      const fileUrl = await this._generateAndStore(jobId, report, format, requestedBy);

      await db.query(
        `UPDATE export_jobs
         SET status = 'COMPLETED', file_url = $1, completed_at = NOW()
         WHERE id = $2`,
        [fileUrl, jobId]
      );

      await auditService.log({
        userId: requestedBy,
        action: AuditAction.EXPORT,
        resourceType: 'export_job',
        resourceId: jobId,
        ipAddress: '0.0.0.0',
        result: AuditResult.SUCCESS,
        metadata: { type, format, totalRecords, async: false },
      });

      return { jobId, async: false, fileUrl, message: 'Export completed.' };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await db.query(
        `UPDATE export_jobs SET status = 'FAILED', error_message = $1 WHERE id = $2`,
        [errMsg, jobId]
      );
      throw error;
    }
  }

  /**
   * Process an export job (called by the Bull queue worker).
   * Requirements: 40.8, 40.9, 40.10, 40.11
   */
  async processExportJob(jobId: string, userEmail: string): Promise<void> {
    // Mark as PROCESSING
    await db.query(
      `UPDATE export_jobs SET status = 'PROCESSING' WHERE id = $1`,
      [jobId]
    );

    const jobRow = await db.query<{
      user_id: string;
      report_type: string;
      format: string;
      filters: any;
    }>(
      `SELECT user_id, report_type, format, filters FROM export_jobs WHERE id = $1`,
      [jobId]
    );

    if (jobRow.rows.length === 0) {
      throw new Error(`Export job not found: ${jobId}`);
    }

    const { user_id, report_type, format, filters } = jobRow.rows[0];

    try {
      const report = await reportGenerationService.generateReport(
        report_type as ReportType,
        typeof filters === 'string' ? JSON.parse(filters) : filters,
        user_id
      );

      const fileUrl = await this._generateAndStore(jobId, report, format as ReportFormat, user_id);

      await db.query(
        `UPDATE export_jobs
         SET status = 'COMPLETED', file_url = $1, completed_at = NOW()
         WHERE id = $2`,
        [fileUrl, jobId]
      );

      // Send email with download link (Requirement 40.9)
      await this._sendExportEmail(userEmail, report_type, fileUrl, jobId);

      // Audit log (Requirement 40.11)
      await auditService.log({
        userId: user_id,
        action: AuditAction.EXPORT,
        resourceType: 'export_job',
        resourceId: jobId,
        ipAddress: '0.0.0.0',
        result: AuditResult.SUCCESS,
        metadata: { reportType: report_type, format, totalRecords: report.metadata.totalRecords },
      });

      logger.info('Export job completed', { jobId, fileUrl });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await db.query(
        `UPDATE export_jobs SET status = 'FAILED', error_message = $1 WHERE id = $2`,
        [errMsg, jobId]
      );

      await auditService.log({
        userId: user_id,
        action: AuditAction.EXPORT,
        resourceType: 'export_job',
        resourceId: jobId,
        ipAddress: '0.0.0.0',
        result: AuditResult.FAILURE,
        metadata: { error: errMsg },
      });

      logger.error('Export job failed', { jobId, error: errMsg });
      throw error;
    }
  }

  /**
   * Get the current status of an export job.
   */
  async getExportStatus(jobId: string): Promise<ExportJob | null> {
    const result = await db.query(
      `SELECT id, user_id, report_type, format, filters, status,
              file_url, error_message, created_at, completed_at, expires_at
       FROM export_jobs
       WHERE id = $1`,
      [jobId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this._mapFromDb(result.rows[0]);
  }

  /**
   * Delete export files and records older than EXPORT_RETENTION_DAYS.
   * Requirement 40.10: Retain export files for 7 days before automatic deletion
   */
  async cleanupExpiredExports(): Promise<number> {
    const result = await db.query<{ id: string; file_url: string }>(
      `SELECT id, file_url FROM export_jobs WHERE expires_at < NOW() AND status = 'COMPLETED'`
    );

    let deleted = 0;
    for (const row of result.rows) {
      try {
        if (row.file_url) {
          // Extract fileId from URL pattern used by fileStorageService
          const fileId = this._extractFileId(row.file_url);
          if (fileId) {
            await fileStorageService.deleteFile(fileId, 'system').catch((err) => {
              logger.warn('Failed to delete export file from storage', { fileId, error: err });
            });
          }
        }
        await db.query(`DELETE FROM export_jobs WHERE id = $1`, [row.id]);
        deleted++;
      } catch (err) {
        logger.warn('Failed to cleanup export job', { jobId: row.id, error: err });
      }
    }

    if (deleted > 0) {
      logger.info('Cleaned up expired export jobs', { count: deleted });
    }

    return deleted;
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private async _generateAndStore(
    jobId: string,
    report: Awaited<ReturnType<typeof reportGenerationService.generateReport>>,
    format: ReportFormat,
    userId: string
  ): Promise<string> {
    let buffer: Buffer;
    let mimetype: string;
    let filename: string;

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `${report.metadata.reportType}_${ts}`;

    if (format === 'pdf') {
      buffer = await reportGenerationService.generatePDF(report);
      mimetype = 'application/pdf';
      filename = `${baseName}.pdf`;
    } else if (format === 'xlsx') {
      buffer = await reportGenerationService.generateExcel(report);
      mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      filename = `${baseName}.xlsx`;
    } else {
      const csv = reportGenerationService.generateCSV(report);
      buffer = Buffer.from(csv, 'utf-8');
      mimetype = 'text/csv';
      filename = `${baseName}.csv`;
    }

    const stored = await fileStorageService.uploadFile({
      filename,
      mimetype,
      size: buffer.length,
      buffer,
      uploadedBy: userId,
      entityType: 'report',
      entityId: jobId,
      description: `Export job ${jobId}`,
    });

    return stored.url;
  }

  private async _sendExportEmail(
    userEmail: string,
    reportType: string,
    fileUrl: string,
    jobId: string
  ): Promise<void> {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      logger.warn('SENDGRID_API_KEY not set — skipping export email', { jobId });
      return;
    }

    sgMail.setApiKey(apiKey);

    const expiryDate = new Date(Date.now() + EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const expiryStr = expiryDate.toUTCString();
    const reportLabel = reportType.replace(/_/g, ' ');

    const msg = {
      to: userEmail,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@techswifttrix.com',
      subject: `Your ${reportLabel} export is ready`,
      text: [
        `Your ${reportLabel} report export has completed.`,
        '',
        `Download link: ${fileUrl}`,
        '',
        `This link is valid until: ${expiryStr}`,
        '',
        'TechSwiftTrix ERP System',
      ].join('\n'),
      html: `
        <p>Your <strong>${reportLabel}</strong> report export has completed.</p>
        <p><a href="${fileUrl}">Click here to download your report</a></p>
        <p>This link is valid until: <strong>${expiryStr}</strong></p>
        <hr/>
        <p style="color:#666;font-size:12px;">TechSwiftTrix ERP System</p>
      `,
    };

    try {
      await sgMail.send(msg);
      logger.info('Export email sent', { jobId, userEmail });
    } catch (error) {
      logger.error('Failed to send export email', { jobId, userEmail, error });
      // Do not rethrow — email failure should not fail the job
    }
  }

  private _extractFileId(url: string): string | null {
    // URLs are stored as full S3/R2 URLs; the fileId is embedded in the path
    // Pattern: .../reports/<fileId>/...
    const match = url.match(/\/reports\/([a-f0-9]{32})\//);
    return match ? match[1] : null;
  }

  private _mapFromDb(row: any): ExportJob {
    return {
      id: row.id,
      userId: row.user_id,
      reportType: row.report_type as ReportType,
      format: row.format as ReportFormat,
      filters: typeof row.filters === 'string' ? JSON.parse(row.filters) : row.filters,
      status: row.status as ExportStatus,
      fileUrl: row.file_url ?? undefined,
      errorMessage: row.error_message ?? undefined,
      createdAt: row.created_at,
      completedAt: row.completed_at ?? undefined,
      expiresAt: row.expires_at,
    };
  }
}

export const asyncExportService = new AsyncExportService();
export default asyncExportService;
