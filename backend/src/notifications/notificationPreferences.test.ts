/**
 * Tests for NotificationPreferencesService
 * Requirements: 14.6, 14.12
 */

import {
  NotificationPreferencesService,
  DEFAULT_CHANNELS,
} from './notificationPreferences';
import { NotificationType, DeliveryChannel } from './notificationService';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../database/connection', () => ({
  db: { query: jest.fn() },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../config', () => ({
  config: {
    notifications: { retryAttempts: 3, retryDelayMs: 10, batchIntervalHours: 4 },
  },
}));

// Stub external service clients so they don't trigger config validation
jest.mock('../services/africas-talking/client', () => ({
  africasTalkingClient: { sendSMS: jest.fn(), formatPhoneNumber: jest.fn() },
}));
jest.mock('../services/sendgrid/client', () => ({
  sendgridClient: { sendEmail: jest.fn() },
}));
jest.mock('../services/firebase/client', () => ({
  firebaseClient: { sendPushNotification: jest.fn() },
}));

import { db } from '../database/connection';
const mockDb = db as jest.Mocked<typeof db>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-abc';

function makeRow(
  type: NotificationType,
  enabled = true,
  channels: DeliveryChannel[] = []
) {
  return {
    user_id: USER_ID,
    notification_type: type,
    enabled,
    channels: JSON.stringify(channels),
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationPreferencesService();
  });

  // ── getPreferences ──────────────────────────────────────────────────────────

  describe('getPreferences', () => {
    it('returns defaults for all types when no preferences are stored', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const prefs = await service.getPreferences(USER_ID);

      expect(prefs).toHaveLength(Object.values(NotificationType).length);
      prefs.forEach((p) => {
        expect(p.enabled).toBe(true);
        expect(p.channels).toEqual(DEFAULT_CHANNELS[p.notificationType]);
      });
    });

    it('merges stored preferences with defaults for missing types', async () => {
      const storedRow = makeRow(NotificationType.PAYMENT_APPROVAL, false, [DeliveryChannel.EMAIL]);
      mockDb.query.mockResolvedValueOnce({ rows: [storedRow], rowCount: 1 } as any);

      const prefs = await service.getPreferences(USER_ID);

      const paymentApproval = prefs.find(
        (p) => p.notificationType === NotificationType.PAYMENT_APPROVAL
      )!;
      expect(paymentApproval.enabled).toBe(false);
      expect(paymentApproval.channels).toEqual([DeliveryChannel.EMAIL]);

      // All other types should be defaults
      const others = prefs.filter(
        (p) => p.notificationType !== NotificationType.PAYMENT_APPROVAL
      );
      others.forEach((p) => expect(p.enabled).toBe(true));
    });
  });

  // ── updatePreference ────────────────────────────────────────────────────────

  describe('updatePreference', () => {
    it('upserts a preference and returns the updated record', async () => {
      const row = makeRow(NotificationType.LEAD_CONVERTED, false, [DeliveryChannel.SMS]);
      mockDb.query.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);

      const pref = await service.updatePreference(
        USER_ID,
        NotificationType.LEAD_CONVERTED,
        false,
        [DeliveryChannel.SMS]
      );

      expect(pref.enabled).toBe(false);
      expect(pref.channels).toEqual([DeliveryChannel.SMS]);
      expect(pref.notificationType).toBe(NotificationType.LEAD_CONVERTED);
    });

    it('uses default channels when channels param is omitted', async () => {
      const row = makeRow(NotificationType.REPORT_OVERDUE, true, []);
      mockDb.query.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);

      const pref = await service.updatePreference(
        USER_ID,
        NotificationType.REPORT_OVERDUE,
        true
      );

      // channels stored as [] → falls back to default
      expect(pref.channels).toEqual(DEFAULT_CHANNELS[NotificationType.REPORT_OVERDUE]);
    });

    it('passes correct SQL parameters to db.query', async () => {
      const row = makeRow(NotificationType.CONTRACT_GENERATED, true, [DeliveryChannel.EMAIL]);
      mockDb.query.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);

      await service.updatePreference(
        USER_ID,
        NotificationType.CONTRACT_GENERATED,
        true,
        [DeliveryChannel.EMAIL]
      );

      const [, params] = mockDb.query.mock.calls[0] as [string, any[]];
      expect(params[0]).toBe(USER_ID);
      expect(params[1]).toBe(NotificationType.CONTRACT_GENERATED);
      expect(params[2]).toBe(true);
      expect(JSON.parse(params[3])).toEqual([DeliveryChannel.EMAIL]);
    });
  });

  // ── resetPreferences ────────────────────────────────────────────────────────

  describe('resetPreferences', () => {
    it('deletes all stored preferences for the user', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 3 } as any);

      await service.resetPreferences(USER_ID);

      const [sql, params] = mockDb.query.mock.calls[0] as [string, any[]];
      expect(sql).toContain('DELETE FROM user_notification_preferences');
      expect(params[0]).toBe(USER_ID);
    });
  });

  // ── isNotificationEnabled ───────────────────────────────────────────────────

  describe('isNotificationEnabled', () => {
    it('returns true when no preference is stored (default)', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const enabled = await service.isNotificationEnabled(
        USER_ID,
        NotificationType.MESSAGE_RECEIVED
      );

      expect(enabled).toBe(true);
    });

    it('returns stored enabled value when preference exists', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ enabled: false }],
        rowCount: 1,
      } as any);

      const enabled = await service.isNotificationEnabled(
        USER_ID,
        NotificationType.PAYMENT_APPROVAL
      );

      expect(enabled).toBe(false);
    });

    it('returns true when preference is explicitly enabled', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ enabled: true }],
        rowCount: 1,
      } as any);

      const enabled = await service.isNotificationEnabled(
        USER_ID,
        NotificationType.TASK_ASSIGNED
      );

      expect(enabled).toBe(true);
    });
  });

  // ── getEnabledChannels ──────────────────────────────────────────────────────

  describe('getEnabledChannels', () => {
    it('returns default channels when no preference is stored', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const channels = await service.getEnabledChannels(
        USER_ID,
        NotificationType.PAYMENT_APPROVAL
      );

      expect(channels).toEqual(DEFAULT_CHANNELS[NotificationType.PAYMENT_APPROVAL]);
    });

    it('returns stored channels when preference has explicit channels', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ channels: JSON.stringify([DeliveryChannel.EMAIL, DeliveryChannel.PUSH]) }],
        rowCount: 1,
      } as any);

      const channels = await service.getEnabledChannels(
        USER_ID,
        NotificationType.LEAD_CONVERTED
      );

      expect(channels).toEqual([DeliveryChannel.EMAIL, DeliveryChannel.PUSH]);
    });

    it('falls back to defaults when stored channels array is empty', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ channels: JSON.stringify([]) }],
        rowCount: 1,
      } as any);

      const channels = await service.getEnabledChannels(
        USER_ID,
        NotificationType.REPORT_OVERDUE
      );

      expect(channels).toEqual(DEFAULT_CHANNELS[NotificationType.REPORT_OVERDUE]);
    });
  });

  // ── DEFAULT_CHANNELS coverage ───────────────────────────────────────────────

  describe('DEFAULT_CHANNELS', () => {
    it('has an entry for every NotificationType', () => {
      Object.values(NotificationType).forEach((type) => {
        expect(DEFAULT_CHANNELS[type]).toBeDefined();
        expect(DEFAULT_CHANNELS[type].length).toBeGreaterThan(0);
      });
    });
  });
});
