import { ReportAnalyticsService } from './reportAnalyticsService';
import { db } from '../database/connection';

jest.mock('../database/connection');
jest.mock('../utils/logger');
jest.mock('../config', () => ({
  config: {
    apiBaseUrl: 'http://localhost:3000',
    logging: { level: 'info', filePath: '/tmp/test.log' },
    database: { host: 'localhost', port: 5432, name: 'test', user: 'test', password: 'test' },
  },
}));

const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockManagerId = '223e4567-e89b-12d3-a456-426614174001';
const mockDirectReport1 = '323e4567-e89b-12d3-a456-426614174002';
const mockDirectReport2 = '423e4567-e89b-12d3-a456-426614174003';

function makeReportRow(overrides: Record<string, any> = {}) {
  return {
    id: '556e4567-e89b-12d3-a456-426614174004',
    user_id: mockUserId,
    report_date: new Date('2024-01-15'),
    accomplishments: 'Completed feature X',
    challenges: null,
    tomorrow_plan: null,
    hours_worked: '8',
    submitted_at: new Date('2024-01-15T18:00:00Z'),
    created_at: new Date('2024-01-15T18:00:00Z'),
    ...overrides,
  };
}

describe('ReportAnalyticsService', () => {
  let service: ReportAnalyticsService;

  beforeEach(() => {
    service = new ReportAnalyticsService();
    jest.clearAllMocks();
  });

  // ── getSubmissionRate ──────────────────────────────────────────────────────

  describe('getSubmissionRate', () => {
    it('should return submission rate for a user', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ submitted_count: '20', full_name: 'Alice', email: 'alice@test.com' }],
      });

      const result = await service.getSubmissionRate(mockUserId, 30);

      expect(result.userId).toBe(mockUserId);
      expect(result.fullName).toBe('Alice');
      expect(result.email).toBe('alice@test.com');
      expect(result.periodDays).toBe(30);
      expect(result.submittedDays).toBe(20);
      expect(result.rate).toBeGreaterThan(0);
      expect(result.rate).toBeLessThanOrEqual(1);
    });

    it('should cap rate at 1 when submitted days exceed expected', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ submitted_count: '999', full_name: 'Bob', email: 'bob@test.com' }],
      });

      const result = await service.getSubmissionRate(mockUserId, 30);

      expect(result.rate).toBe(1);
    });

    it('should return rate 0 when no reports submitted', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ submitted_count: '0', full_name: 'Charlie', email: 'charlie@test.com' }],
      });

      const result = await service.getSubmissionRate(mockUserId, 30);

      expect(result.submittedDays).toBe(0);
      expect(result.rate).toBe(0);
    });

    it('should throw when user not found', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(service.getSubmissionRate('non-existent', 30)).rejects.toThrow('User not found');
    });

    it('should use default 30 days when not specified', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ submitted_count: '15', full_name: 'Dave', email: 'dave@test.com' }],
      });

      const result = await service.getSubmissionRate(mockUserId);

      expect(result.periodDays).toBe(30);
    });
  });

  // ── getTeamSubmissionRates ─────────────────────────────────────────────────

  describe('getTeamSubmissionRates', () => {
    it('should return rates for all direct reports', async () => {
      // getDirectReportIds
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockDirectReport1 }, { id: mockDirectReport2 }],
      });
      // getSubmissionRate for report1
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ submitted_count: '20', full_name: 'Rep1', email: 'rep1@test.com' }],
      });
      // getSubmissionRate for report2
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ submitted_count: '10', full_name: 'Rep2', email: 'rep2@test.com' }],
      });

      const result = await service.getTeamSubmissionRates(mockManagerId, 30);

      expect(result.managerId).toBe(mockManagerId);
      expect(result.teamRates).toHaveLength(2);
      expect(result.teamAvgRate).toBeGreaterThan(0);
    });

    it('should return empty team rates when manager has no direct reports', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.getTeamSubmissionRates(mockManagerId, 30);

      expect(result.teamRates).toHaveLength(0);
      expect(result.teamAvgRate).toBe(0);
    });
  });

  // ── getWeeklySummary ───────────────────────────────────────────────────────

  describe('getWeeklySummary', () => {
    it('should return weekly summary with aggregated data', async () => {
      // user lookup
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockUserId, full_name: 'Alice' }],
      });
      // reports query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          makeReportRow({ accomplishments: 'Task A', challenges: 'Issue 1', hours_worked: '8' }),
          makeReportRow({
            id: 'other-id',
            report_date: new Date('2024-01-16'),
            accomplishments: 'Task B',
            challenges: null,
            hours_worked: '7',
          }),
        ],
      });

      const result = await service.getWeeklySummary(mockUserId, new Date('2024-01-15'));

      expect(result.userId).toBe(mockUserId);
      expect(result.fullName).toBe('Alice');
      expect(result.totalReports).toBe(2);
      expect(result.totalHoursWorked).toBe(15);
      expect(result.averageHoursPerDay).toBe(7.5);
      expect(result.accomplishments).toEqual(['Task A', 'Task B']);
      expect(result.challenges).toEqual(['Issue 1']);
    });

    it('should return empty summary when no reports in week', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockUserId, full_name: 'Alice' }],
      });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.getWeeklySummary(mockUserId, new Date('2024-01-15'));

      expect(result.totalReports).toBe(0);
      expect(result.totalHoursWorked).toBe(0);
      expect(result.averageHoursPerDay).toBe(0);
      expect(result.accomplishments).toHaveLength(0);
    });

    it('should throw when user not found', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(service.getWeeklySummary('non-existent')).rejects.toThrow('User not found');
    });

    it('should default to current week when weekStart not provided', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockUserId, full_name: 'Alice' }],
      });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.getWeeklySummary(mockUserId);

      // weekStart should be a Monday
      expect(result.weekStart.getDay()).toBe(1);
      // weekEnd should be a Sunday
      expect(result.weekEnd.getDay()).toBe(0);
    });
  });

  // ── getTeamWeeklySummary ───────────────────────────────────────────────────

  describe('getTeamWeeklySummary', () => {
    it('should return summaries for all direct reports', async () => {
      // getDirectReportIds
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockDirectReport1 }],
      });
      // user lookup for report1
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockDirectReport1, full_name: 'Rep1' }],
      });
      // reports for report1
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.getTeamWeeklySummary(mockManagerId, new Date('2024-01-15'));

      expect(result.managerId).toBe(mockManagerId);
      expect(result.memberSummaries).toHaveLength(1);
    });

    it('should return empty summaries when no direct reports', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.getTeamWeeklySummary(mockManagerId);

      expect(result.memberSummaries).toHaveLength(0);
    });
  });

  // ── getReportsForManager ───────────────────────────────────────────────────

  describe('getReportsForManager', () => {
    it('should return reports from direct reports', async () => {
      // getDirectReportIds
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockDirectReport1 }, { id: mockDirectReport2 }],
      });
      // count query
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '3' }] });
      // data query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          makeReportRow({ user_id: mockDirectReport1 }),
          makeReportRow({ id: 'r2', user_id: mockDirectReport1 }),
          makeReportRow({ id: 'r3', user_id: mockDirectReport2 }),
        ],
      });

      const result = await service.getReportsForManager(mockManagerId);

      expect(result.total).toBe(3);
      expect(result.reports).toHaveLength(3);
    });

    it('should return empty when manager has no direct reports', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.getReportsForManager(mockManagerId);

      expect(result.total).toBe(0);
      expect(result.reports).toHaveLength(0);
    });
  });

  // ── getReportsForExecutive ─────────────────────────────────────────────────

  describe('getReportsForExecutive', () => {
    it('should return all reports without user restriction', async () => {
      // count query
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '5' }] });
      // data query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          makeReportRow(),
          makeReportRow({ id: 'r2' }),
          makeReportRow({ id: 'r3' }),
          makeReportRow({ id: 'r4' }),
          makeReportRow({ id: 'r5' }),
        ],
      });

      const result = await service.getReportsForExecutive();

      expect(result.total).toBe(5);
      expect(result.reports).toHaveLength(5);
    });

    it('should apply date filters when provided', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [makeReportRow()] });

      const result = await service.getReportsForExecutive({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
      });

      expect(result.total).toBe(1);
    });
  });

  // ── week range helper ──────────────────────────────────────────────────────

  describe('week range calculation', () => {
    it('should correctly identify Monday as week start for a Wednesday', async () => {
      // Wednesday 2024-01-17 → week starts Monday 2024-01-15
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockUserId, full_name: 'Alice' }],
      });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.getWeeklySummary(mockUserId, new Date('2024-01-17'));

      // weekStart should be a Monday
      expect(result.weekStart.getDay()).toBe(1);
      // weekEnd should be a Sunday
      expect(result.weekEnd.getDay()).toBe(0);
      // 7 days apart
      const diff = result.weekEnd.getTime() - result.weekStart.getTime();
      expect(diff).toBe(6 * 24 * 60 * 60 * 1000);
    });

    it('should handle Sunday as start of previous week', async () => {
      // Sunday 2024-01-14 → week starts Monday 2024-01-08
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockUserId, full_name: 'Alice' }],
      });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.getWeeklySummary(mockUserId, new Date('2024-01-14'));

      // weekStart should be a Monday
      expect(result.weekStart.getDay()).toBe(1);
      // weekEnd should be a Sunday
      expect(result.weekEnd.getDay()).toBe(0);
    });
  });
});
