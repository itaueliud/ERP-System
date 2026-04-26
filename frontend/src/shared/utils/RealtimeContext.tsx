/**
 * RealtimeContext — singleton Socket.IO connection for the whole ERP.
 * Wrap your portal root with <RealtimeProvider> to enable live data updates.
 */
import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

type EventHandler = (payload: unknown) => void;

interface RealtimeContextValue {
  /** Subscribe to a Socket.IO event. Returns an unsubscribe function. */
  subscribe: (event: string, handler: EventHandler) => () => void;
  /** Whether the socket is currently connected */
  connected: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  subscribe: () => () => {},
  connected: false,
});

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const [connected, setConnected] = React.useState(false);

  useEffect(() => {
    const token = localStorage.getItem('tst_token');
    const wsUrl = (import.meta.env.VITE_WS_URL as string | undefined) ?? '';

    const socket = io(wsUrl || window.location.origin, {
      path: '/socket.io',
      auth: { token },
      reconnectionDelay: 3000,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // Route all incoming events to registered handlers
    socket.onAny((event: string, payload: unknown) => {
      const handlers = handlersRef.current.get(event);
      if (handlers) handlers.forEach(h => h(payload));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const subscribe = useCallback((event: string, handler: EventHandler): (() => void) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler);
    return () => {
      handlersRef.current.get(event)?.delete(handler);
    };
  }, []);

  return (
    <RealtimeContext.Provider value={{ subscribe, connected }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
