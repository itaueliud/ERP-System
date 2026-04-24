import { ReportingService, ReportType, ColumnDefinition, ReportFilters, ReportMetadata } from './reportingService';

// Mock the database so tests don't need a real DB connection
jest.mock('../database/connection', () => ({
  db: {
    query: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../config', () => ({
  config: {
    apiBaseUrl: 'http://localhost:3000',
    logging: { level: 'info', filePath: '/tmp/test.log' },
    database: { host: 'localhost', port: 5432, name: 'test', user: 'test', password: 'test' },
  },
}));

import { db } from '../database/connection';
const mockDb = db as jest.Mocked<typeof db>;

describe('ReportingService', () => {
  let service: ReportingService;

  beforeEach(() => {
    service = new ReportingService();
    jest.clearAllMocks();
  });

  // ─── getReportTypes ──────────────────────────────────────────────────────────

  describe('getReportTypes', () => {
    it('returns all 6 report types', () => {
      const types = service.getReportTypes();
      expect(types).toHaveLength(6);
    });

    it('includes all expected report types', () => {
      const types = service.getReportTypes().map((t) => t.type);
      const expected: ReportType[] = [
        'CLIENTS', 'PROJECTS', 'PAYMENTS', 'CONTRACTS', 'DAILY_REPORTS', 'PROPERTY_LISTINGS',
      ];
      for (const t of expected) {
        expect(types).toContain(t);
      }
    });

    it('each report type has title, description, and columns', () => {
      for (const t of service.getReportTypes()) {
        expect(t.title).toBeTruthy();
        expect(t.description).toBeTruthy();
        expect(Array.isArray(t.columns)).toBe(true);
        expect(t.columns.length).toBeGreaterThan(0);
      }
    });
  });

  // ─── generateReport ──────────────────────────────────────────────────────────

  describe('generateReport', () => {
    it('returns metadata with reportType, generatedAt, generatedBy, filters, totalRecords', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ name: 'Test Client' }], rowCount: 1 } as any);

      const filters: ReportFilters = { status: 'LEAD' };
      const result = await service.generateReport('CLIENTS', filters, 'user-123');

      expect(result.metadata.reportType).toBe('CLIENTS');
      expect(result.metadata.generatedBy).toBe('user-123');
      expect(result.metadata.filters).toEqual(filters);
      expect(result.metadata.generatedAt).toBeInstanceOf(Date);
      expect(result.metadata.totalRecords).toBe(1);
    });

    it('throws for unknown report type', async () => {
      await expect(
        service.generateReport('UNKNOWN' as ReportType, {}, 'user-1')
      ).rejects.toThrow('Unknown report type');
    });

    it('passes date filters to the query', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const filters: ReportFilters = {
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-12-31'),
      };
      await service.generateReport('PAYMENTS', filters, 'user-1');

      const callArgs = mockDb.query.mock.calls[0];
      expect(callArgs[1]).toContain(filters.dateFrom);
      expect(callArgs[1]).toContain(filters.dateTo);
    });
  });

  // ─── generateCSV ─────────────────────────────────────────────────────────────

  describe('generateCSV', () => {
    const columns: ColumnDefinition[] = [
      { key: 'name', header: 'Name' },
      { key: 'amount', header: 'Amount', type: 'currency' },
      { key: 'created_at', header: 'Created At', type: 'date' },
    ];

    it('produces a header row', () => {
      const csv = service.generateCSV([], columns);
      expect(csv).toContain('"Name"');
      expect(csv).toContain('"Amount"');
      expect(csv).toContain('"Created At"');
    });

    it('produces one data row per record', () => {
      const data = [
        { name: 'Alice', amount: 100, created_at: null },
        { name: 'Bob', amount: 200, created_at: null },
      ];
      const csv = service.generateCSV(data, columns);
      const lines = csv.split('\n');
      expect(lines).toHaveLength(3); // header + 2 rows
    });

    it('escapes double quotes in values', () => {
      const data = [{ name: 'He said "hello"', amount: 0, created_at: null }];
      const csv = service.generateCSV(data, columns);
      expect(csv).toContain('He said ""hello""');
    });

    it('formats Date objects as ISO strings', () => {
      const date = new Date('2024-06-15T10:00:00Z');
      const data = [{ name: 'Test', amount: 0, created_at: date }];
      const csv = service.generateCSV(data, columns);
      expect(csv).toContain('2024-06-15');
    });

    it('handles null/undefined values as empty strings', () => {
      const data = [{ name: null, amount: undefined, created_at: null }];
      const csv = service.generateCSV(data, columns);
      const lines = csv.split('\n');
      expect(lines[1]).toBe('"","",""');
    });

    it('returns only header for empty data', () => {
      const csv = service.generateCSV([], columns);
      const lines = csv.split('\n');
      expect(lines).toHaveLength(1);
    });
  });

  // ─── generateExcel ───────────────────────────────────────────────────────────

  describe('generateExcel', () => {
    const columns: ColumnDefinition[] = [
      { key: 'name', header: 'Name', width: 25 },
      { key: 'amount', header: 'Amount', width: 15, type: 'currency' },
    ];

    const metadata: ReportMetadata = {
      reportType: 'CLIENTS',
      generatedAt: new Date(),
      generatedBy: 'user-1',
      filters: {},
      totalRecords: 2,
    };

    it('returns a Buffer', async () => {
      const data = [{ name: 'Alice', amount: 500 }];
      const buffer = await service.generateExcel(data, columns, metadata);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('produces a valid XLSX file (starts with PK zip header)', async () => {
      const data = [{ name: 'Bob', amount: 1000 }];
      const buffer = await service.generateExcel(data, columns, metadata);
      // XLSX files are ZIP archives starting with PK (0x50 0x4B)
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);
    });

    it('accepts custom sheet name', async () => {
      const buffer = await service.generateExcel([], columns, metadata, 'My Sheet');
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
  });

  // ─── buildReportHTML ─────────────────────────────────────────────────────────

  describe('buildReportHTML', () => {
    const columns: ColumnDefinition[] = [
      { key: 'name', header: 'Name' },
      { key: 'status', header: 'Status' },
    ];

    it('includes report title', () => {
      const report = {
        metadata: {
          reportType: 'CLIENTS' as ReportType,
          generatedAt: new Date(),
          generatedBy: 'user-1',
          filters: {},
          totalRecords: 1,
        },
        data: [{ name: 'Test Corp', status: 'LEAD' }],
      };
      const html = service.buildReportHTML(report, columns);
      expect(html).toContain('Clients Report');
    });

    it('includes metadata in the output', () => {
      const report = {
        metadata: {
          reportType: 'PAYMENTS' as ReportType,
          generatedAt: new Date('2024-01-15T10:00:00Z'),
          generatedBy: 'user-42',
          filters: { status: 'COMPLETED' },
          totalRecords: 5,
        },
        data: [],
      };
      const html = service.buildReportHTML(report, columns);
      expect(html).toContain('Records: 5');
      expect(html).toContain('status: COMPLETED');
    });

    it('renders table headers', () => {
      const report = {
        metadata: {
          reportType: 'PROJECTS' as ReportType,
          generatedAt: new Date(),
          generatedBy: 'u',
          filters: {},
          totalRecords: 0,
        },
        data: [],
      };
      const html = service.buildReportHTML(report, columns);
      expect(html).toContain('<th>Name</th>');
      expect(html).toContain('<th>Status</th>');
    });

    it('renders data rows', () => {
      const report = {
        metadata: {
          reportType: 'CLIENTS' as ReportType,
          generatedAt: new Date(),
          generatedBy: 'u',
          filters: {},
          totalRecords: 2,
        },
        data: [
          { name: 'Alpha Corp', status: 'LEAD' },
          { name: 'Beta Ltd', status: 'PROJECT' },
        ],
      };
      const html = service.buildReportHTML(report, columns);
      expect(html).toContain('Alpha Corp');
      expect(html).toContain('Beta Ltd');
      expect(html).toContain('LEAD');
    });

    it('returns valid HTML structure', () => {
      const report = {
        metadata: {
          reportType: 'CLIENTS' as ReportType,
          generatedAt: new Date(),
          generatedBy: 'u',
          filters: {},
          totalRecords: 0,
        },
        data: [],
      };
      const html = service.buildReportHTML(report, columns);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('</html>');
      expect(html).toContain('<table>');
    });
  });
});
