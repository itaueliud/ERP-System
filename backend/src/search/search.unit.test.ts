/**
 * Unit tests for the Search System
 * Task 23.6 - Requirements: 24.1-24.11
 *
 * Covers:
 *  - Full-text search performance and term highlighting
 *  - Filter combinations (AND/OR, date range, status, country, industry, user, amount)
 *  - Autocomplete suggestions
 *  - Saved views (CRUD)
 */

import { SearchService } from './searchService';
import { FilterService, FilterInput } from './filterService';
import { SearchResultService } from './searchResultService';
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeSearchRow(overrides: Record<string, unknown> = {}) {
  return {
    entity_type: 'client',
    id: 'id-1',
    title: 'Acme Corp',
    raw_snippet: 'Service description for Acme',
    relevance_score: '0.75',
    ...overrides,
  };
}

function mockSearchResponse(rows: ReturnType<typeof makeSearchRow>[], total = rows.length) {
  mockQuery.mockResolvedValueOnce({ rows: [{ count: String(total) }] }); // count query
  mockQuery.mockResolvedValueOnce({ rows });                              // data query
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Full-Text Search  (Requirements 24.1, 24.2, 24.4)
// ─────────────────────────────────────────────────────────────────────────────

describe('Full-text search', () => {
  let searchService: SearchService;

  beforeEach(() => {
    searchService = new SearchService();
    jest.clearAllMocks();
  });

  it('REQ 24.1 – searches across clients', async () => {
    mockSearchResponse([makeSearchRow({ entity_type: 'client' })]);
    const result = await searchService.search('Acme', ['client'], 'user-1', 'CEO');
    expect(result.results[0].entityType).toBe('client');
  });

  it('REQ 24.1 – searches across projects', async () => {
    mockSearchResponse([makeSearchRow({ entity_type: 'project', title: 'TST-PRJ-2024-000001' })]);
    const result = await searchService.search('TST', ['project'], 'user-1', 'CEO');
    expect(result.results[0].entityType).toBe('project');
  });

  it('REQ 24.1 – searches across contracts', async () => {
    mockSearchResponse([makeSearchRow({ entity_type: 'contract', title: 'TST-CNT-2024-000001' })]);
    const result = await searchService.search('TST-CNT', ['contract'], 'user-1', 'CEO');
    expect(result.results[0].entityType).toBe('contract');
  });

  it('REQ 24.1 – searches across property listings', async () => {
    mockSearchResponse([makeSearchRow({ entity_type: 'property', title: 'Nairobi Land Plot' })]);
    const result = await searchService.search('Nairobi', ['property'], 'user-1', 'CEO');
    expect(result.results[0].entityType).toBe('property');
  });

  it('REQ 24.1 – searches all entity types simultaneously', async () => {
    mockSearchResponse([
      makeSearchRow({ entity_type: 'client', id: 'c1' }),
      makeSearchRow({ entity_type: 'project', id: 'p1' }),
      makeSearchRow({ entity_type: 'contract', id: 'ct1' }),
      makeSearchRow({ entity_type: 'property', id: 'pr1' }),
    ]);
    const result = await searchService.search('test', undefined, 'user-1', 'CEO');
    const types = result.results.map((r) => r.entityType);
    expect(types).toContain('client');
    expect(types).toContain('project');
    expect(types).toContain('contract');
    expect(types).toContain('property');
  });

  it('REQ 24.2 – records durationMs for performance monitoring', async () => {
    mockSearchResponse([makeSearchRow()]);
    const result = await searchService.search('test', ['client'], 'user-1', 'CEO');
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('REQ 24.2 – returns results (mock completes well within 500ms)', async () => {
    mockSearchResponse(Array.from({ length: 50 }, (_, i) => makeSearchRow({ id: `id-${i}` })), 50);
    const start = Date.now();
    const result = await searchService.search('test', ['client'], 'user-1', 'CEO');
    const elapsed = Date.now() - start;
    expect(result.total).toBe(50);
    // Mocked DB always responds instantly; verify the service doesn't add overhead
    expect(elapsed).toBeLessThan(500);
  });

  it('REQ 24.4 – highlights search term in title', async () => {
    mockSearchResponse([makeSearchRow({ title: 'Acme School', raw_snippet: 'Acme description' })]);
    const result = await searchService.search('Acme', ['client'], 'user-1', 'CEO');
    expect(result.results[0].title).toContain('<mark>Acme</mark>');
  });

  it('REQ 24.4 – highlights search term in snippet', async () => {
    mockSearchResponse([makeSearchRow({ raw_snippet: 'Service for Acme Corp' })]);
    const result = await searchService.search('Acme', ['client'], 'user-1', 'CEO');
    expect(result.results[0].snippet).toContain('<mark>');
  });

  it('REQ 24.4 – highlights are case-insensitive', async () => {
    mockSearchResponse([makeSearchRow({ title: 'acme school', raw_snippet: '' })]);
    const result = await searchService.search('ACME', ['client'], 'user-1', 'CEO');
    expect(result.results[0].title).toContain('<mark>');
  });

  it('REQ 24.5 – supports AND operator in query (SQL uses & operator)', async () => {
    mockSearchResponse([]);
    await searchService.search('school AND nairobi', ['client'], 'user-1', 'CEO');
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toContain('to_tsquery');
  });

  it('REQ 24.5 – supports OR operator in query', async () => {
    mockSearchResponse([]);
    await searchService.search('school OR hospital', ['client'], 'user-1', 'CEO');
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toContain('to_tsquery');
  });

  it('REQ 24.5 – supports NOT operator in query', async () => {
    mockSearchResponse([]);
    await searchService.search('school NOT hospital', ['client'], 'user-1', 'CEO');
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toContain('to_tsquery');
  });

  it('REQ 24.10 – paginates with 50 items per page by default', async () => {
    mockSearchResponse([], 200);
    const result = await searchService.search('test', ['client'], 'user-1', 'CEO', 1, 50);
    expect(result.limit).toBe(50);
    expect(result.page).toBe(1);
    expect(result.total).toBe(200);
  });

  it('REQ 24.10 – returns correct page metadata for page 2', async () => {
    mockSearchResponse([], 200);
    const result = await searchService.search('test', ['client'], 'user-1', 'CEO', 2, 50);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(50);
  });

  it('returns empty results for blank query without hitting DB', async () => {
    const result = await searchService.search('', ['client'], 'user-1', 'CEO');
    expect(result.results).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('agents only see their own clients (role-based access)', async () => {
    mockSearchResponse([]);
    await searchService.search('test', ['client'], 'agent-uuid', 'AGENT');
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toContain('agent_id');
  });

  it('non-agent roles see all clients', async () => {
    mockSearchResponse([]);
    await searchService.search('test', ['client'], 'ceo-uuid', 'CEO');
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).not.toContain('agent_id');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Filter Combinations  (Requirements 24.3, 24.5)
// ─────────────────────────────────────────────────────────────────────────────

describe('Filter combinations', () => {
  let filterService: FilterService;

  beforeEach(() => {
    filterService = new FilterService();
    jest.clearAllMocks();
  });

  // ── AND operator (default) ─────────────────────────────────────────────────

  it('REQ 24.3/24.5 – AND operator: combines status + country with AND', () => {
    const { whereClause } = filterService.buildFilterQuery({
      status: ['LEAD'],
      country: ['Kenya'],
      booleanOperator: 'AND',
    });
    expect(whereClause).toContain(' AND ');
    expect(whereClause).toContain('status IN');
    expect(whereClause).toContain('country IN');
  });

  it('REQ 24.3/24.5 – AND is the default boolean operator', () => {
    const { whereClause } = filterService.buildFilterQuery({
      status: ['LEAD'],
      country: ['Kenya'],
    });
    expect(whereClause).toContain(' AND ');
    expect(whereClause).not.toContain(' OR ');
  });

  // ── OR operator ────────────────────────────────────────────────────────────

  it('REQ 24.5 – OR operator: combines status + country with OR', () => {
    const { whereClause } = filterService.buildFilterQuery({
      status: ['LEAD'],
      country: ['Kenya'],
      booleanOperator: 'OR',
    });
    expect(whereClause).toContain(' OR ');
    expect(whereClause).not.toContain(' AND ');
  });

  // ── NOT operator (negated status) ─────────────────────────────────────────

  it('REQ 24.5 – NOT operator: negated status produces NOT IN clause', () => {
    const { whereClause, params } = filterService.buildFilterQuery({
      status: ['!CANCELLED'],
    });
    expect(whereClause).toContain('status NOT IN');
    expect(params).toContain('CANCELLED');
  });

  it('REQ 24.5 – mixed positive and negative status values', () => {
    const { whereClause, params } = filterService.buildFilterQuery({
      status: ['LEAD', '!CANCELLED'],
    });
    expect(whereClause).toContain('status IN');
    expect(whereClause).toContain('status NOT IN');
    expect(params).toContain('LEAD');
    expect(params).toContain('CANCELLED');
  });

  // ── Date range ─────────────────────────────────────────────────────────────

  it('REQ 24.3 – date range: from and to both present', () => {
    const from = new Date('2024-01-01');
    const to = new Date('2024-12-31');
    const { whereClause, params } = filterService.buildFilterQuery({ dateRange: { from, to } });
    expect(whereClause).toContain('created_at >=');
    expect(whereClause).toContain('created_at <=');
    expect(params).toContain(from);
    expect(params).toContain(to);
  });

  it('REQ 24.3 – date range: only from date', () => {
    const from = new Date('2024-06-01');
    const { whereClause, params } = filterService.buildFilterQuery({ dateRange: { from } });
    expect(whereClause).toContain('created_at >=');
    expect(whereClause).not.toContain('created_at <=');
    expect(params).toContain(from);
  });

  it('REQ 24.3 – date range: only to date', () => {
    const to = new Date('2024-06-30');
    const { whereClause, params } = filterService.buildFilterQuery({ dateRange: { to } });
    expect(whereClause).not.toContain('created_at >=');
    expect(whereClause).toContain('created_at <=');
    expect(params).toContain(to);
  });

  // ── Status filter ──────────────────────────────────────────────────────────

  it('REQ 24.3 – status filter: single value', () => {
    const { whereClause, params } = filterService.buildFilterQuery({ status: ['LEAD'] });
    expect(whereClause).toContain('status IN ($1)');
    expect(params).toEqual(['LEAD']);
  });

  it('REQ 24.3 – status filter: multiple values', () => {
    const { whereClause, params } = filterService.buildFilterQuery({
      status: ['LEAD', 'QUALIFIED_LEAD', 'PROJECT'],
    });
    expect(whereClause).toContain('status IN ($1, $2, $3)');
    expect(params).toEqual(['LEAD', 'QUALIFIED_LEAD', 'PROJECT']);
  });

  // ── Country filter ─────────────────────────────────────────────────────────

  it('REQ 24.3 – country filter: single country', () => {
    const { whereClause, params } = filterService.buildFilterQuery({ country: ['Kenya'] });
    expect(whereClause).toContain('country IN ($1)');
    expect(params).toEqual(['Kenya']);
  });

  it('REQ 24.3 – country filter: multiple African countries', () => {
    const countries = ['Kenya', 'Nigeria', 'Ghana', 'South Africa'];
    const { whereClause, params } = filterService.buildFilterQuery({ country: countries });
    expect(whereClause).toContain('country IN');
    expect(params).toEqual(countries);
  });

  // ── Industry category filter ───────────────────────────────────────────────

  it('REQ 24.3 – industry_category filter', () => {
    const { whereClause, params } = filterService.buildFilterQuery({
      industryCategory: ['SCHOOLS', 'HOSPITALS'],
    });
    expect(whereClause).toContain('industry_category IN ($1, $2)');
    expect(params).toEqual(['SCHOOLS', 'HOSPITALS']);
  });

  it('REQ 24.3 – all 7 industry categories can be filtered', () => {
    const categories = ['SCHOOLS', 'CHURCHES', 'HOTELS', 'HOSPITALS', 'COMPANIES', 'REAL_ESTATE', 'SHOPS'];
    const { whereClause, params } = filterService.buildFilterQuery({ industryCategory: categories });
    expect(whereClause).toContain('industry_category IN');
    expect(params).toHaveLength(7);
  });

  // ── Assigned user filter ───────────────────────────────────────────────────

  it('REQ 24.3 – assigned_user filter', () => {
    const { whereClause, params } = filterService.buildFilterQuery({ assignedUser: 'user-uuid-42' });
    expect(whereClause).toContain('agent_id = $1');
    expect(params).toEqual(['user-uuid-42']);
  });

  // ── Amount range filter ────────────────────────────────────────────────────

  it('REQ 24.3 – amount range: min and max', () => {
    const { whereClause, params } = filterService.buildFilterQuery({
      amountRange: { min: 5000, max: 100000 },
    });
    expect(whereClause).toContain('estimated_value >=');
    expect(whereClause).toContain('estimated_value <=');
    expect(params).toContain(5000);
    expect(params).toContain(100000);
  });

  it('REQ 24.3 – amount range: only min', () => {
    const { whereClause, params } = filterService.buildFilterQuery({ amountRange: { min: 1000 } });
    expect(whereClause).toContain('estimated_value >=');
    expect(whereClause).not.toContain('estimated_value <=');
    expect(params).toContain(1000);
  });

  it('REQ 24.3 – amount range: only max', () => {
    const { whereClause, params } = filterService.buildFilterQuery({ amountRange: { max: 50000 } });
    expect(whereClause).not.toContain('estimated_value >=');
    expect(whereClause).toContain('estimated_value <=');
    expect(params).toContain(50000);
  });

  // ── Combined filters ───────────────────────────────────────────────────────

  it('REQ 24.3 – all filters combined with AND', () => {
    const filters: FilterInput = {
      dateRange: { from: new Date('2024-01-01'), to: new Date('2024-12-31') },
      status: ['LEAD'],
      country: ['Kenya'],
      industryCategory: ['SCHOOLS'],
      assignedUser: 'user-1',
      amountRange: { min: 1000, max: 50000 },
      booleanOperator: 'AND',
    };
    const { whereClause, params } = filterService.buildFilterQuery(filters);
    expect(whereClause).toContain('WHERE');
    expect(whereClause).toContain(' AND ');
    expect(params.length).toBeGreaterThan(0);
  });

  it('REQ 24.3 – all filters combined with OR', () => {
    const filters: FilterInput = {
      status: ['LEAD'],
      country: ['Kenya'],
      industryCategory: ['SCHOOLS'],
      booleanOperator: 'OR',
    };
    const { whereClause } = filterService.buildFilterQuery(filters);
    expect(whereClause).toContain(' OR ');
  });

  it('empty filters produce no WHERE clause', () => {
    const { whereClause, params } = filterService.buildFilterQuery({});
    expect(whereClause).toBe('');
    expect(params).toHaveLength(0);
  });

  it('custom startParamIndex offsets parameter placeholders', () => {
    const { whereClause } = filterService.buildFilterQuery({ status: ['LEAD'] }, 10);
    expect(whereClause).toContain('$10');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Autocomplete Suggestions  (Requirement 24.6)
// ─────────────────────────────────────────────────────────────────────────────

describe('Autocomplete suggestions', () => {
  let filterService: FilterService;

  beforeEach(() => {
    filterService = new FilterService();
    jest.clearAllMocks();
  });

  it('REQ 24.6 – returns suggestions for country field as user types', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ value: 'Kenya' }, { value: 'Kenia' }],
    });
    const suggestions = await filterService.getSuggestions('country', 'Ken', 'user-1', 'CEO');
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]).toEqual({ value: 'Kenya', label: 'Kenya' });
  });

  it('REQ 24.6 – returns suggestions for status field', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ value: 'LEAD' }, { value: 'LEAD_QUALIFIED' }],
    });
    const suggestions = await filterService.getSuggestions('status', 'LE', 'user-1', 'CEO');
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].value).toContain('LEAD');
  });

  it('REQ 24.6 – returns suggestions for industry_category field', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ value: 'SCHOOLS' }, { value: 'SHOPS' }],
    });
    const suggestions = await filterService.getSuggestions('industry_category', 'S', 'user-1', 'CEO');
    expect(suggestions).toHaveLength(2);
  });

  it('REQ 24.6 – returns suggestions for assigned_user field', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ value: 'John Doe' }, { value: 'Jane Doe' }],
    });
    const suggestions = await filterService.getSuggestions('assigned_user', 'Jo', 'user-1', 'CEO');
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].label).toBe('John Doe');
  });

  it('REQ 24.6 – limits results to 10 suggestions', async () => {
    // DB query has LIMIT 10 in SQL; verify the SQL contains the limit
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await filterService.getSuggestions('country', 'A', 'user-1', 'CEO');
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toContain('LIMIT 10');
  });

  it('REQ 24.6 – returns empty array for unknown field (no DB call)', async () => {
    const suggestions = await filterService.getSuggestions('unknown_field', 'test', 'user-1', 'CEO');
    expect(suggestions).toHaveLength(0);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('REQ 24.6 – uses ILIKE for case-insensitive prefix matching', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await filterService.getSuggestions('country', 'ken', 'user-1', 'CEO');
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toContain('ILIKE');
  });

  it('REQ 24.6 – agents only see suggestions from their own clients', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await filterService.getSuggestions('country', 'Ken', 'agent-uuid', 'AGENT');
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toContain('agent_id');
  });

  it('REQ 24.6 – non-agent roles see all suggestions', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await filterService.getSuggestions('country', 'Ken', 'ceo-uuid', 'CEO');
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).not.toContain('agent_id');
  });

  it('REQ 24.6 – returns empty array when no matches found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const suggestions = await filterService.getSuggestions('country', 'zzz', 'user-1', 'CEO');
    expect(suggestions).toHaveLength(0);
  });

  it('propagates database errors', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    await expect(
      filterService.getSuggestions('status', 'LE', 'user-1', 'CEO')
    ).rejects.toThrow('DB error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Saved Views  (Requirement 24.8)
// ─────────────────────────────────────────────────────────────────────────────

describe('Saved views', () => {
  let filterService: FilterService;
  const NOW = new Date('2024-06-15T10:00:00Z');

  beforeEach(() => {
    filterService = new FilterService();
    jest.clearAllMocks();
  });

  // ── Create ─────────────────────────────────────────────────────────────────

  it('REQ 24.8 – creates a saved view and returns it', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'view-1',
        user_id: 'user-1',
        name: 'Active Leads Kenya',
        filters: { status: ['LEAD'], country: ['Kenya'] },
        created_at: NOW,
        updated_at: NOW,
      }],
    });

    const view = await filterService.saveSavedView('user-1', 'Active Leads Kenya', {
      status: ['LEAD'],
      country: ['Kenya'],
    });

    expect(view.id).toBe('view-1');
    expect(view.userId).toBe('user-1');
    expect(view.name).toBe('Active Leads Kenya');
    expect(view.filters).toEqual({ status: ['LEAD'], country: ['Kenya'] });
    expect(view.createdAt).toEqual(NOW);
  });

  it('REQ 24.8 – saves complex filter combination as a view', async () => {
    const complexFilters: FilterInput = {
      dateRange: { from: new Date('2024-01-01'), to: new Date('2024-12-31') },
      status: ['LEAD', 'QUALIFIED_LEAD'],
      country: ['Kenya', 'Nigeria'],
      industryCategory: ['SCHOOLS'],
      amountRange: { min: 5000, max: 100000 },
      booleanOperator: 'AND',
    };

    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'view-2',
        user_id: 'user-1',
        name: 'Complex View',
        filters: complexFilters,
        created_at: NOW,
        updated_at: NOW,
      }],
    });

    const view = await filterService.saveSavedView('user-1', 'Complex View', complexFilters);
    expect(view.name).toBe('Complex View');
    expect(view.filters).toEqual(complexFilters);
  });

  it('REQ 24.8 – upserts when view name already exists for user', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'view-1',
        user_id: 'user-1',
        name: 'My View',
        filters: { status: ['QUALIFIED_LEAD'] },
        created_at: NOW,
        updated_at: NOW,
      }],
    });

    const view = await filterService.saveSavedView('user-1', 'My View', { status: ['QUALIFIED_LEAD'] });
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toContain('ON CONFLICT');
    expect(view.filters).toEqual({ status: ['QUALIFIED_LEAD'] });
  });

  it('REQ 24.8 – serializes filters as JSON in the INSERT', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'view-3',
        user_id: 'user-1',
        name: 'JSON View',
        filters: { country: ['Ghana'] },
        created_at: NOW,
        updated_at: NOW,
      }],
    });

    await filterService.saveSavedView('user-1', 'JSON View', { country: ['Ghana'] });
    const params: any[] = mockQuery.mock.calls[0][1];
    // Third param should be JSON string of filters
    expect(typeof params[2]).toBe('string');
    expect(JSON.parse(params[2])).toEqual({ country: ['Ghana'] });
  });

  it('REQ 24.8 – propagates DB error on save', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Constraint violation'));
    await expect(
      filterService.saveSavedView('user-1', 'Bad View', {})
    ).rejects.toThrow('Constraint violation');
  });

  // ── Retrieve ───────────────────────────────────────────────────────────────

  it('REQ 24.8 – retrieves all saved views for a user', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'v1', user_id: 'user-1', name: 'Alpha', filters: {}, created_at: NOW, updated_at: NOW },
        { id: 'v2', user_id: 'user-1', name: 'Beta', filters: { country: ['Kenya'] }, created_at: NOW, updated_at: NOW },
        { id: 'v3', user_id: 'user-1', name: 'Gamma', filters: { status: ['LEAD'] }, created_at: NOW, updated_at: NOW },
      ],
    });

    const views = await filterService.getSavedViews('user-1');
    expect(views).toHaveLength(3);
    expect(views[0].name).toBe('Alpha');
    expect(views[1].filters).toEqual({ country: ['Kenya'] });
    expect(views[2].filters).toEqual({ status: ['LEAD'] });
  });

  it('REQ 24.8 – returns empty array when user has no saved views', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const views = await filterService.getSavedViews('user-1');
    expect(views).toHaveLength(0);
  });

  it('REQ 24.8 – scopes retrieval to the requesting user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await filterService.getSavedViews('user-abc');
    const params: any[] = mockQuery.mock.calls[0][1];
    expect(params[0]).toBe('user-abc');
  });

  it('REQ 24.8 – maps DB row fields to camelCase correctly', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'v1',
        user_id: 'user-1',
        name: 'Test',
        filters: { status: ['LEAD'] },
        created_at: NOW,
        updated_at: NOW,
      }],
    });

    const [view] = await filterService.getSavedViews('user-1');
    expect(view.userId).toBe('user-1');
    expect(view.createdAt).toEqual(NOW);
    expect(view.updatedAt).toEqual(NOW);
  });

  it('REQ 24.8 – propagates DB error on retrieve', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    await expect(filterService.getSavedViews('user-1')).rejects.toThrow('DB error');
  });

  // ── Update (upsert) ────────────────────────────────────────────────────────

  it('REQ 24.8 – updates existing view filters via upsert', async () => {
    const updatedFilters: FilterInput = { status: ['PROJECT'], country: ['Nigeria'] };
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'view-1',
        user_id: 'user-1',
        name: 'My View',
        filters: updatedFilters,
        created_at: NOW,
        updated_at: new Date(),
      }],
    });

    const view = await filterService.saveSavedView('user-1', 'My View', updatedFilters);
    expect(view.filters).toEqual(updatedFilters);
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toContain('DO UPDATE SET filters');
  });

  // ── Delete ─────────────────────────────────────────────────────────────────

  it('REQ 24.8 – deletes a saved view and returns true', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const deleted = await filterService.deleteSavedView('user-1', 'view-uuid-1');
    expect(deleted).toBe(true);
  });

  it('REQ 24.8 – returns false when view does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    const deleted = await filterService.deleteSavedView('user-1', 'nonexistent-view');
    expect(deleted).toBe(false);
  });

  it('REQ 24.8 – cannot delete another user\'s saved view', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    const deleted = await filterService.deleteSavedView('user-2', 'view-uuid-1');
    expect(deleted).toBe(false);
    // Verify both user_id and view_id are passed as params
    const params: any[] = mockQuery.mock.calls[0][1];
    expect(params).toContain('user-2');
    expect(params).toContain('view-uuid-1');
  });

  it('REQ 24.8 – delete scopes to owning user in SQL', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    await filterService.deleteSavedView('user-1', 'view-uuid-1');
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toContain('user_id');
  });

  it('REQ 24.8 – propagates DB error on delete', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    await expect(filterService.deleteSavedView('user-1', 'view-1')).rejects.toThrow('DB error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Search Result Sorting  (Requirement 24.11)
// ─────────────────────────────────────────────────────────────────────────────

describe('Search result sorting', () => {
  let resultService: SearchResultService;

  const makeResult = (overrides: Record<string, unknown> = {}) => ({
    entityType: 'client' as const,
    id: 'id-1',
    title: 'Test',
    snippet: '',
    relevanceScore: 0.5,
    ...overrides,
  });

  beforeEach(() => {
    resultService = new SearchResultService();
    jest.clearAllMocks();
  });

  it('REQ 24.11 – sorts by relevance descending', () => {
    const results = [
      makeResult({ id: 'a', relevanceScore: 0.3 }),
      makeResult({ id: 'b', relevanceScore: 0.9 }),
      makeResult({ id: 'c', relevanceScore: 0.6 }),
    ];
    const sorted = resultService.sortResults(results, 'relevance');
    expect(sorted.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('REQ 24.11 – sorts alphabetically by title', () => {
    const results = [
      makeResult({ id: 'a', title: 'Zebra Corp' }),
      makeResult({ id: 'b', title: 'Alpha Ltd' }),
      makeResult({ id: 'c', title: 'Mango Inc' }),
    ];
    const sorted = resultService.sortResults(results, 'alpha');
    expect(sorted.map((r) => r.title)).toEqual(['Alpha Ltd', 'Mango Inc', 'Zebra Corp']);
  });

  it('REQ 24.11 – sorts by amount extracted from snippet', () => {
    const results = [
      makeResult({ id: 'a', snippet: 'Amount: 500.00' }),
      makeResult({ id: 'b', snippet: 'Amount: 1,200.00' }),
      makeResult({ id: 'c', snippet: 'Amount: 300.00' }),
    ];
    const sorted = resultService.sortResults(results, 'amount');
    expect(sorted.map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });

  it('REQ 24.11 – sorts by date (id-based descending)', () => {
    const results = [
      makeResult({ id: '2024-001' }),
      makeResult({ id: '2024-003' }),
      makeResult({ id: '2024-002' }),
    ];
    const sorted = resultService.sortResults(results, 'date');
    expect(sorted[0].id).toBe('2024-003');
  });

  it('REQ 24.11 – does not mutate the original array', () => {
    const results = [
      makeResult({ id: 'a', title: 'Zebra' }),
      makeResult({ id: 'b', title: 'Alpha' }),
    ];
    const originalFirst = results[0].id;
    resultService.sortResults(results, 'alpha');
    expect(results[0].id).toBe(originalFirst);
  });

  it('REQ 24.11 – handles empty results array', () => {
    expect(resultService.sortResults([], 'relevance')).toEqual([]);
  });

  it('REQ 24.11 – handles single result', () => {
    const results = [makeResult({ id: 'only' })];
    const sorted = resultService.sortResults(results, 'alpha');
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe('only');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Result Count and Recent Searches  (Requirements 24.7, 24.9)
// ─────────────────────────────────────────────────────────────────────────────

describe('Result count and recent searches', () => {
  let resultService: SearchResultService;

  beforeEach(() => {
    resultService = new SearchResultService();
    jest.clearAllMocks();
  });

  it('REQ 24.9 – countResults returns total before loading full results', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 87 }], rowCount: 1 });
    const count = await resultService.countResults('test', ['client', 'project'], 'user-1', 'CEO');
    expect(count).toBe(87);
  });

  it('REQ 24.9 – countResults returns 0 for empty query', async () => {
    const count = await resultService.countResults('', ['client'], 'user-1', 'CEO');
    expect(count).toBe(0);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('REQ 24.9 – countResults returns 0 for empty entity types', async () => {
    const count = await resultService.countResults('test', [], 'user-1', 'CEO');
    expect(count).toBe(0);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('REQ 24.7 – saves recent search for user', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    await resultService.saveRecentSearch('user-1', 'nairobi schools');
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const insertSql: string = mockQuery.mock.calls[0][0];
    expect(insertSql).toContain('INSERT INTO recent_searches');
  });

  it('REQ 24.7 – does not save empty query', async () => {
    await resultService.saveRecentSearch('user-1', '');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('REQ 24.7 – trims whitespace before saving', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    await resultService.saveRecentSearch('user-1', '  trimmed  ');
    const params: any[] = mockQuery.mock.calls[0][1];
    expect(params[1]).toBe('trimmed');
  });

  it('REQ 24.7 – enforces max 10 recent searches per user', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    await resultService.saveRecentSearch('user-1', 'query');
    const deleteSql: string = mockQuery.mock.calls[1][0];
    expect(deleteSql).toContain('OFFSET 10');
  });

  it('REQ 24.7 – retrieves recent searches for user', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ query: 'nairobi' }, { query: 'schools kenya' }],
      rowCount: 2,
    } as any);
    const searches = await resultService.getRecentSearches('user-1');
    expect(searches).toEqual(['nairobi', 'schools kenya']);
  });

  it('REQ 24.7 – returns empty array when no recent searches', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
    const searches = await resultService.getRecentSearches('user-1');
    expect(searches).toEqual([]);
  });
});
