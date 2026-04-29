/**
 * Realtime event bus — decouples services from ChatServer.
 * Services emit domain events here; ChatServer broadcasts them to connected clients.
 */
import { EventEmitter } from 'events';

export type RealtimeEventType =
  | 'client:created'
  | 'client:updated'
  | 'client:status_changed'
  | 'payment:created'
  | 'payment:approved'
  | 'payment:rejected'
  | 'payment:executed'
  | 'payment:status_changed'
  | 'project:created'
  | 'project:updated'
  | 'lead:converted'
  | 'report:submitted'
  | 'report:overdue'
  | 'task:assigned'
  | 'task:updated'
  | 'notification:new'
  | 'metrics:updated'
  | 'user:invited'
  | 'contract:generated'
  | 'service_amount:changed';

export interface RealtimeEvent {
  type: RealtimeEventType;
  payload: Record<string, unknown>;
}

class RealtimeEventBus extends EventEmitter {
  /** Publish a domain event to all listeners */
  publish(type: RealtimeEventType, payload: Record<string, unknown> = {}): void {
    super.emit('realtime', { type, payload });
  }

  onRealtime(listener: (data: RealtimeEvent) => void): this {
    return super.on('realtime', listener as (...args: unknown[]) => void);
  }
}

export const realtimeEvents = new RealtimeEventBus();
