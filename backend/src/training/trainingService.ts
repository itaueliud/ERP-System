export type TrainingStatus = 'not-started' | 'in-progress' | 'completed' | 'verified';

export type CourseStatus = 'draft' | 'active' | 'archived';

export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  duration: number; // minutes
  order: number;
  materials: string[];
}

export interface TrainingCourse {
  id: string;
  title: string;
  description: string;
  modules: TrainingModule[];
  totalDuration: number; // hours
  category: string;
  createdBy: string;
  createdAt: Date;
  status: CourseStatus;
}

export interface TrainingAssignment {
  id: string;
  courseId: string;
  courseName: string;
  agentId: string;
  agentName: string;
  assignedBy: string;
  assignedAt: Date;
  dueDate: Date;
  progress: number; // 0-100
  status: TrainingStatus;
  completedAt?: Date;
  verifiedBy?: string;
  verifiedAt?: Date;
  certificateId?: string;
}

export interface AgentTrainingProgress {
  agentId: string;
  totalAssigned: number;
  completed: number;
  verified: number;
  inProgress: number;
  notStarted: number;
  avgProgress: number;
}

let assignmentIdCounter = 1;

export class TrainingService {
  /**
   * Creates a new training assignment for an agent.
   */
  assignCourse(
    courseId: string,
    courseName: string,
    agentId: string,
    agentName: string,
    assignedBy: string,
    dueDate: Date,
  ): TrainingAssignment {
    return {
      id: `assign-${assignmentIdCounter++}`,
      courseId,
      courseName,
      agentId,
      agentName,
      assignedBy,
      assignedAt: new Date(),
      dueDate,
      progress: 0,
      status: 'not-started',
    };
  }

  /**
   * Updates progress on an assignment.
   * Sets status to 'in-progress' if progress > 0, 'completed' if progress = 100.
   */
  updateProgress(assignment: TrainingAssignment, progress: number): TrainingAssignment {
    const clampedProgress = Math.min(100, Math.max(0, progress));
    let status: TrainingStatus = assignment.status;
    let completedAt = assignment.completedAt;

    if (clampedProgress === 100) {
      status = 'completed';
      completedAt = completedAt ?? new Date();
    } else if (clampedProgress > 0) {
      status = 'in-progress';
    } else {
      status = 'not-started';
    }

    return {
      ...assignment,
      progress: clampedProgress,
      status,
      completedAt,
    };
  }

  /**
   * Verifies completion of a training assignment by a trainer.
   * Generates a certificate ID and sets status to 'verified'.
   */
  verifyCompletion(assignment: TrainingAssignment, trainerId: string): TrainingAssignment {
    const certificateId = this.generateCertificate(assignment);
    return {
      ...assignment,
      status: 'verified',
      verifiedBy: trainerId,
      verifiedAt: new Date(),
      certificateId,
    };
  }

  /**
   * Generates a certificate ID for a completed assignment.
   * Format: CERT-{agentId}-{courseId}-{timestamp}
   */
  generateCertificate(assignment: TrainingAssignment): string {
    const timestamp = Date.now();
    return `CERT-${assignment.agentId}-${assignment.courseId}-${timestamp}`;
  }

  /**
   * Returns a training progress summary for a specific agent.
   */
  getAgentProgress(agentId: string, assignments: TrainingAssignment[]): AgentTrainingProgress {
    const agentAssignments = assignments.filter((a) => a.agentId === agentId);
    const totalAssigned = agentAssignments.length;

    const completed = agentAssignments.filter((a) => a.status === 'completed').length;
    const verified = agentAssignments.filter((a) => a.status === 'verified').length;
    const inProgress = agentAssignments.filter((a) => a.status === 'in-progress').length;
    const notStarted = agentAssignments.filter((a) => a.status === 'not-started').length;

    const avgProgress =
      totalAssigned > 0
        ? agentAssignments.reduce((sum, a) => sum + a.progress, 0) / totalAssigned
        : 0;

    return {
      agentId,
      totalAssigned,
      completed,
      verified,
      inProgress,
      notStarted,
      avgProgress,
    };
  }
}
