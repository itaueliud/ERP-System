/**
 * Webhook Service
 * Allows administrators to register webhook URLs and receive event notifications.
 * Requirements: 45.1-45.6
 */

import crypto from 'crypto';
import axios from 'axios';
import { db } from '../database/connection';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export type WebhookEvent =
  | 'client_created'
  | 'lead_converted'
  | 'payment_completed'
  | 'contract_generated'
  | 'project_status_changed';

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  'client_created',
  'lead_converted',
  'payment_completed',
  'contract_generated',
  'project_status_changed',
];

export interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, any>;
}

// ============================================================================
// Service
// ============================================================================

export class WebhookService {
  /**
   * Register a new webhook endpoint.
   * Requirements: 45.1, 45.2
   */
  async registerWebhook(
    url: string,
    events: WebhookEvent[],
    secret: string,
    createdBy: string
  ): Promise<Webhook> {
    const result = await db.query<any>(
      `INSERT INTO webhooks (url, events, secret, active, created_by)
       VALUES ($1, $2, $3, TRUE, $4)
       RETURNING id, url, events, secret, active, created_by, created_at`,
      [url, events, secret, createdBy]
    );

    const webhook = this.mapFromDb(result.rows[0]);

    logger.info('Webhook registered', { id: webhook.id, url, events, createdBy });

    return webhook;
  }

  /**
   * List all registered webhooks, optionally filtered by creator.
   * Requirements: 45.1
   */
  async listWebhooks(createdBy?: string): Promise<Webhook[]> {
    let query = `SELECT id, url, events, secret, active, created_by, created_at FROM webhooks`;
    const params: any[] = [];

    if (createdBy) {
      query += ` WHERE created_by = $1`;
      params.push(createdBy);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await db.query<any>(query, params);
    return result.rows.map((row) => this.mapFromDb(row));
  }

  /**
   * Delete a webhook by ID.
   * Requirements: 45.1
   */
  async deleteWebhook(id: string, userId: string): Promise<boolean> {
    const result = await db.query<any>(
      `DELETE FROM webhooks WHERE id = $1 AND created_by = $2`,
      [id, userId]
    );

    const deleted = (result.rowCount ?? 0) > 0;

    if (deleted) {
      logger.info('Webhook deleted', { id, userId });
    } else {
      logger.warn('Webhook not found or not owned by user', { id, userId });
    }

    return deleted;
  }

  /**
   * Trigger an event and send HTTP POST requests to all registered webhooks
   * that are subscribed to that event.
   * Requirements: 45.3, 45.4, 45.5
   */
  async triggerEvent(
    eventType: WebhookEvent,
    payload: Record<string, any>
  ): Promise<void> {
    const result = await db.query<any>(
      `SELECT id, url, events, secret, active, created_by, created_at
       FROM webhooks
       WHERE active = TRUE AND $1 = ANY(events)`,
      [eventType]
    );

    if (result.rows.length === 0) {
      logger.debug('No active webhooks for event', { eventType });
      return;
    }

    const webhookPayload: WebhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    const payloadString = JSON.stringify(webhookPayload);

    const deliveries = result.rows.map((row) => {
      const webhook = this.mapFromDb(row);
      return this.deliverWebhook(webhook, payloadString);
    });

    await Promise.allSettled(deliveries);
  }

  /**
   * Sign a payload using HMAC-SHA256.
   * Requirements: 45.6
   */
  signPayload(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verify an HMAC-SHA256 signature against a payload and secret.
   * Requirements: 45.6
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expected = this.signPayload(payload, secret);
    // Use timingSafeEqual to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex')
      );
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private async deliverWebhook(webhook: Webhook, payloadString: string): Promise<void> {
    const signature = this.signPayload(payloadString, webhook.secret);

    try {
      await axios.post(webhook.url, payloadString, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': JSON.parse(payloadString).event,
        },
        timeout: 10000,
      });

      logger.info('Webhook delivered', { id: webhook.id, url: webhook.url });
    } catch (error) {
      logger.error('Webhook delivery failed', {
        id: webhook.id,
        url: webhook.url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private mapFromDb(row: any): Webhook {
    return {
      id: row.id,
      url: row.url,
      events: row.events as WebhookEvent[],
      secret: row.secret,
      active: row.active,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }
}

export const webhookService = new WebhookService();
export default webhookService;
