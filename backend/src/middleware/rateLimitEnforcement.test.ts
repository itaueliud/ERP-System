import { RateLimitEnforcementService, ViolationResult } from './rateLimitEnforcement';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockRedisStore: Record<string, { value: string; ttl?: number }> = {};

const mockClient = {
  incr: jest.fn(async (key: string) => {
    const current = mockRedisStore[key] ? parseInt(mockRedisStore[key].value, 10) : 0;
    const next = current + 1;
    mockRedisStore[key] = { value: String(next) };
    return next;
  }),
  expire: jest.fn(async (key: string, ttl: number) => {
    if (mockRedisStore[key]) mockRedisStore[key].ttl = ttl;
    return 1;
  }),
  get: jest.fn(async (key: string) => {
    return mockRedisStore[key]?.value ?? null;
  }),
  set: jest.fn(async (key: string, value: string, _opts?: any) => {
    mockRedisStore[key] = { value };
    return 'OK';
  }),
  del: jest.fn(async (...keys: string[]) => {
    keys.forEach((k) => delete mockRedisStore[k]);
    return keys.length;
  }),
};

jest.mock('../cache/connection', () => ({
  redis: { getClient: () => mockClient },
}));

jest.mock('../audit/auditService', () => ({
  auditService: { log: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clearStore() {
  Object.keys(mockRedisStore).forEach((k) => delete mockRedisStore[k]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RateLimitEnforcementService', () => {
  let service: RateLimitEnforcementService;

  beforeEach(() => {
    service = new RateLimitEnforcementService();
    clearStore();
    jest.clearAllMocks();
  });

  // ── getBackoffDelay ────────────────────────────────────────────────────────

  describe('getBackoffDelay', () => {
    it('returns 0 for violation count <= 0', () => {
      expect(service.getBackoffDelay(0)).toBe(0);
      expect(service.getBackoffDelay(-1)).toBe(0);
    });

    it('returns 1 second for first violation', () => {
      expect(service.getBackoffDelay(1)).toBe(1); // 2^0
    });

    it('returns 2 seconds for second violation', () => {
      expect(service.getBackoffDelay(2)).toBe(2); // 2^1
    });

    it('returns 4 seconds for third violation', () => {
      expect(service.getBackoffDelay(3)).toBe(4); // 2^2
    });

    it('returns 16 seconds for fifth violation', () => {
      expect(service.getBackoffDelay(5)).toBe(16); // 2^4
    });

    it('caps backoff at 3600 seconds', () => {
      expect(service.getBackoffDelay(100)).toBe(3600);
    });

    it('caps at exactly 3600 for violation count that would exceed max', () => {
      // 2^12 = 4096 > 3600, so count=13 should be capped
      expect(service.getBackoffDelay(13)).toBe(3600);
    });
  });

  // ── getViolationCount ──────────────────────────────────────────────────────

  describe('getViolationCount', () => {
    it('returns 0 when no violations recorded', async () => {
      const count = await service.getViolationCount('user-1');
      expect(count).toBe(0);
    });

    it('returns the stored violation count', async () => {
      mockRedisStore['rl:violations:user-2'] = { value: '3' };
      const count = await service.getViolationCount('user-2');
      expect(count).toBe(3);
    });
  });

  // ── isAccountSuspended ─────────────────────────────────────────────────────

  describe('isAccountSuspended', () => {
    it('returns false when account is not suspended', async () => {
      expect(await service.isAccountSuspended('user-1')).toBe(false);
    });

    it('returns true when suspension key exists', async () => {
      mockRedisStore['rl:suspended:user-1'] = { value: 'Too many violations' };
      expect(await service.isAccountSuspended('user-1')).toBe(true);
    });
  });

  // ── suspendAccount ─────────────────────────────────────────────────────────

  describe('suspendAccount', () => {
    it('sets suspension key in Redis', async () => {
      await service.suspendAccount('user-1', 'Too many violations');
      expect(mockClient.set).toHaveBeenCalledWith(
        'rl:suspended:user-1',
        'Too many violations',
        { EX: 3600 }
      );
    });

    it('logs the suspension via auditService', async () => {
      const { auditService } = require('../audit/auditService');
      await service.suspendAccount('user-1', 'Test reason');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          action: 'ACCOUNT_SUSPENDED',
          resourceType: 'security',
        })
      );
    });
  });

  // ── clearViolations ────────────────────────────────────────────────────────

  describe('clearViolations', () => {
    it('removes violation and suspension keys', async () => {
      mockRedisStore['rl:violations:user-1'] = { value: '3' };
      mockRedisStore['rl:suspended:user-1'] = { value: 'reason' };

      await service.clearViolations('user-1');

      expect(mockRedisStore['rl:violations:user-1']).toBeUndefined();
      expect(mockRedisStore['rl:suspended:user-1']).toBeUndefined();
    });
  });

  // ── recordViolation ────────────────────────────────────────────────────────

  describe('recordViolation', () => {
    it('increments violation count and returns correct result', async () => {
      const result: ViolationResult = await service.recordViolation('user-1', '127.0.0.1');
      expect(result.violationCount).toBe(1);
      expect(result.suspended).toBe(false);
      expect(result.backoffSeconds).toBe(1); // 2^0
    });

    it('sets TTL on first violation', async () => {
      await service.recordViolation('user-1', '127.0.0.1');
      expect(mockClient.expire).toHaveBeenCalledWith('rl:violations:user-1', 3600);
    });

    it('does not reset TTL on subsequent violations', async () => {
      mockRedisStore['rl:violations:user-1'] = { value: '2' };
      await service.recordViolation('user-1', '127.0.0.1');
      // expire should NOT be called because incr returns > 1
      expect(mockClient.expire).not.toHaveBeenCalled();
    });

    it('suspends account on 5th violation', async () => {
      // Pre-seed 4 violations
      mockRedisStore['rl:violations:user-1'] = { value: '4' };

      const result = await service.recordViolation('user-1', '127.0.0.1');
      expect(result.violationCount).toBe(5);
      expect(result.suspended).toBe(true);
      expect(mockClient.set).toHaveBeenCalledWith(
        'rl:suspended:user-1',
        expect.any(String),
        { EX: 3600 }
      );
    });

    it('marks suspended=true for violations beyond 5', async () => {
      mockRedisStore['rl:violations:user-1'] = { value: '6' };
      const result = await service.recordViolation('user-1', '127.0.0.1');
      expect(result.violationCount).toBe(7);
      expect(result.suspended).toBe(true);
    });

    it('logs violation via auditService', async () => {
      const { auditService } = require('../audit/auditService');
      await service.recordViolation('user-1', '10.0.0.1');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          action: 'RATE_LIMIT_VIOLATION',
          resourceType: 'security',
          ipAddress: '10.0.0.1',
          result: 'FAILURE',
        })
      );
    });

    it('returns safe defaults when Redis throws', async () => {
      mockClient.incr.mockRejectedValueOnce(new Error('Redis down'));
      const result = await service.recordViolation('user-err', '1.2.3.4');
      expect(result).toEqual({ violationCount: 0, suspended: false, backoffSeconds: 0 });
    });
  });
});
