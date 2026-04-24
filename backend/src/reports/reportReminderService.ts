import { db } from '../database/connection';
import { notificationService } from '../notifications/notificationService';
import { NotificationPriority, NotificationType } from '../notifications/notificationService';
import logger from '../utils/logger';

export interface OverdueUser {
  userId: string;
  email: string;
  fullName: string;
  managerId?: string;
  reportDate: Date;
  markedOverdueAt: Date;
}

export interface MissingReportUser {
  userId: string;
  email: string;
  fullName: string;
  managerId?: string;
  timezone: string;
}

/**
 * Report Reminder Service
 * Handles scheduled checks for missing daily reports, sends reminders,
 * marks overdue users, and notifies managers.
 * Requirements: 10.4-10.6
 */
export class ReportReminderService {
  /**
   * Find all active users who have not submitted a daily report for the given date.
   * Requirement 10.4: Check for missing reports at 10 PM
   */
  async checkMissingReports(date?: Date): Promise<MissingReportUser[]> {
    const reportDate = this.normalizeDate(date ?? new Date());

    try {
      const result = await db.query(
        `SELECT u.id AS user_id, u.email, u.full_name, u.manager_id, u.timezone
         FROM users u
         WHERE NOT EXISTS (
           SELECT 1 FROM daily_reports dr
           WHERE dr.user_id = u.id
             AND dr.report_date = $1
         )
         ORDER BY u.full_name`,
        [reportDate]
      );

      return result.rows.map((row) => ({
        userId: row.user_id,
        email: row.email,
        fullName: row.full_name,
        managerId: row.manager_id ?? undefined,
        timezone: row.timezone ?? 'UTC',
      }));
    } catch (error) {
      logger.error('Failed to check missing reports', { error, reportDate });
      throw error;
    }
  }

  /**
   * Send reminder notifications to users who haven't submitted their daily report.
   * Requirement 10.4: Send reminder notifications every 30 minutes for missing reports
   */
  async sendReminders(date?: Date): Promise<{ sent: number; failed: number }> {
    const missingUsers = await this.checkMissingReports(date);
    let sent = 0;
    let failed = 0;

    for (const user of missingUsers) {
      try {
        await notificationService.sendNotification({
          userId: user.userId,
          type: NotificationType.REPORT_OVERDUE,
          priority: NotificationPriority.MEDIUM,
          title: 'Daily Report Reminder',
          message:
            'You have not yet submitted your daily report. Please submit it before 10 PM to avoid being marked as overdue.',
          data: {
            reportDate: this.normalizeDate(date ?? new Date()).toISOString().split('T')[0],
          },
        });
        sent++;
        logger.info('Reminder sent', { userId: user.userId });
      } catch (error) {
        failed++;
        logger.error('Failed to send reminder', { error, userId: user.userId });
      }
    }

    logger.info('Reminders sent', { sent, failed, total: missingUsers.length });
    return { sent, failed };
  }

  /**
   * Mark users as REPORT_OVERDUE if they haven't submitted a report by 11 PM.
   * Requirement 10.5: Mark users as REPORT_OVERDUE at 11 PM
   */
  async markOverdueUsers(date?: Date): Promise<OverdueUser[]> {
    const reportDate = this.normalizeDate(date ?? new Date());

    try {
      // Upsert overdue flags for users without reports
      const result = await db.query(
        `INSERT INTO report_overdue_flags (user_id, report_date, marked_overdue_at)
         SELECT u.id, $1, NOW()
         FROM users u
         WHERE NOT EXISTS (
           SELECT 1 FROM daily_reports dr
           WHERE dr.user_id = u.id
             AND dr.report_date = $1
         )
         ON CONFLICT (user_id, report_date) DO NOTHING
         RETURNING user_id, report_date, marked_overdue_at`,
        [reportDate]
      );

      if (result.rows.length === 0) {
        logger.info('No new overdue users to mark', { reportDate });
        return [];
      }

      // Fetch full user details for the newly marked overdue users
      const userIds = result.rows.map((r: any) => r.user_id);
      const usersResult = await db.query(
        `SELECT u.id AS user_id, u.email, u.full_name, u.manager_id,
                rof.report_date, rof.marked_overdue_at
         FROM users u
         JOIN report_overdue_flags rof ON rof.user_id = u.id
         WHERE u.id = ANY($1::uuid[])
           AND rof.report_date = $2`,
        [userIds, reportDate]
      );

      const overdueUsers: OverdueUser[] = usersResult.rows.map((row: any) => ({
        userId: row.user_id,
        email: row.email,
        fullName: row.full_name,
        managerId: row.manager_id ?? undefined,
        reportDate: row.report_date,
        markedOverdueAt: row.marked_overdue_at,
      }));

      logger.info('Users marked as overdue', { count: overdueUsers.length, reportDate });
      return overdueUsers;
    } catch (error) {
      logger.error('Failed to mark overdue users', { error, reportDate });
      throw error;
    }
  }

  /**
   * Notify managers of overdue reports from their direct reports.
   * Requirement 10.6: Notify managers of overdue reports
   */
  async notifyManagers(overdueUserIds: string[]): Promise<{ sent: number; failed: number }> {
    if (overdueUserIds.length === 0) return { sent: 0, failed: 0 };

    try {
      // Group overdue users by their manager
      const result = await db.query(
        `SELECT u.id AS user_id, u.full_name, u.manager_id
         FROM users u
         WHERE u.id = ANY($1::uuid[])
           AND u.manager_id IS NOT NULL`,
        [overdueUserIds]
      );

      // Build a map: managerId → list of overdue direct reports
      const managerMap = new Map<string, string[]>();
      for (const row of result.rows) {
        const existing = managerMap.get(row.manager_id) ?? [];
        existing.push(row.full_name);
        managerMap.set(row.manager_id, existing);
      }

      let sent = 0;
      let failed = 0;

      for (const [managerId, reporteeNames] of managerMap) {
        try {
          const nameList = reporteeNames.join(', ');
          await notificationService.sendNotification({
            userId: managerId,
            type: NotificationType.REPORT_OVERDUE,
            priority: NotificationPriority.HIGH,
            title: 'Overdue Daily Reports',
            message: `The following team members have not submitted their daily reports: ${nameList}. Please follow up with them.`,
            data: {
              overdueUserIds: overdueUserIds.join(','),
              overdueCount: String(reporteeNames.length),
            },
          });
          sent++;
          logger.info('Manager notified of overdue reports', {
            managerId,
            overdueCount: reporteeNames.length,
          });
        } catch (error) {
          failed++;
          logger.error('Failed to notify manager', { error, managerId });
        }
      }

      return { sent, failed };
    } catch (error) {
      logger.error('Failed to notify managers', { error });
      throw error;
    }
  }

  /**
   * Get all users currently marked as overdue for a given date.
   * Requirement 10.5, 10.6
   */
  async getOverdueUsers(date?: Date): Promise<OverdueUser[]> {
    const reportDate = this.normalizeDate(date ?? new Date());

    try {
      const result = await db.query(
        `SELECT u.id AS user_id, u.email, u.full_name, u.manager_id,
                rof.report_date, rof.marked_overdue_at
         FROM report_overdue_flags rof
         JOIN users u ON u.id = rof.user_id
         WHERE rof.report_date = $1
           AND rof.resolved_at IS NULL
         ORDER BY u.full_name`,
        [reportDate]
      );

      return result.rows.map((row: any) => ({
        userId: row.user_id,
        email: row.email,
        fullName: row.full_name,
        managerId: row.manager_id ?? undefined,
        reportDate: row.report_date,
        markedOverdueAt: row.marked_overdue_at,
      }));
    } catch (error) {
      logger.error('Failed to get overdue users', { error, reportDate });
      throw error;
    }
  }

  /**
   * Main scheduled job method.
   * - At 10 PM: check for missing reports and send reminders every 30 minutes
   * - At 11 PM: mark users as REPORT_OVERDUE and notify managers
   *
   * This method determines the current action based on the current hour.
   * Requirement 10.4: Send reminders at 10 PM (and every 30 min until 11 PM)
   * Requirement 10.5: Mark overdue at 11 PM
   * Requirement 10.6: Notify managers of overdue reports
   */
  async runDailyCheck(now?: Date): Promise<{
    action: 'reminder' | 'overdue' | 'none';
    result?: { sent?: number; failed?: number; overdueCount?: number };
  }> {
    const currentTime = now ?? new Date();
    const hour = currentTime.getHours();
    const minute = currentTime.getMinutes();

    // 11 PM (23:00): mark overdue and notify managers
    if (hour === 23) {
      logger.info('Running 11 PM overdue check');
      const overdueUsers = await this.markOverdueUsers(currentTime);
      const overdueUserIds = overdueUsers.map((u) => u.userId);
      const managerResult = await this.notifyManagers(overdueUserIds);

      return {
        action: 'overdue',
        result: {
          overdueCount: overdueUsers.length,
          sent: managerResult.sent,
          failed: managerResult.failed,
        },
      };
    }

    // 10 PM (22:00–22:59): send reminders every 30 minutes (at :00 and :30)
    if (hour === 22 && (minute < 30 || minute >= 30)) {
      logger.info('Running 10 PM reminder check', { minute });
      const reminderResult = await this.sendReminders(currentTime);
      return {
        action: 'reminder',
        result: { sent: reminderResult.sent, failed: reminderResult.failed },
      };
    }

    return { action: 'none' };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private normalizeDate(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}

export const reportReminderService = new ReportReminderService();
export default reportReminderService;
