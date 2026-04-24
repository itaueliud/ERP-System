/**
 * NotificationPreferencesService
 * Manages per-user, per-type notification preferences.
 * Requirements: 14.6, 14.12
 */

import { db } from '../database/connection';
import { NotificationType, DeliveryChannel } from './notificationService';
import logger from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationPreference {
  userId: string;
  notificationType: NotificationType;
  enabled: boolean;
  /** Explicit channel overrides; empty array means use the default channel for the type */
  channels: DeliveryChannel[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Default channel per notification type.
 * Mirrors the priority-based routing in NotificationService.
 */
export const DEFAULT_CHANNELS: Record<NotificationType, DeliveryChannel[]> = {
  [NotificationType.PAYMENT_APPROVAL]:    [DeliveryChannel.SMS],
  [NotificationType.PAYMENT_EXECUTED]:    [DeliveryChannel.SMS],
  [NotificationType.LEAD_CONVERTED]:      [DeliveryChannel.EMAIL],
  [NotificationType.REPORT_OVERDUE]:      [DeliveryChannel.EMAIL],
  [NotificationType.SERVICE_AMOUNT_CHANGE]: [DeliveryChannel.SMS],
  [NotificationType.CONTRACT_GENERATED]:  [DeliveryChannel.EMAIL],
  [NotificationType.MESSAGE_RECEIVED]:    [DeliveryChannel.PUSH],
  [NotificationType.TASK_ASSIGNED]:       [DeliveryChannel.PUSH],
  [NotificationType.TASK_DUE]:            [DeliveryChannel.PUSH],
};

// ─── Service ──────────────────────────────────────────────────────────────────

export class NotificationPreferencesService {
  /**
   * Get all notification preferences for a user.
   * Returns stored preferences merged with defaults for any missing types.
   * Requirement 14.6
   */
  async getPreferences(userId: string): Promise<NotificationPreference[]> {
    const result = await db.query(
      `SELECT user_id, notification_type, enabled, channels, created_at, updated_at
       FROM user_notification_preferences
       WHERE user_id = $1`,
      [userId]
    );

    const stored = new Map<string, NotificationPreference>(
      result.rows.map((r: any) => [r.notification_type, this.mapRow(r)])
    );

    // Fill in defaults for any type not yet stored
    return Object.values(NotificationType).map((type) => {
      if (stored.has(type)) return stored.get(type)!;
      return this.buildDefault(userId, type as NotificationType);
    });
  }

  /**
   * Update (upsert) a preference for a specific notification type.
   * Requirement 14.6
   */
  async updatePreference(
    userId: string,
    type: NotificationType,
    enabled: boolean,
    channels?: DeliveryChannel[]
  ): Promise<NotificationPreference> {
    const channelsJson = JSON.stringify(channels ?? []);

    const result = await db.query(
      `INSERT INTO user_notification_preferences
           (user_id, notification_type, enabled, channels)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (user_id, notification_type)
       DO UPDATE SET
           enabled    = EXCLUDED.enabled,
           channels   = EXCLUDED.channels,
           updated_at = NOW()
       RETURNING user_id, notification_type, enabled, channels, created_at, updated_at`,
      [userId, type, enabled, channelsJson]
    );

    logger.info('Notification preference updated', { userId, type, enabled });
    return this.mapRow(result.rows[0]);
  }

  /**
   * Reset all preferences for a user to defaults (deletes stored overrides).
   * Requirement 14.6
   */
  async resetPreferences(userId: string): Promise<void> {
    await db.query(
      `DELETE FROM user_notification_preferences WHERE user_id = $1`,
      [userId]
    );
    logger.info('Notification preferences reset to defaults', { userId });
  }

  /**
   * Check whether a notification type is enabled for a user.
   * Falls back to enabled=true when no preference is stored.
   * Requirement 14.6
   */
  async isNotificationEnabled(userId: string, type: NotificationType): Promise<boolean> {
    const result = await db.query(
      `SELECT enabled
       FROM user_notification_preferences
       WHERE user_id = $1 AND notification_type = $2`,
      [userId, type]
    );

    if (result.rows.length === 0) return true; // default: enabled
    return result.rows[0].enabled as boolean;
  }

  /**
   * Get the channels enabled for a notification type for a user.
   * Returns the stored channel overrides, or the default channels if none are stored.
   * Requirement 14.6
   */
  async getEnabledChannels(userId: string, type: NotificationType): Promise<DeliveryChannel[]> {
    const result = await db.query(
      `SELECT channels
       FROM user_notification_preferences
       WHERE user_id = $1 AND notification_type = $2`,
      [userId, type]
    );

    if (result.rows.length === 0) return DEFAULT_CHANNELS[type];

    const stored: DeliveryChannel[] =
      typeof result.rows[0].channels === 'string'
        ? JSON.parse(result.rows[0].channels)
        : result.rows[0].channels ?? [];

    return stored.length > 0 ? stored : DEFAULT_CHANNELS[type];
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private buildDefault(userId: string, type: NotificationType): NotificationPreference {
    const now = new Date();
    return {
      userId,
      notificationType: type,
      enabled: true,
      channels: DEFAULT_CHANNELS[type],
      createdAt: now,
      updatedAt: now,
    };
  }

  private mapRow(row: any): NotificationPreference {
    const channels: DeliveryChannel[] =
      typeof row.channels === 'string'
        ? JSON.parse(row.channels)
        : row.channels ?? [];

    return {
      userId: row.user_id,
      notificationType: row.notification_type as NotificationType,
      enabled: row.enabled,
      channels: channels.length > 0 ? channels : DEFAULT_CHANNELS[row.notification_type as NotificationType],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const notificationPreferencesService = new NotificationPreferencesService();
