import { FilterService } from './filterService';
import { db } from '../database/connection';

jest.mock('../database/connection');
jest.mock('../utils/logger');
jest.mock('../config', () => ({
  config: {
    logging: { level: 'info', filePath: '/tmp/test.log' },
    database: { host: 'localhost', port: 5432, name: 'test', user: 'test', password: 'test' },
  },
}));

const mockQuery = db.query as jest.Mock;

describe('FilterService', () => {
  let service: FilterService;

  beforeEach(() => {
    service = new FilterService();
    jest.clearAllMocks();
  });

  // ── buildFilterQuery ────────────────────────────────────────────────────────

  describe('buildFilterQuery()', () => {
    it('returns empty WHERE clause for empty filters', () => {
      const { whereClause, params } = service.buildFilterQuery({});
      expect(whereClause).toBe('');
      expect(params).toHaveLength(0);
    });

    it('builds date range filter with from and to', () => {
      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');
      const { whereClause, params } = service.buildFilterQuery({ dateRange: { from, to } });
      expect(whereClause).toContain('created_at >= $1');
      expect(whereClause).toContain('created_at <= $2');
      expect(params).toEqual([from, to]);
    });

    it('builds date range filter with only from', () => {
      const from = new Date('2024-01-01');
      const { whereClause, params } = service.buildFilterQuery({ dateRange: { from } });
      expect(whereClause).toContain('created_at >= $1');
      expect(whereClause).not.toContain('created_at <=');
      expect(params).toEqual([from]);
    });

    it('builds status IN filter for positive values', () => {
      const { whereClause, params } = service.buildFilterQuery({ status: ['LEAD', 'QUALIFIED_LEAD'] });
      expect(whereClause).toContain('status IN ($1, $2)');
      expect(params).toEqual(['LEAD', 'QUALIFIED_LEAD']);
    });

    it('builds status NOT IN filter for negated values (NOT operator)', () => {
      const { whereClause, params } = service.buildFilterQuery({ status: ['!LEAD'] });
      expect(whereClause).toContain('status NOT IN ($1)');
      expect(params).toEqual(['LEAD']);
    });

    it('builds country IN filter', () => {
      const { whereClause, params } = service.buildFilterQuery({ country: ['Kenya', 'Nigeria'] });
      expect(whereClause).toContain('country IN ($1, $2)');
      expect(params).toEqual(['Kenya', 'Nigeria']);
    });

    it('builds industry_category IN filter', () => {
      const { whereClause, params } = service.buildFilterQuery({ industryCategory: ['SCHOOLS', 'HOSPITALS'] });
      expect(whereClause).toContain('industry_category IN ($1, $2)');
      expect(params).toEqual(['SCHOOLS', 'HOSPITALS']);
    });

    it('builds assigned_user filter', () => {
      const { whereClause, params } = service.buildFilterQuery({ assignedUser: 'user-uuid-1' });
      expect(whereClause).toContain('agent_id = $1');
      expect(params).toEqual(['user-uuid-1']);
    });

    it('builds amount range filter with min and max', () => {
      const { whereClause, params } = service.buildFilterQuery({ amountRange: { min: 1000, max: 50000 } });
      expect(whereClause).toContain('estimated_value >= $1');
      expect(whereClause).toContain('estimated_value <= $2');
      expect(params).toEqual([1000, 50000]);
    });

    it('builds amount range filter with only min', () => {
      const { whereClause, params } = service.buildFilterQuery({ amountRange: { min: 500 } });
      expect(whereClause).toContain('estimated_value >= $1');
      expect(whereClause).not.toContain('estimated_value <=');
      expect(params).toEqual([500]);
    });

    it('combines multiple filters with AND operator by default', () => {
      const { whereClause } = service.buildFilterQuery({
        status: ['LEAD'],
        country: ['Kenya'],
      });
      expect(whereClause).toContain(' AND ');
    });

    it('combines multiple filters with OR operator when specified', () => {
      const { whereClause } = service.buildFilterQuery({
        status: ['LEAD'],
        country: ['Kenya'],
        booleanOperator: 'OR',
      });
      expect(whereClause).toContain(' OR ');
    });

    it('respects custom startParamIndex', () => {
      const { whereClause, params } = service.buildFilterQuery({ status: ['LEAD'] }, 5);
      expect(whereClause).toContain('$5');
      expect(params).toEqual(['LEAD']);
    });
  });

  // ── getSuggestions ──────────────────────────────────────────────────────────

  describe('getSuggestions()', () => {
    it('returns suggestions for a known field', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ value: 'Kenya' }, { value: 'Kenia' }] });
      const results = await service.getSuggestions('country', 'Ken', 'user-1', 'CEO');
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ value: 'Kenya', label: 'Kenya' });
    });

    it('returns empty array for unknown field', async () => {
      const results = await service.getSuggestions('unknown_field', 'test', 'user-1', 'CEO');
      expect(results).toHaveLength(0);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('applies agent_id filter for AGENT role on client fields', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await service.getSuggestions('country', 'Ken', 'agent-uuid', 'AGENT');
      const sql: string = mockQuery.mock.calls[0][0];
      expect(sql).toContain('agent_id');
    });

    it('does NOT apply agent_id filter for non-agent roles', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await service.getSuggestions('country', 'Ken', 'ceo-uuid', 'CEO');
      const sql: string = mockQuery.mock.calls[0][0];
      expect(sql).not.toContain('agent_id');
    });

    it('propagates database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.getSuggestions('status', 'LE', 'user-1', 'CEO')).rejects.toThrow('DB error');
    });
  });

  // ── saveSavedView ───────────────────────────────────────────────────────────

  describe('saveSavedView()', () => {
    it('saves a new view and returns it', async () => {
      const now = new Date();
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'view-uuid-1',
          user_id: 'user-1',
          name: 'My View',
          filters: { status: ['LEAD'] },
          created_at: now,
          updated_at: now,
        }],
      });

      const view = await service.saveSavedView('user-1', 'My View', { status: ['LEAD'] });
      expect(view.id).toBe('view-uuid-1');
      expect(view.userId).toBe('user-1');
      expect(view.name).toBe('My View');
      expect(view.filters).toEqual({ status: ['LEAD'] });
    });

    it('upserts when name already exists for user', async () => {
      const now = new Date();
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'view-uuid-1',
          user_id: 'user-1',
          name: 'My View',
          filters: { status: ['QUALIFIED_LEAD'] },
          created_at: now,
          updated_at: now,
        }],
      });

      const view = await service.saveSavedView('user-1', 'My View', { status: ['QUALIFIED_LEAD'] });
      const sql: string = mockQuery.mock.calls[0][0];
      expect(sql).toContain('ON CONFLICT');
      expect(view.filters).toEqual({ status: ['QUALIFIED_LEAD'] });
    });

    it('propagates database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Unique violation'));
      await expect(service.saveSavedView('user-1', 'Bad View', {})).rejects.toThrow('Unique violation');
    });
  });

  // ── getSavedViews ───────────────────────────────────────────────────────────

  describe('getSavedViews()', () => {
    it('returns all saved views for a user', async () => {
      const now = new Date();
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'v1', user_id: 'user-1', name: 'Alpha', filters: {}, created_at: now, updated_at: now },
          { id: 'v2', user_id: 'user-1', name: 'Beta', filters: { country: ['Kenya'] }, created_at: now, updated_at: now },
        ],
      });

      const views = await service.getSavedViews('user-1');
      expect(views).toHaveLength(2);
      expect(views[0].name).toBe('Alpha');
      expect(views[1].filters).toEqual({ country: ['Kenya'] });
    });

    it('returns empty array when user has no saved views', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const views = await service.getSavedViews('user-1');
      expect(views).toHaveLength(0);
    });

    it('propagates database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.getSavedViews('user-1')).rejects.toThrow('DB error');
    });
  });

  // ── deleteSavedView ─────────────────────────────────────────────────────────

  describe('deleteSavedView()', () => {
    it('returns true when view is deleted', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      const result = await service.deleteSavedView('user-1', 'view-uuid-1');
      expect(result).toBe(true);
    });

    it('returns false when view does not exist or belongs to another user', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });
      const result = await service.deleteSavedView('user-1', 'other-view-uuid');
      expect(result).toBe(false);
    });

    it('scopes delete to the owning user', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      await service.deleteSavedView('user-1', 'view-uuid-1');
      const params: any[] = mockQuery.mock.calls[0][1];
      expect(params).toContain('user-1');
      expect(params).toContain('view-uuid-1');
    });

    it('propagates database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.deleteSavedView('user-1', 'view-uuid-1')).rejects.toThrow('DB error');
    });
  });
});
