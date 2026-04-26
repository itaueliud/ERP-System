import { Router, Request, Response } from 'express';
import { chatService, RoomType, MAX_FILE_SIZE_BYTES } from './chatService';
import { chatServer } from './chatServer';
import { authService } from '../auth/authService';
import logger from '../utils/logger';

/**
 * Chat REST API routes
 * Requirements: 13.1-13.9
 */

const router = Router();

// ─── Authentication middleware ────────────────────────────────────────────────

async function authenticate(req: Request, res: Response, next: () => void): Promise<void> {
  const token =
    req.headers.authorization?.replace('Bearer ', '') ||
    (req as any).cookies?.auth_token;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const payload = await authService.validateToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const user = await authService.getUserById(payload.userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  (req as any).user = {
    id: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
    sessionId: payload.sessionId,
  };

  next();
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/chat/rooms
 * Create a new chat room.
 * Requirement 13.3: Group chat channels for departments and projects
 */
router.post('/rooms', authenticate as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    // doc §18: Agents have no chat — personal dashboard only
    if (userRole === 'AGENT') {
      return res.status(403).json({ error: 'Agents do not have chat access' });
    }

    // doc §21: Non-leader developers cannot create rooms (Team Leaders only)
    if (userRole === 'DEVELOPER') {
      const { db } = await import('../database/connection');
      const check = await db.query(`SELECT is_team_leader FROM users WHERE id = $1`, [userId]);
      if (check.rows.length && !check.rows[0].is_team_leader) {
        return res.status(403).json({ error: 'Only Team Leaders can initiate chat' });
      }
    }

    const { type, name, memberIds } = req.body;

    const validTypes: RoomType[] = ['DIRECT', 'GROUP', 'DEPARTMENT', 'PROJECT'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    }

    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ error: 'memberIds must be an array' });
    }

    // For DIRECT messages, use getOrCreateDirectRoom to avoid duplicates
    if (type === 'DIRECT') {
      if (memberIds.length !== 1) {
        return res.status(400).json({ error: 'DIRECT rooms require exactly one other member' });
      }
      const room = await chatService.getOrCreateDirectRoom(userId, memberIds[0]);
      return res.status(200).json(room);
    }

    // Always include the creator
    const allMembers: string[] = Array.from(new Set([userId, ...memberIds]));

    const room = await chatService.createRoom(type as RoomType, name || null, allMembers);
    return res.status(201).json(room);
  } catch (error: any) {
    logger.error('Error creating chat room', { error });
    return res.status(500).json({ error: 'Failed to create chat room' });
  }
});

/**
 * GET /api/chat/rooms
 * Get all rooms for the authenticated user, including member IDs.
 */
router.get('/rooms', authenticate as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { db } = await import('../database/connection');

    // Fetch rooms with their member IDs in one query
    const result = await db.query(
      `SELECT cr.id, cr.name, cr.type, cr.metadata, cr.created_at,
              ARRAY_AGG(crm.user_id) AS member_ids
       FROM chat_rooms cr
       JOIN chat_room_members crm ON crm.room_id = cr.id
       WHERE cr.id IN (
         SELECT room_id FROM chat_room_members WHERE user_id = $1
       )
       GROUP BY cr.id
       ORDER BY cr.created_at DESC`,
      [userId]
    );

    const rooms = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      metadata: row.metadata,
      createdAt: row.created_at,
      memberIds: row.member_ids || [],
    }));

    return res.json({ rooms });
  } catch (error: any) {
    logger.error('Error fetching rooms', { error });
    return res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

/**
 * GET /api/chat/rooms/:roomId
 * Get room details.
 */
router.get('/rooms/:roomId', authenticate as any, async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const room = await chatService.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    return res.json(room);
  } catch (error: any) {
    logger.error('Error fetching room', { error });
    return res.status(500).json({ error: 'Failed to fetch room' });
  }
});

/**
 * POST /api/chat/rooms/:roomId/members
 * Add a member to a room.
 */
router.post(
  '/rooms/:roomId/members',
  authenticate as any,
  async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const room = await chatService.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const member = await chatService.addMember(roomId, userId);
      return res.status(201).json(member);
    } catch (error: any) {
      logger.error('Error adding member to room', { error });
      return res.status(500).json({ error: 'Failed to add member' });
    }
  }
);

/**
 * DELETE /api/chat/rooms/:roomId/members/:userId
 * Remove a member from a room.
 */
router.delete(
  '/rooms/:roomId/members/:userId',
  authenticate as any,
  async (req: Request, res: Response) => {
    try {
      const { roomId, userId } = req.params;

      const room = await chatService.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      await chatService.removeMember(roomId, userId);
      return res.json({ message: 'Member removed successfully' });
    } catch (error: any) {
      logger.error('Error removing member from room', { error });
      return res.status(500).json({ error: 'Failed to remove member' });
    }
  }
);

/**
 * GET /api/chat/online-users
 * Get list of online users.
 * Requirement 13.10: Display user online/offline status in real-time
 */
router.get('/online-users', authenticate as any, async (_req: Request, res: Response) => {
  try {
    const onlineUsers = chatServer.getOnlineUsers();
    return res.json({ onlineUsers });
  } catch (error: any) {
    logger.error('Error fetching online users', { error });
    return res.status(500).json({ error: 'Failed to fetch online users' });
  }
});

/**
 * POST /api/chat/rooms/direct
 * Get or create a direct message room between two users.
 * Requirement 13.2: One-on-one direct messages
 */
router.post('/rooms/direct', authenticate as any, async (req: Request, res: Response) => {
  try {
    const userId1 = (req as any).user?.id;
    const { userId2 } = req.body;

    if (!userId2) {
      return res.status(400).json({ error: 'userId2 is required' });
    }

    const room = await chatService.getOrCreateDirectRoom(userId1, userId2);
    return res.json(room);
  } catch (error: any) {
    logger.error('Error getting/creating direct room', { error });
    return res.status(500).json({ error: 'Failed to get or create direct room' });
  }
});

// ─── Message Routes ───────────────────────────────────────────────────────────

/**
 * POST /api/chat/rooms/:roomId/messages
 * Send a message to a room.
 * Requirement 13.4: Deliver messages within 2 seconds
 * Requirement 13.8: Support file attachments up to 10 MB
 */
router.post(
  '/rooms/:roomId/messages',
  authenticate as any,
  async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const senderId = (req as any).user?.id;
      const userRole = (req as any).user?.role;
      const { content, fileId, fileSizeBytes } = req.body;

      // doc §18: Agents have no chat access
      if (userRole === 'AGENT') {
        return res.status(403).json({ error: 'Agents do not have chat access' });
      }

      // doc §21: Non-leader developers can view but cannot send messages
      if (userRole === 'DEVELOPER') {
        const { db } = await import('../database/connection');
        const check = await db.query(`SELECT is_team_leader FROM users WHERE id = $1`, [senderId]);
        if (check.rows.length && !check.rows[0].is_team_leader) {
          return res.status(403).json({ error: 'Non-leader developers cannot send messages' });
        }
      }

      if (!content) {
        return res.status(400).json({ error: 'content is required' });
      }

      // Validate file attachment size (Requirement 13.8)
      if (fileId && fileSizeBytes !== undefined && fileSizeBytes > MAX_FILE_SIZE_BYTES) {
        return res.status(400).json({
          error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
        });
      }

      const room = await chatService.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const message = await chatService.sendMessage(roomId, senderId, content, fileId);

      // Emit via Socket.IO to room members (Requirement 13.4)
      chatServer.emitToRoom(roomId, 'message:new', message);

      return res.status(201).json(message);
    } catch (error: any) {
      logger.error('Error sending message', { error });
      return res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

/**
 * GET /api/chat/rooms/:roomId/messages
 * Get message history for a room.
 * Requirement 13.6: Store chat message history for 90 days
 */
router.get(
  '/rooms/:roomId/messages',
  authenticate as any,
  async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const { before, after, limit, offset } = req.query;

      const room = await chatService.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const messages = await chatService.getMessages(roomId, {
        before: before ? new Date(before as string) : undefined,
        after: after ? new Date(after as string) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      return res.json({ messages });
    } catch (error: any) {
      logger.error('Error fetching messages', { error });
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }
);

/**
 * GET /api/chat/rooms/:roomId/unread
 * Get unread message count for the authenticated user in a room.
 * Requirement 13.5: Display unread message count on user interface
 */
router.get(
  '/rooms/:roomId/unread',
  authenticate as any,
  async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const userId = (req as any).user?.id;

      const room = await chatService.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const count = await chatService.getUnreadCount(roomId, userId);
      return res.json({ unreadCount: count });
    } catch (error: any) {
      logger.error('Error fetching unread count', { error });
      return res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  }
);

/**
 * POST /api/chat/rooms/:roomId/read
 * Mark all messages in a room as read for the authenticated user.
 * Requirement 13.5: Display unread message count on user interface
 */
router.post(
  '/rooms/:roomId/read',
  authenticate as any,
  async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const userId = (req as any).user?.id;

      const room = await chatService.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      await chatService.markRoomAsRead(roomId, userId);
      return res.json({ message: 'Room marked as read' });
    } catch (error: any) {
      logger.error('Error marking room as read', { error });
      return res.status(500).json({ error: 'Failed to mark room as read' });
    }
  }
);

/**
 * POST /api/chat/rooms/:roomId/messages/:messageId/read
 * Mark a specific message as read by the current user (for double-tick receipts).
 */
router.post(
  '/rooms/:roomId/messages/:messageId/read',
  authenticate as any,
  async (req: Request, res: Response) => {
    try {
      const { messageId } = req.params;
      const userId = (req as any).user?.id;
      const { db } = await import('../database/connection');
      await db.query(
        `UPDATE chat_messages
         SET read_by = (
           CASE WHEN read_by @> $2::jsonb THEN read_by
                ELSE read_by || $2::jsonb
           END
         )
         WHERE id = $1`,
        [messageId, JSON.stringify([userId])]
      );
      return res.json({ ok: true });
    } catch (error: any) {
      logger.error('Error marking message as read', { error });
      return res.status(500).json({ error: 'Failed to mark message as read' });
    }
  }
);

/**
 * DELETE /api/chat/rooms/:roomId/messages/:messageId
 * Delete a message for the current user only ("Delete for me").
 */
router.delete(
  '/rooms/:roomId/messages/:messageId',
  authenticate as any,
  async (req: Request, res: Response) => {
    try {
      const { messageId } = req.params;
      const userId = (req as any).user?.id;
      const { db } = await import('../database/connection');
      await db.query(
        `UPDATE chat_messages
         SET deleted_for = (
           CASE WHEN deleted_for @> $2::jsonb THEN deleted_for
                ELSE deleted_for || $2::jsonb
           END
         )
         WHERE id = $1`,
        [messageId, JSON.stringify([userId])]
      );
      return res.json({ ok: true });
    } catch (error: any) {
      logger.error('Error deleting message for user', { error });
      return res.status(500).json({ error: 'Failed to delete message' });
    }
  }
);

/**
 * DELETE /api/chat/rooms/:roomId/messages/:messageId/everyone
 * Delete a message for everyone ("Delete for everyone") — sender only.
 */
router.delete(
  '/rooms/:roomId/messages/:messageId/everyone',
  authenticate as any,
  async (req: Request, res: Response) => {
    try {
      const { messageId } = req.params;
      const userId = (req as any).user?.id;
      const { db } = await import('../database/connection');
      // Only the sender can delete for everyone
      const check = await db.query(
        `SELECT sender_id FROM chat_messages WHERE id = $1`, [messageId]
      );
      if (!check.rows.length) return res.status(404).json({ error: 'Message not found' });
      if (check.rows[0].sender_id !== userId) return res.status(403).json({ error: 'Only the sender can delete for everyone' });
      await db.query(
        `UPDATE chat_messages SET is_deleted_for_everyone = TRUE, content = 'This message was deleted'
         WHERE id = $1`,
        [messageId]
      );
      // Notify room via socket
      chatServer.emitToRoom(req.params.roomId, 'message:deleted', { messageId, forEveryone: true });
      return res.json({ ok: true });
    } catch (error: any) {
      logger.error('Error deleting message for everyone', { error });
      return res.status(500).json({ error: 'Failed to delete message for everyone' });
    }
  }
);

/**
 * DELETE /api/chat/rooms/:roomId/messages
 * Clear all messages in a room for the current user only.
 */
router.delete(
  '/rooms/:roomId/messages',
  authenticate as any,
  async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const userId = (req as any).user?.id;
      const { db } = await import('../database/connection');
      // Mark all messages in this room as deleted for this user
      await db.query(
        `UPDATE chat_messages
         SET deleted_for = (
           CASE WHEN deleted_for @> $2::jsonb THEN deleted_for
                ELSE deleted_for || $2::jsonb
           END
         )
         WHERE room_id = $1`,
        [roomId, JSON.stringify([userId])]
      );
      return res.json({ ok: true });
    } catch (error: any) {
      logger.error('Error clearing chat', { error });
      return res.status(500).json({ error: 'Failed to clear chat' });
    }
  }
);


router.get(
  '/rooms/:roomId/search',
  authenticate as any,
  async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const { keyword, before, after, limit, offset } = req.query;

      if (!keyword || typeof keyword !== 'string' || keyword.trim() === '') {
        return res.status(400).json({ error: 'keyword query parameter is required' });
      }

      const room = await chatService.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const messages = await chatService.searchMessages(roomId, keyword, {
        before: before ? new Date(before as string) : undefined,
        after: after ? new Date(after as string) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      return res.json({ messages });
    } catch (error: any) {
      logger.error('Error searching messages', { error });
      return res.status(500).json({ error: 'Failed to search messages' });
    }
  }
);

/**
 * POST /api/chat/rooms/:roomId/mute
 * Mute a chat room for the authenticated user.
 * Requirement 13.12: Allow users to mute chat channels
 */
router.post(
  '/rooms/:roomId/mute',
  authenticate as any,
  async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const userId = (req as any).user?.id;

      const room = await chatService.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      await chatService.muteRoom(roomId, userId);
      return res.json({ message: 'Room muted successfully' });
    } catch (error: any) {
      logger.error('Error muting room', { error });
      return res.status(500).json({ error: 'Failed to mute room' });
    }
  }
);

/**
 * DELETE /api/chat/rooms/:roomId/mute
 * Unmute a chat room for the authenticated user.
 * Requirement 13.12: Allow users to mute chat channels
 */
router.delete(
  '/rooms/:roomId/mute',
  authenticate as any,
  async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const userId = (req as any).user?.id;

      const room = await chatService.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      await chatService.unmuteRoom(roomId, userId);
      return res.json({ message: 'Room unmuted successfully' });
    } catch (error: any) {
      logger.error('Error unmuting room', { error });
      return res.status(500).json({ error: 'Failed to unmute room' });
    }
  }
);

/**
 * GET /api/chat/muted-rooms
 * Get all muted rooms for the authenticated user.
 * Requirement 13.12: Allow users to mute chat channels
 */
router.get('/muted-rooms', authenticate as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const rooms = await chatService.getMutedRooms(userId);
    return res.json({ rooms });
  } catch (error: any) {
    logger.error('Error fetching muted rooms', { error });
    return res.status(500).json({ error: 'Failed to fetch muted rooms' });
  }
});

/**
 * GET /api/chat/users
 * Returns only the users this role is allowed to chat with — doc §18.
 *
 * Chat access matrix:
 *   CEO, CoS, CFO, EA          → everyone (except Agents)
 *   COO                        → CEO, CoS, CFO, EA, CTO  +  own dept (OPERATIONS_USER, HEAD_OF_TRAINERS, TRAINER)
 *   CTO                        → CEO, CoS, CFO, EA, COO  +  DEVELOPER (team leaders only)  +  TECH_STAFF
 *   HEAD_OF_TRAINERS            → CEO, CoS, CFO, EA, COO, CTO  (higher-ups + CFO for enquiries)
 *   TRAINER                    → CEO, CoS, CFO, EA, COO, CTO, HEAD_OF_TRAINERS
 *   DEVELOPER (team leader)    → CTO only
 *   TECH_STAFF            → CEO, CoS, CFO, EA, COO, CTO
 *   OPERATIONS_USER            → CEO, CoS, CFO, EA, COO, CTO  +  own dept
 *   CFO_ASSISTANT              → CEO, CoS, CFO, EA
 *   AGENT                      → no chat (blocked at room creation)
 */
router.get('/users', authenticate as any, async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user?.id;
    const currentRole: string = (req as any).user?.role || '';
    const { db } = await import('../database/connection');

    // Roles that can see everyone (except Agents)
    const FULL_ACCESS = ['CEO', 'CoS', 'CFO', 'EA'];

    // Build the allowed roles list based on the requester's role
    let allowedRoles: string[] | null = null; // null = all (except AGENT)

    if (FULL_ACCESS.includes(currentRole)) {
      allowedRoles = null; // everyone except AGENT
    } else if (currentRole === 'COO') {
      allowedRoles = ['CEO', 'CoS', 'CFO', 'EA', 'CTO', 'OPERATIONS_USER', 'HEAD_OF_TRAINERS', 'TRAINER', 'SALES_MANAGER', 'CLIENT_SUCCESS_USER', 'ACCOUNT_EXECUTIVE', 'SENIOR_ACCOUNT_MANAGER', 'MARKETING_USER', 'MARKETING_OFFICER'];
    } else if (currentRole === 'CTO') {
      // CTO chats with higher-ups + TECH_STAFF + DEVELOPER team leaders
      // We'll include all DEVELOPER and filter team leaders client-side via is_team_leader
      allowedRoles = ['CEO', 'CoS', 'CFO', 'EA', 'COO', 'TECH_STAFF', 'DEVELOPER'];
    } else if (currentRole === 'HEAD_OF_TRAINERS') {
      allowedRoles = ['CEO', 'CoS', 'CFO', 'EA', 'COO', 'CTO'];
    } else if (currentRole === 'TRAINER') {
      allowedRoles = ['CEO', 'CoS', 'CFO', 'EA', 'COO', 'CTO', 'HEAD_OF_TRAINERS'];
    } else if (currentRole === 'DEVELOPER') {
      // Team leaders → CTO only; non-leaders → no chat (blocked at room creation)
      allowedRoles = ['CTO'];
    } else if (currentRole === 'TECH_STAFF') {
      allowedRoles = ['CEO', 'CoS', 'CFO', 'EA', 'COO', 'CTO'];
    } else if (currentRole === 'OPERATIONS_USER' || currentRole === 'SALES_MANAGER' ||
               currentRole === 'CLIENT_SUCCESS_USER' || currentRole === 'ACCOUNT_EXECUTIVE' ||
               currentRole === 'SENIOR_ACCOUNT_MANAGER' || currentRole === 'MARKETING_USER' ||
               currentRole === 'MARKETING_OFFICER') {
      allowedRoles = ['CEO', 'CoS', 'CFO', 'EA', 'COO', 'CTO',
                      'OPERATIONS_USER', 'SALES_MANAGER', 'CLIENT_SUCCESS_USER',
                      'ACCOUNT_EXECUTIVE', 'SENIOR_ACCOUNT_MANAGER', 'MARKETING_USER', 'MARKETING_OFFICER'];
    } else if (currentRole === 'CFO_ASSISTANT') {
      allowedRoles = ['CEO', 'CoS', 'CFO', 'EA'];
    } else {
      // Unknown / AGENT — return empty
      return res.json({ users: [] });
    }

    const whereClause = allowedRoles === null
      ? `r.name != 'AGENT'`
      : `r.name = ANY($2::text[])`;

    const params: any[] = allowedRoles === null
      ? [currentUserId]
      : [currentUserId, allowedRoles];

    const result = await db.query(
      `SELECT u.id, u.full_name, u.email, u.profile_photo_url, r.name as role,
              d.name as department, u.is_team_leader
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.is_active = true
         AND u.suspended_at IS NULL
         AND u.password_hash IS NOT NULL
         AND u.id != $1
         AND ${whereClause}
       ORDER BY u.full_name ASC`,
      params
    );

    const onlineMap = new Map(
      chatServer.getOnlineUsersWithPortal().map(u => [u.userId, u.portal])
    );

    let users = result.rows.map((u: any) => ({
      id: u.id,
      name: u.full_name,
      email: u.email,
      role: u.role,
      department: u.department || null,
      isTeamLeader: u.is_team_leader || false,
      profilePhotoUrl: u.profile_photo_url || null,
      online: onlineMap.has(u.id),
      portal: onlineMap.get(u.id) || null,
    }));

    // CTO sees all DEVELOPER but only team leaders can initiate chat
    // Mark non-leaders so the frontend can show them as view-only
    // (room creation is blocked server-side for non-leaders anyway)

    return res.json({ users });
  } catch (error: any) {
    logger.error('Error fetching chat users', { error });
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;
