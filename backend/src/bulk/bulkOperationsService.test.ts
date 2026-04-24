import { BulkOperationsService } from './bulkOperationsService';
import { db } from '../database/connection';
import { auditService } from '../audit/auditService';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('../database/connection', () => ({
  db: { query: jest.fn() },
}));

jest.mock('../audit/auditService', () => ({
  auditService: { log: jest.fn().mockResolvedValue(undefined) },
  AuditAction: { EXECUTE: 'EXECUTE', EXPORT: 'EXPORT' },
  AuditResult: { SUCCESS: 'SUCCESS', FAILURE: 'FAILURE' },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ============================================================================
// Helpers
// ============================================================================

const mockDb = db as jest.Mocked<typeof db>;
const mockAudit = auditService as jest.Mocked<typeof auditService>;

function makeIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`);
}

// ============================================================================
// Tests
// ============================================================================

describe('BulkOperationsService', () => {
  let service: BulkOperationsService;

  beforeEach(() => {
    service = new BulkOperationsService();
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // bulkUpdateStatus
  // --------------------------------------------------------------------------

  describe('bulkUpdateStatus', () => {
    it('updates status for all matching records and returns correct counts', async () => {
      const ids = makeIds(3);
      mockDb.query.mockResolvedValueOnce({ rows: ids.map((id) => ({ id })), rowCount: 3 } as any);

      const result = await service.bulkUpdateStatus('clients', ids, 'active', 'user-1');

      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.totalRequested).toBe(3);
    });

    it('reports failed count when some records are not found', async () => {
      const ids = makeIds(3);
      // Only 2 rows updated
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: ids[0] }, { id: ids[1] }], rowCount: 2 } as any);

      const result = await service.bulkUpdateStatus('clients', ids, 'inactive', 'user-1');

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('throws when ids exceed 1000 limit', async () => {
      const ids = makeIds(1001);
      await expect(service.bulkUpdateStatus('users', ids, 'active', 'user-1')).rejects.toThrow(
        /limit exceeded/i
      );
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('accepts exactly 1000 ids without throwing', async () => {
      const ids = makeIds(1000);
      mockDb.query.mockResolvedValueOnce({ rows: ids.map((id) => ({ id })), rowCount: 1000 } as any);

      const result = await service.bulkUpdateStatus('users', ids, 'active', 'user-1');
      expect(result.totalRequested).toBe(1000);
      expect(result.successCount).toBe(1000);
    });

    it('logs to audit service on success', async () => {
      const ids = makeIds(2);
      mockDb.query.mockResolvedValueOnce({ rows: ids.map((id) => ({ id })), rowCount: 2 } as any);

      await service.bulkUpdateStatus('users', ids, 'active', 'user-42');

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-42',
          action: 'EXECUTE',
          resourceType: 'users',
          result: 'SUCCESS',
          metadata: expect.objectContaining({ operation: 'bulkUpdateStatus', newStatus: 'active' }),
        })
      );
    });

    it('logs FAILURE to audit when db error occurs', async () => {
      const ids = makeIds(2);
      mockDb.query.mockRejectedValueOnce(new Error('DB down'));

      const result = await service.bulkUpdateStatus('clients', ids, 'active', 'user-1');

      expect(result.failedCount).toBe(2);
      expect(result.errors[0]).toMatch(/DB down/);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ result: 'FAILURE' })
      );
    });
  });

  // --------------------------------------------------------------------------
  // bulkAssign
  // --------------------------------------------------------------------------

  describe('bulkAssign', () => {
    it('assigns records to a user and returns correct counts', async () => {
      const ids = makeIds(4);
      mockDb.query.mockResolvedValueOnce({ rows: ids.map((id) => ({ id })), rowCount: 4 } as any);

      const result = await service.bulkAssign('properties', ids, 'user-99', 'user-1');

      expect(result.successCount).toBe(4);
      expect(result.failedCount).toBe(0);
      expect(result.totalRequested).toBe(4);
    });

    it('throws when ids exceed 1000 limit', async () => {
      const ids = makeIds(1001);
      await expect(service.bulkAssign('clients', ids, 'user-99', 'user-1')).rejects.toThrow(
        /limit exceeded/i
      );
    });

    it('logs to audit service with assignedUserId in metadata', async () => {
      const ids = makeIds(2);
      mockDb.query.mockResolvedValueOnce({ rows: ids.map((id) => ({ id })), rowCount: 2 } as any);

      await service.bulkAssign('clients', ids, 'user-99', 'user-1');

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'EXECUTE',
          metadata: expect.objectContaining({ operation: 'bulkAssign', assignedUserId: 'user-99' }),
        })
      );
    });

    it('handles db errors gracefully', async () => {
      const ids = makeIds(3);
      mockDb.query.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.bulkAssign('users', ids, 'user-99', 'user-1');

      expect(result.failedCount).toBe(3);
      expect(result.successCount).toBe(0);
      expect(result.errors[0]).toMatch(/Connection refused/);
    });
  });

  // --------------------------------------------------------------------------
  // bulkExportCSV
  // --------------------------------------------------------------------------

  describe('bulkExportCSV', () => {
    it('returns CSV string with header and data rows', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { id: '1', name: 'Acme', email: 'a@b.com', phone: '123', status: 'active', created_at: new Date('2024-01-01') },
        ],
        rowCount: 1,
      } as any);

      const csv = await service.bulkExportCSV('clients', {}, 'user-1');

      expect(typeof csv).toBe('string');
      expect(csv).toContain('id');
      expect(csv).toContain('name');
      expect(csv).toContain('Acme');
    });

    it('returns empty CSV with only header when no records match', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const csv = await service.bulkExportCSV('clients', { status: 'nonexistent' }, 'user-1');

      expect(csv).toContain('id');
      // Only header line, no data
      const lines = csv.split('\n').filter(Boolean);
      expect(lines).toHaveLength(1);
    });

    it('logs EXPORT action to audit service', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await service.bulkExportCSV('users', {}, 'user-5');

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-5',
          action: 'EXPORT',
          resourceType: 'users',
          result: 'SUCCESS',
          metadata: expect.objectContaining({ operation: 'bulkExportCSV' }),
        })
      );
    });

    it('applies status filter in query', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await service.bulkExportCSV('clients', { status: 'active' }, 'user-1');

      const callArgs = mockDb.query.mock.calls[0];
      expect(callArgs[1]).toContain('active');
    });
  });

  // --------------------------------------------------------------------------
  // bulkExportExcel
  // --------------------------------------------------------------------------

  describe('bulkExportExcel', () => {
    it('returns a Buffer', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { id: '1', name: 'Acme', email: 'a@b.com', phone: '123', status: 'active', created_at: new Date('2024-01-01') },
        ],
        rowCount: 1,
      } as any);

      const buffer = await service.bulkExportExcel('clients', {}, 'user-1');

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('logs EXPORT action to audit service', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await service.bulkExportExcel('properties', {}, 'user-7');

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-7',
          action: 'EXPORT',
          resourceType: 'properties',
          result: 'SUCCESS',
          metadata: expect.objectContaining({ operation: 'bulkExportExcel' }),
        })
      );
    });

    it('returns valid XLSX magic bytes (PK zip header)', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const buffer = await service.bulkExportExcel('users', {}, 'user-1');

      // XLSX files are ZIP archives starting with PK (0x50 0x4B)
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);
    });
  });
});
