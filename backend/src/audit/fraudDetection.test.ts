/**
 * Unit tests for FraudDetectionService
 * Requirements: 36.1-36.12
 */

import {
  FraudDetectionService,
  SecurityAlertType,
  SecurityAlertSeverity,
  SecurityAlertStatus,
} from './fraudDetection';
import { AuditResult } from './auditService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockQuery = jest.fn();

jest.mock('../database/connection', () => ({
  db: { query: (...args: any[]) => mockQuery(...args) },
}));

jest.mock('../notifications/notificationService', () => ({
  notificationService: {
    sendNotification: jest.fn().mockResolvedValue({}),
  },
  NotificationPriority: { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' },
  NotificationType: { PAYMENT_APPROVAL: 'PAYMENT_APPROVAL' },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAuditLog(overrides: Partial<any> = {}): any {
  return {
    id: 'log-1',
    userId: 'user-1',
    action: 'LOGIN',
    resourceType: 'auth',
    resourceId: null,
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    result: AuditResult.SUCCESS,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeAlertRow(overrides: Partial<any> = {}): any {
  return {
    id: 'alert-1',
    type: SecurityAlertType.MULTIPLE_FAILED_LOGINS,
    severity: SecurityAlertSeverity.HIGH,
    status: SecurityAlertStatus.OPEN,
    details: JSON.stringify({ userId: 'user-1' }),
    affected_user_id: 'user-1',
    resolved_by: null,
    resolved_at: null,
    created_at: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FraudDetectionService', () => {
  let service: FraudDetectionService;

  beforeEach(() => {
    service = new FraudDetectionService();
    mockQuery.mockReset();
  });

  // -------------------------------------------------------------------------
  // checkFailedLogins()
  // -------------------------------------------------------------------------

  describe('checkFailedLogins()', () => {
    it('returns true when failed login count meets threshold (5)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ cnt: '5' }] });
      const result = await service.checkFailedLogins('user-1');
      expect(result).toBe(true);
    });

    it('returns false when failed login count is below threshold', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ cnt: '3' }] });
      const result = await service.checkFailedLogins('user-1');
      expect(result).toBe(false);
    });

    it('queries audit_logs for LOGIN FAILURE within the time window', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ cnt: '0' }] });
      await service.checkFailedLogins('user-abc', 30);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("action = 'LOGIN'");
      expect(sql).toContain("result = 'FAILURE'");
      expect(params[0]).toBe('user-abc');
      expect(params[1]).toBe(30);
    });

    it('returns false on database error (non-throwing)', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB down'));
      const result = await service.checkFailedLogins('user-1');
      expect(result).toBe(false);
    });

    it('uses default window of 15 minutes', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ cnt: '0' }] });
      await service.checkFailedLogins('user-1');
      const [, params] = mockQuery.mock.calls[0];
      expect(params[1]).toBe(15);
    });
  });

  // -------------------------------------------------------------------------
  // checkUnusualAccess()
  // -------------------------------------------------------------------------

  describe('checkUnusualAccess()', () => {
    const sensitiveResources = ['financial_data', 'payments', 'audit_logs'];

    it.each(sensitiveResources)(
      'returns true for sensitive resource "%s" accessed outside working hours',
      (resourceType) => {
        // Mock Date to return an hour outside 9-18
        jest.spyOn(Date.prototype, 'getHours').mockReturnValue(22);
        const result = service.checkUnusualAccess('user-1', resourceType);
        expect(result).toBe(true);
        jest.restoreAllMocks();
      }
    );

    it('returns false for sensitive resource accessed during working hours', () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);
      const result = service.checkUnusualAccess('user-1', 'financial_data');
      expect(result).toBe(false);
      jest.restoreAllMocks();
    });

    it('returns false for non-sensitive resource outside working hours', () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(22);
      const result = service.checkUnusualAccess('user-1', 'clients');
      expect(result).toBe(false);
      jest.restoreAllMocks();
    });

    it('returns false at exactly 9 AM (start of working hours)', () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      const result = service.checkUnusualAccess('user-1', 'financial_data');
      expect(result).toBe(false);
      jest.restoreAllMocks();
    });

    it('returns true at exactly 18:00 (end of working hours, exclusive)', () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(18);
      const result = service.checkUnusualAccess('user-1', 'financial_data');
      expect(result).toBe(true);
      jest.restoreAllMocks();
    });
  });

  // -------------------------------------------------------------------------
  // checkUnauthorizedAttempts()
  // -------------------------------------------------------------------------

  describe('checkUnauthorizedAttempts()', () => {
    it('returns true when unauthorized attempt count meets threshold (3)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ cnt: '3' }] });
      const result = await service.checkUnauthorizedAttempts('user-1');
      expect(result).toBe(true);
    });

    it('returns false when count is below threshold', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ cnt: '2' }] });
      const result = await service.checkUnauthorizedAttempts('user-1');
      expect(result).toBe(false);
    });

    it('excludes LOGIN actions from the query', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ cnt: '0' }] });
      await service.checkUnauthorizedAttempts('user-1');
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("action != 'LOGIN'");
      expect(sql).toContain("result = 'FAILURE'");
    });

    it('returns false on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      const result = await service.checkUnauthorizedAttempts('user-1');
      expect(result).toBe(false);
    });

    it('uses default window of 10 minutes', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ cnt: '0' }] });
      await service.checkUnauthorizedAttempts('user-1');
      const [, params] = mockQuery.mock.calls[0];
      expect(params[1]).toBe(10);
    });
  });

  // -------------------------------------------------------------------------
  // checkServiceAmountChange()
  // -------------------------------------------------------------------------

  describe('checkServiceAmountChange()', () => {
    it('returns true when change exceeds 20%', () => {
      expect(service.checkServiceAmountChange('proj-1', 1000, 1250)).toBe(true); // 25%
    });

    it('returns false when change is exactly 20%', () => {
      expect(service.checkServiceAmountChange('proj-1', 1000, 1200)).toBe(false); // exactly 20%
    });

    it('returns false when change is below 20%', () => {
      expect(service.checkServiceAmountChange('proj-1', 1000, 1100)).toBe(false); // 10%
    });

    it('handles decrease as well as increase', () => {
      expect(service.checkServiceAmountChange('proj-1', 1000, 700)).toBe(true); // 30% decrease
    });

    it('returns false when originalAmount is zero or negative', () => {
      expect(service.checkServiceAmountChange('proj-1', 0, 500)).toBe(false);
      expect(service.checkServiceAmountChange('proj-1', -100, 500)).toBe(false);
    });

    it('returns false for no change', () => {
      expect(service.checkServiceAmountChange('proj-1', 1000, 1000)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // generateSecurityAlert()
  // -------------------------------------------------------------------------

  describe('generateSecurityAlert()', () => {
    beforeEach(() => {
      // INSERT alert
      mockQuery.mockResolvedValueOnce({ rows: [makeAlertRow()] });
      // SELECT executives (CEO/CoS)
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ceo-1' }, { id: 'cos-1' }] });
    });

    it('inserts a security alert into the database', async () => {
      await service.generateSecurityAlert(
        SecurityAlertType.MULTIPLE_FAILED_LOGINS,
        { userId: 'user-1' },
        'user-1'
      );
      const [sql] = mockQuery.mock.calls[0];
      expect(sql.trim().toUpperCase()).toMatch(/^INSERT INTO SECURITY_ALERTS/);
    });

    it('returns a SecurityAlert with correct type and severity', async () => {
      const alert = await service.generateSecurityAlert(
        SecurityAlertType.MULTIPLE_FAILED_LOGINS,
        { userId: 'user-1' },
        'user-1'
      );
      expect(alert.type).toBe(SecurityAlertType.MULTIPLE_FAILED_LOGINS);
      expect(alert.severity).toBe(SecurityAlertSeverity.HIGH);
      expect(alert.status).toBe(SecurityAlertStatus.OPEN);
    });

    it('assigns CRITICAL severity to LARGE_SERVICE_AMOUNT_CHANGE', async () => {
      mockQuery.mockReset();
      mockQuery.mockResolvedValueOnce({
        rows: [makeAlertRow({ type: SecurityAlertType.LARGE_SERVICE_AMOUNT_CHANGE, severity: SecurityAlertSeverity.CRITICAL })],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const alert = await service.generateSecurityAlert(
        SecurityAlertType.LARGE_SERVICE_AMOUNT_CHANGE,
        { projectId: 'proj-1', originalAmount: 1000, newAmount: 1500 }
      );
      expect(alert.severity).toBe(SecurityAlertSeverity.CRITICAL);
    });

    it('routes alert to CEO and CoS via notification service', async () => {
      const { notificationService } = require('../notifications/notificationService');
      notificationService.sendNotification.mockClear();
      await service.generateSecurityAlert(
        SecurityAlertType.MULTIPLE_FAILED_LOGINS,
        { userId: 'user-1' },
        'user-1'
      );
      expect(notificationService.sendNotification).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // getSecurityAlerts()
  // -------------------------------------------------------------------------

  describe('getSecurityAlerts()', () => {
    const fakeAlertRow = makeAlertRow();

    it('returns paginated security alerts', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [fakeAlertRow, fakeAlertRow] });

      const result = await service.getSecurityAlerts();
      expect(result.total).toBe(2);
      expect(result.alerts).toHaveLength(2);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('applies type filter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.getSecurityAlerts({ type: SecurityAlertType.MULTIPLE_FAILED_LOGINS });
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('type = $1');
      expect(params[0]).toBe(SecurityAlertType.MULTIPLE_FAILED_LOGINS);
    });

    it('applies severity filter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.getSecurityAlerts({ severity: SecurityAlertSeverity.CRITICAL });
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('severity = $1');
      expect(params[0]).toBe(SecurityAlertSeverity.CRITICAL);
    });

    it('applies status filter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.getSecurityAlerts({ status: SecurityAlertStatus.OPEN });
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('status = $1');
      expect(params[0]).toBe(SecurityAlertStatus.OPEN);
    });

    it('applies date range filters', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      await service.getSecurityAlerts({ startDate, endDate });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('created_at >=');
      expect(sql).toContain('created_at <=');
      expect(params).toContain(startDate);
      expect(params).toContain(endDate);
    });

    it('throws when database query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.getSecurityAlerts()).rejects.toThrow('DB error');
    });

    it('maps database rows to SecurityAlert objects correctly', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [fakeAlertRow] });

      const result = await service.getSecurityAlerts();
      const alert = result.alerts[0];

      expect(alert.id).toBe('alert-1');
      expect(alert.type).toBe(SecurityAlertType.MULTIPLE_FAILED_LOGINS);
      expect(alert.severity).toBe(SecurityAlertSeverity.HIGH);
      expect(alert.status).toBe(SecurityAlertStatus.OPEN);
      expect(alert.affectedUserId).toBe('user-1');
    });
  });

  // -------------------------------------------------------------------------
  // analyzeAuditLog()
  // -------------------------------------------------------------------------

  describe('analyzeAuditLog()', () => {
    it('generates MULTIPLE_FAILED_LOGINS alert for failed login when threshold met', async () => {
      // checkFailedLogins → threshold met
      mockQuery.mockResolvedValueOnce({ rows: [{ cnt: '5' }] });
      // INSERT alert
      mockQuery.mockResolvedValueOnce({ rows: [makeAlertRow()] });
      // SELECT executives
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const alerts = await service.analyzeAuditLog(
        makeAuditLog({ action: 'LOGIN', result: AuditResult.FAILURE })
      );

      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts[0].type).toBe(SecurityAlertType.MULTIPLE_FAILED_LOGINS);
    });

    it('returns empty array when no suspicious patterns detected', async () => {
      // checkFailedLogins → below threshold
      mockQuery.mockResolvedValueOnce({ rows: [{ cnt: '1' }] });

      const alerts = await service.analyzeAuditLog(
        makeAuditLog({ action: 'LOGIN', result: AuditResult.FAILURE })
      );

      expect(alerts).toHaveLength(0);
    });

    it('generates UNAUTHORIZED_ATTEMPTS alert for non-login failures at threshold', async () => {
      // checkUnauthorizedAttempts → threshold met
      mockQuery.mockResolvedValueOnce({ rows: [{ cnt: '3' }] });
      // INSERT alert
      mockQuery.mockResolvedValueOnce({
        rows: [makeAlertRow({ type: SecurityAlertType.UNAUTHORIZED_ATTEMPTS })],
      });
      // SELECT executives
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const alerts = await service.analyzeAuditLog(
        makeAuditLog({ action: 'DELETE', result: AuditResult.FAILURE })
      );

      expect(alerts.some((a) => a.type === SecurityAlertType.UNAUTHORIZED_ATTEMPTS)).toBe(true);
    });

    it('does not throw on database error — returns empty array', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      const alerts = await service.analyzeAuditLog(
        makeAuditLog({ action: 'LOGIN', result: AuditResult.FAILURE })
      );
      expect(Array.isArray(alerts)).toBe(true);
    });
  });
});
