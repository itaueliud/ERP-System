import { db } from '../database/connection';
import { africasTalkingClient } from '../services/africas-talking/client';
import { sendgridClient } from '../services/sendgrid/client';
import { firebaseClient } from '../services/firebase/client';
import { config } from '../config';
import logger from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export enum NotificationPriority {
  HIGH = 'HIGH',     // → SMS via Africa's Talking
  MEDIUM = 'MEDIUM', // → Email via SendGrid
  LOW = 'LOW',       // → Push via Firebase
}

export enum NotificationType {
  PAYMENT_APPROVAL        = 'PAYMENT_APPROVAL',
  PAYMENT_EXECUTED        = 'PAYMENT_EXECUTED',
  LEAD_CONVERTED          = 'LEAD_CONVERTED',
  REPORT_OVERDUE          = 'REPORT_OVERDUE',
  SERVICE_AMOUNT_CHANGE   = 'SERVICE_AMOUNT_CHANGE',
  CONTRACT_GENERATED      = 'CONTRACT_GENERATED',
  MESSAGE_RECEIVED        = 'MESSAGE_RECEIVED',
  TASK_ASSIGNED           = 'TASK_ASSIGNED',
  TASK_DUE                = 'TASK_DUE',
  // Doc §20 — additional required notification events
  NEW_LEAD_ADDED          = 'NEW_LEAD_ADDED',          // Agent adds lead → notify Trainer (In-app + SMS)
  COMMITMENT_PAYMENT_CONFIRMED = 'COMMITMENT_PAYMENT_CONFIRMED', // → Trainer + CFO (In-app + Email)
  LEAD_BECOMES_PROJECT    = 'LEAD_BECOMES_PROJECT',    // → CTO (In-app + Email)
  PAYMENT_APPROVED        = 'PAYMENT_APPROVED',        // CFO approves → EA (In-app)
  AMOUNT_CHANGE_PROPOSED  = 'AMOUNT_CHANGE_PROPOSED',  // → CEO (In-app)
  AMOUNT_CHANGE_CONFIRMED = 'AMOUNT_CHANGE_CONFIRMED', // → Proposer (In-app)
  SIGNED_CONTRACT_UPLOADED = 'SIGNED_CONTRACT_UPLOADED', // → EA + CEO (In-app)
  NEW_PLOTCONNECT_PROPERTY = 'NEW_PLOTCONNECT_PROPERTY', // → COO + CEO (In-app)
  DAILY_REPORT_OVERDUE    = 'DAILY_REPORT_OVERDUE',    // → COO + CoS (Automated alert)
  GITHUB_COMMIT_PR        = 'GITHUB_COMMIT_PR',        // → CTO (In-app)
  NEW_USER_INVITED        = 'NEW_USER_INVITED',        // → Invited user (Email)
}

export enum DeliveryChannel {
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
}

export interface DeliveryStatus {
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  attempts: number;
  lastAttempt?: Date;
  error?: string;
}

export interface SendNotificationInput {
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, any>;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  deliveryStatus: Record<string, DeliveryStatus>;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface NotificationFilters {
  type?: NotificationType;
  priority?: NotificationPriority;
  read?: boolean;
  limit?: number;
  offset?: number;
}

export interface PaginatedNotifications {
  notifications: NotificationRecord[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * NotificationService
 * Multi-channel notification delivery with priority-based routing.
 * Requirements: 14.1–14.5, 14.7, 14.8, 14.12
 */
export class NotificationService {
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  /** Optional hook to check user preferences before sending. Injected to avoid circular deps. */
  private prefsChecker?: (userId: string, type: NotificationType) => Promise<boolean>;

  constructor(prefsChecker?: (userId: string, type: NotificationType) => Promise<boolean>) {
    this.maxRetries = config.notifications.retryAttempts;
    this.retryDelayMs = config.notifications.retryDelayMs;
    this.prefsChecker = prefsChecker;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Send a notification, routing to the appropriate channel based on priority.
   * Requirement 14.2: Determine channel based on urgency.
   * Requirement 14.3: HIGH → SMS
   * Requirement 14.4: MEDIUM → Email
   * Requirement 14.5: LOW → Push
   */
  async sendNotification(input: SendNotificationInput): Promise<NotificationRecord> {
    // Check user preferences before sending (Requirement 14.6)
    if (this.prefsChecker) {
      const isEnabled = await this.prefsChecker(input.userId, input.type);
      if (!isEnabled) {
        logger.info('Notification suppressed by user preference', {
          userId: input.userId,
          type: input.type,
        });
        return this.createNotificationRecord(input);
      }
    }

    // Persist the notification record first
    const record = await this.createNotificationRecord(input);

    // Route to the correct channel
    try {
      switch (input.priority) {
        case NotificationPriority.HIGH:
          await this.sendSMSForNotification(record);
          break;
        case NotificationPriority.MEDIUM:
          await this.sendEmailForNotification(record);
          break;
        case NotificationPriority.LOW:
          await this.sendPushForNotification(record);
          break;
      }
    } catch (err: any) {
      logger.error('Notification delivery failed', { notificationId: record.id, error: err });
    }

    return this.getNotificationById(record.id);
  }

  /**
   * Send SMS to a user (Africa's Talking).
   * Requirement 14.3: High-priority → SMS
   */
  async sendSMS(userId: string, message: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user?.phone) {
      throw new Error(`User ${userId} has no phone number`);
    }

    const phone = africasTalkingClient.formatPhoneNumber(user.phone);
    await africasTalkingClient.sendSMS({ to: phone, message });
    logger.info('SMS sent', { userId, phone });
  }

  /**
   * Send email to a user (SendGrid).
   * Requirement 14.4: Medium-priority → Email
   */
  async sendEmail(userId: string, subject: string, html: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user?.email) {
      throw new Error(`User ${userId} has no email`);
    }

    await sendgridClient.sendEmail({ to: user.email, subject, html });
    logger.info('Email sent', { userId, email: user.email, subject });
  }

  /**
   * Send push notification to a user (Firebase).
   * Requirement 14.5: Low-priority → Push
   */
  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<void> {
    const token = await this.getUserFCMToken(userId);
    if (!token) {
      throw new Error(`No FCM token found for user ${userId}`);
    }

    await firebaseClient.sendPushNotification({ token, title, body, data });
    logger.info('Push notification sent', { userId, title });
  }

  /**
   * Get notifications for a user with optional filters.
   * Requirement 14.9: Display notification history in user profile.
   */
  async getNotifications(
    userId: string,
    filters: NotificationFilters = {}
  ): Promise<PaginatedNotifications> {
    const { type, priority, read, limit = 20, offset = 0 } = filters;

    const conditions: string[] = ['n.user_id = $1'];
    const params: any[] = [userId];
    let idx = 2;

    if (type !== undefined) {
      conditions.push(`n.type = $${idx++}`);
      params.push(type);
    }
    if (priority !== undefined) {
      conditions.push(`n.priority = $${idx++}`);
      params.push(priority);
    }
    if (read !== undefined) {
      conditions.push(`n.read = $${idx++}`);
      params.push(read);
    }

    const where = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*) FROM notifications n WHERE ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit, offset);
    const dataResult = await db.query(
      `SELECT n.id, n.user_id, n.type, n.priority, n.title, n.message,
              n.data, n.delivery_status, n.read, n.read_at, n.created_at
       FROM notifications n
       WHERE ${where}
       ORDER BY n.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );

    return {
      notifications: dataResult.rows.map(this.mapRow),
      total,
      limit,
      offset,
    };
  }

  /**
   * Mark a notification as read.
   * Requirement 14.12: Allow users to mark notifications as read.
   */
  async markAsRead(notificationId: string, userId: string): Promise<NotificationRecord> {
    const result = await db.query(
      `UPDATE notifications
       SET read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, type, priority, title, message,
                 data, delivery_status, read, read_at, created_at`,
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Notification not found or access denied');
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Get unread notification count for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = FALSE`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private async createNotificationRecord(
    input: SendNotificationInput
  ): Promise<NotificationRecord> {
    const initialStatus: Record<string, DeliveryStatus> = {};
    const channel = this.channelForPriority(input.priority);
    initialStatus[channel] = { status: 'PENDING', attempts: 0 };

    const result = await db.query(
      `INSERT INTO notifications (user_id, type, priority, title, message, data, delivery_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, type, priority, title, message,
                 data, delivery_status, read, read_at, created_at`,
      [
        input.userId,
        input.type,
        input.priority,
        input.title,
        input.message,
        input.data ? JSON.stringify(input.data) : null,
        JSON.stringify(initialStatus),
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  private async getNotificationById(id: string): Promise<NotificationRecord> {
    const result = await db.query(
      `SELECT id, user_id, type, priority, title, message,
              data, delivery_status, read, read_at, created_at
       FROM notifications WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) throw new Error(`Notification ${id} not found`);
    return this.mapRow(result.rows[0]);
  }

  private async updateDeliveryStatus(
    notificationId: string,
    channel: string,
    status: DeliveryStatus
  ): Promise<void> {
    await db.query(
      `UPDATE notifications
       SET delivery_status = delivery_status || $1::jsonb
       WHERE id = $2`,
      [JSON.stringify({ [channel]: status }), notificationId]
    );
  }

  /** Attempt delivery with exponential-backoff retry.
   *  Requirement 14.8: Retry up to 3 times with exponential backoff.
   */
  private async withRetry(
    notificationId: string,
    channel: string,
    fn: () => Promise<void>
  ): Promise<void> {
    let attempts = 0;
    let lastError: Error | undefined;

    while (attempts < this.maxRetries) {
      attempts++;
      try {
        await fn();
        await this.updateDeliveryStatus(notificationId, channel, {
          status: 'SENT',
          attempts,
          lastAttempt: new Date(),
        });
        return;
      } catch (err: any) {
        lastError = err;
        logger.warn(`Delivery attempt ${attempts} failed`, { notificationId, channel, error: err });
        await this.updateDeliveryStatus(notificationId, channel, {
          status: 'FAILED',
          attempts,
          lastAttempt: new Date(),
          error: err.message,
        });

        if (attempts < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempts - 1);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError;
  }

  private async sendSMSForNotification(record: NotificationRecord): Promise<void> {
    const user = await this.getUserById(record.userId);
    if (!user?.phone) {
      await this.updateDeliveryStatus(record.id, DeliveryChannel.SMS, {
        status: 'FAILED',
        attempts: 1,
        lastAttempt: new Date(),
        error: 'User has no phone number',
      });
      return;
    }

    const phone = africasTalkingClient.formatPhoneNumber(user.phone);
    const fullMessage = `${record.title}\n\n${record.message}`;

    await this.withRetry(record.id, DeliveryChannel.SMS, () =>
      africasTalkingClient.sendSMS({ to: phone, message: fullMessage }).then(() => undefined)
    );
  }

  private async sendEmailForNotification(record: NotificationRecord): Promise<void> {
    const user = await this.getUserById(record.userId);
    if (!user?.email) {
      await this.updateDeliveryStatus(record.id, DeliveryChannel.EMAIL, {
        status: 'FAILED',
        attempts: 1,
        lastAttempt: new Date(),
        error: 'User has no email',
      });
      return;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${record.title}</h2>
        <p>${record.message}</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">TechSwiftTrix ERP System</p>
      </div>
    `;

    await this.withRetry(record.id, DeliveryChannel.EMAIL, () =>
      sendgridClient.sendEmail({ to: user.email, subject: record.title, html })
    );
  }

  private async sendPushForNotification(record: NotificationRecord): Promise<void> {
    const token = await this.getUserFCMToken(record.userId);
    if (!token) {
      await this.updateDeliveryStatus(record.id, DeliveryChannel.PUSH, {
        status: 'FAILED',
        attempts: 1,
        lastAttempt: new Date(),
        error: 'No FCM token for user',
      });
      return;
    }

    const data: Record<string, string> = {
      notificationId: record.id,
      type: record.type,
    };
    if (record.data) {
      for (const [k, v] of Object.entries(record.data)) {
        data[k] = String(v);
      }
    }

    await this.withRetry(record.id, DeliveryChannel.PUSH, () =>
      firebaseClient
        .sendPushNotification({ token, title: record.title, body: record.message, data })
        .then(() => undefined)
    );
  }

  private channelForPriority(priority: NotificationPriority): string {
    switch (priority) {
      case NotificationPriority.HIGH:
        return DeliveryChannel.SMS;
      case NotificationPriority.MEDIUM:
        return DeliveryChannel.EMAIL;
      case NotificationPriority.LOW:
        return DeliveryChannel.PUSH;
    }
  }

  private async getUserById(
    userId: string
  ): Promise<{ email: string; phone: string; fullName: string } | null> {
    const result = await db.query(
      `SELECT email, phone, full_name FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return { email: row.email, phone: row.phone, fullName: row.full_name };
  }

  private async getUserFCMToken(userId: string): Promise<string | null> {
    // FCM tokens are stored in a user_fcm_tokens table or user metadata.
    // Fall back to null if not present (table may not exist yet).
    try {
      const result = await db.query(
        `SELECT token FROM user_fcm_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      return result.rows[0]?.token ?? null;
    } catch {
      return null;
    }
  }

  private mapRow(row: any): NotificationRecord {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      priority: row.priority,
      title: row.title,
      message: row.message,
      data: row.data,
      deliveryStatus:
        typeof row.delivery_status === 'string'
          ? JSON.parse(row.delivery_status)
          : row.delivery_status ?? {},
      read: row.read,
      readAt: row.read_at,
      createdAt: row.created_at,
    };
  }
}

export const notificationService = new NotificationService(
  // Wire in preferences check at module level to avoid circular dependency
  async (userId: string, type: NotificationType) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { notificationPreferencesService } = require('./notificationPreferences');
    return notificationPreferencesService.isNotificationEnabled(userId, type);
  }
);
