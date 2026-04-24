import { FailoverService, ComponentConfig } from './failoverService';

const makeConfig = (
  id: string,
  critical = true,
  maxRestartAttempts = 3,
): ComponentConfig => ({ id, name: `Component-${id}`, critical, maxRestartAttempts });

describe('FailoverService', () => {
  let service: FailoverService;

  beforeEach(() => {
    service = new FailoverService();
  });

  // ── Constants ────────────────────────────────────────────────────────────────

  describe('constants', () => {
    it('health check interval is 60 seconds', () => {
      expect(FailoverService.HEALTH_CHECK_INTERVAL_MS).toBe(60_000);
    });

    it('database failover timeout is 60 seconds', () => {
      expect(FailoverService.DB_FAILOVER_TIMEOUT_MS).toBe(60_000);
    });

    it('getHealthCheckIntervalMs returns 60 000', () => {
      expect(service.getHealthCheckIntervalMs()).toBe(60_000);
    });
  });

  // ── Component Registration ───────────────────────────────────────────────────

  describe('registerComponent', () => {
    it('registers a component with healthy status', () => {
      service.registerComponent(makeConfig('api'));
      const state = service.getComponent('api');
      expect(state).toBeDefined();
      expect(state!.status).toBe('healthy');
      expect(state!.restartAttempts).toBe(0);
    });

    it('returns undefined for unknown component', () => {
      expect(service.getComponent('unknown')).toBeUndefined();
    });

    it('getAllComponents returns all registered components', () => {
      service.registerComponent(makeConfig('a'));
      service.registerComponent(makeConfig('b'));
      expect(service.getAllComponents()).toHaveLength(2);
    });
  });

  // ── Redundancy ───────────────────────────────────────────────────────────────

  describe('redundancy (Req 62.2)', () => {
    it('critical component without redundant instances has no redundancy', () => {
      service.registerComponent(makeConfig('api', true));
      expect(service.hasRedundancy('api')).toBe(false);
    });

    it('critical component with redundant instance has redundancy', () => {
      service.registerComponent(makeConfig('api', true));
      service.addRedundantInstance('api', 'api-2');
      expect(service.hasRedundancy('api')).toBe(true);
    });

    it('non-critical component always reports redundancy', () => {
      service.registerComponent(makeConfig('logs', false));
      expect(service.hasRedundancy('logs')).toBe(true);
    });

    it('addRedundantInstance returns false for unknown component', () => {
      expect(service.addRedundantInstance('ghost', 'ghost-2')).toBe(false);
    });

    it('duplicate instance IDs are not added twice', () => {
      service.registerComponent(makeConfig('api', true));
      service.addRedundantInstance('api', 'api-2');
      service.addRedundantInstance('api', 'api-2');
      expect(service.getComponent('api')!.redundantInstanceIds).toHaveLength(1);
    });
  });

  // ── Health Checks ────────────────────────────────────────────────────────────

  describe('runHealthCheck (Req 62.3)', () => {
    it('returns healthy when check passes', async () => {
      service.registerComponent(makeConfig('api'));
      const result = await service.runHealthCheck('api', async () => true);
      expect(result.status).toBe('healthy');
      expect(result.restarted).toBe(false);
    });

    it('returns failed when check fails and no restart function', async () => {
      service.registerComponent(makeConfig('api'));
      const result = await service.runHealthCheck('api', async () => false);
      expect(result.status).toBe('failed');
      expect(result.restarted).toBe(false);
    });

    it('returns failed when check throws', async () => {
      service.registerComponent(makeConfig('api'));
      const result = await service.runHealthCheck('api', async () => {
        throw new Error('timeout');
      });
      expect(result.status).toBe('failed');
    });

    it('updates lastHealthCheck timestamp', async () => {
      service.registerComponent(makeConfig('api'));
      await service.runHealthCheck('api', async () => true);
      expect(service.getComponent('api')!.lastHealthCheck).toBeInstanceOf(Date);
    });

    it('throws for unregistered component', async () => {
      await expect(
        service.runHealthCheck('ghost', async () => true),
      ).rejects.toThrow("Component 'ghost' is not registered");
    });
  });

  // ── Auto-Restart ─────────────────────────────────────────────────────────────

  describe('auto-restart (Req 62.4)', () => {
    it('restarts component when check fails and restart function provided', async () => {
      service.registerComponent(makeConfig('api', true, 3));
      let restarted = false;
      const result = await service.runHealthCheck(
        'api',
        async () => false,
        async () => { restarted = true; },
      );
      expect(restarted).toBe(true);
      expect(result.restarted).toBe(true);
      expect(result.status).toBe('healthy');
    });

    it('increments restart attempt counter', async () => {
      service.registerComponent(makeConfig('api', true, 3));
      await service.runHealthCheck('api', async () => false, async () => {});
      expect(service.getComponent('api')!.restartAttempts).toBe(1);
    });

    it('does not restart beyond maxRestartAttempts', async () => {
      service.registerComponent(makeConfig('api', true, 1));
      // First failure: restart allowed
      await service.runHealthCheck('api', async () => false, async () => {});
      // Second failure: no more restarts
      let restartCalled = false;
      const result = await service.runHealthCheck(
        'api',
        async () => false,
        async () => { restartCalled = true; },
      );
      expect(restartCalled).toBe(false);
      expect(result.status).toBe('failed');
    });

    it('resets restart counter after successful health check', async () => {
      service.registerComponent(makeConfig('api', true, 3));
      await service.runHealthCheck('api', async () => false, async () => {});
      expect(service.getComponent('api')!.restartAttempts).toBe(1);
      await service.runHealthCheck('api', async () => true);
      expect(service.getComponent('api')!.restartAttempts).toBe(0);
    });

    it('marks component as failed when restart function throws', async () => {
      service.registerComponent(makeConfig('api', true, 3));
      const result = await service.runHealthCheck(
        'api',
        async () => false,
        async () => { throw new Error('restart failed'); },
      );
      expect(result.status).toBe('failed');
    });
  });

  // ── Database Failover ────────────────────────────────────────────────────────

  describe('performDatabaseFailover (Req 62.4/62.5)', () => {
    it('returns success with promoted node ID', async () => {
      const result = await service.performDatabaseFailover(async () => 'standby-1');
      expect(result.success).toBe(true);
      expect(result.promotedNodeId).toBe('standby-1');
      expect(result.withinTimeout).toBe(true);
    });

    it('returns failure when failover function throws', async () => {
      const result = await service.performDatabaseFailover(async () => {
        throw new Error('no standby available');
      });
      expect(result.success).toBe(false);
      expect(result.promotedNodeId).toBeNull();
    });

    it('records elapsed time', async () => {
      const result = await service.performDatabaseFailover(async () => 'node-2');
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    });

    it('withinTimeout is true for fast failover', async () => {
      const result = await service.performDatabaseFailover(async () => 'node-2');
      expect(result.withinTimeout).toBe(true);
    });
  });

  // ── Health Check Scheduling ──────────────────────────────────────────────────

  describe('isHealthCheckDue (Req 62.3)', () => {
    it('returns true when no check has been run', () => {
      service.registerComponent(makeConfig('api'));
      expect(service.isHealthCheckDue('api')).toBe(true);
    });

    it('returns false immediately after a health check', async () => {
      service.registerComponent(makeConfig('api'));
      await service.runHealthCheck('api', async () => true);
      expect(service.isHealthCheckDue('api')).toBe(false);
    });

    it('returns true when last check was more than 60 seconds ago', async () => {
      service.registerComponent(makeConfig('api'));
      await service.runHealthCheck('api', async () => true);
      // Simulate 61 seconds later
      const future = new Date(Date.now() + 61_000);
      expect(service.isHealthCheckDue('api', future)).toBe(true);
    });

    it('returns false for unknown component', () => {
      expect(service.isHealthCheckDue('ghost')).toBe(false);
    });
  });

  // ── Events ───────────────────────────────────────────────────────────────────

  describe('getEvents', () => {
    it('records health_check events', async () => {
      service.registerComponent(makeConfig('api'));
      await service.runHealthCheck('api', async () => true);
      const events = service.getEvents();
      expect(events.some((e) => e.type === 'health_check')).toBe(true);
    });

    it('records component_failed events', async () => {
      service.registerComponent(makeConfig('api'));
      await service.runHealthCheck('api', async () => false);
      const events = service.getEvents();
      expect(events.some((e) => e.type === 'component_failed')).toBe(true);
    });

    it('records component_restarted events', async () => {
      service.registerComponent(makeConfig('api'));
      await service.runHealthCheck('api', async () => false, async () => {});
      const events = service.getEvents();
      expect(events.some((e) => e.type === 'component_restarted')).toBe(true);
    });

    it('records db_failover events', async () => {
      await service.performDatabaseFailover(async () => 'node-2');
      const events = service.getEvents();
      expect(events.some((e) => e.type === 'db_failover')).toBe(true);
    });
  });
});
