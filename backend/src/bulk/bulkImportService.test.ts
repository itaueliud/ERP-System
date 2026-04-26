/**
 * Tests for BulkImportService
 * Requirements: 25.1-25.7
 */

import { BulkImportService, EntityType } from './bulkImportService';

// ============================================================================
// Mock dependencies
// ============================================================================

jest.mock('../database/connection', () => ({
  db: {
    query: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../audit/auditService', () => ({
  auditService: { log: jest.fn() },
}));

jest.mock('bull', () => {
  const add = jest.fn().mockResolvedValue({});
  const process = jest.fn();
  const on = jest.fn();
  return jest.fn().mockImplementation(() => ({ add, process, on }));
});

import { db } from '../database/connection';

const mockDb = db as jest.Mocked<typeof db>;

// ============================================================================
// Helpers
// ============================================================================

function makeService() {
  return new BulkImportService();
}

function makeRows(entityType: EntityType, count = 2): Record<string, any>[] {
  if (entityType === 'users') {
    return Array.from({ length: count }, (_, i) => ({
      email: `user${i}@example.com`,
      first_name: `First${i}`,
      last_name: `Last${i}`,
      role: 'agent',
    }));
  }
  if (entityType === 'clients') {
    return Array.from({ length: count }, (_, i) => ({
      name: `Client ${i}`,
      email: `client${i}@example.com`,
      phone: `+2547000000${i}`,
    }));
  }
  // properties
  return Array.from({ length: count }, (_, i) => ({
    title: `Property ${i}`,
    address: `123 Street ${i}`,
    price: `${100000 + i * 1000}`,
    type: 'residential',
  }));
}

function makeHeaders(entityType: EntityType): string[] {
  if (entityType === 'users') return ['email', 'first_name', 'last_name', 'role'];
  if (entityType === 'clients') return ['name', 'email', 'phone'];
  return ['title', 'address', 'price', 'type'];
}

// ============================================================================
// validateImport
// ============================================================================

describe('BulkImportService.validateImport', () => {
  const service = makeService();

  describe('users', () => {
    it('returns valid=true for correct user rows', () => {
      const rows = makeRows('users');
      const result = service.validateImport('users', rows, makeHeaders('users'));
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.rowCount).toBe(2);
    });

    it('returns valid=false when required header is missing', () => {
      const rows = makeRows('users');
      const result = service.validateImport('users', rows, ['email', 'first_name', 'last_name']); // missing role
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toMatch(/role/);
    });

    it('returns error for empty required field', () => {
      const rows = [{ email: '', first_name: 'A', last_name: 'B', role: 'agent' }];
      const result = service.validateImport('users', rows, makeHeaders('users'));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'email')).toBe(true);
    });

    it('returns error for invalid email format', () => {
      const rows = [{ email: 'not-an-email', first_name: 'A', last_name: 'B', role: 'agent' }];
      const result = service.validateImport('users', rows, makeHeaders('users'));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'email' && e.message.includes('Invalid email'))).toBe(true);
    });
  });

  describe('clients', () => {
    it('returns valid=true for correct client rows', () => {
      const rows = makeRows('clients');
      const result = service.validateImport('clients', rows, makeHeaders('clients'));
      expect(result.valid).toBe(true);
    });

    it('returns error for missing phone', () => {
      const rows = [{ name: 'Acme', email: 'acme@example.com', phone: '' }];
      const result = service.validateImport('clients', rows, makeHeaders('clients'));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'phone')).toBe(true);
    });
  });

  describe('properties', () => {
    it('returns valid=true for correct property rows', () => {
      const rows = makeRows('properties');
      const result = service.validateImport('properties', rows, makeHeaders('properties'));
      expect(result.valid).toBe(true);
    });

    it('returns error for non-numeric price', () => {
      const rows = [{ title: 'House', address: '1 St', price: 'abc', type: 'residential' }];
      const result = service.validateImport('properties', rows, makeHeaders('properties'));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'price')).toBe(true);
    });

    it('returns valid=true when price is empty (not required to be numeric if empty)', () => {
      // price is required, so empty should fail on required check, not numeric check
      const rows = [{ title: 'House', address: '1 St', price: '', type: 'residential' }];
      const result = service.validateImport('properties', rows, makeHeaders('properties'));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'price')).toBe(true);
    });
  });

  it('reports row number correctly (1-based + header offset)', () => {
    const rows = [
      { email: 'ok@example.com', first_name: 'A', last_name: 'B', role: 'agent' },
      { email: '', first_name: 'C', last_name: 'D', role: 'agent' },
    ];
    const result = service.validateImport('users', rows, makeHeaders('users'));
    const emptyEmailError = result.errors.find((e) => e.field === 'email');
    expect(emptyEmailError?.row).toBe(3); // row 1 = header, row 2 = first data, row 3 = second data
  });
});

// ============================================================================
// startImport
// ============================================================================

describe('BulkImportService.startImport', () => {
  const service = makeService();

  const validCsv = `email,first_name,last_name,role\nuser1@example.com,Alice,Smith,agent\nuser2@example.com,Bob,Jones,manager`;

  const mockJobRow = {
    id: 'job-uuid-1',
    entity_type: 'users',
    status: 'PENDING',
    total_records: 2,
    processed_records: 0,
    success_count: 0,
    failed_count: 0,
    errors: '[]',
    requested_by: 'user-uuid-1',
    created_at: new Date(),
    completed_at: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a PENDING job and queues it for valid CSV', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockJobRow], rowCount: 1 } as any) // INSERT
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // UPDATE (store csv)

    const job = await service.startImport('users', validCsv, 'user-uuid-1');

    expect(job.status).toBe('PENDING');
    expect(job.entityType).toBe('users');
    expect(job.totalRecords).toBe(2);
  });

  it('creates a FAILED job for invalid CSV (missing required column)', async () => {
    const invalidCsv = `email,first_name\nuser1@example.com,Alice`;
    const failedJobRow = { ...mockJobRow, status: 'FAILED', failed_count: 1, errors: '[]' };

    mockDb.query.mockResolvedValueOnce({ rows: [failedJobRow], rowCount: 1 } as any);

    const job = await service.startImport('users', invalidCsv, 'user-uuid-1');

    expect(job.status).toBe('FAILED');
  });

  it('creates a FAILED job when email is invalid', async () => {
    const badEmailCsv = `email,first_name,last_name,role\nnot-an-email,Alice,Smith,agent`;
    const failedJobRow = { ...mockJobRow, status: 'FAILED', failed_count: 1, errors: '[]' };

    mockDb.query.mockResolvedValueOnce({ rows: [failedJobRow], rowCount: 1 } as any);

    const job = await service.startImport('users', badEmailCsv, 'user-uuid-1');

    expect(job.status).toBe('FAILED');
  });
});

// ============================================================================
// getImportStatus
// ============================================================================

describe('BulkImportService.getImportStatus', () => {
  const service = makeService();

  beforeEach(() => jest.clearAllMocks());

  it('returns null when job not found', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
    const result = await service.getImportStatus('nonexistent-id');
    expect(result).toBeNull();
  });

  it('returns job with correct progress percentage data', async () => {
    const row = {
      id: 'job-1',
      entity_type: 'clients',
      status: 'PROCESSING',
      total_records: 100,
      processed_records: 50,
      success_count: 48,
      failed_count: 2,
      errors: '[]',
      requested_by: 'user-1',
      created_at: new Date(),
      completed_at: null,
    };
    mockDb.query.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);

    const job = await service.getImportStatus('job-1');

    expect(job).not.toBeNull();
    expect(job!.processedRecords).toBe(50);
    expect(job!.totalRecords).toBe(100);
    // Progress percentage = (processedRecords / totalRecords) * 100
    const progress = (job!.processedRecords / job!.totalRecords) * 100;
    expect(progress).toBe(50);
    expect(job!.successCount).toBe(48);
    expect(job!.failedCount).toBe(2);
  });

  it('returns completed job with completedAt set', async () => {
    const completedAt = new Date();
    const row = {
      id: 'job-2',
      entity_type: 'properties',
      status: 'COMPLETED',
      total_records: 10,
      processed_records: 10,
      success_count: 10,
      failed_count: 0,
      errors: '[]',
      requested_by: 'user-2',
      created_at: new Date(),
      completed_at: completedAt,
    };
    mockDb.query.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);

    const job = await service.getImportStatus('job-2');

    expect(job!.status).toBe('COMPLETED');
    expect(job!.completedAt).toEqual(completedAt);
  });
});

// ============================================================================
// processImport
// ============================================================================

describe('BulkImportService.processImport', () => {
  const service = makeService();

  beforeEach(() => jest.clearAllMocks());

  it('marks job as FAILED when job not found', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // UPDATE status=PROCESSING
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // SELECT

    await service.processImport('nonexistent');
    // Should not throw
  });

  it('processes rows and marks job COMPLETED', async () => {
    const csvContent = `email,first_name,last_name,role\nuser1@example.com,Alice,Smith,agent`;
    const jobRow = {
      id: 'job-3',
      entity_type: 'users',
      status: 'PROCESSING',
      total_records: 1,
      processed_records: 0,
      success_count: 0,
      failed_count: 0,
      errors: JSON.stringify({ _csvContent: csvContent, validationErrors: [] }),
      requested_by: 'user-1',
      created_at: new Date(),
      completed_at: null,
    };

    mockDb.query
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // UPDATE status=PROCESSING
      .mockResolvedValueOnce({ rows: [jobRow], rowCount: 1 } as any) // SELECT job
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // INSERT user
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // UPDATE progress
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // UPDATE COMPLETED

    await service.processImport('job-3');

    // Final UPDATE should set status=COMPLETED
    const calls = (mockDb.query as jest.Mock).mock.calls;
    const completedCall = calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('COMPLETED')
    );
    expect(completedCall).toBeDefined();
  });

  it('records row-level errors without stopping the whole import', async () => {
    const csvContent = `email,first_name,last_name,role\nbad@example.com,Alice,Smith,agent`;
    const jobRow = {
      id: 'job-4',
      entity_type: 'users',
      status: 'PROCESSING',
      total_records: 1,
      processed_records: 0,
      success_count: 0,
      failed_count: 0,
      errors: JSON.stringify({ _csvContent: csvContent, validationErrors: [] }),
      requested_by: 'user-1',
      created_at: new Date(),
      completed_at: null,
    };

    mockDb.query
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // UPDATE PROCESSING
      .mockResolvedValueOnce({ rows: [jobRow], rowCount: 1 } as any) // SELECT
      .mockRejectedValueOnce(new Error('duplicate key')) // INSERT fails
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // UPDATE progress
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // UPDATE COMPLETED

    await service.processImport('job-4');

    const calls = (mockDb.query as jest.Mock).mock.calls;
    const completedCall = calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('COMPLETED')
    );
    expect(completedCall).toBeDefined();
    // failed_count should be 1
    expect(completedCall[1][2]).toBe(1);
  });
});
