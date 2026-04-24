import { DashboardService } from './dashboardService';

// Mock config
jest.mock('../config', () => ({
  default: {
    env: 'test',
    port: 3000,
    apiBaseUrl: 'http://localhost:3000',
    logging: { level: 'info', filePath: '/tmp/test.log' },
    database: { host: 'localhost', port: 5432, name: 'test', user: 'test', password: 'test' },
    redis: { host: 'localhost', port: 6379 },
    security: { corsOrigin: '*', rateLimitWindowMs: 60000, rateLimitMaxRequests: 100 },
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../database/connection', () => ({
  db: { query: jest.fn() },
}));

jest.mock('../cache/cacheService', () => ({
  cacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  CacheTTL: { DASHBOARD_METRICS: 300 },
  CachePrefix: { DASHBOARD: 'dashboard:' },
}));

import { db } from '../database/connection';
import { cacheService } from '../cache/cacheService';

const mockDb = db as jest.Mocked<typeof db>;
const mockCache = cacheService as jest.Mocked<typeof cacheService>;

// Shared mock data
const projectRows = [{ status: 'ACTIVE', count: '3', total_value: '30000' }];
const paymentByStatus = [{ status: 'COMPLETED', count: '10', amount: '100000' }];
const paymentByMethod = [{ payment_method: 'MPESA', count: '8', amount: '80000' }];
const approvalsRows = [
  { id: 'a1', project_id: 'p1', project_ref: 'TST-PRJ-2024-000001', amount: '5000', currency: 'USD', status: 'PENDING_APPROVAL', requested_by: 'Alice', created_at: new Date() },
];
const executionRows = [
  { id: 'a2', project_id: 'p2', project_ref: 'TST-PRJ-2024-000002', amount: '3000', currency: 'USD', status: 'APPROVED_PENDING_EXECUTION', requested_by: 'Bob', created_at: new Date() },
];

describe('DashboardService – role-specific dashboards', () => {
  let service: DashboardService;

  beforeEach(() => {
    service = new DashboardService();
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
  });

  // ─── getCEODashboard ───────────────────────────────────────────────────────

  describe('getCEODashboard', () => {
    const companyMetricsMock = {
      revenue: { total: 100000, completed: 80000, pending: 20000, currency: 'USD' },
      clients: { total: 7, pendingCommitment: 0, leads: 5, qualifiedLeads: 0, projects: 2 },
      projects: { total: 3, pendingApproval: 0, active: 3, onHold: 0, completed: 0, cancelled: 0 },
      payments: { total: 10, completed: 10, pending: 0, failed: 0, refunded: 0, totalAmount: 100000, completedAmount: 80000 },
      pendingApprovals: 2,
      overdueReports: 1,
      generatedAt: new Date(),
    };

    it('returns company metrics, pending approvals, and security alerts', async () => {
      jest.spyOn(service, 'getCompanyMetrics').mockResolvedValueOnce(companyMetricsMock);
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'a1', type: 'payment_approval', description: 'desc', requested_by: 'Alice', created_at: new Date() }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 's1', type: 'brute_force', severity: 'HIGH', message: 'Multiple failed logins', created_at: new Date() }] } as any);

      const result = await service.getCEODashboard();

      expect(result.companyMetrics).toBeDefined();
      expect(result.pendingApprovals).toHaveLength(1);
      expect(result.pendingApprovals[0].id).toBe('a1');
      expect(result.securityAlerts).toHaveLength(1);
      expect(result.securityAlerts[0].severity).toBe('HIGH');
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('returns empty arrays when no approvals or alerts', async () => {
      jest.spyOn(service, 'getCompanyMetrics').mockResolvedValueOnce(companyMetricsMock);
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.getCEODashboard();
      expect(result.pendingApprovals).toHaveLength(0);
      expect(result.securityAlerts).toHaveLength(0);
    });
  });

  // ─── getExecutiveDashboard ─────────────────────────────────────────────────

  describe('getExecutiveDashboard', () => {
    it('returns pending approvals and execution queue', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: approvalsRows } as any)
        .mockResolvedValueOnce({ rows: executionRows } as any)
        // payment metrics sub-queries
        .mockResolvedValueOnce({ rows: paymentByStatus } as any)
        .mockResolvedValueOnce({ rows: paymentByMethod } as any);

      const result = await service.getExecutiveDashboard('user-1', 'CFO');

      expect(result.pendingApprovals).toHaveLength(1);
      expect(result.pendingApprovals[0].amount).toBe(5000);
      expect(result.paymentExecutionQueue).toHaveLength(1);
      expect(result.paymentExecutionQueue[0].amount).toBe(3000);
      expect(result.paymentMetrics).toBeDefined();
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('returns empty queues when no items', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.getExecutiveDashboard('user-2', 'EA');
      expect(result.pendingApprovals).toHaveLength(0);
      expect(result.paymentExecutionQueue).toHaveLength(0);
    });
  });

  // ─── getCLevelDashboard ────────────────────────────────────────────────────

  describe('getCLevelDashboard', () => {
    it('returns department metrics, team performance, and project metrics', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: 'd1', name: 'Client Acquisition', team_size: '5', active_projects: '3' }],
        } as any)
        // team performance sub-queries
        .mockResolvedValueOnce({ rows: [{ count: '10' }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '8' }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '2' }] } as any)
        // project metrics
        .mockResolvedValueOnce({ rows: projectRows } as any);

      const result = await service.getCLevelDashboard('user-1', 'COO');

      expect(result.departmentMetrics).toHaveLength(1);
      expect(result.departmentMetrics[0].departmentName).toBe('Client Acquisition');
      expect(result.departmentMetrics[0].teamSize).toBe(5);
      expect(result.departmentMetrics[0].activeProjects).toBe(3);
      expect(result.teamPerformance.totalUsers).toBe(10);
      expect(result.projectMetrics.total).toBe(3);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });
  });

  // ─── getOperationsDashboard ────────────────────────────────────────────────

  describe('getOperationsDashboard', () => {
    it('returns client pipeline, recent leads, and property metrics', async () => {
      const pipelineMock = { pipeline: [{ status: 'LEAD', count: 5, percentage: 71.4 }, { status: 'PROJECT', count: 2, percentage: 28.6 }], total: 7, generatedAt: new Date() };
      const propertyMock = { total: 5, available: 5, sold: 0, unavailable: 0, totalValue: 250000, byType: [], generatedAt: new Date() };

      jest.spyOn(service, 'getClientPipelineMetrics').mockResolvedValueOnce(pipelineMock);
      jest.spyOn(service, 'getPropertyMetrics').mockResolvedValueOnce(propertyMock);

      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'c1', client_name: 'Acme Corp', status: 'LEAD', agent_id: 'ag1', created_at: new Date() }],
      } as any);

      const result = await service.getOperationsDashboard('user-1');

      expect(result.clientPipeline.total).toBe(7);
      expect(result.recentLeads).toHaveLength(1);
      expect(result.recentLeads[0].clientName).toBe('Acme Corp');
      expect(result.propertyMetrics.available).toBe(5);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });
  });

  // ─── getTechnologyDashboard ────────────────────────────────────────────────

  describe('getTechnologyDashboard', () => {
    it('returns project metrics, GitHub activity, and developer stats', async () => {
      const projectMock = { statuses: [{ status: 'ACTIVE', count: 3, percentage: 100, totalValue: 30000 }], total: 3, totalValue: 30000, generatedAt: new Date() };
      jest.spyOn(service, 'getProjectStatusMetrics').mockResolvedValueOnce(projectMock);

      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ repository_name: 'tst-core', commits: '42', pull_requests: '10', merged_prs: '8', last_activity: new Date() }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ user_id: 'u1', username: 'dev1', github_username: 'dev1gh', commits: '20', pull_requests: '5' }],
        } as any);

      const result = await service.getTechnologyDashboard('user-1');

      expect(result.projectMetrics.total).toBe(3);
      expect(result.githubActivity).toHaveLength(1);
      expect(result.githubActivity[0].repositoryName).toBe('tst-core');
      expect(result.githubActivity[0].commits).toBe(42);
      expect(result.developerStats).toHaveLength(1);
      expect(result.developerStats[0].githubUsername).toBe('dev1gh');
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('handles null last_activity gracefully', async () => {
      const projectMock = { statuses: [], total: 0, totalValue: 0, generatedAt: new Date() };
      jest.spyOn(service, 'getProjectStatusMetrics').mockResolvedValueOnce(projectMock);

      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ repository_name: 'empty-repo', commits: '0', pull_requests: '0', merged_prs: '0', last_activity: null }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.getTechnologyDashboard('user-1');
      expect(result.githubActivity[0].lastActivity).toBeNull();
    });
  });

  // ─── getAgentDashboard ─────────────────────────────────────────────────────

  describe('getAgentDashboard', () => {
    it('returns personal clients, leads count, commissions, and report rate', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ status: 'LEAD', count: '3' }, { status: 'PROJECT', count: '1' }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '3' }] } as any)
        .mockResolvedValueOnce({
          rows: [{ project_id: 'p1', project_ref: 'TST-PRJ-2024-000001', amount: '500', status: 'PENDING' }],
        } as any)
        .mockResolvedValueOnce({ rows: [{ submitted: '25', total_days: '30' }] } as any);

      const result = await service.getAgentDashboard('agent-1');

      expect(result.myClients.total).toBe(4);
      expect(result.myLeads).toBe(3);
      expect(result.myCommissions).toHaveLength(1);
      expect(result.myCommissions[0].amount).toBe(500);
      expect(result.reportSubmissionRate).toBeCloseTo(83.3, 0);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('returns zero report rate when no reports submitted', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ submitted: '0', total_days: '30' }] } as any);

      const result = await service.getAgentDashboard('agent-2');
      expect(result.reportSubmissionRate).toBe(0);
    });
  });

  // ─── getTrainerDashboard ───────────────────────────────────────────────────

  describe('getTrainerDashboard', () => {
    it('returns assigned agents, training assignments, and progress', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '3' }] } as any)
        .mockResolvedValueOnce({
          rows: [
            { id: 'ta1', agent_id: 'ag1', agent_name: 'Agent One', course_id: 'c1', course_name: 'Sales 101', status: 'IN_PROGRESS', due_date: new Date() },
          ],
        } as any)
        .mockResolvedValueOnce({
          rows: [
            { agent_id: 'ag1', agent_name: 'Agent One', completed_courses: '2', pending_courses: '1' },
          ],
        } as any);

      const result = await service.getTrainerDashboard('trainer-1');

      expect(result.assignedAgents).toBe(3);
      expect(result.trainingAssignments).toHaveLength(1);
      expect(result.trainingAssignments[0].courseName).toBe('Sales 101');
      expect(result.agentProgress).toHaveLength(1);
      expect(result.agentProgress[0].completedCourses).toBe(2);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('handles null due_date gracefully', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] } as any)
        .mockResolvedValueOnce({
          rows: [{ id: 'ta2', agent_id: 'ag2', agent_name: 'Agent Two', course_id: 'c2', course_name: 'Basics', status: 'PENDING', due_date: null }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.getTrainerDashboard('trainer-2');
      expect(result.trainingAssignments[0].dueDate).toBeNull();
    });
  });

  // ─── getRoleDashboard dispatcher ──────────────────────────────────────────

  describe('getRoleDashboard', () => {
    it('dispatches CEO role to getCEODashboard', async () => {
      const spy = jest.spyOn(service, 'getCEODashboard').mockResolvedValueOnce({} as any);
      await service.getRoleDashboard('u1', 'CEO');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('dispatches CFO role to getExecutiveDashboard', async () => {
      const spy = jest.spyOn(service, 'getExecutiveDashboard').mockResolvedValueOnce({} as any);
      await service.getRoleDashboard('u1', 'CFO');
      expect(spy).toHaveBeenCalledWith('u1', 'CFO');
    });

    it('dispatches EA role to getExecutiveDashboard', async () => {
      const spy = jest.spyOn(service, 'getExecutiveDashboard').mockResolvedValueOnce({} as any);
      await service.getRoleDashboard('u1', 'EA');
      expect(spy).toHaveBeenCalledWith('u1', 'EA');
    });

    it('dispatches CoS role to getExecutiveDashboard', async () => {
      const spy = jest.spyOn(service, 'getExecutiveDashboard').mockResolvedValueOnce({} as any);
      await service.getRoleDashboard('u1', 'CoS');
      expect(spy).toHaveBeenCalledWith('u1', 'CoS');
    });

    it('dispatches COO role to getCLevelDashboard', async () => {
      const spy = jest.spyOn(service, 'getCLevelDashboard').mockResolvedValueOnce({} as any);
      await service.getRoleDashboard('u1', 'COO');
      expect(spy).toHaveBeenCalledWith('u1', 'COO');
    });

    it('dispatches CTO role to getCLevelDashboard', async () => {
      const spy = jest.spyOn(service, 'getCLevelDashboard').mockResolvedValueOnce({} as any);
      await service.getRoleDashboard('u1', 'CTO');
      expect(spy).toHaveBeenCalledWith('u1', 'CTO');
    });

    it('dispatches OPERATIONS_USER to getOperationsDashboard', async () => {
      const spy = jest.spyOn(service, 'getOperationsDashboard').mockResolvedValueOnce({} as any);
      await service.getRoleDashboard('u1', 'OPERATIONS_USER');
      expect(spy).toHaveBeenCalledWith('u1');
    });

    it('dispatches TECHNOLOGY_USER to getTechnologyDashboard', async () => {
      const spy = jest.spyOn(service, 'getTechnologyDashboard').mockResolvedValueOnce({} as any);
      await service.getRoleDashboard('u1', 'TECHNOLOGY_USER');
      expect(spy).toHaveBeenCalledWith('u1');
    });

    it('dispatches DEVELOPER to getTechnologyDashboard', async () => {
      const spy = jest.spyOn(service, 'getTechnologyDashboard').mockResolvedValueOnce({} as any);
      await service.getRoleDashboard('u1', 'DEVELOPER');
      expect(spy).toHaveBeenCalledWith('u1');
    });

    it('dispatches AGENT to getAgentDashboard', async () => {
      const spy = jest.spyOn(service, 'getAgentDashboard').mockResolvedValueOnce({} as any);
      await service.getRoleDashboard('u1', 'AGENT');
      expect(spy).toHaveBeenCalledWith('u1');
    });

    it('dispatches TRAINER to getTrainerDashboard', async () => {
      const spy = jest.spyOn(service, 'getTrainerDashboard').mockResolvedValueOnce({} as any);
      await service.getRoleDashboard('u1', 'TRAINER');
      expect(spy).toHaveBeenCalledWith('u1');
    });

    it('dispatches HEAD_OF_TRAINERS to getTrainerDashboard', async () => {
      const spy = jest.spyOn(service, 'getTrainerDashboard').mockResolvedValueOnce({} as any);
      await service.getRoleDashboard('u1', 'HEAD_OF_TRAINERS');
      expect(spy).toHaveBeenCalledWith('u1');
    });

    it('falls back to getCEODashboard for unknown roles', async () => {
      const spy = jest.spyOn(service, 'getCEODashboard').mockResolvedValueOnce({} as any);
      await service.getRoleDashboard('u1', 'UNKNOWN_ROLE');
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
