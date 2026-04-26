import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { authService } from './authService';
import { githubClient } from '../services/github/client';

// Mock dependencies
jest.mock('./authService');
jest.mock('../services/github/client');
jest.mock('../utils/logger');

// Passport mock: authenticate returns a middleware that calls a configurable handler
let passportAuthHandler: (req: any, res: any, next: any) => void = (_req, _res, next) => next();

jest.mock('passport', () => {
  const mockMiddleware = (_req: any, _res: any, next: any) => next();
  return {
    initialize: jest.fn(() => mockMiddleware),
    authenticate: jest.fn(() => (req: any, res: any, next: any) => passportAuthHandler(req, res, next)),
    use: jest.fn(),
  };
});

// Import authRoutes after mocks are set up
import authRoutes from './authRoutes';

describe('Auth Routes - GitHub OAuth', () => {
  let app: Express;
  const mockAuthService = authService as jest.Mocked<typeof authService>;
  const mockGitHubClient = githubClient as jest.Mocked<typeof githubClient>;

  beforeAll(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(passport.initialize());
    app.use('/auth', authRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGitHubClient.configureOAuth.mockImplementation(() => {});
    // Reset passport auth handler to passthrough by default
    passportAuthHandler = (_req, _res, next) => next();
  });

  describe('GET /auth/github', () => {
    it('should initiate GitHub OAuth flow', async () => {
      passportAuthHandler = (_req, res, _next) => {
        res.redirect('https://github.com/login/oauth/authorize');
      };

      const response = await request(app).get('/auth/github');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('github.com');
    });
  });

  describe('GET /auth/github/callback', () => {
    it('should handle successful GitHub OAuth callback', async () => {
      const mockGitHubUser = {
        id: 'github-123',
        username: 'testdev',
        email: 'developer@test.com',
      };

      const mockAccessToken = 'github-access-token-123';

      passportAuthHandler = (req, _res, next) => {
        req.user = { user: mockGitHubUser, accessToken: mockAccessToken };
        next();
      };

      mockAuthService.loginWithGitHub.mockResolvedValue({
        success: true,
        token: 'jwt-token-123',
        sessionId: 'session-123',
        user: {
          id: 'user-123',
          email: 'developer@test.com',
          fullName: 'Test Developer',
          role: 'DEVELOPER',
          permissions: ['read:projects', 'write:code'],
        },
      });

      const response = await request(app).get('/auth/github/callback');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/technology?github_auth=success');
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('auth_token=jwt-token-123');

      expect(mockAuthService.loginWithGitHub).toHaveBeenCalledWith(mockGitHubUser, mockAccessToken);
    });

    it('should redirect to login on authentication failure', async () => {
      const mockGitHubUser = {
        id: 'github-123',
        username: 'testagent',
        email: 'agent@test.com',
      };

      const mockAccessToken = 'github-access-token-123';

      passportAuthHandler = (req, _res, next) => {
        req.user = { user: mockGitHubUser, accessToken: mockAccessToken };
        next();
      };

      mockAuthService.loginWithGitHub.mockResolvedValue({
        success: false,
        error: 'GitHub authentication is only available for developers',
      });

      const response = await request(app).get('/auth/github/callback');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/login?error=');
      expect(response.headers.location).toContain(
        encodeURIComponent('GitHub authentication is only available for developers')
      );
    });

    it('should redirect to login when user data is missing', async () => {
      passportAuthHandler = (req, _res, next) => {
        req.user = null;
        next();
      };

      const response = await request(app).get('/auth/github/callback');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login?error=github_auth_failed');
    });

    it('should handle errors during callback processing', async () => {
      const mockGitHubUser = {
        id: 'github-123',
        username: 'testdev',
        email: 'developer@test.com',
      };

      const mockAccessToken = 'github-access-token-123';

      passportAuthHandler = (req, _res, next) => {
        req.user = { user: mockGitHubUser, accessToken: mockAccessToken };
        next();
      };

      mockAuthService.loginWithGitHub.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/auth/github/callback');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login?error=github_auth_failed');
    });
  });

  describe('POST /auth/login', () => {
    it('should successfully login with email and password', async () => {
      mockAuthService.login.mockResolvedValue({
        success: true,
        token: 'jwt-token-123',
        sessionId: 'session-123',
        user: {
          id: 'user-123',
          email: 'user@test.com',
          fullName: 'Test User',
          role: 'AGENT',
          permissions: ['read:clients'],
        },
      });

      const response = await request(app).post('/auth/login').send({
        email: 'user@test.com',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should reject login with invalid credentials', async () => {
      mockAuthService.login.mockResolvedValue({
        success: false,
        error: 'Invalid email or password',
      });

      const response = await request(app).post('/auth/login').send({
        email: 'user@test.com',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBeUndefined();
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should require email and password', async () => {
      const response = await request(app).post('/auth/login').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email and password are required');
    });
  });

  describe('POST /auth/logout', () => {
    it('should successfully logout user', async () => {
      mockAuthService.logout.mockResolvedValue();

      const response = await request(app).post('/auth/logout').send({
        userId: 'user-123',
        sessionId: 'session-123',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAuthService.logout).toHaveBeenCalledWith('user-123', 'session-123');
    });

    it('should require userId and sessionId', async () => {
      const response = await request(app).post('/auth/logout').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User ID and session ID are required');
    });
  });

  describe('GET /auth/me', () => {
    it('should return user profile with valid token', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        userId: 'user-123',
        sessionId: 'session-123',
        role: 'DEVELOPER',
        email: 'developer@test.com',
        iat: Date.now(),
        exp: Date.now() + 8 * 60 * 60 * 1000,
      });

      mockAuthService.getUserById.mockResolvedValue({
        id: 'user-123',
        email: 'developer@test.com',
        fullName: 'Test Developer',
        role: 'DEVELOPER',
        permissions: ['read:projects', 'write:code'],
      });

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer jwt-token-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('developer@test.com');
    });

    it('should reject request without token', async () => {
      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No authentication token provided');
    });

    it('should reject request with invalid token', async () => {
      mockAuthService.validateToken.mockResolvedValue(null);

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid or expired token');
    });
  });
});
