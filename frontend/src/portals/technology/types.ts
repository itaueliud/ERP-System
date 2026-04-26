export type NavSection =
  | 'overview'
  | 'projects'
  | 'github'
  | 'developers'
  | 'team-performance';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on-hold';
  techStack: string[];
  startDate: string;
  targetDate: string;
  progress: number; // 0-100
  teamSize: number;
  githubRepo: string;
}

export interface TechMetricsSummary {
  totalProjects: number;
  activeProjects: number;
  totalDevelopers: number;
  avgCommitsPerDay: number;
  openIssues: number;
  deploymentFrequency: number; // deployments per week
}

// Re-export shared types from clevel for convenience
export type { GitHubRepo, GitHubCommit, DeveloperContribution, TeamPerformance } from '../clevel/types';
