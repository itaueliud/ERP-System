import type { LeadStage } from '../operations/types';

export type NavSection =
  | 'overview'
  | 'capture-client'
  | 'my-clients'
  | 'commissions'
  | 'performance'
  | 'training';

export interface AgentCommission {
  id: string;
  clientName: string;
  dealValue: number;
  commissionRate: number;
  commissionAmount: number;
  status: 'Pending' | 'Approved' | 'Paid';
  dealClosedAt: string;
  approvedAt?: string;
}

export interface AgentPerformance {
  totalClients: number;
  activeLeads: number;
  closedDeals: number;
  totalCommissions: number;
  pendingCommissions: number;
  kpiScore: number;
  attendanceRate: number;
  trainingProgress: number;
}

export interface AgentClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  stage: LeadStage;
  value: number;
  lastContact: string;
}

export interface TrainingAssignment {
  id: string;
  courseName: string;
  assignedAt: string;
  dueDate: string;
  progress: number;
  status: 'not-started' | 'in-progress' | 'completed';
}
