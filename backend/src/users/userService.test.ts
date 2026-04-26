import { UserService } from './userService';
import { db } from '../database/connection';
import { authService } from '../auth/authService';
import { sendgridClient } from '../services/sendgrid/client';

jest.mock('../database/connection');
jest.mock('../auth/authService');
jest.mock('../services/sendgrid/client');
jest.mock('../utils/logger');

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
    jest.clearAllMocks();
  });

  describe('sendInvitation', () => {
    it('should send invitation email with 72-hour expiry', async () => {
      const mockInvitationData = {
        email: 'newuser@test.com',
        roleId: 'role-123',
        departmentId: 'dept-123',
        invitedBy: 'admin-123',
      };

      // Mock no existing user
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // Mock no existing invitation
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // Mock invitation creation
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'inv-123',
            email: mockInvitationData.email,
            token: 'test-token-123',
            role_id: mockInvitationData.roleId,
            department_id: mockInvitationData.departmentId,
            expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000),
            created_by: mockInvitationData.invitedBy,
            created_at: new Date(),
          },
        ],
      });
      // Mock role query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ name: 'AGENT' }],
      });

      (sendgridClient.sendInvitationEmail as jest.Mock).mockResolvedValue(undefined);

      const result = await service.sendInvitation(mockInvitationData);

      expect(result.email).toBe(mockInvitationData.email);
      expect(result.roleId).toBe(mockInvitationData.roleId);
      expect(sendgridClient.sendInvitationEmail).toHaveBeenCalledWith(
        mockInvitationData.email,
        expect.stringContaining('token='),
        'AGENT'
      );
    });

    it('should reject invitation if user already exists', async () => {
      const mockInvitationData = {
        email: 'existing@test.com',
        roleId: 'role-123',
        invitedBy: 'admin-123',
      };

      // Mock existing user
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'user-123' }],
      });

      await expect(service.sendInvitation(mockInvitationData)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it('should reject invitation if active invitation exists', async () => {
      const mockInvitationData = {
        email: 'invited@test.com',
        roleId: 'role-123',
        invitedBy: 'admin-123',
      };

      // Mock no existing user
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // Mock existing active invitation
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'inv-123' }],
      });

      await expect(service.sendInvitation(mockInvitationData)).rejects.toThrow(
        'Active invitation already exists for this email'
      );
    });
  });

  describe('validateInvitationToken', () => {
    it('should validate valid invitation token', async () => {
      const mockToken = 'valid-token-123';
      const mockInvitation = {
        id: 'inv-123',
        email: 'user@test.com',
        token: mockToken,
        role_id: 'role-123',
        department_id: 'dept-123',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        used_at: null,
        created_by: 'admin-123',
        created_at: new Date(),
      };

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockInvitation],
      });

      const result = await service.validateInvitationToken(mockToken);

      expect(result).not.toBeNull();
      expect(result?.email).toBe(mockInvitation.email);
      expect(result?.token).toBe(mockToken);
    });

    it('should reject expired invitation token', async () => {
      const mockToken = 'expired-token-123';
      const mockInvitation = {
        id: 'inv-123',
        email: 'user@test.com',
        token: mockToken,
        role_id: 'role-123',
        department_id: 'dept-123',
        expires_at: new Date(Date.now() - 1000), // Expired
        used_at: null,
        created_by: 'admin-123',
        created_at: new Date(),
      };

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockInvitation],
      });

      await expect(service.validateInvitationToken(mockToken)).rejects.toThrow(
        'This invitation has expired'
      );
    });

    it('should reject already used invitation token', async () => {
      const mockToken = 'used-token-123';
      const mockInvitation = {
        id: 'inv-123',
        email: 'user@test.com',
        token: mockToken,
        role_id: 'role-123',
        department_id: 'dept-123',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        used_at: new Date(), // Already used
        created_by: 'admin-123',
        created_at: new Date(),
      };

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockInvitation],
      });

      await expect(service.validateInvitationToken(mockToken)).rejects.toThrow(
        'This invitation has already been used'
      );
    });

    it('should return null for invalid token', async () => {
      const mockToken = 'invalid-token-123';

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const result = await service.validateInvitationToken(mockToken);

      expect(result).toBeNull();
    });
  });

  describe('createUserFromInvitation', () => {
    it('should create user from valid invitation', async () => {
      const mockToken = 'valid-token-123';
      const mockUserData = {
        email: 'newuser@test.com',
        password: 'SecurePass123!',
        fullName: 'New User',
        phone: '+254712345678',
        country: 'Kenya',
        roleId: 'role-123',
      };

      const mockInvitation = {
        id: 'inv-123',
        email: mockUserData.email,
        token: mockToken,
        roleId: 'role-123',
        departmentId: 'dept-123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdBy: 'admin-123',
        createdAt: new Date(),
      };

      // Mock validateInvitationToken
      jest.spyOn(service, 'validateInvitationToken').mockResolvedValueOnce(mockInvitation);

      // Mock password hashing
      (authService.hashPassword as jest.Mock).mockResolvedValueOnce('hashed-password');

      // Mock user creation
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'user-123',
            email: mockUserData.email,
            full_name: mockUserData.fullName,
            phone: mockUserData.phone,
            country: mockUserData.country,
            role_id: 'role-123',
            department_id: 'dept-123',
            language_preference: 'en',
            timezone: 'UTC',
            two_fa_enabled: false,
            profile_photo_url: null,
            last_login: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      // Mock marking invitation as used
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Mock role query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ name: 'AGENT' }],
      });

      const result = await service.createUserFromInvitation(mockToken, mockUserData);

      expect(result.email).toBe(mockUserData.email);
      expect(result.fullName).toBe(mockUserData.fullName);
      expect(authService.hashPassword).toHaveBeenCalledWith(mockUserData.password);
    });

    it('should reject if email does not match invitation', async () => {
      const mockToken = 'valid-token-123';
      const mockUserData = {
        email: 'different@test.com',
        password: 'SecurePass123!',
        fullName: 'New User',
        phone: '+254712345678',
        country: 'Kenya',
        roleId: 'role-123',
      };

      const mockInvitation = {
        id: 'inv-123',
        email: 'original@test.com',
        token: mockToken,
        roleId: 'role-123',
        departmentId: 'dept-123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdBy: 'admin-123',
        createdAt: new Date(),
      };

      jest.spyOn(service, 'validateInvitationToken').mockResolvedValueOnce(mockInvitation);

      await expect(service.createUserFromInvitation(mockToken, mockUserData)).rejects.toThrow(
        'Email does not match invitation'
      );
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      const mockUserId = 'user-123';
      const mockUser = {
        id: mockUserId,
        email: 'user@test.com',
        full_name: 'Test User',
        phone: '+254712345678',
        country: 'Kenya',
        role_id: 'role-123',
        role_name: 'AGENT',
        department_id: 'dept-123',
        github_username: null,
        language_preference: 'en',
        timezone: 'UTC',
        two_fa_enabled: false,
        profile_photo_url: null,
        last_login: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockUser],
      });

      const result = await service.getUserById(mockUserId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockUserId);
      expect(result?.email).toBe(mockUser.email);
    });

    it('should return null for non-existent user', async () => {
      const mockUserId = 'non-existent-123';

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const result = await service.getUserById(mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user profile', async () => {
      const mockUserId = 'user-123';
      const mockUpdates = {
        fullName: 'Updated Name',
        phone: '+254700000000',
        country: 'Tanzania',
      };

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockUserId,
            email: 'user@test.com',
            full_name: mockUpdates.fullName,
            phone: mockUpdates.phone,
            country: mockUpdates.country,
            role_id: 'role-123',
            department_id: 'dept-123',
            language_preference: 'en',
            timezone: 'UTC',
            two_fa_enabled: false,
            profile_photo_url: null,
            last_login: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ name: 'AGENT' }],
      });

      const result = await service.updateUser(mockUserId, mockUpdates);

      expect(result.fullName).toBe(mockUpdates.fullName);
      expect(result.phone).toBe(mockUpdates.phone);
      expect(result.country).toBe(mockUpdates.country);
    });

    it('should throw error if no fields to update', async () => {
      const mockUserId = 'user-123';

      await expect(service.updateUser(mockUserId, {})).rejects.toThrow('No fields to update');
    });
  });

  describe('changePassword', () => {
    it('should change password with valid current password', async () => {
      const mockUserId = 'user-123';
      const currentPassword = 'OldPass123!';
      const newPassword = 'NewPass456!';

      // Mock get current password hash
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ password_hash: 'old-hash' }],
      });

      // Mock password verification
      (authService.verifyPassword as jest.Mock).mockResolvedValueOnce(true);

      // Mock password hashing
      (authService.hashPassword as jest.Mock).mockResolvedValueOnce('new-hash');

      // Mock password update
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await service.changePassword(mockUserId, currentPassword, newPassword);

      expect(authService.verifyPassword).toHaveBeenCalledWith(currentPassword, 'old-hash');
      expect(authService.hashPassword).toHaveBeenCalledWith(newPassword);
    });

    it('should reject password change with incorrect current password', async () => {
      const mockUserId = 'user-123';
      const currentPassword = 'WrongPass123!';
      const newPassword = 'NewPass456!';

      // Mock get current password hash
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ password_hash: 'old-hash' }],
      });

      // Mock password verification failure
      (authService.verifyPassword as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        service.changePassword(mockUserId, currentPassword, newPassword)
      ).rejects.toThrow('Current password is incorrect');
    });
  });

  describe('listUsers', () => {
    it('should list users with pagination', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@test.com',
          full_name: 'User One',
          phone: '+254712345678',
          country: 'Kenya',
          role_id: 'role-123',
          role_name: 'AGENT',
          department_id: 'dept-123',
          language_preference: 'en',
          timezone: 'UTC',
          two_fa_enabled: false,
          profile_photo_url: null,
          last_login: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      // Mock count query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '1' }],
      });

      // Mock users query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: mockUsers,
      });

      const result = await service.listUsers({ limit: 50, offset: 0 });

      expect(result.total).toBe(1);
      expect(result.users).toHaveLength(1);
      expect(result.users[0].email).toBe('user1@test.com');
    });

    it('should filter users by role', async () => {
      const mockRoleId = 'role-123';

      // Mock count query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '0' }],
      });

      // Mock users query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const result = await service.listUsers({ roleId: mockRoleId });

      expect(result.total).toBe(0);
      expect(result.users).toHaveLength(0);
    });
  });

  describe('deleteUser', () => {
    it('should delete user by ID', async () => {
      const mockUserId = 'user-123';

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockUserId }],
      });

      await service.deleteUser(mockUserId);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = $1 RETURNING id',
        [mockUserId]
      );
    });

    it('should throw error if user not found', async () => {
      const mockUserId = 'non-existent-123';

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      await expect(service.deleteUser(mockUserId)).rejects.toThrow('User not found');
    });
  });
});
