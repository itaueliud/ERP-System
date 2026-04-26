/**
 * Unit tests for bulk operations – task 24.5
 * Requirements: 25.1-25.12, 66.1-66.10
 *
 * These tests supplement the existing test files with additional coverage for:
 *  - CSV parsing with various delimiter formats and encoding detection (66.4, 66.6, 66.10)
 *  - Bulk import validation edge cases (25.2)
 *  - Import progress tracking and summary reporting (25.6, 25.7)
 *  - Bulk status update limit enforcement (25.11)
 *  - Audit logging for bulk operations (25.12)
 */

import { CSVParser } from './csvParser';
import { BulkImportService } from './bulkImportService';
import { BulkOperationsService } from './bulkOperationsService';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('../database/connection', () => ({
  db: { query: jest.fn() },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../audit/auditService', () => ({
  auditService: { log: jest.fn().mockResolvedValue(undefined) },
  AuditAction: { EXECUTE: 'EXECUTE', EXPORT: 'EXPORT' },
  AuditResult: { SUCCESS: 'SUCCESS', FAILURE: 'FAILURE' },
}));

jest.mock('bull', () => {
  const add = jest.fn().mockResolvedValue({});
  const process = jest.fn();
  const on = jest.fn();
  return jest.fn().mockImplementation(() => ({ add, process, on }));
});

import { db } from '../database/connection';
import { auditService } from '../audit/auditService';

const mockDb = db as jest.Mocked<typeof db>;
const mockAudit = auditService as jest.Mocked<typeof auditService>;

// ============================================================================
// CSV Parsing – various formats (Req 66.4, 66.5, 66.6, 66.10)
// ============================================================================

describe('CSVParser – various formats', () => {
  let parser: CSVParser;

  beforeEach(() => {
    parser = new CSVParser();
  });

  // Req 66.4 – comma, semicolon, tab delimiters
  it('parses comma-delimited CSV correctly', () => {
    const csv = 'name,email,role\nAlice,alice@example.com,agent\nBob,bob@example.com,trainer';
    const result = parser.parse(csv, { delimiter: ',' });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ name: 'Alice', email: 'alice@example.com', role: 'agent' });
  });

  it('parses semicolon-delimited CSV correctly', () => {
    const csv = 'name;email;role\nAlice;alice@example.com;agent';
    const result = parser.parse(csv, { delimiter: ';' });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ name: 'Alice', email: 'alice@example.com', role: 'agent' });
  });

  it('parses tab-delimited CSV correctly', () => {
    const csv = 'name\temail\trole\nAlice\talice@example.com\tagent';
    const result = parser.parse(csv, { delimiter: '\t' });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ name: 'Alice', email: 'alice@example.com', role: 'agent' });
  });

  it('auto-detects semicolon delimiter from content', () => {
    const csv = 'name;email\nAlice;alice@example.com';
    const result = parser.parse(csv); // no explicit delimiter
    expect(result.rows[0].name).toBe('Alice');
    expect(result.rows[0].email).toBe('alice@example.com');
  });

  it('auto-detects tab delimiter from content', () => {
    const csv = 'name\temail\nAlice\talice@example.com';
    const result = parser.parse(csv);
    expect(result.rows[0].name).toBe('Alice');
  });

  // Req 66.5 – quoted fields containing delimiters
  it('handles quoted fields with embedded commas', () => {
    const csv = 'name,address\nAlice,"Nairobi, Kenya"';
    const result = parser.parse(csv);
    expect(result.rows[0].address).toBe('Nairobi, Kenya');
  });

  it('handles quoted fields with embedded semicolons when using semicolon delimiter', () => {
    const csv = 'name;address\nAlice;"Lagos; Nigeria"';
    const result = parser.parse(csv, { delimiter: ';' });
    expect(result.rows[0].address).toBe('Lagos; Nigeria');
  });

  it('handles quoted fields with embedded tabs when using tab delimiter', () => {
    const csv = 'name\tdescription\nAlice\t"line1\tline2"';
    const result = parser.parse(csv, { delimiter: '\t' });
    expect(result.rows[0].description).toBe('line1\tline2');
  });

  // Req 66.6 – encoding detection
  it('detects UTF-8 encoding for ASCII-only content', () => {
    const buf = Buffer.from('name,email\nAlice,alice@example.com', 'utf-8');
    expect(parser.detectEncoding(buf)).toBe('utf-8');
  });

  it('detects UTF-8 encoding with BOM marker', () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const content = Buffer.from('name,email', 'utf-8');
    const buf = Buffer.concat([bom, content]);
    expect(parser.detectEncoding(buf)).toBe('utf-8');
  });

  it('detects ISO-8859-1 for Latin-1 encoded content', () => {
    // 0xe9 = é in ISO-8859-1, invalid as standalone UTF-8 byte
    const buf = Buffer.from([0x6e, 0x61, 0x6d, 0xe9]);
    expect(parser.detectEncoding(buf)).toBe('iso-8859-1');
  });

  it('strips UTF-8 BOM before parsing headers', () => {
    const csv = '\uFEFFname,email\nAlice,alice@example.com';
    const result = parser.parse(csv);
    expect(result.headers[0]).toBe('name'); // not '\uFEFFname'
  });

  // Req 66.10 – line numbers in parse errors
  it('reports correct line number for field count mismatch on line 3', () => {
    const csv = 'a,b,c\n1,2,3\nbad,row\n4,5,6';
    const result = parser.parse(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].line).toBe(3);
  });

  it('reports correct line number for unclosed quote', () => {
    const csv = 'a,b\n1,2\n"unclosed,value';
    const result = parser.parse(csv);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].line).toBeGreaterThanOrEqual(3);
  });

  it('reports line number 2 for error on first data row', () => {
    const csv = 'a,b\nbad';
    const result = parser.parse(csv);
    expect(result.errors[0].line).toBe(2);
  });
});

// ============================================================================
// Bulk Import Validation – edge cases (Req 25.2, 66.2, 66.3)
// ============================================================================

describe('BulkImportService – validation edge cases', () => {
  let service: BulkImportService;

  beforeEach(() => {
    service = new BulkImportService();
    jest.clearAllMocks();
  });

  // Req 66.2, 66.3 – header validation
  it('reports all missing required headers in one error', () => {
    const result = service.validateImport('users', [], ['email']); // missing first_name, last_name, role
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toMatch(/last_name/);
    expect(result.errors[0].message).toMatch(/role/);
  });

  it('returns rowCount=0 for empty data with valid headers', () => {
    const result = service.validateImport('users', [], ['email', 'first_name', 'last_name', 'role']);
    expect(result.valid).toBe(true);
    expect(result.rowCount).toBe(0);
  });

  // Req 25.2 – validate before import
  it('validates all rows and collects errors from multiple rows', () => {
    const rows = [
      { email: '', first_name: 'A', last_name: 'B', role: 'agent' },
      { email: 'bad-email', first_name: 'C', last_name: 'D', role: 'agent' },
      { email: 'ok@example.com', first_name: '', last_name: 'E', role: 'agent' },
    ];
    const result = service.validateImport('users', rows, ['email', 'first_name', 'last_name', 'role']);
    expect(result.valid).toBe(false);
    // Should have errors from rows 2, 3, and 4 (1-based + header)
    const rowNums = result.errors.map((e) => e.row);
    expect(rowNums).toContain(2); // first row (empty email)
    expect(rowNums).toContain(3); // second row (bad email)
    expect(rowNums).toContain(4); // third row (empty first_name)
  });

  it('validates client email format', () => {
    const rows = [{ name: 'Acme', email: 'not-valid', phone: '+254700000000' }];
    const result = service.validateImport('clients', rows, ['name', 'email', 'phone']);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'email')).toBe(true);
  });

  it('accepts valid email formats for clients', () => {
    const rows = [{ name: 'Acme', email: 'contact@acme.co.ke', phone: '+254700000000' }];
    const result = service.validateImport('clients', rows, ['name', 'email', 'phone']);
    expect(result.valid).toBe(true);
  });

  it('validates numeric price for properties', () => {
    const rows = [{ title: 'Plot', address: '1 St', price: 'not-a-number', type: 'Land' }];
    const result = service.validateImport('properties', rows, ['title', 'address', 'price', 'type']);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'price')).toBe(true);
  });

  it('accepts numeric string price for properties', () => {
    const rows = [{ title: 'Plot', address: '1 St', price: '500000', type: 'Land' }];
    const result = service.validateImport('properties', rows, ['title', 'address', 'price', 'type']);
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// Import Progress Tracking (Req 25.6, 25.7)
// ============================================================================

describe('BulkImportService – import progress tracking', () => {
  let service: BulkImportService;

  beforeEach(() => {
    service = new BulkImportService();
    jest.clearAllMocks();
  });

  // Req 25.6 – percentage completion
  it('calculates 0% progress for a newly created job', async () => {
    const row = {
      id: 'job-progress-1',
      entity_type: 'users',
      status: 'PENDING',
      total_records: 200,
      processed_records: 0,
      success_count: 0,
      failed_count: 0,
      errors: '[]',
      requested_by: 'user-1',
      created_at: new Date(),
      completed_at: null,
    };
    mockDb.query.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);

    const job = await service.getImportStatus('job-progress-1');
    const progress = job!.totalRecords > 0
      ? Math.round((job!.processedRecords / job!.totalRecords) * 100)
      : 0;
    expect(progress).toBe(0);
  });

  it('calculates 50% progress for half-processed job', async () => {
    const row = {
      id: 'job-progress-2',
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

    const job = await service.getImportStatus('job-progress-2');
    const progress = Math.round((job!.processedRecords / job!.totalRecords) * 100);
    expect(progress).toBe(50);
  });

  it('calculates 100% progress for completed job', async () => {
    const row = {
      id: 'job-progress-3',
      entity_type: 'properties',
      status: 'COMPLETED',
      total_records: 50,
      processed_records: 50,
      success_count: 50,
      failed_count: 0,
      errors: '[]',
      requested_by: 'user-1',
      created_at: new Date(),
      completed_at: new Date(),
    };
    mockDb.query.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);

    const job = await service.getImportStatus('job-progress-3');
    const progress = Math.round((job!.processedRecords / job!.totalRecords) * 100);
    expect(progress).toBe(100);
  });

  // Req 25.7 – summary report: success and failed counts
  it('provides success and failure summary on completed job', async () => {
    const row = {
      id: 'job-summary-1',
      entity_type: 'users',
      status: 'COMPLETED',
      total_records: 10,
      processed_records: 10,
      success_count: 8,
      failed_count: 2,
      errors: JSON.stringify([
        { row: 3, field: 'email', message: 'Invalid email' },
        { row: 7, field: 'role', message: 'Required field "role" is empty' },
      ]),
      requested_by: 'user-1',
      created_at: new Date(),
      completed_at: new Date(),
    };
    mockDb.query.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);

    const job = await service.getImportStatus('job-summary-1');
    expect(job!.status).toBe('COMPLETED');
    expect(job!.successCount).toBe(8);
    expect(job!.failedCount).toBe(2);
    expect(job!.totalRecords).toBe(10);
    expect(job!.errors).toHaveLength(2);
    expect(job!.errors[0].row).toBe(3);
    expect(job!.errors[1].row).toBe(7);
  });

  it('shows zero failures in summary when all records succeed', async () => {
    const row = {
      id: 'job-summary-2',
      entity_type: 'clients',
      status: 'COMPLETED',
      total_records: 5,
      processed_records: 5,
      success_count: 5,
      failed_count: 0,
      errors: '[]',
      requested_by: 'user-1',
      created_at: new Date(),
      completed_at: new Date(),
    };
    mockDb.query.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);

    const job = await service.getImportStatus('job-summary-2');
    expect(job!.successCount).toBe(5);
    expect(job!.failedCount).toBe(0);
    expect(job!.errors).toHaveLength(0);
  });

  // Req 25.5 – async processing: job is queued, not processed inline
  it('returns PENDING status immediately after startImport (async processing)', async () => {
    const validCsv = 'email,first_name,last_name,role\nuser@example.com,Alice,Smith,agent';
    const pendingRow = {
      id: 'job-async-1',
      entity_type: 'users',
      status: 'PENDING',
      total_records: 1,
      processed_records: 0,
      success_count: 0,
      failed_count: 0,
      errors: '[]',
      requested_by: 'user-1',
      created_at: new Date(),
      completed_at: null,
    };
    mockDb.query
      .mockResolvedValueOnce({ rows: [pendingRow], rowCount: 1 } as any) // INSERT
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // UPDATE csv storage

    const job = await service.startImport('users', validCsv, 'user-1');
    // Job should be PENDING, not COMPLETED – processing is async
    expect(job.status).toBe('PENDING');
    expect(job.processedRecords).toBe(0);
  });
});

// ============================================================================
// Bulk Status Updates – limit and audit logging (Req 25.8, 25.11, 25.12)
// ============================================================================

describe('BulkOperationsService – status updates', () => {
  let service: BulkOperationsService;

  function makeIds(count: number): string[] {
    return Array.from(
      { length: count },
      (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`
    );
  }

  beforeEach(() => {
    service = new BulkOperationsService();
    jest.clearAllMocks();
  });

  // Req 25.11 – 1000 record limit
  it('rejects bulk status update when ids exceed 1000', async () => {
    const ids = makeIds(1001);
    await expect(
      service.bulkUpdateStatus('clients', ids, 'inactive', 'user-1')
    ).rejects.toThrow(/1000/);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('rejects bulk assign when ids exceed 1000', async () => {
    const ids = makeIds(1001);
    await expect(
      service.bulkAssign('users', ids, 'user-99', 'user-1')
    ).rejects.toThrow(/1000/);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('allows exactly 1000 records for bulk status update', async () => {
    const ids = makeIds(1000);
    mockDb.query.mockResolvedValueOnce({
      rows: ids.map((id) => ({ id })),
      rowCount: 1000,
    } as any);

    const result = await service.bulkUpdateStatus('users', ids, 'active', 'user-1');
    expect(result.totalRequested).toBe(1000);
    expect(result.successCount).toBe(1000);
    expect(result.failedCount).toBe(0);
  });

  it('allows exactly 1000 records for bulk assign', async () => {
    const ids = makeIds(1000);
    mockDb.query.mockResolvedValueOnce({
      rows: ids.map((id) => ({ id })),
      rowCount: 1000,
    } as any);

    const result = await service.bulkAssign('clients', ids, 'user-99', 'user-1');
    expect(result.totalRequested).toBe(1000);
    expect(result.successCount).toBe(1000);
  });

  // Req 25.12 – audit logging
  it('logs bulk status update to audit log with correct metadata', async () => {
    const ids = makeIds(3);
    mockDb.query.mockResolvedValueOnce({
      rows: ids.map((id) => ({ id })),
      rowCount: 3,
    } as any);

    await service.bulkUpdateStatus('properties', ids, 'sold', 'user-admin');

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-admin',
        action: 'EXECUTE',
        resourceType: 'properties',
        result: 'SUCCESS',
        metadata: expect.objectContaining({
          operation: 'bulkUpdateStatus',
          newStatus: 'sold',
          totalRequested: 3,
          successCount: 3,
        }),
      })
    );
  });

  it('logs bulk assign to audit log with assignedUserId', async () => {
    const ids = makeIds(2);
    mockDb.query.mockResolvedValueOnce({
      rows: ids.map((id) => ({ id })),
      rowCount: 2,
    } as any);

    await service.bulkAssign('clients', ids, 'user-target', 'user-admin');

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-admin',
        action: 'EXECUTE',
        resourceType: 'clients',
        metadata: expect.objectContaining({
          operation: 'bulkAssign',
          assignedUserId: 'user-target',
        }),
      })
    );
  });

  it('logs FAILURE to audit when bulk update encounters db error', async () => {
    const ids = makeIds(5);
    mockDb.query.mockRejectedValueOnce(new Error('Connection timeout'));

    const result = await service.bulkUpdateStatus('users', ids, 'active', 'user-1');

    expect(result.failedCount).toBe(5);
    expect(result.successCount).toBe(0);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'FAILURE' })
    );
  });

  // Req 25.8 – update multiple records at once
  it('updates multiple records in a single database call', async () => {
    const ids = makeIds(5);
    mockDb.query.mockResolvedValueOnce({
      rows: ids.map((id) => ({ id })),
      rowCount: 5,
    } as any);

    await service.bulkUpdateStatus('clients', ids, 'active', 'user-1');

    // Should be exactly 1 DB call (batch update), not 5 individual calls
    expect(mockDb.query).toHaveBeenCalledTimes(1);
    const callArgs = mockDb.query.mock.calls[0];
    expect(callArgs[0]).toMatch(/UPDATE clients/i);
    expect(callArgs[0]).toMatch(/ANY\(\$2/i);
  });
});
