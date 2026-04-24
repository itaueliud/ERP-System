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

    // Doc §14: Agents have no chat — personal data dashboard only
    if (userRole === 'AGENT') {
      return res.status(403).json({ error: 'Agents do not have chat access' });
    }

    // Doc §14: Developer Team Members (non-leaders) can view but cannot send messages
    const user = await (await import('../database/connection')).db.query(
      `SELECT is_team_leader FROM users WHERE id = $1`, [userId]
    );
    if (userRole === 'DEVELOPER' && user.rows.length && !user.rows[0].is_team_leader) {
      return res.status(403).json({ error: 'Non-leader developers cannot create chat rooms' });
    }

    const { type, name, memberIds } = req.body;

    const validTypes: RoomType[] = ['DIRECT', 'GROUP', 'DEPARTMENT', 'PROJECT'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    }

    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ error: 'memberIds must be an array' });
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
 * Get all rooms for the authenticated user.
 */
router.get('/rooms', authenticate as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const rooms = await chatService.getRoomsForUser(userId);
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

      // Doc §14: Agents have no chat access
      if (userRole === 'AGENT') {
        return res.status(403).json({ error: 'Agents do not have chat access' });
      }

      // Doc §14: Developer Team Members (non-leaders) can view but cannot send messages
      if (userRole === 'DEVELOPER') {
        const user = await (await import('../database/connection')).db.query(
          `SELECT is_team_leader FROM users WHERE id = $1`, [senderId]
        );
        if (user.rows.length && !user.rows[0].is_team_leader) {
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
 * GET /api/chat/rooms/:roomId/search
 * Search messages in a room by keyword.
 * Requirement 13.7: Allow users to search chat history by keyword
 */
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

export default router;
