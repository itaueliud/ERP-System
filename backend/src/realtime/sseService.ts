import { Response } from 'express';
import logger from '../utils/logger';

interface SSEClient {
  id: string;
  userId: string;
  response: Response;
  connectedAt: Date;
}

class SSEService {
  private clients: Map<string, SSEClient> = new Map();

  /**
   * Register a new SSE client
   */
  addClient(clientId: string, userId: string, res: Response): void {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Store client
    this.clients.set(clientId, {
      id: clientId,
      userId,
      response: res,
      connectedAt: new Date(),
    });

    logger.info('SSE client connected', { clientId, userId, totalClients: this.clients.size });

    // Send initial connection message
    this.sendToClient(clientId, 'connected', { message: 'Connected to real-time updates' });

    // Handle client disconnect
    res.on('close', () => {
      this.removeClient(clientId);
    });
  }

  /**
   * Remove a client
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      logger.info('SSE client disconnected', { clientId, userId: client.userId, totalClients: this.clients.size });
    }
  }

  /**
   * Send event to a specific client
   */
  sendToClient(clientId: string, event: string, data: any): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    try {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      client.response.write(message);
      return true;
    } catch (error) {
      logger.error('Failed to send SSE message', { error, clientId, event });
      this.removeClient(clientId);
      return false;
    }
  }

  /**
   * Send event to all clients of a specific user
   */
  sendToUser(userId: string, event: string, data: any): number {
    let sentCount = 0;
    
    this.clients.forEach((client) => {
      if (client.userId === userId) {
        if (this.sendToClient(client.id, event, data)) {
          sentCount++;
        }
      }
    });

    return sentCount;
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(event: string, data: any): number {
    let sentCount = 0;
    
    this.clients.forEach((client) => {
      if (this.sendToClient(client.id, event, data)) {
        sentCount++;
      }
    });

    logger.info('SSE broadcast sent', { event, clientCount: sentCount });
    return sentCount;
  }

  /**
   * Send event to users with specific roles
   */
  sendToRoles(_roles: string[], _event: string, _data: any): number {
    // Note: requires role tracking in client data — not yet implemented
    logger.warn('sendToRoles not fully implemented - requires role tracking');
    return 0;
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get clients for a specific user
   */
  getUserClients(userId: string): SSEClient[] {
    const userClients: SSEClient[] = [];
    this.clients.forEach((client) => {
      if (client.userId === userId) {
        userClients.push(client);
      }
    });
    return userClients;
  }

  /**
   * Send heartbeat to all clients to keep connections alive
   */
  sendHeartbeat(): void {
    this.broadcast('heartbeat', { timestamp: Date.now() });
  }

  /**
   * Clean up stale connections
   */
  cleanupStaleConnections(maxAgeMinutes: number = 60): void {
    const now = new Date();
    const staleClients: string[] = [];

    this.clients.forEach((client, clientId) => {
      const ageMinutes = (now.getTime() - client.connectedAt.getTime()) / 1000 / 60;
      if (ageMinutes > maxAgeMinutes) {
        staleClients.push(clientId);
      }
    });

    staleClients.forEach(clientId => this.removeClient(clientId));

    if (staleClients.length > 0) {
      logger.info('Cleaned up stale SSE connections', { count: staleClients.length });
    }
  }
}

// Singleton instance
export const sseService = new SSEService();

// Start heartbeat interval (every 30 seconds)
setInterval(() => {
  sseService.sendHeartbeat();
}, 30000);

// Clean up stale connections every 5 minutes
setInterval(() => {
  sseService.cleanupStaleConnections(60);
}, 300000);
