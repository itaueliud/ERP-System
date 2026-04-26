/**
 * Unit tests for AuditLoggingService
 * Requirements: 15.1-15.13
 */

import { AuditLoggingService, AuditAction, AuditResult, AuditLogInput } from './auditService';

// ---------------------------------------------------------------------------
// Mock the database connection
// ---------------------------------------------------------------------------

const mockQuery = jest.fn();

jest.mock('../database/connection', () => ({
  db: {
    query: (...args: any[]) => mockQuery(...args),
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<AuditLogInput> = {}): AuditLogInput {
  return {
    userId: 'user-123',
    action: AuditAction.LOGIN,
    resourceType: 'auth',
    resourceId: null,
    ipAddress: '127.0.0.1',
    userAgent: 'jest-test',
    result: AuditResult.SUCCESS,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuditLoggingService', () => {
  let service: AuditLoggingService;

  beforeEach(() => {
    service = new AuditLoggingService();
    mockQuery.mockReset();
  });

  // -------------------------------------------------------------------------
  // log()
  // -------------------------------------------------------------------------

  describe('log()', () => {
    it('inserts a new audit log entry (INSERT only — no UPDATE/DELETE)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.log(makeEntry());

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql] = mockQuery.mock.calls[0];
      expect(sql.trim().toUpperCase()).toMatch(/^INSERT INTO AUDIT_LOGS/);
    });

    it('stores all required fields: userId, action, resourceType, ipAddress, result', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const entry = makeEntry({
        userId: 'u-abc',
        action: AuditAction.CREATE,
        resourceType: 'clients',
        resourceId: 'res-001',
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0',
        result: AuditResult.FAILURE,
        metadata: { reason: 'validation error' },
      });

      await service.log(entry);

      const [, params] = mockQuery.mock.calls[0];
      expect(params[0]).toBe('u-abc');           // userId
      expect(params[1]).toBe(AuditAction.CREATE); // action
      expect(params[2]).toBe('clients');          // resourceType
      expect(params[3]).toBe('res-001');          // resourceId
      expect(params[4]).toBe('10.0.0.1');         // ipAddress
      expect(params[5]).toBe('Mozilla/5.0');      // userAgent
      expect(params[6]).toBe(AuditResult.FAILURE);// result
    });

    it('does not throw when the database write fails (fire-and-forget)', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB down'));

      // Should resolve without throwing
      await expect(service.log(makeEntry())).resolves.toBeUndefined();
    });

    it('accepts all supported action types', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

      for (const action of Object.values(AuditAction)) {
        await service.log(makeEntry({ action }));
      }

      expect(mockQuery).toHaveBeenCalledTimes(Object.values(AuditAction).length);
    });

    it('accepts both SUCCESS and FAILURE results', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

      await service.log(makeEntry({ result: AuditResult.SUCCESS }));
      await service.log(makeEntry({ result: AuditResult.FAILURE }));

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // query()
  // -------------------------------------------------------------------------

  describe('query()', () => {
    const fakeRow = {
      id: 'log-1',
      user_id: 'user-123',
      action: 'LOGIN',
      resource_type: 'auth',
      resource_id: null,
      ip_address: '127.0.0.1',
      user_agent: 'jest',
      result: 'SUCCESS',
      metadata: null,
      created_at: new Date('2024-01-15T10:00:00Z'),
    };

    it('returns paginated results with total count', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })  // COUNT query
        .mockResolvedValueOnce({ rows: [fakeRow] });          // data query

      const result = await service.query({ limit: 10, offset: 0 });

      expect(result.total).toBe(5);
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].id).toBe('log-1');
    });

    it('applies userId filter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [fakeRow] });

      await service.query({ userId: 'user-123' });

      const [countSql, countParams] = mockQuery.mock.calls[0];
      expect(countSql).toContain('user_id = $1');
      expect(countParams[0]).toBe('user-123');
    });

    it('applies action filter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.query({ action: 'LOGIN' });

      const [countSql, countParams] = mockQuery.mock.calls[0];
      expect(countSql).toContain('action = $1');
      expect(countParams[0]).toBe('LOGIN');
    });

    it('applies date range filters', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await service.query({ startDate, endDate });

      const [countSql, countParams] = mockQuery.mock.calls[0];
      expect(countSql).toContain('created_at >=');
      expect(countSql).toContain('created_at <=');
      expect(countParams).toContain(startDate);
      expect(countParams).toContain(endDate);
    });

    it('applies result filter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.query({ result: AuditResult.FAILURE });

      const [countSql, countParams] = mockQuery.mock.calls[0];
      expect(countSql).toContain('result = $1');
      expect(countParams[0]).toBe('FAILURE');
    });

    it('uses default limit 50 and offset 0 when not specified', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.query({});

      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('maps database rows to AuditLog objects correctly', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [fakeRow] });

      const result = await service.query({});
      const log = result.logs[0];

      expect(log.id).toBe('log-1');
      expect(log.userId).toBe('user-123');
      expect(log.action).toBe('LOGIN');
      expect(log.resourceType).toBe('auth');
      expect(log.ipAddress).toBe('127.0.0.1');
      expect(log.result).toBe('SUCCESS');
      expect(log.createdAt).toEqual(new Date('2024-01-15T10:00:00Z'));
    });
  });

  // -------------------------------------------------------------------------
  // getLogById()
  // -------------------------------------------------------------------------

  describe('getLogById()', () => {
    it('returns the log entry when found', async () => {
      const fakeRow = {
        id: 'log-42',
        user_id: 'user-1',
        action: 'VIEW',
        resource_type: 'clients',
        resource_id: 'client-1',
        ip_address: '192.168.1.1',
        user_agent: 'Chrome',
        result: 'SUCCESS',
        metadata: { extra: 'data' },
        created_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [fakeRow] });

      const log = await service.getLogById('log-42');

      expect(log).not.toBeNull();
      expect(log!.id).toBe('log-42');
      expect(log!.resourceId).toBe('client-1');
    });

    it('returns null when the entry does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const log = await service.getLogById('nonexistent');

      expect(log).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // exportToCSV()
  // -------------------------------------------------------------------------

  describe('exportToCSV()', () => {
    const fakeRow = {
      id: 'log-1',
      user_id: 'user-123',
      action: 'LOGIN',
      resource_type: 'auth',
      resource_id: null,
      ip_address: '127.0.0.1',
      user_agent: 'jest',
      result: 'SUCCESS',
      metadata: null,
      created_at: new Date('2024-01-15T10:00:00Z'),
    };

    it('returns a CSV string with a header row', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [fakeRow] });

      const csv = await service.exportToCSV({});

      const lines = csv.split('\n');
      expect(lines[0]).toContain('id');
      expect(lines[0]).toContain('user_id');
      expect(lines[0]).toContain('action');
      expect(lines[0]).toContain('result');
      expect(lines[0]).toContain('created_at');
    });

    it('includes one data row per log entry', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [fakeRow] });

      const csv = await service.exportToCSV({});

      const lines = csv.split('\n').filter(Boolean);
      expect(lines).toHaveLength(2); // header + 1 data row
    });

    it('escapes commas and quotes in field values', async () => {
      const rowWithComma = {
        ...fakeRow,
        user_agent: 'Mozilla/5.0 (Windows, NT)',
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [rowWithComma] });

      const csv = await service.exportToCSV({});

      // The user_agent field should be quoted
      expect(csv).toContain('"Mozilla/5.0 (Windows, NT)"');
    });

    it('returns only a header row when there are no matching logs', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const csv = await service.exportToCSV({});

      const lines = csv.split('\n').filter(Boolean);
      expect(lines).toHaveLength(1); // header only
    });
  });

  // -------------------------------------------------------------------------
  // getRetentionPolicy()
  // -------------------------------------------------------------------------

  describe('getRetentionPolicy()', () => {
    it('returns a policy with minimumYears of 7 (Requirement 15.12)', () => {
      const policy = service.getRetentionPolicy();
      expect(policy.minimumYears).toBe(7);
    });

    it('includes a human-readable description', () => {
      const policy = service.getRetentionPolicy();
      expect(typeof policy.description).toBe('string');
      expect(policy.description.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // getLogsOlderThan()
  // -------------------------------------------------------------------------

  describe('getLogsOlderThan()', () => {
    const oldRow = {
      id: 'log-old',
      user_id: 'user-1',
      action: 'LOGIN',
      resource_type: 'auth',
      resource_id: null,
      ip_address: '127.0.0.1',
      user_agent: 'jest',
      result: 'SUCCESS',
      metadata: null,
      created_at: new Date('2010-01-01T00:00:00Z'),
    };

    it('queries logs older than the specified number of years', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [oldRow] });

      await service.getLogsOlderThan(7);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('created_at < $1');
      expect(params[0]).toBeInstanceOf(Date);
    });

    it('returns mapped AuditLog objects', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [oldRow] });

      const logs = await service.getLogsOlderThan(7);

      expect(logs).toHaveLength(1);
      expect(logs[0].id).toBe('log-old');
    });

    it('returns empty array when no old logs exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const logs = await service.getLogsOlderThan(7);
      expect(logs).toHaveLength(0);
    });

    it('throws when the database query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.getLogsOlderThan(7)).rejects.toThrow('DB error');
    });
  });

  // -------------------------------------------------------------------------
  // Immutability — no UPDATE or DELETE operations
  // -------------------------------------------------------------------------

  describe('Immutability (Requirement 15.3)', () => {
    it('does not expose any update method', () => {
      expect((service as any).update).toBeUndefined();
      expect((service as any).updateLog).toBeUndefined();
    });

    it('does not expose any delete method', () => {
      expect((service as any).delete).toBeUndefined();
      expect((service as any).deleteLog).toBeUndefined();
    });

    it('log() only issues INSERT statements, never UPDATE or DELETE', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.log(makeEntry());

      const [sql] = mockQuery.mock.calls[0];
      expect(sql.trim().toUpperCase()).not.toMatch(/^UPDATE/);
      expect(sql.trim().toUpperCase()).not.toMatch(/^DELETE/);
    });
  });
});
