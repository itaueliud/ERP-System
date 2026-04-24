/**
 * Redis Caching Layer
 * 
 * This module provides Redis-based caching for the TechSwiftTrix ERP System.
 * 
 * Requirements:
 * - 21.2: Use Redis for caching frequently accessed data
 * - 21.3: Cache user session data in Redis with 8-hour TTL
 * - 21.4: Cache dashboard metrics in Redis with 5-minute TTL
 * 
 * TTL Policies:
 * - Sessions: 8 hours
 * - Dashboard Metrics: 5 minutes
 * - Permissions: 1 hour
 * - Static Data: 24 hours
 * - Search Results: 10 minutes
 */

export { redis } from './connection';
export { cacheService, CacheService, CacheTTL, CachePrefix } from './cacheService';
export { sessionCache, SessionCache, SessionData } from './sessionCache';
export { dashboardCache, DashboardCache, DashboardMetrics } from './dashboardCache';
export { permissionsCache, PermissionsCache, UserPermissions } from './permissionsCache';
