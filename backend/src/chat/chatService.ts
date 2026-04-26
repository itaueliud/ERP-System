import { db } from '../database/connection';
import { notificationService } from '../notifications/notificationService';
import { NotificationPriority, NotificationType } from '../notifications/notificationService';
import logger from '../utils/logger';

/**
 * ChatService - manages chat rooms, membership, and messages
 * Requirements: 13.1-13.9
 */

export type RoomType = 'DIRECT' | 'GROUP' | 'DEPARTMENT' | 'PROJECT';

/** Maximum file attachment size: 10 MB (Requirement 13.8) */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Message retention period in days (Requirement 13.6) */
export const MESSAGE_RETENTION_DAYS = 90;

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  fileId: string | null;
  createdAt: Date;
  readBy?: string[];
  isDeletedForEveryone?: boolean;
}

export interface MessageFilters {
  before?: Date;
  after?: Date;
  limit?: number;
  offset?: number;
}

export interface MessageSearchFilters extends MessageFilters {
  keyword: string;
}

export interface MutedRoom {
  roomId: string;
  userId: string;
  mutedAt: Date;
}

export interface ChatRoom {
  id: string;
  name: string | null;
  type: RoomType;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  read_by?: string[];
  is_deleted_for_everyone?: boolean;
}

export interface ChatRoomMember {
  id: string;
  roomId: string;
  userId: string;
  joinedAt: Date;
  lastReadAt: Date | null;
}

export class ChatService {
  /**
   * Create a new chat room.
   * Requirement 13.2: One-on-one direct messages
   * Requirement 13.3: Group chat channels for departments and projects
   */
  async createRoom(
    type: RoomType,
    name: string | null,
    memberIds: string[]
  ): Promise<ChatRoom> {
    const roomResult = await db.query<{
      id: string;
      name: string | null;
      type: string;
      metadata: Record<string, unknown> | null;
      created_at: Date;
    }>(
      `INSERT INTO chat_rooms (name, type)
       VALUES ($1, $2)
       RETURNING id, name, type, metadata, created_at`,
      [name, type]
    );

    const room = roomResult.rows[0];

    // Add members
    if (memberIds.length > 0) {
      const values = memberIds
        .map((_, i) => `($1, $${i + 2})`)
        .join(', ');
      await db.query(
        `INSERT INTO chat_room_members (room_id, user_id) VALUES ${values}`,
        [room.id, ...memberIds]
      );
    }

    logger.info('Chat room created', { roomId: room.id, type, memberCount: memberIds.length });

    return {
      id: room.id,
      name: room.name,
      type: room.type as RoomType,
      metadata: room.metadata,
      createdAt: room.created_at,
    };
  }

  /**
   * Get room details by ID.
   */
  async getRoom(roomId: string): Promise<ChatRoom | null> {
    const result = await db.query<{
      id: string;
      name: string | null;
      type: string;
      metadata: Record<string, unknown> | null;
      created_at: Date;
    }>(
      `SELECT id, name, type, metadata, created_at
       FROM chat_rooms
       WHERE id = $1`,
      [roomId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      type: row.type as RoomType,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }

  /**
   * Get all rooms a user belongs to.
   */
  async getRoomsForUser(userId: string): Promise<ChatRoom[]> {
    const result = await db.query<{
      id: string;
      name: string | null;
      type: string;
      metadata: Record<string, unknown> | null;
      created_at: Date;
    }>(
      `SELECT cr.id, cr.name, cr.type, cr.metadata, cr.created_at
       FROM chat_rooms cr
       JOIN chat_room_members crm ON crm.room_id = cr.id
       WHERE crm.user_id = $1
       ORDER BY cr.created_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as RoomType,
      metadata: row.metadata,
      createdAt: row.created_at,
      readBy: (row as any).read_by || [],
      isDeletedForEveryone: (row as any).is_deleted_for_everyone || false,
    }));
  }

  /**
   * Add a member to a room.
   */
  async addMember(roomId: string, userId: string): Promise<ChatRoomMember> {
    const result = await db.query<{
      id: string;
      room_id: string;
      user_id: string;
      joined_at: Date;
      last_read_at: Date | null;
    }>(
      `INSERT INTO chat_room_members (room_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (room_id, user_id) DO UPDATE SET joined_at = EXCLUDED.joined_at
       RETURNING id, room_id, user_id, joined_at, last_read_at`,
      [roomId, userId]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      roomId: row.room_id,
      userId: row.user_id,
      joinedAt: row.joined_at,
      lastReadAt: row.last_read_at,
    };
  }

  /**
   * Remove a member from a room.
   */
  async removeMember(roomId: string, userId: string): Promise<void> {
    await db.query(
      `DELETE FROM chat_room_members WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
    logger.info('Member removed from room', { roomId, userId });
  }

  /**
   * Get all members of a room.
   */
  async getMembers(roomId: string): Promise<ChatRoomMember[]> {
    const result = await db.query<{
      id: string;
      room_id: string;
      user_id: string;
      joined_at: Date;
      last_read_at: Date | null;
    }>(
      `SELECT id, room_id, user_id, joined_at, last_read_at
       FROM chat_room_members
       WHERE room_id = $1
       ORDER BY joined_at ASC`,
      [roomId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      roomId: row.room_id,
      userId: row.user_id,
      joinedAt: row.joined_at,
      lastReadAt: row.last_read_at,
    }));
  }

  /**
   * Get or create a direct message room between two users.
   * Requirement 13.2: One-on-one direct messages
   */
  async getOrCreateDirectRoom(userId1: string, userId2: string): Promise<ChatRoom> {
    // Look for an existing DIRECT room that contains exactly these two users
    const existing = await db.query<{
      id: string;
      name: string | null;
      type: string;
      metadata: Record<string, unknown> | null;
      created_at: Date;
    }>(
      `SELECT cr.id, cr.name, cr.type, cr.metadata, cr.created_at
       FROM chat_rooms cr
       WHERE cr.type = 'DIRECT'
         AND (
           SELECT COUNT(*) FROM chat_room_members WHERE room_id = cr.id
         ) = 2
         AND EXISTS (
           SELECT 1 FROM chat_room_members WHERE room_id = cr.id AND user_id = $1
         )
         AND EXISTS (
           SELECT 1 FROM chat_room_members WHERE room_id = cr.id AND user_id = $2
         )
       LIMIT 1`,
      [userId1, userId2]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      return {
        id: row.id,
        name: row.name,
        type: row.type as RoomType,
        metadata: row.metadata,
        createdAt: row.created_at,
      };
    }

    // Create a new direct room
    return this.createRoom('DIRECT', null, [userId1, userId2]);
  }

  // ─── Message Methods ────────────────────────────────────────────────────────

  /**
   * Send a message to a room and persist it.
   * Requirement 13.4: Deliver messages within 2 seconds
   * Requirement 13.8: Support file attachments up to 10 MB
   * Requirement 13.9: Store file attachments in File_Storage
   * Requirement 13.11: Detect @mentions and send notifications
   */
  async sendMessage(
    roomId: string,
    senderId: string,
    content: string,
    fileId?: string
  ): Promise<ChatMessage> {
    // Ensure a partition exists for the current month before inserting
    await this.ensureCurrentMonthPartition();

    const result = await db.query<{
      id: string;
      room_id: string;
      sender_id: string;
      content: string;
      file_id: string | null;
      created_at: Date;
    }>(
      `INSERT INTO chat_messages (room_id, sender_id, content, file_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, room_id, sender_id, content, file_id, created_at`,
      [roomId, senderId, content, fileId ?? null]
    );

    const row = result.rows[0];
    logger.info('Chat message sent', { roomId, senderId, messageId: row.id });

    const message: ChatMessage = {
      id: row.id,
      roomId: row.room_id,
      senderId: row.sender_id,
      content: row.content,
      fileId: row.file_id,
      createdAt: row.created_at,
    };

    // Detect and notify @mentions (Requirement 13.11)
    const mentions = this.extractMentions(content);
    if (mentions.length > 0) {
      this.notifyMentionedUsers(message, mentions).catch((err) => {
        logger.warn('Failed to process mention notifications', { messageId: message.id, err });
      });
    }

    return message;
  }

  /**
   * Get message history for a room with optional filters and pagination.
   * Requirement 13.6: Store chat message history for 90 days
   * Requirement 13.7: Allow users to search chat history by keyword
   */
  async getMessages(roomId: string, filters?: MessageFilters): Promise<ChatMessage[]> {
    const conditions: string[] = ['room_id = $1', 'is_deleted_for_everyone = FALSE'];
    const params: unknown[] = [roomId];
    let idx = 2;

    if (filters?.after) {
      conditions.push(`created_at > $${idx++}`);
      params.push(filters.after);
    }
    if (filters?.before) {
      conditions.push(`created_at < $${idx++}`);
      params.push(filters.before);
    }

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    params.push(limit, offset);

    const result = await db.query<{
      id: string;
      room_id: string;
      sender_id: string;
      content: string;
      file_id: string | null;
      created_at: Date;
    }>(
      `SELECT id, room_id, sender_id, content, file_id, created_at, read_by, is_deleted_for_everyone
       FROM chat_messages
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    return result.rows.map((row) => ({
      id: row.id,
      roomId: row.room_id,
      senderId: row.sender_id,
      content: row.content,
      fileId: row.file_id,
      createdAt: row.created_at,
      readBy: (row as any).read_by || [],
      isDeletedForEveryone: (row as any).is_deleted_for_everyone || false,
    }));
  }

  /**
   * Get unread message count for a user in a room.
   * Requirement 13.5: Display unread message count on user interface
   */
  async getUnreadCount(roomId: string, userId: string): Promise<number> {
    const result = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM chat_messages cm
       JOIN chat_room_members crm
         ON crm.room_id = cm.room_id AND crm.user_id = $2
       WHERE cm.room_id = $1
         AND cm.sender_id != $2
         AND (crm.last_read_at IS NULL OR cm.created_at > crm.last_read_at)`,
      [roomId, userId]
    );

    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  /**
   * Mark all messages in a room as read for a user.
   * Requirement 13.5: Display unread message count on user interface
   */
  async markRoomAsRead(roomId: string, userId: string): Promise<void> {
    await db.query(
      `UPDATE chat_room_members
       SET last_read_at = NOW()
       WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
    logger.info('Room marked as read', { roomId, userId });
  }

  /**
   * Delete messages older than the retention period.
   * Requirement 13.6: Store chat message history for 90 days
   */
  async deleteOldMessages(daysOld: number = MESSAGE_RETENTION_DAYS): Promise<number> {
    const result = await db.query<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM chat_messages
         WHERE created_at < NOW() - INTERVAL '1 day' * $1
         RETURNING id
       )
       SELECT COUNT(*) AS count FROM deleted`,
      [daysOld]
    );

    const deleted = parseInt(result.rows[0]?.count ?? '0', 10);
    logger.info('Old chat messages deleted', { daysOld, deleted });
    return deleted;
  }

  // ─── Search ─────────────────────────────────────────────────────────────────

  /**
   * Search messages in a room by keyword.
   * Requirement 13.7: Allow users to search chat history by keyword
   */
  async searchMessages(
    roomId: string,
    keyword: string,
    filters?: MessageFilters
  ): Promise<ChatMessage[]> {
    const conditions: string[] = ['room_id = $1', 'content ILIKE $2'];
    const params: unknown[] = [roomId, `%${keyword}%`];
    let idx = 3;

    if (filters?.after) {
      conditions.push(`created_at > $${idx++}`);
      params.push(filters.after);
    }
    if (filters?.before) {
      conditions.push(`created_at < $${idx++}`);
      params.push(filters.before);
    }

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    params.push(limit, offset);

    const result = await db.query<{
      id: string;
      room_id: string;
      sender_id: string;
      content: string;
      file_id: string | null;
      created_at: Date;
    }>(
      `SELECT id, room_id, sender_id, content, file_id, created_at, read_by, is_deleted_for_everyone
       FROM chat_messages
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    return result.rows.map((row) => ({
      id: row.id,
      roomId: row.room_id,
      senderId: row.sender_id,
      content: row.content,
      fileId: row.file_id,
      createdAt: row.created_at,
      readBy: (row as any).read_by || [],
      isDeletedForEveryone: (row as any).is_deleted_for_everyone || false,
    }));
  }

  // ─── Mentions ────────────────────────────────────────────────────────────────

  /**
   * Extract @mentions from message content.
   * Requirement 13.11: Send notification when user is @mentioned
   */
  extractMentions(content: string): string[] {
    const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
    const mentions: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = mentionRegex.exec(content)) !== null) {
      const username = match[1];
      if (!mentions.includes(username)) {
        mentions.push(username);
      }
    }

    return mentions;
  }

  /**
   * Send notifications to users mentioned in a message.
   * Requirement 13.11: Send notification when user is @mentioned
   */
  async notifyMentionedUsers(message: ChatMessage, mentions: string[]): Promise<void> {
    if (mentions.length === 0) return;

    // Resolve usernames to user IDs
    const placeholders = mentions.map((_, i) => `$${i + 1}`).join(', ');
    const result = await db.query<{ id: string; username: string }>(
      `SELECT id, username FROM users WHERE username = ANY(ARRAY[${placeholders}])`,
      mentions
    );

    const notifyPromises = result.rows
      .filter((user) => user.id !== message.senderId)
      .map((user) =>
        notificationService
          .sendNotification({
            userId: user.id,
            type: NotificationType.MESSAGE_RECEIVED,
            priority: NotificationPriority.LOW,
            title: 'You were mentioned in a message',
            message: `You were mentioned in a chat message: "${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}"`,
            data: {
              roomId: message.roomId,
              messageId: message.id,
              senderId: message.senderId,
            },
          })
          .catch((err) => {
            logger.warn('Failed to send mention notification', { userId: user.id, err });
          })
      );

    await Promise.all(notifyPromises);
    logger.info('Mention notifications sent', { messageId: message.id, mentionCount: result.rows.length });
  }

  // ─── Mute ────────────────────────────────────────────────────────────────────

  /**
   * Mute a chat room for a user.
   * Requirement 13.12: Allow users to mute chat channels
   */
  async muteRoom(roomId: string, userId: string): Promise<void> {
    await db.query(
      `UPDATE chat_room_members
       SET muted = TRUE
       WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
    logger.info('Room muted', { roomId, userId });
  }

  /**
   * Unmute a chat room for a user.
   * Requirement 13.12: Allow users to mute chat channels
   */
  async unmuteRoom(roomId: string, userId: string): Promise<void> {
    await db.query(
      `UPDATE chat_room_members
       SET muted = FALSE
       WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
    logger.info('Room unmuted', { roomId, userId });
  }

  /**
   * Check if a room is muted for a user.
   * Requirement 13.12: Allow users to mute chat channels
   */
  async isMuted(roomId: string, userId: string): Promise<boolean> {
    const result = await db.query<{ muted: boolean }>(
      `SELECT muted FROM chat_room_members WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
    return result.rows[0]?.muted ?? false;
  }

  /**
   * Get all muted rooms for a user.
   * Requirement 13.12: Allow users to mute chat channels
   */
  async getMutedRooms(userId: string): Promise<ChatRoom[]> {
    const result = await db.query<{
      id: string;
      name: string | null;
      type: string;
      metadata: Record<string, unknown> | null;
      created_at: Date;
    }>(
      `SELECT cr.id, cr.name, cr.type, cr.metadata, cr.created_at
       FROM chat_rooms cr
       JOIN chat_room_members crm ON crm.room_id = cr.id
       WHERE crm.user_id = $1 AND crm.muted = TRUE
       ORDER BY cr.created_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as RoomType,
      metadata: row.metadata,
      createdAt: row.created_at,
      readBy: (row as any).read_by || [],
      isDeletedForEveryone: (row as any).is_deleted_for_everyone || false,
    }));
  }
  /**
   * Ensures a partition exists for the current month.
   * chat_messages is partitioned by month — missing partitions cause INSERT failures.
   */
  private async ensureCurrentMonthPartition(): Promise<void> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const nextMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
    const nextYear = now.getMonth() === 11 ? year + 1 : year;
    const nextMonthStr = String(nextMonth).padStart(2, '0');

    const partitionName = `chat_messages_${year}_${month}`;
    const fromDate = `${year}-${month}-01`;
    const toDate = `${nextYear}-${nextMonthStr}-01`;

    try {
      await db.query(
        `CREATE TABLE IF NOT EXISTS ${partitionName}
         PARTITION OF chat_messages
         FOR VALUES FROM ('${fromDate}') TO ('${toDate}')`
      );
    } catch (err: any) {
      // Partition may already exist or overlap — safe to ignore
      if (!err.message?.includes('already exists') && !err.message?.includes('overlap')) {
        logger.warn('Could not create chat partition', { partitionName, err: err.message });
      }
    }
  }
}

export const chatService = new ChatService();
export default chatService;
