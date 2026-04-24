import request from 'supertest';
import express from 'express';
import dashboardRoutes from './dashboardRoutes';
import { dashboardService } from './dashboardService';

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

jest.mock('./dashboardService', () => ({
  dashboardService: {
    getCompanyMetrics: jest.fn(),
    getClientPipelineMetrics: jest.fn(),
    getProjectStatusMetrics: jest.fn(),
    getPaymentMetrics: jest.fn(),
    getTeamPerformanceMetrics: jest.fn(),
    getPropertyMetrics: jest.fn(),
    getRoleDashboard: jest.fn(),
  },
}));

const mockService = dashboardService as jest.Mocked<typeof dashboardService>;

// Build a minimal Express app with a fake auth middleware
function buildApp(authenticated = true) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    if (authenticated) req.user = { id: 'user-1', role: 'CEO' };
    next();
  });
  app.use('/api/dashboard', dashboardRoutes);
  return app;
}

const companyMetricsMock = {
  revenue: { total: 1000, completed: 800, pending: 200, currency: 'USD' },
  clients: { total: 10, pendingCommitment: 2, leads: 3, qualifiedLeads: 2, projects: 3 },
  projects: { total: 5, pendingApproval: 1, active: 3, onHold: 0, completed: 1, cancelled: 0 },
  payments: { total: 20, completed: 15, pending: 3, failed: 2, refunded: 0, totalAmount: 1000, completedAmount: 800 },
  pendingApprovals: 1,
  overdueReports: 2,
  generatedAt: new Date(),
};

describe('Dashboard Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /api/dashboard/metrics', () => {
    it('returns 401 when not authenticated', async () => {
      const app = buildApp(false);
      const res = await request(app).get('/api/dashboard/metrics');
      expect(res.status).toBe(401);
    });

    it('returns company metrics', async () => {
      mockService.getCompanyMetrics.mockResolvedValueOnce(companyMetricsMock as any);
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/metrics');
      expect(res.status).toBe(200);
      expect(res.body.clients.total).toBe(10);
    });

    it('returns 500 on service error', async () => {
      mockService.getCompanyMetrics.mockRejectedValueOnce(new Error('DB error'));
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/metrics');
      expect(res.status).toBe(500);
    });

    it('passes date range query params to service', async () => {
      mockService.getCompanyMetrics.mockResolvedValueOnce(companyMetricsMock as any);
      const app = buildApp();
      await request(app).get('/api/dashboard/metrics?from=2024-01-01&to=2024-12-31');
      expect(mockService.getCompanyMetrics).toHaveBeenCalledWith(
        expect.objectContaining({ from: expect.any(Date), to: expect.any(Date) })
      );
    });
  });

  describe('GET /api/dashboard/client-pipeline', () => {
    it('returns client pipeline metrics', async () => {
      const mock = { pipeline: [{ status: 'LEAD', count: 5, percentage: 100 }], total: 5, generatedAt: new Date() };
      mockService.getClientPipelineMetrics.mockResolvedValueOnce(mock as any);
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/client-pipeline');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(5);
    });

    it('returns 401 when not authenticated', async () => {
      const app = buildApp(false);
      const res = await request(app).get('/api/dashboard/client-pipeline');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/dashboard/projects', () => {
    it('returns project status metrics', async () => {
      const mock = { statuses: [], total: 0, totalValue: 0, generatedAt: new Date() };
      mockService.getProjectStatusMetrics.mockResolvedValueOnce(mock as any);
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/projects');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
    });
  });

  describe('GET /api/dashboard/payments', () => {
    it('returns payment metrics', async () => {
      const mock = {
        totalAmount: 5000, completedAmount: 4000, pendingAmount: 1000,
        failedAmount: 0, refundedAmount: 0, byStatus: [], byMethod: [], generatedAt: new Date(),
      };
      mockService.getPaymentMetrics.mockResolvedValueOnce(mock as any);
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/payments');
      expect(res.status).toBe(200);
      expect(res.body.totalAmount).toBe(5000);
    });
  });

  describe('GET /api/dashboard/team-performance', () => {
    it('returns team performance metrics', async () => {
      const mock = {
        totalUsers: 10, reportSubmissionRate: 80, usersWithReports: 8,
        usersOverdue: 2, generatedAt: new Date(),
      };
      mockService.getTeamPerformanceMetrics.mockResolvedValueOnce(mock as any);
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/team-performance');
      expect(res.status).toBe(200);
      expect(res.body.reportSubmissionRate).toBe(80);
    });

    it('passes managerId query param to service', async () => {
      const mock = { totalUsers: 5, reportSubmissionRate: 60, usersWithReports: 3, usersOverdue: 2, generatedAt: new Date() };
      mockService.getTeamPerformanceMetrics.mockResolvedValueOnce(mock as any);
      const app = buildApp();
      await request(app).get('/api/dashboard/team-performance?managerId=mgr-1');
      expect(mockService.getTeamPerformanceMetrics).toHaveBeenCalledWith('mgr-1');
    });
  });

  describe('GET /api/dashboard/properties', () => {
    it('returns property metrics', async () => {
      const mock = {
        total: 20, available: 15, sold: 3, unavailable: 2,
        totalValue: 1000000, byType: [], generatedAt: new Date(),
      };
      mockService.getPropertyMetrics.mockResolvedValueOnce(mock as any);
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/properties');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(20);
    });
  });

  describe('GET /api/dashboard/role', () => {
    it('returns 401 when not authenticated', async () => {
      const app = buildApp(false);
      const res = await request(app).get('/api/dashboard/role');
      expect(res.status).toBe(401);
    });

    it('returns role-specific dashboard for authenticated user', async () => {
      const mock = { companyMetrics: {}, pendingApprovals: [], securityAlerts: [], generatedAt: new Date() };
      (mockService as any).getRoleDashboard.mockResolvedValueOnce(mock);
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/role');
      expect(res.status).toBe(200);
      expect(res.body.pendingApprovals).toEqual([]);
    });

    it('passes userId and role from auth token to service', async () => {
      const mock = { generatedAt: new Date() };
      (mockService as any).getRoleDashboard.mockResolvedValueOnce(mock);
      const app = buildApp();
      await request(app).get('/api/dashboard/role');
      expect((mockService as any).getRoleDashboard).toHaveBeenCalledWith('user-1', 'CEO', undefined);
    });

    it('passes date range when provided', async () => {
      const mock = { generatedAt: new Date() };
      (mockService as any).getRoleDashboard.mockResolvedValueOnce(mock);
      const app = buildApp();
      await request(app).get('/api/dashboard/role?from=2024-01-01&to=2024-12-31');
      expect((mockService as any).getRoleDashboard).toHaveBeenCalledWith(
        'user-1',
        'CEO',
        expect.objectContaining({ from: expect.any(Date), to: expect.any(Date) })
      );
    });

    it('returns 500 on service error', async () => {
      (mockService as any).getRoleDashboard.mockRejectedValueOnce(new Error('DB error'));
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/role');
      expect(res.status).toBe(500);
    });
  });
});
