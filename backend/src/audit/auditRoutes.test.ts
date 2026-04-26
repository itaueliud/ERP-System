/**
 * Tests for Audit Log Routes
 * Requirements: 15.9, 15.10, 15.11, 15.12
 */

import request from 'supertest';
import express from 'express';
import auditRoutes from './auditRoutes';
import { auditService } from './auditService';
import { fraudDetectionService } from './fraudDetection';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('./auditService');
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../database/connection', () => ({ db: { query: jest.fn() } }));
jest.mock('../cache/permissionsCache', () => ({
  permissionsCache: { getPermissions: jest.fn().mockResolvedValue(null) },
}));
jest.mock('./fraudDetection', () => ({
  fraudDetectionService: {
    getSecurityAlerts: jest.fn(),
    analyzeAuditLog: jest.fn(),
  },
  SecurityAlertType: {
    MULTIPLE_FAILED_LOGINS: 'MULTIPLE_FAILED_LOGINS',
    UNUSUAL_ACCESS_HOURS: 'UNUSUAL_ACCESS_HOURS',
    UNAUTHORIZED_ATTEMPTS: 'UNAUTHORIZED_ATTEMPTS',
    LARGE_SERVICE_AMOUNT_CHANGE: 'LARGE_SERVICE_AMOUNT_CHANGE',
    SUSPICIOUS_FINANCIAL_ACCESS: 'SUSPICIOUS_FINANCIAL_ACCESS',
  },
  SecurityAlertSeverity: {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL',
  },
  SecurityAlertStatus: {
    OPEN: 'OPEN',
    ACKNOWLEDGED: 'ACKNOWLEDGED',
    RESOLVED: 'RESOLVED',
  },
}));
// Mock the authorization middleware so we can control role checking in tests
jest.mock('../auth/authorizationMiddleware', () => ({
  requireRole: (...allowedRoles: string[]) => {
    return (req: any, res: any, next: any) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      return next();
    };
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildApp(role: string | null) {
  const app = express();
  app.use(express.json());

  // Inject user (or no user) before the routes
  app.use((req: any, _res, next) => {
    if (role !== null) {
      req.user = { id: 'user-1', role };
    }
    next();
  });

  app.use('/api/audit-logs', auditRoutes);
  return app;
}

const fakePaginatedResult = {
  logs: [
    {
      id: 'log-1',
      userId: 'user-123',
      action: 'LOGIN',
      resourceType: 'auth',
      resourceId: null,
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      result: 'SUCCESS',
      metadata: null,
      createdAt: new Date('2024-01-15T10:00:00Z'),
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

// ---------------------------------------------------------------------------
// Role-Based Access Control (Requirement 15.9)
// ---------------------------------------------------------------------------

describe('Audit Routes — Role-Based Access Control (Requirement 15.9)', () => {
  const unauthorizedRoles = ['CFO', 'COO', 'CTO', 'EA', 'AGENT', 'TRAINER', 'DEVELOPER'];

  beforeEach(() => {
    jest.clearAllMocks();
    (auditService.query as jest.Mock).mockResolvedValue(fakePaginatedResult);
    (auditService.exportToCSV as jest.Mock).mockResolvedValue('id,user_id\nlog-1,user-123');
    (auditService.getLogById as jest.Mock).mockResolvedValue(fakePaginatedResult.logs[0]);
  });

  it('returns 401 when no user is authenticated', async () => {
    const app = buildApp(null);
    const res = await request(app).get('/api/audit-logs');
    expect(res.status).toBe(401);
  });

  it.each(unauthorizedRoles)(
    'returns 403 for role %s on GET /',
    async (role) => {
      const app = buildApp(role);
      const res = await request(app).get('/api/audit-logs');
      expect(res.status).toBe(403);
    }
  );

  it.each(unauthorizedRoles)(
    'returns 403 for role %s on GET /export',
    async (role) => {
      const app = buildApp(role);
      const res = await request(app).get('/api/audit-logs/export');
      expect(res.status).toBe(403);
    }
  );

  it.each(unauthorizedRoles)(
    'returns 403 for role %s on GET /:id',
    async (role) => {
      const app = buildApp(role);
      const res = await request(app).get('/api/audit-logs/log-1');
      expect(res.status).toBe(403);
    }
  );

  it('allows CEO to access audit logs', async () => {
    const app = buildApp('CEO');
    const res = await request(app).get('/api/audit-logs');
    expect(res.status).toBe(200);
  });

  it('allows CoS to access audit logs', async () => {
    const app = buildApp('CoS');
    const res = await request(app).get('/api/audit-logs');
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /api/audit-logs — Query with filters (Requirements 15.9, 15.10)
// ---------------------------------------------------------------------------

describe('GET /api/audit-logs — Query with filters', () => {
  let app: express.Application;

  beforeEach(() => {
    app = buildApp('CEO');
    jest.clearAllMocks();
    (auditService.query as jest.Mock).mockResolvedValue(fakePaginatedResult);
  });

  it('returns paginated audit logs', async () => {
    const res = await request(app).get('/api/audit-logs');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('passes userId filter to service', async () => {
    await request(app).get('/api/audit-logs?userId=user-abc');

    expect(auditService.query).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-abc' })
    );
  });

  it('passes action filter to service', async () => {
    await request(app).get('/api/audit-logs?action=LOGIN');

    expect(auditService.query).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN' })
    );
  });

  it('passes resourceType filter to service', async () => {
    await request(app).get('/api/audit-logs?resourceType=clients');

    expect(auditService.query).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: 'clients' })
    );
  });

  it('passes resourceId filter to service', async () => {
    await request(app).get('/api/audit-logs?resourceId=res-001');

    expect(auditService.query).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 'res-001' })
    );
  });

  it('passes result filter to service', async () => {
    await request(app).get('/api/audit-logs?result=FAILURE');

    expect(auditService.query).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'FAILURE' })
    );
  });

  it('ignores invalid result filter values', async () => {
    await request(app).get('/api/audit-logs?result=INVALID');

    const call = (auditService.query as jest.Mock).mock.calls[0][0];
    expect(call.result).toBeUndefined();
  });

  it('passes startDate filter as Date object', async () => {
    await request(app).get('/api/audit-logs?startDate=2024-01-01');

    const call = (auditService.query as jest.Mock).mock.calls[0][0];
    expect(call.startDate).toBeInstanceOf(Date);
  });

  it('passes endDate filter as Date object', async () => {
    await request(app).get('/api/audit-logs?endDate=2024-12-31');

    const call = (auditService.query as jest.Mock).mock.calls[0][0];
    expect(call.endDate).toBeInstanceOf(Date);
  });

  it('passes limit and offset for pagination', async () => {
    await request(app).get('/api/audit-logs?limit=10&offset=20');

    expect(auditService.query).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 20 })
    );
  });

  it('passes all filters simultaneously', async () => {
    await request(app).get(
      '/api/audit-logs?userId=u1&action=CREATE&resourceType=clients&result=SUCCESS&startDate=2024-01-01&endDate=2024-12-31&limit=25&offset=0'
    );

    expect(auditService.query).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        action: 'CREATE',
        resourceType: 'clients',
        result: 'SUCCESS',
        limit: 25,
        offset: 0,
      })
    );
  });

  it('returns 500 when service throws', async () => {
    (auditService.query as jest.Mock).mockRejectedValue(new Error('DB error'));

    const res = await request(app).get('/api/audit-logs');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/audit-logs/export — CSV export (Requirement 15.11)
// ---------------------------------------------------------------------------

describe('GET /api/audit-logs/export — CSV export', () => {
  let app: express.Application;

  beforeEach(() => {
    app = buildApp('CEO');
    jest.clearAllMocks();
    (auditService.exportToCSV as jest.Mock).mockResolvedValue(
      'id,user_id,action,resource_type,resource_id,ip_address,user_agent,result,metadata,created_at\nlog-1,user-123,LOGIN,auth,,127.0.0.1,jest,SUCCESS,,2024-01-15T10:00:00.000Z'
    );
    (auditService.log as jest.Mock).mockResolvedValue(undefined);
  });

  it('returns CSV content with correct Content-Type', async () => {
    const res = await request(app).get('/api/audit-logs/export');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });

  it('sets Content-Disposition header with filename', async () => {
    const res = await request(app).get('/api/audit-logs/export');

    expect(res.headers['content-disposition']).toMatch(/attachment; filename="audit-logs-/);
    expect(res.headers['content-disposition']).toMatch(/\.csv"/);
  });

  it('returns CSV body with header row', async () => {
    const res = await request(app).get('/api/audit-logs/export');

    expect(res.text).toContain('id,user_id,action');
  });

  it('passes filters to exportToCSV', async () => {
    await request(app).get('/api/audit-logs/export?userId=u1&action=LOGIN');

    expect(auditService.exportToCSV).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', action: 'LOGIN' })
    );
  });

  it('logs the export action to audit log', async () => {
    await request(app).get('/api/audit-logs/export');

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EXPORT', resourceType: 'audit_logs', result: 'SUCCESS' })
    );
  });

  it('returns 500 when service throws', async () => {
    (auditService.exportToCSV as jest.Mock).mockRejectedValue(new Error('Export failed'));

    const res = await request(app).get('/api/audit-logs/export');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/audit-logs/:id — Get single entry (Requirement 15.9)
// ---------------------------------------------------------------------------

describe('GET /api/audit-logs/:id — Get single entry', () => {
  let app: express.Application;

  beforeEach(() => {
    app = buildApp('CEO');
    jest.clearAllMocks();
  });

  it('returns the log entry when found', async () => {
    (auditService.getLogById as jest.Mock).mockResolvedValue(fakePaginatedResult.logs[0]);

    const res = await request(app).get('/api/audit-logs/log-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('log-1');
  });

  it('returns 404 when entry not found', async () => {
    (auditService.getLogById as jest.Mock).mockResolvedValue(null);

    const res = await request(app).get('/api/audit-logs/nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns 500 when service throws', async () => {
    (auditService.getLogById as jest.Mock).mockRejectedValue(new Error('DB error'));

    const res = await request(app).get('/api/audit-logs/log-1');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/audit-logs/retention-policy — Retention policy (Requirement 15.12)
// ---------------------------------------------------------------------------

describe('GET /api/audit-logs/retention-policy — Retention policy', () => {
  let app: express.Application;

  beforeEach(() => {
    app = buildApp('CEO');
    jest.clearAllMocks();
    (auditService.getRetentionPolicy as jest.Mock).mockReturnValue({
      minimumYears: 7,
      description: 'Audit log entries must be retained for a minimum of 7 years.',
    });
  });

  it('returns retention policy for CEO', async () => {
    const res = await request(app).get('/api/audit-logs/retention-policy');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.minimumYears).toBe(7);
  });

  it('returns retention policy for CoS', async () => {
    const cosApp = buildApp('CoS');
    const res = await request(cosApp).get('/api/audit-logs/retention-policy');

    expect(res.status).toBe(200);
    expect(res.body.data.minimumYears).toBe(7);
  });

  it('returns 403 for non-authorized roles', async () => {
    const app = buildApp('CFO');
    const res = await request(app).get('/api/audit-logs/retention-policy');
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Security Alert Routes (Requirements 36.1-36.12)
// ---------------------------------------------------------------------------

const fakeAlert = {
  id: 'alert-1',
  type: 'MULTIPLE_FAILED_LOGINS',
  severity: 'HIGH',
  status: 'OPEN',
  details: { userId: 'user-1' },
  affectedUserId: 'user-1',
  createdAt: new Date('2024-01-15T10:00:00Z'),
};

const fakePaginatedAlerts = {
  alerts: [fakeAlert],
  total: 1,
  limit: 50,
  offset: 0,
};

describe('GET /api/audit-logs/security-alerts — Security Alerts (Requirement 36.7)', () => {
  let app: express.Application;

  beforeEach(() => {
    app = buildApp('CEO');
    jest.clearAllMocks();
    (fraudDetectionService.getSecurityAlerts as jest.Mock).mockResolvedValue(fakePaginatedAlerts);
    (fraudDetectionService.analyzeAuditLog as jest.Mock).mockResolvedValue([fakeAlert]);
  });

  it('returns security alerts for CEO', async () => {
    const res = await request(app).get('/api/audit-logs/security-alerts');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('returns security alerts for CoS', async () => {
    const cosApp = buildApp('CoS');
    const res = await request(cosApp).get('/api/audit-logs/security-alerts');
    expect(res.status).toBe(200);
  });

  it('returns 403 for non-authorized roles', async () => {
    const cfApp = buildApp('CFO');
    const res = await request(cfApp).get('/api/audit-logs/security-alerts');
    expect(res.status).toBe(403);
  });

  it('passes type filter to service', async () => {
    await request(app).get('/api/audit-logs/security-alerts?type=MULTIPLE_FAILED_LOGINS');
    expect(fraudDetectionService.getSecurityAlerts).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MULTIPLE_FAILED_LOGINS' })
    );
  });

  it('ignores invalid type filter values', async () => {
    await request(app).get('/api/audit-logs/security-alerts?type=INVALID_TYPE');
    const call = (fraudDetectionService.getSecurityAlerts as jest.Mock).mock.calls[0][0];
    expect(call.type).toBeUndefined();
  });

  it('returns 500 when service throws', async () => {
    (fraudDetectionService.getSecurityAlerts as jest.Mock).mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/api/audit-logs/security-alerts');
    expect(res.status).toBe(500);
  });
});

describe('POST /api/audit-logs/security-alerts/analyze — Manual Analysis (Requirement 36.1)', () => {
  let app: express.Application;

  beforeEach(() => {
    app = buildApp('CEO');
    jest.clearAllMocks();
    (fraudDetectionService.analyzeAuditLog as jest.Mock).mockResolvedValue([fakeAlert]);
  });

  it('returns generated alerts for a valid log entry', async () => {
    const logEntry = {
      userId: 'user-1',
      action: 'LOGIN',
      resourceType: 'auth',
      result: 'FAILURE',
      ipAddress: '127.0.0.1',
      createdAt: new Date().toISOString(),
    };

    const res = await request(app)
      .post('/api/audit-logs/security-alerts/analyze')
      .send(logEntry);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/audit-logs/security-alerts/analyze')
      .send({ userId: 'user-1' }); // missing action and resourceType

    expect(res.status).toBe(400);
  });

  it('returns 403 for non-authorized roles', async () => {
    const cfApp = buildApp('CFO');
    const res = await request(cfApp)
      .post('/api/audit-logs/security-alerts/analyze')
      .send({ userId: 'u', action: 'LOGIN', resourceType: 'auth' });
    expect(res.status).toBe(403);
  });

  it('returns 500 when service throws', async () => {
    (fraudDetectionService.analyzeAuditLog as jest.Mock).mockRejectedValue(new Error('error'));
    const res = await request(app)
      .post('/api/audit-logs/security-alerts/analyze')
      .send({ userId: 'u', action: 'LOGIN', resourceType: 'auth' });
    expect(res.status).toBe(500);
  });
});
