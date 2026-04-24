/**
 * Tests for ChatService
 * Requirements: 13.1-13.9
 */

import { ChatService, MAX_FILE_SIZE_BYTES, MESSAGE_RETENTION_DAYS, ChatMessage } from './chatService';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../database/connection', () => ({
  db: {
    query: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

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
    MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  },
}));

import { db } from '../database/connection';
const mockDb = db as jest.Mocked<typeof db>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROOM_ROW = {
  id: 'room-1',
  name: 'Test Room',
  type: 'GROUP',
  metadata: null,
  created_at: new Date('2024-01-01'),
};

const MEMBER_ROW = {
  id: 'member-1',
  room_id: 'room-1',
  user_id: 'user-1',
  joined_at: new Date('2024-01-01'),
  last_read_at: null,
};

const MESSAGE_ROW = {
  id: 'msg-1',
  room_id: 'room-1',
  sender_id: 'user-1',
  content: 'Hello world',
  file_id: null,
  created_at: new Date('2024-01-15'),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(() => {
    service = new ChatService();
    jest.clearAllMocks();
  });

  // ── createRoom ──────────────────────────────────────────────────────────────

  describe('createRoom', () => {
    it('creates a GROUP room and inserts members', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [ROOM_ROW], rowCount: 1 } as any) // INSERT room
        .mockResolvedValueOnce({ rows: [], rowCount: 2 } as any); // INSERT members

      const room = await service.createRoom('GROUP', 'Test Room', ['user-1', 'user-2']);

      expect(room.id).toBe('room-1');
      expect(room.type).toBe('GROUP');
      expect(room.name).toBe('Test Room');
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('creates a room without members when memberIds is empty', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [ROOM_ROW], rowCount: 1 } as any);

      const room = await service.createRoom('GROUP', 'Empty Room', []);

      expect(room.id).toBe('room-1');
      // Only one query (no member insert)
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('creates a DIRECT room', async () => {
      const directRow = { ...ROOM_ROW, type: 'DIRECT', name: null };
      mockDb.query
        .mockResolvedValueOnce({ rows: [directRow], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 2 } as any);

      const room = await service.createRoom('DIRECT', null, ['user-1', 'user-2']);

      expect(room.type).toBe('DIRECT');
      expect(room.name).toBeNull();
    });
  });

  // ── getRoom ─────────────────────────────────────────────────────────────────

  describe('getRoom', () => {
    it('returns room when found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [ROOM_ROW], rowCount: 1 } as any);

      const room = await service.getRoom('room-1');

      expect(room).not.toBeNull();
      expect(room!.id).toBe('room-1');
    });

    it('returns null when room not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const room = await service.getRoom('nonexistent');

      expect(room).toBeNull();
    });
  });

  // ── getRoomsForUser ─────────────────────────────────────────────────────────

  describe('getRoomsForUser', () => {
    it('returns list of rooms for user', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [ROOM_ROW], rowCount: 1 } as any);

      const rooms = await service.getRoomsForUser('user-1');

      expect(rooms).toHaveLength(1);
      expect(rooms[0].id).toBe('room-1');
    });

    it('returns empty array when user has no rooms', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const rooms = await service.getRoomsForUser('user-no-rooms');

      expect(rooms).toEqual([]);
    });
  });

  // ── addMember ───────────────────────────────────────────────────────────────

  describe('addMember', () => {
    it('adds a member and returns member record', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [MEMBER_ROW], rowCount: 1 } as any);

      const member = await service.addMember('room-1', 'user-1');

      expect(member.roomId).toBe('room-1');
      expect(member.userId).toBe('user-1');
    });
  });

  // ── removeMember ────────────────────────────────────────────────────────────

  describe('removeMember', () => {
    it('executes delete query', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await service.removeMember('room-1', 'user-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM chat_room_members'),
        ['room-1', 'user-1']
      );
    });
  });

  // ── getMembers ──────────────────────────────────────────────────────────────

  describe('getMembers', () => {
    it('returns members for a room', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [MEMBER_ROW], rowCount: 1 } as any);

      const members = await service.getMembers('room-1');

      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe('user-1');
    });

    it('returns empty array for room with no members', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const members = await service.getMembers('empty-room');

      expect(members).toEqual([]);
    });
  });

  // ── getOrCreateDirectRoom ───────────────────────────────────────────────────

  describe('getOrCreateDirectRoom', () => {
    it('returns existing direct room when found', async () => {
      const directRow = { ...ROOM_ROW, type: 'DIRECT', name: null };
      mockDb.query.mockResolvedValueOnce({ rows: [directRow], rowCount: 1 } as any);

      const room = await service.getOrCreateDirectRoom('user-1', 'user-2');

      expect(room.type).toBe('DIRECT');
      // Should only query once (no creation)
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('creates a new direct room when none exists', async () => {
      const directRow = { ...ROOM_ROW, type: 'DIRECT', name: null };
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // no existing room
        .mockResolvedValueOnce({ rows: [directRow], rowCount: 1 } as any) // INSERT room
        .mockResolvedValueOnce({ rows: [], rowCount: 2 } as any); // INSERT members

      const room = await service.getOrCreateDirectRoom('user-1', 'user-2');

      expect(room.type).toBe('DIRECT');
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });
  });

  // ── sendMessage ─────────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('inserts message and returns ChatMessage', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [MESSAGE_ROW], rowCount: 1 } as any);

      const msg = await service.sendMessage('room-1', 'user-1', 'Hello world');

      expect(msg.id).toBe('msg-1');
      expect(msg.roomId).toBe('room-1');
      expect(msg.senderId).toBe('user-1');
      expect(msg.content).toBe('Hello world');
      expect(msg.fileId).toBeNull();
    });

    it('inserts message with fileId when provided', async () => {
      const rowWithFile = { ...MESSAGE_ROW, file_id: 'file-abc' };
      mockDb.query.mockResolvedValueOnce({ rows: [rowWithFile], rowCount: 1 } as any);

      const msg = await service.sendMessage('room-1', 'user-1', 'See attachment', 'file-abc');

      expect(msg.fileId).toBe('file-abc');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chat_messages'),
        ['room-1', 'user-1', 'See attachment', 'file-abc']
      );
    });

    it('passes null for fileId when not provided', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [MESSAGE_ROW], rowCount: 1 } as any);

      await service.sendMessage('room-1', 'user-1', 'No file');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chat_messages'),
        ['room-1', 'user-1', 'No file', null]
      );
    });
  });

  // ── getMessages ─────────────────────────────────────────────────────────────

  describe('getMessages', () => {
    it('returns messages for a room', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [MESSAGE_ROW], rowCount: 1 } as any);

      const messages = await service.getMessages('room-1');

      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-1');
      expect(messages[0].content).toBe('Hello world');
    });

    it('returns empty array when no messages', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const messages = await service.getMessages('room-empty');

      expect(messages).toEqual([]);
    });

    it('applies before/after filters', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const before = new Date('2024-02-01');
      const after = new Date('2024-01-01');
      await service.getMessages('room-1', { before, after });

      const [sql, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('created_at >');
      expect(sql).toContain('created_at <');
      expect(params).toContain(after);
      expect(params).toContain(before);
    });

    it('uses default limit of 50 and offset 0', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await service.getMessages('room-1');

      const [, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(params).toContain(50);
      expect(params).toContain(0);
    });
  });

  // ── getUnreadCount ──────────────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('returns parsed integer count', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '7' }], rowCount: 1 } as any);

      const count = await service.getUnreadCount('room-1', 'user-2');

      expect(count).toBe(7);
    });

    it('returns 0 when no unread messages', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as any);

      const count = await service.getUnreadCount('room-1', 'user-1');

      expect(count).toBe(0);
    });

    it('returns 0 when query returns no rows', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const count = await service.getUnreadCount('room-1', 'user-1');

      expect(count).toBe(0);
    });
  });

  // ── markRoomAsRead ──────────────────────────────────────────────────────────

  describe('markRoomAsRead', () => {
    it('updates last_read_at for the user in the room', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await service.markRoomAsRead('room-1', 'user-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE chat_room_members'),
        ['room-1', 'user-1']
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('last_read_at = NOW()'),
        expect.any(Array)
      );
    });
  });

  // ── deleteOldMessages ───────────────────────────────────────────────────────

  describe('deleteOldMessages', () => {
    it('deletes messages older than default 90 days', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '15' }], rowCount: 1 } as any);

      const deleted = await service.deleteOldMessages();

      expect(deleted).toBe(15);
      const [, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(params).toContain(MESSAGE_RETENTION_DAYS);
    });

    it('deletes messages older than custom days', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 } as any);

      const deleted = await service.deleteOldMessages(30);

      expect(deleted).toBe(3);
      const [, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(params).toContain(30);
    });

    it('returns 0 when no messages deleted', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as any);

      const deleted = await service.deleteOldMessages();

      expect(deleted).toBe(0);
    });
  });

  // ── searchMessages ──────────────────────────────────────────────────────────

  describe('searchMessages', () => {
    it('returns messages matching keyword', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [MESSAGE_ROW], rowCount: 1 } as any);

      const messages = await service.searchMessages('room-1', 'Hello');

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hello world');
      const [sql, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('ILIKE');
      expect(params).toContain('%Hello%');
    });

    it('returns empty array when no messages match', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const messages = await service.searchMessages('room-1', 'nonexistent');

      expect(messages).toEqual([]);
    });

    it('applies before/after filters alongside keyword', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const before = new Date('2024-02-01');
      const after = new Date('2024-01-01');
      await service.searchMessages('room-1', 'test', { before, after });

      const [sql, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('created_at >');
      expect(sql).toContain('created_at <');
      expect(params).toContain(after);
      expect(params).toContain(before);
    });

    it('uses default limit 50 and offset 0', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await service.searchMessages('room-1', 'hello');

      const [, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(params).toContain(50);
      expect(params).toContain(0);
    });
  });

  // ── extractMentions ─────────────────────────────────────────────────────────

  describe('extractMentions', () => {
    it('extracts single @mention', () => {
      const mentions = service.extractMentions('Hello @alice, how are you?');
      expect(mentions).toEqual(['alice']);
    });

    it('extracts multiple @mentions', () => {
      const mentions = service.extractMentions('Hey @alice and @bob, check this out');
      expect(mentions).toEqual(['alice', 'bob']);
    });

    it('deduplicates repeated @mentions', () => {
      const mentions = service.extractMentions('@alice @alice @alice');
      expect(mentions).toEqual(['alice']);
    });

    it('returns empty array when no mentions', () => {
      const mentions = service.extractMentions('No mentions here');
      expect(mentions).toEqual([]);
    });

    it('handles @mentions with dots and underscores', () => {
      const mentions = service.extractMentions('Hello @john.doe and @jane_smith');
      expect(mentions).toEqual(['john.doe', 'jane_smith']);
    });

    it('handles @mention at start of message', () => {
      const mentions = service.extractMentions('@admin please review');
      expect(mentions).toEqual(['admin']);
    });
  });

  // ── notifyMentionedUsers ────────────────────────────────────────────────────

  describe('notifyMentionedUsers', () => {
    it('does nothing when mentions list is empty', async () => {
      const message: ChatMessage = {
        id: 'msg-1',
        roomId: 'room-1',
        senderId: 'user-1',
        content: 'No mentions',
        fileId: null,
        createdAt: new Date(),
      };

      // Should not call db.query at all
      await service.notifyMentionedUsers(message, []);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('queries users by username and sends notifications', async () => {
      const message: ChatMessage = {
        id: 'msg-1',
        roomId: 'room-1',
        senderId: 'user-sender',
        content: 'Hello @alice',
        fileId: null,
        createdAt: new Date(),
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'user-alice', username: 'alice' }],
        rowCount: 1,
      } as any);

      // notificationService.sendNotification is mocked at module level
      await service.notifyMentionedUsers(message, ['alice']);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, username FROM users'),
        ['alice']
      );
    });

    it('skips notification for the sender themselves', async () => {
      const message: ChatMessage = {
        id: 'msg-1',
        roomId: 'room-1',
        senderId: 'user-alice',
        content: 'Hello @alice',
        fileId: null,
        createdAt: new Date(),
      };

      // Return alice as the mentioned user, but she is also the sender
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'user-alice', username: 'alice' }],
        rowCount: 1,
      } as any);

      // Should not throw even if notification is skipped
      await expect(service.notifyMentionedUsers(message, ['alice'])).resolves.not.toThrow();
    });
  });

  // ── muteRoom / unmuteRoom / isMuted / getMutedRooms ─────────────────────────

  describe('muteRoom', () => {
    it('updates muted flag to TRUE', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await service.muteRoom('room-1', 'user-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SET muted = TRUE'),
        ['room-1', 'user-1']
      );
    });
  });

  describe('unmuteRoom', () => {
    it('updates muted flag to FALSE', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await service.unmuteRoom('room-1', 'user-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SET muted = FALSE'),
        ['room-1', 'user-1']
      );
    });
  });

  describe('isMuted', () => {
    it('returns true when room is muted', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ muted: true }], rowCount: 1 } as any);

      const result = await service.isMuted('room-1', 'user-1');

      expect(result).toBe(true);
    });

    it('returns false when room is not muted', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ muted: false }], rowCount: 1 } as any);

      const result = await service.isMuted('room-1', 'user-1');

      expect(result).toBe(false);
    });

    it('returns false when membership record not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await service.isMuted('room-1', 'user-nonmember');

      expect(result).toBe(false);
    });
  });

  describe('getMutedRooms', () => {
    it('returns muted rooms for a user', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [ROOM_ROW], rowCount: 1 } as any);

      const rooms = await service.getMutedRooms('user-1');

      expect(rooms).toHaveLength(1);
      expect(rooms[0].id).toBe('room-1');
      const [sql, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('muted = TRUE');
      expect(params).toContain('user-1');
    });

    it('returns empty array when no muted rooms', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const rooms = await service.getMutedRooms('user-1');

      expect(rooms).toEqual([]);
    });
  });

  // ── Constants ───────────────────────────────────────────────────────────────

  describe('constants', () => {
    it('MAX_FILE_SIZE_BYTES is 10 MB', () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    });

    it('MESSAGE_RETENTION_DAYS is 90', () => {
      expect(MESSAGE_RETENTION_DAYS).toBe(90);
    });
  });
});
