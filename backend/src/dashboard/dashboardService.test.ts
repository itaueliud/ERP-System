import { DashboardService } from './dashboardService';

// Mock config to avoid env variable requirement
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

// Mock logger
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// Mock database
jest.mock('../database/connection', () => ({
  db: {
    query: jest.fn(),
  },
}));

// Mock cache service
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

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(() => {
    service = new DashboardService();
    jest.clearAllMocks();
    // Default: cache miss
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
  });

  // ─── getCachedMetrics ──────────────────────────────────────────────────────

  describe('getCachedMetrics', () => {
    it('returns cached value when cache hit', async () => {
      const cached = { value: 42 };
      mockCache.get.mockResolvedValueOnce(cached);

      const fetchFn = jest.fn();
      const result = await service.getCachedMetrics('test-key', fetchFn);

      expect(result).toEqual(cached);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('calls fetchFn and caches result on cache miss', async () => {
      const fresh = { value: 99 };
      const fetchFn = jest.fn().mockResolvedValue(fresh);

      const result = await service.getCachedMetrics('test-key', fetchFn);

      expect(result).toEqual(fresh);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledWith(
        'dashboard:test-key',
        fresh,
        300
      );
    });

    it('still fetches fresh data when cache read throws', async () => {
      mockCache.get.mockRejectedValueOnce(new Error('Redis down'));
      const fresh = { value: 7 };
      const fetchFn = jest.fn().mockResolvedValue(fresh);

      const result = await service.getCachedMetrics('test-key', fetchFn);
      expect(result).toEqual(fresh);
    });

    it('returns data even when cache write fails', async () => {
      mockCache.set.mockRejectedValueOnce(new Error('Redis write error'));
      const fresh = { value: 5 };
      const fetchFn = jest.fn().mockResolvedValue(fresh);

      const result = await service.getCachedMetrics('test-key', fetchFn);
      expect(result).toEqual(fresh);
    });
  });

  // ─── getClientPipelineMetrics ──────────────────────────────────────────────

  describe('getClientPipelineMetrics', () => {
    it('returns pipeline with correct percentages', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { status: 'LEAD', count: '3' },
          { status: 'PENDING_COMMITMENT', count: '1' },
        ],
      } as any);

      const result = await service.getClientPipelineMetrics();

      expect(result.total).toBe(4);
      expect(result.pipeline).toHaveLength(2);
      const lead = result.pipeline.find((p) => p.status === 'LEAD')!;
      expect(lead.count).toBe(3);
      expect(lead.percentage).toBe(75);
    });

    it('handles empty pipeline', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.getClientPipelineMetrics();

      expect(result.total).toBe(0);
      expect(result.pipeline).toHaveLength(0);
    });

    it('sets percentage to 0 when total is 0', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ status: 'LEAD', count: '0' }],
      } as any);

      const result = await service.getClientPipelineMetrics();
      expect(result.pipeline[0].percentage).toBe(0);
    });
  });

  // ─── getProjectStatusMetrics ───────────────────────────────────────────────

  describe('getProjectStatusMetrics', () => {
    it('returns project statuses with totals', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { status: 'ACTIVE', count: '5', total_value: '50000' },
          { status: 'COMPLETED', count: '2', total_value: '20000' },
        ],
      } as any);

      const result = await service.getProjectStatusMetrics();

      expect(result.total).toBe(7);
      expect(result.totalValue).toBe(70000);
      expect(result.statuses).toHaveLength(2);
      const active = result.statuses.find((s) => s.status === 'ACTIVE')!;
      expect(active.count).toBe(5);
      expect(active.totalValue).toBe(50000);
    });

    it('handles empty projects', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.getProjectStatusMetrics();
      expect(result.total).toBe(0);
      expect(result.totalValue).toBe(0);
    });
  });

  // ─── getPaymentMetrics ─────────────────────────────────────────────────────

  describe('getPaymentMetrics', () => {
    it('returns payment breakdown by status and method', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            { status: 'COMPLETED', count: '10', amount: '100000' },
            { status: 'PENDING', count: '3', amount: '30000' },
          ],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ payment_method: 'MPESA', count: '8', amount: '80000' }],
        } as any);

      const result = await service.getPaymentMetrics();

      expect(result.totalAmount).toBe(130000);
      expect(result.completedAmount).toBe(100000);
      expect(result.pendingAmount).toBe(30000);
      expect(result.byStatus).toHaveLength(2);
      expect(result.byMethod).toHaveLength(1);
      expect(result.byMethod[0].method).toBe('MPESA');
    });

    it('returns zero amounts when no payments', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.getPaymentMetrics();
      expect(result.totalAmount).toBe(0);
      expect(result.completedAmount).toBe(0);
    });
  });

  // ─── getTeamPerformanceMetrics ─────────────────────────────────────────────

  describe('getTeamPerformanceMetrics', () => {
    it('calculates submission rate correctly', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] } as any) // total users
        .mockResolvedValueOnce({ rows: [{ count: '8' }] } as any)  // users with reports
        .mockResolvedValueOnce({ rows: [{ count: '2' }] } as any); // overdue

      const result = await service.getTeamPerformanceMetrics();

      expect(result.totalUsers).toBe(10);
      expect(result.usersWithReports).toBe(8);
      expect(result.usersOverdue).toBe(2);
      expect(result.reportSubmissionRate).toBe(80);
    });

    it('returns 0 submission rate when no users', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any);

      const result = await service.getTeamPerformanceMetrics();
      expect(result.reportSubmissionRate).toBe(0);
    });
  });

  // ─── getPropertyMetrics ────────────────────────────────────────────────────

  describe('getPropertyMetrics', () => {
    it('returns property stats by status and type', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            { status: 'AVAILABLE', count: '10', total_value: '500000' },
            { status: 'SOLD', count: '3', total_value: '150000' },
          ],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ property_type: 'LAND', count: '8', total_value: '400000' }],
        } as any);

      const result = await service.getPropertyMetrics();

      expect(result.total).toBe(13);
      expect(result.available).toBe(10);
      expect(result.sold).toBe(3);
      expect(result.unavailable).toBe(0);
      expect(result.totalValue).toBe(650000);
      expect(result.byType).toHaveLength(1);
      expect(result.byType[0].type).toBe('LAND');
    });
  });

  // ─── getCompanyMetrics ─────────────────────────────────────────────────────

  describe('getCompanyMetrics', () => {
    it('aggregates all KPIs correctly', async () => {
      // clients, projects, payments, approvals, overdue reports
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            { status: 'LEAD', count: '5' },
            { status: 'PROJECT', count: '3' },
          ],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ status: 'ACTIVE', count: '3', total_value: '30000' }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ status: 'COMPLETED', count: '10', total_amount: '100000' }],
        } as any)
        .mockResolvedValueOnce({ rows: [{ count: '2' }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '4' }] } as any);

      const result = await service.getCompanyMetrics();

      expect(result.clients.total).toBe(8);
      expect(result.clients.leads).toBe(5);
      expect(result.clients.projects).toBe(3);
      expect(result.projects.active).toBe(3);
      expect(result.payments.completed).toBe(10);
      expect(result.revenue.completed).toBe(100000);
      expect(result.pendingApprovals).toBe(2);
      expect(result.overdueReports).toBe(4);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });
  });
});
