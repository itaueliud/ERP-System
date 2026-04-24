import { redis } from './connection';
import { dashboardCache, DashboardMetrics } from './dashboardCache';
import { cacheService, CacheTTL } from './cacheService';

describe('DashboardCache', () => {
  beforeAll(async () => {
    await redis.connect();
  });

  afterAll(async () => {
    await redis.close();
  });

  beforeEach(async () => {
    await cacheService.flush();
  });

  const mockMetrics: DashboardMetrics = {
    userId: 'user-123',
    role: 'AGENT',
    metrics: {
      totalClients: 10,
      totalLeads: 5,
      totalProjects: 2,
      conversionRate: 0.5,
    },
    generatedAt: new Date(),
  };

  describe('setMetrics and getMetrics', () => {
    it('should store and retrieve dashboard metrics', async () => {
      const userId = 'user-123';

      await dashboardCache.setMetrics(userId, mockMetrics);
      const result = await dashboardCache.getMetrics(userId);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(mockMetrics.userId);
      expect(result?.metrics.totalClients).toBe(10);
      expect(result?.metrics.conversionRate).toBe(0.5);
    });

    it('should set metrics with 5-minute TTL', async () => {
      const userId = 'user-ttl';

      await dashboardCache.setMetrics(userId, mockMetrics);
      const ttl = await dashboardCache.getMetricsTTL(userId);

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(CacheTTL.DASHBOARD_METRICS);
    });

    it('should return null for non-existent metrics', async () => {
      const result = await dashboardCache.getMetrics('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('deleteMetrics', () => {
    it('should delete user metrics', async () => {
      const userId = 'user-delete';
      await dashboardCache.setMetrics(userId, mockMetrics);

      await dashboardCache.deleteMetrics(userId);
      const result = await dashboardCache.getMetrics(userId);

      expect(result).toBeNull();
    });
  });

  describe('role metrics', () => {
    it('should store and retrieve role-specific metrics', async () => {
      const role = 'CEO';
      const roleMetrics = { companyRevenue: 1000000, totalEmployees: 50 };

      await dashboardCache.setRoleMetrics(role, roleMetrics);
      const result = await dashboardCache.getRoleMetrics(role);

      expect(result).toEqual(roleMetrics);
    });
  });

  describe('department metrics', () => {
    it('should store and retrieve department-specific metrics', async () => {
      const departmentId = 'dept-123';
      const deptMetrics = { activeProjects: 15, teamSize: 8 };

      await dashboardCache.setDepartmentMetrics(departmentId, deptMetrics);
      const result = await dashboardCache.getDepartmentMetrics(departmentId);

      expect(result).toEqual(deptMetrics);
    });
  });

  describe('company metrics', () => {
    it('should store and retrieve company-wide metrics', async () => {
      const companyMetrics = {
        totalRevenue: 5000000,
        totalClients: 200,
        totalProjects: 150,
      };

      await dashboardCache.setCompanyMetrics(companyMetrics);
      const result = await dashboardCache.getCompanyMetrics();

      expect(result).toEqual(companyMetrics);
    });
  });

  describe('hasMetrics', () => {
    it('should return true for cached metrics', async () => {
      const userId = 'user-exists';
      await dashboardCache.setMetrics(userId, mockMetrics);

      const exists = await dashboardCache.hasMetrics(userId);
      expect(exists).toBe(true);
    });

    it('should return false for non-cached metrics', async () => {
      const exists = await dashboardCache.hasMetrics('non-existent');
      expect(exists).toBe(false);
    });
  });

  describe('deleteAllMetrics', () => {
    it('should delete all dashboard metrics', async () => {
      await dashboardCache.setMetrics('user-1', mockMetrics);
      await dashboardCache.setMetrics('user-2', mockMetrics);
      await dashboardCache.setCompanyMetrics({ total: 100 });

      await dashboardCache.deleteAllMetrics();

      const result1 = await dashboardCache.getMetrics('user-1');
      const result2 = await dashboardCache.getMetrics('user-2');
      const result3 = await dashboardCache.getCompanyMetrics();

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });
  });
});
