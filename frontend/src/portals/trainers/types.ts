export type NavSection =
  | 'overview'
  | 'courses'
  | 'assignments'
  | 'agent-performance'
  | 'completions';

export type TrainerRole = 'Head_of_Trainers' | 'Trainer';

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  duration: number; // minutes
  order: number;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  modules: CourseModule[];
  totalDuration: number; // hours
  category: string;
  createdBy: string;
  createdAt: string;
  status: 'draft' | 'active' | 'archived';
}

export interface CourseAssignment {
  id: string;
  courseId: string;
  courseName: string;
  agentId: string;
  agentName: string;
  assignedAt: string;
  dueDate: string;
  progress: number; // 0-100
  status: 'not-started' | 'in-progress' | 'completed';
  completedAt?: string;
}

export interface AgentTrainingRecord {
  agentId: string;
  agentName: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
  avgProgress: number;
  kpiScore: number;
}

export interface TrainerSummary {
  totalCourses: number;
  activeCourses: number;
  totalAssignments: number;
  completionRate: number;
  agentsInTraining: number;
}
