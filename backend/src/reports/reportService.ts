import { db } from '../database/connection';
import logger from '../utils/logger';

export interface SubmitReportInput {
  accomplishments: string;
  challenges?: string;
  tomorrowPlan?: string;
  hoursWorked?: number;
}

export interface UpdateReportInput {
  accomplishments?: string;
  challenges?: string;
  tomorrowPlan?: string;
  hoursWorked?: number;
}

export interface DailyReport {
  id: string;
  userId: string;
  reportDate: Date;
  accomplishments: string;
  challenges?: string;
  tomorrowPlan?: string;
  hoursWorked?: number;
  submittedAt: Date;
  createdAt: Date;
  // Sender identity — populated when fetched via executive/team routes
  userName?: string;
  userEmail?: string;
  userRole?: string;
  userDepartment?: string;
}

export interface ListReportsFilters {
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Daily Report Service
 * Handles daily report submission, retrieval, and listing
 * Requirements: 10.1-10.3
 */
export class DailyReportService {
  /**
   * Submit or update a daily report for a user (upsert on conflict)
   * Requirement 10.2: Provide daily report form with required fields
   * Requirement 10.3: Timestamp the submission
   */
  async submitReport(userId: string, data: SubmitReportInput): Promise<DailyReport> {
    try {
      if (!data.accomplishments || data.accomplishments.trim() === '') {
        throw new Error('accomplishments is required');
      }

      if (data.hoursWorked !== undefined && (data.hoursWorked < 0 || data.hoursWorked > 24)) {
        throw new Error('hours_worked must be between 0 and 24');
      }

      const reportDate = new Date();
      reportDate.setHours(0, 0, 0, 0);

      const result = await db.query(
        `INSERT INTO daily_reports (
          user_id, report_date, accomplishments, challenges, tomorrow_plan, hours_worked, submitted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (user_id, report_date)
        DO UPDATE SET
          accomplishments = EXCLUDED.accomplishments,
          challenges = EXCLUDED.challenges,
          tomorrow_plan = EXCLUDED.tomorrow_plan,
          hours_worked = EXCLUDED.hours_worked,
          submitted_at = NOW()
        RETURNING id, user_id, report_date, accomplishments, challenges, tomorrow_plan,
                  hours_worked, submitted_at, created_at`,
        [
          userId,
          reportDate,
          data.accomplishments.trim(),
          data.challenges?.trim() || null,
          data.tomorrowPlan?.trim() || null,
          data.hoursWorked ?? null,
        ]
      );

      logger.info('Daily report submitted', { userId, reportDate });

      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to submit daily report', { error, userId });
      throw error;
    }
  }

  /**
   * Get a report for a specific user and date
   */
  async getReport(userId: string, date: Date): Promise<DailyReport | null> {
    try {
      const reportDate = new Date(date);
      reportDate.setHours(0, 0, 0, 0);

      const result = await db.query(
        `SELECT id, user_id, report_date, accomplishments, challenges, tomorrow_plan,
                hours_worked, submitted_at, created_at
         FROM daily_reports
         WHERE user_id = $1 AND report_date = $2`,
        [userId, reportDate]
      );

      if (result.rows.length === 0) return null;

      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get daily report', { error, userId, date });
      throw error;
    }
  }

  /**
   * Get a report by its ID
   */
  async getReportById(reportId: string): Promise<DailyReport | null> {
    try {
      const result = await db.query(
        `SELECT id, user_id, report_date, accomplishments, challenges, tomorrow_plan,
                hours_worked, submitted_at, created_at
         FROM daily_reports
         WHERE id = $1`,
        [reportId]
      );

      if (result.rows.length === 0) return null;

      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get daily report by id', { error, reportId });
      throw error;
    }
  }

  /**
   * List reports with optional filters
   */
  async listReports(filters: ListReportsFilters = {}): Promise<{ reports: DailyReport[]; total: number }> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters.userId) {
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
      const total = parseInt(countResult.rows[0].count);

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
        reports: dataResult.rows.map((r) => this.mapFromDb(r)),
        total,
      };
    } catch (error) {
      logger.error('Failed to list daily reports', { error, filters });
      throw error;
    }
  }

  /**
   * Update an existing report
   */
  async updateReport(reportId: string, userId: string, data: UpdateReportInput): Promise<DailyReport> {
    try {
      const existing = await this.getReportById(reportId);
      if (!existing) {
        throw new Error('Report not found');
      }

      if (existing.userId !== userId) {
        throw new Error('Unauthorized: You can only update your own reports');
      }

      if (data.hoursWorked !== undefined && (data.hoursWorked < 0 || data.hoursWorked > 24)) {
        throw new Error('hours_worked must be between 0 and 24');
      }

      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.accomplishments !== undefined) {
        if (data.accomplishments.trim() === '') throw new Error('accomplishments cannot be empty');
        fields.push(`accomplishments = $${paramIndex++}`);
        values.push(data.accomplishments.trim());
      }

      if (data.challenges !== undefined) {
        fields.push(`challenges = $${paramIndex++}`);
        values.push(data.challenges.trim() || null);
      }

      if (data.tomorrowPlan !== undefined) {
        fields.push(`tomorrow_plan = $${paramIndex++}`);
        values.push(data.tomorrowPlan.trim() || null);
      }

      if (data.hoursWorked !== undefined) {
        fields.push(`hours_worked = $${paramIndex++}`);
        values.push(data.hoursWorked);
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push(`submitted_at = NOW()`);
      values.push(reportId);

      const result = await db.query(
        `UPDATE daily_reports
         SET ${fields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, user_id, report_date, accomplishments, challenges, tomorrow_plan,
                   hours_worked, submitted_at, created_at`,
        values
      );

      logger.info('Daily report updated', { reportId, userId });

      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update daily report', { error, reportId, userId });
      throw error;
    }
  }

  private mapFromDb(row: any): DailyReport {
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
}

export const dailyReportService = new DailyReportService();
export default dailyReportService;
