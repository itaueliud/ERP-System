import { MaintenanceService, Feature, MaintenanceWindow } from './maintenanceService';

const makeFeature = (id: string, critical = false): Feature => ({
  id,
  name: `Feature-${id}`,
  critical,
});

const futureWindow = (
  id: string,
  hoursFromNow = 72,
  durationHours = 2,
  affectedFeatureIds: string[] = [],
): Omit<MaintenanceWindow, 'status' | 'notificationSent'> => {
  const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
  return {
    id,
    title: `Maintenance ${id}`,
    description: 'Scheduled maintenance',
    startTime: start,
    endTime: end,
    affectedFeatureIds,
  };
};

describe('MaintenanceService', () => {
  let service: MaintenanceService;

  beforeEach(() => {
    service = new MaintenanceService();
  });

  // ── Constants ────────────────────────────────────────────────────────────────

  describe('constants', () => {
    it('notification advance is 48 hours', () => {
      expect(MaintenanceService.NOTIFICATION_ADVANCE_MS).toBe(48 * 60 * 60 * 1000);
    });

    it('getNotificationAdvanceHours returns 48', () => {
      expect(service.getNotificationAdvanceHours()).toBe(48);
    });
  });

  // ── Feature Registry ─────────────────────────────────────────────────────────

  describe('registerFeature', () => {
    it('registers a feature as enabled', () => {
      service.registerFeature(makeFeature('chat'));
      expect(service.isFeatureEnabled('chat')).toBe(true);
    });

    it('returns undefined for unknown feature', () => {
      expect(service.getFeature('ghost')).toBeUndefined();
    });

    it('getAllFeatures returns all registered features', () => {
      service.registerFeature(makeFeature('chat'));
      service.registerFeature(makeFeature('reports'));
      expect(service.getAllFeatures()).toHaveLength(2);
    });
  });

  // ── Graceful Degradation ─────────────────────────────────────────────────────

  describe('graceful degradation (Req 62.8)', () => {
    beforeEach(() => {
      service.registerFeature(makeFeature('auth', true));       // critical
      service.registerFeature(makeFeature('payments', true));   // critical
      service.registerFeature(makeFeature('chat', false));      // non-critical
      service.registerFeature(makeFeature('reports', false));   // non-critical
    });

    it('enableDegradationMode disables non-critical features', () => {
      service.enableDegradationMode();
      expect(service.isFeatureEnabled('chat')).toBe(false);
      expect(service.isFeatureEnabled('reports')).toBe(false);
    });

    it('enableDegradationMode keeps critical features enabled', () => {
      service.enableDegradationMode();
      expect(service.isFeatureEnabled('auth')).toBe(true);
      expect(service.isFeatureEnabled('payments')).toBe(true);
    });

    it('enableDegradationMode returns list of disabled feature IDs', () => {
      const disabled = service.enableDegradationMode();
      expect(disabled).toContain('chat');
      expect(disabled).toContain('reports');
      expect(disabled).not.toContain('auth');
    });

    it('isDegradationModeActive returns true after enabling', () => {
      service.enableDegradationMode();
      expect(service.isDegradationModeActive()).toBe(true);
    });

    it('disableDegradationMode re-enables non-critical features', () => {
      service.enableDegradationMode();
      service.disableDegradationMode();
      expect(service.isFeatureEnabled('chat')).toBe(true);
      expect(service.isFeatureEnabled('reports')).toBe(true);
    });

    it('disableDegradationMode returns list of re-enabled feature IDs', () => {
      service.enableDegradationMode();
      const enabled = service.disableDegradationMode();
      expect(enabled).toContain('chat');
      expect(enabled).toContain('reports');
    });

    it('isDegradationModeActive returns false after disabling', () => {
      service.enableDegradationMode();
      service.disableDegradationMode();
      expect(service.isDegradationModeActive()).toBe(false);
    });

    it('isFeatureEnabled returns false for unknown feature', () => {
      expect(service.isFeatureEnabled('ghost')).toBe(false);
    });
  });

  // ── Maintenance Windows ──────────────────────────────────────────────────────

  describe('scheduleMaintenanceWindow (Req 62.6)', () => {
    it('schedules a future maintenance window', () => {
      const result = service.scheduleMaintenanceWindow(futureWindow('w1'));
      expect(result.success).toBe(true);
      expect(service.getMaintenanceWindow('w1')?.status).toBe('scheduled');
    });

    it('rejects window with start time in the past', () => {
      const past = new Date(Date.now() - 1000);
      const end = new Date(Date.now() + 3600_000);
      const result = service.scheduleMaintenanceWindow({
        id: 'w-past',
        title: 'Past',
        description: '',
        startTime: past,
        endTime: end,
        affectedFeatureIds: [],
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('rejects window where end time is before start time', () => {
      const start = new Date(Date.now() + 3600_000);
      const end = new Date(Date.now() + 1800_000);
      const result = service.scheduleMaintenanceWindow({
        id: 'w-bad',
        title: 'Bad',
        description: '',
        startTime: start,
        endTime: end,
        affectedFeatureIds: [],
      });
      expect(result.success).toBe(false);
    });

    it('getAllMaintenanceWindows returns all windows', () => {
      service.scheduleMaintenanceWindow(futureWindow('w1'));
      service.scheduleMaintenanceWindow(futureWindow('w2'));
      expect(service.getAllMaintenanceWindows()).toHaveLength(2);
    });
  });

  describe('cancelMaintenanceWindow', () => {
    it('cancels a scheduled window', () => {
      service.scheduleMaintenanceWindow(futureWindow('w1'));
      expect(service.cancelMaintenanceWindow('w1')).toBe(true);
      expect(service.getMaintenanceWindow('w1')?.status).toBe('cancelled');
    });

    it('returns false for unknown window', () => {
      expect(service.cancelMaintenanceWindow('ghost')).toBe(false);
    });
  });

  describe('activateMaintenanceWindow', () => {
    it('activates a scheduled window and disables affected features', () => {
      service.registerFeature(makeFeature('chat', false));
      service.scheduleMaintenanceWindow(futureWindow('w1', 72, 2, ['chat']));
      service.activateMaintenanceWindow('w1');
      expect(service.getMaintenanceWindow('w1')?.status).toBe('active');
      expect(service.isFeatureEnabled('chat')).toBe(false);
    });

    it('returns false for non-scheduled window', () => {
      service.scheduleMaintenanceWindow(futureWindow('w1'));
      service.cancelMaintenanceWindow('w1');
      expect(service.activateMaintenanceWindow('w1')).toBe(false);
    });
  });

  describe('completeMaintenanceWindow', () => {
    it('completes an active window and re-enables affected features', () => {
      service.registerFeature(makeFeature('chat', false));
      service.scheduleMaintenanceWindow(futureWindow('w1', 72, 2, ['chat']));
      service.activateMaintenanceWindow('w1');
      service.completeMaintenanceWindow('w1');
      expect(service.getMaintenanceWindow('w1')?.status).toBe('completed');
      expect(service.isFeatureEnabled('chat')).toBe(true);
    });

    it('returns false for non-active window', () => {
      service.scheduleMaintenanceWindow(futureWindow('w1'));
      expect(service.completeMaintenanceWindow('w1')).toBe(false);
    });

    it('does not re-enable features when degradation mode is active', () => {
      service.registerFeature(makeFeature('chat', false));
      service.scheduleMaintenanceWindow(futureWindow('w1', 72, 2, ['chat']));
      service.enableDegradationMode();
      service.activateMaintenanceWindow('w1');
      service.completeMaintenanceWindow('w1');
      // Degradation mode still active → chat stays disabled
      expect(service.isFeatureEnabled('chat')).toBe(false);
    });
  });

  // ── Notifications ────────────────────────────────────────────────────────────

  describe('buildMaintenanceNotification (Req 62.7)', () => {
    it('builds notification with correct notifyAt (48 h before start)', () => {
      service.scheduleMaintenanceWindow(futureWindow('w1', 72));
      const win = service.getMaintenanceWindow('w1')!;
      const notification = service.buildMaintenanceNotification('w1');
      expect(notification).not.toBeNull();
      const expectedNotifyAt = new Date(
        win.startTime.getTime() - 48 * 60 * 60 * 1000,
      );
      expect(notification!.notifyAt.getTime()).toBe(expectedNotifyAt.getTime());
    });

    it('notification message includes window title', () => {
      service.scheduleMaintenanceWindow(futureWindow('w1', 72));
      const notification = service.buildMaintenanceNotification('w1');
      expect(notification!.message).toContain('Maintenance w1');
    });

    it('returns null for unknown window', () => {
      expect(service.buildMaintenanceNotification('ghost')).toBeNull();
    });
  });

  describe('getWindowsPendingNotification (Req 62.7)', () => {
    it('returns windows where notification time has passed', () => {
      // Window starting in 47 hours → notification was due 1 hour ago
      service.scheduleMaintenanceWindow(futureWindow('w1', 47));
      const pending = service.getWindowsPendingNotification(new Date());
      expect(pending.some((w) => w.id === 'w1')).toBe(true);
    });

    it('does not return windows where notification time has not passed', () => {
      // Window starting in 100 hours → notification not due yet
      service.scheduleMaintenanceWindow(futureWindow('w2', 100));
      const pending = service.getWindowsPendingNotification(new Date());
      expect(pending.some((w) => w.id === 'w2')).toBe(false);
    });

    it('does not return windows with notification already sent', () => {
      service.scheduleMaintenanceWindow(futureWindow('w1', 47));
      service.markNotificationSent('w1');
      const pending = service.getWindowsPendingNotification(new Date());
      expect(pending.some((w) => w.id === 'w1')).toBe(false);
    });

    it('does not return cancelled windows', () => {
      service.scheduleMaintenanceWindow(futureWindow('w1', 47));
      service.cancelMaintenanceWindow('w1');
      const pending = service.getWindowsPendingNotification(new Date());
      expect(pending.some((w) => w.id === 'w1')).toBe(false);
    });
  });

  describe('markNotificationSent', () => {
    it('marks window notification as sent', () => {
      service.scheduleMaintenanceWindow(futureWindow('w1'));
      service.markNotificationSent('w1');
      expect(service.getMaintenanceWindow('w1')?.notificationSent).toBe(true);
    });

    it('returns false for unknown window', () => {
      expect(service.markNotificationSent('ghost')).toBe(false);
    });
  });
});
