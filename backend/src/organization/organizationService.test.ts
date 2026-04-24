import { organizationService } from './organizationService';
import { db } from '../database/connection';

// Mock the database connection
jest.mock('../database/connection', () => ({
  db: {
    query: jest.fn(),
  },
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('OrganizationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setManager', () => {
    it('should set a manager for a user', async () => {
      const userId = 'user-123';
      const managerId = 'manager-456';

      // Mock circular check - no circular relationship
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ manager_id: null }] }) // Manager's manager check
        .mockResolvedValueOnce({ rows: [{ id: managerId }] }) // Manager exists check
        .mockResolvedValueOnce({ rows: [] }); // Update query

      await organizationService.setManager(userId, managerId);

      expect(db.query).toHaveBeenCalledWith(
        'UPDATE users SET manager_id = $1, updated_at = NOW() WHERE id = $2',
        [managerId, userId]
      );
    });

    it('should allow removing a manager by setting null', async () => {
      const userId = 'user-123';

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // Update query

      await organizationService.setManager(userId, null);

      expect(db.query).toHaveBeenCalledWith(
        'UPDATE users SET manager_id = $1, updated_at = NOW() WHERE id = $2',
        [null, userId]
      );
    });

    it('should throw error if manager does not exist', async () => {
      const userId = 'user-123';
      const managerId = 'nonexistent-manager';

      // Mock circular check - no circular relationship
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ manager_id: null }] }) // Manager's manager check
        .mockResolvedValueOnce({ rows: [] }); // Manager exists check - empty result

      await expect(organizationService.setManager(userId, managerId)).rejects.toThrow(
        'Manager not found'
      );
    });

    it('should prevent circular reporting relationships', async () => {
      const userId = 'user-123';
      const managerId = 'manager-456';

      // Mock circular check - creates circular relationship
      // user-123 -> manager-456 -> user-123 (circular)
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ manager_id: userId }],
      });

      await expect(organizationService.setManager(userId, managerId)).rejects.toThrow(
        'Cannot set manager: would create circular reporting relationship'
      );
    });
  });

  describe('getDirectReports', () => {
    it('should return direct reports for a manager', async () => {
      const managerId = 'manager-123';

      (db.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'user-1',
              full_name: 'John Doe',
              email: 'john@example.com',
              role_id: 'role-1',
              role_name: 'Agent',
              department_id: 'dept-1',
              department_name: 'Sales',
              manager_id: managerId,
            },
            {
              id: 'user-2',
              full_name: 'Jane Smith',
              email: 'jane@example.com',
              role_id: 'role-1',
              role_name: 'Agent',
              department_id: 'dept-1',
              department_name: 'Sales',
              manager_id: managerId,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Span of control for user-1
        .mockResolvedValueOnce({ rows: [] }) // Direct reports for user-1
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Span of control for user-2
        .mockResolvedValueOnce({ rows: [] }); // Direct reports for user-2

      const reports = await organizationService.getDirectReports(managerId);

      expect(reports).toHaveLength(2);
      expect(reports[0].fullName).toBe('John Doe');
      expect(reports[1].fullName).toBe('Jane Smith');
      expect(reports[0].spanOfControl).toBe(0);
    });

    it('should return empty array if manager has no direct reports', async () => {
      const managerId = 'manager-123';

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const reports = await organizationService.getDirectReports(managerId);

      expect(reports).toHaveLength(0);
    });
  });

  describe('getSpanOfControl', () => {
    it('should return the number of direct reports', async () => {
      const managerId = 'manager-123';

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const span = await organizationService.getSpanOfControl(managerId);

      expect(span).toBe(5);
    });

    it('should return 0 if manager has no direct reports', async () => {
      const managerId = 'manager-123';

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const span = await organizationService.getSpanOfControl(managerId);

      expect(span).toBe(0);
    });
  });

  describe('getOrganizationalChart', () => {
    it('should return organizational chart starting from top-level users', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'ceo-1',
              full_name: 'CEO User',
              email: 'ceo@example.com',
              role_id: 'role-ceo',
              role_name: 'CEO',
              department_id: null,
              department_name: null,
              manager_id: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // Span of control for CEO
        .mockResolvedValueOnce({ rows: [] }); // Direct reports for CEO (simplified)

      const chart = await organizationService.getOrganizationalChart();

      expect(chart).toHaveLength(1);
      expect(chart[0].roleName).toBe('CEO');
      expect(chart[0].spanOfControl).toBe(3);
    });
  });

  describe('getReportingChain', () => {
    it('should return reporting chain from user to top-level', async () => {
      const userId = 'user-123';

      (db.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [
            {
              id: userId,
              full_name: 'John Doe',
              email: 'john@example.com',
              role_id: 'role-1',
              role_name: 'Agent',
              department_id: 'dept-1',
              department_name: 'Sales',
              manager_id: 'manager-1',
              manager_name: 'Manager One',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Span of control
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'manager-1',
              full_name: 'Manager One',
              email: 'manager@example.com',
              role_id: 'role-2',
              role_name: 'Trainer',
              department_id: 'dept-1',
              department_name: 'Sales',
              manager_id: null,
              manager_name: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }); // Span of control

      const chain = await organizationService.getReportingChain(userId);

      expect(chain).toHaveLength(2);
      expect(chain[0].fullName).toBe('John Doe');
      expect(chain[1].fullName).toBe('Manager One');
    });
  });

  describe('createDepartment', () => {
    it('should create a department', async () => {
      const name = 'Client Acquisition';
      const type = 'COO';

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'dept-123',
            name,
            type,
            parent_id: null,
            head_id: null,
            created_at: new Date(),
          },
        ],
      });

      const department = await organizationService.createDepartment(name, type);

      expect(department.name).toBe(name);
      expect(department.type).toBe(type);
    });

    it('should create a department with parent and head', async () => {
      const name = 'Developer Team 1';
      const type = 'CTO';
      const parentId = 'parent-dept-123';
      const headId = 'head-user-456';

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: parentId }] }) // Parent exists
        .mockResolvedValueOnce({ rows: [{ id: headId }] }) // Head exists
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'dept-123',
              name,
              type,
              parent_id: parentId,
              head_id: headId,
              created_at: new Date(),
            },
          ],
        });

      const department = await organizationService.createDepartment(name, type, parentId, headId);

      expect(department.parentId).toBe(parentId);
      expect(department.headId).toBe(headId);
    });

    it('should throw error if parent department does not exist', async () => {
      const name = 'Test Department';
      const type = 'COO';
      const parentId = 'nonexistent-parent';

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // Parent not found

      await expect(
        organizationService.createDepartment(name, type, parentId)
      ).rejects.toThrow('Parent department not found');
    });

    it('should throw error if head user does not exist', async () => {
      const name = 'Test Department';
      const type = 'COO';
      const headId = 'nonexistent-head';

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // Head not found

      await expect(
        organizationService.createDepartment(name, type, undefined, headId)
      ).rejects.toThrow('Department head user not found');
    });
  });

  describe('getDepartments', () => {
    it('should return all departments', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'dept-1',
            name: 'Client Acquisition',
            type: 'COO',
            parent_id: null,
            head_id: null,
            created_at: new Date(),
          },
          {
            id: 'dept-2',
            name: 'Core & Security',
            type: 'CTO',
            parent_id: null,
            head_id: null,
            created_at: new Date(),
          },
        ],
      });

      const departments = await organizationService.getDepartments();

      expect(departments).toHaveLength(2);
    });

    it('should filter departments by type', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'dept-1',
            name: 'Client Acquisition',
            type: 'COO',
            parent_id: null,
            head_id: null,
            created_at: new Date(),
          },
        ],
      });

      const departments = await organizationService.getDepartments('COO');

      expect(departments).toHaveLength(1);
      expect(departments[0].type).toBe('COO');
    });
  });

  describe('updateDepartment', () => {
    it('should update department name', async () => {
      const departmentId = 'dept-123';
      const newName = 'Updated Department Name';

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: departmentId,
            name: newName,
            type: 'COO',
            parent_id: null,
            head_id: null,
            created_at: new Date(),
          },
        ],
      });

      const department = await organizationService.updateDepartment(departmentId, {
        name: newName,
      });

      expect(department.name).toBe(newName);
    });

    it('should update department head', async () => {
      const departmentId = 'dept-123';
      const newHeadId = 'head-456';

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: newHeadId }] }) // Head exists
        .mockResolvedValueOnce({
          rows: [
            {
              id: departmentId,
              name: 'Test Department',
              type: 'COO',
              parent_id: null,
              head_id: newHeadId,
              created_at: new Date(),
            },
          ],
        });

      const department = await organizationService.updateDepartment(departmentId, {
        headId: newHeadId,
      });

      expect(department.headId).toBe(newHeadId);
    });

    it('should throw error if no fields to update', async () => {
      const departmentId = 'dept-123';

      await expect(organizationService.updateDepartment(departmentId, {})).rejects.toThrow(
        'No fields to update'
      );
    });
  });

  describe('getDepartmentUsers', () => {
    it('should return users in a department', async () => {
      const departmentId = 'dept-123';

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'user-1',
            full_name: 'John Doe',
            email: 'john@example.com',
            role_id: 'role-1',
            role_name: 'Agent',
            manager_id: 'manager-1',
            manager_name: 'Manager One',
          },
          {
            id: 'user-2',
            full_name: 'Jane Smith',
            email: 'jane@example.com',
            role_id: 'role-1',
            role_name: 'Agent',
            manager_id: 'manager-1',
            manager_name: 'Manager One',
          },
        ],
      });

      const users = await organizationService.getDepartmentUsers(departmentId);

      expect(users).toHaveLength(2);
      expect(users[0].fullName).toBe('John Doe');
      expect(users[1].fullName).toBe('Jane Smith');
    });
  });
});
