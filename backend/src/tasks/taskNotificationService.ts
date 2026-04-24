import { db } from '../database/connection';
import { notificationService, NotificationPriority, NotificationType } from '../notifications/notificationService';
import { Task, TaskStatus } from './taskService';
import logger from '../utils/logger';

/**
 * TaskNotificationService
 * Handles task-related notifications and reminders
 * Requirements: 50.4-50.7
 */
export class TaskNotificationService {
  /**
   * Send notification when task is assigned to a user
   * Requirement 50.4: Send notification when task is assigned
   */
  async notifyTaskAssigned(task: Task, assignedByUserId: string): Promise<void> {
    try {
      if (!task.assignedTo) {
        return; // No assignee, nothing to notify
      }

      // Get assigner name
      const assignerResult = await db.query(
        'SELECT full_name FROM users WHERE id = $1',
        [assignedByUserId]
      );
      const assignerName = assignerResult.rows[0]?.full_name || 'Someone';

      const dueInfo = task.dueDate 
        ? ` (due ${task.dueDate.toLocaleDateString()})` 
        : '';

      await notificationService.sendNotification({
        userId: task.assignedTo,
        type: NotificationType.TASK_ASSIGNED,
        priority: NotificationPriority.MEDIUM,
        title: 'New Task Assigned',
        message: `${assignerName} assigned you a task: "${task.title}"${dueInfo}`,
        data: {
          taskId: task.id,
          taskTitle: task.title,
          priority: task.priority,
          dueDate: task.dueDate?.toISOString(),
        },
      });

      logger.info('Task assignment notification sent', {
        taskId: task.id,
        assignedTo: task.assignedTo,
        assignedBy: assignedByUserId,
      });
    } catch (error) {
      logger.error('Failed to send task assignment notification', { error, taskId: task.id });
      // Don't throw - notification failure shouldn't block task creation
    }
  }

  /**
   * Send reminder notifications for tasks due within specified hours
   * Requirement 50.6: Send reminder 24 hours before due date
   * Requirement 50.7: Send reminder on due date
   */
  async sendDueDateReminders(hoursBeforeDue: number = 24): Promise<void> {
    try {
      const tasks = await this.getTasksDueWithin(hoursBeforeDue);

      logger.info('Sending due date reminders', {
        hoursBeforeDue,
        taskCount: tasks.length,
      });

      for (const task of tasks) {
        if (!task.assignedTo) continue;

        const isToday = hoursBeforeDue === 0;
        const title = isToday ? 'Task Due Today' : 'Task Due Soon';
        const timeframe = isToday ? 'today' : `in ${hoursBeforeDue} hours`;

        await notificationService.sendNotification({
          userId: task.assignedTo,
          type: NotificationType.TASK_DUE,
          priority: isToday ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
          title,
          message: `Task "${task.title}" is due ${timeframe}`,
          data: {
            taskId: task.id,
            taskTitle: task.title,
            priority: task.priority,
            dueDate: task.dueDate?.toISOString(),
          },
        });
      }

      logger.info('Due date reminders sent', { count: tasks.length });
    } catch (error) {
      logger.error('Failed to send due date reminders', { error, hoursBeforeDue });
      throw error;
    }
  }

  /**
   * Send notifications for overdue tasks
   * Requirement 50.5: Display overdue tasks prominently on dashboard
   */
  async sendOverdueNotifications(): Promise<void> {
    try {
      const overdueTasks = await this.getOverdueTasks();

      logger.info('Sending overdue task notifications', {
        taskCount: overdueTasks.length,
      });

      for (const task of overdueTasks) {
        if (!task.assignedTo) continue;

        const daysOverdue = this.calculateDaysOverdue(task.dueDate!);

        await notificationService.sendNotification({
          userId: task.assignedTo,
          type: NotificationType.TASK_DUE,
          priority: NotificationPriority.HIGH,
          title: 'Overdue Task',
          message: `Task "${task.title}" is ${daysOverdue} day(s) overdue`,
          data: {
            taskId: task.id,
            taskTitle: task.title,
            priority: task.priority,
            dueDate: task.dueDate?.toISOString(),
            daysOverdue,
          },
        });
      }

      logger.info('Overdue notifications sent', { count: overdueTasks.length });
    } catch (error) {
      logger.error('Failed to send overdue notifications', { error });
      throw error;
    }
  }

  /**
   * Get tasks due within specified hours
   * Used for reminder scheduling
   */
  async getTasksDueWithin(hours: number): Promise<Task[]> {
    try {
      const now = new Date();
      const targetTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

      // Get tasks due within the time window that haven't been completed/cancelled
      const result = await db.query(
        `SELECT id, title, description, due_date, priority, status,
                assigned_to, created_by, entity_type, entity_id,
                completed_at, created_at, updated_at
         FROM tasks
         WHERE due_date IS NOT NULL
           AND due_date <= $1
           AND due_date > $2
           AND status NOT IN ($3, $4)
           AND assigned_to IS NOT NULL
         ORDER BY due_date ASC`,
        [targetTime, now, TaskStatus.COMPLETED, TaskStatus.CANCELLED]
      );

      return result.rows.map((row) => this.mapTaskFromDb(row));
    } catch (error) {
      logger.error('Failed to get tasks due within hours', { error, hours });
      throw error;
    }
  }

  /**
   * Get overdue tasks (past due date and not completed/cancelled)
   */
  private async getOverdueTasks(): Promise<Task[]> {
    try {
      const result = await db.query(
        `SELECT id, title, description, due_date, priority, status,
                assigned_to, created_by, entity_type, entity_id,
                completed_at, created_at, updated_at
         FROM tasks
         WHERE due_date < CURRENT_DATE
           AND status NOT IN ($1, $2)
           AND assigned_to IS NOT NULL
         ORDER BY due_date ASC`,
        [TaskStatus.COMPLETED, TaskStatus.CANCELLED]
      );

      return result.rows.map((row) => this.mapTaskFromDb(row));
    } catch (error) {
      logger.error('Failed to get overdue tasks', { error });
      throw error;
    }
  }

  /**
   * Main scheduled job method to run reminder checks
   * Should be called by a scheduler (e.g., cron job)
   */
  async runReminderCheck(): Promise<void> {
    try {
      logger.info('Running task reminder check');

      // Send 24-hour reminders
      await this.sendDueDateReminders(24);

      // Send same-day reminders (due today)
      await this.sendDueDateReminders(0);

      // Send overdue notifications
      await this.sendOverdueNotifications();

      logger.info('Task reminder check completed');
    } catch (error) {
      logger.error('Task reminder check failed', { error });
      throw error;
    }
  }

  /**
   * Calculate days overdue for a task
   */
  private calculateDaysOverdue(dueDate: Date): number {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = now.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  /**
   * Map database row to Task object
   */
  private mapTaskFromDb(row: any): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description || undefined,
      dueDate: row.due_date || undefined,
      priority: row.priority,
      status: row.status,
      assignedTo: row.assigned_to || undefined,
      createdBy: row.created_by,
      entityType: row.entity_type || undefined,
      entityId: row.entity_id || undefined,
      completedAt: row.completed_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const taskNotificationService = new TaskNotificationService();
export default taskNotificationService;
