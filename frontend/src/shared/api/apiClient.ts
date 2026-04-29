import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const apiClient = axios.create({
  // Use relative URL so requests go through the Vite dev proxy (avoids CORS).
  // VITE_API_BASE_URL can be set to an absolute URL for production builds.
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Restore token from localStorage on module load
const storedToken = localStorage.getItem('tst_token');
if (storedToken) {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
}

// Request interceptor — always attach latest token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('tst_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — redirect to login on 401
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('tst_token');
      localStorage.removeItem('tst_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface PaginatedParams {
  page?: number;
  limit?: number;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
}

export interface User {
  id: string;
  email: string;
  role: string;
  name: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  createdAt: string;
}

export interface DashboardMetrics {
  totalRevenue: number;
  totalClients: number;
  activeAgents: number;
  pendingPayments: number;
  monthlyGrowth: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>('/api/v1/auth/login', { email, password }),

  logout: () =>
    apiClient.post<void>('/api/v1/auth/logout'),
};

// ---------------------------------------------------------------------------
// Users API
// ---------------------------------------------------------------------------

export const usersApi = {
  getUsers: (page?: number, limit?: number) =>
    apiClient.get<PaginatedResponse<User>>('/api/v1/users', {
      params: { page, limit },
    }),

  getDepartments: () =>
    apiClient.get<unknown[]>('/api/v1/users/departments'),
};

// ---------------------------------------------------------------------------
// Clients API
// ---------------------------------------------------------------------------

export const clientsApi = {
  getClients: (page?: number, limit?: number, search?: string) =>
    apiClient.get<PaginatedResponse<Client>>('/api/v1/clients', {
      params: { page, limit, search },
    }),

  createClient: (data: Omit<Client, 'id' | 'createdAt'>) =>
    apiClient.post<Client>('/api/v1/clients', data),

  getCommunications: (clientId?: string) =>
    apiClient.get<unknown[]>('/api/v1/clients/communications', {
      params: { clientId },
    }),
};

// ---------------------------------------------------------------------------
// Payments API
// ---------------------------------------------------------------------------

export const paymentsApi = {
  getPayments: (page?: number, limit?: number) =>
    apiClient.get<PaginatedResponse<Payment>>('/api/v1/payments', {
      params: { page, limit },
    }),
};

// ---------------------------------------------------------------------------
// Dashboard API
// ---------------------------------------------------------------------------

export const dashboardApi = {
  getMetrics: () =>
    apiClient.get<DashboardMetrics>('/api/v1/dashboard/metrics'),

  getAgentMetrics: () =>
    apiClient.get<unknown>('/api/v1/dashboard/agent-metrics'),

  getTeamPerformance: () =>
    apiClient.get<unknown[]>('/api/v1/dashboard/team-performance'),
};

// ---------------------------------------------------------------------------
// Notifications API
// ---------------------------------------------------------------------------

export const notificationsApi = {
  getNotifications: () =>
    apiClient.get<Notification[]>('/api/v1/notifications'),

  markRead: (id: string) =>
    apiClient.patch<void>(`/api/v1/notifications/${id}/read`),
};

// ---------------------------------------------------------------------------
// Metrics API (role-specific) — all resolved via /api/v1/dashboard/role
// ---------------------------------------------------------------------------

export const metricsApi = {
  // All role-specific dashboards use the same endpoint; the backend
  // reads req.user.role and returns the appropriate data.
  getCeoMetrics: () =>
    apiClient.get<unknown>('/api/v1/dashboard/role'),

  getExecutiveMetrics: () =>
    apiClient.get<unknown>('/api/v1/dashboard/role'),

  getOperationsMetrics: () =>
    apiClient.get<unknown>('/api/v1/dashboard/role'),

  getTechMetrics: () =>
    apiClient.get<unknown>('/api/v1/dashboard/role'),
};

// ---------------------------------------------------------------------------
// Approvals API
// ---------------------------------------------------------------------------

export const approvalsApi = {
  // Service amount approvals — backend: GET /api/v1/approvals/service-amounts (misc routes)
  getServiceAmountApprovals: () =>
    apiClient.get<unknown[]>('/api/v1/approvals/service-amounts'),

  // Backend: POST /api/v1/service-amounts/changes/:id/approve (misc routes)
  approveServiceAmount: (id: string) =>
    apiClient.post<void>(`/api/v1/service-amounts/changes/${id}/approve`),

  rejectServiceAmount: (id: string, reason: string) =>
    apiClient.post<void>(`/api/v1/service-amounts/changes/${id}/reject`, { reason }),

  // Payment approvals — backend: GET /api/v1/payments/approvals
  getPaymentApprovals: () =>
    apiClient.get<unknown[]>('/api/v1/payments/approvals'),

  approvePayment: (id: string) =>
    apiClient.post<void>(`/api/v1/payments/approvals/${id}/approve`),

  rejectPayment: (id: string, reason: string) =>
    apiClient.post<void>(`/api/v1/payments/approvals/${id}/reject`, { reason }),

  getApprovedPayments: () =>
    apiClient.get<unknown[]>('/api/v1/payments/approvals'),

  executePayment: (id: string) =>
    apiClient.post<void>(`/api/v1/payments/approvals/${id}/execute`),
};

// ---------------------------------------------------------------------------
// Security API — proxied through /api/v1 misc routes
// ---------------------------------------------------------------------------

export const securityApi = {
  // Backend: GET /api/v1/security/alerts (misc routes)
  getAlerts: () =>
    apiClient.get<unknown[]>('/api/v1/security/alerts'),

  // Backend: GET /api/v1/audit-logs
  getAuditLog: (page?: number, limit?: number) =>
    apiClient.get<unknown[]>('/api/v1/audit-logs', {
      params: { page, limit },
    }),

  // Backend: GET /api/v1/audit-logs/security-alerts
  getAuditSummary: () =>
    apiClient.get<unknown[]>('/api/v1/audit-logs/security-alerts'),
};

// ---------------------------------------------------------------------------
// Reports API
// ---------------------------------------------------------------------------

export const reportsApi = {
  // Backend: GET /api/v1/daily-reports/mine
  getDailyReports: () =>
    apiClient.get<unknown[]>('/api/v1/daily-reports/mine'),

  // Backend: GET /api/v1/reports/compliance (misc routes)
  getComplianceReports: () =>
    apiClient.get<unknown[]>('/api/v1/reports/compliance'),
};

// ---------------------------------------------------------------------------
// Achievements API
// ---------------------------------------------------------------------------

export const achievementsApi = {
  // Backend: GET /api/v1/achievements (misc routes)
  getAchievements: () =>
    apiClient.get<unknown[]>('/api/v1/achievements'),
};

// ---------------------------------------------------------------------------
// Leads API — backend uses /api/v1/clients with status filtering
// ---------------------------------------------------------------------------

export const leadsApi = {
  // Leads are just clients with specific statuses
  getLeads: (page?: number, limit?: number) =>
    apiClient.get<unknown[]>('/api/v1/clients', {
      params: { page, limit, status: 'NEW_LEAD,CONVERTED,LEAD_ACTIVATED,LEAD_QUALIFIED,NEGOTIATION' },
    }),

  createLead: (data: unknown) =>
    apiClient.post<unknown>('/api/v1/clients', data),

  updateLead: (id: string, data: unknown) =>
    apiClient.put<unknown>(`/api/v1/clients/${id}`, data),
};

// ---------------------------------------------------------------------------
// Properties API
// ---------------------------------------------------------------------------

export const propertiesApi = {
  getProperties: (page?: number, limit?: number) =>
    apiClient.get<unknown[]>('/api/v1/properties', {
      params: { page, limit },
    }),

  createProperty: (data: unknown) =>
    apiClient.post<unknown>('/api/v1/properties', data),
};

// ---------------------------------------------------------------------------
// Projects API
// ---------------------------------------------------------------------------

export const projectsApi = {
  getProjects: () =>
    apiClient.get<unknown[]>('/api/v1/projects'),

  getStrategicGoals: () =>
    apiClient.get<unknown[]>('/api/v1/projects/strategic-goals'),

  createProject: (data: unknown) =>
    apiClient.post<unknown>('/api/v1/projects', data),
};

// ---------------------------------------------------------------------------
// GitHub API — project-scoped, not global
// Note: GitHub integration is per-project at /api/v1/projects/:id/github/*
// These global endpoints are provided by misc routes for aggregated views
// ---------------------------------------------------------------------------

export const githubApi = {
  // Backend: GET /api/v1/github/repos (misc routes)
  getRepos: () =>
    apiClient.get<unknown[]>('/api/v1/github/repos'),

  // Backend: GET /api/v1/github/commits (misc routes)
  getCommits: (repo?: string) =>
    apiClient.get<unknown[]>('/api/v1/github/commits', {
      params: { repo },
    }),

  // Backend: GET /api/v1/github/contributions (misc routes)
  getContributions: () =>
    apiClient.get<unknown[]>('/api/v1/github/contributions'),

  // Aggregated activity view
  getActivity: () =>
    apiClient.get<unknown>('/api/v1/dashboard/metrics'),
};

// ---------------------------------------------------------------------------
// Chat API
// ---------------------------------------------------------------------------

export const chatApi = {
  getRooms: () =>
    apiClient.get<unknown[]>('/api/v1/chat/rooms'),

  getMessages: (roomId: string, page?: number) =>
    apiClient.get<unknown[]>(`/api/v1/chat/rooms/${roomId}/messages`, {
      params: { page },
    }),

  sendMessage: (roomId: string, content: string) =>
    apiClient.post<unknown>(`/api/v1/chat/rooms/${roomId}/messages`, { content }),
};

// ---------------------------------------------------------------------------
// Commission API
// ---------------------------------------------------------------------------

export const commissionApi = {
  // Backend: GET /api/v1/commissions (misc routes)
  getCommissions: () =>
    apiClient.get<unknown[]>('/api/v1/commissions'),

  // Backend: GET /api/v1/commissions/me (misc routes)
  getMyCommissions: () =>
    apiClient.get<unknown[]>('/api/v1/commissions/me'),
};

// ---------------------------------------------------------------------------
// Training API
// ---------------------------------------------------------------------------

export const trainingApi = {
  getCourses: () =>
    apiClient.get<unknown[]>('/api/v1/training/courses'),

  getAssignments: (agentId?: string) =>
    apiClient.get<unknown[]>('/api/v1/training/assignments', {
      params: { agentId },
    }),

  getAgentRecords: () =>
    apiClient.get<unknown[]>('/api/v1/training/agent-records'),

  getCompletions: () =>
    apiClient.get<unknown[]>('/api/v1/training/completions'),

  createCourse: (data: unknown) =>
    apiClient.post<unknown>('/api/v1/training/courses', data),

  assignCourse: (data: unknown) =>
    apiClient.post<unknown>('/api/v1/training/assignments', data),
};

// ---------------------------------------------------------------------------
// Incidents API
// ---------------------------------------------------------------------------

export const incidentsApi = {
  getIncidents: (status?: string, severity?: string, page?: number, limit?: number) =>
    apiClient.get<unknown[]>('/api/v1/incidents', {
      params: { status, severity, page, limit },
    }),

  createIncident: (data: unknown) =>
    apiClient.post<unknown>('/api/v1/incidents', data),

  updateIncident: (id: string, data: unknown) =>
    apiClient.put<unknown>(`/api/v1/incidents/${id}`, data),
};

// ---------------------------------------------------------------------------
// Deployments API
// ---------------------------------------------------------------------------

export const deploymentsApi = {
  getDeployments: (projectId?: string, environment?: string, status?: string, page?: number, limit?: number) =>
    apiClient.get<unknown[]>('/api/v1/deployments', {
      params: { projectId, environment, status, page, limit },
    }),

  createDeployment: (data: unknown) =>
    apiClient.post<unknown>('/api/v1/deployments', data),

  updateDeploymentStatus: (id: string, status: string, deploymentNotes?: string) =>
    apiClient.patch<unknown>(`/api/v1/deployments/${id}/status`, { status, deploymentNotes }),
};

// ---------------------------------------------------------------------------
// Risks API
// ---------------------------------------------------------------------------

export const risksApi = {
  getRisks: (projectId?: string, status?: string, page?: number, limit?: number) =>
    apiClient.get<unknown[]>('/api/v1/risks', {
      params: { projectId, status, page, limit },
    }),

  createRisk: (data: unknown) =>
    apiClient.post<unknown>('/api/v1/risks', data),

  updateRisk: (id: string, data: unknown) =>
    apiClient.put<unknown>(`/api/v1/risks/${id}`, data),
};

// ---------------------------------------------------------------------------
// Contracts API
// ---------------------------------------------------------------------------

export const contractsApi = {
  getContracts: (projectId?: string, status?: string, page?: number, limit?: number) =>
    apiClient.get<unknown[]>('/api/v1/contracts', {
      params: { projectId, status, page, limit },
    }),

  getContract: (id: string) =>
    apiClient.get<unknown>(`/api/v1/contracts/${id}`),

  downloadContract: (id: string) =>
    apiClient.get<unknown>(`/api/v1/contracts/${id}/download`),

  getMyTeamContracts: () =>
    apiClient.get<unknown[]>('/api/v1/contracts/my-team'),
};

// ---------------------------------------------------------------------------
// Tasks API
// ---------------------------------------------------------------------------

export const tasksApi = {
  getTasks: (filters?: {
    assignedTo?: string;
    createdBy?: string;
    status?: string;
    priority?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient.get<unknown[]>('/api/v1/tasks', { params: filters }),

  getTask: (id: string) =>
    apiClient.get<unknown>(`/api/v1/tasks/${id}`),

  createTask: (data: unknown) =>
    apiClient.post<unknown>('/api/v1/tasks', data),

  updateTask: (id: string, data: unknown) =>
    apiClient.patch<unknown>(`/api/v1/tasks/${id}`, data),

  updateTaskStatus: (id: string, status: string) =>
    apiClient.patch<unknown>(`/api/v1/tasks/${id}/status`, { status }),

  deleteTask: (id: string) =>
    apiClient.delete<void>(`/api/v1/tasks/${id}`),

  getOverdueTasks: () =>
    apiClient.get<unknown[]>('/api/v1/tasks/overdue'),
};

// ---------------------------------------------------------------------------
// Budget Requests API
// ---------------------------------------------------------------------------

export const budgetRequestsApi = {
  getBudgetRequests: (page?: number, limit?: number) =>
    apiClient.get<unknown[]>('/api/v1/budget-requests', {
      params: { page, limit },
    }),

  createBudgetRequest: (data: unknown) =>
    apiClient.post<unknown>('/api/v1/budget-requests', data),

  approveBudgetRequest: (id: string) =>
    apiClient.post<void>(`/api/v1/budget-requests/${id}/approve`),

  rejectBudgetRequest: (id: string, reason: string) =>
    apiClient.post<void>(`/api/v1/budget-requests/${id}/reject`, { reason }),
};

// ---------------------------------------------------------------------------
// Expense Reports API
// ---------------------------------------------------------------------------

export const expenseReportsApi = {
  getExpenseReports: (page?: number, limit?: number) =>
    apiClient.get<unknown[]>('/api/v1/expense-reports', {
      params: { page, limit },
    }),

  createExpenseReport: (data: unknown) =>
    apiClient.post<unknown>('/api/v1/expense-reports', data),

  approveExpenseReport: (id: string) =>
    apiClient.post<void>(`/api/v1/expense-reports/${id}/approve`),

  rejectExpenseReport: (id: string, reason: string) =>
    apiClient.post<void>(`/api/v1/expense-reports/${id}/reject`, { reason }),
};

