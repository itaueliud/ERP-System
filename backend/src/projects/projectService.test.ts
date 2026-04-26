import { ProjectService, ProjectStatus } from './projectService';
import { db } from '../database/connection';

jest.mock('../database/connection');
jest.mock('../utils/logger');
jest.mock('../config', () => ({
  config: {
    apiBaseUrl: 'http://localhost:3000',
    logging: { level: 'info', filePath: '/tmp/test.log' },
    database: { host: 'localhost', port: 5432, name: 'test', user: 'test', password: 'test' },
  },
}));

const MOCK_CLIENT_ID = '111e4567-e89b-12d3-a456-426614174001';
const MOCK_AGENT_ID = '222e4567-e89b-12d3-a456-426614174002';
const MOCK_PROJECT_ID = '333e4567-e89b-12d3-a456-426614174003';
const YEAR = new Date().getFullYear();

function mockProjectRow(overrides: Record<string, any> = {}) {
  return {
    id: MOCK_PROJECT_ID,
    reference_number: `TST-PRJ-${YEAR}-000001`,
    client_id: MOCK_CLIENT_ID,
    agent_id: MOCK_AGENT_ID,
    status: ProjectStatus.PENDING_APPROVAL,
    service_amount: '50000.00',
    currency: 'USD',
    start_date: null,
    end_date: null,
    github_repo_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(() => {
    service = new ProjectService();
    jest.clearAllMocks();
  });

  // ─── generateReferenceNumber ───────────────────────────────────────────────

  describe('generateReferenceNumber', () => {
    it('should generate TST-PRJ-YYYY-000001 when no projects exist', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const ref = await service.generateReferenceNumber();
      expect(ref).toBe(`TST-PRJ-${YEAR}-000001`);
    });

    it('should increment sequence from last reference number', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ reference_number: `TST-PRJ-${YEAR}-000005` }],
      });

      const ref = await service.generateReferenceNumber();
      expect(ref).toBe(`TST-PRJ-${YEAR}-000006`);
    });

    it('should zero-pad sequence to 6 digits', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ reference_number: `TST-PRJ-${YEAR}-000099` }],
      });

      const ref = await service.generateReferenceNumber();
      expect(ref).toBe(`TST-PRJ-${YEAR}-000100`);
    });
  });

  // ─── createProject ─────────────────────────────────────────────────────────

  describe('createProject', () => {
    const validInput = {
      clientId: MOCK_CLIENT_ID,
      agentId: MOCK_AGENT_ID,
      serviceAmount: 50000,
      currency: 'USD',
    };

    function setupCreateMocks(projectRowOverrides: Record<string, any> = {}) {
      // client exists
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: MOCK_CLIENT_ID, agent_id: MOCK_AGENT_ID }],
      });
      // reference number generation
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // insert
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockProjectRow(projectRowOverrides)],
      });
    }

    it('should create a project with PENDING_APPROVAL status', async () => {
      setupCreateMocks();

      const project = await service.createProject(validInput);

      expect(project.status).toBe(ProjectStatus.PENDING_APPROVAL);
      expect(project.referenceNumber).toBe(`TST-PRJ-${YEAR}-000001`);
      expect(project.serviceAmount).toBe(50000);
      expect(project.currency).toBe('USD');
      expect(project.clientId).toBe(MOCK_CLIENT_ID);
    });

    it('should reject service amount <= 0', async () => {
      await expect(
        service.createProject({ ...validInput, serviceAmount: 0 })
      ).rejects.toThrow('Service amount must be greater than 0');

      await expect(
        service.createProject({ ...validInput, serviceAmount: -100 })
      ).rejects.toThrow('Service amount must be greater than 0');
    });

    it('should reject end date before start date', async () => {
      await expect(
        service.createProject({
          ...validInput,
          startDate: new Date('2024-12-31'),
          endDate: new Date('2024-01-01'),
        })
      ).rejects.toThrow('End date must be on or after start date');
    });

    it('should reject when client does not exist', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(service.createProject(validInput)).rejects.toThrow('Client not found');
    });

    it('should default currency to USD when not provided', async () => {
      // client exists
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: MOCK_CLIENT_ID, agent_id: MOCK_AGENT_ID }],
      });
      // ref number
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // insert
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockProjectRow()],
      });

      const project = await service.createProject({
        clientId: MOCK_CLIENT_ID,
        agentId: MOCK_AGENT_ID,
        serviceAmount: 10000,
      });

      expect(project.currency).toBe('USD');
    });
  });

  // ─── getProject ────────────────────────────────────────────────────────────

  describe('getProject', () => {
    it('should return project by ID', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockProjectRow()] });

      const project = await service.getProject(MOCK_PROJECT_ID);

      expect(project).not.toBeNull();
      expect(project!.id).toBe(MOCK_PROJECT_ID);
      expect(project!.referenceNumber).toBe(`TST-PRJ-${YEAR}-000001`);
    });

    it('should return null for non-existent project', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const project = await service.getProject('non-existent-id');
      expect(project).toBeNull();
    });
  });

  // ─── getProjectByReference ─────────────────────────────────────────────────

  describe('getProjectByReference', () => {
    it('should return project by reference number', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockProjectRow()] });

      const project = await service.getProjectByReference(`TST-PRJ-${YEAR}-000001`);

      expect(project).not.toBeNull();
      expect(project!.referenceNumber).toBe(`TST-PRJ-${YEAR}-000001`);
    });

    it('should return null when reference not found', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const project = await service.getProjectByReference('TST-PRJ-9999-999999');
      expect(project).toBeNull();
    });
  });

  // ─── listProjects ──────────────────────────────────────────────────────────

  describe('listProjects', () => {
    it('should list all projects without filters', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '2' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          mockProjectRow({ id: 'id-1', reference_number: `TST-PRJ-${YEAR}-000001` }),
          mockProjectRow({ id: 'id-2', reference_number: `TST-PRJ-${YEAR}-000002` }),
        ],
      });

      const result = await service.listProjects();

      expect(result.total).toBe(2);
      expect(result.projects).toHaveLength(2);
    });

    it('should filter by clientId', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockProjectRow()] });

      const result = await service.listProjects({ clientId: MOCK_CLIENT_ID });

      expect(result.total).toBe(1);
      expect(result.projects[0].clientId).toBe(MOCK_CLIENT_ID);
    });

    it('should filter by status', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockProjectRow({ status: ProjectStatus.ACTIVE })],
      });

      const result = await service.listProjects({ status: ProjectStatus.ACTIVE });

      expect(result.projects[0].status).toBe(ProjectStatus.ACTIVE);
    });

    it('should return empty list when no projects match', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '0' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.listProjects({ status: ProjectStatus.COMPLETED });

      expect(result.total).toBe(0);
      expect(result.projects).toHaveLength(0);
    });
  });

  // ─── updateProjectStatus ───────────────────────────────────────────────────

  describe('updateProjectStatus', () => {
    it('should transition PENDING_APPROVAL → ACTIVE', async () => {
      // getProject
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockProjectRow()] });
      // update
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockProjectRow({ status: ProjectStatus.ACTIVE })],
      });

      const project = await service.updateProjectStatus(
        MOCK_PROJECT_ID,
        ProjectStatus.ACTIVE,
        MOCK_AGENT_ID
      );

      expect(project.status).toBe(ProjectStatus.ACTIVE);
    });

    it('should transition PENDING_APPROVAL → CANCELLED', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockProjectRow()] });
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockProjectRow({ status: ProjectStatus.CANCELLED })],
      });

      const project = await service.updateProjectStatus(
        MOCK_PROJECT_ID,
        ProjectStatus.CANCELLED,
        MOCK_AGENT_ID
      );

      expect(project.status).toBe(ProjectStatus.CANCELLED);
    });

    it('should transition ACTIVE → ON_HOLD', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockProjectRow({ status: ProjectStatus.ACTIVE })],
      });
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockProjectRow({ status: ProjectStatus.ON_HOLD })],
      });

      const project = await service.updateProjectStatus(
        MOCK_PROJECT_ID,
        ProjectStatus.ON_HOLD,
        MOCK_AGENT_ID
      );

      expect(project.status).toBe(ProjectStatus.ON_HOLD);
    });

    it('should transition ACTIVE → COMPLETED', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockProjectRow({ status: ProjectStatus.ACTIVE })],
      });
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockProjectRow({ status: ProjectStatus.COMPLETED })],
      });

      const project = await service.updateProjectStatus(
        MOCK_PROJECT_ID,
        ProjectStatus.COMPLETED,
        MOCK_AGENT_ID
      );

      expect(project.status).toBe(ProjectStatus.COMPLETED);
    });

    it('should reject invalid transition PENDING_APPROVAL → COMPLETED', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockProjectRow()] });

      await expect(
        service.updateProjectStatus(MOCK_PROJECT_ID, ProjectStatus.COMPLETED, MOCK_AGENT_ID)
      ).rejects.toThrow('Invalid status transition');
    });

    it('should reject transition from COMPLETED (terminal state)', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockProjectRow({ status: ProjectStatus.COMPLETED })],
      });

      await expect(
        service.updateProjectStatus(MOCK_PROJECT_ID, ProjectStatus.ACTIVE, MOCK_AGENT_ID)
      ).rejects.toThrow('Invalid status transition');
    });

    it('should reject transition from CANCELLED (terminal state)', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockProjectRow({ status: ProjectStatus.CANCELLED })],
      });

      await expect(
        service.updateProjectStatus(MOCK_PROJECT_ID, ProjectStatus.ACTIVE, MOCK_AGENT_ID)
      ).rejects.toThrow('Invalid status transition');
    });

    it('should throw when project not found', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateProjectStatus('non-existent', ProjectStatus.ACTIVE, MOCK_AGENT_ID)
      ).rejects.toThrow('Project not found');
    });
  });

  // ─── updateProject ─────────────────────────────────────────────────────────

  describe('updateProject', () => {
    it('should update service amount', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockProjectRow()] });
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockProjectRow({ service_amount: '75000.00' })],
      });

      const project = await service.updateProject(MOCK_PROJECT_ID, { serviceAmount: 75000 });

      expect(project.serviceAmount).toBe(75000);
    });

    it('should update currency', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockProjectRow()] });
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockProjectRow({ currency: 'KES' })],
      });

      const project = await service.updateProject(MOCK_PROJECT_ID, { currency: 'KES' });

      expect(project.currency).toBe('KES');
    });

    it('should reject service amount <= 0', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockProjectRow()] });

      await expect(
        service.updateProject(MOCK_PROJECT_ID, { serviceAmount: -1 })
      ).rejects.toThrow('Service amount must be greater than 0');
    });

    it('should reject end date before start date', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockProjectRow()] });

      await expect(
        service.updateProject(MOCK_PROJECT_ID, {
          startDate: new Date('2024-12-31'),
          endDate: new Date('2024-01-01'),
        })
      ).rejects.toThrow('End date must be on or after start date');
    });

    it('should throw when no fields provided', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockProjectRow()] });

      await expect(service.updateProject(MOCK_PROJECT_ID, {})).rejects.toThrow(
        'No fields to update'
      );
    });

    it('should throw when project not found', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateProject('non-existent', { currency: 'EUR' })
      ).rejects.toThrow('Project not found');
    });
  });

  // ─── calculateTimeline ─────────────────────────────────────────────────────

  describe('calculateTimeline', () => {
    it('should calculate days between start and end date', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');
      const days = service.calculateTimeline(start, end);
      expect(days).toBe(365);
    });

    it('should return 1 for same-day start and end', () => {
      const date = new Date('2024-06-15');
      const days = service.calculateTimeline(date, date);
      expect(days).toBe(0);
    });

    it('should return 30 for a 30-day project', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const days = service.calculateTimeline(start, end);
      expect(days).toBe(30);
    });
  });
});
