import {
  ServiceAmountChangeService,
  ServiceAmountChangeStatus,
} from './projectService';
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

const MOCK_PROJECT_ID = '333e4567-e89b-12d3-a456-426614174003';
const MOCK_REQUESTER_ID = '444e4567-e89b-12d3-a456-426614174004';
const MOCK_CEO_ID = '555e4567-e89b-12d3-a456-426614174005';
const MOCK_CHANGE_ID = '666e4567-e89b-12d3-a456-426614174006';

function mockChangeRow(overrides: Record<string, any> = {}) {
  return {
    id: MOCK_CHANGE_ID,
    project_id: MOCK_PROJECT_ID,
    original_amount: '50000.00',
    new_amount: '60000.00',
    justification: 'Scope expanded',
    requester_id: MOCK_REQUESTER_ID,
    status: ServiceAmountChangeStatus.PENDING,
    ceo_decision: null,
    ceo_notes: null,
    decided_at: null,
    created_at: new Date('2024-01-01T10:00:00Z'),
    ...overrides,
  };
}

describe('ServiceAmountChangeService', () => {
  let service: ServiceAmountChangeService;

  beforeEach(() => {
    service = new ServiceAmountChangeService();
    jest.clearAllMocks();
  });

  // ─── requestServiceAmountChange ────────────────────────────────────────────

  describe('requestServiceAmountChange', () => {
    const validInput = {
      projectId: MOCK_PROJECT_ID,
      newAmount: 60000,
      justification: 'Scope expanded due to additional features',
      requesterId: MOCK_REQUESTER_ID,
    };

    it('should create a pending change request', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: MOCK_PROJECT_ID, service_amount: '50000.00' }] })
        .mockResolvedValueOnce({ rows: [mockChangeRow()] });

      const change = await service.requestServiceAmountChange(validInput);

      expect(change.status).toBe(ServiceAmountChangeStatus.PENDING);
      expect(change.originalAmount).toBe(50000);
      expect(change.newAmount).toBe(60000);
      expect(change.justification).toBe('Scope expanded');
      expect(change.requesterId).toBe(MOCK_REQUESTER_ID);
    });

    it('should reject when new amount is 0 or negative', async () => {
      await expect(
        service.requestServiceAmountChange({ ...validInput, newAmount: 0 })
      ).rejects.toThrow('New service amount must be greater than 0');

      await expect(
        service.requestServiceAmountChange({ ...validInput, newAmount: -100 })
      ).rejects.toThrow('New service amount must be greater than 0');
    });

    it('should reject when justification is empty', async () => {
      await expect(
        service.requestServiceAmountChange({ ...validInput, justification: '' })
      ).rejects.toThrow('Justification is required');

      await expect(
        service.requestServiceAmountChange({ ...validInput, justification: '   ' })
      ).rejects.toThrow('Justification is required');
    });

    it('should reject when project does not exist', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(service.requestServiceAmountChange(validInput)).rejects.toThrow(
        'Project not found'
      );
    });

    it('should reject when new amount equals current amount', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: MOCK_PROJECT_ID, service_amount: '60000.00' }],
      });

      await expect(
        service.requestServiceAmountChange({ ...validInput, newAmount: 60000 })
      ).rejects.toThrow('New amount must differ from the current service amount');
    });
  });

  // ─── approveServiceAmountChange ────────────────────────────────────────────

  describe('approveServiceAmountChange', () => {
    it('should approve a pending change and update project amount', async () => {
      // fetch change
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockChangeRow()] })
        // update change record
        .mockResolvedValueOnce({
          rows: [
            mockChangeRow({
              status: ServiceAmountChangeStatus.APPROVED,
              ceo_decision: MOCK_CEO_ID,
              ceo_notes: 'Approved',
              decided_at: new Date(),
            }),
          ],
        })
        // update project service_amount
        .mockResolvedValueOnce({ rows: [] });

      const change = await service.approveServiceAmountChange(MOCK_CHANGE_ID, MOCK_CEO_ID, 'Approved');

      expect(change.status).toBe(ServiceAmountChangeStatus.APPROVED);
      expect(change.ceoDecision).toBe(MOCK_CEO_ID);
      expect(change.ceoNotes).toBe('Approved');
    });

    it('should throw when change request not found', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        service.approveServiceAmountChange('non-existent', MOCK_CEO_ID)
      ).rejects.toThrow('Service amount change request not found');
    });

    it('should throw when change is not pending', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockChangeRow({ status: ServiceAmountChangeStatus.APPROVED })],
      });

      await expect(
        service.approveServiceAmountChange(MOCK_CHANGE_ID, MOCK_CEO_ID)
      ).rejects.toThrow('Only pending change requests can be approved');
    });

    it('should approve without notes (notes are optional)', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockChangeRow()] })
        .mockResolvedValueOnce({
          rows: [
            mockChangeRow({
              status: ServiceAmountChangeStatus.APPROVED,
              ceo_decision: MOCK_CEO_ID,
              decided_at: new Date(),
            }),
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const change = await service.approveServiceAmountChange(MOCK_CHANGE_ID, MOCK_CEO_ID);

      expect(change.status).toBe(ServiceAmountChangeStatus.APPROVED);
    });
  });

  // ─── rejectServiceAmountChange ─────────────────────────────────────────────

  describe('rejectServiceAmountChange', () => {
    it('should reject a pending change and keep original amount', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockChangeRow()] })
        .mockResolvedValueOnce({
          rows: [
            mockChangeRow({
              status: ServiceAmountChangeStatus.REJECTED,
              ceo_decision: MOCK_CEO_ID,
              ceo_notes: 'Not justified',
              decided_at: new Date(),
            }),
          ],
        });

      const change = await service.rejectServiceAmountChange(
        MOCK_CHANGE_ID,
        MOCK_CEO_ID,
        'Not justified'
      );

      expect(change.status).toBe(ServiceAmountChangeStatus.REJECTED);
      expect(change.ceoNotes).toBe('Not justified');
      // Project amount should NOT be updated — no db.query call for projects
      const calls = (db.query as jest.Mock).mock.calls;
      const projectUpdateCalls = calls.filter(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('UPDATE projects')
      );
      expect(projectUpdateCalls).toHaveLength(0);
    });

    it('should throw when notes are empty', async () => {
      await expect(
        service.rejectServiceAmountChange(MOCK_CHANGE_ID, MOCK_CEO_ID, '')
      ).rejects.toThrow('Notes are required when rejecting');

      await expect(
        service.rejectServiceAmountChange(MOCK_CHANGE_ID, MOCK_CEO_ID, '   ')
      ).rejects.toThrow('Notes are required when rejecting');
    });

    it('should throw when change request not found', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        service.rejectServiceAmountChange('non-existent', MOCK_CEO_ID, 'reason')
      ).rejects.toThrow('Service amount change request not found');
    });

    it('should throw when change is not pending', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockChangeRow({ status: ServiceAmountChangeStatus.REJECTED })],
      });

      await expect(
        service.rejectServiceAmountChange(MOCK_CHANGE_ID, MOCK_CEO_ID, 'reason')
      ).rejects.toThrow('Only pending change requests can be rejected');
    });
  });

  // ─── getPendingServiceAmountChanges ────────────────────────────────────────

  describe('getPendingServiceAmountChanges', () => {
    it('should return all pending changes ordered by created_at ASC', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          mockChangeRow({ id: 'id-1' }),
          mockChangeRow({ id: 'id-2' }),
        ],
      });

      const changes = await service.getPendingServiceAmountChanges();

      expect(changes).toHaveLength(2);
      expect(changes[0].status).toBe(ServiceAmountChangeStatus.PENDING);
      expect(changes[1].status).toBe(ServiceAmountChangeStatus.PENDING);
    });

    it('should return empty array when no pending changes', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const changes = await service.getPendingServiceAmountChanges();

      expect(changes).toHaveLength(0);
    });
  });

  // ─── getOverdueServiceAmountChanges ────────────────────────────────────────

  describe('getOverdueServiceAmountChanges', () => {
    it('should return changes pending for more than 24 hours', async () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockChangeRow({ created_at: oldDate })],
      });

      const changes = await service.getOverdueServiceAmountChanges();

      expect(changes).toHaveLength(1);
      expect(changes[0].status).toBe(ServiceAmountChangeStatus.PENDING);
    });

    it('should return empty array when no overdue changes', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const changes = await service.getOverdueServiceAmountChanges();

      expect(changes).toHaveLength(0);
    });
  });

  // ─── getServiceAmountChanges ───────────────────────────────────────────────

  describe('getServiceAmountChanges', () => {
    it('should return all changes when no projectId provided', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          mockChangeRow({ id: 'id-1', project_id: 'proj-1' }),
          mockChangeRow({ id: 'id-2', project_id: 'proj-2' }),
        ],
      });

      const changes = await service.getServiceAmountChanges();

      expect(changes).toHaveLength(2);
    });

    it('should filter by projectId when provided', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockChangeRow()],
      });

      const changes = await service.getServiceAmountChanges(MOCK_PROJECT_ID);

      expect(changes).toHaveLength(1);
      expect(changes[0].projectId).toBe(MOCK_PROJECT_ID);

      // Verify the query was called with the projectId parameter
      const queryCall = (db.query as jest.Mock).mock.calls[0];
      expect(queryCall[1]).toEqual([MOCK_PROJECT_ID]);
    });

    it('should return empty array when no changes exist', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const changes = await service.getServiceAmountChanges(MOCK_PROJECT_ID);

      expect(changes).toHaveLength(0);
    });
  });

  // ─── data mapping ──────────────────────────────────────────────────────────

  describe('data mapping', () => {
    it('should correctly map all fields from database row', async () => {
      const decidedAt = new Date('2024-01-02T12:00:00Z');
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          mockChangeRow({
            status: ServiceAmountChangeStatus.APPROVED,
            ceo_decision: MOCK_CEO_ID,
            ceo_notes: 'Looks good',
            decided_at: decidedAt,
          }),
        ],
      });

      const changes = await service.getServiceAmountChanges(MOCK_PROJECT_ID);
      const change = changes[0];

      expect(change.id).toBe(MOCK_CHANGE_ID);
      expect(change.projectId).toBe(MOCK_PROJECT_ID);
      expect(change.originalAmount).toBe(50000);
      expect(change.newAmount).toBe(60000);
      expect(change.justification).toBe('Scope expanded');
      expect(change.requesterId).toBe(MOCK_REQUESTER_ID);
      expect(change.status).toBe(ServiceAmountChangeStatus.APPROVED);
      expect(change.ceoDecision).toBe(MOCK_CEO_ID);
      expect(change.ceoNotes).toBe('Looks good');
      expect(change.decidedAt).toEqual(decidedAt);
    });

    it('should map optional fields as undefined when null in db', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockChangeRow()],
      });

      const changes = await service.getServiceAmountChanges(MOCK_PROJECT_ID);
      const change = changes[0];

      expect(change.ceoDecision).toBeUndefined();
      expect(change.ceoNotes).toBeUndefined();
      expect(change.decidedAt).toBeUndefined();
    });
  });
});
