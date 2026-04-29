import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { authService } from '../auth/authService';
import { chatService, MAX_FILE_SIZE_BYTES } from './chatService';
import { realtimeEvents, RealtimeEvent } from '../realtime/realtimeEvents';
import logger from '../utils/logger';

/**
 * ChatServer - Socket.IO server for real-time communication
 * Requirements: 13.1-13.10
 */

export interface ConnectedUser {
  userId: string;
  socketId: string;
  connectedAt: Date;
}

export interface OnlineUserInfo {
  userId: string;
  portal: string;
  connectedAt: Date;
}

export class ChatServer {
  private io: SocketIOServer | null = null;
  /** Map of userId → set of socketIds (a user may have multiple tabs) */
  private onlineUsers: Map<string, Set<string>> = new Map();
  /** Map of userId → portal name */
  private userPortals: Map<string, string> = new Map();

  /**
   * Attach Socket.IO to the HTTP server.
   * Requirement 13.1: Real-time chat via Socket.IO
   */
  initialize(httpServer: HttpServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      path: '/socket.io',
    });

    // JWT authentication middleware for Socket.IO
    this.io.use(async (socket: any, next: any) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication required'));
        }

        const payload = await authService.validateToken(token);
        if (!payload) {
          return next(new Error('Invalid or expired token'));
        }

        const user = await authService.getUserById(payload.userId);
        if (!user) {
          return next(new Error('User not found'));
        }

        // Attach user info to socket
        (socket as any).userId = user.id;
        (socket as any).userEmail = user.email;
        (socket as any).userRole = user.role;
        // Portal is sent by the client on connect: socket.handshake.auth.portal
        (socket as any).userPortal = socket.handshake.auth?.portal || 'unknown';

        next();
      } catch (err) {
        logger.error('Socket.IO auth error', { err });
        next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });

    // Forward domain events from the event bus to all connected clients
    realtimeEvents.onRealtime((event: RealtimeEvent) => {
      if (this.io) {
        this.io.emit(`data:${event.type}`, event.payload);
      }
    });

    logger.info('Socket.IO chat server initialized');
  }

  /**
   * Handle new WebSocket connection.
   * Requirement 13.10: Display user online/offline status in real-time
   */
  handleConnection(socket: Socket): void {
    const userId: string = (socket as any).userId;

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    // Track online presence
    if (!this.onlineUsers.has(userId)) {
      this.onlineUsers.set(userId, new Set());
    }
    this.onlineUsers.get(userId)!.add(socket.id);
    this.userPortals.set(userId, (socket as any).userPortal || 'unknown');

    logger.info('User connected via WebSocket', { userId, socketId: socket.id });

    // Broadcast presence update to all clients
    if (this.io) {
      this.io.emit('presence:update', { userId, status: 'online', portal: this.userPortals.get(userId) });
    }

    // Register event handlers
    socket.on('room:join', (roomId: string) => this.joinRoom(socket, roomId));
    socket.on('room:leave', (roomId: string) => this.leaveRoom(socket, roomId));
    socket.on('message:send', (data: any) => this.handleMessageSend(socket, data));
    socket.on('disconnect', () => this.handleDisconnect(socket));
  }

  /**
   * Handle WebSocket disconnection.
   * Requirement 13.10: Display user online/offline status in real-time
   */
  handleDisconnect(socket: Socket): void {
    const userId: string = (socket as any).userId;

    if (!userId) return;

    const sockets = this.onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        this.onlineUsers.delete(userId);
        this.userPortals.delete(userId);
        // Broadcast offline status only when all sockets are gone
        if (this.io) {
          this.io.emit('presence:update', { userId, status: 'offline' });
        }
      }
    }

    logger.info('User disconnected from WebSocket', { userId, socketId: socket.id });
  }

  /**
   * Join a chat room.
   * Requirement 13.2: One-on-one direct messages
   * Requirement 13.3: Group chat channels
   */
  joinRoom(socket: Socket, roomId: string): void {
    socket.join(roomId);
    logger.info('User joined room', { userId: (socket as any).userId, roomId });
  }

  /**
   * Leave a chat room.
   */
  leaveRoom(socket: Socket, roomId: string): void {
    socket.leave(roomId);
    logger.info('User left room', { userId: (socket as any).userId, roomId });
  }

  /**
   * Emit a message to all sockets in a room.
   */
  emitToRoom(roomId: string, event: string, data: unknown): void {
    if (this.io) {
      this.io.to(roomId).emit(event, data);
    }
  }

  /**
   * Emit a message to a specific user (all their sockets).
   */
  emitToUser(userId: string, event: string, data: unknown): void {
    if (!this.io) return;
    const sockets = this.onlineUsers.get(userId);
    if (sockets) {
      for (const socketId of sockets) {
        this.io.to(socketId).emit(event, data);
      }
    }
  }

  /**
   * Get list of online users.
   * Requirement 13.10: Display user online/offline status
   */
  getOnlineUsers(): string[] {
    return Array.from(this.onlineUsers.keys());
  }

  /**
   * Get online users with their portal info.
   */
  getOnlineUsersWithPortal(): OnlineUserInfo[] {
    return Array.from(this.onlineUsers.keys()).map(userId => ({
      userId,
      portal: this.userPortals.get(userId) || 'unknown',
      connectedAt: new Date(),
    }));
  }

  /**
   * Check if a specific user is online.
   * Requirement 13.10: Display user online/offline status
   */
  isUserOnline(userId: string): boolean {
    const sockets = this.onlineUsers.get(userId);
    return !!sockets && sockets.size > 0;
  }

  /**
   * Handle 'message:send' Socket.IO event.
   * Saves message to DB and emits 'message:new' to the room.
   * Requirement 13.4: Deliver messages within 2 seconds
   * Requirement 13.8: Validate file attachment size (max 10 MB)
   */
  async handleMessageSend(
    socket: Socket,
    data: { roomId: string; content: string; fileId?: string; fileSizeBytes?: number; fileName?: string; mimeType?: string }
  ): Promise<void> {
    const userId: string = (socket as any).userId;

    try {
      const { roomId, content, fileId, fileSizeBytes, fileName, mimeType } = data;

      if (!roomId || !content) {
        socket.emit('message:error', { error: 'roomId and content are required' });
        return;
      }

      if (fileId && fileSizeBytes !== undefined && fileSizeBytes > MAX_FILE_SIZE_BYTES) {
        socket.emit('message:error', {
          error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
        });
        return;
      }

      const message = await chatService.sendMessage(roomId, userId, content, fileId, fileName, mimeType);

      // Emit to all room members (Requirement 13.4: within 2 seconds)
      this.emitToRoom(roomId, 'message:new', message);
    } catch (err) {
      logger.error('Error handling message:send', { err, userId });
      socket.emit('message:error', { error: 'Failed to send message' });
    }
  }

  getIO(): SocketIOServer | null {
    return this.io;
  }
}

export const chatServer = new ChatServer();
export default chatServer;
