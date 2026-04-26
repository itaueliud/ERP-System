export type ExecutiveRole = 'CFO' | 'EA' | 'CoS';

export type PaymentApprovalStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED_PENDING_EXECUTION'
  | 'EXECUTED'
  | 'REJECTED';

export interface PaymentApproval {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string;
  amount: number;
  currency: string;
  purpose: string;
  requesterId: string;
  requesterName: string;
  status: PaymentApprovalStatus;
  submittedAt: string;
  approverId?: string;
  approverName?: string;
  approvedAt?: string;
  executorId?: string;
  rejectionReason?: string;
}

export interface FinancialSummary {
  totalPendingApprovals: number;
  totalPendingValue: number;
  totalApprovedPendingExecution: number;
  totalApprovedValue: number;
  totalExecutedThisMonth: number;
  totalExecutedValue: number;
  currency: string;
}

export interface ComplianceReport {
  id: string;
  title: string;
  period: string;
  generatedAt: string;
  status: 'ready' | 'generating';
  downloadUrl?: string;
}

export interface AuditSummaryEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  result: 'success' | 'failure';
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export type NavSection =
  | 'overview'
  | 'pending-approvals'
  | 'execute-payments'
  | 'financial-reports'
  | 'audit-summary'
  | 'notifications';
