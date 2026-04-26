import { TrainingService, TrainingAssignment } from './trainingService';

const service = new TrainingService();

function makeAssignment(overrides: Partial<TrainingAssignment> = {}): TrainingAssignment {
  return {
    id: 'assign-1',
    courseId: 'course-001',
    courseName: 'Sales Basics',
    agentId: 'agent-001',
    agentName: 'Alice',
    assignedBy: 'trainer-001',
    assignedAt: new Date('2024-01-01'),
    dueDate: new Date('2024-03-01'),
    progress: 0,
    status: 'not-started',
    ...overrides,
  };
}

describe('TrainingService', () => {
  describe('assignCourse', () => {
    it('creates assignment with not-started status', () => {
      const dueDate = new Date('2024-12-31');
      const assignment = service.assignCourse(
        'course-001',
        'Sales Basics',
        'agent-001',
        'Alice',
        'trainer-001',
        dueDate,
      );

      expect(assignment.courseId).toBe('course-001');
      expect(assignment.courseName).toBe('Sales Basics');
      expect(assignment.agentId).toBe('agent-001');
      expect(assignment.agentName).toBe('Alice');
      expect(assignment.assignedBy).toBe('trainer-001');
      expect(assignment.dueDate).toBe(dueDate);
      expect(assignment.progress).toBe(0);
      expect(assignment.status).toBe('not-started');
      expect(assignment.id).toBeDefined();
    });
  });

  describe('updateProgress', () => {
    it('sets status to in-progress when progress > 0', () => {
      const assignment = makeAssignment();
      const updated = service.updateProgress(assignment, 50);

      expect(updated.progress).toBe(50);
      expect(updated.status).toBe('in-progress');
    });

    it('sets status to completed when progress = 100', () => {
      const assignment = makeAssignment();
      const updated = service.updateProgress(assignment, 100);

      expect(updated.progress).toBe(100);
      expect(updated.status).toBe('completed');
      expect(updated.completedAt).toBeDefined();
    });

    it('keeps status as not-started when progress = 0', () => {
      const assignment = makeAssignment({ status: 'not-started' });
      const updated = service.updateProgress(assignment, 0);

      expect(updated.progress).toBe(0);
      expect(updated.status).toBe('not-started');
    });

    it('clamps progress to 0-100 range', () => {
      const assignment = makeAssignment();
      expect(service.updateProgress(assignment, 150).progress).toBe(100);
      expect(service.updateProgress(assignment, -10).progress).toBe(0);
    });
  });

  describe('verifyCompletion', () => {
    it('sets status to verified and records trainer', () => {
      const assignment = makeAssignment({ status: 'completed', progress: 100 });
      const verified = service.verifyCompletion(assignment, 'trainer-001');

      expect(verified.status).toBe('verified');
      expect(verified.verifiedBy).toBe('trainer-001');
      expect(verified.verifiedAt).toBeDefined();
    });

    it('generates a certificateId on verification', () => {
      const assignment = makeAssignment({ status: 'completed', progress: 100 });
      const verified = service.verifyCompletion(assignment, 'trainer-001');

      expect(verified.certificateId).toBeDefined();
      expect(verified.certificateId).toMatch(/^CERT-/);
    });
  });

  describe('generateCertificate', () => {
    it('returns certificate ID in correct format', () => {
      const assignment = makeAssignment({ agentId: 'agent-42', courseId: 'course-99' });
      const certId = service.generateCertificate(assignment);

      expect(certId).toMatch(/^CERT-agent-42-course-99-\d+$/);
    });
  });

  describe('getAgentProgress', () => {
    it('returns correct counts for an agent', () => {
      const assignments: TrainingAssignment[] = [
        makeAssignment({ id: 'a1', status: 'not-started', progress: 0 }),
        makeAssignment({ id: 'a2', status: 'in-progress', progress: 50 }),
        makeAssignment({ id: 'a3', status: 'completed', progress: 100 }),
        makeAssignment({ id: 'a4', status: 'verified', progress: 100 }),
        // different agent — should be excluded
        makeAssignment({ id: 'a5', agentId: 'agent-999', status: 'completed', progress: 100 }),
      ];

      const progress = service.getAgentProgress('agent-001', assignments);

      expect(progress.agentId).toBe('agent-001');
      expect(progress.totalAssigned).toBe(4);
      expect(progress.notStarted).toBe(1);
      expect(progress.inProgress).toBe(1);
      expect(progress.completed).toBe(1);
      expect(progress.verified).toBe(1);
      expect(progress.avgProgress).toBe(62.5); // (0+50+100+100)/4
    });

    it('returns zero counts when agent has no assignments', () => {
      const progress = service.getAgentProgress('agent-unknown', []);

      expect(progress.totalAssigned).toBe(0);
      expect(progress.avgProgress).toBe(0);
    });
  });
});
