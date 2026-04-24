import { cacheService, CacheTTL, CachePrefix } from './cacheService';
import logger from '../utils/logger';

export interface UserPermissions {
  userId: string;
  role: string;
  permissions: string[];
  departmentId?: string;
  canAccessFinancialData: boolean;
  cachedAt: Date;
}

/**
 * Permissions caching service
 * Requirement 21.4: Cache user permissions in Redis with 1-hour TTL
 */
export class PermissionsCache {
  /**
   * Store user permissions
   */
  async setPermissions(userId: string, permissions: UserPermissions): Promise<void> {
    const key = `${CachePrefix.PERMISSIONS}${userId}`;
    await cacheService.set(key, permissions, CacheTTL.PERMISSIONS);
    logger.debug('Permissions cached', { userId, role: permissions.role });
  }

  /**
   * Get user permissions
   */
  async getPermissions(userId: string): Promise<UserPermissions | null> {
    const key = `${CachePrefix.PERMISSIONS}${userId}`;
    return await cacheService.get<UserPermissions>(key);
  }

  /**
   * Delete user permissions
   */
  async deletePermissions(userId: string): Promise<void> {
    const key = `${CachePrefix.PERMISSIONS}${userId}`;
    await cacheService.delete(key);
    logger.info('Permissions deleted', { userId });
  }

  /**
   * Delete all permissions for a role (when role permissions change)
   */
  async deleteRolePermissions(role: string): Promise<void> {
    const pattern = `${CachePrefix.PERMISSIONS}*`;
    await cacheService.deletePattern(pattern);
    logger.info('Role permissions invalidated', { role });
  }

  /**
   * Check if user has specific permission (cached)
   */
  async hasPermission(userId: string, permission: string): Promise<boolean | null> {
    const permissions = await this.getPermissions(userId);
    if (!permissions) {
      return null; // Cache miss
    }
    return permissions.permissions.includes(permission);
  }

  /**
   * Check if user can access financial data (cached)
   */
  async canAccessFinancialData(userId: string): Promise<boolean | null> {
    const permissions = await this.getPermissions(userId);
    if (!permissions) {
      return null; // Cache miss
    }
    return permissions.canAccessFinancialData;
  }

  /**
   * Store role-based permissions template
   */
  async setRolePermissions(role: string, permissions: string[]): Promise<void> {
    const key = `${CachePrefix.PERMISSIONS}role:${role}`;
    await cacheService.set(key, permissions, CacheTTL.PERMISSIONS);
    logger.debug('Role permissions cached', { role });
  }

  /**
   * Get role-based permissions template
   */
  async getRolePermissions(role: string): Promise<string[] | null> {
    const key = `${CachePrefix.PERMISSIONS}role:${role}`;
    return await cacheService.get<string[]>(key);
  }

  /**
   * Batch get permissions for multiple users
   */
  async getBatchPermissions(userIds: string[]): Promise<(UserPermissions | null)[]> {
    const keys = userIds.map((id) => `${CachePrefix.PERMISSIONS}${id}`);
    return await cacheService.mget<UserPermissions>(keys);
  }

  /**
   * Batch set permissions for multiple users
   */
  async setBatchPermissions(
    permissionsMap: Record<string, UserPermissions>
  ): Promise<void> {
    const entries: Record<string, UserPermissions> = {};
    for (const [userId, permissions] of Object.entries(permissionsMap)) {
      entries[`${CachePrefix.PERMISSIONS}${userId}`] = permissions;
    }
    await cacheService.mset(entries, CacheTTL.PERMISSIONS);
    logger.debug('Batch permissions cached', { count: Object.keys(permissionsMap).length });
  }

  /**
   * Check if permissions are cached
   */
  async exists(userId: string): Promise<boolean> {
    const key = `${CachePrefix.PERMISSIONS}${userId}`;
    return await cacheService.exists(key);
  }

  /**
   * Get remaining TTL for cached permissions
   */
  async getPermissionsTTL(userId: string): Promise<number> {
    const key = `${CachePrefix.PERMISSIONS}${userId}`;
    return await cacheService.ttl(key);
  }

  /**
   * Invalidate all permissions cache
   */
  async invalidateAll(): Promise<void> {
    const pattern = `${CachePrefix.PERMISSIONS}*`;
    await cacheService.deletePattern(pattern);
    logger.info('All permissions cache invalidated');
  }
}

export const permissionsCache = new PermissionsCache();
export default permissionsCache;
