import { db } from '../database/connection';
import logger from '../utils/logger';

export interface Department {
  id: string;
  name: string;
  type: 'COO' | 'CTO' | 'SALES';
  parentId?: string;
  headId?: string;
  createdAt: Date;
}

export interface OrganizationalNode {
  userId: string;
  fullName: string;
  email: string;
  roleId: string;
  roleName: string;
  departmentId?: string;
  departmentName?: string;
  managerId?: string;
  managerName?: string;
  directReports: OrganizationalNode[];
  spanOfControl: number;
}

export interface UpdateManagerInput {
  userId: string;
  managerId: string | null;
}

/**
 * Organization Service
 * Handles organizational hierarchy management, reporting structures, and department operations
 * Requirements: 18.1-18.12
 */
export class OrganizationService {
  /**
   * Set or update a user's manager
   * Requirement 18.7: Link users to appropriate managers
   * Requirement 18.10: Prevent circular reporting relationships
   */
  async setManager(userId: string, managerId: string | null): Promise<void> {
    try {
      // If setting a manager, validate no circular relationship
      if (managerId) {
        const hasCircular = await this.wouldCreateCircularRelationship(userId, managerId);
        if (hasCircular) {
          throw new Error('Cannot set manager: would create circular reporting relationship');
        }

        // Verify manager exists
        const managerResult = await db.query('SELECT id FROM users WHERE id = $1', [managerId]);
        if (managerResult.rows.length === 0) {
          throw new Error('Manager not found');
        }
      }

      // Update the user's manager
      await db.query('UPDATE users SET manager_id = $1, updated_at = NOW() WHERE id = $2', [
        managerId,
        userId,
      ]);

      logger.info('Manager updated successfully', { userId, managerId });
    } catch (error) {
      logger.error('Failed to set manager', { error, userId, managerId });
      throw error;
    }
  }

  /**
   * Check if setting a manager would create a circular reporting relationship
   * Requirement 18.10: Prevent circular reporting relationships
   */
  private async wouldCreateCircularRelationship(
    userId: string,
    newManagerId: string
  ): Promise<boolean> {
    try {
      // Check if newManagerId is in the reporting chain of userId
      // This would create a circular relationship
      let currentManagerId: string | null = newManagerId;
      const visited = new Set<string>([userId]);

      while (currentManagerId) {
        if (visited.has(currentManagerId)) {
          // Found a cycle
          return true;
        }

        visited.add(currentManagerId);

        // Get the manager's manager
        const result: { rows: Array<{ manager_id: string | null }> } = await db.query('SELECT manager_id FROM users WHERE id = $1', [
          currentManagerId,
        ]);

        if (result.rows.length === 0) {
          break;
        }

        currentManagerId = result.rows[0].manager_id;
      }

      return false;
    } catch (error) {
      logger.error('Failed to check circular relationship', { error, userId, newManagerId });
      throw error;
    }
  }

  /**
   * Get direct reports for a manager
   * Requirement 18.9: Display direct reports for each manager role
   */
  async getDirectReports(managerId: string): Promise<OrganizationalNode[]> {
    try {
      const result = await db.query(
        `SELECT u.id, u.full_name, u.email, u.role_id, u.department_id, u.manager_id,
                r.name as role_name,
                d.name as department_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.manager_id = $1
         ORDER BY u.full_name`,
        [managerId]
      );

      const directReports: OrganizationalNode[] = [];

      for (const row of result.rows) {
        const spanOfControl = await this.getSpanOfControl(row.id);
        const subordinates = await this.getDirectReports(row.id);

        directReports.push({
          userId: row.id,
          fullName: row.full_name,
          email: row.email,
          roleId: row.role_id,
          roleName: row.role_name,
          departmentId: row.department_id,
          departmentName: row.department_name,
          managerId: row.manager_id,
          managerName: undefined,
          directReports: subordinates,
          spanOfControl,
        });
      }

      return directReports;
    } catch (error) {
      logger.error('Failed to get direct reports', { error, managerId });
      throw error;
    }
  }

  /**
   * Calculate span of control (number of direct reports) for a manager
   * Requirement 18.12: Calculate span of control for each manager
   */
  async getSpanOfControl(managerId: string): Promise<number> {
    try {
      const result = await db.query(
        'SELECT COUNT(*) as count FROM users WHERE manager_id = $1',
        [managerId]
      );

      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Failed to get span of control', { error, managerId });
      throw error;
    }
  }

  /**
   * Get organizational chart as a tree structure
   * Requirement 18.8: Allow viewing organizational chart as a tree visualization
   */
  async getOrganizationalChart(): Promise<OrganizationalNode[]> {
    try {
      // Get all users with no manager (top-level, typically CEO)
      const result = await db.query(
        `SELECT u.id, u.full_name, u.email, u.role_id, u.department_id, u.manager_id,
                r.name as role_name,
                d.name as department_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.manager_id IS NULL
         ORDER BY u.full_name`
      );

      const chart: OrganizationalNode[] = [];

      for (const row of result.rows) {
        const spanOfControl = await this.getSpanOfControl(row.id);
        const directReports = await this.getDirectReports(row.id);

        chart.push({
          userId: row.id,
          fullName: row.full_name,
          email: row.email,
          roleId: row.role_id,
          roleName: row.role_name,
          departmentId: row.department_id,
          departmentName: row.department_name,
          managerId: row.manager_id,
          managerName: undefined,
          directReports,
          spanOfControl,
        });
      }

      return chart;
    } catch (error) {
      logger.error('Failed to get organizational chart', { error });
      throw error;
    }
  }

  /**
   * Get a user's reporting chain (all managers up to CEO)
   */
  async getReportingChain(userId: string): Promise<OrganizationalNode[]> {
    try {
      const chain: OrganizationalNode[] = [];
      let currentUserId: string | null = userId;

      while (currentUserId) {
        const result: { rows: any[] } = await db.query(
          `SELECT u.id, u.full_name, u.email, u.role_id, u.department_id, u.manager_id,
                  r.name as role_name,
                  d.name as department_name,
                  m.full_name as manager_name
           FROM users u
           JOIN roles r ON u.role_id = r.id
           LEFT JOIN departments d ON u.department_id = d.id
           LEFT JOIN users m ON u.manager_id = m.id
           WHERE u.id = $1`,
          [currentUserId]
        );

        if (result.rows.length === 0) {
          break;
        }

        const row = result.rows[0];
        const spanOfControl = await this.getSpanOfControl(row.id);

        chain.push({
          userId: row.id,
          fullName: row.full_name,
          email: row.email,
          roleId: row.role_id,
          roleName: row.role_name,
          departmentId: row.department_id,
          departmentName: row.department_name,
          managerId: row.manager_id,
          managerName: row.manager_name,
          directReports: [],
          spanOfControl,
        });

        currentUserId = row.manager_id;
      }

      return chain;
    } catch (error) {
      logger.error('Failed to get reporting chain', { error, userId });
      throw error;
    }
  }

  /**
   * Create a department
   * Requirement 18.3: Organize COO departments
   * Requirement 18.4: Organize CTO departments
   */
  async createDepartment(
    name: string,
    type: 'COO' | 'CTO' | 'SALES',
    parentId?: string,
    headId?: string
  ): Promise<Department> {
    try {
      // Validate parent department exists if provided
      if (parentId) {
        const parentResult = await db.query('SELECT id FROM departments WHERE id = $1', [
          parentId,
        ]);
        if (parentResult.rows.length === 0) {
          throw new Error('Parent department not found');
        }
      }

      // Validate head user exists if provided
      if (headId) {
        const headResult = await db.query('SELECT id FROM users WHERE id = $1', [headId]);
        if (headResult.rows.length === 0) {
          throw new Error('Department head user not found');
        }
      }

      const result = await db.query(
        `INSERT INTO departments (name, type, parent_id, head_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, type, parent_id, head_id, created_at`,
        [name, type, parentId, headId]
      );

      const dept = result.rows[0];

      logger.info('Department created successfully', { departmentId: dept.id, name, type });

      return {
        id: dept.id,
        name: dept.name,
        type: dept.type,
        parentId: dept.parent_id,
        headId: dept.head_id,
        createdAt: dept.created_at,
      };
    } catch (error) {
      logger.error('Failed to create department', { error, name, type });
      throw error;
    }
  }

  /**
   * Get all departments
   */
  async getDepartments(type?: 'COO' | 'CTO' | 'SALES'): Promise<Department[]> {
    try {
      let query = 'SELECT id, name, type, parent_id, head_id, created_at FROM departments';
      const params: any[] = [];

      if (type) {
        query += ' WHERE type = $1';
        params.push(type);
      }

      query += ' ORDER BY name';

      const result = await db.query(query, params);

      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        parentId: row.parent_id,
        headId: row.head_id,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('Failed to get departments', { error, type });
      throw error;
    }
  }

  /**
   * Get department by ID
   */
  async getDepartmentById(departmentId: string): Promise<Department | null> {
    try {
      const result = await db.query(
        'SELECT id, name, type, parent_id, head_id, created_at FROM departments WHERE id = $1',
        [departmentId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        type: row.type,
        parentId: row.parent_id,
        headId: row.head_id,
        createdAt: row.created_at,
      };
    } catch (error) {
      logger.error('Failed to get department', { error, departmentId });
      throw error;
    }
  }

  /**
   * Update department
   */
  async updateDepartment(
    departmentId: string,
    updates: { name?: string; headId?: string }
  ): Promise<Department> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        fields.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }

      if (updates.headId !== undefined) {
        // Validate head user exists
        if (updates.headId) {
          const headResult = await db.query('SELECT id FROM users WHERE id = $1', [
            updates.headId,
          ]);
          if (headResult.rows.length === 0) {
            throw new Error('Department head user not found');
          }
        }
        fields.push(`head_id = $${paramIndex++}`);
        values.push(updates.headId);
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(departmentId);

      const query = `
        UPDATE departments
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, name, type, parent_id, head_id, created_at
      `;

      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Department not found');
      }

      const row = result.rows[0];

      logger.info('Department updated successfully', { departmentId, updates });

      return {
        id: row.id,
        name: row.name,
        type: row.type,
        parentId: row.parent_id,
        headId: row.head_id,
        createdAt: row.created_at,
      };
    } catch (error) {
      logger.error('Failed to update department', { error, departmentId, updates });
      throw error;
    }
  }

  /**
   * Get users in a department
   */
  async getDepartmentUsers(departmentId: string): Promise<any[]> {
    try {
      const result = await db.query(
        `SELECT u.id, u.full_name, u.email, u.role_id, u.manager_id,
                r.name as role_name,
                m.full_name as manager_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN users m ON u.manager_id = m.id
         WHERE u.department_id = $1
         ORDER BY u.full_name`,
        [departmentId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        roleId: row.role_id,
        roleName: row.role_name,
        managerId: row.manager_id,
        managerName: row.manager_name,
      }));
    } catch (error) {
      logger.error('Failed to get department users', { error, departmentId });
      throw error;
    }
  }
}

export const organizationService = new OrganizationService();
export default organizationService;
