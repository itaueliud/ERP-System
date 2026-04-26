export interface CompanyMetrics {
  totalRevenue: number;
  revenueChange: number; // percentage
  activeClients: number;
  clientsChange: number;
  activeProjects: number;
  projectsChange: number;
  pendingApprovalsCount: number;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ServiceAmountApproval {
  id: string;
  clientName: string;
  originalAmount: number;
  requestedAmount: number;
  currency: string;
  requester: string;
  dateSubmitted: string;
  justification: string;
  status: ApprovalStatus;
}

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SecurityAlert {
  id: string;
  type: string;
  severity: AlertSeverity;
  description: string;
  detectedAt: string;
  resolved: boolean;
  affectedUser?: string;
}

export type ReportSubmissionStatus = 'submitted' | 'overdue' | 'pending';

export interface DailyReport {
  id: string;
  userName: string;
  role: string;
  department: string;
  submissionStatus: ReportSubmissionStatus;
  submissionTime?: string;
}

export type AfricanRegion = 'East Africa' | 'West Africa' | 'North Africa' | 'Southern Africa' | 'Central Africa';

export interface CountryAchievement {
  country: string;
  region: AfricanRegion;
  achievementCount: number;
  topAchievementType: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  result: 'success' | 'failure';
}

export type NavSection = 'overview' | 'approvals' | 'achievements' | 'reports' | 'security' | 'audit';
