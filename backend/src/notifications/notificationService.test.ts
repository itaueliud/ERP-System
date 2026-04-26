/**
 * Tests for NotificationService
 * Requirements: 14.1–14.5, 14.7, 14.8, 14.12
 */

import {
  NotificationService,
  NotificationPriority,
  NotificationType,
  DeliveryChannel,
  SendNotificationInput,
} from './notificationService';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../database/connection', () => ({
  db: {
    query: jest.fn(),
  },
}));

jest.mock('../services/africas-talking/client', () => ({
  africasTalkingClient: {
    sendSMS: jest.fn(),
    formatPhoneNumber: jest.fn((phone: string) => `+254${phone.slice(-9)}`),
  },
}));

jest.mock('../services/sendgrid/client', () => ({
  sendgridClient: {
    sendEmail: jest.fn(),
  },
}));

jest.mock('../services/firebase/client', () => ({
  firebaseClient: {
    sendPushNotification: jest.fn(),
  },
}));

jest.mock('../config', () => ({
  config: {
    notifications: {
      retryAttempts: 3,
      retryDelayMs: 10, // short for tests
    },
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { db } from '../database/connection';
import { africasTalkingClient } from '../services/africas-talking/client';
import { sendgridClient } from '../services/sendgrid/client';
import { firebaseClient } from '../services/firebase/client';

const mockDb = db as jest.Mocked<typeof db>;
const mockSMS = africasTalkingClient as jest.Mocked<typeof africasTalkingClient>;
const mockEmail = sendgridClient as jest.Mocked<typeof sendgridClient>;
const mockPush = firebaseClient as jest.Mocked<typeof firebaseClient>;

const FAKE_USER = { email: 'user@test.com', phone: '0712345678', fullName: 'Test User' };
const FAKE_NOTIFICATION_ROW = {
  id: 'notif-1',
  user_id: 'user-1',
  type: NotificationType.PAYMENT_APPROVAL,
  priority: NotificationPriority.HIGH,
  title: 'Test',
  message: 'Test message',
  data: null,
  delivery_status: JSON.stringify({ SMS: { status: 'PENDING', attempts: 0 } }),
  read: false,
  read_at: null,
  created_at: new Date(),
};

function setupDbForSend(priority: NotificationPriority) {
  // createNotificationRecord INSERT
  mockDb.query
    .mockResolvedValueOnce({ rows: [FAKE_NOTIFICATION_ROW], rowCount: 1 } as any)
    // getUserById SELECT
    .mockResolvedValueOnce({ rows: [{ email: FAKE_USER.email, phone: FAKE_USER.phone, full_name: FAKE_USER.fullName }], rowCount: 1 } as any)
    // updateDeliveryStatus UPDATE (after successful send)
    .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
    // getNotificationById SELECT
    .mockResolvedValueOnce({ rows: [FAKE_NOTIFICATION_ROW], rowCount: 1 } as any);

  if (priority === NotificationPriority.LOW) {
    // getUserFCMToken SELECT (replaces getUserById for push)
    mockDb.query
      .mockReset()
      .mockResolvedValueOnce({ rows: [FAKE_NOTIFICATION_ROW], rowCount: 1 } as any) // INSERT
      .mockResolvedValueOnce({ rows: [{ token: 'fcm-token-abc' }], rowCount: 1 } as any) // FCM token
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // updateDeliveryStatus
      .mockResolvedValueOnce({ rows: [FAKE_NOTIFICATION_ROW], rowCount: 1 } as any); // getById
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService();
  });

  // ── Priority routing ────────────────────────────────────────────────────────

  describe('sendNotification – priority routing', () => {
    it('routes HIGH priority to SMS (Requirement 14.3)', async () => {
      setupDbForSend(NotificationPriority.HIGH);
      mockSMS.sendSMS.mockResolvedValue({ recipients: [], message: 'ok' });

      const input: SendNotificationInput = {
        userId: 'user-1',
        type: NotificationType.PAYMENT_APPROVAL,
        priority: NotificationPriority.HIGH,
        title: 'Payment Approval',
        message: 'Please approve payment',
      };

      await service.sendNotification(input);

      expect(mockSMS.sendSMS).toHaveBeenCalledTimes(1);
      expect(mockEmail.sendEmail).not.toHaveBeenCalled();
      expect(mockPush.sendPushNotification).not.toHaveBeenCalled();
    });

    it('routes MEDIUM priority to Email (Requirement 14.4)', async () => {
      setupDbForSend(NotificationPriority.MEDIUM);
      mockEmail.sendEmail.mockResolvedValue(undefined);

      const input: SendNotificationInput = {
        userId: 'user-1',
        type: NotificationType.LEAD_CONVERTED,
        priority: NotificationPriority.MEDIUM,
        title: 'Lead Converted',
        message: 'Your lead has been converted',
      };

      await service.sendNotification(input);

      expect(mockEmail.sendEmail).toHaveBeenCalledTimes(1);
      expect(mockSMS.sendSMS).not.toHaveBeenCalled();
      expect(mockPush.sendPushNotification).not.toHaveBeenCalled();
    });

    it('routes LOW priority to Push (Requirement 14.5)', async () => {
      setupDbForSend(NotificationPriority.LOW);
      mockPush.sendPushNotification.mockResolvedValue('msg-id');

      const input: SendNotificationInput = {
        userId: 'user-1',
        type: NotificationType.MESSAGE_RECEIVED,
        priority: NotificationPriority.LOW,
        title: 'New Message',
        message: 'You have a new message',
      };

      await service.sendNotification(input);

      expect(mockPush.sendPushNotification).toHaveBeenCalledTimes(1);
      expect(mockSMS.sendSMS).not.toHaveBeenCalled();
      expect(mockEmail.sendEmail).not.toHaveBeenCalled();
    });
  });

  // ── Delivery status tracking ────────────────────────────────────────────────

  describe('delivery status tracking (Requirement 14.7)', () => {
    it('stores PENDING status before delivery attempt', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [FAKE_NOTIFICATION_ROW], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [{ email: FAKE_USER.email, phone: FAKE_USER.phone, full_name: FAKE_USER.fullName }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [FAKE_NOTIFICATION_ROW], rowCount: 1 } as any);

      mockSMS.sendSMS.mockResolvedValue({ recipients: [], message: 'ok' });

      await service.sendNotification({
        userId: 'user-1',
        type: NotificationType.PAYMENT_APPROVAL,
        priority: NotificationPriority.HIGH,
        title: 'Test',
        message: 'Test',
      });

      // First db.query call is the INSERT with delivery_status containing PENDING
      const insertCall = mockDb.query.mock.calls[0];
      const deliveryStatusArg = JSON.parse((insertCall[1] as any[])[6]);
      expect(deliveryStatusArg[DeliveryChannel.SMS].status).toBe('PENDING');
    });

    it('updates delivery status to SENT after successful delivery', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [FAKE_NOTIFICATION_ROW], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [{ email: FAKE_USER.email, phone: FAKE_USER.phone, full_name: FAKE_USER.fullName }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [FAKE_NOTIFICATION_ROW], rowCount: 1 } as any);

      mockSMS.sendSMS.mockResolvedValue({ recipients: [], message: 'ok' });

      await service.sendNotification({
        userId: 'user-1',
        type: NotificationType.PAYMENT_APPROVAL,
        priority: NotificationPriority.HIGH,
        title: 'Test',
        message: 'Test',
      });

      // Third call is the UPDATE for delivery status
      const updateCall = mockDb.query.mock.calls[2];
      const updatedStatus = JSON.parse((updateCall[1] as any[])[0]);
      expect(updatedStatus[DeliveryChannel.SMS].status).toBe('SENT');
      expect(updatedStatus[DeliveryChannel.SMS].attempts).toBe(1);
    });
  });

  // ── Retry logic ─────────────────────────────────────────────────────────────

  describe('retry logic (Requirement 14.8)', () => {
    it('retries up to maxRetries times on failure then gives up', async () => {
      // INSERT + getUserById + 3x updateDeliveryStatus (failed) + getById
      mockDb.query
        .mockResolvedValueOnce({ rows: [FAKE_NOTIFICATION_ROW], rowCount: 1 } as any) // INSERT
        .mockResolvedValueOnce({ rows: [{ email: FAKE_USER.email, phone: FAKE_USER.phone, full_name: FAKE_USER.fullName }], rowCount: 1 } as any) // getUserById
        .mockResolvedValue({ rows: [FAKE_NOTIFICATION_ROW], rowCount: 1 } as any); // updateDeliveryStatus + getById

      mockSMS.sendSMS.mockRejectedValue(new Error('SMS gateway error'));

      await service.sendNotification({
        userId: 'user-1',
        type: NotificationType.PAYMENT_APPROVAL,
        priority: NotificationPriority.HIGH,
        title: 'Test',
        message: 'Test',
      });

      // Should have attempted 3 times (maxRetries = 3)
      expect(mockSMS.sendSMS).toHaveBeenCalledTimes(3);
    });
  });

  // ── getNotifications ────────────────────────────────────────────────────────

  describe('getNotifications', () => {
    it('returns paginated notifications for a user', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [FAKE_NOTIFICATION_ROW], rowCount: 1 } as any);

      const result = await service.getNotifications('user-1', { limit: 10, offset: 0 });

      expect(result.total).toBe(5);
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].userId).toBe('user-1');
    });

    it('filters by read status', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await service.getNotifications('user-1', { read: false });

      const countQuery = mockDb.query.mock.calls[0][0] as string;
      expect(countQuery).toContain('n.read = $');
    });
  });

  // ── markAsRead ──────────────────────────────────────────────────────────────

  describe('markAsRead (Requirement 14.12)', () => {
    it('marks notification as read and returns updated record', async () => {
      const readRow = { ...FAKE_NOTIFICATION_ROW, read: true, read_at: new Date() };
      mockDb.query.mockResolvedValueOnce({ rows: [readRow], rowCount: 1 } as any);

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(result.read).toBe(true);
      expect(result.readAt).toBeDefined();
    });

    it('throws when notification not found or belongs to another user', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await expect(service.markAsRead('notif-x', 'user-1')).rejects.toThrow(
        'Notification not found or access denied'
      );
    });
  });

  // ── getUnreadCount ──────────────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('returns the number of unread notifications', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '7' }], rowCount: 1 } as any);

      const count = await service.getUnreadCount('user-1');
      expect(count).toBe(7);
    });
  });

  // ── sendSMS / sendEmail / sendPushNotification ──────────────────────────────

  describe('sendSMS', () => {
    it('sends SMS to user phone number', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ email: FAKE_USER.email, phone: '0712345678', full_name: FAKE_USER.fullName }],
        rowCount: 1,
      } as any);
      mockSMS.sendSMS.mockResolvedValue({ recipients: [], message: 'ok' });

      await service.sendSMS('user-1', 'Hello!');

      expect(mockSMS.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Hello!' })
      );
    });

    it('throws when user has no phone', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ email: FAKE_USER.email, phone: null, full_name: FAKE_USER.fullName }],
        rowCount: 1,
      } as any);

      await expect(service.sendSMS('user-1', 'Hello!')).rejects.toThrow('no phone number');
    });
  });

  describe('sendEmail', () => {
    it('sends email to user email address', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ email: 'user@test.com', phone: '0712345678', full_name: FAKE_USER.fullName }],
        rowCount: 1,
      } as any);
      mockEmail.sendEmail.mockResolvedValue(undefined);

      await service.sendEmail('user-1', 'Subject', '<p>Body</p>');

      expect(mockEmail.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@test.com', subject: 'Subject' })
      );
    });
  });

  describe('sendPushNotification', () => {
    it('sends push notification using FCM token', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ token: 'fcm-token-xyz' }],
        rowCount: 1,
      } as any);
      mockPush.sendPushNotification.mockResolvedValue('msg-id');

      await service.sendPushNotification('user-1', 'Title', 'Body', { key: 'val' });

      expect(mockPush.sendPushNotification).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'fcm-token-xyz', title: 'Title', body: 'Body' })
      );
    });

    it('throws when no FCM token is found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await expect(service.sendPushNotification('user-1', 'T', 'B')).rejects.toThrow(
        'No FCM token'
      );
    });
  });
});
