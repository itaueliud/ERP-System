import { TaskNotificationService } from './taskNotificationService';
import { TaskPriority, TaskStatus } from './taskService';
import { db } from '../database/connection';
import { notificationService, NotificationPriority, NotificationType } from '../notifications/notificationService';

jest.mock('../database/connection');
jest.mock('../utils/logger');
jest.mock('../notifications/notificationService', () => ({
  notificationService: {
    sendNotification: jest.fn().mockResolvedValue({}),
  },
  NotificationPriority: {
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW',
  },
  NotificationType: {
    TASK_ASSIGNED: 'TASK_ASSIGNED',
    TASK_DUE: 'TASK_DUE',
  },
}));
jest.mock('../config', () => ({
  config: {
    apiBaseUrl: 'http://localhost:3000',
    logging: { level: 'info', filePath: '/tmp/test.log' },
    database: { host: 'localhost', port: 5432, name: 'test', user: 'test', password: 'test' },
    notifications: { retryAttempts: 3, retryDelayMs: 1000 },
  },
}));

const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockAssigneeId = '456e4567-e89b-12d3-a456-426614174001';
const mockTaskId = '789e4567-e89b-12d3-a456-426614174002';

const makeTask = (overrides: Partial<any> = {}) => ({
  id: mockTaskId,
  title: 'Test Task',
  description: 'A test task',
  dueDate: new Date(Date.now() + 25 * 60 * 60 * 1000), // 25 hours from now
  priority: TaskPriority.MEDIUM,
  status: TaskStatus.NOT_STARTED,
  assignedTo: mockAssigneeId,
  createdBy: mockUserId,
  entityType: undefined,
  entityId: undefined,
  completedAt: undefined,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('TaskNotificationService', () => {
  let service: TaskNotificationService;

  beforeEach(() => {
    service = new TaskNotificationService();
    jest.clearAllMocks();
  });

  describe('notifyTaskAssigned', () => {
    it('should send notification when task is assigned', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ full_name: 'John Doe' }],
      });

      const task = makeTask();
      await service.notifyTaskAssigned(task, mockUserId);

      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockAssigneeId,
          type: NotificationType.TASK_ASSIGNED,
          priority: NotificationPriority.MEDIUM,
          title: 'New Task Assigned',
        })
      );
    });

    it('should include due date in message when task has due date', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ full_name: 'Jane Smith' }],
      });

      const dueDate = new Date('2025-12-31');
      const task = makeTask({ dueDate });
      await service.notifyTaskAssigned(task, mockUserId);

      const call = (notificationService.sendNotification as jest.Mock).mock.calls[0][0];
      expect(call.message).toContain('due');
    });

    it('should not send notification when task has no assignee', async () => {
      const task = makeTask({ assignedTo: undefined });
      await service.notifyTaskAssigned(task, mockUserId);

      expect(notificationService.sendNotification).not.toHaveBeenCalled();
    });

    it('should use fallback name when assigner not found', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const task = makeTask();
      await service.notifyTaskAssigned(task, mockUserId);

      const call = (notificationService.sendNotification as jest.Mock).mock.calls[0][0];
      expect(call.message).toContain('Someone');
    });

    it('should not throw when notification fails', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ full_name: 'John Doe' }],
      });
      (notificationService.sendNotification as jest.Mock).mockRejectedValueOnce(
        new Error('Notification failed')
      );

      const task = makeTask();
      await expect(service.notifyTaskAssigned(task, mockUserId)).resolves.not.toThrow();
    });
  });

  describe('getTasksDueWithin', () => {
    it('should return tasks due within specified hours', async () => {
      const dbRow = {
        id: mockTaskId,
        title: 'Test Task',
        description: null,
        due_date: new Date(Date.now() + 20 * 60 * 60 * 1000),
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.NOT_STARTED,
        assigned_to: mockAssigneeId,
        created_by: mockUserId,
        entity_type: null,
        entity_id: null,
        completed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [dbRow] });

      const tasks = await service.getTasksDueWithin(24);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(mockTaskId);
    });

    it('should return empty array when no tasks due within hours', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const tasks = await service.getTasksDueWithin(24);
      expect(tasks).toHaveLength(0);
    });
  });

  describe('sendDueDateReminders', () => {
    it('should send MEDIUM priority reminders for 24-hour window', async () => {
      const dbRow = {
        id: mockTaskId,
        title: 'Test Task',
        description: null,
        due_date: new Date(Date.now() + 20 * 60 * 60 * 1000),
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.NOT_STARTED,
        assigned_to: mockAssigneeId,
        created_by: mockUserId,
        entity_type: null,
        entity_id: null,
        completed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [dbRow] });

      await service.sendDueDateReminders(24);

      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockAssigneeId,
          type: NotificationType.TASK_DUE,
          priority: NotificationPriority.MEDIUM,
          title: 'Task Due Soon',
        })
      );
    });

    it('should send HIGH priority reminders for same-day (0 hours)', async () => {
      const dbRow = {
        id: mockTaskId,
        title: 'Urgent Task',
        description: null,
        due_date: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
        priority: TaskPriority.HIGH,
        status: TaskStatus.NOT_STARTED,
        assigned_to: mockAssigneeId,
        created_by: mockUserId,
        entity_type: null,
        entity_id: null,
        completed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [dbRow] });

      await service.sendDueDateReminders(0);

      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: NotificationPriority.HIGH,
          title: 'Task Due Today',
        })
      );
    });

    it('should skip tasks without assignee', async () => {
      const dbRow = {
        id: mockTaskId,
        title: 'Unassigned Task',
        description: null,
        due_date: new Date(Date.now() + 20 * 60 * 60 * 1000),
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.NOT_STARTED,
        assigned_to: null,
        created_by: mockUserId,
        entity_type: null,
        entity_id: null,
        completed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [dbRow] });

      await service.sendDueDateReminders(24);

      expect(notificationService.sendNotification).not.toHaveBeenCalled();
    });

    it('should default to 24 hours when no argument provided', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await service.sendDueDateReminders();

      // Verify db was queried (with 24h window)
      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('sendOverdueNotifications', () => {
    it('should send HIGH priority notifications for overdue tasks', async () => {
      const overdueDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const dbRow = {
        id: mockTaskId,
        title: 'Overdue Task',
        description: null,
        due_date: overdueDate,
        priority: TaskPriority.HIGH,
        status: TaskStatus.NOT_STARTED,
        assigned_to: mockAssigneeId,
        created_by: mockUserId,
        entity_type: null,
        entity_id: null,
        completed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [dbRow] });

      await service.sendOverdueNotifications();

      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockAssigneeId,
          type: NotificationType.TASK_DUE,
          priority: NotificationPriority.HIGH,
          title: 'Overdue Task',
        })
      );
    });

    it('should include days overdue in notification data', async () => {
      const overdueDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
      const dbRow = {
        id: mockTaskId,
        title: 'Overdue Task',
        description: null,
        due_date: overdueDate,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.IN_PROGRESS,
        assigned_to: mockAssigneeId,
        created_by: mockUserId,
        entity_type: null,
        entity_id: null,
        completed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [dbRow] });

      await service.sendOverdueNotifications();

      const call = (notificationService.sendNotification as jest.Mock).mock.calls[0][0];
      expect(call.data.daysOverdue).toBeGreaterThan(0);
    });

    it('should skip overdue tasks without assignee', async () => {
      const dbRow = {
        id: mockTaskId,
        title: 'Unassigned Overdue Task',
        description: null,
        due_date: new Date(Date.now() - 24 * 60 * 60 * 1000),
        priority: TaskPriority.LOW,
        status: TaskStatus.NOT_STARTED,
        assigned_to: null,
        created_by: mockUserId,
        entity_type: null,
        entity_id: null,
        completed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [dbRow] });

      await service.sendOverdueNotifications();

      expect(notificationService.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('runReminderCheck', () => {
    it('should run all reminder checks', async () => {
      // Mock for sendDueDateReminders(24)
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // Mock for sendDueDateReminders(0)
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // Mock for sendOverdueNotifications
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(service.runReminderCheck()).resolves.not.toThrow();

      // Should have queried db 3 times (24h reminders, 0h reminders, overdue)
      expect(db.query).toHaveBeenCalledTimes(3);
    });

    it('should throw when a check fails', async () => {
      (db.query as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

      await expect(service.runReminderCheck()).rejects.toThrow('DB error');
    });
  });
});
