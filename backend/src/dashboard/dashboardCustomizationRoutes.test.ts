/**
 * Route tests for dashboard customization and export endpoints
 * Requirements: 17.6, 17.7, 17.8, 17.9
 */
import request from 'supertest';
import express from 'express';
import dashboardRoutes from './dashboardRoutes';
import { dashboardService } from './dashboardService';

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

jest.mock('./dashboardService', () => ({
  dashboardService: {
    getCompanyMetrics: jest.fn(),
    getClientPipelineMetrics: jest.fn(),
    getProjectStatusMetrics: jest.fn(),
    getPaymentMetrics: jest.fn(),
    getTeamPerformanceMetrics: jest.fn(),
    getPropertyMetrics: jest.fn(),
    getRoleDashboard: jest.fn(),
    getMetricsWithTrend: jest.fn(),
    exportDashboardToPDF: jest.fn(),
    exportDashboardToExcel: jest.fn(),
    saveWidgetLayout: jest.fn(),
    getWidgetLayout: jest.fn(),
    getDateRangeForPeriod: jest.fn().mockReturnValue({ from: new Date('2024-01-01'), to: new Date('2024-01-31') }),
  },
}));

const mockService = dashboardService as jest.Mocked<typeof dashboardService>;

function buildApp(authenticated = true, role = 'CEO') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    if (authenticated) req.user = { id: 'user-1', role };
    next();
  });
  app.use('/api/dashboard', dashboardRoutes);
  return app;
}

describe('Dashboard Customization Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── GET /metrics/trend ────────────────────────────────────────────────────

  describe('GET /api/dashboard/metrics/trend', () => {
    const trendMock = {
      current: { revenue: { total: 200 } },
      previous: { revenue: { total: 150 } },
      trends: {
        revenue: { current: 200, previous: 150, change: 50, changePercent: 33.3, direction: 'up' },
        clients: { current: 10, previous: 8, change: 2, changePercent: 25, direction: 'up' },
        projects: { current: 5, previous: 4, change: 1, changePercent: 25, direction: 'up' },
        payments: { current: 20, previous: 15, change: 5, changePercent: 33.3, direction: 'up' },
      },
      generatedAt: new Date(),
    };

    it('returns 401 when not authenticated', async () => {
      const app = buildApp(false);
      const res = await request(app).get('/api/dashboard/metrics/trend');
      expect(res.status).toBe(401);
    });

    it('returns trend metrics for authenticated user', async () => {
      mockService.getMetricsWithTrend.mockResolvedValueOnce(trendMock as any);
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/metrics/trend');
      expect(res.status).toBe(200);
      expect(res.body.trends).toBeDefined();
      expect(res.body.trends.revenue.direction).toBe('up');
    });

    it('returns 500 on service error', async () => {
      mockService.getMetricsWithTrend.mockRejectedValueOnce(new Error('DB error'));
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/metrics/trend');
      expect(res.status).toBe(500);
    });

    it('passes date range to service', async () => {
      mockService.getMetricsWithTrend.mockResolvedValueOnce(trendMock as any);
      const app = buildApp();
      await request(app).get('/api/dashboard/metrics/trend?from=2024-01-01&to=2024-01-31');
      expect(mockService.getMetricsWithTrend).toHaveBeenCalledWith(
        expect.objectContaining({ from: expect.any(Date), to: expect.any(Date) })
      );
    });
  });

  // ─── GET /export/pdf ───────────────────────────────────────────────────────

  describe('GET /api/dashboard/export/pdf', () => {
    const pdfMock = {
      fileName: 'dashboard-2024.pdf',
      mimeType: 'application/pdf',
      data: Buffer.from('<html>test</html>'),
      generatedAt: new Date(),
    };

    it('returns 401 when not authenticated', async () => {
      const app = buildApp(false);
      const res = await request(app).get('/api/dashboard/export/pdf');
      expect(res.status).toBe(401);
    });

    it('returns PDF with correct content-type header', async () => {
      mockService.exportDashboardToPDF.mockResolvedValueOnce(pdfMock as any);
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/export/pdf');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('sets content-disposition attachment header', async () => {
      mockService.exportDashboardToPDF.mockResolvedValueOnce(pdfMock as any);
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/export/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('dashboard-2024.pdf');
    });

    it('returns 500 on service error', async () => {
      mockService.exportDashboardToPDF.mockRejectedValueOnce(new Error('Export failed'));
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/export/pdf');
      expect(res.status).toBe(500);
    });

    it('passes userId and role to service', async () => {
      mockService.exportDashboardToPDF.mockResolvedValueOnce(pdfMock as any);
      const app = buildApp(true, 'CFO');
      await request(app).get('/api/dashboard/export/pdf');
      expect(mockService.exportDashboardToPDF).toHaveBeenCalledWith('user-1', 'CFO', undefined);
    });
  });

  // ─── GET /export/excel ─────────────────────────────────────────────────────

  describe('GET /api/dashboard/export/excel', () => {
    const excelMock = {
      fileName: 'dashboard-2024.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: Buffer.from('Section,Metric,Value\nRevenue,Total,1000'),
      generatedAt: new Date(),
    };

    it('returns 401 when not authenticated', async () => {
      const app = buildApp(false);
      const res = await request(app).get('/api/dashboard/export/excel');
      expect(res.status).toBe(401);
    });

    it('returns Excel with correct content-type header', async () => {
      mockService.exportDashboardToExcel.mockResolvedValueOnce(excelMock as any);
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/export/excel');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
    });

    it('sets content-disposition attachment header', async () => {
      mockService.exportDashboardToExcel.mockResolvedValueOnce(excelMock as any);
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/export/excel');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('dashboard-2024.xlsx');
    });

    it('returns 500 on service error', async () => {
      mockService.exportDashboardToExcel.mockRejectedValueOnce(new Error('Export failed'));
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/export/excel');
      expect(res.status).toBe(500);
    });
  });

  // ─── POST /layout ──────────────────────────────────────────────────────────

  describe('POST /api/dashboard/layout', () => {
    const sampleWidgets = [
      { id: 'w1', type: 'revenue_chart', position: { x: 0, y: 0, w: 6, h: 4 }, visible: true },
    ];
    const layoutMock = {
      userId: 'user-1',
      widgets: sampleWidgets,
      updatedAt: new Date(),
    };

    it('returns 401 when not authenticated', async () => {
      const app = buildApp(false);
      const res = await request(app).post('/api/dashboard/layout').send({ widgets: sampleWidgets });
      expect(res.status).toBe(401);
    });

    it('saves and returns widget layout', async () => {
      mockService.saveWidgetLayout.mockResolvedValueOnce(layoutMock as any);
      const app = buildApp();
      const res = await request(app).post('/api/dashboard/layout').send({ widgets: sampleWidgets });
      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('user-1');
      expect(res.body.widgets).toHaveLength(1);
    });

    it('returns 400 when widgets is not an array', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/dashboard/layout').send({ widgets: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('returns 500 on service error', async () => {
      mockService.saveWidgetLayout.mockRejectedValueOnce(new Error('DB error'));
      const app = buildApp();
      const res = await request(app).post('/api/dashboard/layout').send({ widgets: sampleWidgets });
      expect(res.status).toBe(500);
    });

    it('passes userId and widgets to service', async () => {
      mockService.saveWidgetLayout.mockResolvedValueOnce(layoutMock as any);
      const app = buildApp();
      await request(app).post('/api/dashboard/layout').send({ widgets: sampleWidgets });
      expect(mockService.saveWidgetLayout).toHaveBeenCalledWith('user-1', sampleWidgets);
    });
  });

  // ─── GET /layout ───────────────────────────────────────────────────────────

  describe('GET /api/dashboard/layout', () => {
    const layoutMock = {
      userId: 'user-1',
      widgets: [{ id: 'w1', type: 'revenue_chart', position: { x: 0, y: 0, w: 6, h: 4 }, visible: true }],
      updatedAt: new Date(),
    };

    it('returns 401 when not authenticated', async () => {
      const app = buildApp(false);
      const res = await request(app).get('/api/dashboard/layout');
      expect(res.status).toBe(401);
    });

    it('returns widget layout for authenticated user', async () => {
      mockService.getWidgetLayout.mockResolvedValueOnce(layoutMock as any);
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/layout');
      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('user-1');
    });

    it('returns 404 when no layout found', async () => {
      mockService.getWidgetLayout.mockResolvedValueOnce(null as any);
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/layout');
      expect(res.status).toBe(404);
    });

    it('returns 500 on service error', async () => {
      mockService.getWidgetLayout.mockRejectedValueOnce(new Error('DB error'));
      const app = buildApp();
      const res = await request(app).get('/api/dashboard/layout');
      expect(res.status).toBe(500);
    });

    it('passes userId to service', async () => {
      mockService.getWidgetLayout.mockResolvedValueOnce(layoutMock as any);
      const app = buildApp();
      await request(app).get('/api/dashboard/layout');
      expect(mockService.getWidgetLayout).toHaveBeenCalledWith('user-1');
    });
  });
});
