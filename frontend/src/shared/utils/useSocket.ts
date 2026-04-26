import { useEffect, useRef, useCallback } from 'react';

type MessageHandler = (data: unknown) => void;

interface UseSocketOptions {
  /** WebSocket URL — defaults to VITE_WS_URL or ws://localhost:3000 */
  url?: string;
  /** Called when the connection opens */
  onOpen?: () => void;
  /** Called when the connection closes */
  onClose?: () => void;
  /** Called on connection error */
  onError?: (event: Event) => void;
}

interface UseSocketReturn {
  /** Send a JSON message to the server */
  sendMessage: (type: string, payload?: unknown) => void;
  /** Register a handler for a specific message type */
  onMessage: (type: string, handler: MessageHandler) => () => void;
  /** Join a chat room */
  joinRoom: (roomId: string) => void;
  /** Leave a chat room */
  leaveRoom: (roomId: string) => void;
  /** Whether the socket is currently connected */
  isConnected: () => boolean;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const wsUrl =
    options.url ??
    (import.meta.env.VITE_WS_URL as string | undefined) ??
    'ws://localhost:3000';

  const socketRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    const url = token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl;

    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      options.onOpen?.();
    };

    ws.onclose = () => {
      options.onClose?.();
      // Reconnect after 3 seconds
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = (event) => {
      options.onError?.(event);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; payload?: unknown };
        const handlers = handlersRef.current.get(msg.type);
        if (handlers) {
          handlers.forEach((h) => h(msg.payload));
        }
        // Also fire wildcard handlers
        const wildcardHandlers = handlersRef.current.get('*');
        if (wildcardHandlers) {
          wildcardHandlers.forEach((h) => h(msg));
        }
      } catch {
        // ignore non-JSON messages
      }
    };
  }, [wsUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      socketRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((type: string, payload?: unknown) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const onMessage = useCallback((type: string, handler: MessageHandler): (() => void) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);
    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    sendMessage('join_room', { roomId });
  }, [sendMessage]);

  const leaveRoom = useCallback((roomId: string) => {
    sendMessage('leave_room', { roomId });
  }, [sendMessage]);

  const isConnected = useCallback(() => {
    return socketRef.current?.readyState === WebSocket.OPEN;
  }, []);

  return { sendMessage, onMessage, joinRoom, leaveRoom, isConnected };
}
