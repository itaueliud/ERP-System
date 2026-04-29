import { authorizationService, Role, ROLE_PERMISSIONS } from './authorizationService';
import { db } from '../database/connection';
import { permissionsCache } from '../cache/permissionsCache';

// Mock dependencies
jest.mock('../database/connection');
jest.mock('../cache/permissionsCache');
jest.mock('../utils/logger');

const mockDb = db as jest.Mocked<typeof db>;
const mockPermissionsCache = permissionsCache as jest.Mocked<typeof permissionsCache>;

describe('AuthorizationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hasRole', () => {
    it('should return true when user has the required role', async () => {
      const userId = 'user-123';
      const requiredRole = Role.CEO;

      mockPermissionsCache.getPermissions.mockResolvedValue({
        userId,
        role: Role.CEO,
        permissions: ROLE_PERMISSIONS[Role.CEO],
        canAccessFinancialData: true,
        cachedAt: new Date(),
      });

      const result = await authorizationService.hasRole(userId, requiredRole);

      expect(result).toBe(true);
      expect(mockPermissionsCache.getPermissions).toHaveBeenCalledWith(userId);
    });

    it('should return false when user does not have the required role', async () => {
      const userId = 'user-123';
      const requiredRole = Role.CEO;

      mockPermissionsCache.getPermissions.mockResolvedValue({
        userId,
        role: Role.AGENT,
        permissions: ROLE_PERMISSIONS[Role.AGENT],
        canAccessFinancialData: false,
        cachedAt: new Date(),
      });

      const result = await authorizationService.hasRole(userId, requiredRole);

      expect(result).toBe(false);
    });

    it('should fetch from database when cache misses', async () => {
      const userId = 'user-123';
      const requiredRole = Role.CFO;

      mockPermissionsCache.getPermissions.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({
        rows: [{ role: Role.CFO }],
      } as any);

      const result = await authorizationService.hasRole(userId, requiredRole);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should return false when user not found', async () => {
      const userId = 'user-123';
      const requiredRole = Role.CEO;

      mockPermissionsCache.getPermissions.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({
        rows: [],
      } as any);

      const result = await authorizationService.hasRole(userId, requiredRole);

      expect(result).toBe(false);
    });
  });

  describe('hasPermissions', () => {
    it('should return true when user has all required permissions', async () => {
      const userId = 'user-123';
      const requiredPermissions = ['read:clients', 'write:clients'];

      mockPermissionsCache.getPermissions.mockResolvedValue({
        userId,
        role: Role.OPERATIONS_USER,
        permissions: ROLE_PERMISSIONS[Role.OPERATIONS_USER],
        canAccessFinancialData: false,
        cachedAt: new Date(),
      });

      const result = await authorizationService.hasPermissions(userId, requiredPermissions);

      expect(result).toBe(true);
    });

    it('should return false when user lacks required permissions', async () => {
      const userId = 'user-123';
      const requiredPermissions = ['approve:payments'];

      mockPermissionsCache.getPermissions.mockResolvedValue({
        userId,
        role: Role.AGENT,
        permissions: ROLE_PERMISSIONS[Role.AGENT],
        canAccessFinancialData: false,
        cachedAt: new Date(),
      });

      const result = await authorizationService.hasPermissions(userId, requiredPermissions);

      expect(result).toBe(false);
    });

    it('should support wildcard permissions for CEO', async () => {
      const userId = 'user-123';
      const requiredPermissions = ['read:anything', 'write:anything'];

      mockPermissionsCache.getPermissions.mockResolvedValue({
        userId,
        role: Role.CEO,
        permissions: ROLE_PERMISSIONS[Role.CEO],
        canAccessFinancialData: true,
        cachedAt: new Date(),
      });

      const result = await authorizationService.hasPermissions(userId, requiredPermissions);

      expect(result).toBe(true);
    });

    it('should support wildcard permissions for specific actions', async () => {
      const userId = 'user-123';
      const requiredPermissions = ['read:clients'];

      mockPermissionsCache.getPermissions.mockResolvedValue({
        userId,
        role: Role.CEO,
        permissions: ['read:*', 'write:*'],
        canAccessFinancialData: true,
        cachedAt: new Date(),
      });

      const result = await authorizationService.hasPermissions(userId, requiredPermissions);

      expect(result).toBe(true);
    });
  });

  describe('canAccessFinancialData', () => {
    it('should return true for CEO', async () => {
      const userId = 'user-123';

      mockPermissionsCache.getPermissions.mockResolvedValue({
        userId,
        role: Role.CEO,
        permissions: ROLE_PERMISSIONS[Role.CEO],
        canAccessFinancialData: true,
        cachedAt: new Date(),
      });

      const result = await authorizationService.canAccessFinancialData(userId);

      expect(result).toBe(true);
    });

    it('should return true for CoS', async () => {
      const userId = 'user-123';

      mockPermissionsCache.getPermissions.mockResolvedValue({
        userId,
        role: Role.CoS,
        permissions: ROLE_PERMISSIONS[Role.CoS],
        canAccessFinancialData: true,
        cachedAt: new Date(),
      });

      const result = await authorizationService.canAccessFinancialData(userId);

      expect(result).toBe(true);
    });

    it('should return true for CFO', async () => {
      const userId = 'user-123';

      mockPermissionsCache.getPermissions.mockResolvedValue({
        userId,
        role: Role.CFO,
        permissions: ROLE_PERMISSIONS[Role.CFO],
        canAccessFinancialData: true,
        cachedAt: new Date(),
      });

      const result = await authorizationService.canAccessFinancialData(userId);

      expect(result).toBe(true);
    });

    it('should return true for EA', async () => {
      const userId = 'user-123';

      mockPermissionsCache.getPermissions.mockResolvedValue({
        userId,
        role: Role.EA,
        permissions: ROLE_PERMISSIONS[Role.EA],
        canAccessFinancialData: true,
        cachedAt: new Date(),
      });

      const result = await authorizationService.canAccessFinancialData(userId);

      expect(result).toBe(true);
    });

    it('should return false for Agent', async () => {
      const userId = 'user-123';

      mockPermissionsCache.getPermissions.mockResolvedValue({
        userId,
        role: Role.AGENT,
        permissions: ROLE_PERMISSIONS[Role.AGENT],
        canAccessFinancialData: false,
        cachedAt: new Date(),
      });

      const result = await authorizationService.canAccessFinancialData(userId);

      expect(result).toBe(false);
    });

    it('should return false for Operations User', async () => {
      const userId = 'user-123';

      mockPermissionsCache.getPermissions.mockResolvedValue({
        userId,
        role: Role.OPERATIONS_USER,
        permissions: ROLE_PERMISSIONS[Role.OPERATIONS_USER],
        canAccessFinancialData: false,
        cachedAt: new Date(),
      });

      const result = await authorizationService.canAccessFinancialData(userId);

      expect(result).toBe(false);
    });
  });

  describe('canAccessResource', () => {
    it('should return true for CEO accessing any resource', async () => {
      const userId = 'user-123';
      const resourceType = 'clients';
      const resourceId = 'client-456';

      mockPermissionsCache.getPermissions.mockResolvedValue({
        userId,
        role: Role.CEO,
        permissions: ROLE_PERMISSIONS[Role.CEO],
        canAccessFinancialData: true,
        cachedAt: new Date(),
      });

      const result = await authorizationService.canAccessResource(
        userId,
        resourceType,
        resourceId
      );

      expect(result).toBe(true);
    });

    it('should check ownership for agents', async () => {
      const userId = 'agent-123';
      const resourceType = 'clients';
      const resourceId = 'client-456';

      mockPermissionsCache.getPermissions.mockResolvedValue({
        userId,
        role: Role.AGENT,
        permissions: ROLE_PERMISSIONS[Role.AGENT],
        canAccessFinancialData: false,
        cachedAt: new Date(),
      });

      mockDb.query.mockResolvedValue({
        rows: [{ agent_id: userId }],
      } as any);

      const result = await authorizationService.canAccessResource(
        userId,
        resourceType,
        resourceId
      );

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should return false when agent does not own resource', async () => {
      const userId = 'agent-123';
      const resourceType = 'clients';
      const resourceId = 'client-456';

      mockPermissionsCache.getPermissions.mockResolvedValue({
        userId,
        role: Role.AGENT,
        permissions: ROLE_PERMISSIONS[Role.AGENT],
        canAccessFinancialData: false,
        cachedAt: new Date(),
      });

      mockDb.query.mockResolvedValue({
        rows: [{ agent_id: 'different-agent' }],
      } as any);

      const result = await authorizationService.canAccessResource(
        userId,
        resourceType,
        resourceId
      );

      expect(result).toBe(false);
    });
  });

  describe('ownsResource', () => {
    it('should return true when agent owns client', async () => {
      const userId = 'agent-123';
      const resourceType = 'clients';
      const resourceId = 'client-456';

      mockDb.query.mockResolvedValue({
        rows: [{ agent_id: userId }],
      } as any);

      const result = await authorizationService.ownsResource(userId, resourceType, resourceId);

      expect(result).toBe(true);
    });

    it('should return false when agent does not own client', async () => {
      const userId = 'agent-123';
      const resourceType = 'clients';
      const resourceId = 'client-456';

      mockDb.query.mockResolvedValue({
        rows: [{ agent_id: 'different-agent' }],
      } as any);

      const result = await authorizationService.ownsResource(userId, resourceType, resourceId);

      expect(result).toBe(false);
    });

    it('should return true when user owns daily report', async () => {
      const userId = 'user-123';
      const resourceType = 'daily_reports';
      const resourceId = 'report-456';

      mockDb.query.mockResolvedValue({
        rows: [{ user_id: userId }],
      } as any);

      const result = await authorizationService.ownsResource(userId, resourceType, resourceId);

      expect(result).toBe(true);
    });

    it('should return false for unknown resource type', async () => {
      const userId = 'user-123';
      const resourceType = 'unknown';
      const resourceId = 'resource-456';

      const result = await authorizationService.ownsResource(userId, resourceType, resourceId);

      expect(result).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    it('should return permissions from cache when available', async () => {
      const userId = 'user-123';
      const expectedPermissions = ROLE_PERMISSIONS[Role.CFO];

      mockPermissionsCache.getPermissions.mockResolvedValue({
        userId,
        role: Role.CFO,
        permissions: expectedPermissions,
        canAccessFinancialData: true,
        cachedAt: new Date(),
      });

      const result = await authorizationService.getUserPermissions(userId);

      expect(result).toEqual(expectedPermissions);
      expect(mockPermissionsCache.getPermissions).toHaveBeenCalledWith(userId);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache when cache misses', async () => {
      const userId = 'user-123';
      const role = Role.OPERATIONS_USER;

      mockPermissionsCache.getPermissions.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({
        rows: [
          {
            role,
            permissions: [],
            department_id: 'dept-123',
          },
        ],
      } as any);

      const result = await authorizationService.getUserPermissions(userId);

      expect(result).toEqual(ROLE_PERMISSIONS[role]);
      expect(mockDb.query).toHaveBeenCalled();
      expect(mockPermissionsCache.setPermissions).toHaveBeenCalled();
    });

    it('should return empty array when user not found', async () => {
      const userId = 'user-123';

      mockPermissionsCache.getPermissions.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({
        rows: [],
      } as any);

      const result = await authorizationService.getUserPermissions(userId);

      expect(result).toEqual([]);
    });
  });

  describe('invalidateUserPermissions', () => {
    it('should delete user permissions from cache', async () => {
      const userId = 'user-123';

      mockPermissionsCache.deletePermissions.mockResolvedValue();

      await authorizationService.invalidateUserPermissions(userId);

      expect(mockPermissionsCache.deletePermissions).toHaveBeenCalledWith(userId);
    });
  });

  describe('invalidateRolePermissions', () => {
    it('should delete all permissions for a role', async () => {
      const role = Role.AGENT;

      mockPermissionsCache.deleteRolePermissions.mockResolvedValue();

      await authorizationService.invalidateRolePermissions(role);

      expect(mockPermissionsCache.deleteRolePermissions).toHaveBeenCalledWith(role);
    });
  });

  describe('ROLE_PERMISSIONS', () => {
    it('should define permissions for all 12 roles', () => {
      const roles = Object.values(Role);
      expect(roles).toHaveLength(12);

      roles.forEach((role) => {
        expect(ROLE_PERMISSIONS[role]).toBeDefined();
        expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
        expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
      });
    });

    it('should grant CEO access to all resources', () => {
      const ceoPermissions = ROLE_PERMISSIONS[Role.CEO];
      expect(ceoPermissions).toContain('read:*');
      expect(ceoPermissions).toContain('write:*');
      expect(ceoPermissions).toContain('delete:*');
      expect(ceoPermissions).toContain('access:financial_data');
    });

    it('should grant financial access to CEO, CoS, CFO, EA only', () => {
      const financialRoles = [Role.CEO, Role.CoS, Role.CFO, Role.EA];
      const nonFinancialRoles = [
        Role.COO,
        Role.CTO,
        Role.HEAD_OF_TRAINERS,
        Role.TRAINER,
        Role.AGENT,
        Role.OPERATIONS_USER,
        Role.TECH_STAFF,
        Role.DEVELOPER,
      ];

      financialRoles.forEach((role) => {
        expect(ROLE_PERMISSIONS[role]).toContain('access:financial_data');
      });

      nonFinancialRoles.forEach((role) => {
        expect(ROLE_PERMISSIONS[role]).not.toContain('access:financial_data');
      });
    });

    it('should restrict agent permissions to own data', () => {
      const agentPermissions = ROLE_PERMISSIONS[Role.AGENT];
      expect(agentPermissions).toContain('read:own_clients');
      expect(agentPermissions).toContain('read:own_data');
      expect(agentPermissions).not.toContain('read:all_clients');
      expect(agentPermissions).not.toContain('access:financial_data');
    });

    it('should grant payment approval to CFO', () => {
      const cfoPermissions = ROLE_PERMISSIONS[Role.CFO];
      expect(cfoPermissions).toContain('approve:payments');
      expect(cfoPermissions).toContain('access:financial_data');
    });

    it('should grant payment execution to EA', () => {
      const eaPermissions = ROLE_PERMISSIONS[Role.EA];
      expect(eaPermissions).toContain('execute:payments');
      expect(eaPermissions).toContain('access:financial_data');
    });
  });
});
