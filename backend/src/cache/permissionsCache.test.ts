import { redis } from './connection';
import { permissionsCache, UserPermissions } from './permissionsCache';
import { cacheService, CacheTTL } from './cacheService';

describe('PermissionsCache', () => {
  beforeAll(async () => {
    await redis.connect();
  });

  afterAll(async () => {
    await redis.close();
  });

  beforeEach(async () => {
    await cacheService.flush();
  });

  const mockPermissions: UserPermissions = {
    userId: 'user-123',
    role: 'CFO',
    permissions: ['payment:approve', 'payment:view', 'financial:read'],
    departmentId: 'dept-finance',
    canAccessFinancialData: true,
    cachedAt: new Date(),
  };

  describe('setPermissions and getPermissions', () => {
    it('should store and retrieve user permissions', async () => {
      const userId = 'user-123';

      await permissionsCache.setPermissions(userId, mockPermissions);
      const result = await permissionsCache.getPermissions(userId);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(mockPermissions.userId);
      expect(result?.role).toBe(mockPermissions.role);
      expect(result?.permissions).toEqual(mockPermissions.permissions);
      expect(result?.canAccessFinancialData).toBe(true);
    });

    it('should set permissions with 1-hour TTL', async () => {
      const userId = 'user-ttl';

      await permissionsCache.setPermissions(userId, mockPermissions);
      const ttl = await permissionsCache.getPermissionsTTL(userId);

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(CacheTTL.PERMISSIONS);
    });

    it('should return null for non-existent permissions', async () => {
      const result = await permissionsCache.getPermissions('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('deletePermissions', () => {
    it('should delete user permissions', async () => {
      const userId = 'user-delete';
      await permissionsCache.setPermissions(userId, mockPermissions);

      await permissionsCache.deletePermissions(userId);
      const result = await permissionsCache.getPermissions(userId);

      expect(result).toBeNull();
    });
  });

  describe('hasPermission', () => {
    it('should return true for existing permission', async () => {
      const userId = 'user-check';
      await permissionsCache.setPermissions(userId, mockPermissions);

      const hasPermission = await permissionsCache.hasPermission(userId, 'payment:approve');
      expect(hasPermission).toBe(true);
    });

    it('should return false for non-existing permission', async () => {
      const userId = 'user-check';
      await permissionsCache.setPermissions(userId, mockPermissions);

      const hasPermission = await permissionsCache.hasPermission(userId, 'user:delete');
      expect(hasPermission).toBe(false);
    });

    it('should return null for non-cached user', async () => {
      const hasPermission = await permissionsCache.hasPermission('non-existent', 'any:permission');
      expect(hasPermission).toBeNull();
    });
  });

  describe('canAccessFinancialData', () => {
    it('should return true for users with financial access', async () => {
      const userId = 'user-financial';
      await permissionsCache.setPermissions(userId, mockPermissions);

      const canAccess = await permissionsCache.canAccessFinancialData(userId);
      expect(canAccess).toBe(true);
    });

    it('should return false for users without financial access', async () => {
      const userId = 'user-no-financial';
      const agentPermissions: UserPermissions = {
        ...mockPermissions,
        userId,
        role: 'AGENT',
        canAccessFinancialData: false,
      };
      await permissionsCache.setPermissions(userId, agentPermissions);

      const canAccess = await permissionsCache.canAccessFinancialData(userId);
      expect(canAccess).toBe(false);
    });

    it('should return null for non-cached user', async () => {
      const canAccess = await permissionsCache.canAccessFinancialData('non-existent');
      expect(canAccess).toBeNull();
    });
  });

  describe('role permissions', () => {
    it('should store and retrieve role-based permissions', async () => {
      const role = 'CEO';
      const permissions = ['*:*']; // All permissions

      await permissionsCache.setRolePermissions(role, permissions);
      const result = await permissionsCache.getRolePermissions(role);

      expect(result).toEqual(permissions);
    });
  });

  describe('batch operations', () => {
    it('should batch set permissions', async () => {
      const permissionsMap = {
        'user-1': { ...mockPermissions, userId: 'user-1' },
        'user-2': { ...mockPermissions, userId: 'user-2' },
        'user-3': { ...mockPermissions, userId: 'user-3' },
      };

      await permissionsCache.setBatchPermissions(permissionsMap);

      const result1 = await permissionsCache.getPermissions('user-1');
      const result2 = await permissionsCache.getPermissions('user-2');
      const result3 = await permissionsCache.getPermissions('user-3');

      expect(result1?.userId).toBe('user-1');
      expect(result2?.userId).toBe('user-2');
      expect(result3?.userId).toBe('user-3');
    });

    it('should batch get permissions', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];
      for (const userId of userIds) {
        await permissionsCache.setPermissions(userId, { ...mockPermissions, userId });
      }

      const results = await permissionsCache.getBatchPermissions(userIds);

      expect(results).toHaveLength(3);
      expect(results[0]?.userId).toBe('user-1');
      expect(results[1]?.userId).toBe('user-2');
      expect(results[2]?.userId).toBe('user-3');
    });
  });

  describe('exists', () => {
    it('should return true for cached permissions', async () => {
      const userId = 'user-exists';
      await permissionsCache.setPermissions(userId, mockPermissions);

      const exists = await permissionsCache.exists(userId);
      expect(exists).toBe(true);
    });

    it('should return false for non-cached permissions', async () => {
      const exists = await permissionsCache.exists('non-existent');
      expect(exists).toBe(false);
    });
  });

  describe('invalidateAll', () => {
    it('should invalidate all permissions cache', async () => {
      await permissionsCache.setPermissions('user-1', mockPermissions);
      await permissionsCache.setPermissions('user-2', mockPermissions);
      await permissionsCache.setRolePermissions('CEO', ['*:*']);

      await permissionsCache.invalidateAll();

      const result1 = await permissionsCache.getPermissions('user-1');
      const result2 = await permissionsCache.getPermissions('user-2');
      const result3 = await permissionsCache.getRolePermissions('CEO');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });
  });
});
