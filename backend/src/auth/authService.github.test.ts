import { authService } from './authService';
import { db } from '../database/connection';
import { sessionCache } from '../cache/sessionCache';
import { cacheService } from '../cache/cacheService';
import crypto from 'crypto';

// Mock dependencies
jest.mock('../database/connection');
jest.mock('../cache/sessionCache');
jest.mock('../cache/cacheService');
jest.mock('../utils/logger');

describe('AuthenticationService - GitHub OAuth', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const mockSessionCache = sessionCache as jest.Mocked<typeof sessionCache>;
  const mockCacheService = cacheService as jest.Mocked<typeof cacheService>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock crypto.randomUUID to return predictable values
    jest.spyOn(crypto, 'randomUUID').mockReturnValue('test-session-id' as `${string}-${string}-${string}-${string}-${string}`);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('loginWithGitHub', () => {
    const mockGitHubUser = {
      id: 'github-123',
      username: 'testdev',
      email: 'developer@test.com',
    };

    const mockAccessToken = 'github-access-token-123';

    it('should successfully authenticate a developer with GitHub OAuth', async () => {
      // Mock database query to return a developer user
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-123',
            email: 'developer@test.com',
            full_name: 'Test Developer',
            github_username: null,
            role: 'DEVELOPER',
            permissions: ['read:projects', 'write:code'],
            department_id: 'dept-123',
          },
        ],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Mock update query for GitHub username
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      // Mock update query for last login
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      mockSessionCache.setSession.mockResolvedValue();
      mockCacheService.set.mockResolvedValue();

      const result = await authService.loginWithGitHub(mockGitHubUser, mockAccessToken);

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.sessionId).toBe('test-session-id');
      expect(result.user).toMatchObject({
        id: 'user-123',
        email: 'developer@test.com',
        fullName: 'Test Developer',
        role: 'DEVELOPER',
      });

      // Verify GitHub username was updated
      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE users SET github_username = $1, updated_at = NOW() WHERE id = $2',
        ['testdev', 'user-123']
      );

      // Verify session was created
      expect(mockSessionCache.setSession).toHaveBeenCalledWith('test-session-id', {
        userId: 'user-123',
        role: 'DEVELOPER',
        email: 'developer@test.com',
        permissions: ['read:projects', 'write:code'],
        createdAt: expect.any(Date),
        lastActivity: expect.any(Date),
      });

      // Verify GitHub access token was cached
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'github_token:user-123',
        mockAccessToken,
        8 * 60 * 60
      );
    });

    it('should not update GitHub username if it has not changed', async () => {
      // Mock database query to return a developer user with existing GitHub username
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-123',
            email: 'developer@test.com',
            full_name: 'Test Developer',
            github_username: 'testdev', // Already set
            role: 'DEVELOPER',
            permissions: ['read:projects', 'write:code'],
            department_id: 'dept-123',
          },
        ],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Mock update query for last login only
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      mockSessionCache.setSession.mockResolvedValue();
      mockCacheService.set.mockResolvedValue();

      const result = await authService.loginWithGitHub(mockGitHubUser, mockAccessToken);

      expect(result.success).toBe(true);

      // Verify GitHub username update was NOT called (only 2 queries: SELECT and last_login UPDATE)
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockDb.query).not.toHaveBeenCalledWith(
        'UPDATE users SET github_username = $1, updated_at = NOW() WHERE id = $2',
        expect.any(Array)
      );
    });

    it('should reject GitHub OAuth for non-existent user', async () => {
      // Mock database query to return no user
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await authService.loginWithGitHub(mockGitHubUser, mockAccessToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'No account found with this GitHub email. Please contact your administrator.'
      );
      expect(result.token).toBeUndefined();
      expect(result.user).toBeUndefined();

      // Verify no session was created
      expect(mockSessionCache.setSession).not.toHaveBeenCalled();
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it('should reject GitHub OAuth for non-developer users', async () => {
      // Mock database query to return a non-developer user
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-123',
            email: 'agent@test.com',
            full_name: 'Test Agent',
            github_username: null,
            role: 'AGENT', // Not a developer
            permissions: ['read:clients', 'write:clients'],
            department_id: 'dept-456',
          },
        ],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await authService.loginWithGitHub(
        { ...mockGitHubUser, email: 'agent@test.com' },
        mockAccessToken
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('GitHub authentication is only available for developers');
      expect(result.token).toBeUndefined();
      expect(result.user).toBeUndefined();

      // Verify no session was created
      expect(mockSessionCache.setSession).not.toHaveBeenCalled();
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      // Mock database query to throw an error
      mockDb.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await authService.loginWithGitHub(mockGitHubUser, mockAccessToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('An error occurred during GitHub authentication');
      expect(result.token).toBeUndefined();
      expect(result.user).toBeUndefined();
    });

    it('should update GitHub username when it changes', async () => {
      // Mock database query to return a developer user with different GitHub username
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-123',
            email: 'developer@test.com',
            full_name: 'Test Developer',
            github_username: 'oldusername', // Different from mockGitHubUser.username
            role: 'DEVELOPER',
            permissions: ['read:projects', 'write:code'],
            department_id: 'dept-123',
          },
        ],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Mock update query for GitHub username
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      // Mock update query for last login
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      mockSessionCache.setSession.mockResolvedValue();
      mockCacheService.set.mockResolvedValue();

      const result = await authService.loginWithGitHub(mockGitHubUser, mockAccessToken);

      expect(result.success).toBe(true);

      // Verify GitHub username was updated
      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE users SET github_username = $1, updated_at = NOW() WHERE id = $2',
        ['testdev', 'user-123']
      );
    });
  });

  describe('getGitHubAccessToken', () => {
    it('should retrieve GitHub access token from cache', async () => {
      const mockToken = 'github-access-token-123';
      mockCacheService.get.mockResolvedValue(mockToken);

      const token = await authService.getGitHubAccessToken('user-123');

      expect(token).toBe(mockToken);
      expect(mockCacheService.get).toHaveBeenCalledWith('github_token:user-123');
    });

    it('should return null if token is not found', async () => {
      mockCacheService.get.mockResolvedValue(null);

      const token = await authService.getGitHubAccessToken('user-123');

      expect(token).toBeNull();
    });

    it('should return null on cache error', async () => {
      mockCacheService.get.mockRejectedValue(new Error('Cache error'));

      const token = await authService.getGitHubAccessToken('user-123');

      expect(token).toBeNull();
    });
  });
});
