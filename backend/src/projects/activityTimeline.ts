import { db } from '../database/connection';
import logger from '../utils/logger';

// ============================================================================
// Event Types
// ============================================================================

export enum TimelineEventType {
  CREATED = 'CREATED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  COMMUNICATION_LOGGED = 'COMMUNICATION_LOGGED',
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  ASSIGNMENT_CHANGED = 'ASSIGNMENT_CHANGED',
  NOTE_ADDED = 'NOTE_ADDED',
  GITHUB_REPO_LINKED = 'GITHUB_REPO_LINKED',
  GITHUB_REPO_UNLINKED = 'GITHUB_REPO_UNLINKED',
  GITHUB_PR_MERGED = 'GITHUB_PR_MERGED',
  CONTRACT_GENERATED = 'CONTRACT_GENERATED',
  SERVICE_AMOUNT_CHANGED = 'SERVICE_AMOUNT_CHANGED',
  LEAD_QUALIFIED = 'LEAD_QUALIFIED',
  PROJECT_CONVERTED = 'PROJECT_CONVERTED',
}

export type EntityType = 'client' | 'lead' | 'project';

// ============================================================================
// Interfaces
// ============================================================================

export interface TimelineEvent {
  id: string;
  entityType: EntityType;
  entityId: string;
  eventType: TimelineEventType;
  description: string;
  actorId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface TimelineFilters {
  eventType?: TimelineEventType;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface AddNoteInput {
  entityType: EntityType;
  entityId: string;
  actorId: string;
  note: string;
  mentions?: string[]; // user IDs mentioned via @
}

// ============================================================================
// Service
// ============================================================================

/**
 * Activity Timeline Service
 * Tracks all events for clients, leads, and projects
 * Requirements: 26.1-26.10
 */
export class ActivityTimelineService {
  private static readonly VALID_ENTITY_TYPES: EntityType[] = ['client', 'lead', 'project'];

  /**
   * Add a timeline event
   * Requirements: 26.1, 26.2, 26.4
   */
  async addEvent(
    entityType: EntityType,
    entityId: string,
    eventType: TimelineEventType,
    description: string,
    actorId?: string,
    metadata?: Record<string, any>
  ): Promise<TimelineEvent> {
    try {
      if (!ActivityTimelineService.VALID_ENTITY_TYPES.includes(entityType)) {
        throw new Error(`Invalid entity type: ${entityType}. Must be one of: ${ActivityTimelineService.VALID_ENTITY_TYPES.join(', ')}`);
      }

      if (!description || description.trim().length === 0) {
        throw new Error('Description is required');
      }

      const result = await db.query(
        `INSERT INTO activity_timeline (entity_type, entity_id, event_type, description, actor_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, entity_type, entity_id, event_type, description, actor_id, metadata, created_at`,
        [
          entityType,
          entityId,
          eventType,
          description.trim(),
          actorId || null,
          metadata ? JSON.stringify(metadata) : null,
        ]
      );

      const event = this.mapEventFromDb(result.rows[0]);

      logger.info('Timeline event added', {
        eventId: event.id,
        entityType,
        entityId,
        eventType,
      });

      return event;
    } catch (error) {
      logger.error('Failed to add timeline event', { error, entityType, entityId, eventType });
      throw error;
    }
  }

  /**
   * Get timeline for an entity with optional filters
   * Requirements: 26.3 (reverse chronological), 26.5 (filtering)
   */
  async getTimeline(
    entityType: EntityType,
    entityId: string,
    filters: TimelineFilters = {}
  ): Promise<{ events: TimelineEvent[]; total: number }> {
    try {
      if (!ActivityTimelineService.VALID_ENTITY_TYPES.includes(entityType)) {
        throw new Error(`Invalid entity type: ${entityType}`);
      }

      const conditions: string[] = ['entity_type = $1', 'entity_id = $2'];
      const values: any[] = [entityType, entityId];
      let paramIndex = 3;

      if (filters.eventType) {
        conditions.push(`event_type = $${paramIndex++}`);
        values.push(filters.eventType);
      }

      if (filters.dateFrom) {
        conditions.push(`created_at >= $${paramIndex++}`);
        values.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        conditions.push(`created_at <= $${paramIndex++}`);
        values.push(filters.dateTo);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const countResult = await db.query(
        `SELECT COUNT(*) FROM activity_timeline ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const dataValues = [...values, limit, offset];
      const result = await db.query(
        `SELECT id, entity_type, entity_id, event_type, description, actor_id, metadata, created_at
         FROM activity_timeline
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        dataValues
      );

      const events = result.rows.map((row) => this.mapEventFromDb(row));

      return { events, total };
    } catch (error) {
      logger.error('Failed to get timeline', { error, entityType, entityId, filters });
      throw error;
    }
  }

  /**
   * Add a manual note to a timeline with optional @mentions
   * Requirements: 26.7, 26.8, 26.9
   */
  async addNote(
    entityType: EntityType,
    entityId: string,
    actorId: string,
    note: string,
    mentions?: string[]
  ): Promise<TimelineEvent> {
    try {
      if (!note || note.trim().length === 0) {
        throw new Error('Note content is required');
      }

      if (!actorId) {
        throw new Error('Actor ID is required for notes');
      }

      const metadata: Record<string, any> = {};
      if (mentions && mentions.length > 0) {
        metadata.mentions = mentions;
      }

      const event = await this.addEvent(
        entityType,
        entityId,
        TimelineEventType.NOTE_ADDED,
        note.trim(),
        actorId,
        Object.keys(metadata).length > 0 ? metadata : undefined
      );

      logger.info('Timeline note added', {
        eventId: event.id,
        entityType,
        entityId,
        actorId,
        mentionCount: mentions?.length || 0,
      });

      return event;
    } catch (error) {
      logger.error('Failed to add timeline note', { error, entityType, entityId, actorId });
      throw error;
    }
  }

  /**
   * Get all valid event types
   * Requirement: 26.2
   */
  getEventTypes(): TimelineEventType[] {
    return Object.values(TimelineEventType);
  }

  private mapEventFromDb(row: any): TimelineEvent {
    return {
      id: row.id,
      entityType: row.entity_type as EntityType,
      entityId: row.entity_id,
      eventType: row.event_type as TimelineEventType,
      description: row.description,
      actorId: row.actor_id ?? undefined,
      metadata: row.metadata ?? undefined,
      createdAt: row.created_at,
    };
  }
}

export const activityTimelineService = new ActivityTimelineService();
export default activityTimelineService;
