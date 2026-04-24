export type CLevelRole = 'COO' | 'CTO';

export type NavSection =
  | 'overview'
  | 'departments'
  | 'achievements'
  | 'strategic-planning'
  | 'team-performance'
  | 'github' // CTO only
  | 'operations-metrics'; // COO only

export interface DepartmentMetrics {
  id: string;
  name: string;
  headCount: number;
  activeProjects: number;
  completionRate: number; // percentage
  budget: number;
  budgetUsed: number;
  kpiScore: number; // 0-100
}

export interface CountryAchievement {
  country: string;
  region: AfricanRegion;
  achievementCount: number;
  topAchievementType: string;
  // NOTE: revenue intentionally excluded — COO and CTO cannot see financial data (spec §13, §22)
  activeClients: number;
}

export type AfricanRegion = 'East Africa' | 'West Africa' | 'North Africa' | 'Southern Africa' | 'Central Africa';

export interface StrategicGoal {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  progress: number; // 0-100
  status: 'on-track' | 'at-risk' | 'behind' | 'completed';
  owner: string;
  department: string;
}

export interface TeamPerformance {
  memberId: string;
  name: string;
  role: string;
  department: string;
  kpiScore: number;
  tasksCompleted: number;
  tasksTotal: number;
  attendanceRate: number;
}

export interface GitHubRepo {
  id: string;
  name: string;
  description: string;
  language: string;
  stars: number;
  openIssues: number;
  lastCommit: string;
  commitCount: number;
}

export interface GitHubCommit {
  sha: string;
  author: string;
  message: string;
  date: string;
  repo: string;
  additions: number;
  deletions: number;
}

export interface DeveloperContribution {
  developer: string;
  commits: number;
  pullRequests: number;
  reviews: number;
  linesAdded: number;
  linesRemoved: number;
}

export interface OperationsMetric {
  label: string;
  value: number | string;
  unit?: string;
  change?: number;
  status: 'good' | 'warning' | 'critical';
}

export interface CLevelSummary {
  totalDepartments: number;
  totalHeadCount: number;
  avgKpiScore: number;
  activeStrategicGoals: number;
  countriesActive: number;
  totalAchievements: number;
}
