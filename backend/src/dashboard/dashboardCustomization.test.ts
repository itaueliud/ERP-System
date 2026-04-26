/**
 * Tests for dashboard customization and export features
 * Requirements: 17.6, 17.7, 17.8, 17.9, 17.10
 */
import { DashboardService, DateRangePeriod } from './dashboardService';

// Mock config
jest.mock('../config', () => ({
  default: {
    env: 'test',
    port: 3000,
    apiBaseUrl: 'http://localhost:3000',
    logging: { level: 'info', filePath: '/tmp/test.log' },
    database: { host: 'localhost', port: 5432, name: 'test', user: 'test', password: 'test' },
    redis: { host: 'localhost', port: 6379 },
    security: { corsOrigin: '*', rateLimitWindowMs: 60000, rateLimitMaxRequests: 100 },
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../database/connection', () => ({
  db: { query: jest.fn() },
}));

jest.mock('../cache/cacheService', () => ({
  cacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  CacheTTL: { DASHBOARD_METRICS: 300 },
  CachePrefix: { DASHBOARD: 'dashboard:' },
}));

import { db } from '../database/connection';
import { cacheService } from '../cache/cacheService';

const mockDb = db as jest.Mocked<typeof db>;
const mockCache = cacheService as jest.Mocked<typeof cacheService>;

describe('DashboardService - Customization & Export', () => {
  let service: DashboardService;

  beforeEach(() => {
    service = new DashboardService();
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
  });

  // ─── getDateRangeForPeriod ─────────────────────────────────────────────────

  describe('getDateRangeForPeriod', () => {
    it('returns today range with from = start of day', () => {
      const range = service.getDateRangeForPeriod('today');
      expect(range.from).toBeDefined();
      expect(range.to).toBeDefined();
      expect(range.from!.getHours()).toBe(0);
      expect(range.from!.getMinutes()).toBe(0);
      expect(range.from!.getSeconds()).toBe(0);
    });

    it('returns this_week range starting on Sunday', () => {
      const range = service.getDateRangeForPeriod('this_week');
      expect(range.from).toBeDefined();
      expect(range.from!.getDay()).toBe(0); // Sunday
    });

    it('returns this_month range starting on day 1', () => {
      const range = service.getDateRangeForPeriod('this_month');
      expect(range.from).toBeDefined();
      expect(range.from!.getDate()).toBe(1);
    });

    it('returns this_quarter range starting on first day of quarter', () => {
      const range = service.getDateRangeForPeriod('this_quarter');
      expect(range.from).toBeDefined();
      const startMonth = range.from!.getMonth();
      expect([0, 3, 6, 9]).toContain(startMonth);
      expect(range.from!.getDate()).toBe(1);
    });

    it('returns this_year range starting on Jan 1', () => {
      const range = service.getDateRangeForPeriod('this_year');
      expect(range.from).toBeDefined();
      expect(range.from!.getMonth()).toBe(0);
      expect(range.from!.getDate()).toBe(1);
    });

    it('returns empty range for custom period', () => {
      const range = service.getDateRangeForPeriod('custom');
      expect(range.from).toBeUndefined();
      expect(range.to).toBeUndefined();
    });

    it('from is before to for all named periods', () => {
      const periods: DateRangePeriod[] = ['today', 'this_week', 'this_month', 'this_quarter', 'this_year'];
      for (const period of periods) {
        const range = service.getDateRangeForPeriod(period);
        expect(range.from!.getTime()).toBeLessThanOrEqual(range.to!.getTime());
      }
    });
  });

  // ─── calculateTrend ────────────────────────────────────────────────────────

  describe('calculateTrend', () => {
    it('returns up direction when current > previous', () => {
      const trend = service.calculateTrend(120, 100);
      expect(trend.direction).toBe('up');
      expect(trend.change).toBe(20);
      expect(trend.changePercent).toBe(20);
    });

    it('returns down direction when current < previous', () => {
      const trend = service.calculateTrend(80, 100);
      expect(trend.direction).toBe('down');
      expect(trend.change).toBe(-20);
      expect(trend.changePercent).toBe(-20);
    });

    it('returns flat direction when current equals previous', () => {
      const trend = service.calculateTrend(100, 100);
      expect(trend.direction).toBe('flat');
      expect(trend.change).toBe(0);
      expect(trend.changePercent).toBe(0);
    });

    it('returns 100% change when previous is 0 and current > 0', () => {
      const trend = service.calculateTrend(50, 0);
      expect(trend.changePercent).toBe(100);
      expect(trend.direction).toBe('up');
    });

    it('returns 0% change when both are 0', () => {
      const trend = service.calculateTrend(0, 0);
      expect(trend.changePercent).toBe(0);
      expect(trend.direction).toBe('flat');
    });

    it('includes current and previous values in result', () => {
      const trend = service.calculateTrend(150, 100);
      expect(trend.current).toBe(150);
      expect(trend.previous).toBe(100);
    });
  });

  // ─── getMetricsWithTrend ───────────────────────────────────────────────────

  describe('getMetricsWithTrend', () => {

    it('returns trend indicators for revenue, clients, projects, payments', async () => {
      // current period queries then previous period queries
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ status: 'LEAD', count: '10' }] } as any)
        .mockResolvedValueOnce({ rows: [{ status: 'ACTIVE', count: '5', total_value: '50000' }] } as any)
        .mockResolvedValueOnce({ rows: [{ status: 'COMPLETED', count: '20', total_amount: '200000' }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '2' }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] } as any)
        // previous period
        .mockResolvedValueOnce({ rows: [{ status: 'LEAD', count: '8' }] } as any)
        .mockResolvedValueOnce({ rows: [{ status: 'ACTIVE', count: '4', total_value: '40000' }] } as any)
        .mockResolvedValueOnce({ rows: [{ status: 'COMPLETED', count: '15', total_amount: '150000' }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any);

      const result = await service.getMetricsWithTrend();

      expect(result.trends).toBeDefined();
      expect(result.trends.revenue).toBeDefined();
      expect(result.trends.clients).toBeDefined();
      expect(result.trends.projects).toBeDefined();
      expect(result.trends.payments).toBeDefined();
      expect(result.trends.revenue.direction).toBe('up');
      expect(result.generatedAt).toBeInstanceOf(Date);
    });
  });

  // ─── exportDashboardToExcel ────────────────────────────────────────────────

  describe('exportDashboardToExcel', () => {
    beforeEach(() => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ status: 'LEAD', count: '5' }] } as any)
        .mockResolvedValueOnce({ rows: [{ status: 'ACTIVE', count: '3', total_value: '30000' }] } as any)
        .mockResolvedValueOnce({ rows: [{ status: 'COMPLETED', count: '10', total_amount: '100000' }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '2' }] } as any);
    });

    it('returns ExportResult with correct mimeType', async () => {
      const result = await service.exportDashboardToExcel('user-1', 'CEO');
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('returns a Buffer as data', async () => {
      const result = await service.exportDashboardToExcel('user-1', 'CEO');
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it('fileName ends with .xlsx', async () => {
      const result = await service.exportDashboardToExcel('user-1', 'CEO');
      expect(result.fileName).toMatch(/\.xlsx$/);
    });

    it('CSV content includes revenue and clients sections', async () => {
      const result = await service.exportDashboardToExcel('user-1', 'CEO');
      const csv = result.data.toString('utf-8');
      expect(csv).toContain('Revenue,Total');
      expect(csv).toContain('Clients,Total');
      expect(csv).toContain('Projects,Total');
      expect(csv).toContain('Payments,Total');
    });

    it('generatedAt is a Date', async () => {
      const result = await service.exportDashboardToExcel('user-1', 'CEO');
      expect(result.generatedAt).toBeInstanceOf(Date);
    });
  });

  // ─── exportDashboardToPDF ──────────────────────────────────────────────────

  describe('exportDashboardToPDF', () => {
    beforeEach(() => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ status: 'LEAD', count: '5' }] } as any)
        .mockResolvedValueOnce({ rows: [{ status: 'ACTIVE', count: '3', total_value: '30000' }] } as any)
        .mockResolvedValueOnce({ rows: [{ status: 'COMPLETED', count: '10', total_amount: '100000' }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '2' }] } as any);
    });

    it('returns ExportResult with pdf mimeType', async () => {
      const result = await service.exportDashboardToPDF('user-1', 'CEO');
      expect(result.mimeType).toBe('application/pdf');
    });

    it('fileName ends with .pdf', async () => {
      const result = await service.exportDashboardToPDF('user-1', 'CEO');
      expect(result.fileName).toMatch(/\.pdf$/);
    });

    it('returns a Buffer as data', async () => {
      const result = await service.exportDashboardToPDF('user-1', 'CEO');
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it('generatedAt is a Date', async () => {
      const result = await service.exportDashboardToPDF('user-1', 'CEO');
      expect(result.generatedAt).toBeInstanceOf(Date);
    });
  });

  // ─── saveWidgetLayout / getWidgetLayout ────────────────────────────────────

  describe('saveWidgetLayout', () => {
    const sampleWidgets = [
      { id: 'w1', type: 'revenue_chart', position: { x: 0, y: 0, w: 6, h: 4 }, visible: true },
      { id: 'w2', type: 'client_pipeline', position: { x: 6, y: 0, w: 6, h: 4 }, visible: true },
    ];

    it('saves layout and returns WidgetLayout', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      const result = await service.saveWidgetLayout('user-1', sampleWidgets);
      expect(result.userId).toBe('user-1');
      expect(result.widgets).toEqual(sampleWidgets);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('calls db.query with INSERT ... ON CONFLICT', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      await service.saveWidgetLayout('user-1', sampleWidgets);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.arrayContaining(['user-1'])
      );
    });

    it('stores layout as JSON string in db', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      await service.saveWidgetLayout('user-1', sampleWidgets);
      const callArgs = (mockDb.query.mock.calls[0] as any[]);
      expect(callArgs[1][1]).toBe(JSON.stringify(sampleWidgets));
    });
  });

  describe('getWidgetLayout', () => {
    const sampleWidgets = [
      { id: 'w1', type: 'revenue_chart', position: { x: 0, y: 0, w: 6, h: 4 }, visible: true },
    ];

    it('returns null when no layout exists', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      const result = await service.getWidgetLayout('user-1');
      expect(result).toBeNull();
    });

    it('returns parsed WidgetLayout when layout exists', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          user_id: 'user-1',
          layout: JSON.stringify(sampleWidgets),
          updated_at: new Date().toISOString(),
        }],
      } as any);
      const result = await service.getWidgetLayout('user-1');
      expect(result).not.toBeNull();
      expect(result!.userId).toBe('user-1');
      expect(result!.widgets).toEqual(sampleWidgets);
      expect(result!.updatedAt).toBeInstanceOf(Date);
    });
  });
});
