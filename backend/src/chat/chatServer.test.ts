/**
 * Tests for ChatServer
 * Requirements: 13.1, 13.4, 13.8, 13.10
 */

import { ChatServer } from './chatServer';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../auth/authService', () => ({
  authService: {
    validateToken: jest.fn(),
    getUserById: jest.fn(),
  },
}));

jest.mock('./chatService', () => ({
  chatService: {
    sendMessage: jest.fn(),
  },
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { chatService } from './chatService';
const mockChatService = chatService as jest.Mocked<typeof chatService>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSocket(userId: string, socketId = 'socket-1') {
  const rooms = new Set<string>();
  return {
    id: socketId,
    userId,
    join: jest.fn((room: string) => rooms.add(room)),
    leave: jest.fn((room: string) => rooms.delete(room)),
    disconnect: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    _rooms: rooms,
  } as any;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChatServer', () => {
  let server: ChatServer;

  beforeEach(() => {
    server = new ChatServer();
  });

  describe('getOnlineUsers', () => {
    it('returns empty array when no users are connected', () => {
      expect(server.getOnlineUsers()).toEqual([]);
    });

    it('returns connected user after handleConnection', () => {
      const socket = makeSocket('user-1');
      server.handleConnection(socket);
      expect(server.getOnlineUsers()).toContain('user-1');
    });

    it('returns multiple distinct users', () => {
      server.handleConnection(makeSocket('user-1', 'socket-1'));
      server.handleConnection(makeSocket('user-2', 'socket-2'));
      const online = server.getOnlineUsers();
      expect(online).toContain('user-1');
      expect(online).toContain('user-2');
    });
  });

  describe('isUserOnline', () => {
    it('returns false for unknown user', () => {
      expect(server.isUserOnline('unknown')).toBe(false);
    });

    it('returns true after user connects', () => {
      server.handleConnection(makeSocket('user-1'));
      expect(server.isUserOnline('user-1')).toBe(true);
    });

    it('returns false after user disconnects', () => {
      const socket = makeSocket('user-1');
      server.handleConnection(socket);
      server.handleDisconnect(socket);
      expect(server.isUserOnline('user-1')).toBe(false);
    });

    it('stays online when user has multiple sockets and one disconnects', () => {
      const s1 = makeSocket('user-1', 'socket-1');
      const s2 = makeSocket('user-1', 'socket-2');
      server.handleConnection(s1);
      server.handleConnection(s2);
      server.handleDisconnect(s1);
      expect(server.isUserOnline('user-1')).toBe(true);
    });

    it('goes offline when all sockets disconnect', () => {
      const s1 = makeSocket('user-1', 'socket-1');
      const s2 = makeSocket('user-1', 'socket-2');
      server.handleConnection(s1);
      server.handleConnection(s2);
      server.handleDisconnect(s1);
      server.handleDisconnect(s2);
      expect(server.isUserOnline('user-1')).toBe(false);
    });
  });

  describe('handleConnection', () => {
    it('disconnects socket without userId', () => {
      const socket = makeSocket('');
      socket.userId = undefined;
      server.handleConnection(socket);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('registers event handlers on socket', () => {
      const socket = makeSocket('user-1');
      server.handleConnection(socket);
      expect(socket.on).toHaveBeenCalledWith('room:join', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('room:leave', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });
  });

  describe('joinRoom / leaveRoom', () => {
    it('calls socket.join with the roomId', () => {
      const socket = makeSocket('user-1');
      server.joinRoom(socket, 'room-abc');
      expect(socket.join).toHaveBeenCalledWith('room-abc');
    });

    it('calls socket.leave with the roomId', () => {
      const socket = makeSocket('user-1');
      server.leaveRoom(socket, 'room-abc');
      expect(socket.leave).toHaveBeenCalledWith('room-abc');
    });
  });

  describe('handleDisconnect', () => {
    it('does nothing for socket without userId', () => {
      const socket = makeSocket('');
      socket.userId = undefined;
      // Should not throw
      expect(() => server.handleDisconnect(socket)).not.toThrow();
    });

    it('removes user from online list after disconnect', () => {
      const socket = makeSocket('user-99');
      server.handleConnection(socket);
      expect(server.isUserOnline('user-99')).toBe(true);
      server.handleDisconnect(socket);
      expect(server.isUserOnline('user-99')).toBe(false);
    });
  });

  // ── handleMessageSend ───────────────────────────────────────────────────────

  describe('handleMessageSend', () => {
    const MESSAGE = {
      id: 'msg-1',
      roomId: 'room-1',
      senderId: 'user-1',
      content: 'Hello',
      fileId: null,
      createdAt: new Date(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('saves message and emits message:new to room', async () => {
      (mockChatService.sendMessage as jest.Mock).mockResolvedValueOnce(MESSAGE);
      const emitToRoomSpy = jest.spyOn(server, 'emitToRoom').mockImplementation(() => {});

      const socket = makeSocket('user-1');
      await server.handleMessageSend(socket, { roomId: 'room-1', content: 'Hello' });

      expect(mockChatService.sendMessage).toHaveBeenCalledWith('room-1', 'user-1', 'Hello', undefined);
      expect(emitToRoomSpy).toHaveBeenCalledWith('room-1', 'message:new', MESSAGE);
    });

    it('emits message:error when roomId is missing', async () => {
      const socket = makeSocket('user-1');
      await server.handleMessageSend(socket, { roomId: '', content: 'Hello' });

      expect(socket.emit).toHaveBeenCalledWith('message:error', expect.objectContaining({ error: expect.any(String) }));
      expect(mockChatService.sendMessage).not.toHaveBeenCalled();
    });

    it('emits message:error when content is missing', async () => {
      const socket = makeSocket('user-1');
      await server.handleMessageSend(socket, { roomId: 'room-1', content: '' });

      expect(socket.emit).toHaveBeenCalledWith('message:error', expect.objectContaining({ error: expect.any(String) }));
      expect(mockChatService.sendMessage).not.toHaveBeenCalled();
    });

    it('rejects file attachment exceeding 10 MB (Requirement 13.8)', async () => {
      const socket = makeSocket('user-1');
      const oversizedBytes = 11 * 1024 * 1024; // 11 MB

      await server.handleMessageSend(socket, {
        roomId: 'room-1',
        content: 'Big file',
        fileId: 'file-big',
        fileSizeBytes: oversizedBytes,
      });

      expect(socket.emit).toHaveBeenCalledWith('message:error', expect.objectContaining({ error: expect.stringContaining('10 MB') }));
      expect(mockChatService.sendMessage).not.toHaveBeenCalled();
    });

    it('accepts file attachment exactly at 10 MB limit', async () => {
      (mockChatService.sendMessage as jest.Mock).mockResolvedValueOnce(MESSAGE);
      jest.spyOn(server, 'emitToRoom').mockImplementation(() => {});

      const socket = makeSocket('user-1');
      const exactBytes = 10 * 1024 * 1024; // exactly 10 MB

      await server.handleMessageSend(socket, {
        roomId: 'room-1',
        content: 'Exact size',
        fileId: 'file-ok',
        fileSizeBytes: exactBytes,
      });

      expect(mockChatService.sendMessage).toHaveBeenCalled();
    });

    it('emits message:error when sendMessage throws', async () => {
      (mockChatService.sendMessage as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

      const socket = makeSocket('user-1');
      await server.handleMessageSend(socket, { roomId: 'room-1', content: 'Hello' });

      expect(socket.emit).toHaveBeenCalledWith('message:error', expect.objectContaining({ error: expect.any(String) }));
    });
  });
});
