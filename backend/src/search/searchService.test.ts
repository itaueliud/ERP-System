import { SearchService } from './searchService';
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

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(() => {
    service = new SearchService();
    jest.clearAllMocks();
  });

  describe('search()', () => {
    it('returns empty results for blank query', async () => {
      const result = await service.search('', ['client'], 'user-1', 'AGENT');
      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('returns empty results for whitespace-only query', async () => {
      const result = await service.search('   ', ['client'], 'user-1', 'AGENT');
      expect(result.results).toHaveLength(0);
    });

    it('returns empty results when no entity types are provided', async () => {
      const result = await service.search('test', [], 'user-1', 'CEO');
      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('searches clients and returns highlighted results', async () => {
      // count query
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      // data query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            entity_type: 'client',
            id: 'client-uuid-1',
            title: 'Acme School',
            raw_snippet: 'School management system for Acme',
            relevance_score: '0.75',
          },
        ],
      });

      const result = await service.search('Acme', ['client'], 'user-1', 'CEO');

      expect(result.total).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].entityType).toBe('client');
      expect(result.results[0].id).toBe('client-uuid-1');
      expect(result.results[0].title).toContain('<mark>');
      expect(result.results[0].snippet).toContain('<mark>');
      expect(result.results[0].relevanceScore).toBe(0.75);
    });

    it('searches across multiple entity types', async () => {
      // count
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      // data
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            entity_type: 'client',
            id: 'client-1',
            title: 'Test Client',
            raw_snippet: 'Test description',
            relevance_score: '0.9',
          },
          {
            entity_type: 'project',
            id: 'project-1',
            title: 'Test Project',
            raw_snippet: 'TST-PRJ-2024-000001',
            relevance_score: '0.6',
          },
        ],
      });

      const result = await service.search('Test', ['client', 'project'], 'user-1', 'CEO');

      expect(result.total).toBe(2);
      expect(result.results[0].entityType).toBe('client');
      expect(result.results[1].entityType).toBe('project');
    });

    it('respects role-based access: agents only see their own clients', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.search('test', ['client'], 'agent-uuid', 'AGENT');

      // The SQL passed to db.query should include the agent_id filter
      const callArgs = mockQuery.mock.calls[0];
      const sql: string = callArgs[0];
      expect(sql).toContain('agent_id');
    });

    it('does NOT apply agent filter for non-agent roles', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.search('test', ['client'], 'ceo-uuid', 'CEO');

      const callArgs = mockQuery.mock.calls[0];
      const sql: string = callArgs[0];
      expect(sql).not.toContain('agent_id');
    });

    it('returns correct pagination metadata', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '120' }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.search('test', ['client'], 'user-1', 'CEO', 3, 50);

      expect(result.page).toBe(3);
      expect(result.limit).toBe(50);
      expect(result.total).toBe(120);
    });

    it('truncates long snippets to 200 characters', async () => {
      const longText = 'a'.repeat(300);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            entity_type: 'property',
            id: 'prop-1',
            title: 'Big Property',
            raw_snippet: longText,
            relevance_score: '0.5',
          },
        ],
      });

      const result = await service.search('property', ['property'], 'user-1', 'CEO');
      // 200 chars + ellipsis
      expect(result.results[0].snippet.replace(/<\/?mark>/g, '').length).toBeLessThanOrEqual(204);
    });

    it('includes durationMs in response', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.search('test', ['client'], 'user-1', 'CEO');
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('propagates database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(service.search('test', ['client'], 'user-1', 'CEO')).rejects.toThrow(
        'DB connection lost'
      );
    });

    it('searches all entity types by default', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.search('test', undefined, 'user-1', 'CEO');

      const sql: string = mockQuery.mock.calls[0][0];
      expect(sql).toContain('clients');
      expect(sql).toContain('projects');
      expect(sql).toContain('contracts');
      expect(sql).toContain('property_listings');
    });
  });
});
