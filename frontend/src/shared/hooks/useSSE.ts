import { useEffect, useRef, useState } from 'react';

interface SSEOptions {
  onMessage?: (event: string, data: any) => void;
  onError?: (error: Event) => void;
  onConnected?: () => void;
  autoReconnect?: boolean;
  reconnectDelay?: number;
}

/**
 * Hook for Server-Sent Events (SSE) real-time updates
 */
export function useSSE(options: SSEOptions = {}) {
  const {
    onMessage,
    onError,
    onConnected,
    autoReconnect = true,
    reconnectDelay = 3000,
  } = options;

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = () => {
    // Get token from localStorage
    const token = localStorage.getItem('tst_token');
    if (!token) {
      setError('No authentication token found');
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      // Create SSE connection
      const baseURL = import.meta.env.VITE_API_BASE_URL || '';
      const url = `${baseURL}/api/v1/sse/stream`;
      
      // Note: EventSource doesn't support custom headers, so we pass token as query param
      const eventSource = new EventSource(`${url}?token=${token}`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        console.log('SSE connected');
      };

      eventSource.onerror = (err) => {
        console.error('SSE error:', err);
        setConnected(false);
        setError('Connection error');
        onError?.(err);

        // Auto-reconnect
        if (autoReconnect && reconnectAttemptsRef.current < 5) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Reconnecting... (attempt ${reconnectAttemptsRef.current})`);
            connect();
          }, reconnectDelay * reconnectAttemptsRef.current);
        }
      };

      // Listen for 'connected' event
      eventSource.addEventListener('connected', (e: any) => {
        const data = JSON.parse(e.data);
        console.log('SSE connected event:', data);
        onConnected?.();
      });

      // Listen for 'notification' event
      eventSource.addEventListener('notification', (e: any) => {
        const data = JSON.parse(e.data);
        onMessage?.('notification', data);
      });

      // Listen for 'dashboard:update' event
      eventSource.addEventListener('dashboard:update', (e: any) => {
        const data = JSON.parse(e.data);
        onMessage?.('dashboard:update', data);
      });

      // Listen for 'task:assigned' event
      eventSource.addEventListener('task:assigned', (e: any) => {
        const data = JSON.parse(e.data);
        onMessage?.('task:assigned', data);
      });

      // Listen for 'task:updated' event
      eventSource.addEventListener('task:updated', (e: any) => {
        const data = JSON.parse(e.data);
        onMessage?.('task:updated', data);
      });

      // Listen for 'heartbeat' event
      eventSource.addEventListener('heartbeat', (_e: any) => {
        // Silent heartbeat to keep connection alive
      });

      // Generic message handler
      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          onMessage?.('message', data);
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

    } catch (err) {
      console.error('Failed to create SSE connection:', err);
      setError('Failed to connect');
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
  };

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    connected,
    error,
    reconnect: connect,
    disconnect,
  };
}
