import { db } from '../database/connection';
import { permissionsCache, UserPermissions } from '../cache/permissionsCache';
import logger from '../utils/logger';

export enum Role {
  CEO              = 'CEO',
  CoS              = 'CoS',
  CFO              = 'CFO',
  COO              = 'COO',
  CTO              = 'CTO',
  EA               = 'EA',
  HEAD_OF_TRAINERS = 'HEAD_OF_TRAINERS',
  TRAINER          = 'TRAINER',
  AGENT            = 'AGENT',
  OPERATIONS_USER  = 'OPERATIONS_USER',
  TECHNOLOGY_USER  = 'TECHNOLOGY_USER',
  DEVELOPER        = 'DEVELOPER',
  CFO_ASSISTANT    = 'CFO_ASSISTANT',
}

/**
 * Defines which roles each role is allowed to invite.
 * Permissions Matrix — account creation column.
 */
export const INVITE_PERMISSIONS: Partial<Record<Role, Role[]>> = {
  // CEO can add any C-level account (doc §5: Who Creates Who)
  [Role.CEO]: [Role.CoS, Role.CFO, Role.COO, Role.CTO, Role.EA],
  // CTO can add Trainers, Head of Trainers, and CTO department members (doc §5)
  [Role.CTO]: [Role.HEAD_OF_TRAINERS, Role.TRAINER, Role.TECHNOLOGY_USER, Role.DEVELOPER],
  // Head of Trainers can add Agents directly (doc §5)
  [Role.HEAD_OF_TRAINERS]: [Role.AGENT],
  // CFO can add CFO Assistants (max 3) (doc §5)
  [Role.CFO]: [Role.CFO_ASSISTANT],
};

// Permission definitions for all 13 roles
// Aligned with the Permissions Matrix
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  [Role.CEO]: [
    // Full system access
    'read:*',
    'write:*',
    'delete:*',
    'approve:*',
    'execute:*',
    'access:financial_data',
    'access:all_portals',
    'view:all_data',
    'view:financial_totals',
    'view:profit_loss',
    'view:all_reports',
    'view:all_clients',
    'view:all_projects',
    'view:all_payments',
    'view:audit_logs',
    'manage:users',
    'manage:roles',
    'manage:departments',
    'invite:clevel',                  // Add C-level accounts
    'edit:service_amounts',
    'confirm:service_amount_changes',
    'approve:payments',
    'review:payments',
    'request:payments',
    'draft:contracts',
    'download:developer_contracts',
    'chat:cfo',
    'approve:service_amount_changes',
  ],

  [Role.CoS]: [
    // Chief of Staff — executive privileges
    'read:clients',
    'read:projects',
    'read:payments',
    'read:reports',
    'read:users',
    'write:clients',
    'write:projects',
    'access:financial_data',
    'access:executive_portal',
    'view:financial_totals',
    'view:profit_loss',
    'view:all_reports',
    'view:all_clients',
    'view:all_projects',
    'view:audit_logs',
    'manage:departments',
    'edit:service_amounts',
    'review:payments',
    'request:payments',
    'chat:cfo',
  ],

  [Role.CFO]: [
    // Chief Financial Officer — financial operations
    'read:payments',
    'read:payment_approvals',
    'read:projects',
    'read:clients',
    'read:contracts',
    'write:payment_approvals',
    'approve:payments',
    'reject:payments',
    'access:financial_data',
    'access:executive_portal',
    'view:financial_totals',
    'view:profit_loss',
    'view:all_payments',
    'view:financial_reports',
    'invite:cfo_assistant',           // Add CFO Assistants
    'edit:service_amounts',
    'review:payments',
    'request:payments',
    'chat:cfo',
  ],

  [Role.COO]: [
    // Chief Operating Officer — operations management
    'read:clients',
    'read:projects',
    'read:reports',
    'read:users',
    'read:achievements',
    'write:clients',
    'write:projects',
    'write:achievements',
    'access:clevel_portal',
    'view:department_reports',
    'view:operations_data',
    'manage:operations_departments',
    'view:cross_country_achievements',
    'chat:cfo',
  ],

  [Role.CTO]: [
    // Chief Technology Officer — technology management
    'read:projects',
    'read:github_repositories',
    'read:users',
    'read:reports',
    'read:achievements',
    'write:projects',
    'write:github_repositories',
    'write:achievements',
    'access:clevel_portal',
    'view:department_reports',
    'view:technology_data',
    'view:github_activity',
    'manage:technology_departments',
    'view:cross_country_achievements',
    'invite:trainers_cto_members',    // Add Trainers / CTO members
    'link:github',
    'assign:projects_to_dev_teams',
    'chat:cfo',
  ],

  [Role.EA]: [
    // Executive Assistant — execution tasks (doc §13: Financial Visibility — EA has revenue totals ✔ but P&L ✖)
    'read:payments',
    'read:payment_approvals',
    'read:projects',
    'read:clients',
    'read:contracts',
    'execute:payments',
    'access:financial_data',
    'access:executive_portal',
    'view:financial_totals',          // Revenue totals ✔ (doc §13)
    // NOTE: view:profit_loss intentionally excluded — EA has ✖ for P&L (doc §13)
    'view:approved_payments',
    'edit:service_amounts',
    'review:payments',
    'request:payments',
    'add:regions_countries',
    'draft:contracts',
    'download:developer_contracts',
    'chat:cfo',
  ],

  [Role.HEAD_OF_TRAINERS]: [
    // Head of Trainers — training management (doc §18 Permissions Matrix)
    'read:agents',
    'read:trainers',
    'read:training_courses',
    'read:training_assignments',
    'read:reports',
    'write:training_courses',
    'write:training_assignments',
    'access:trainers_portal',
    'view:agent_performance',
    'view:trainer_reports',
    'manage:trainers',
    'verify:training_completion',
    'invite:agents',                          // Add Agents (doc §18)
    'reassign:agents',                        // Reassign Agents (doc §18)
    'assign:converted_client_to_account_exec', // Assign converted client to Account Executive (doc §18)
    'chat:cfo',
  ],

  [Role.TRAINER]: [
    // Trainer — agent training
    'read:agents',
    'read:training_courses',
    'read:training_assignments',
    'write:training_assignments',
    'access:trainers_portal',
    'view:assigned_agents',
    'submit:daily_reports',
    'modify:priority_listing',
    'chat:cfo',
  ],

  [Role.AGENT]: [
    // Agent — client capture
    'read:own_clients',
    'read:own_data',
    'read:training_courses',
    'write:clients',                  // Add clients (leads)
    'write:communications',
    'access:agents_portal',
    'initiate:commitment_payments',
    'view:own_commissions',
    'submit:daily_reports',
  ],

  [Role.OPERATIONS_USER]: [
    // Operations User — COO departments
    'read:clients',
    'read:projects',
    'read:property_listings',
    'write:clients',
    'write:projects',
    'write:property_listings',
    'write:communications',
    'access:operations_portal',
    'qualify:leads',
    'convert:leads_to_projects',
    'submit:daily_reports',
  ],

  [Role.TECHNOLOGY_USER]: [
    // Technology User — CTO departments
    'read:projects',
    'read:github_repositories',
    'read:tasks',
    'write:projects',
    'write:tasks',
    'access:technology_portal',
    'view:project_timeline',
    'submit:daily_reports',
  ],

  [Role.DEVELOPER]: [
    // Developer — requires GitHub OAuth
    'read:projects',
    'read:github_repositories',
    'read:tasks',
    'write:tasks',
    'write:github_repositories',
    'access:technology_portal',
    'view:project_timeline',
    'link:github_repositories',
    'submit:daily_reports',
  ],

  [Role.CFO_ASSISTANT]: [
    // CFO Assistant — financial support (doc §13: Financial Visibility)
    // Revenue Totals ✔, Profit/P&L ✖ (doc §13 table — CFO_ASSISTANT not listed for P&L)
    'read:payments',
    'read:payment_approvals',
    'read:projects',
    'read:clients',
    'access:executive_portal',
    'view:financial_totals',          // Revenue totals ✔
    // NOTE: view:profit_loss intentionally excluded — not in spec for CFO_ASSISTANT
    'review:payments',
    'request:payments',
    'chat:clients',
    'chat:cfo',
  ],
};

// Financial data access roles — Revenue Totals (doc §13 Financial Visibility table)
// CEO ✔, CoS ✔, CFO ✔, EA ✔ — COO ✖, CTO ✖, HoT ✖, Trainer ✖, Agent ✖
// CFO_ASSISTANT can see revenue totals but NOT P&L (not listed in spec)
const FINANCIAL_ACCESS_ROLES = [Role.CEO, Role.CoS, Role.CFO, Role.EA];

// P&L access — stricter subset (doc §13: Profit/P&L — CEO ✔, CoS ✔, CFO ✔, EA ✖)
export const PL_ACCESS_ROLES = [Role.CEO, Role.CoS, Role.CFO];

// Financial data access roles (view financial totals / P&L) — replaced above, kept for reference
// See FINANCIAL_ACCESS_ROLES and PL_ACCESS_ROLES defined after CFO_ASSISTANT permissions

/**
 * Authorization Service
 * Handles role-based access control, permission checking, and resource ownership validation
 * Requirements: 2.1-2.10
 */
export class AuthorizationService {
  /**
   * Check if user has required role
   * Requirement 2.2: Verify user's role permits access to resource
   */
  async hasRole(userId: string, requiredRole: Role): Promise<boolean> {
    try {
      // Try to get from cache first
      const cachedPermissions = await permissionsCache.getPermissions(userId);
      if (cachedPermissions) {
        return cachedPermissions.role === requiredRole;
      }

      // Fetch from database
      const query = `
        SELECT r.name as role
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
      `;
      const result = await db.query(query, [userId]);

      if (result.rows.length === 0) {
        logger.warn('User not found for role check', { userId });
        return false;
      }

      return result.rows[0].role === requiredRole;
    } catch (error) {
      logger.error('Error checking user role', { error, userId, requiredRole });
      return false;
    }
  }

  /**
   * Check if user has specific permissions
   * Requirement 2.2: Verify user's role permits access to resource
   */
  async hasPermissions(userId: string, permissions: string[]): Promise<boolean> {
    try {
      // Try to get from cache first
      const cachedPermissions = await permissionsCache.getPermissions(userId);
      if (cachedPermissions) {
        return this.checkPermissions(cachedPermissions.permissions, permissions);
      }

      // Fetch from database and cache
      const userPermissions = await this.getUserPermissions(userId);
      return this.checkPermissions(userPermissions, permissions);
    } catch (error) {
      logger.error('Error checking user permissions', { error, userId, permissions });
      return false;
    }
  }

  /**
   * Check if user permissions include required permissions
   * Supports wildcard permissions (e.g., 'read:*')
   */
  private checkPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
    // CEO has wildcard access
    if (userPermissions.includes('read:*') && userPermissions.includes('write:*')) {
      return true;
    }

    return requiredPermissions.every((required) => {
      // Check exact match
      if (userPermissions.includes(required)) {
        return true;
      }

      // Check wildcard match (e.g., 'read:*' matches 'read:clients')
      const [action, _resource] = required.split(':');
      const wildcardPermission = `${action}:*`;
      if (userPermissions.includes(wildcardPermission)) {
        return true;
      }

      return false;
    });
  }

  /**
   * Check if user can access resource
   * Requirement 2.2: Verify user's role permits access to resource
   */
  async canAccessResource(
    userId: string,
    resourceType: string,
    resourceId: string
  ): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(userId);
      const userRole = await this.getUserRole(userId);

      // CEO has access to all resources (Requirement 2.6)
      if (userRole === Role.CEO) {
        return true;
      }

      // Check if user has read permission for resource type
      const readPermission = `read:${resourceType}`;
      const readOwnPermission = `read:own_${resourceType}`;
      if (!this.checkPermissions(userPermissions, [readPermission]) &&
          !this.checkPermissions(userPermissions, [readOwnPermission])) {
        return false;
      }

      // For agents, check resource ownership (Requirement 2.7)
      if (userRole === Role.AGENT) {
        return await this.ownsResource(userId, resourceType, resourceId);
      }

      return true;
    } catch (error) {
      logger.error('Error checking resource access', { error, userId, resourceType, resourceId });
      return false;
    }
  }

  /**
   * Check if user can access financial data
   * Requirement 2.8: Restrict financial data access to CEO, CoS, CFO, EA only
   */
  async canAccessFinancialData(userId: string): Promise<boolean> {
    try {
      // Try to get from cache first
      const cachedPermissions = await permissionsCache.getPermissions(userId);
      if (cachedPermissions) {
        return cachedPermissions.canAccessFinancialData;
      }

      // Fetch user role
      const userRole = await this.getUserRole(userId);
      return FINANCIAL_ACCESS_ROLES.includes(userRole as Role);
    } catch (error) {
      logger.error('Error checking financial data access', { error, userId });
      return false;
    }
  }

  /**
   * Get user's effective permissions
   * Requirement 2.1: Enforce RBAC at middleware layer
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    try {
      // Try to get from cache first
      const cachedPermissions = await permissionsCache.getPermissions(userId);
      if (cachedPermissions) {
        return cachedPermissions.permissions;
      }

      // Fetch from database
      const query = `
        SELECT r.name as role, r.permissions, u.department_id
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
      `;
      const result = await db.query(query, [userId]);

      if (result.rows.length === 0) {
        logger.warn('User not found for permissions', { userId });
        return [];
      }

      const { role, permissions: dbPermissions, department_id } = result.rows[0];

      // Get permissions from role definition
      const rolePermissions = ROLE_PERMISSIONS[role as Role] || [];

      // Merge with database permissions (if any custom permissions exist)
      const allPermissions = Array.from(
        new Set([...rolePermissions, ...(dbPermissions || [])])
      );

      // Cache permissions
      const permissionsData: UserPermissions = {
        userId,
        role,
        permissions: allPermissions,
        departmentId: department_id,
        canAccessFinancialData: FINANCIAL_ACCESS_ROLES.includes(role as Role),
        cachedAt: new Date(),
      };
      await permissionsCache.setPermissions(userId, permissionsData);

      return allPermissions;
    } catch (error) {
      logger.error('Error getting user permissions', { error, userId });
      return [];
    }
  }

  /**
   * Get user's role
   */
  async getUserRole(userId: string): Promise<string> {
    try {
      // Try to get from cache first
      const cachedPermissions = await permissionsCache.getPermissions(userId);
      if (cachedPermissions) {
        return cachedPermissions.role;
      }

      // Fetch from database
      const query = `
        SELECT r.name as role
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
      `;
      const result = await db.query(query, [userId]);

      if (result.rows.length === 0) {
        logger.warn('User not found for role', { userId });
        return '';
      }

      return result.rows[0].role;
    } catch (error) {
      logger.error('Error getting user role', { error, userId });
      return '';
    }
  }

  /**
   * Check if user owns resource
   * Requirement 2.7: Agents can only access their own data and assigned clients
   */
  async ownsResource(userId: string, resourceType: string, resourceId: string): Promise<boolean> {
    try {
      let query = '';
      let params: any[] = [];

      switch (resourceType) {
        case 'clients':
          query = 'SELECT agent_id FROM clients WHERE id = $1';
          params = [resourceId];
          break;

        case 'projects':
          query = `
            SELECT c.agent_id 
            FROM projects p
            JOIN clients c ON p.client_id = c.id
            WHERE p.id = $1
          `;
          params = [resourceId];
          break;

        case 'daily_reports':
          query = 'SELECT user_id FROM daily_reports WHERE id = $1';
          params = [resourceId];
          break;

        case 'tasks':
          query = 'SELECT assigned_to FROM tasks WHERE id = $1';
          params = [resourceId];
          break;

        default:
          logger.warn('Unknown resource type for ownership check', { resourceType });
          return false;
      }

      const result = await db.query(query, params);

      if (result.rows.length === 0) {
        return false;
      }

      const ownerId = result.rows[0].agent_id || result.rows[0].user_id || result.rows[0].assigned_to;
      return ownerId === userId;
    } catch (error) {
      logger.error('Error checking resource ownership', { error, userId, resourceType, resourceId });
      return false;
    }
  }

  /**
   * Invalidate user permissions cache
   * Requirement 2.9: Immediately apply new access permissions when role changes
   */
  async invalidateUserPermissions(userId: string): Promise<void> {
    try {
      await permissionsCache.deletePermissions(userId);
      logger.info('User permissions cache invalidated', { userId });
    } catch (error) {
      logger.error('Error invalidating user permissions', { error, userId });
    }
  }

  /**
   * Invalidate all permissions for a role
   * Used when role permissions are updated
   */
  async invalidateRolePermissions(role: string): Promise<void> {
    try {
      await permissionsCache.deleteRolePermissions(role);
      logger.info('Role permissions cache invalidated', { role });
    } catch (error) {
      logger.error('Error invalidating role permissions', { error, role });
    }
  }
}

export const authorizationService = new AuthorizationService();
export default authorizationService;
