import { Request, Response, NextFunction } from 'express';
import {
  requireRole,
  requirePermissions,
  requireFinancialAccess,
  requireResourceAccess,
  requireResourceOwnership,
} from './authorizationMiddleware';
import { authorizationService, Role } from './authorizationService';
import { db } from '../database/connection';

// Extend Express Request type for tests
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      email: string;
      role: Role;
      permissions: string[];
      sessionId: string;
    };
  }
}

// Mock dependencies
jest.mock('./authorizationService');
jest.mock('../database/connection');
jest.mock('../utils/logger');

const mockAuthorizationService = authorizationService as jest.Mocked<typeof authorizationService>;
const mockDb = db as jest.Mocked<typeof db>;

describe('Authorization Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: Role.OPERATIONS_USER,
        permissions: ['read:clients', 'write:clients'],
        sessionId: 'session-123',
      },
      params: {},
      path: '/api/test',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent'),
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('requireRole', () => {
    it('should allow access when user has required role', async () => {
      mockRequest.user!.role = Role.CEO;
      const middleware = requireRole(Role.CEO);

      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow access when user has one of multiple allowed roles', async () => {
      mockRequest.user!.role = Role.CFO;
      const middleware = requireRole(Role.CEO, Role.CFO, Role.CoS);

      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access when user lacks required role', async () => {
      mockRequest.user!.role = Role.AGENT;
      const middleware = requireRole(Role.CEO);

      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      mockRequest.user = undefined;
      const middleware = requireRole(Role.CEO);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication required',
      });
    });

    it('should log access decision to audit log', async () => {
      mockRequest.user!.role = Role.CEO;
      const middleware = requireRole(Role.CEO);

      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockDb.query).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requirePermissions', () => {
    it('should allow access when user has all required permissions', async () => {
      const middleware = requirePermissions('read:clients', 'write:clients');

      mockAuthorizationService.hasPermissions.mockResolvedValue(true);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockAuthorizationService.hasPermissions).toHaveBeenCalledWith('user-123', [
        'read:clients',
        'write:clients',
      ]);
    });

    it('should deny access when user lacks required permissions', async () => {
      const middleware = requirePermissions('approve:payments');

      mockAuthorizationService.hasPermissions.mockResolvedValue(false);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      mockRequest.user = undefined;
      const middleware = requirePermissions('read:clients');

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication required',
      });
    });
  });

  describe('requireFinancialAccess', () => {
    it('should allow access for CEO', async () => {
      mockRequest.user!.role = Role.CEO;

      mockAuthorizationService.canAccessFinancialData.mockResolvedValue(true);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await requireFinancialAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow access for CoS', async () => {
      mockRequest.user!.role = Role.CoS;

      mockAuthorizationService.canAccessFinancialData.mockResolvedValue(true);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await requireFinancialAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow access for CFO', async () => {
      mockRequest.user!.role = Role.CFO;

      mockAuthorizationService.canAccessFinancialData.mockResolvedValue(true);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await requireFinancialAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow access for EA', async () => {
      mockRequest.user!.role = Role.EA;

      mockAuthorizationService.canAccessFinancialData.mockResolvedValue(true);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await requireFinancialAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access for Agent', async () => {
      mockRequest.user!.role = Role.AGENT;

      mockAuthorizationService.canAccessFinancialData.mockResolvedValue(false);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await requireFinancialAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Access to financial data is restricted',
      });
    });

    it('should deny access for Operations User', async () => {
      mockRequest.user!.role = Role.OPERATIONS_USER;

      mockAuthorizationService.canAccessFinancialData.mockResolvedValue(false);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await requireFinancialAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should return 401 when user is not authenticated', async () => {
      mockRequest.user = undefined;

      await requireFinancialAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication required',
      });
    });
  });

  describe('requireResourceAccess', () => {
    it('should allow access when user can access resource', async () => {
      mockRequest.params = { id: 'client-123' };
      const middleware = requireResourceAccess('clients');

      mockAuthorizationService.canAccessResource.mockResolvedValue(true);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockAuthorizationService.canAccessResource).toHaveBeenCalledWith(
        'user-123',
        'clients',
        'client-123'
      );
    });

    it('should deny access when user cannot access resource', async () => {
      mockRequest.params = { id: 'client-123' };
      const middleware = requireResourceAccess('clients');

      mockAuthorizationService.canAccessResource.mockResolvedValue(false);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Access to this resource is not permitted',
      });
    });

    it('should return 400 when resource ID is missing', async () => {
      mockRequest.params = {};
      const middleware = requireResourceAccess('clients');

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Resource ID is required',
      });
    });

    it('should support custom resource ID parameter name', async () => {
      mockRequest.params = { clientId: 'client-123' };
      const middleware = requireResourceAccess('clients', 'clientId');

      mockAuthorizationService.canAccessResource.mockResolvedValue(true);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockAuthorizationService.canAccessResource).toHaveBeenCalledWith(
        'user-123',
        'clients',
        'client-123'
      );
    });
  });

  describe('requireResourceOwnership', () => {
    it('should allow access when user owns resource', async () => {
      mockRequest.params = { id: 'client-123' };
      mockRequest.user!.role = Role.AGENT;
      const middleware = requireResourceOwnership('clients');

      mockAuthorizationService.ownsResource.mockResolvedValue(true);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockAuthorizationService.ownsResource).toHaveBeenCalledWith(
        'user-123',
        'clients',
        'client-123'
      );
    });

    it('should deny access when user does not own resource', async () => {
      mockRequest.params = { id: 'client-123' };
      mockRequest.user!.role = Role.AGENT;
      const middleware = requireResourceOwnership('clients');

      mockAuthorizationService.ownsResource.mockResolvedValue(false);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'You do not have permission to access this resource',
      });
    });

    it('should allow CEO to access any resource without ownership check', async () => {
      mockRequest.params = { id: 'client-123' };
      mockRequest.user!.role = Role.CEO;
      const middleware = requireResourceOwnership('clients');

      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockAuthorizationService.ownsResource).not.toHaveBeenCalled();
    });

    it('should return 400 when resource ID is missing', async () => {
      mockRequest.params = {};
      const middleware = requireResourceOwnership('clients');

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Resource ID is required',
      });
    });
  });
});
