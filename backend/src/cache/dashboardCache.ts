import { cacheService, CacheTTL, CachePrefix } from './cacheService';
import logger from '../utils/logger';

export interface DashboardMetrics {
  userId: string;
  role: string;
  metrics: {
    totalClients?: number;
    totalLeads?: number;
    totalProjects?: number;
    totalRevenue?: number;
    pendingApprovals?: number;
    overdueReports?: number;
    activeAgents?: number;
    conversionRate?: number;
    [key: string]: any;
  };
  generatedAt: Date;
}

/**
 * Dashboard metrics caching service
 * Requirement 21.4: Cache dashboard metrics in Redis with 5-minute TTL
 */
export class DashboardCache {
  /**
   * Store dashboard metrics for a user
   */
  async setMetrics(userId: string, metrics: DashboardMetrics): Promise<void> {
    const key = `${CachePrefix.DASHBOARD}${userId}`;
    await cacheService.set(key, metrics, CacheTTL.DASHBOARD_METRICS);
    logger.debug('Dashboard metrics cached', { userId });
  }

  /**
   * Get dashboard metrics for a user
   */
  async getMetrics(userId: string): Promise<DashboardMetrics | null> {
    const key = `${CachePrefix.DASHBOARD}${userId}`;
    return await cacheService.get<DashboardMetrics>(key);
  }

  /**
   * Delete dashboard metrics for a user
   */
  async deleteMetrics(userId: string): Promise<void> {
    const key = `${CachePrefix.DASHBOARD}${userId}`;
    await cacheService.delete(key);
    logger.debug('Dashboard metrics deleted', { userId });
  }

  /**
   * Delete all dashboard metrics (for cache invalidation)
   */
  async deleteAllMetrics(): Promise<void> {
    const pattern = `${CachePrefix.DASHBOARD}*`;
    await cacheService.deletePattern(pattern);
    logger.info('All dashboard metrics deleted');
  }

  /**
   * Store role-specific dashboard metrics
   */
  async setRoleMetrics(role: string, metrics: any): Promise<void> {
    const key = `${CachePrefix.DASHBOARD}role:${role}`;
    await cacheService.set(key, metrics, CacheTTL.DASHBOARD_METRICS);
    logger.debug('Role dashboard metrics cached', { role });
  }

  /**
   * Get role-specific dashboard metrics
   */
  async getRoleMetrics(role: string): Promise<any | null> {
    const key = `${CachePrefix.DASHBOARD}role:${role}`;
    return await cacheService.get(key);
  }

  /**
   * Store department-specific dashboard metrics
   */
  async setDepartmentMetrics(departmentId: string, metrics: any): Promise<void> {
    const key = `${CachePrefix.DASHBOARD}dept:${departmentId}`;
    await cacheService.set(key, metrics, CacheTTL.DASHBOARD_METRICS);
    logger.debug('Department dashboard metrics cached', { departmentId });
  }

  /**
   * Get department-specific dashboard metrics
   */
  async getDepartmentMetrics(departmentId: string): Promise<any | null> {
    const key = `${CachePrefix.DASHBOARD}dept:${departmentId}`;
    return await cacheService.get(key);
  }

  /**
   * Store company-wide dashboard metrics
   */
  async setCompanyMetrics(metrics: any): Promise<void> {
    const key = `${CachePrefix.DASHBOARD}company`;
    await cacheService.set(key, metrics, CacheTTL.DASHBOARD_METRICS);
    logger.debug('Company dashboard metrics cached');
  }

  /**
   * Get company-wide dashboard metrics
   */
  async getCompanyMetrics(): Promise<any | null> {
    const key = `${CachePrefix.DASHBOARD}company`;
    return await cacheService.get(key);
  }

  /**
   * Check if metrics are cached
   */
  async hasMetrics(userId: string): Promise<boolean> {
    const key = `${CachePrefix.DASHBOARD}${userId}`;
    return await cacheService.exists(key);
  }

  /**
   * Get remaining TTL for cached metrics
   */
  async getMetricsTTL(userId: string): Promise<number> {
    const key = `${CachePrefix.DASHBOARD}${userId}`;
    return await cacheService.ttl(key);
  }
}

export const dashboardCache = new DashboardCache();
export default dashboardCache;
