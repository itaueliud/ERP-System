import { Router, Request, Response } from 'express';
import { notificationService, NotificationFilters, NotificationType, NotificationPriority, DeliveryChannel } from './notificationService';
import { notificationPreferencesService } from './notificationPreferences';
import logger from '../utils/logger';

const router = Router();

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

export default router;
