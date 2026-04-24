import request from 'supertest';
import express from 'express';
import organizationRoutes from './organizationRoutes';
import { organizationService } from './organizationService';

// Mock the organization service
jest.mock('./organizationService');

// Mock logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use('/api/v1/organization', organizationRoutes);

describe('Organization Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/organization/chart', () => {
    it('should return organizational chart', async () => {
      const mockChart = [
        {
          userId: 'ceo-1',
          fullName: 'CEO User',
          email: 'ceo@example.com',
          roleId: 'role-ceo',
          roleName: 'CEO',
          directReports: [],
          spanOfControl: 3,
        },
      ];

      (organizationService.getOrganizationalChart as jest.Mock).mockResolvedValue(mockChart);

      const response = await request(app).get('/api/v1/organization/chart');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockChart);
    });

    it('should handle errors', async () => {
      (organizationService.getOrganizationalChart as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app).get('/api/v1/organization/chart');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/organization/users/:userId/reports', () => {
    it('should return direct reports for a user', async () => {
      const userId = 'manager-123';
      const mockReports = [
        {
          userId: 'user-1',
          fullName: 'John Doe',
          email: 'john@example.com',
          roleId: 'role-1',
          roleName: 'Agent',
          directReports: [],
          spanOfControl: 0,
        },
      ];

      (organizationService.getDirectReports as jest.Mock).mockResolvedValue(mockReports);

      const response = await request(app).get(
        `/api/v1/organization/users/${userId}/reports`
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockReports);
    });
  });

  describe('GET /api/v1/organization/users/:userId/span', () => {
    it('should return span of control for a user', async () => {
      const userId = 'manager-123';
      const mockSpan = 5;

      (organizationService.getSpanOfControl as jest.Mock).mockResolvedValue(mockSpan);

      const response = await request(app).get(`/api/v1/organization/users/${userId}/span`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.spanOfControl).toBe(mockSpan);
    });
  });

  describe('GET /api/v1/organization/users/:userId/chain', () => {
    it('should return reporting chain for a user', async () => {
      const userId = 'user-123';
      const mockChain = [
        {
          userId: 'user-123',
          fullName: 'John Doe',
          email: 'john@example.com',
          roleId: 'role-1',
          roleName: 'Agent',
          managerId: 'manager-1',
          managerName: 'Manager One',
          directReports: [],
          spanOfControl: 0,
        },
        {
          userId: 'manager-1',
          fullName: 'Manager One',
          email: 'manager@example.com',
          roleId: 'role-2',
          roleName: 'Trainer',
          managerId: null,
          managerName: null,
          directReports: [],
          spanOfControl: 5,
        },
      ];

      (organizationService.getReportingChain as jest.Mock).mockResolvedValue(mockChain);

      const response = await request(app).get(`/api/v1/organization/users/${userId}/chain`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockChain);
    });
  });

  describe('PUT /api/v1/organization/users/:userId/manager', () => {
    it('should set a manager for a user', async () => {
      const userId = 'user-123';
      const managerId = 'manager-456';

      (organizationService.setManager as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .put(`/api/v1/organization/users/${userId}/manager`)
        .send({ managerId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(organizationService.setManager).toHaveBeenCalledWith(userId, managerId);
    });

    it('should allow removing a manager by setting null', async () => {
      const userId = 'user-123';

      (organizationService.setManager as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .put(`/api/v1/organization/users/${userId}/manager`)
        .send({ managerId: null });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(organizationService.setManager).toHaveBeenCalledWith(userId, null);
    });

    it('should return 400 if managerId is not provided', async () => {
      const userId = 'user-123';

      const response = await request(app)
        .put(`/api/v1/organization/users/${userId}/manager`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('managerId is required');
    });

    it('should return 400 for circular reporting relationship', async () => {
      const userId = 'user-123';
      const managerId = 'manager-456';

      (organizationService.setManager as jest.Mock).mockRejectedValue(
        new Error('Cannot set manager: would create circular reporting relationship')
      );

      const response = await request(app)
        .put(`/api/v1/organization/users/${userId}/manager`)
        .send({ managerId });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('circular');
    });
  });

  describe('POST /api/v1/organization/departments', () => {
    it('should create a department', async () => {
      const departmentData = {
        name: 'Client Acquisition',
        type: 'COO',
      };

      const mockDepartment = {
        id: 'dept-123',
        ...departmentData,
        parentId: undefined,
        headId: undefined,
        createdAt: new Date(),
      };

      (organizationService.createDepartment as jest.Mock).mockResolvedValue(mockDepartment);

      const response = await request(app)
        .post('/api/v1/organization/departments')
        .send(departmentData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(departmentData.name);
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/api/v1/organization/departments')
        .send({ type: 'COO' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('name and type are required');
    });

    it('should return 400 if type is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/organization/departments')
        .send({ name: 'Test', type: 'INVALID' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('type must be one of');
    });
  });

  describe('GET /api/v1/organization/departments', () => {
    it('should return all departments', async () => {
      const mockDepartments = [
        {
          id: 'dept-1',
          name: 'Client Acquisition',
          type: 'COO',
          parentId: null,
          headId: null,
          createdAt: new Date(),
        },
        {
          id: 'dept-2',
          name: 'Core & Security',
          type: 'CTO',
          parentId: null,
          headId: null,
          createdAt: new Date(),
        },
      ];

      (organizationService.getDepartments as jest.Mock).mockResolvedValue(mockDepartments);

      const response = await request(app).get('/api/v1/organization/departments');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject(
        mockDepartments.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))
      );
    });

    it('should filter departments by type', async () => {
      const mockDepartments = [
        {
          id: 'dept-1',
          name: 'Client Acquisition',
          type: 'COO',
          parentId: null,
          headId: null,
          createdAt: new Date(),
        },
      ];

      (organizationService.getDepartments as jest.Mock).mockResolvedValue(mockDepartments);

      const response = await request(app).get('/api/v1/organization/departments?type=COO');

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject(
        mockDepartments.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))
      );
    });
  });

  describe('GET /api/v1/organization/departments/:id', () => {
    it('should return a department by ID', async () => {
      const departmentId = 'dept-123';
      const mockDepartment = {
        id: departmentId,
        name: 'Client Acquisition',
        type: 'COO',
        parentId: null,
        headId: null,
        createdAt: new Date(),
      };

      (organizationService.getDepartmentById as jest.Mock).mockResolvedValue(mockDepartment);

      const response = await request(app).get(`/api/v1/organization/departments/${departmentId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({ ...mockDepartment, createdAt: mockDepartment.createdAt.toISOString() });
    });

    it('should return 404 if department not found', async () => {
      const departmentId = 'nonexistent';

      (organizationService.getDepartmentById as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get(`/api/v1/organization/departments/${departmentId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/organization/departments/:id', () => {
    it('should update a department', async () => {
      const departmentId = 'dept-123';
      const updates = { name: 'Updated Name' };
      const mockDepartment = {
        id: departmentId,
        name: updates.name,
        type: 'COO',
        parentId: null,
        headId: null,
        createdAt: new Date(),
      };

      (organizationService.updateDepartment as jest.Mock).mockResolvedValue(mockDepartment);

      const response = await request(app)
        .put(`/api/v1/organization/departments/${departmentId}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updates.name);
    });
  });

  describe('GET /api/v1/organization/departments/:id/users', () => {
    it('should return users in a department', async () => {
      const departmentId = 'dept-123';
      const mockUsers = [
        {
          id: 'user-1',
          fullName: 'John Doe',
          email: 'john@example.com',
          roleId: 'role-1',
          roleName: 'Agent',
          managerId: 'manager-1',
          managerName: 'Manager One',
        },
      ];

      (organizationService.getDepartmentUsers as jest.Mock).mockResolvedValue(mockUsers);

      const response = await request(app).get(
        `/api/v1/organization/departments/${departmentId}/users`
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUsers);
    });
  });
});
