import { db } from '../database/connection';
import { cacheService, CacheTTL, CachePrefix } from '../cache/cacheService';
import logger from '../utils/logger';
import { Role } from '../auth/authorizationService';

export interface DateRange {
  from?: Date;
  to?: Date;
}

export type DateRangePeriod =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'this_quarter'
  | 'this_year'
  | 'custom';

export interface TrendIndicator {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  direction: 'up' | 'down' | 'flat';
}

export interface MetricsWithTrend {
  current: CompanyMetrics;
  previous: CompanyMetrics;
  trends: {
    revenue: TrendIndicator;
    clients: TrendIndicator;
    projects: TrendIndicator;
    payments: TrendIndicator;
  };
  generatedAt: Date;
}

export interface WidgetLayout {
  userId: string;
  widgets: Array<{
    id: string;
    type: string;
    position: { x: number; y: number; w: number; h: number };
    visible: boolean;
  }>;
  updatedAt: Date;
}

export interface ExportResult {
  fileName: string;
  mimeType: string;
  data: Buffer;
  generatedAt: Date;
}

export interface CompanyMetrics {
  revenue: {
    total: number;
    completed: number;
    pending: number;
    currency: string;
  };
  clients: {
    total: number;
    pendingCommitment: number;
    leads: number;
    qualifiedLeads: number;
    projects: number;
  };
  projects: {
    total: number;
    pendingApproval: number;
    active: number;
    onHold: number;
    completed: number;
    cancelled: number;
  };
  payments: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    refunded: number;
    totalAmount: number;
    completedAmount: number;
  };
  pendingApprovals: number;
  overdueReports: number;
  generatedAt: Date;
}

export interface ClientPipelineMetrics {
  pipeline: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  total: number;
  generatedAt: Date;
}

export interface ProjectStatusMetrics {
  statuses: Array<{
    status: string;
    count: number;
    percentage: number;
    totalValue: number;
  }>;
  total: number;
  totalValue: number;
  generatedAt: Date;
}

export interface PaymentMetrics {
  totalAmount: number;
  completedAmount: number;
  pendingAmount: number;
  failedAmount: number;
  refundedAmount: number;
  byStatus: Array<{
    status: string;
    count: number;
    amount: number;
  }>;
  byMethod: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
  generatedAt: Date;
}

export interface TeamPerformanceMetrics {
  totalUsers: number;
  reportSubmissionRate: number;
  usersWithReports: number;
  usersOverdue: number;
  byManager?: Array<{
    managerId: string;
    managerName: string;
    teamSize: number;
    submissionRate: number;
  }>;
  generatedAt: Date;
}

export interface PropertyMetrics {
  total: number;
  available: number;
  sold: number;
  unavailable: number;
  totalValue: number;
  byType: Array<{
    type: string;
    count: number;
    totalValue: number;
  }>;
  generatedAt: Date;
}

// Role-specific dashboard types

export interface SecurityAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  createdAt: Date;
}

export interface PendingApprovalItem {
  id: string;
  type: string;
  description: string;
  requestedBy: string;
  createdAt: Date;
}

export interface CEODashboard {
  companyMetrics: CompanyMetrics;
  pendingApprovals: PendingApprovalItem[];
  securityAlerts: SecurityAlert[];
  generatedAt: Date;
}

export interface FinancialApprovalItem {
  id: string;
  projectId: string;
  projectRef: string;
  amount: number;
  currency: string;
  status: string;
  requestedBy: string;
  createdAt: Date;
}

export interface ExecutiveDashboard {
  pendingApprovals: FinancialApprovalItem[];
  paymentExecutionQueue: FinancialApprovalItem[];
  paymentMetrics: PaymentMetrics;
  generatedAt: Date;
}

export interface DepartmentMetric {
  departmentId: string;
  departmentName: string;
  teamSize: number;
  activeProjects: number;
  reportSubmissionRate: number;
}

export interface CLevelDashboard {
  departmentMetrics: DepartmentMetric[];
  teamPerformance: TeamPerformanceMetrics;
  projectMetrics: ProjectStatusMetrics;
  generatedAt: Date;
}

export interface LeadItem {
  id: string;
  clientName: string;
  status: string;
  agentId: string;
  createdAt: Date;
}

export interface OperationsDashboard {
  clientPipeline: ClientPipelineMetrics;
  recentLeads: LeadItem[];
  propertyMetrics: PropertyMetrics;
  generatedAt: Date;
}

export interface GitHubActivity {
  repositoryName: string;
  commits: number;
  pullRequests: number;
  mergedPRs: number;
  lastActivity: Date | null;
}

export interface DeveloperStat {
  userId: string;
  username: string;
  githubUsername: string | null;
  commits: number;
  pullRequests: number;
}

export interface TechnologyDashboard {
  projectMetrics: ProjectStatusMetrics;
  githubActivity: GitHubActivity[];
  developerStats: DeveloperStat[];
  generatedAt: Date;
}

export interface AgentCommission {
  projectId: string;
  projectRef: string;
  amount: number;
  status: string;
}

export interface AgentDashboard {
  myClients: ClientPipelineMetrics;
  myLeads: number;
  myCommissions: AgentCommission[];
  reportSubmissionRate: number;
  generatedAt: Date;
}

export interface TrainingAssignment {
  id: string;
  agentId: string;
  agentName: string;
  courseId: string;
  courseName: string;
  status: string;
  dueDate: Date | null;
}

export interface TrainerDashboard {
  assignedAgents: number;
  trainingAssignments: TrainingAssignment[];
  agentProgress: Array<{ agentId: string; agentName: string; completedCourses: number; pendingCourses: number }>;
  generatedAt: Date;
}

export type RoleDashboard =
  | CEODashboard
  | ExecutiveDashboard
  | CLevelDashboard
  | OperationsDashboard
  | TechnologyDashboard
  | AgentDashboard
  | TrainerDashboard;

/**
 * Dashboard Service
 * Aggregates data from multiple modules to provide real-time KPIs
 * Requirements: 17.1-17.3, 21.4
 */
export class DashboardService {
  /**
   * Generic cache wrapper with 5-minute TTL
   * Requirement 17.11: Cache dashboard data for 5 minutes
   * Requirement 21.4: Cache dashboard metrics in Redis with 5-minute TTL
   */
  async getCachedMetrics<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = CacheTTL.DASHBOARD_METRICS
  ): Promise<T> {
    const cacheKey = `${CachePrefix.DASHBOARD}${key}`;
    try {
      const cached = await cacheService.get<T>(cacheKey);
      if (cached !== null) {
        logger.debug('Dashboard cache hit', { key: cacheKey });
        return cached;
      }
    } catch (err) {
      logger.warn('Dashboard cache read failed, fetching fresh data', { key: cacheKey, err });
    }

    const data = await fetchFn();

    try {
      await cacheService.set(cacheKey, data, ttlSeconds);
    } catch (err) {
      logger.warn('Dashboard cache write failed', { key: cacheKey, err });
    }

    return data;
  }

  /**
   * Get company-wide KPIs
   * Requirement 17.1: Provide role-specific dashboards with relevant KPIs
   * Requirement 17.4: Display company-wide metrics for CEO
   */
  async getCompanyMetrics(dateRange?: DateRange): Promise<CompanyMetrics> {
    const cacheKey = `company:${dateRange?.from?.toISOString() ?? 'all'}:${dateRange?.to?.toISOString() ?? 'all'}`;
    return this.getCachedMetrics(cacheKey, async () => {
      const dateCondition = this.buildDateCondition(dateRange, 'created_at');

      const [clientsResult, projectsResult, paymentsResult, approvalsResult, reportsResult, activeProjectsResult, closedDealsResult] =
        await Promise.all([
          db.query(
            `SELECT status, COUNT(*) AS count
             FROM clients
             ${dateCondition ? `WHERE ${dateCondition}` : ''}
             GROUP BY status`
          ),
          db.query(
            `SELECT status, COUNT(*) AS count, COALESCE(SUM(service_amount), 0) AS total_value
             FROM projects
             ${dateCondition ? `WHERE ${dateCondition}` : ''}
             GROUP BY status`
          ),
          db.query(
            `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total_amount
             FROM payments
             ${dateCondition ? `WHERE ${dateCondition}` : ''}
             GROUP BY status`
          ),
          db.query(
            `SELECT COUNT(*) AS count FROM payment_approvals WHERE status = 'PENDING_APPROVAL'`
          ),
          db.query(
            `SELECT COUNT(*) AS count
             FROM users u
             WHERE NOT EXISTS (
               SELECT 1 FROM daily_reports dr
               WHERE dr.user_id = u.id AND dr.report_date = CURRENT_DATE
             )`
          ),
          // Active projects = started on or before today AND end date hasn't passed yet
          db.query(
            `SELECT COUNT(*) AS count
             FROM projects
             WHERE status IN ('ACTIVE', 'PENDING_APPROVAL')
               AND (start_date IS NULL OR start_date <= CURRENT_DATE)
               AND (end_date IS NULL OR end_date >= CURRENT_DATE)`
          ),
          // Closed deals = projects whose end_date has passed (contract period over)
          db.query(
            `SELECT COUNT(*) AS count
             FROM projects
             WHERE end_date IS NOT NULL AND end_date < CURRENT_DATE`
          ),
        ]);

      const clientsByStatus = this.groupByField(clientsResult.rows, 'status', 'count');
      const projectsByStatus = this.groupByField(projectsResult.rows, 'status', 'count');
      const paymentsByStatus = this.groupByField(paymentsResult.rows, 'status', 'count');
      const paymentAmountByStatus = this.groupByField(paymentsResult.rows, 'status', 'total_amount');

      const totalRevenue = paymentsResult.rows.reduce(
        (sum: number, r: any) => sum + parseFloat(r.total_amount),
        0
      );

      return {
        revenue: {
          total: totalRevenue,
          completed: parseFloat(paymentAmountByStatus['COMPLETED'] ?? '0'),
          pending: parseFloat(paymentAmountByStatus['PENDING'] ?? '0'),
          currency: 'USD',
        },
        clients: {
          total: clientsResult.rows.reduce((sum: number, r: any) => sum + parseInt(r.count), 0),
          pendingCommitment: parseInt(clientsByStatus['PENDING_COMMITMENT'] ?? '0'),
          // Map actual client statuses — all non-closed statuses count as leads
          leads: (
            parseInt(clientsByStatus['NEW_LEAD'] ?? '0') +
            parseInt(clientsByStatus['CONVERTED'] ?? '0') +
            parseInt(clientsByStatus['LEAD_ACTIVATED'] ?? '0') +
            parseInt(clientsByStatus['LEAD_QUALIFIED'] ?? '0') +
            parseInt(clientsByStatus['NEGOTIATION'] ?? '0')
          ),
          qualifiedLeads: (
            parseInt(clientsByStatus['LEAD_QUALIFIED'] ?? '0') +
            parseInt(clientsByStatus['LEAD_ACTIVATED'] ?? '0')
          ),
          projects: parseInt(clientsByStatus['CLOSED_WON'] ?? '0'),
        },
        projects: {
          total: projectsResult.rows.reduce((sum: number, r: any) => sum + parseInt(r.count), 0),
          pendingApproval: parseInt(projectsByStatus['PENDING_APPROVAL'] ?? '0'),
          active: parseInt(activeProjectsResult.rows[0]?.count ?? '0'),
          onHold: parseInt(projectsByStatus['ON_HOLD'] ?? '0'),
          // Closed deals = projects whose end_date has passed
          completed: parseInt(closedDealsResult.rows[0]?.count ?? '0'),
          cancelled: parseInt(projectsByStatus['CANCELLED'] ?? '0'),
        },
        payments: {
          total: paymentsResult.rows.reduce((sum: number, r: any) => sum + parseInt(r.count), 0),
          completed: parseInt(paymentsByStatus['COMPLETED'] ?? '0'),
          pending: parseInt(paymentsByStatus['PENDING'] ?? '0'),
          failed: parseInt(paymentsByStatus['FAILED'] ?? '0'),
          refunded: parseInt(paymentsByStatus['REFUNDED'] ?? '0'),
          totalAmount: totalRevenue,
          completedAmount: parseFloat(paymentAmountByStatus['COMPLETED'] ?? '0'),
        },
        pendingApprovals: parseInt(approvalsResult.rows[0]?.count ?? '0'),
        overdueReports: parseInt(reportsResult.rows[0]?.count ?? '0'),
        generatedAt: new Date(),
      };
    });
  }

  /**
   * Get client pipeline metrics by status
   * Requirement 17.3: Support dashboard widget client_pipeline
   */
  async getClientPipelineMetrics(): Promise<ClientPipelineMetrics> {
    return this.getCachedMetrics('client-pipeline', async () => {
      const result = await db.query(
        `SELECT status, COUNT(*) AS count FROM clients GROUP BY status ORDER BY count DESC`
      );

      const total = result.rows.reduce((sum: number, r: any) => sum + parseInt(r.count), 0);

      const pipeline = result.rows.map((r: any) => ({
        status: r.status,
        count: parseInt(r.count),
        percentage: total > 0 ? Math.round((parseInt(r.count) / total) * 100 * 10) / 10 : 0,
      }));

      return { pipeline, total, generatedAt: new Date() };
    });
  }

  /**
   * Get project counts by status
   * Requirement 17.3: Support dashboard widget project_status
   */
  async getProjectStatusMetrics(): Promise<ProjectStatusMetrics> {
    return this.getCachedMetrics('project-status', async () => {
      const result = await db.query(
        `SELECT status, COUNT(*) AS count, COALESCE(SUM(service_amount), 0) AS total_value
         FROM projects
         GROUP BY status
         ORDER BY count DESC`
      );

      const total = result.rows.reduce((sum: number, r: any) => sum + parseInt(r.count), 0);
      const totalValue = result.rows.reduce(
        (sum: number, r: any) => sum + parseFloat(r.total_value),
        0
      );

      const statuses = result.rows.map((r: any) => ({
        status: r.status,
        count: parseInt(r.count),
        percentage: total > 0 ? Math.round((parseInt(r.count) / total) * 100 * 10) / 10 : 0,
        totalValue: parseFloat(r.total_value),
      }));

      return { statuses, total, totalValue, generatedAt: new Date() };
    });
  }

  /**
   * Get payment totals and status breakdown
   * Requirement 17.3: Support dashboard widget payment_status
   */
  async getPaymentMetrics(dateRange?: DateRange): Promise<PaymentMetrics> {
    const cacheKey = `payments:${dateRange?.from?.toISOString() ?? 'all'}:${dateRange?.to?.toISOString() ?? 'all'}`;
    return this.getCachedMetrics(cacheKey, async () => {
      const dateCondition = this.buildDateCondition(dateRange, 'created_at');
      const whereClause = dateCondition ? `WHERE ${dateCondition}` : '';

      const [byStatusResult, byMethodResult] = await Promise.all([
        db.query(
          `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount
           FROM payments ${whereClause}
           GROUP BY status`
        ),
        db.query(
          `SELECT payment_method, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount
           FROM payments ${whereClause}
           GROUP BY payment_method`
        ),
      ]);

      const statusMap = this.groupByField(byStatusResult.rows, 'status', 'amount');

      return {
        totalAmount: byStatusResult.rows.reduce(
          (sum: number, r: any) => sum + parseFloat(r.amount),
          0
        ),
        completedAmount: parseFloat(statusMap['COMPLETED'] ?? '0'),
        pendingAmount: parseFloat(statusMap['PENDING'] ?? '0'),
        failedAmount: parseFloat(statusMap['FAILED'] ?? '0'),
        refundedAmount: parseFloat(statusMap['REFUNDED'] ?? '0'),
        byStatus: byStatusResult.rows.map((r: any) => ({
          status: r.status,
          count: parseInt(r.count),
          amount: parseFloat(r.amount),
        })),
        byMethod: byMethodResult.rows.map((r: any) => ({
          method: r.payment_method,
          count: parseInt(r.count),
          amount: parseFloat(r.amount),
        })),
        generatedAt: new Date(),
      };
    });
  }

  /**
   * Get team report submission rates
   * Requirement 17.3: Support dashboard widget team_performance, report_compliance
   * Requirement 10.8: Calculate report submission rate per user over 30-day periods
   */
  async getTeamPerformanceMetrics(managerId?: string): Promise<TeamPerformanceMetrics> {
    const cacheKey = `team-performance:${managerId ?? 'all'}`;
    return this.getCachedMetrics(cacheKey, async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const userCondition = managerId
        ? `WHERE u.id IN (
             SELECT id FROM users WHERE id = $1
             UNION
             SELECT u2.id FROM users u2
             JOIN departments d ON d.id = u2.department_id
             WHERE d.head_id = $1
           )`
        : '';

      const params = managerId ? [managerId] : [];

      const [totalUsersResult, submissionResult, overdueResult] = await Promise.all([
        db.query(`SELECT COUNT(*) AS count FROM users u ${userCondition}`, params),
        db.query(
          `SELECT COUNT(DISTINCT dr.user_id) AS count
           FROM daily_reports dr
           JOIN users u ON u.id = dr.user_id
           ${managerId ? `WHERE u.id IN (SELECT id FROM users WHERE id = $1 UNION SELECT u2.id FROM users u2 JOIN departments d ON d.id = u2.department_id WHERE d.head_id = $1)` : ''}
           AND dr.report_date >= ${managerId ? 2 : 1}`,
          managerId ? [managerId, thirtyDaysAgo] : [thirtyDaysAgo]
        ),
        db.query(
          `SELECT COUNT(*) AS count
           FROM users u
           WHERE NOT EXISTS (
             SELECT 1 FROM daily_reports dr
             WHERE dr.user_id = u.id AND dr.report_date = CURRENT_DATE
           )
           ${managerId ? `AND u.id IN (SELECT id FROM users WHERE id = $1 UNION SELECT u2.id FROM users u2 JOIN departments d ON d.id = u2.department_id WHERE d.head_id = $1)` : ''}`,
          params
        ),
      ]);

      const totalUsers = parseInt(totalUsersResult.rows[0]?.count ?? '0');
      const usersWithReports = parseInt(submissionResult.rows[0]?.count ?? '0');
      const usersOverdue = parseInt(overdueResult.rows[0]?.count ?? '0');
      const submissionRate =
        totalUsers > 0 ? Math.round((usersWithReports / totalUsers) * 100 * 10) / 10 : 0;

      return {
        totalUsers,
        reportSubmissionRate: submissionRate,
        usersWithReports,
        usersOverdue,
        generatedAt: new Date(),
      };
    });
  }

  /**
   * Get property listing stats
   * Requirement 17.1: Provide role-specific dashboards with relevant KPIs
   */
  async getPropertyMetrics(): Promise<PropertyMetrics> {
    return this.getCachedMetrics('property-metrics', async () => {
      const [statusResult, typeResult] = await Promise.all([
        db.query(
          `SELECT status, COUNT(*) AS count, COALESCE(SUM(price), 0) AS total_value
           FROM property_listings
           GROUP BY status`
        ),
        db.query(
          `SELECT property_type, COUNT(*) AS count, COALESCE(SUM(price), 0) AS total_value
           FROM property_listings
           GROUP BY property_type
           ORDER BY count DESC`
        ),
      ]);

      const statusMap = this.groupByField(statusResult.rows, 'status', 'count');
      const totalValue = statusResult.rows.reduce(
        (sum: number, r: any) => sum + parseFloat(r.total_value),
        0
      );
      const total = statusResult.rows.reduce((sum: number, r: any) => sum + parseInt(r.count), 0);

      return {
        total,
        available: parseInt(statusMap['AVAILABLE'] ?? '0'),
        sold: parseInt(statusMap['SOLD'] ?? '0'),
        unavailable: parseInt(statusMap['UNAVAILABLE'] ?? '0'),
        totalValue,
        byType: typeResult.rows.map((r: any) => ({
          type: r.property_type,
          count: parseInt(r.count),
          totalValue: parseFloat(r.total_value),
        })),
        generatedAt: new Date(),
      };
    });
  }

  // Helpers

  private buildDateCondition(dateRange?: DateRange, column: string = 'created_at'): string {
    if (!dateRange) return '';
    const parts: string[] = [];
    if (dateRange.from) parts.push(`${column} >= '${dateRange.from.toISOString()}'`);
    if (dateRange.to) parts.push(`${column} <= '${dateRange.to.toISOString()}'`);
    return parts.join(' AND ');
  }

  private groupByField(
    rows: any[],
    keyField: string,
    valueField: string
  ): Record<string, string> {
    return rows.reduce((acc: Record<string, string>, row: any) => {
      acc[row[keyField]] = row[valueField];
      return acc;
    }, {});
  }

  // Role-specific dashboards

  /**
   * CEO Dashboard: company-wide metrics + pending approvals + security alerts
   * Requirements: 17.4, 3.2, 8.7
   */
  async getCEODashboard(dateRange?: DateRange): Promise<CEODashboard> {
    const cacheKey = `ceo:${dateRange?.from?.toISOString() ?? 'all'}:${dateRange?.to?.toISOString() ?? 'all'}`;
    return this.getCachedMetrics(cacheKey, async () => {
      const [companyMetrics, approvalsResult, alertsResult] = await Promise.all([
        this.getCompanyMetrics(dateRange),
        db.query(
          `SELECT pa.id, 'payment_approval' AS type,
                  CONCAT('Payment approval for project ', p.reference_number) AS description,
                  u.name AS requested_by, pa.created_at
           FROM payment_approvals pa
           JOIN projects p ON p.id = pa.project_id
           JOIN users u ON u.id = pa.requested_by
           WHERE pa.status = 'PENDING_APPROVAL'
           ORDER BY pa.created_at DESC
           LIMIT 20`
        ),
        db.query(
          `SELECT id, alert_type AS type, severity, message, created_at
           FROM security_alerts
           WHERE resolved_at IS NULL
           ORDER BY created_at DESC
           LIMIT 10`
        ),
      ]);

      const pendingApprovals: PendingApprovalItem[] = approvalsResult.rows.map((r: any) => ({
        id: r.id,
        type: r.type,
        description: r.description,
        requestedBy: r.requested_by,
        createdAt: r.created_at,
      }));

      const securityAlerts: SecurityAlert[] = alertsResult.rows.map((r: any) => ({
        id: r.id,
        type: r.type,
        severity: r.severity,
        message: r.message,
        createdAt: r.created_at,
      }));

      return { companyMetrics, pendingApprovals, securityAlerts, generatedAt: new Date() };
    });
  }

  /**
   * Executive Dashboard (EA, CoS, CFO): financial approvals + payment execution queue
   * Requirements: 17.1, 3.3, 7.10
   */
  async getExecutiveDashboard(userId: string, role: string): Promise<ExecutiveDashboard> {
    const cacheKey = `executive:${userId}:${role}`;
    return this.getCachedMetrics(cacheKey, async () => {
      const [approvalsResult, executionQueueResult, paymentMetrics] = await Promise.all([
        db.query(
          `SELECT pa.id, pa.project_id, p.reference_number AS project_ref,
                  pa.amount, pa.currency, pa.status,
                  u.name AS requested_by, pa.created_at
           FROM payment_approvals pa
           JOIN projects p ON p.id = pa.project_id
           JOIN users u ON u.id = pa.requested_by
           WHERE pa.status = 'PENDING_APPROVAL'
           ORDER BY pa.created_at ASC
           LIMIT 50`
        ),
        db.query(
          `SELECT pa.id, pa.project_id, p.reference_number AS project_ref,
                  pa.amount, pa.currency, pa.status,
                  u.name AS requested_by, pa.created_at
           FROM payment_approvals pa
           JOIN projects p ON p.id = pa.project_id
           JOIN users u ON u.id = pa.requested_by
           WHERE pa.status = 'APPROVED_PENDING_EXECUTION'
           ORDER BY pa.created_at ASC
           LIMIT 50`
        ),
        this.getPaymentMetrics(),
      ]);

      const mapApproval = (r: any): FinancialApprovalItem => ({
        id: r.id,
        projectId: r.project_id,
        projectRef: r.project_ref,
        amount: parseFloat(r.amount),
        currency: r.currency,
        status: r.status,
        requestedBy: r.requested_by,
        createdAt: r.created_at,
      });

      return {
        pendingApprovals: approvalsResult.rows.map(mapApproval),
        paymentExecutionQueue: executionQueueResult.rows.map(mapApproval),
        paymentMetrics,
        generatedAt: new Date(),
      };
    });
  }

  /**
   * C-Level Dashboard (COO, CTO): department metrics + team performance
   * Requirements: 17.1, 3.4, 16.1
   */
  async getCLevelDashboard(userId: string, role: string): Promise<CLevelDashboard> {
    const cacheKey = `clevel:${userId}:${role}`;
    return this.getCachedMetrics(cacheKey, async () => {
      const [deptResult, teamPerformance, projectMetrics] = await Promise.all([
        db.query(
          `SELECT d.id, d.name,
                  COUNT(DISTINCT u.id) AS team_size,
                  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'ACTIVE') AS active_projects
           FROM departments d
           LEFT JOIN users u ON u.department_id = d.id
           LEFT JOIN projects p ON p.department_id = d.id
           GROUP BY d.id, d.name
           ORDER BY d.name`
        ),
        this.getTeamPerformanceMetrics(),
        this.getProjectStatusMetrics(),
      ]);

      const departmentMetrics: DepartmentMetric[] = deptResult.rows.map((r: any) => ({
        departmentId: r.id,
        departmentName: r.name,
        teamSize: parseInt(r.team_size),
        activeProjects: parseInt(r.active_projects),
        reportSubmissionRate: 0,
      }));

      return { departmentMetrics, teamPerformance, projectMetrics, generatedAt: new Date() };
    });
  }

  /**
   * Operations Dashboard: client pipeline + lead management + property listings
   * Requirements: 17.1, 3.5, 4.1
   */
  async getOperationsDashboard(userId: string): Promise<OperationsDashboard> {
    const cacheKey = `operations:${userId}`;
    return this.getCachedMetrics(cacheKey, async () => {
      const [clientPipeline, leadsResult, propertyMetrics] = await Promise.all([
        this.getClientPipelineMetrics(),
        db.query(
          `SELECT c.id, c.name AS client_name, c.status, c.agent_id, c.created_at
           FROM clients c
           WHERE c.status IN ('LEAD', 'QUALIFIED_LEAD')
           ORDER BY c.created_at DESC
           LIMIT 20`
        ),
        this.getPropertyMetrics(),
      ]);

      const recentLeads: LeadItem[] = leadsResult.rows.map((r: any) => ({
        id: r.id,
        clientName: r.client_name,
        status: r.status,
        agentId: r.agent_id,
        createdAt: r.created_at,
      }));

      return { clientPipeline, recentLeads, propertyMetrics, generatedAt: new Date() };
    });
  }

  /**
   * Technology Dashboard: project metrics + GitHub activity + developer stats
   * Requirements: 17.1, 3.5, 12.8
   */
  async getTechnologyDashboard(userId: string): Promise<TechnologyDashboard> {
    const cacheKey = `technology:${userId}`;
    return this.getCachedMetrics(cacheKey, async () => {
      const [projectMetrics, githubResult, devStatsResult] = await Promise.all([
        this.getProjectStatusMetrics(),
        db.query(
          `SELECT gr.repository_name,
                  COUNT(DISTINCT gc.id) AS commits,
                  COUNT(DISTINCT gpr.id) AS pull_requests,
                  COUNT(DISTINCT gpr.id) FILTER (WHERE gpr.state = 'merged') AS merged_prs,
                  MAX(gc.committed_at) AS last_activity
           FROM github_repositories gr
           LEFT JOIN github_commits gc ON gc.repository_id = gr.id
           LEFT JOIN github_pull_requests gpr ON gpr.repository_id = gr.id
           GROUP BY gr.id, gr.repository_name
           ORDER BY last_activity DESC NULLS LAST
           LIMIT 10`
        ),
        db.query(
          `SELECT u.id AS user_id, u.name AS username, u.github_username,
                  COUNT(DISTINCT gc.id) AS commits,
                  COUNT(DISTINCT gpr.id) AS pull_requests
           FROM users u
           LEFT JOIN github_commits gc ON gc.author_id = u.id
           LEFT JOIN github_pull_requests gpr ON gpr.author_id = u.id
           WHERE u.role IN ('DEVELOPER', 'TECH_STAFF')
           GROUP BY u.id, u.name, u.github_username
           ORDER BY commits DESC
           LIMIT 20`
        ),
      ]);

      const githubActivity: GitHubActivity[] = githubResult.rows.map((r: any) => ({
        repositoryName: r.repository_name,
        commits: parseInt(r.commits),
        pullRequests: parseInt(r.pull_requests),
        mergedPRs: parseInt(r.merged_prs),
        lastActivity: r.last_activity ? new Date(r.last_activity) : null,
      }));

      const developerStats: DeveloperStat[] = devStatsResult.rows.map((r: any) => ({
        userId: r.user_id,
        username: r.username,
        githubUsername: r.github_username,
        commits: parseInt(r.commits),
        pullRequests: parseInt(r.pull_requests),
      }));

      return { projectMetrics, githubActivity, developerStats, generatedAt: new Date() };
    });
  }

  /**
   * Agent Dashboard: personal clients, leads, commissions
   * Requirements: 17.5, 3.7, 4.11
   */
  async getAgentDashboard(userId: string): Promise<AgentDashboard> {
    const cacheKey = `agent:${userId}`;
    return this.getCachedMetrics(cacheKey, async () => {
      const [clientsResult, leadsCountResult, commissionsResult, reportResult] = await Promise.all([
        db.query(
          `SELECT status, COUNT(*) AS count FROM clients WHERE agent_id = $1 GROUP BY status`,
          [userId]
        ),
        db.query(
          `SELECT COUNT(*) AS count FROM clients WHERE agent_id = $1 AND status IN ('LEAD', 'QUALIFIED_LEAD')`,
          [userId]
        ),
        db.query(
          `SELECT p.id AS project_id, p.reference_number AS project_ref,
                  c.commission_amount AS amount, c.status
           FROM commissions c
           JOIN projects p ON p.id = c.project_id
           WHERE c.agent_id = $1
           ORDER BY c.created_at DESC
           LIMIT 20`,
          [userId]
        ),
        db.query(
          `SELECT COUNT(*) AS submitted, 30 AS total_days
           FROM daily_reports
           WHERE user_id = $1 AND report_date >= CURRENT_DATE - INTERVAL '30 days'`,
          [userId]
        ),
      ]);

      const total = clientsResult.rows.reduce((sum: number, r: any) => sum + parseInt(r.count), 0);
      const pipeline = clientsResult.rows.map((r: any) => ({
        status: r.status,
        count: parseInt(r.count),
        percentage: total > 0 ? Math.round((parseInt(r.count) / total) * 100 * 10) / 10 : 0,
      }));

      const myClients: ClientPipelineMetrics = { pipeline, total, generatedAt: new Date() };

      const myCommissions: AgentCommission[] = commissionsResult.rows.map((r: any) => ({
        projectId: r.project_id,
        projectRef: r.project_ref,
        amount: parseFloat(r.amount),
        status: r.status,
      }));

      const submitted = parseInt(reportResult.rows[0]?.submitted ?? '0');
      const reportSubmissionRate = Math.round((submitted / 30) * 100 * 10) / 10;

      return {
        myClients,
        myLeads: parseInt(leadsCountResult.rows[0]?.count ?? '0'),
        myCommissions,
        reportSubmissionRate,
        generatedAt: new Date(),
      };
    });
  }

  /**
   * Trainer Dashboard: training assignments + agent progress
   * Requirements: 17.1, 3.8
   */
  async getTrainerDashboard(userId: string): Promise<TrainerDashboard> {
    const cacheKey = `trainer:${userId}`;
    return this.getCachedMetrics(cacheKey, async () => {
      const [agentsCountResult, assignmentsResult, progressResult] = await Promise.all([
        db.query(
          `SELECT COUNT(*) AS count FROM users WHERE trainer_id = $1 AND role = 'AGENT'`,
          [userId]
        ),
        db.query(
          `SELECT ta.id, ta.agent_id, u.name AS agent_name,
                  ta.course_id, tc.name AS course_name,
                  ta.status, ta.due_date
           FROM training_assignments ta
           JOIN users u ON u.id = ta.agent_id
           JOIN training_courses tc ON tc.id = ta.course_id
           WHERE ta.trainer_id = $1
           ORDER BY ta.due_date ASC NULLS LAST
           LIMIT 50`,
          [userId]
        ),
        db.query(
          `SELECT u.id AS agent_id, u.name AS agent_name,
                  COUNT(ta.id) FILTER (WHERE ta.status = 'COMPLETED') AS completed_courses,
                  COUNT(ta.id) FILTER (WHERE ta.status != 'COMPLETED') AS pending_courses
           FROM users u
           LEFT JOIN training_assignments ta ON ta.agent_id = u.id AND ta.trainer_id = $1
           WHERE u.trainer_id = $1 AND u.role = 'AGENT'
           GROUP BY u.id, u.name
           ORDER BY u.name`,
          [userId]
        ),
      ]);

      const trainingAssignments: TrainingAssignment[] = assignmentsResult.rows.map((r: any) => ({
        id: r.id,
        agentId: r.agent_id,
        agentName: r.agent_name,
        courseId: r.course_id,
        courseName: r.course_name,
        status: r.status,
        dueDate: r.due_date ? new Date(r.due_date) : null,
      }));

      const agentProgress = progressResult.rows.map((r: any) => ({
        agentId: r.agent_id,
        agentName: r.agent_name,
        completedCourses: parseInt(r.completed_courses),
        pendingCourses: parseInt(r.pending_courses),
      }));

      return {
        assignedAgents: parseInt(agentsCountResult.rows[0]?.count ?? '0'),
        trainingAssignments,
        agentProgress,
        generatedAt: new Date(),
      };
    });
  }

  /**
   * Dispatcher: returns the correct role-specific dashboard
   * Requirements: 17.1, 3.1-3.10
   */
  async getRoleDashboard(userId: string, role: string, dateRange?: DateRange): Promise<RoleDashboard> {
    switch (role) {
      case Role.CEO:
        return this.getCEODashboard(dateRange);
      case Role.EA:
      case Role.CoS:
      case Role.CFO:
        return this.getExecutiveDashboard(userId, role);
      case Role.COO:
      case Role.CTO:
        return this.getCLevelDashboard(userId, role);
      case Role.OPERATIONS_USER:
        return this.getOperationsDashboard(userId);
      case Role.TECH_STAFF:
      case Role.DEVELOPER:
        return this.getTechnologyDashboard(userId);
      case Role.AGENT:
        return this.getAgentDashboard(userId);
      case Role.TRAINER:
      case Role.HEAD_OF_TRAINERS:
        return this.getTrainerDashboard(userId);
      default:
        logger.warn('Unknown role for role dashboard', { userId, role });
        return this.getCEODashboard();
    }
  }

  // Date Range Helpers

  /**
   * Convert a period string to a DateRange
   * Requirement 17.7: Support date range filters
   */
  getDateRangeForPeriod(period: DateRangePeriod): DateRange {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case 'today':
        return { from: today, to: now };
      case 'this_week': {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        return { from: startOfWeek, to: now };
      }
      case 'this_month':
        return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
      case 'this_quarter': {
        const quarter = Math.floor(now.getMonth() / 3);
        return { from: new Date(now.getFullYear(), quarter * 3, 1), to: now };
      }
      case 'this_year':
        return { from: new Date(now.getFullYear(), 0, 1), to: now };
      case 'custom':
      default:
        return {};
    }
  }

  /**
   * Calculate percentage change between two values
   * Requirement 17.9: Display trend indicators with percentage changes
   */
  calculateTrend(current: number, previous: number): TrendIndicator {
    const change = current - previous;
    const changePercent =
      previous === 0
        ? current === 0 ? 0 : 100
        : Math.round((change / previous) * 100 * 10) / 10;
    const direction: 'up' | 'down' | 'flat' =
      change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
    return { current, previous, change, changePercent, direction };
  }

  /**
   * Get metrics with trend indicators vs previous period
   * Requirement 17.9: Display trend indicators
   */
  async getMetricsWithTrend(dateRange?: DateRange): Promise<MetricsWithTrend> {
    const effectiveRange = dateRange ?? this.getDateRangeForPeriod('this_month');
    const previousRange = this.getPreviousPeriod(effectiveRange);
    const [current, previous] = await Promise.all([
      this.getCompanyMetrics(effectiveRange),
      this.getCompanyMetrics(previousRange),
    ]);
    return {
      current,
      previous,
      trends: {
        revenue: this.calculateTrend(current.revenue.total, previous.revenue.total),
        clients: this.calculateTrend(current.clients.total, previous.clients.total),
        projects: this.calculateTrend(current.projects.total, previous.projects.total),
        payments: this.calculateTrend(current.payments.total, previous.payments.total),
      },
      generatedAt: new Date(),
    };
  }

  private getPreviousPeriod(range: DateRange): DateRange {
    if (!range.from || !range.to) return {};
    const duration = range.to.getTime() - range.from.getTime();
    return {
      from: new Date(range.from.getTime() - duration),
      to: new Date(range.to.getTime() - duration),
    };
  }

  // Export

  /**
   * Export dashboard data to PDF
   * Requirement 17.8: Allow exporting dashboard data to PDF
   */
  async exportDashboardToPDF(_userId: string, role: string, dateRange?: DateRange): Promise<ExportResult> {
    const metrics = await this.getCompanyMetrics(dateRange);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const html = this.buildDashboardHTML(metrics, role, dateRange);
    let pdfBuffer: Buffer;
    try {
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBytes = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();
      pdfBuffer = Buffer.from(pdfBytes);
    } catch {
      pdfBuffer = Buffer.from(html, 'utf-8');
    }
    return {
      fileName: `dashboard-${timestamp}.pdf`,
      mimeType: 'application/pdf',
      data: pdfBuffer,
      generatedAt: new Date(),
    };
  }

  /**
   * Export dashboard data to Excel (CSV-based)
   * Requirement 17.8: Allow exporting dashboard data to Excel
   */
  async exportDashboardToExcel(_userId: string, _role: string, dateRange?: DateRange): Promise<ExportResult> {
    const metrics = await this.getCompanyMetrics(dateRange);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const csv = this.buildDashboardCSV(metrics, dateRange);
    return {
      fileName: `dashboard-${timestamp}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: Buffer.from(csv, 'utf-8'),
      generatedAt: new Date(),
    };
  }

  private buildDashboardHTML(metrics: CompanyMetrics, role: string, dateRange?: DateRange): string {
    const from = dateRange?.from?.toLocaleDateString() ?? 'All time';
    const to = dateRange?.to?.toLocaleDateString() ?? 'Now';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dashboard Export</title>
<style>body{font-family:Arial,sans-serif;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f4f4f4}</style>
</head><body>
<h1>Dashboard Report</h1>
<p>Role: ${role} | Period: ${from} to ${to} | Generated: ${metrics.generatedAt.toISOString()}</p>
<h2>Revenue</h2>
<table><tr><th>Total</th><th>Completed</th><th>Pending</th><th>Currency</th></tr>
<tr><td>${metrics.revenue.total}</td><td>${metrics.revenue.completed}</td><td>${metrics.revenue.pending}</td><td>${metrics.revenue.currency}</td></tr></table>
<h2>Clients</h2>
<table><tr><th>Total</th><th>Leads</th><th>Qualified Leads</th><th>Projects</th></tr>
<tr><td>${metrics.clients.total}</td><td>${metrics.clients.leads}</td><td>${metrics.clients.qualifiedLeads}</td><td>${metrics.clients.projects}</td></tr></table>
<h2>Projects</h2>
<table><tr><th>Total</th><th>Active</th><th>Completed</th><th>Pending Approval</th></tr>
<tr><td>${metrics.projects.total}</td><td>${metrics.projects.active}</td><td>${metrics.projects.completed}</td><td>${metrics.projects.pendingApproval}</td></tr></table>
<h2>Payments</h2>
<table><tr><th>Total</th><th>Completed</th><th>Pending</th><th>Failed</th></tr>
<tr><td>${metrics.payments.total}</td><td>${metrics.payments.completed}</td><td>${metrics.payments.pending}</td><td>${metrics.payments.failed}</td></tr></table>
</body></html>`;
  }

  private buildDashboardCSV(metrics: CompanyMetrics, dateRange?: DateRange): string {
    const from = dateRange?.from?.toISOString() ?? '';
    const to = dateRange?.to?.toISOString() ?? '';
    return [
      'Section,Metric,Value',
      `Meta,Generated At,${metrics.generatedAt.toISOString()}`,
      `Meta,Period From,${from}`,
      `Meta,Period To,${to}`,
      `Revenue,Total,${metrics.revenue.total}`,
      `Revenue,Completed,${metrics.revenue.completed}`,
      `Revenue,Pending,${metrics.revenue.pending}`,
      `Revenue,Currency,${metrics.revenue.currency}`,
      `Clients,Total,${metrics.clients.total}`,
      `Clients,Leads,${metrics.clients.leads}`,
      `Clients,Qualified Leads,${metrics.clients.qualifiedLeads}`,
      `Clients,Projects,${metrics.clients.projects}`,
      `Projects,Total,${metrics.projects.total}`,
      `Projects,Active,${metrics.projects.active}`,
      `Projects,Completed,${metrics.projects.completed}`,
      `Projects,Pending Approval,${metrics.projects.pendingApproval}`,
      `Payments,Total,${metrics.payments.total}`,
      `Payments,Completed,${metrics.payments.completed}`,
      `Payments,Pending,${metrics.payments.pending}`,
      `Payments,Failed,${metrics.payments.failed}`,
      `Payments,Total Amount,${metrics.payments.totalAmount}`,
      `Payments,Completed Amount,${metrics.payments.completedAmount}`,
      `Summary,Pending Approvals,${metrics.pendingApprovals}`,
      `Summary,Overdue Reports,${metrics.overdueReports}`,
    ].join('\n');
  }

  // Widget Layout

  /**
   * Save user's widget layout preferences
   * Requirement 17.6: Allow users to customize dashboard widget layout
   */
  async saveWidgetLayout(userId: string, layout: WidgetLayout['widgets']): Promise<WidgetLayout> {
    const now = new Date();
    await db.query(
      `INSERT INTO user_widget_layouts (user_id, layout, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET layout = $2, updated_at = $3`,
      [userId, JSON.stringify(layout), now]
    );
    const saved: WidgetLayout = { userId, widgets: layout, updatedAt: now };
    try {
      await cacheService.set(`${CachePrefix.DASHBOARD}layout:${userId}`, saved, CacheTTL.DASHBOARD_METRICS);
    } catch {
      // non-fatal
    }
    return saved;
  }

  /**
   * Get user's widget layout
   * Requirement 17.6: Allow users to customize dashboard widget layout
   */
  async getWidgetLayout(userId: string): Promise<WidgetLayout | null> {
    return this.getCachedMetrics(`layout:${userId}`, async () => {
      const result = await db.query(
        `SELECT user_id, layout, updated_at FROM user_widget_layouts WHERE user_id = $1`,
        [userId]
      );
      if (result.rows.length === 0) return null as any;
      const row = result.rows[0];
      return {
        userId: row.user_id,
        widgets: JSON.parse(row.layout),
        updatedAt: new Date(row.updated_at),
      } as WidgetLayout;
    });
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
