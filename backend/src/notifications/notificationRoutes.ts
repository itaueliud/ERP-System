import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../database/connection';
import { notificationService, NotificationFilters, NotificationType, NotificationPriority, DeliveryChannel } from './notificationService';
import { notificationPreferencesService } from './notificationPreferences';
import logger from '../utils/logger';

const router = Router();

// Generous rate limit for broadcast — CEO only, max 30 broadcasts per 15 min
const broadcastLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many broadcast requests, please wait a moment.',
  keyGenerator: (req) => (req as any).user?.id || req.ip,
});

/**
 * GET /api/notifications
 * Get notifications for the authenticated user.
 * Requirement 14.9: Display notification history in user profile.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const filters: NotificationFilters = {
      type: req.query.type as NotificationType | undefined,
      priority: req.query.priority as NotificationPriority | undefined,
      read: req.query.read !== undefined ? req.query.read === 'true' : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    const result = await notificationService.getNotifications(userId, filters);
    return res.json(result);
  } catch (error: any) {
    logger.error('Error fetching notifications', { error });
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count for the authenticated user.
 */
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const count = await notificationService.getUnreadCount(userId);
    return res.json({ count });
  } catch (error: any) {
    logger.error('Error fetching unread count', { error });
    return res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read.
 * Requirement 14.12: Allow users to mark notifications as read.
 */
router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const notification = await notificationService.markAsRead(id, userId);
    return res.json(notification);
  } catch (error: any) {
    logger.error('Error marking notification as read', { error, notificationId: req.params.id });
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// ─── Notification Preferences ─────────────────────────────────────────────────

/**
 * GET /api/notifications/preferences
 * Get all notification preferences for the authenticated user.
 * Requirement 14.6: Allow users to configure notification preferences per event type.
 */
router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const preferences = await notificationPreferencesService.getPreferences(userId);
    return res.json({ preferences });
  } catch (error: any) {
    logger.error('Error fetching notification preferences', { error });
    return res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

/**
 * PUT /api/notifications/preferences/:type
 * Update preference for a specific notification type.
 * Requirement 14.6
 */
router.put('/preferences/:type', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { type } = req.params;
    const validTypes = Object.values(NotificationType) as string[];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid notification type: ${type}` });
    }

    const { enabled, channels } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Field "enabled" must be a boolean' });
    }

    if (channels !== undefined) {
      const validChannels = Object.values(DeliveryChannel) as string[];
      const invalid = (channels as string[]).filter((c) => !validChannels.includes(c));
      if (invalid.length > 0) {
        return res.status(400).json({ error: `Invalid channels: ${invalid.join(', ')}` });
      }
    }

    const preference = await notificationPreferencesService.updatePreference(
      userId,
      type as NotificationType,
      enabled,
      channels as DeliveryChannel[] | undefined
    );

    return res.json(preference);
  } catch (error: any) {
    logger.error('Error updating notification preference', { error, type: req.params.type });
    return res.status(500).json({ error: 'Failed to update notification preference' });
  }
});

/**
 * DELETE /api/notifications/preferences
 * Reset all notification preferences to defaults.
 * Requirement 14.6
 */
router.delete('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    await notificationPreferencesService.resetPreferences(userId);
    return res.json({ message: 'Notification preferences reset to defaults' });
  } catch (error: any) {
    logger.error('Error resetting notification preferences', { error });
    return res.status(500).json({ error: 'Failed to reset notification preferences' });
  }
});

/**
 * GET /api/notifications/sent
 * CEO-only: get all notifications broadcast by this user (sent history + scheduled).
 * Returns one representative row per broadcast (distinct by title+message+created_at).
 */
router.get('/sent', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    // Get one row per broadcast group (same title+message sent at same time)
    // Use DISTINCT ON to deduplicate, ordered by created_at DESC
    const result = await db.query(
      `SELECT DISTINCT ON (title, message, DATE_TRUNC('second', created_at))
              id, user_id, type, title, message, data, read, scheduled_at, created_at
       FROM notifications
       WHERE data->>'broadcastBy' = $1
       ORDER BY title, message, DATE_TRUNC('second', created_at), created_at DESC`,
      [userId]
    );

    // Re-sort by created_at DESC for display
    const rows = result.rows.sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return res.json({ notifications: rows, total: rows.length });
  } catch (error: any) {
    logger.error('Error fetching sent notifications', { error });
    return res.status(500).json({ error: 'Failed to fetch sent notifications' });
  }
});


router.post('/broadcast', broadcastLimiter, async (req: Request, res: Response) => {
  try {
    const sender = (req as any).user;
    if (!sender?.id) return res.status(401).json({ error: 'Authentication required' });

    const { title, message, type, target, scheduledAt } = req.body;
    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'title and message are required' });
    }

    // Portal → role mapping
    const PORTAL_ROLES: Record<string, string[]> = {
      all:        [],
      executive:  ['CoS', 'CFO', 'EA', 'CFO_ASSISTANT'],
      clevel:     ['COO', 'CTO'],
      operations: ['OPERATIONS_USER', 'HEAD_OF_TRAINERS', 'TRAINER'],
      technology: ['TECH_STAFF', 'DEVELOPER'],
      agents:     ['AGENT'],
    };

    const roles: string[] = PORTAL_ROLES[target as string] ?? [];

    // Fetch target users
    let usersResult;
    if (roles.length > 0) {
      usersResult = await db.query(
        `SELECT id FROM users WHERE is_active = true AND role = ANY($1::text[])`,
        [roles]
      );
    } else {
      usersResult = await db.query(`SELECT id FROM users WHERE is_active = true`);
    }
    const users: { id: string }[] = usersResult.rows;

    if (users.length === 0) {
      return res.status(404).json({ error: 'No users found for the selected target' });
    }

    const notifType = (type as string) || 'MESSAGE_RECEIVED';
    const scheduledTime = scheduledAt ? new Date(scheduledAt) : null;
    const dataJson = JSON.stringify({ target, broadcastBy: sender.id });
    const deliveryJson = JSON.stringify({});

    // Bulk INSERT — one query for all users
    if (scheduledTime && scheduledTime > new Date()) {
      const valueClauses = users.map((_, i) => {
        const b = i * 8;
        return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},false,$${b+8},NOW())`;
      }).join(',');
      const params = users.flatMap(u => [
        u.id, notifType, NotificationPriority.LOW,
        title.trim(), message.trim(), dataJson, deliveryJson, scheduledTime,
      ]);
      await db.query(
        `INSERT INTO notifications (user_id,type,priority,title,message,data,delivery_status,read,scheduled_at,created_at) VALUES ${valueClauses}`,
        params
      );
      return res.status(201).json({ scheduled: true, scheduledAt: scheduledTime, count: users.length });
    }

    // Immediate bulk insert
    const valueClauses = users.map((_, i) => {
      const b = i * 7;
      return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},false,NOW())`;
    }).join(',');
    const params = users.flatMap(u => [
      u.id, notifType, NotificationPriority.LOW,
      title.trim(), message.trim(), dataJson, deliveryJson,
    ]);
    await db.query(
      `INSERT INTO notifications (user_id,type,priority,title,message,data,delivery_status,read,created_at) VALUES ${valueClauses}`,
      params
    );

    return res.status(201).json({ sent: users.length, total: users.length });
  } catch (error: any) {
    logger.error('Broadcast notification error', { error });
    return res.status(500).json({ error: 'Failed to broadcast notification' });
  }
});

/**
 * DELETE /api/notifications/clear-all
 * CEO-only: delete all notifications they broadcast (clear history from all portals).
 */
router.delete('/clear-all', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Authentication required' });
    await db.query(`DELETE FROM notifications WHERE data->>'broadcastBy' = $1`, [user.id]);
    return res.json({ success: true });
  } catch (error: any) {
    logger.error('Error clearing all notifications', { error });
    return res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

/**
 * DELETE /api/notifications/:id/broadcast
 * CEO-only: delete all copies of a broadcast notification (same title + message sent at same time).
 * Uses the notification's data->broadcastBy field to find siblings.
 */
router.delete('/:id/broadcast', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Authentication required' });
    const { id } = req.params;
    // Find the source notification to get title + message
    const src = await db.query(`SELECT title, message FROM notifications WHERE id = $1`, [id]);
    if (src.rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
    const { title, message } = src.rows[0];
    // Delete all notifications with the same title and message
    const result = await db.query(
      `DELETE FROM notifications WHERE title = $1 AND message = $2`,
      [title, message]
    );
    return res.json({ success: true, deleted: result.rowCount });
  } catch (error: any) {
    logger.error('Error deleting broadcast notification', { error });
    return res.status(500).json({ error: 'Failed to delete broadcast' });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification by ID.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const { id } = req.params;
    const result = await db.query(`DELETE FROM notifications WHERE id = $1`, [id]);
    if ((result.rowCount ?? 0) === 0) return res.status(404).json({ error: 'Notification not found' });
    return res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting notification', { error });
    return res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;
