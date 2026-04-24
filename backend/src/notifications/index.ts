export {
  notificationService,
  NotificationService,
  NotificationPriority,
  NotificationType,
  DeliveryChannel,
} from './notificationService';
export type {
  SendNotificationInput,
  NotificationRecord,
  NotificationFilters,
  PaginatedNotifications,
  DeliveryStatus,
} from './notificationService';

export {
  notificationPreferencesService,
  NotificationPreferencesService,
  DEFAULT_CHANNELS,
} from './notificationPreferences';
export type { NotificationPreference } from './notificationPreferences';

export { default as notificationRoutes } from './notificationRoutes';
