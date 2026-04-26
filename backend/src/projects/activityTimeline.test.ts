import { ActivityTimelineService, TimelineEventType, EntityType } from './activityTimeline';
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

const MOCK_ENTITY_ID = '111e4567-e89b-12d3-a456-426614174001';
const MOCK_ACTOR_ID = '222e4567-e89b-12d3-a456-426614174002';
const MOCK_EVENT_ID = '333e4567-e89b-12d3-a456-426614174003';

function mockEventRow(overrides: Record<string, any> = {}) {
  return {
    id: MOCK_EVENT_ID,
    entity_type: 'project',
    entity_id: MOCK_ENTITY_ID,
    event_type: TimelineEventType.CREATED,
    description: 'Project was created',
    actor_id: MOCK_ACTOR_ID,
    metadata: null,
    created_at: new Date('2024-01-15T10:00:00Z'),
    ...overrides,
  };
}

describe('ActivityTimelineService', () => {
  let service: ActivityTimelineService;

  beforeEach(() => {
    service = new ActivityTimelineService();
    jest.clearAllMocks();
  });

  // ─── addEvent ──────────────────────────────────────────────────────────────

  describe('addEvent', () => {
    it('should add a timeline event successfully', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockEventRow()] });

      const event = await service.addEvent(
        'project',
        MOCK_ENTITY_ID,
        TimelineEventType.CREATED,
        'Project was created',
        MOCK_ACTOR_ID
      );

      expect(event.id).toBe(MOCK_EVENT_ID);
      expect(event.entityType).toBe('project');
      expect(event.entityId).toBe(MOCK_ENTITY_ID);
      expect(event.eventType).toBe(TimelineEventType.CREATED);
      expect(event.description).toBe('Project was created');
      expect(event.actorId).toBe(MOCK_ACTOR_ID);
    });

    it('should add event with metadata', async () => {
      const metadata = { oldStatus: 'PENDING_APPROVAL', newStatus: 'ACTIVE' };
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockEventRow({ event_type: TimelineEventType.STATUS_CHANGED, metadata })],
      });

      const event = await service.addEvent(
        'project',
        MOCK_ENTITY_ID,
        TimelineEventType.STATUS_CHANGED,
        'Status changed from PENDING_APPROVAL to ACTIVE',
        MOCK_ACTOR_ID,
        metadata
      );

      expect(event.eventType).toBe(TimelineEventType.STATUS_CHANGED);
      expect(event.metadata).toEqual(metadata);
    });

    it('should add event without actor (system event)', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockEventRow({ actor_id: null })],
      });

      const event = await service.addEvent(
        'project',
        MOCK_ENTITY_ID,
        TimelineEventType.CREATED,
        'System event'
      );

      expect(event.actorId).toBeUndefined();
    });

    it('should support all entity types', async () => {
      const entityTypes: EntityType[] = ['client', 'lead', 'project'];

      for (const entityType of entityTypes) {
        (db.query as jest.Mock).mockResolvedValueOnce({
          rows: [mockEventRow({ entity_type: entityType })],
        });

        const event = await service.addEvent(
          entityType,
          MOCK_ENTITY_ID,
          TimelineEventType.CREATED,
          `${entityType} created`
        );

        expect(event.entityType).toBe(entityType);
      }
    });

    it('should reject invalid entity type', async () => {
      await expect(
        service.addEvent(
          'invalid' as EntityType,
          MOCK_ENTITY_ID,
          TimelineEventType.CREATED,
          'Test'
        )
      ).rejects.toThrow('Invalid entity type');
    });

    it('should reject empty description', async () => {
      await expect(
        service.addEvent('project', MOCK_ENTITY_ID, TimelineEventType.CREATED, '')
      ).rejects.toThrow('Description is required');

      await expect(
        service.addEvent('project', MOCK_ENTITY_ID, TimelineEventType.CREATED, '   ')
      ).rejects.toThrow('Description is required');
    });
  });

  // ─── getTimeline ───────────────────────────────────────────────────────────

  describe('getTimeline', () => {
    it('should return timeline in reverse chronological order', async () => {
      const rows = [
        mockEventRow({ id: 'id-3', created_at: new Date('2024-01-17T10:00:00Z') }),
        mockEventRow({ id: 'id-2', created_at: new Date('2024-01-16T10:00:00Z') }),
        mockEventRow({ id: 'id-1', created_at: new Date('2024-01-15T10:00:00Z') }),
      ];

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '3' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows });

      const result = await service.getTimeline('project', MOCK_ENTITY_ID);

      expect(result.total).toBe(3);
      expect(result.events).toHaveLength(3);
      // First event should be most recent
      expect(result.events[0].id).toBe('id-3');
    });

    it('should filter by event type', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockEventRow({ event_type: TimelineEventType.PAYMENT_RECEIVED })],
      });

      const result = await service.getTimeline('project', MOCK_ENTITY_ID, {
        eventType: TimelineEventType.PAYMENT_RECEIVED,
      });

      expect(result.total).toBe(1);
      expect(result.events[0].eventType).toBe(TimelineEventType.PAYMENT_RECEIVED);
    });

    it('should filter by date range', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '2' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          mockEventRow({ created_at: new Date('2024-01-16T10:00:00Z') }),
          mockEventRow({ created_at: new Date('2024-01-15T10:00:00Z') }),
        ],
      });

      const result = await service.getTimeline('project', MOCK_ENTITY_ID, {
        dateFrom: new Date('2024-01-15'),
        dateTo: new Date('2024-01-17'),
      });

      expect(result.total).toBe(2);
      expect(result.events).toHaveLength(2);
    });

    it('should support pagination', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '10' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockEventRow(), mockEventRow()],
      });

      const result = await service.getTimeline('project', MOCK_ENTITY_ID, {
        limit: 2,
        offset: 4,
      });

      expect(result.total).toBe(10);
      expect(result.events).toHaveLength(2);
    });

    it('should return empty timeline when no events exist', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '0' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.getTimeline('client', MOCK_ENTITY_ID);

      expect(result.total).toBe(0);
      expect(result.events).toHaveLength(0);
    });

    it('should reject invalid entity type', async () => {
      await expect(
        service.getTimeline('invalid' as EntityType, MOCK_ENTITY_ID)
      ).rejects.toThrow('Invalid entity type');
    });
  });

  // ─── addNote ───────────────────────────────────────────────────────────────

  describe('addNote', () => {
    it('should add a note to the timeline', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          mockEventRow({
            event_type: TimelineEventType.NOTE_ADDED,
            description: 'This is a manual note',
          }),
        ],
      });

      const event = await service.addNote(
        'project',
        MOCK_ENTITY_ID,
        MOCK_ACTOR_ID,
        'This is a manual note'
      );

      expect(event.eventType).toBe(TimelineEventType.NOTE_ADDED);
      expect(event.description).toBe('This is a manual note');
      expect(event.actorId).toBe(MOCK_ACTOR_ID);
    });

    it('should add a note with @mentions', async () => {
      const mentions = ['user-id-1', 'user-id-2'];
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          mockEventRow({
            event_type: TimelineEventType.NOTE_ADDED,
            description: 'Hey @user1 and @user2, check this out',
            metadata: { mentions },
          }),
        ],
      });

      const event = await service.addNote(
        'project',
        MOCK_ENTITY_ID,
        MOCK_ACTOR_ID,
        'Hey @user1 and @user2, check this out',
        mentions
      );

      expect(event.eventType).toBe(TimelineEventType.NOTE_ADDED);
      expect(event.metadata?.mentions).toEqual(mentions);
    });

    it('should reject empty note', async () => {
      await expect(
        service.addNote('project', MOCK_ENTITY_ID, MOCK_ACTOR_ID, '')
      ).rejects.toThrow('Note content is required');

      await expect(
        service.addNote('project', MOCK_ENTITY_ID, MOCK_ACTOR_ID, '   ')
      ).rejects.toThrow('Note content is required');
    });

    it('should reject missing actor ID', async () => {
      await expect(
        service.addNote('project', MOCK_ENTITY_ID, '', 'Some note')
      ).rejects.toThrow('Actor ID is required');
    });

    it('should work for client entity type', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          mockEventRow({
            entity_type: 'client',
            event_type: TimelineEventType.NOTE_ADDED,
            description: 'Client note',
          }),
        ],
      });

      const event = await service.addNote('client', MOCK_ENTITY_ID, MOCK_ACTOR_ID, 'Client note');

      expect(event.entityType).toBe('client');
      expect(event.eventType).toBe(TimelineEventType.NOTE_ADDED);
    });
  });

  // ─── getEventTypes ─────────────────────────────────────────────────────────

  describe('getEventTypes', () => {
    it('should return all valid event types', () => {
      const eventTypes = service.getEventTypes();

      expect(eventTypes).toContain(TimelineEventType.CREATED);
      expect(eventTypes).toContain(TimelineEventType.STATUS_CHANGED);
      expect(eventTypes).toContain(TimelineEventType.PAYMENT_RECEIVED);
      expect(eventTypes).toContain(TimelineEventType.COMMUNICATION_LOGGED);
      expect(eventTypes).toContain(TimelineEventType.DOCUMENT_UPLOADED);
      expect(eventTypes).toContain(TimelineEventType.ASSIGNMENT_CHANGED);
      expect(eventTypes).toContain(TimelineEventType.NOTE_ADDED);
      expect(eventTypes).toContain(TimelineEventType.GITHUB_REPO_LINKED);
      expect(eventTypes).toContain(TimelineEventType.GITHUB_PR_MERGED);
      expect(eventTypes).toContain(TimelineEventType.CONTRACT_GENERATED);
      expect(eventTypes.length).toBeGreaterThan(0);
    });
  });
});
