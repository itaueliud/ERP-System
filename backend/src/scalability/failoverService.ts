/**
 * FailoverService
 *
 * Implements Requirements 62.2-62.4:
 *   62.2 - Redundancy for critical components
 *   62.3 - Automated health checks every 60 seconds
 *   62.4 - Auto-restart failed components; database failover within 60 seconds
 */

export type ComponentStatus = 'healthy' | 'degraded' | 'failed' | 'restarting';

export interface ComponentConfig {
  id: string;
  name: string;
  critical: boolean;
  /** Maximum restart attempts before giving up */
  maxRestartAttempts: number;
}

export interface ComponentState {
  config: ComponentConfig;
  status: ComponentStatus;
  restartAttempts: number;
  lastHealthCheck: Date | null;
  lastRestart: Date | null;
  redundantInstanceIds: string[];
}

export interface FailoverEvent {
  type: 'health_check' | 'component_failed' | 'component_restarted' | 'db_failover';
  componentId: string;
  timestamp: Date;
  details: string;
}

export interface DatabaseFailoverResult {
  success: boolean;
  /** Elapsed time in milliseconds */
  elapsedMs: number;
  promotedNodeId: string | null;
  withinTimeout: boolean;
}

export class FailoverService {
  /** Health check interval in ms (60 seconds per Req 62.3) */
  static readonly HEALTH_CHECK_INTERVAL_MS = 60_000;
  /** Database failover timeout in ms (60 seconds per Req 62.4/62.5) */
  static readonly DB_FAILOVER_TIMEOUT_MS = 60_000;

  private components = new Map<string, ComponentState>();
  private events: FailoverEvent[] = [];

  // ── Component Registration ──────────────────────────────────────────────────

  /**
   * Register a component for redundancy tracking.
   * Req 62.2: redundancy for critical components.
   */
  registerComponent(config: ComponentConfig): void {
    this.components.set(config.id, {
      config,
      status: 'healthy',
      restartAttempts: 0,
      lastHealthCheck: null,
      lastRestart: null,
      redundantInstanceIds: [],
    });
  }

  /**
   * Add a redundant instance ID to a component.
   * Req 62.2: critical components must have redundant instances.
   */
  addRedundantInstance(componentId: string, instanceId: string): boolean {
    const state = this.components.get(componentId);
    if (!state) return false;
    if (!state.redundantInstanceIds.includes(instanceId)) {
      state.redundantInstanceIds.push(instanceId);
    }
    return true;
  }

  /**
   * Returns true if a critical component has at least one redundant instance.
   * Req 62.2.
   */
  hasRedundancy(componentId: string): boolean {
    const state = this.components.get(componentId);
    if (!state) return false;
    if (!state.config.critical) return true; // non-critical: no requirement
    return state.redundantInstanceIds.length > 0;
  }

  getComponent(componentId: string): ComponentState | undefined {
    return this.components.get(componentId);
  }

  getAllComponents(): ComponentState[] {
    return Array.from(this.components.values());
  }

  // ── Health Checks ───────────────────────────────────────────────────────────

  /**
   * Run a health check for a component.
   * Req 62.3: automated health checks every 60 seconds.
   * Req 62.4: auto-restart failed components.
   *
   * @param componentId  The component to check.
   * @param checkFn      Async function returning true = healthy, false/throw = failed.
   * @param restartFn    Optional async function to restart the component.
   */
  async runHealthCheck(
    componentId: string,
    checkFn: () => Promise<boolean>,
    restartFn?: () => Promise<void>,
  ): Promise<{ status: ComponentStatus; restarted: boolean }> {
    const state = this.components.get(componentId);
    if (!state) {
      throw new Error(`Component '${componentId}' is not registered`);
    }

    state.lastHealthCheck = new Date();
    let healthy = false;

    try {
      healthy = await checkFn();
    } catch {
      healthy = false;
    }

    this.recordEvent({
      type: 'health_check',
      componentId,
      timestamp: new Date(),
      details: healthy ? 'passed' : 'failed',
    });

    if (healthy) {
      state.status = 'healthy';
      state.restartAttempts = 0;
      return { status: 'healthy', restarted: false };
    }

    // Component failed
    state.status = 'failed';
    this.recordEvent({
      type: 'component_failed',
      componentId,
      timestamp: new Date(),
      details: `Component ${state.config.name} failed health check`,
    });

    // Auto-restart if within attempt limit (Req 62.4)
    if (restartFn && state.restartAttempts < state.config.maxRestartAttempts) {
      state.status = 'restarting';
      state.restartAttempts += 1;
      state.lastRestart = new Date();

      try {
        await restartFn();
        state.status = 'healthy';
        this.recordEvent({
          type: 'component_restarted',
          componentId,
          timestamp: new Date(),
          details: `Component ${state.config.name} restarted successfully (attempt ${state.restartAttempts})`,
        });
        return { status: 'healthy', restarted: true };
      } catch {
        state.status = 'failed';
        return { status: 'failed', restarted: false };
      }
    }

    return { status: state.status, restarted: false };
  }

  // ── Database Failover ───────────────────────────────────────────────────────

  /**
   * Perform database failover to a standby instance.
   * Req 62.4/62.5: failover must complete within 60 seconds.
   *
   * @param failoverFn  Async function that performs the actual failover and returns the promoted node ID.
   */
  async performDatabaseFailover(
    failoverFn: () => Promise<string>,
  ): Promise<DatabaseFailoverResult> {
    const start = Date.now();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Database failover timed out')),
        FailoverService.DB_FAILOVER_TIMEOUT_MS,
      ),
    );

    try {
      const promotedNodeId = await Promise.race([failoverFn(), timeoutPromise]);
      const elapsedMs = Date.now() - start;

      this.recordEvent({
        type: 'db_failover',
        componentId: 'database',
        timestamp: new Date(),
        details: `Failover completed in ${elapsedMs}ms, promoted node: ${promotedNodeId}`,
      });

      return {
        success: true,
        elapsedMs,
        promotedNodeId,
        withinTimeout: elapsedMs <= FailoverService.DB_FAILOVER_TIMEOUT_MS,
      };
    } catch (err) {
      const elapsedMs = Date.now() - start;
      const timedOut = err instanceof Error && err.message.includes('timed out');

      this.recordEvent({
        type: 'db_failover',
        componentId: 'database',
        timestamp: new Date(),
        details: `Failover failed after ${elapsedMs}ms: ${err instanceof Error ? err.message : 'unknown error'}`,
      });

      return {
        success: false,
        elapsedMs,
        promotedNodeId: null,
        withinTimeout: !timedOut,
      };
    }
  }

  // ── Scheduling ──────────────────────────────────────────────────────────────

  /**
   * Returns the health check interval in milliseconds (60 000 ms).
   * Req 62.3: health checks every 60 seconds.
   */
  getHealthCheckIntervalMs(): number {
    return FailoverService.HEALTH_CHECK_INTERVAL_MS;
  }

  /**
   * Determines whether a health check is due for a component.
   * Returns true if no check has been run yet, or if the last check was
   * more than HEALTH_CHECK_INTERVAL_MS ago.
   */
  isHealthCheckDue(componentId: string, now: Date = new Date()): boolean {
    const state = this.components.get(componentId);
    if (!state) return false;
    if (!state.lastHealthCheck) return true;
    return now.getTime() - state.lastHealthCheck.getTime() >= FailoverService.HEALTH_CHECK_INTERVAL_MS;
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  getEvents(): FailoverEvent[] {
    return [...this.events];
  }

  private recordEvent(event: FailoverEvent): void {
    this.events.push(event);
  }
}
