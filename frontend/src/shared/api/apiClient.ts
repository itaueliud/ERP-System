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
// Metrics API (role-specific)
// ---------------------------------------------------------------------------

export const metricsApi = {
  getCeoMetrics: () =>
    apiClient.get<unknown>('/api/v1/metrics/ceo'),

  getExecutiveMetrics: () =>
    apiClient.get<unknown>('/api/v1/metrics/executive'),

  getOperationsMetrics: () =>
    apiClient.get<unknown>('/api/v1/metrics/operations'),

  getTechMetrics: () =>
    apiClient.get<unknown>('/api/v1/metrics/technology'),
};

// ---------------------------------------------------------------------------
// Approvals API
// ---------------------------------------------------------------------------

export const approvalsApi = {
  getServiceAmountApprovals: () =>
    apiClient.get<unknown[]>('/api/v1/approvals/service-amounts'),

  approveServiceAmount: (id: string) =>
    apiClient.post<void>(`/api/v1/approvals/service-amounts/${id}/approve`),

  rejectServiceAmount: (id: string, reason: string) =>
    apiClient.post<void>(`/api/v1/approvals/service-amounts/${id}/reject`, { reason }),

  getPaymentApprovals: () =>
    apiClient.get<unknown[]>('/api/v1/approvals/payments'),

  approvePayment: (id: string) =>
    apiClient.post<void>(`/api/v1/approvals/payments/${id}/approve`),

  rejectPayment: (id: string, reason: string) =>
    apiClient.post<void>(`/api/v1/approvals/payments/${id}/reject`, { reason }),

  getApprovedPayments: () =>
    apiClient.get<unknown[]>('/api/v1/approvals/payments/approved'),

  executePayment: (id: string) =>
    apiClient.post<void>(`/api/v1/approvals/payments/${id}/execute`),
};

// ---------------------------------------------------------------------------
// Security API
// ---------------------------------------------------------------------------

export const securityApi = {
  getAlerts: () =>
    apiClient.get<unknown[]>('/api/v1/security/alerts'),

  getAuditLog: (page?: number, limit?: number) =>
    apiClient.get<unknown[]>('/api/v1/security/audit-log', {
      params: { page, limit },
    }),

  getAuditSummary: () =>
    apiClient.get<unknown[]>('/api/v1/security/audit-summary'),
};

// ---------------------------------------------------------------------------
// Reports API
// ---------------------------------------------------------------------------

export const reportsApi = {
  getDailyReports: () =>
    apiClient.get<unknown[]>('/api/v1/reports/daily'),

  getComplianceReports: () =>
    apiClient.get<unknown[]>('/api/v1/reports/compliance'),
};

// ---------------------------------------------------------------------------
// Achievements API
// ---------------------------------------------------------------------------

export const achievementsApi = {
  getAchievements: () =>
    apiClient.get<unknown[]>('/api/v1/achievements'),
};

// ---------------------------------------------------------------------------
// Leads API
// ---------------------------------------------------------------------------

export const leadsApi = {
  getLeads: (page?: number, limit?: number) =>
    apiClient.get<unknown[]>('/api/v1/leads', {
      params: { page, limit },
    }),

  createLead: (data: unknown) =>
    apiClient.post<unknown>('/api/v1/leads', data),

  updateLead: (id: string, data: unknown) =>
    apiClient.put<unknown>(`/api/v1/leads/${id}`, data),
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
// GitHub API
// ---------------------------------------------------------------------------

export const githubApi = {
  getRepos: () =>
    apiClient.get<unknown[]>('/api/v1/github/repos'),

  getCommits: (repo?: string) =>
    apiClient.get<unknown[]>('/api/v1/github/commits', {
      params: { repo },
    }),

  getContributions: () =>
    apiClient.get<unknown[]>('/api/v1/github/contributions'),

  getActivity: () =>
    apiClient.get<unknown>('/api/v1/github/activity'),
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
  getCommissions: () =>
    apiClient.get<unknown[]>('/api/v1/commissions'),

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
