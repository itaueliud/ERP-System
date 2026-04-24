import { db } from '../database/connection';
import { DailyReport } from './reportService';
import logger from '../utils/logger';

export interface SubmissionRate {
  userId: string;
  fullName: string;
  email: string;
  periodDays: number;
  expectedDays: number;
  submittedDays: number;
  rate: number; // 0–1
}

export interface WeeklySummary {
  userId: string;
  fullName: string;
  weekStart: Date;
  weekEnd: Date;
  totalReports: number;
  totalHoursWorked: number;
  averageHoursPerDay: number;
  accomplishments: string[];
  challenges: string[];
  tomorrowPlans: string[];
  reports: DailyReport[];
}

export interface TeamSubmissionRates {
  managerId: string;
  periodDays: number;
  teamRates: SubmissionRate[];
  teamAvgRate: number;
}

export interface TeamWeeklySummary {
  managerId: string;
  weekStart: Date;
  weekEnd: Date;
  memberSummaries: WeeklySummary[];
}

export interface ReportFilters {
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Report Analytics Service
 * Handles report viewing for managers/executives and analytics calculations.
 * Requirements: 10.7-10.10
 */
export class ReportAnalyticsService {
  /**
   * Calculate report submission rate for a user over N days (default 30).
   * Requirement 10.8: Calculate report submission rate per user over 30-day periods
   */
  async getSubmissionRate(userId: string, days = 30): Promise<SubmissionRate> {
    try {
      const endDate = new Date();
      endDate.setHours(0, 0, 0, 0);

      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days + 1);

      // Count working days (Mon–Fri) in the period
      const expectedDays = this.countWorkingDays(startDate, endDate);

      // Count submitted reports in the period
      const result = await db.query(
        `SELECT COUNT(*) AS submitted_count,
                u.full_name, u.email
         FROM users u
         LEFT JOIN daily_reports dr
           ON dr.user_id = u.id
           AND dr.report_date >= $2
           AND dr.report_date <= $3
         WHERE u.id = $1
         GROUP BY u.id, u.full_name, u.email`,
        [userId, startDate, endDate]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const row = result.rows[0];
      const submittedDays = parseInt(row.submitted_count, 10);
      const rate = expectedDays > 0 ? submittedDays / expectedDays : 0;

      return {
        userId,
        fullName: row.full_name,
        email: row.email,
        periodDays: days,
        expectedDays,
        submittedDays,
        rate: Math.min(rate, 1),
      };
    } catch (error) {
      logger.error('Failed to get submission rate', { error, userId, days });
      throw error;
    }
  }

  /**
   * Get submission rates for all direct reports of a manager.
   * Requirement 10.7: Allow managers to view reports from direct reports
   * Requirement 10.8: Calculate submission rate per user
   */
  async getTeamSubmissionRates(managerId: string, days = 30): Promise<TeamSubmissionRates> {
    try {
      const directReportIds = await this.getDirectReportIds(managerId);

      const teamRates: SubmissionRate[] = await Promise.all(
        directReportIds.map((uid) => this.getSubmissionRate(uid, days))
      );

      const teamAvgRate =
        teamRates.length > 0
          ? teamRates.reduce((sum, r) => sum + r.rate, 0) / teamRates.length
          : 0;

      return {
        managerId,
        periodDays: days,
        teamRates,
        teamAvgRate,
      };
    } catch (error) {
      logger.error('Failed to get team submission rates', { error, managerId, days });
      throw error;
    }
  }

  /**
   * Generate weekly summary for a user.
   * Requirement 10.10: Generate weekly summary reports aggregating daily report data
   */
  async getWeeklySummary(userId: string, weekStart?: Date): Promise<WeeklySummary> {
    try {
      const { start, end } = this.getWeekRange(weekStart);

      const userResult = await db.query(
        'SELECT id, full_name FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const reportsResult = await db.query(
        `SELECT id, user_id, report_date, accomplishments, challenges, tomorrow_plan,
                hours_worked, submitted_at, created_at
         FROM daily_reports
         WHERE user_id = $1
           AND report_date >= $2
           AND report_date <= $3
         ORDER BY report_date ASC`,
        [userId, start, end]
      );

      const reports: DailyReport[] = reportsResult.rows.map((r) => this.mapReport(r));

      const totalHoursWorked = reports.reduce((sum, r) => sum + (r.hoursWorked ?? 0), 0);
      const daysWithHours = reports.filter((r) => r.hoursWorked != null).length;

      return {
        userId,
        fullName: userResult.rows[0].full_name,
        weekStart: start,
        weekEnd: end,
        totalReports: reports.length,
        totalHoursWorked,
        averageHoursPerDay: daysWithHours > 0 ? totalHoursWorked / daysWithHours : 0,
        accomplishments: reports.map((r) => r.accomplishments),
        challenges: reports.filter((r) => r.challenges).map((r) => r.challenges!),
        tomorrowPlans: reports.filter((r) => r.tomorrowPlan).map((r) => r.tomorrowPlan!),
        reports,
      };
    } catch (error) {
      logger.error('Failed to get weekly summary', { error, userId, weekStart });
      throw error;
    }
  }

  /**
   * Generate weekly summary for all direct reports of a manager.
   * Requirement 10.10: Generate weekly summary reports
   */
  async getTeamWeeklySummary(managerId: string, weekStart?: Date): Promise<TeamWeeklySummary> {
    try {
      const { start, end } = this.getWeekRange(weekStart);
      const directReportIds = await this.getDirectReportIds(managerId);

      const memberSummaries: WeeklySummary[] = await Promise.all(
        directReportIds.map((uid) => this.getWeeklySummary(uid, weekStart))
      );

      return {
        managerId,
        weekStart: start,
        weekEnd: end,
        memberSummaries,
      };
    } catch (error) {
      logger.error('Failed to get team weekly summary', { error, managerId, weekStart });
      throw error;
    }
  }

  /**
   * Get reports from direct reports of a manager.
   * Requirement 10.7: Allow managers to view Daily_Reports from their direct reports
   */
  async getReportsForManager(
    managerId: string,
    filters: ReportFilters = {}
  ): Promise<{ reports: DailyReport[]; total: number }> {
    try {
      const directReportIds = await this.getDirectReportIds(managerId);

      if (directReportIds.length === 0) {
        return { reports: [], total: 0 };
      }

      return this.queryReports({ ...filters, userIds: directReportIds });
    } catch (error) {
      logger.error('Failed to get reports for manager', { error, managerId, filters });
      throw error;
    }
  }

  /**
   * Get all reports (for CEO, CoS, COO, CTO).
   * Requirement 10.9: CEO, CoS, COO, CTO can view all Daily_Reports
   */
  async getReportsForExecutive(
    filters: ReportFilters = {}
  ): Promise<{ reports: DailyReport[]; total: number }> {
    try {
      return this.queryReports(filters);
    } catch (error) {
      logger.error('Failed to get reports for executive', { error, filters });
      throw error;
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getDirectReportIds(managerId: string): Promise<string[]> {
    const result = await db.query(
      'SELECT id FROM users WHERE manager_id = $1',
      [managerId]
    );
    return result.rows.map((r: any) => r.id);
  }

  private async queryReports(
    filters: ReportFilters & { userIds?: string[] }
  ): Promise<{ reports: DailyReport[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.userIds && filters.userIds.length > 0) {
      conditions.push(`user_id = ANY($${paramIndex++}::uuid[])`);
      values.push(filters.userIds);
    } else if (filters.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(filters.userId);
    }

    if (filters.dateFrom) {
      conditions.push(`report_date >= $${paramIndex++}`);
      values.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      conditions.push(`report_date <= $${paramIndex++}`);
      values.push(filters.dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*) FROM daily_reports ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const dataResult = await db.query(
      `SELECT id, user_id, report_date, accomplishments, challenges, tomorrow_plan,
              hours_worked, submitted_at, created_at
       FROM daily_reports
       ${whereClause}
       ORDER BY report_date DESC, submitted_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return {
      reports: dataResult.rows.map((r) => this.mapReport(r)),
      total,
    };
  }

  private mapReport(row: any): DailyReport {
    return {
      id: row.id,
      userId: row.user_id,
      reportDate: row.report_date,
      accomplishments: row.accomplishments,
      challenges: row.challenges ?? undefined,
      tomorrowPlan: row.tomorrow_plan ?? undefined,
      hoursWorked: row.hours_worked != null ? parseFloat(row.hours_worked) : undefined,
      submittedAt: row.submitted_at,
      createdAt: row.created_at,
    };
  }

  /**
   * Count working days (Mon–Fri) between two dates inclusive.
   */
  private countWorkingDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  /**
   * Get the Monday–Sunday range for the week containing the given date.
   */
  private getWeekRange(weekStart?: Date): { start: Date; end: Date } {
    const ref = weekStart ? new Date(weekStart) : new Date();
    ref.setHours(0, 0, 0, 0);

    // Adjust to Monday
    const day = ref.getDay(); // 0=Sun, 1=Mon, ...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const start = new Date(ref);
    start.setDate(ref.getDate() + diffToMonday);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return { start, end };
  }
}

export const reportAnalyticsService = new ReportAnalyticsService();
export default reportAnalyticsService;
