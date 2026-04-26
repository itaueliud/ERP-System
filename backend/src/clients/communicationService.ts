import { db } from '../database/connection';
import logger from '../utils/logger';

export interface CreateCommunicationInput {
  clientId: string;
  type: CommunicationType;
  communicationDate: Date;
  durationMinutes?: number;
  summary?: string;
  participants?: string[];
  outcome?: string;
  attachmentIds?: string[]; // Requirement 49.8: file attachment IDs
}

export interface Communication {
  id: string;
  clientId: string;
  type: CommunicationType;
  communicationDate: Date;
  durationMinutes?: number;
  summary?: string;
  participants?: string[];
  outcome?: string;
  attachmentIds?: string[];
  createdAt: Date;
}

export enum CommunicationType {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  MEETING = 'MEETING',
  CHAT = 'CHAT',
  SMS = 'SMS',
}

/**
 * Communication History Service
 * Handles communication logging and retrieval for clients
 * Requirements: 49.1-49.10
 */
export class CommunicationService {
  /**
   * Log a communication record
   * Requirement 49.3: Allow users to log communication with type, date, duration, summary, participants, outcome
   */
  async logCommunication(input: CreateCommunicationInput): Promise<Communication> {
    try {
      // Validate client exists
      const clientResult = await db.query('SELECT id FROM clients WHERE id = $1', [input.clientId]);
      if (clientResult.rows.length === 0) {
        throw new Error('Client not found');
      }

      // Validate communication type
      if (!Object.values(CommunicationType).includes(input.type)) {
        throw new Error(
          'Invalid communication type. Must be one of: EMAIL, PHONE, MEETING, CHAT, SMS'
        );
      }

      const result = await db.query(
        `INSERT INTO communications (
          client_id, type, communication_date, duration_minutes, 
          summary, participants, outcome, attachment_ids
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, client_id, type, communication_date, duration_minutes,
                  summary, participants, outcome, attachment_ids, created_at`,
        [
          input.clientId,
          input.type,
          input.communicationDate,
          input.durationMinutes || null,
          input.summary || null,
          input.participants ? JSON.stringify(input.participants) : null,
          input.outcome || null,
          input.attachmentIds ? JSON.stringify(input.attachmentIds) : null,
        ]
      );

      const communication = this.mapCommunicationFromDb(result.rows[0]);

      logger.info('Communication logged successfully', {
        communicationId: communication.id,
        clientId: input.clientId,
        type: input.type,
      });

      return communication;
    } catch (error) {
      logger.error('Failed to log communication', { error, input });
      throw error;
    }
  }

  /**
   * Auto-log system-generated email
   * Requirement 49.4: Automatically log system-generated emails to communication history
   */
  async autoLogEmail(
    clientId: string,
    summary: string,
    participants: string[],
    outcome?: string
  ): Promise<Communication> {
    try {
      const input: CreateCommunicationInput = {
        clientId,
        type: CommunicationType.EMAIL,
        communicationDate: new Date(),
        summary,
        participants,
        outcome,
      };

      return await this.logCommunication(input);
    } catch (error) {
      logger.error('Failed to auto-log email', { error, clientId, summary });
      throw error;
    }
  }

  /**
   * Auto-log chat message
   * Requirement 49.5: Automatically log chat messages to communication history
   */
  async autoLogChat(
    clientId: string,
    summary: string,
    participants: string[],
    durationMinutes?: number
  ): Promise<Communication> {
    try {
      const input: CreateCommunicationInput = {
        clientId,
        type: CommunicationType.CHAT,
        communicationDate: new Date(),
        summary,
        participants,
        durationMinutes,
      };

      return await this.logCommunication(input);
    } catch (error) {
      logger.error('Failed to auto-log chat', { error, clientId, summary });
      throw error;
    }
  }

  /**
   * Get communication history for a client
   * Requirement 49.6: Display communication history in chronological order
   * Requirement 49.7: Allow filtering communication history by type and date_range
   */
  async getCommunicationHistory(
    clientId: string,
    filters?: {
      type?: CommunicationType;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ communications: Communication[]; total: number }> {
    try {
      const conditions: string[] = ['client_id = $1'];
      const values: any[] = [clientId];
      let paramIndex = 2;

      if (filters?.type) {
        conditions.push(`type = $${paramIndex++}`);
        values.push(filters.type);
      }

      if (filters?.startDate) {
        conditions.push(`communication_date >= $${paramIndex++}`);
        values.push(filters.startDate);
      }

      if (filters?.endDate) {
        conditions.push(`communication_date <= $${paramIndex++}`);
        values.push(filters.endDate);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM communications ${whereClause}`;
      const countResult = await db.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get communications in chronological order (most recent first)
      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      const query = `
        SELECT id, client_id, type, communication_date, duration_minutes,
               summary, participants, outcome, created_at
        FROM communications
        ${whereClause}
        ORDER BY communication_date DESC, created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await db.query(query, values);

      const communications = result.rows.map((row) => this.mapCommunicationFromDb(row));

      return { communications, total };
    } catch (error) {
      logger.error('Failed to get communication history', { error, clientId, filters });
      throw error;
    }
  }

  /**
   * Calculate total communication time for a client
   * Requirement 49.9: Calculate total communication time per client
   */
  async getTotalCommunicationTime(clientId: string): Promise<number> {
    try {
      const result = await db.query(
        `SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
         FROM communications
         WHERE client_id = $1 AND duration_minutes IS NOT NULL`,
        [clientId]
      );

      return parseInt(result.rows[0].total_minutes);
    } catch (error) {
      logger.error('Failed to get total communication time', { error, clientId });
      throw error;
    }
  }

  /**
   * Get last communication date for a client
   * Requirement 49.10: Display last communication date on client list view
   */
  async getLastCommunicationDate(clientId: string): Promise<Date | null> {
    try {
      const result = await db.query(
        `SELECT communication_date
         FROM communications
         WHERE client_id = $1
         ORDER BY communication_date DESC
         LIMIT 1`,
        [clientId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].communication_date;
    } catch (error) {
      logger.error('Failed to get last communication date', { error, clientId });
      throw error;
    }
  }

  /**
   * Get last communication dates for multiple clients
   * Requirement 49.10: Display last communication date on client list view
   */
  async getLastCommunicationDates(clientIds: string[]): Promise<Map<string, Date>> {
    try {
      if (clientIds.length === 0) {
        return new Map();
      }

      const result = await db.query(
        `SELECT DISTINCT ON (client_id) client_id, communication_date
         FROM communications
         WHERE client_id = ANY($1)
         ORDER BY client_id, communication_date DESC`,
        [clientIds]
      );

      const dateMap = new Map<string, Date>();
      result.rows.forEach((row) => {
        dateMap.set(row.client_id, row.communication_date);
      });

      return dateMap;
    } catch (error) {
      logger.error('Failed to get last communication dates', { error, clientIds });
      throw error;
    }
  }

  /**
   * Delete communication record
   */
  async deleteCommunication(communicationId: string): Promise<void> {
    try {
      const result = await db.query(
        'DELETE FROM communications WHERE id = $1 RETURNING id',
        [communicationId]
      );

      if (result.rows.length === 0) {
        throw new Error('Communication not found');
      }

      logger.info('Communication deleted successfully', { communicationId });
    } catch (error) {
      logger.error('Failed to delete communication', { error, communicationId });
      throw error;
    }
  }

  /**
   * Map database row to Communication object
   */
  private mapCommunicationFromDb(row: any): Communication {
    return {
      id: row.id,
      clientId: row.client_id,
      type: row.type as CommunicationType,
      communicationDate: row.communication_date,
      durationMinutes: row.duration_minutes,
      summary: row.summary,
      participants: row.participants ? JSON.parse(row.participants) : undefined,
      outcome: row.outcome,
      attachmentIds: row.attachment_ids ? JSON.parse(row.attachment_ids) : undefined,
      createdAt: row.created_at,
    };
  }
}

export const communicationService = new CommunicationService();
export default communicationService;
