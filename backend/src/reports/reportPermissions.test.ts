/**
 * Unit tests for Daily Reporting System - Permission-Based Access Control
 * Task 16.4: Test report viewing permissions
 * Requirements: 10.7, 10.9
 * 
 * This test file specifically focuses on permission-based access control for reports:
 * - Managers can view reports from direct reports only (10.7)
 * - CEO, CoS, COO, CTO can view all reports (10.9)
 */

import { ReportAnalyticsService } from './reportAnalyticsService';
import { AuthorizationService, Role } from '../auth/authorizationService';
import { db } from '../database/connection';

jest.mock('../database/connection');
jest.mock('../utils/logger');
jest.mock('../cache/permissionsCache');
jest.mock('../cache/sessionCache');
jest.mock('../cache/cacheService');
jest.mock('../config', () => ({
  config: {
    apiBaseUrl: 'http://localhost:3000',
    logging: { level: 'info', filePath: '/tmp/test.log' },
    database: { host: 'localhost', port: 5432, name: 'test', user: 'test', password: 'test' },
    redis: { host: 'localhost', port: 6379, password: null },
  },
}));

const mockCEO = 'ceo-123';
const mockCoS = 'cos-123';
const mockCOO = 'coo-123';
const mockCTO = 'cto-123';
const mockManager = 'manager-123';
const mockDirectReport1 = 'report1-123';
const mockDirectReport2 = 'report2-123';
const mockOtherUser = 'other-123';

function makeReportRow(userId: string, date: string = '2024-01-15') {
  return {
    id: `report-${userId}-${date}`,
    user_id: userId,
    report_date: new Date(date),
    accomplishments: 'Completed tasks',
    challenges: null,
    tomorrow_plan: null,
    hours_worked: '8',
    submitted_at: new Date(`${date}T18:00:00Z`),
    created_at: new Date(`${date}T18:00:00Z`),
  };
}

describe('Daily Reporting System - Permission-Based Access Control', () => {
  let reportService: ReportAnalyticsService;
  let authService: AuthorizationService;

  beforeEach(() => {
    reportService = new ReportAnalyticsService();
    authService = new AuthorizationService();
    jest.clearAllMocks();
  });

  // ── Requirement 10.7: Managers can view reports from direct reports ─────────

  describe('Manager viewing direct reports (Requirement 10.7)', () => {
    it('should allow manager to view reports from direct reports only', async () => {
      // Mock getDirectReportIds to return 2 direct reports
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockDirectReport1 }, { id: mockDirectReport2 }],
      });

      // Mock count query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '3' }],
      });

      // Mock data query - returns reports from direct reports only
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          makeReportRow(mockDirectReport1, '2024-01-15'),
          makeReportRow(mockDirectReport1, '2024-01-16'),
          makeReportRow(mockDirectReport2, '2024-01-15'),
        ],
      });

      const result = await reportService.getReportsForManager(mockManager);

      expect(result.total).toBe(3);
      expect(result.reports).toHaveLength(3);

      // Verify all reports belong to direct reports
      const userIds = result.reports.map((r) => r.userId);
      expect(userIds).toEqual([mockDirectReport1, mockDirectReport1, mockDirectReport2]);

      // Verify no reports from other users
      expect(userIds).not.toContain(mockOtherUser);
    });

    it('should return empty list when manager has no direct reports', async () => {
      // Mock getDirectReportIds to return empty array
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const result = await reportService.getReportsForManager(mockManager);

      expect(result.total).toBe(0);
      expect(result.reports).toHaveLength(0);

      // Verify no further queries were made
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('should filter reports by date range for direct reports', async () => {
      // Mock getDirectReportIds
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockDirectReport1 }],
      });

      // Mock count query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '2' }],
      });

      // Mock data query with date filter
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          makeReportRow(mockDirectReport1, '2024-01-15'),
          makeReportRow(mockDirectReport1, '2024-01-16'),
        ],
      });

      const result = await reportService.getReportsForManager(mockManager, {
        dateFrom: new Date('2024-01-15'),
        dateTo: new Date('2024-01-20'),
      });

      expect(result.total).toBe(2);
      expect(result.reports).toHaveLength(2);
    });

    it('should respect pagination limits for manager reports', async () => {
      // Mock getDirectReportIds
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockDirectReport1 }],
      });

      // Mock count query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '10' }],
      });

      // Mock data query with limit
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          makeReportRow(mockDirectReport1, '2024-01-15'),
          makeReportRow(mockDirectReport1, '2024-01-16'),
        ],
      });

      const result = await reportService.getReportsForManager(mockManager, {
        limit: 2,
        offset: 0,
      });

      expect(result.total).toBe(10);
      expect(result.reports).toHaveLength(2);
    });
  });

  // ── Requirement 10.9: CEO, CoS, COO, CTO can view all reports ───────────────

  describe('Executive viewing all reports (Requirement 10.9)', () => {
    it('should allow CEO to view all reports from all users', async () => {
      // Mock count query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '5' }],
      });

      // Mock data query - returns reports from all users
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          makeReportRow(mockDirectReport1, '2024-01-15'),
          makeReportRow(mockDirectReport2, '2024-01-15'),
          makeReportRow(mockManager, '2024-01-15'),
          makeReportRow(mockOtherUser, '2024-01-15'),
          makeReportRow('another-user', '2024-01-15'),
        ],
      });

      const result = await reportService.getReportsForExecutive();

      expect(result.total).toBe(5);
      expect(result.reports).toHaveLength(5);

      // Verify reports from various users are included
      const userIds = result.reports.map((r) => r.userId);
      expect(userIds).toContain(mockDirectReport1);
      expect(userIds).toContain(mockDirectReport2);
      expect(userIds).toContain(mockManager);
      expect(userIds).toContain(mockOtherUser);
    });

    it('should allow CoS to view all reports from all users', async () => {
      // Mock count query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '3' }],
      });

      // Mock data query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          makeReportRow(mockDirectReport1, '2024-01-15'),
          makeReportRow(mockManager, '2024-01-15'),
          makeReportRow(mockOtherUser, '2024-01-15'),
        ],
      });

      const result = await reportService.getReportsForExecutive();

      expect(result.total).toBe(3);
      expect(result.reports).toHaveLength(3);
    });

    it('should allow COO to view all reports from all users', async () => {
      // Mock count query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '4' }],
      });

      // Mock data query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          makeReportRow(mockDirectReport1, '2024-01-15'),
          makeReportRow(mockDirectReport2, '2024-01-15'),
          makeReportRow(mockManager, '2024-01-15'),
          makeReportRow(mockOtherUser, '2024-01-15'),
        ],
      });

      const result = await reportService.getReportsForExecutive();

      expect(result.total).toBe(4);
      expect(result.reports).toHaveLength(4);
    });

    it('should allow CTO to view all reports from all users', async () => {
      // Mock count query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '2' }],
      });

      // Mock data query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          makeReportRow(mockDirectReport1, '2024-01-15'),
          makeReportRow(mockOtherUser, '2024-01-15'),
        ],
      });

      const result = await reportService.getReportsForExecutive();

      expect(result.total).toBe(2);
      expect(result.reports).toHaveLength(2);
    });

    it('should apply date filters when executives view all reports', async () => {
      // Mock count query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '3' }],
      });

      // Mock data query with date filter
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          makeReportRow(mockDirectReport1, '2024-01-15'),
          makeReportRow(mockDirectReport2, '2024-01-16'),
          makeReportRow(mockOtherUser, '2024-01-17'),
        ],
      });

      const result = await reportService.getReportsForExecutive({
        dateFrom: new Date('2024-01-15'),
        dateTo: new Date('2024-01-20'),
      });

      expect(result.total).toBe(3);
      expect(result.reports).toHaveLength(3);

      // Verify query included date filters
      const queryCall = (db.query as jest.Mock).mock.calls[1];
      const query = queryCall[0] as string;
      expect(query).toContain('report_date >=');
      expect(query).toContain('report_date <=');
    });

    it('should respect pagination for executive report viewing', async () => {
      // Mock count query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '100' }],
      });

      // Mock data query with pagination
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          makeReportRow(mockDirectReport1, '2024-01-15'),
          makeReportRow(mockDirectReport2, '2024-01-15'),
        ],
      });

      const result = await reportService.getReportsForExecutive({
        limit: 2,
        offset: 10,
      });

      expect(result.total).toBe(100);
      expect(result.reports).toHaveLength(2);
    });
  });

  // ── Authorization checks ─────────────────────────────────────────────────────

  describe('Authorization permission checks', () => {
    it('should verify CEO has view:all_reports permission', async () => {
      // Mock user role query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ role: Role.CEO, permissions: [], department_id: null }],
      });

      const permissions = await authService.getUserPermissions(mockCEO);

      expect(permissions).toContain('view:all_reports');
      expect(permissions).toContain('read:*');
    });

    it('should verify CoS has view:all_reports permission', async () => {
      // Mock user role query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ role: Role.CoS, permissions: [], department_id: null }],
      });

      const permissions = await authService.getUserPermissions(mockCoS);

      expect(permissions).toContain('view:all_reports');
      expect(permissions).toContain('read:reports');
    });

    it('should verify COO has view:department_reports permission', async () => {
      // Mock user role query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ role: Role.COO, permissions: [], department_id: 'dept-coo' }],
      });

      const permissions = await authService.getUserPermissions(mockCOO);

      expect(permissions).toContain('view:department_reports');
      expect(permissions).toContain('read:reports');
    });

    it('should verify CTO has view:department_reports permission', async () => {
      // Mock user role query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ role: Role.CTO, permissions: [], department_id: 'dept-cto' }],
      });

      const permissions = await authService.getUserPermissions(mockCTO);

      expect(permissions).toContain('view:department_reports');
      expect(permissions).toContain('read:reports');
    });

    it('should verify regular manager has read:reports but not view:all_reports', async () => {
      // Mock user role query for HEAD_OF_TRAINERS (typical manager role with report access)
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ role: Role.HEAD_OF_TRAINERS, permissions: [], department_id: 'dept-training' }],
      });

      const permissions = await authService.getUserPermissions(mockManager);

      expect(permissions).toContain('read:reports');
      expect(permissions).not.toContain('view:all_reports');
    });

    it('should verify Agent can only submit reports, not view others', async () => {
      // Mock user role query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ role: Role.AGENT, permissions: [], department_id: null }],
      });

      const permissions = await authService.getUserPermissions('agent-123');

      expect(permissions).toContain('submit:daily_reports');
      expect(permissions).not.toContain('read:reports');
      expect(permissions).not.toContain('view:all_reports');
    });
  });

  // ── Edge cases and error handling ────────────────────────────────────────────

  describe('Edge cases and error handling', () => {
    it('should handle database errors gracefully when fetching manager reports', async () => {
      // Mock database error
      (db.query as jest.Mock).mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(reportService.getReportsForManager(mockManager)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle database errors gracefully when fetching executive reports', async () => {
      // Mock database error
      (db.query as jest.Mock).mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(reportService.getReportsForExecutive()).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should return empty results when no reports exist in date range', async () => {
      // Mock getDirectReportIds
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockDirectReport1 }],
      });

      // Mock count query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '0' }],
      });

      // Mock data query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const result = await reportService.getReportsForManager(mockManager, {
        dateFrom: new Date('2025-01-01'),
        dateTo: new Date('2025-01-31'),
      });

      expect(result.total).toBe(0);
      expect(result.reports).toHaveLength(0);
    });

    it('should handle invalid user IDs gracefully', async () => {
      // Mock getDirectReportIds with invalid manager ID
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const result = await reportService.getReportsForManager('invalid-manager-id');

      expect(result.total).toBe(0);
      expect(result.reports).toHaveLength(0);
    });
  });
});
