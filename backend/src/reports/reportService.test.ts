import { DailyReportService } from './reportService';
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
const mockReportId = '456e4567-e89b-12d3-a456-426614174001';

function makeDbRow(overrides: Record<string, any> = {}) {
  return {
    id: mockReportId,
    user_id: mockUserId,
    report_date: new Date('2024-01-15'),
    accomplishments: 'Completed feature X',
    challenges: null,
    tomorrow_plan: null,
    hours_worked: null,
    submitted_at: new Date(),
    created_at: new Date(),
    ...overrides,
  };
}

describe('DailyReportService', () => {
  let service: DailyReportService;

  beforeEach(() => {
    service = new DailyReportService();
    jest.clearAllMocks();
  });

  describe('submitReport', () => {
    it('should submit a report with required fields only', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [makeDbRow()] });

      const result = await service.submitReport(mockUserId, {
        accomplishments: 'Completed feature X',
      });

      expect(result.userId).toBe(mockUserId);
      expect(result.accomplishments).toBe('Completed feature X');
      expect(result.challenges).toBeUndefined();
      expect(result.hoursWorked).toBeUndefined();
    });

    it('should submit a report with all fields', async () => {
      const row = makeDbRow({
        challenges: 'Blocked by API issue',
        tomorrow_plan: 'Fix the API',
        hours_worked: '8.50',
      });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [row] });

      const result = await service.submitReport(mockUserId, {
        accomplishments: 'Completed feature X',
        challenges: 'Blocked by API issue',
        tomorrowPlan: 'Fix the API',
        hoursWorked: 8.5,
      });

      expect(result.challenges).toBe('Blocked by API issue');
      expect(result.tomorrowPlan).toBe('Fix the API');
      expect(result.hoursWorked).toBe(8.5);
    });

    it('should reject empty accomplishments', async () => {
      await expect(
        service.submitReport(mockUserId, { accomplishments: '' })
      ).rejects.toThrow('accomplishments is required');
    });

    it('should reject hours_worked below 0', async () => {
      await expect(
        service.submitReport(mockUserId, { accomplishments: 'Done', hoursWorked: -1 })
      ).rejects.toThrow('hours_worked must be between 0 and 24');
    });

    it('should reject hours_worked above 24', async () => {
      await expect(
        service.submitReport(mockUserId, { accomplishments: 'Done', hoursWorked: 25 })
      ).rejects.toThrow('hours_worked must be between 0 and 24');
    });

    it('should allow hours_worked of exactly 0 and 24', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [makeDbRow({ hours_worked: '0' })] });

      await expect(
        service.submitReport(mockUserId, { accomplishments: 'Done', hoursWorked: 0 })
      ).resolves.not.toThrow();

      (db.query as jest.Mock).mockResolvedValue({ rows: [makeDbRow({ hours_worked: '24' })] });

      await expect(
        service.submitReport(mockUserId, { accomplishments: 'Done', hoursWorked: 24 })
      ).resolves.not.toThrow();
    });
  });

  describe('getReport', () => {
    it('should return a report for a given user and date', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [makeDbRow()] });

      const result = await service.getReport(mockUserId, new Date('2024-01-15'));

      expect(result).not.toBeNull();
      expect(result!.userId).toBe(mockUserId);
    });

    it('should return null when no report exists', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.getReport(mockUserId, new Date('2024-01-15'));

      expect(result).toBeNull();
    });
  });

  describe('getReportById', () => {
    it('should return a report by ID', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [makeDbRow()] });

      const result = await service.getReportById(mockReportId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(mockReportId);
    });

    it('should return null for non-existent ID', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.getReportById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listReports', () => {
    it('should list reports with no filters', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '2' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [makeDbRow(), makeDbRow({ id: 'other-id' })] });

      const result = await service.listReports();

      expect(result.total).toBe(2);
      expect(result.reports).toHaveLength(2);
    });

    it('should filter by userId', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [makeDbRow()] });

      const result = await service.listReports({ userId: mockUserId });

      expect(result.total).toBe(1);
    });

    it('should return empty list when no reports match', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '0' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.listReports({ userId: 'no-reports-user' });

      expect(result.total).toBe(0);
      expect(result.reports).toHaveLength(0);
    });
  });

  describe('updateReport', () => {
    it('should update an existing report', async () => {
      // getReportById
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [makeDbRow()] });
      // update query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [makeDbRow({ accomplishments: 'Updated accomplishments' })],
      });

      const result = await service.updateReport(mockReportId, mockUserId, {
        accomplishments: 'Updated accomplishments',
      });

      expect(result.accomplishments).toBe('Updated accomplishments');
    });

    it('should reject update for non-existent report', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateReport('non-existent', mockUserId, { accomplishments: 'X' })
      ).rejects.toThrow('Report not found');
    });

    it('should reject update by non-owner', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [makeDbRow()] });

      await expect(
        service.updateReport(mockReportId, 'different-user-id', { accomplishments: 'X' })
      ).rejects.toThrow('Unauthorized: You can only update your own reports');
    });

    it('should reject update with empty accomplishments', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [makeDbRow()] });

      await expect(
        service.updateReport(mockReportId, mockUserId, { accomplishments: '' })
      ).rejects.toThrow('accomplishments cannot be empty');
    });

    it('should reject update with invalid hours_worked', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [makeDbRow()] });

      await expect(
        service.updateReport(mockReportId, mockUserId, { hoursWorked: 30 })
      ).rejects.toThrow('hours_worked must be between 0 and 24');
    });

    it('should reject update with no fields', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [makeDbRow()] });

      await expect(
        service.updateReport(mockReportId, mockUserId, {})
      ).rejects.toThrow('No fields to update');
    });
  });
});
