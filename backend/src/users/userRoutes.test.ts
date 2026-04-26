import request from 'supertest';
import express from 'express';
import userRoutes from './userRoutes';
import { userService } from './userService';

jest.mock('./userService');
jest.mock('../utils/logger');

const app = express();
app.use(express.json());

// Mock authentication middleware - must be registered before routes
app.use((req, _res, next) => {
  (req as any).user = { id: 'admin-123', role: 'CEO' };
  next();
});

app.use('/api/v1/users', userRoutes);

describe('User Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/users/invite', () => {
    it('should send invitation email', async () => {
      const mockInvitation = {
        id: 'inv-123',
        email: 'newuser@test.com',
        token: 'test-token',
        roleId: 'role-123',
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        createdBy: 'admin-123',
        createdAt: new Date(),
      };

      (userService.sendInvitation as jest.Mock).mockResolvedValue(mockInvitation);

      const response = await request(app)
        .post('/api/v1/users/invite')
        .send({
          email: 'newuser@test.com',
          roleId: 'role-123',
          departmentId: 'dept-123',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('newuser@test.com');
    });

    it('should return 400 if email is missing', async () => {
      const response = await request(app).post('/api/v1/users/invite').send({
        roleId: 'role-123',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/users/invite/validate/:token', () => {
    it('should validate invitation token', async () => {
      const mockInvitation = {
        id: 'inv-123',
        email: 'user@test.com',
        token: 'valid-token',
        roleId: 'role-123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdBy: 'admin-123',
        createdAt: new Date(),
      };

      (userService.validateInvitationToken as jest.Mock).mockResolvedValue(mockInvitation);

      const response = await request(app).get('/api/v1/users/invite/validate/valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('user@test.com');
    });

    it('should return 404 for invalid token', async () => {
      (userService.validateInvitationToken as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/v1/users/invite/validate/invalid-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/users/register', () => {
    it('should register user from invitation', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'newuser@test.com',
        fullName: 'New User',
        phone: '+254712345678',
        country: 'Kenya',
        roleId: 'role-123',
        roleName: 'AGENT',
        departmentId: 'dept-123',
        languagePreference: 'en',
        timezone: 'UTC',
        twoFaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (userService.createUserFromInvitation as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/v1/users/register')
        .send({
          token: 'valid-token',
          email: 'newuser@test.com',
          password: 'SecurePass123!@',
          fullName: 'New User',
          phone: '+254712345678',
          country: 'Kenya',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('newuser@test.com');
    });

    it('should reject weak password', async () => {
      const response = await request(app)
        .post('/api/v1/users/register')
        .send({
          token: 'valid-token',
          email: 'newuser@test.com',
          password: 'weak',
          fullName: 'New User',
          phone: '+254712345678',
          country: 'Kenya',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Password must be at least 12 characters');
    });
  });

  describe('GET /api/v1/users/me', () => {
    it('should return current user profile', async () => {
      const mockUser = {
        id: 'admin-123',
        email: 'admin@test.com',
        fullName: 'Admin User',
        phone: '+254712345678',
        country: 'Kenya',
        roleId: 'role-123',
        roleName: 'CEO',
        languagePreference: 'en',
        timezone: 'UTC',
        twoFaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (userService.getUserById as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app).get('/api/v1/users/me');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('admin@test.com');
    });
  });

  describe('PUT /api/v1/users/me', () => {
    it('should update user profile', async () => {
      const mockUser = {
        id: 'admin-123',
        email: 'admin@test.com',
        fullName: 'Updated Name',
        phone: '+254700000000',
        country: 'Tanzania',
        roleId: 'role-123',
        roleName: 'CEO',
        languagePreference: 'en',
        timezone: 'UTC',
        twoFaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (userService.updateUser as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app).put('/api/v1/users/me').send({
        fullName: 'Updated Name',
        phone: '+254700000000',
        country: 'Tanzania',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.fullName).toBe('Updated Name');
    });
  });

  describe('POST /api/v1/users/me/password', () => {
    it('should change password', async () => {
      (userService.changePassword as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app).post('/api/v1/users/me/password').send({
        currentPassword: 'OldPass123!@',
        newPassword: 'NewPass456!@',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject weak new password', async () => {
      const response = await request(app).post('/api/v1/users/me/password').send({
        currentPassword: 'OldPass123!@',
        newPassword: 'weak',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Password must be at least 12 characters');
    });
  });

  describe('GET /api/v1/users', () => {
    it('should list users with pagination', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@test.com',
          fullName: 'User One',
          phone: '+254712345678',
          country: 'Kenya',
          roleId: 'role-123',
          roleName: 'AGENT',
          languagePreference: 'en',
          timezone: 'UTC',
          twoFaEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (userService.listUsers as jest.Mock).mockResolvedValue({
        users: mockUsers,
        total: 1,
      });

      const response = await request(app).get('/api/v1/users?limit=50&offset=0');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should get user by ID', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@test.com',
        fullName: 'Test User',
        phone: '+254712345678',
        country: 'Kenya',
        roleId: 'role-123',
        roleName: 'AGENT',
        languagePreference: 'en',
        timezone: 'UTC',
        twoFaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (userService.getUserById as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app).get('/api/v1/users/user-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('user@test.com');
    });

    it('should return 404 for non-existent user', async () => {
      (userService.getUserById as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/v1/users/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('should delete user', async () => {
      (userService.deleteUser as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app).delete('/api/v1/users/user-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
