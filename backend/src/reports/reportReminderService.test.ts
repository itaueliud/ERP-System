import { ReportReminderService } from './reportReminderService';
import { db } from '../database/connection';
import { notificationService } from '../notifications/notificationService';

jest.mock('../database/connection', () => ({
  db: { query: jest.fn() },
}));

jest.mock('../notifications/notificationService', () => ({
  notificationService: {
    sendNotification: jest.fn().mockResolvedValue({}),
  },
  NotificationPriority: { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' },
  NotificationType: {
    REPORT_OVERDUE: 'REPORT_OVERDUE',
    PAYMENT_APPROVAL: 'PAYMENT_APPROVAL',
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockDb = db.query as jest.Mock;
const mockSendNotification = notificationService.sendNotification as jest.Mock;

describe('ReportReminderService', () => {
  let service: ReportReminderService;

  beforeEach(() => {
    service = new ReportReminderService();
    jest.clearAllMocks();
  });

  // ── checkMissingReports ──────────────────────────────────────────────────

  describe('checkMissingReports', () => {
    it('returns users who have not submitted a report for the given date', async () => {
      mockDb.mockResolvedValueOnce({
        rows: [
          { user_id: 'u1', email: 'alice@test.com', full_name: 'Alice', manager_id: 'm1', timezone: 'UTC' },
          { user_id: 'u2', email: 'bob@test.com', full_name: 'Bob', manager_id: null, timezone: 'Africa/Nairobi' },
        ],
      });

      const result = await service.checkMissingReports(new Date('2024-01-15'));

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ userId: 'u1', email: 'alice@test.com', fullName: 'Alice', managerId: 'm1' });
      expect(result[1]).toMatchObject({ userId: 'u2', managerId: undefined });
    });

    it('returns empty array when all users have submitted reports', async () => {
      mockDb.mockResolvedValueOnce({ rows: [] });

      const result = await service.checkMissingReports(new Date('2024-01-15'));

      expect(result).toHaveLength(0);
    });

    it('uses today as default date when none provided', async () => {
      mockDb.mockResolvedValueOnce({ rows: [] });

      await service.checkMissingReports();

      expect(mockDb).toHaveBeenCalledTimes(1);
      const [, params] = mockDb.mock.calls[0];
      // The date passed should have time zeroed out
      expect(params[0].getHours()).toBe(0);
    });

    it('throws when database query fails', async () => {
      mockDb.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.checkMissingReports()).rejects.toThrow('DB error');
    });
  });

  // ── sendReminders ────────────────────────────────────────────────────────

  describe('sendReminders', () => {
    it('sends notifications to all users missing reports', async () => {
      mockDb.mockResolvedValueOnce({
        rows: [
          { user_id: 'u1', email: 'alice@test.com', full_name: 'Alice', manager_id: 'm1', timezone: 'UTC' },
          { user_id: 'u2', email: 'bob@test.com', full_name: 'Bob', manager_id: null, timezone: 'UTC' },
        ],
      });
      mockSendNotification.mockResolvedValue({});

      const result = await service.sendReminders(new Date('2024-01-15'));

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockSendNotification).toHaveBeenCalledTimes(2);
    });

    it('counts failed notifications separately', async () => {
      mockDb.mockResolvedValueOnce({
        rows: [
          { user_id: 'u1', email: 'alice@test.com', full_name: 'Alice', manager_id: null, timezone: 'UTC' },
          { user_id: 'u2', email: 'bob@test.com', full_name: 'Bob', manager_id: null, timezone: 'UTC' },
        ],
      });
      mockSendNotification
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('SMS failed'));

      const result = await service.sendReminders();

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('returns zero counts when no users are missing reports', async () => {
      mockDb.mockResolvedValueOnce({ rows: [] });

      const result = await service.sendReminders();

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('sends REPORT_OVERDUE notification type', async () => {
      mockDb.mockResolvedValueOnce({
        rows: [{ user_id: 'u1', email: 'alice@test.com', full_name: 'Alice', manager_id: null, timezone: 'UTC' }],
      });
      mockSendNotification.mockResolvedValue({});

      await service.sendReminders(new Date('2024-01-15'));

      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          type: 'REPORT_OVERDUE',
        })
      );
    });
  });

  // ── markOverdueUsers ─────────────────────────────────────────────────────

  describe('markOverdueUsers', () => {
    it('inserts overdue flags and returns overdue users', async () => {
      // First query: INSERT returning new flags
      mockDb.mockResolvedValueOnce({
        rows: [{ user_id: 'u1', report_date: new Date('2024-01-15'), marked_overdue_at: new Date() }],
      });
      // Second query: SELECT full user details
      mockDb.mockResolvedValueOnce({
        rows: [
          {
            user_id: 'u1',
            email: 'alice@test.com',
            full_name: 'Alice',
            manager_id: 'm1',
            report_date: new Date('2024-01-15'),
            marked_overdue_at: new Date(),
          },
        ],
      });

      const result = await service.markOverdueUsers(new Date('2024-01-15'));

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ userId: 'u1', fullName: 'Alice', managerId: 'm1' });
    });

    it('returns empty array when no new overdue users', async () => {
      mockDb.mockResolvedValueOnce({ rows: [] });

      const result = await service.markOverdueUsers(new Date('2024-01-15'));

      expect(result).toHaveLength(0);
    });

    it('throws when database query fails', async () => {
      mockDb.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.markOverdueUsers()).rejects.toThrow('DB error');
    });
  });

  // ── notifyManagers ───────────────────────────────────────────────────────

  describe('notifyManagers', () => {
    it('groups overdue users by manager and sends one notification per manager', async () => {
      mockDb.mockResolvedValueOnce({
        rows: [
          { user_id: 'u1', full_name: 'Alice', manager_id: 'm1' },
          { user_id: 'u2', full_name: 'Bob', manager_id: 'm1' },
          { user_id: 'u3', full_name: 'Carol', manager_id: 'm2' },
        ],
      });
      mockSendNotification.mockResolvedValue({});

      const result = await service.notifyManagers(['u1', 'u2', 'u3']);

      expect(result.sent).toBe(2); // 2 managers
      expect(result.failed).toBe(0);
      expect(mockSendNotification).toHaveBeenCalledTimes(2);
    });

    it('skips users without a manager', async () => {
      mockDb.mockResolvedValueOnce({
        rows: [{ user_id: 'u1', full_name: 'Alice', manager_id: 'm1' }],
        // u2 has no manager_id so it won't appear in the query result
      });
      mockSendNotification.mockResolvedValue({});

      const result = await service.notifyManagers(['u1', 'u2']);

      expect(result.sent).toBe(1);
    });

    it('returns zero counts for empty input', async () => {
      const result = await service.notifyManagers([]);

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockDb).not.toHaveBeenCalled();
    });

    it('counts failed manager notifications', async () => {
      mockDb.mockResolvedValueOnce({
        rows: [
          { user_id: 'u1', full_name: 'Alice', manager_id: 'm1' },
          { user_id: 'u2', full_name: 'Bob', manager_id: 'm2' },
        ],
      });
      mockSendNotification
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Push failed'));

      const result = await service.notifyManagers(['u1', 'u2']);

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('sends HIGH priority notification to managers', async () => {
      mockDb.mockResolvedValueOnce({
        rows: [{ user_id: 'u1', full_name: 'Alice', manager_id: 'm1' }],
      });
      mockSendNotification.mockResolvedValue({});

      await service.notifyManagers(['u1']);

      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'm1',
          priority: 'HIGH',
          type: 'REPORT_OVERDUE',
        })
      );
    });
  });

  // ── getOverdueUsers ──────────────────────────────────────────────────────

  describe('getOverdueUsers', () => {
    it('returns overdue users for the given date', async () => {
      mockDb.mockResolvedValueOnce({
        rows: [
          {
            user_id: 'u1',
            email: 'alice@test.com',
            full_name: 'Alice',
            manager_id: 'm1',
            report_date: new Date('2024-01-15'),
            marked_overdue_at: new Date(),
          },
        ],
      });

      const result = await service.getOverdueUsers(new Date('2024-01-15'));

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('u1');
    });

    it('returns empty array when no overdue users', async () => {
      mockDb.mockResolvedValueOnce({ rows: [] });

      const result = await service.getOverdueUsers(new Date('2024-01-15'));

      expect(result).toHaveLength(0);
    });
  });

  // ── runDailyCheck ────────────────────────────────────────────────────────

  describe('runDailyCheck', () => {
    it('sends reminders at 10 PM (hour 22)', async () => {
      const tenPM = new Date('2024-01-15T22:00:00');
      // checkMissingReports query
      mockDb.mockResolvedValueOnce({
        rows: [{ user_id: 'u1', email: 'alice@test.com', full_name: 'Alice', manager_id: null, timezone: 'UTC' }],
      });
      mockSendNotification.mockResolvedValue({});

      const result = await service.runDailyCheck(tenPM);

      expect(result.action).toBe('reminder');
      expect(result.result?.sent).toBe(1);
    });

    it('marks overdue and notifies managers at 11 PM (hour 23)', async () => {
      const elevenPM = new Date('2024-01-15T23:00:00');
      // markOverdueUsers: INSERT
      mockDb.mockResolvedValueOnce({
        rows: [{ user_id: 'u1', report_date: new Date('2024-01-15'), marked_overdue_at: new Date() }],
      });
      // markOverdueUsers: SELECT details
      mockDb.mockResolvedValueOnce({
        rows: [
          {
            user_id: 'u1',
            email: 'alice@test.com',
            full_name: 'Alice',
            manager_id: 'm1',
            report_date: new Date('2024-01-15'),
            marked_overdue_at: new Date(),
          },
        ],
      });
      // notifyManagers: SELECT users with managers
      mockDb.mockResolvedValueOnce({
        rows: [{ user_id: 'u1', full_name: 'Alice', manager_id: 'm1' }],
      });
      mockSendNotification.mockResolvedValue({});

      const result = await service.runDailyCheck(elevenPM);

      expect(result.action).toBe('overdue');
      expect(result.result?.overdueCount).toBe(1);
    });

    it('returns action=none outside of 10 PM and 11 PM', async () => {
      const noon = new Date('2024-01-15T12:00:00');

      const result = await service.runDailyCheck(noon);

      expect(result.action).toBe('none');
      expect(mockDb).not.toHaveBeenCalled();
    });

    it('sends reminders at 10:30 PM as well', async () => {
      const tenThirtyPM = new Date('2024-01-15T22:30:00');
      mockDb.mockResolvedValueOnce({ rows: [] });

      const result = await service.runDailyCheck(tenThirtyPM);

      expect(result.action).toBe('reminder');
    });
  });
});
