import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Socket = any;

const BACKEND_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  fileId: string | null;
  createdAt: string;
}

export interface PresenceUpdate {
  userId: string;
  status: 'online' | 'offline';
  portal?: string;
}

interface UseChatSocketOptions {
  token: string;
  portal: string;
  onMessage?: (msg: ChatMessage) => void;
  onPresence?: (update: PresenceUpdate) => void;
  onDeleted?: (data: { messageId: string; forEveryone: boolean }) => void;
}

export function useChatSocket({ token, portal, onMessage, onPresence, onDeleted }: UseChatSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const socket = io(BACKEND_URL, {
      path: '/socket.io',
      auth: { token, portal },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('message:new', (msg: ChatMessage) => onMessage?.(msg));
    socket.on('presence:update', (update: PresenceUpdate) => onPresence?.(update));
    socket.on('message:deleted', (data: { messageId: string; forEveryone: boolean }) => onDeleted?.(data));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, portal]);

  const joinRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('room:join', roomId);
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('room:leave', roomId);
  }, []);

  const sendMessage = useCallback((roomId: string, content: string, fileId?: string, fileName?: string, mimeType?: string) => {
    socketRef.current?.emit('message:send', { roomId, content, fileId, fileName, mimeType });
  }, []);

  return { connected, joinRoom, leaveRoom, sendMessage };
}
