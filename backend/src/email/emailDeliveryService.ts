/**
 * Email Delivery Service
 * Sends emails via SendGrid, tracks delivery status via webhooks, and provides metrics.
 * Requirements: 38.10, 28.6-28.7
 */

import sgMail from '@sendgrid/mail';
import { db } from '../database/connection';
import { emailTemplateService } from './emailTemplateService';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export type DeliveryStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'BOUNCED' | 'FAILED';

export interface EmailDeliveryRecord {
  id: string;
  to: string;
  templateName: string;
  language: string;
  subject: string;
  status: DeliveryStatus;
  sendgridMessageId: string | null;
  userId: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  bouncedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  total: number;
}

export interface SendGridEvent {
  event: string;
  email: string;
  sg_message_id: string;
  timestamp: number;
  reason?: string;
}

export interface DeliveryStatsFilters {
  templateName?: string;
  userId?: string;
  fromDate?: Date;
  toDate?: Date;
}

// ============================================================================
// Service
// ============================================================================

/**
 * EmailDeliveryService
 * Handles sending emails via SendGrid and tracking delivery lifecycle.
 * Requirements: 38.10, 28.6-28.7
 */
export class EmailDeliveryService {
  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey) {
      sgMail.setApiKey(apiKey);
    }
  }

  /**
   * Send an email using a named template and record the delivery attempt.
   * Requirement 38.10, 28.6
   */
  async sendEmail(
    to: string,
    templateName: string,
    data: Record<string, unknown>,
    language = 'en',
    userId?: string,
  ): Promise<EmailDeliveryRecord> {
    // Fetch and render the template
    const template = await emailTemplateService.getTemplate(templateName, language);

    // Simple variable substitution for subject
    const subject = this.renderSubject(template.subject, data);

    // Create a pending record first
    const record = await this.createRecord({
      to,
      templateName,
      language,
      subject,
      userId: userId ?? null,
    });

    try {
      const msg = {
        to,
        from: process.env.SENDGRID_FROM_EMAIL ?? 'noreply@techswifttrix.com',
        subject,
        html: template.htmlContent,
        text: template.textContent,
      };

      const [response] = await sgMail.send(msg);

      // Extract SendGrid message ID from response headers
      const messageId = (response.headers['x-message-id'] as string) ?? null;

      const updated = await this.updateRecord(record.id, {
        status: 'SENT',
        sendgridMessageId: messageId,
        sentAt: new Date(),
      });

      logger.info('Email sent', { to, templateName, language, messageId });

      return updated;
    } catch (error: any) {
      const errorMessage = error?.message ?? 'Unknown error';

      const updated = await this.updateRecord(record.id, {
        status: 'FAILED',
        errorMessage,
      });

      logger.error('Email send failed', { to, templateName, error: errorMessage });

      return updated;
    }
  }

  /**
   * Process SendGrid webhook events to update delivery status.
   * Requirement 38.10, 28.7
   */
  async handleSendGridWebhook(events: SendGridEvent[]): Promise<void> {
    for (const event of events) {
      // SendGrid message IDs may have a suffix like ".filter0001p1las1-..."
      const messageId = event.sg_message_id.split('.')[0];

      const record = await db.query<{ id: string }>(
        `SELECT id FROM email_delivery_records WHERE sendgrid_message_id = $1 LIMIT 1`,
        [messageId],
      );

      if (record.rows.length === 0) {
        logger.warn('SendGrid webhook: no matching record', { messageId, event: event.event });
        continue;
      }

      const id = record.rows[0].id;
      const eventTime = new Date(event.timestamp * 1000);

      switch (event.event) {
        case 'delivered':
          await this.updateRecord(id, { status: 'DELIVERED', deliveredAt: eventTime });
          break;
        case 'open':
          await this.updateRecord(id, { status: 'OPENED', openedAt: eventTime });
          break;
        case 'click':
          await this.updateRecord(id, { status: 'CLICKED', clickedAt: eventTime });
          break;
        case 'bounce':
        case 'blocked':
          await this.updateRecord(id, {
            status: 'BOUNCED',
            bouncedAt: eventTime,
            errorMessage: event.reason ?? null,
          });
          break;
        default:
          logger.debug('SendGrid webhook: unhandled event type', { event: event.event });
      }
    }
  }

  /**
   * Get aggregated delivery statistics with optional filters.
   * Requirement 38.10
   */
  async getDeliveryStats(filters: DeliveryStatsFilters = {}): Promise<DeliveryStats> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.templateName) {
      conditions.push(`template_name = $${idx++}`);
      params.push(filters.templateName);
    }
    if (filters.userId) {
      conditions.push(`user_id = $${idx++}`);
      params.push(filters.userId);
    }
    if (filters.fromDate) {
      conditions.push(`sent_at >= $${idx++}`);
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      conditions.push(`sent_at <= $${idx++}`);
      params.push(filters.toDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query<{
      sent: string; delivered: string; opened: string;
      clicked: string; bounced: string; failed: string; total: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('SENT','DELIVERED','OPENED','CLICKED')) AS sent,
         COUNT(*) FILTER (WHERE status IN ('DELIVERED','OPENED','CLICKED'))        AS delivered,
         COUNT(*) FILTER (WHERE status IN ('OPENED','CLICKED'))                    AS opened,
         COUNT(*) FILTER (WHERE status = 'CLICKED')                               AS clicked,
         COUNT(*) FILTER (WHERE status = 'BOUNCED')                               AS bounced,
         COUNT(*) FILTER (WHERE status = 'FAILED')                                AS failed,
         COUNT(*)                                                                  AS total
       FROM email_delivery_records ${where}`,
      params,
    );

    const row = result.rows[0];
    return {
      sent: parseInt(row.sent, 10),
      delivered: parseInt(row.delivered, 10),
      opened: parseInt(row.opened, 10),
      clicked: parseInt(row.clicked, 10),
      bounced: parseInt(row.bounced, 10),
      failed: parseInt(row.failed, 10),
      total: parseInt(row.total, 10),
    };
  }

  /**
   * Get delivery history with optional filters.
   * Requirement 38.10
   */
  async getDeliveryHistory(
    userId?: string,
    templateName?: string,
    limit = 50,
  ): Promise<EmailDeliveryRecord[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (userId) {
      conditions.push(`user_id = $${idx++}`);
      params.push(userId);
    }
    if (templateName) {
      conditions.push(`template_name = $${idx++}`);
      params.push(templateName);
    }

    params.push(limit);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT id, to_address, template_name, language, subject, status,
              sendgrid_message_id, user_id, sent_at, delivered_at, opened_at,
              clicked_at, bounced_at, error_message, created_at, updated_at
       FROM email_delivery_records
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx}`,
      params,
    );

    return result.rows.map((row) => this.mapFromDb(row));
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private renderSubject(subject: string, data: Record<string, unknown>): string {
    return subject.replace(/\{\{(\w+)\}\}/g, (_, key) => String(data[key] ?? `{{${key}}}`));
  }

  private async createRecord(input: {
    to: string;
    templateName: string;
    language: string;
    subject: string;
    userId: string | null;
  }): Promise<EmailDeliveryRecord> {
    const result = await db.query(
      `INSERT INTO email_delivery_records
         (to_address, template_name, language, subject, status, user_id)
       VALUES ($1, $2, $3, $4, 'PENDING', $5)
       RETURNING id, to_address, template_name, language, subject, status,
                 sendgrid_message_id, user_id, sent_at, delivered_at, opened_at,
                 clicked_at, bounced_at, error_message, created_at, updated_at`,
      [input.to, input.templateName, input.language, input.subject, input.userId],
    );
    return this.mapFromDb(result.rows[0]);
  }

  private async updateRecord(
    id: string,
    updates: Partial<{
      status: DeliveryStatus;
      sendgridMessageId: string | null;
      sentAt: Date;
      deliveredAt: Date;
      openedAt: Date;
      clickedAt: Date;
      bouncedAt: Date;
      errorMessage: string | null;
    }>,
  ): Promise<EmailDeliveryRecord> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${idx++}`);
      params.push(updates.status);
    }
    if (updates.sendgridMessageId !== undefined) {
      setClauses.push(`sendgrid_message_id = $${idx++}`);
      params.push(updates.sendgridMessageId);
    }
    if (updates.sentAt !== undefined) {
      setClauses.push(`sent_at = $${idx++}`);
      params.push(updates.sentAt);
    }
    if (updates.deliveredAt !== undefined) {
      setClauses.push(`delivered_at = $${idx++}`);
      params.push(updates.deliveredAt);
    }
    if (updates.openedAt !== undefined) {
      setClauses.push(`opened_at = $${idx++}`);
      params.push(updates.openedAt);
    }
    if (updates.clickedAt !== undefined) {
      setClauses.push(`clicked_at = $${idx++}`);
      params.push(updates.clickedAt);
    }
    if (updates.bouncedAt !== undefined) {
      setClauses.push(`bounced_at = $${idx++}`);
      params.push(updates.bouncedAt);
    }
    if (updates.errorMessage !== undefined) {
      setClauses.push(`error_message = $${idx++}`);
      params.push(updates.errorMessage);
    }

    params.push(id);

    const result = await db.query(
      `UPDATE email_delivery_records
       SET ${setClauses.join(', ')}
       WHERE id = $${idx}
       RETURNING id, to_address, template_name, language, subject, status,
                 sendgrid_message_id, user_id, sent_at, delivered_at, opened_at,
                 clicked_at, bounced_at, error_message, created_at, updated_at`,
      params,
    );

    return this.mapFromDb(result.rows[0]);
  }

  private mapFromDb(row: any): EmailDeliveryRecord {
    return {
      id: row.id,
      to: row.to_address,
      templateName: row.template_name,
      language: row.language,
      subject: row.subject,
      status: row.status as DeliveryStatus,
      sendgridMessageId: row.sendgrid_message_id ?? null,
      userId: row.user_id ?? null,
      sentAt: row.sent_at ?? null,
      deliveredAt: row.delivered_at ?? null,
      openedAt: row.opened_at ?? null,
      clickedAt: row.clicked_at ?? null,
      bouncedAt: row.bounced_at ?? null,
      errorMessage: row.error_message ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const emailDeliveryService = new EmailDeliveryService();
export default emailDeliveryService;
