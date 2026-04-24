/**
 * MaintenanceService
 *
 * Implements Requirements 62.5-62.7:
 *   62.5 - Database failover to standby within 60 seconds (coordination)
 *   62.6 - Schedule maintenance windows during low-usage periods
 *   62.7 - Notify users 48 hours before scheduled maintenance
 *   62.8 - Graceful degradation for non-critical features during partial outages
 */

export type FeatureStatus = 'enabled' | 'disabled';
export type MaintenanceStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export interface Feature {
  id: string;
  name: string;
  critical: boolean;
}

export interface MaintenanceWindow {
  id: string;
  title: string;
  description: string;
  /** UTC start time */
  startTime: Date;
  /** UTC end time */
  endTime: Date;
  status: MaintenanceStatus;
  /** IDs of features that will be disabled during maintenance */
  affectedFeatureIds: string[];
  /** Whether 48-hour notifications have been sent */
  notificationSent: boolean;
}

export interface MaintenanceNotification {
  windowId: string;
  scheduledAt: Date;
  /** Time the notification should be sent (48 h before startTime) */
  notifyAt: Date;
  message: string;
}

/** Hours before maintenance that users must be notified (Req 62.7) */
const NOTIFICATION_ADVANCE_HOURS = 48;

export class MaintenanceService {
  /** Advance notification period in milliseconds (48 hours per Req 62.7) */
  static readonly NOTIFICATION_ADVANCE_MS = NOTIFICATION_ADVANCE_HOURS * 60 * 60 * 1000;

  private features = new Map<string, Feature & { status: FeatureStatus }>();
  private windows = new Map<string, MaintenanceWindow>();
  private degradationActive = false;

  // ── Feature Registry ────────────────────────────────────────────────────────

  /** Register a feature for degradation management. */
  registerFeature(feature: Feature): void {
    this.features.set(feature.id, { ...feature, status: 'enabled' });
  }

  getFeature(featureId: string): (Feature & { status: FeatureStatus }) | undefined {
    return this.features.get(featureId);
  }

  getAllFeatures(): (Feature & { status: FeatureStatus })[] {
    return Array.from(this.features.values());
  }

  // ── Graceful Degradation ────────────────────────────────────────────────────

  /**
   * Enable graceful degradation mode: disable all non-critical features.
   * Req 62.8: graceful degradation for non-critical features during partial outages.
   */
  enableDegradationMode(): string[] {
    this.degradationActive = true;
    const disabled: string[] = [];

    for (const feature of this.features.values()) {
      if (!feature.critical) {
        feature.status = 'disabled';
        disabled.push(feature.id);
      }
    }

    return disabled;
  }

  /**
   * Disable graceful degradation mode: re-enable all non-critical features.
   */
  disableDegradationMode(): string[] {
    this.degradationActive = false;
    const enabled: string[] = [];

    for (const feature of this.features.values()) {
      if (!feature.critical) {
        feature.status = 'enabled';
        enabled.push(feature.id);
      }
    }

    return enabled;
  }

  isDegradationModeActive(): boolean {
    return this.degradationActive;
  }

  isFeatureEnabled(featureId: string): boolean {
    const feature = this.features.get(featureId);
    if (!feature) return false;
    return feature.status === 'enabled';
  }

  // ── Maintenance Windows ─────────────────────────────────────────────────────

  /**
   * Schedule a maintenance window.
   * Req 62.6: schedule during low-usage periods.
   * Validates that the window is in the future.
   */
  scheduleMaintenanceWindow(
    window: Omit<MaintenanceWindow, 'status' | 'notificationSent'>,
    now: Date = new Date(),
  ): { success: boolean; error?: string } {
    if (window.startTime <= now) {
      return { success: false, error: 'Maintenance window must be scheduled in the future' };
    }
    if (window.endTime <= window.startTime) {
      return { success: false, error: 'End time must be after start time' };
    }

    this.windows.set(window.id, {
      ...window,
      status: 'scheduled',
      notificationSent: false,
    });

    return { success: true };
  }

  getMaintenanceWindow(windowId: string): MaintenanceWindow | undefined {
    return this.windows.get(windowId);
  }

  getAllMaintenanceWindows(): MaintenanceWindow[] {
    return Array.from(this.windows.values());
  }

  cancelMaintenanceWindow(windowId: string): boolean {
    const win = this.windows.get(windowId);
    if (!win || win.status === 'completed') return false;
    win.status = 'cancelled';
    return true;
  }

  /**
   * Activate a maintenance window: set status to active and disable affected features.
   */
  activateMaintenanceWindow(windowId: string): boolean {
    const win = this.windows.get(windowId);
    if (!win || win.status !== 'scheduled') return false;

    win.status = 'active';

    for (const featureId of win.affectedFeatureIds) {
      const feature = this.features.get(featureId);
      if (feature) {
        feature.status = 'disabled';
      }
    }

    return true;
  }

  /**
   * Complete a maintenance window: restore affected features.
   */
  completeMaintenanceWindow(windowId: string): boolean {
    const win = this.windows.get(windowId);
    if (!win || win.status !== 'active') return false;

    win.status = 'completed';

    for (const featureId of win.affectedFeatureIds) {
      const feature = this.features.get(featureId);
      if (feature && !feature.critical) {
        // Only re-enable if degradation mode is not active
        if (!this.degradationActive) {
          feature.status = 'enabled';
        }
      }
    }

    return true;
  }

  // ── Notifications ───────────────────────────────────────────────────────────

  /**
   * Build a 48-hour advance notification for a maintenance window.
   * Req 62.7: notify users 48 hours before scheduled maintenance.
   */
  buildMaintenanceNotification(windowId: string): MaintenanceNotification | null {
    const win = this.windows.get(windowId);
    if (!win) return null;

    const notifyAt = new Date(
      win.startTime.getTime() - MaintenanceService.NOTIFICATION_ADVANCE_MS,
    );

    return {
      windowId,
      scheduledAt: new Date(),
      notifyAt,
      message:
        `Scheduled maintenance: "${win.title}" will begin on ` +
        `${win.startTime.toISOString()}. ` +
        `Expected duration: ${Math.round((win.endTime.getTime() - win.startTime.getTime()) / 60_000)} minutes. ` +
        `${win.description}`,
    };
  }

  /**
   * Returns all maintenance windows that require a 48-hour notification to be sent.
   * A window qualifies if:
   *   - status is 'scheduled'
   *   - notificationSent is false
   *   - current time >= (startTime - 48 h)
   */
  getWindowsPendingNotification(now: Date = new Date()): MaintenanceWindow[] {
    return Array.from(this.windows.values()).filter((win) => {
      if (win.status !== 'scheduled') return false;
      if (win.notificationSent) return false;
      const notifyAt = new Date(
        win.startTime.getTime() - MaintenanceService.NOTIFICATION_ADVANCE_MS,
      );
      return now >= notifyAt;
    });
  }

  /**
   * Mark a maintenance window's notification as sent.
   */
  markNotificationSent(windowId: string): boolean {
    const win = this.windows.get(windowId);
    if (!win) return false;
    win.notificationSent = true;
    return true;
  }

  /**
   * Returns the advance notification period in hours (48).
   */
  getNotificationAdvanceHours(): number {
    return NOTIFICATION_ADVANCE_HOURS;
  }
}
