import { SearchResultService } from './searchResultService';
import type { SearchResult } from './searchService';

// Mock db and logger
jest.mock('../database/connection', () => ({
  db: {
    query: jest.fn(),
  },
}));
jest.mock('../utils/logger', () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

import { db } from '../database/connection';

const mockDb = db as jest.Mocked<typeof db>;

describe('SearchResultService', () => {
  let service: SearchResultService;

  beforeEach(() => {
    service = new SearchResultService();
    jest.clearAllMocks();
  });

  // ── sortResults ────────────────────────────────────────────────────────────

  describe('sortResults', () => {
    const makeResult = (overrides: Partial<SearchResult>): SearchResult => ({
      entityType: 'client',
      id: 'id-1',
      title: 'Test',
      snippet: '',
      relevanceScore: 0.5,
      ...overrides,
    });

    it('sorts by relevance descending', () => {
      const results = [
        makeResult({ id: 'a', relevanceScore: 0.3 }),
        makeResult({ id: 'b', relevanceScore: 0.9 }),
        makeResult({ id: 'c', relevanceScore: 0.6 }),
      ];
      const sorted = service.sortResults(results, 'relevance');
      expect(sorted.map((r) => r.id)).toEqual(['b', 'c', 'a']);
    });

    it('sorts alphabetically by title', () => {
      const results = [
        makeResult({ id: 'a', title: 'Zebra Corp' }),
        makeResult({ id: 'b', title: 'Alpha Ltd' }),
        makeResult({ id: 'c', title: 'Mango Inc' }),
      ];
      const sorted = service.sortResults(results, 'alpha');
      expect(sorted.map((r) => r.title)).toEqual(['Alpha Ltd', 'Mango Inc', 'Zebra Corp']);
    });

    it('sorts by amount extracted from snippet', () => {
      const results = [
        makeResult({ id: 'a', snippet: 'Value: 500.00' }),
        makeResult({ id: 'b', snippet: 'Value: 1,200.00' }),
        makeResult({ id: 'c', snippet: 'Value: 300.00' }),
      ];
      const sorted = service.sortResults(results, 'amount');
      expect(sorted.map((r) => r.id)).toEqual(['b', 'a', 'c']);
    });

    it('does not mutate the original array', () => {
      const results = [
        makeResult({ id: 'a', title: 'Zebra' }),
        makeResult({ id: 'b', title: 'Alpha' }),
      ];
      const original = [...results];
      service.sortResults(results, 'alpha');
      expect(results[0].id).toBe(original[0].id);
    });

    it('returns empty array when given empty input', () => {
      expect(service.sortResults([], 'relevance')).toEqual([]);
    });
  });

  // ── countResults ──────────────────────────────────────────────────────────

  describe('countResults', () => {
    it('returns 0 for empty query', async () => {
      const count = await service.countResults('', ['client'], 'user-1', 'ADMIN');
      expect(count).toBe(0);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('returns 0 for whitespace-only query', async () => {
      const count = await service.countResults('   ', ['client'], 'user-1', 'ADMIN');
      expect(count).toBe(0);
    });

    it('returns total count from database', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ total: 42 }], rowCount: 1 } as any);
      const count = await service.countResults('test query', ['client', 'project'], 'user-1', 'ADMIN');
      expect(count).toBe(42);
    });

    it('applies agent filter for AGENT role', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ total: 5 }], rowCount: 1 } as any);
      await service.countResults('test', ['client'], 'agent-123', 'AGENT');
      const sql: string = mockDb.query.mock.calls[0][0] as string;
      expect(sql).toContain('agent_id');
    });

    it('does not apply agent filter for non-AGENT role', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ total: 10 }], rowCount: 1 } as any);
      await service.countResults('test', ['client'], 'user-1', 'ADMIN');
      const sql: string = mockDb.query.mock.calls[0][0] as string;
      expect(sql).not.toContain('agent_id');
    });

    it('returns 0 when no entity types provided', async () => {
      const count = await service.countResults('test', [], 'user-1', 'ADMIN');
      expect(count).toBe(0);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('throws on database error', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.countResults('test', ['client'], 'user-1', 'ADMIN')).rejects.toThrow('DB error');
    });
  });

  // ── saveRecentSearch ──────────────────────────────────────────────────────

  describe('saveRecentSearch', () => {
    it('inserts search and trims to 10 entries', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
      await service.saveRecentSearch('user-1', 'my search');
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      // First call: INSERT
      expect((mockDb.query.mock.calls[0][0] as string).trim()).toMatch(/^INSERT INTO recent_searches/);
      // Second call: DELETE to enforce max 10
      expect((mockDb.query.mock.calls[1][0] as string).trim()).toMatch(/^DELETE FROM recent_searches/);
    });

    it('does nothing for empty query', async () => {
      await service.saveRecentSearch('user-1', '');
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('does nothing for whitespace-only query', async () => {
      await service.saveRecentSearch('user-1', '   ');
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('trims whitespace from query before saving', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
      await service.saveRecentSearch('user-1', '  trimmed query  ');
      const params = mockDb.query.mock.calls[0][1] as any[];
      expect(params[1]).toBe('trimmed query');
    });

    it('throws on database error', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.saveRecentSearch('user-1', 'test')).rejects.toThrow('DB error');
    });
  });

  // ── getRecentSearches ─────────────────────────────────────────────────────

  describe('getRecentSearches', () => {
    it('returns list of recent queries', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ query: 'search one' }, { query: 'search two' }],
        rowCount: 2,
      } as any);
      const results = await service.getRecentSearches('user-1');
      expect(results).toEqual(['search one', 'search two']);
    });

    it('returns empty array when no recent searches', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
      const results = await service.getRecentSearches('user-1');
      expect(results).toEqual([]);
    });

    it('queries with correct user_id', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
      await service.getRecentSearches('user-abc');
      const params = mockDb.query.mock.calls[0][1] as any[];
      expect(params[0]).toBe('user-abc');
    });

    it('throws on database error', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.getRecentSearches('user-1')).rejects.toThrow('DB error');
    });
  });
});
