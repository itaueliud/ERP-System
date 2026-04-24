/**
 * Unit tests for AsyncExportService
 * Requirements: 40.6-40.11
 */

import { AsyncExportService, ASYNC_EXPORT_THRESHOLD, EXPORT_RETENTION_DAYS } from './asyncExportService';
import { ReportType } from './reportGenerationService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockQuery = jest.fn();
jest.mock('../database/connection', () => ({ db: { query: (...a: any[]) => mockQuery(...a) } }));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../audit/auditService', () => ({
  auditService: { log: jest.fn().mockResolvedValue(undefined) },
  AuditAction: { EXPORT: 'EXPORT' },
  AuditResult: { SUCCESS: 'SUCCESS', FAILURE: 'FAILURE' },
}));

const mockGenerateReport = jest.fn();
const mockGenerateCSV = jest.fn();
const mockGenerateExcel = jest.fn();
const mockGeneratePDF = jest.fn();

jest.mock('./reportGenerationService', () => ({
  reportGenerationService: {
    generateReport: (...a: any[]) => mockGenerateReport(...a),
    generateCSV: (...a: any[]) => mockGenerateCSV(...a),
    generateExcel: (...a: any[]) => mockGenerateExcel(...a),
    generatePDF: (...a: any[]) => mockGeneratePDF(...a),
  },
  ReportType: {
    CLIENT_LIST: 'CLIENT_LIST',
    LEAD_PIPELINE: 'LEAD_PIPELINE',
    PROJECT_STATUS: 'PROJECT_STATUS',
    PAYMENT_SUMMARY: 'PAYMENT_SUMMARY',
    AUDIT_SUMMARY: 'AUDIT_SUMMARY',
    ACHIEVEMENT_SUMMARY: 'ACHIEVEMENT_SUMMARY',
    DAILY_REPORT_COMPLIANCE: 'DAILY_REPORT_COMPLIANCE',
  },
}));

const mockUploadFile = jest.fn();
const mockDeleteFile = jest.fn();
jest.mock('../files/fileService', () => ({
  fileStorageService: {
    uploadFile: (...a: any[]) => mockUploadFile(...a),
    deleteFile: (...a: any[]) => mockDeleteFile(...a),
  },
}));

// Mock Bull queue
jest.mock('./exportQueue', () => ({
  exportQueue: { add: jest.fn().mockResolvedValue({ id: 'bull-job-1' }) },
}));

// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }]),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReport(totalRecords: number) {
  return {
    metadata: {
      reportType: 'CLIENT_LIST',
      generatedAt: new Date(),
      generatedBy: 'user-1',
      filtersApplied: {},
      totalRecords,
    },
    data: Array.from({ length: totalRecords }, (_, i) => ({ id: i })),
    columns: [{ key: 'id', header: 'ID' }],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AsyncExportService', () => {
  let service: AsyncExportService;

  beforeEach(() => {
    service = new AsyncExportService();
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------------

  describe('constants', () => {
    it('ASYNC_EXPORT_THRESHOLD defaults to 10000', () => {
      expect(ASYNC_EXPORT_THRESHOLD).toBe(10000);
    });

    it('EXPORT_RETENTION_DAYS is 7', () => {
      expect(EXPORT_RETENTION_DAYS).toBe(7);
    });
  });

  // -------------------------------------------------------------------------
  // requestExport() — synchronous path (<=10,000 records)
  // -------------------------------------------------------------------------

  describe('requestExport() — synchronous path', () => {
    beforeEach(() => {
      mockGenerateReport.mockResolvedValue(makeReport(100));
      mockGenerateCSV.mockReturnValue('csv-content');
      mockUploadFile.mockResolvedValue({ url: 'https://storage.example.com/file.csv', fileId: 'fid-1' });
      // INSERT job → returns id; UPDATE job → no rows needed
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'job-sync-1' }] })  // INSERT
        .mockResolvedValueOnce({ rows: [] });                       // UPDATE COMPLETED
    });

    it('returns async=false for small exports', async () => {
      const result = await service.requestExport(
        ReportType.CLIENT_LIST, 'csv', {}, 'user-1', 'user@example.com'
      );
      expect(result.async).toBe(false);
      expect(result.jobId).toBe('job-sync-1');
      expect(result.fileUrl).toBe('https://storage.example.com/file.csv');
    });

    it('calls generateReport with correct arguments', async () => {
      await service.requestExport(ReportType.CLIENT_LIST, 'csv', { status: 'ACTIVE' }, 'user-1', 'u@e.com');
      expect(mockGenerateReport).toHaveBeenCalledWith(ReportType.CLIENT_LIST, { status: 'ACTIVE' }, 'user-1');
    });

    it('inserts a job record with PROCESSING status for sync exports', async () => {
      await service.requestExport(ReportType.CLIENT_LIST, 'csv', {}, 'user-1', 'u@e.com');
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("'PROCESSING'");
    });

    it('updates job to COMPLETED after successful sync export', async () => {
      await service.requestExport(ReportType.CLIENT_LIST, 'csv', {}, 'user-1', 'u@e.com');
      const [updateSql] = mockQuery.mock.calls[1];
      expect(updateSql).toContain("'COMPLETED'");
    });
  });

  // -------------------------------------------------------------------------
  // requestExport() — asynchronous path (>10,000 records)
  // -------------------------------------------------------------------------

  describe('requestExport() — asynchronous path', () => {
    beforeEach(() => {
      mockGenerateReport.mockResolvedValue(makeReport(15000));
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'job-async-1' }] }); // INSERT PENDING
    });

    it('returns async=true for large exports', async () => {
      const result = await service.requestExport(
        ReportType.CLIENT_LIST, 'xlsx', {}, 'user-1', 'user@example.com'
      );
      expect(result.async).toBe(true);
      expect(result.jobId).toBe('job-async-1');
      expect(result.fileUrl).toBeUndefined();
    });

    it('inserts a job record with PENDING status for async exports', async () => {
      await service.requestExport(ReportType.CLIENT_LIST, 'xlsx', {}, 'user-1', 'u@e.com');
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("'PENDING'");
    });

    it('adds job to Bull queue', async () => {
      await service.requestExport(ReportType.CLIENT_LIST, 'xlsx', {}, 'user-1', 'user@example.com');
      const { exportQueue } = await import('./exportQueue');
      expect(exportQueue.add).toHaveBeenCalledWith(
        { jobId: 'job-async-1', userEmail: 'user@example.com' },
        expect.any(Object)
      );
    });

    it('includes email address in the response message', async () => {
      const result = await service.requestExport(
        ReportType.CLIENT_LIST, 'xlsx', {}, 'user-1', 'user@example.com'
      );
      expect(result.message).toContain('user@example.com');
    });
  });

  // -------------------------------------------------------------------------
  // processExportJob()
  // -------------------------------------------------------------------------

  describe('processExportJob()', () => {
    const jobRow = {
      user_id: 'user-1',
      report_type: 'CLIENT_LIST',
      format: 'csv',
      filters: '{}',
    };

    beforeEach(() => {
      mockGenerateReport.mockResolvedValue(makeReport(500));
      mockGenerateCSV.mockReturnValue('csv-data');
      mockUploadFile.mockResolvedValue({ url: 'https://storage.example.com/export.csv', fileId: 'fid-2' });
      mockQuery
        .mockResolvedValueOnce({ rows: [] })           // UPDATE PROCESSING
        .mockResolvedValueOnce({ rows: [jobRow] })     // SELECT job
        .mockResolvedValueOnce({ rows: [] });           // UPDATE COMPLETED
    });

    it('updates job status to PROCESSING then COMPLETED', async () => {
      await service.processExportJob('job-1', 'user@example.com');
      const [processSql] = mockQuery.mock.calls[0];
      const [completeSql] = mockQuery.mock.calls[2];
      expect(processSql).toContain("'PROCESSING'");
      expect(completeSql).toContain("'COMPLETED'");
    });

    it('stores the generated file and saves the URL', async () => {
      await service.processExportJob('job-1', 'user@example.com');
      expect(mockUploadFile).toHaveBeenCalledTimes(1);
      const [, completeParams] = mockQuery.mock.calls[2];
      expect(completeParams[0]).toBe('https://storage.example.com/export.csv');
    });

    it('throws when job is not found', async () => {
      mockQuery.mockReset();
      mockQuery
        .mockResolvedValueOnce({ rows: [] })  // UPDATE PROCESSING
        .mockResolvedValueOnce({ rows: [] }); // SELECT — not found
      await expect(service.processExportJob('missing-job', 'u@e.com')).rejects.toThrow('not found');
    });

    it('marks job as FAILED and rethrows on error', async () => {
      mockQuery.mockReset();
      mockQuery
        .mockResolvedValueOnce({ rows: [] })        // UPDATE PROCESSING
        .mockResolvedValueOnce({ rows: [jobRow] })  // SELECT job
        .mockResolvedValueOnce({ rows: [] });        // UPDATE FAILED
      mockGenerateReport.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.processExportJob('job-err', 'u@e.com')).rejects.toThrow('DB error');

      const [failSql] = mockQuery.mock.calls[2];
      expect(failSql).toContain("'FAILED'");
    });
  });

  // -------------------------------------------------------------------------
  // getExportStatus()
  // -------------------------------------------------------------------------

  describe('getExportStatus()', () => {
    it('returns null when job does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await service.getExportStatus('nonexistent');
      expect(result).toBeNull();
    });

    it('returns mapped ExportJob when found', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'job-42',
          user_id: 'user-1',
          report_type: 'CLIENT_LIST',
          format: 'csv',
          filters: '{}',
          status: 'COMPLETED',
          file_url: 'https://storage.example.com/file.csv',
          error_message: null,
          created_at: new Date('2024-01-01'),
          completed_at: new Date('2024-01-01T01:00:00Z'),
          expires_at: new Date('2024-01-08'),
        }],
      });

      const job = await service.getExportStatus('job-42');
      expect(job).not.toBeNull();
      expect(job!.id).toBe('job-42');
      expect(job!.status).toBe('COMPLETED');
      expect(job!.fileUrl).toBe('https://storage.example.com/file.csv');
    });
  });

  // -------------------------------------------------------------------------
  // cleanupExpiredExports()
  // -------------------------------------------------------------------------

  describe('cleanupExpiredExports()', () => {
    it('returns 0 when no expired jobs exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const count = await service.cleanupExpiredExports();
      expect(count).toBe(0);
    });

    it('deletes expired job records', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'job-old', file_url: null }] }) // SELECT expired
        .mockResolvedValueOnce({ rows: [] }); // DELETE

      const count = await service.cleanupExpiredExports();
      expect(count).toBe(1);
      const [deleteSql] = mockQuery.mock.calls[1];
      expect(deleteSql).toContain('DELETE FROM export_jobs');
    });

    it('attempts to delete storage file when file_url is present', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'job-old', file_url: 'https://s3.example.com/reports/abc123def456abc123def456abc123de/file.csv' }],
        })
        .mockResolvedValueOnce({ rows: [] }); // DELETE

      mockDeleteFile.mockResolvedValueOnce(undefined);

      await service.cleanupExpiredExports();
      expect(mockDeleteFile).toHaveBeenCalledTimes(1);
    });
  });
});
