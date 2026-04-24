import { db } from '../database/connection';
import logger from '../utils/logger';

export type EntityType = 'client' | 'project' | 'contract' | 'property';

export interface SearchResult {
  entityType: EntityType;
  id: string;
  title: string;
  snippet: string;
  relevanceScore: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  query: string;
  durationMs: number;
}

/**
 * Highlight search terms in text using PostgreSQL ts_headline-style markers.
 * Returns text with matched terms wrapped in <mark> tags.
 */
function highlightTerms(text: string, query: string): string {
  if (!text || !query) return text || '';
  const terms = query
    .replace(/['"]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !['and', 'or', 'not'].includes(t.toLowerCase()));
  if (terms.length === 0) return text;
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.replace(pattern, '<mark>$1</mark>');
}

/**
 * Convert a plain search query string to a PostgreSQL tsquery expression.
 * Supports AND (&), OR (|), NOT (!) operators.
 */
function toTsQuery(query: string): string {
  // Replace boolean operators with PostgreSQL equivalents
  const normalized = query
    .trim()
    .replace(/\bAND\b/g, '&')
    .replace(/\bOR\b/g, '|')
    .replace(/\bNOT\b/g, '!')
    // Wrap individual words in prefix-match syntax
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      if (['&', '|', '!'].includes(token)) return token;
      // Escape special characters and add prefix matching
      const escaped = token.replace(/['"]/g, '').replace(/[^a-zA-Z0-9_]/g, '');
      return escaped ? `${escaped}:*` : null;
    })
    .filter(Boolean)
    .join(' & ');
  return normalized || query.trim();
}

/**
 * Search Service
 * Provides full-text search across clients, projects, contracts, and property_listings
 * using PostgreSQL tsvector/tsquery.
 * Requirements: 24.1-24.4
 */
export class SearchService {
  /**
   * Search across entity types with role-based access control.
   * Agents only see their own clients; other roles see all records.
   *
   * @param query     - Search query string
   * @param entityTypes - Entity types to search (defaults to all)
   * @param userId    - Authenticated user ID
   * @param userRole  - Authenticated user role
   * @param page      - Page number (1-based)
   * @param limit     - Results per page
   */
  async search(
    query: string,
    entityTypes: EntityType[] = ['client', 'project', 'contract', 'property'],
    userId: string,
    userRole: string = '',
    page: number = 1,
    limit: number = 50
  ): Promise<SearchResponse> {
    const start = Date.now();

    if (!query || query.trim().length === 0) {
      return { results: [], total: 0, page, limit, query, durationMs: 0 };
    }

    const tsQuery = toTsQuery(query.trim());
    const offset = (page - 1) * limit;
    const isAgent = userRole.toUpperCase() === 'AGENT';

    const subQueries: string[] = [];
    const params: any[] = [tsQuery, limit, offset];
    let paramIdx = 4; // next param index

    // ── Clients ──────────────────────────────────────────────────────────────
    if (entityTypes.includes('client')) {
      let agentFilter = '';
      if (isAgent) {
        agentFilter = `AND agent_id = $${paramIdx}`;
        params.push(userId);
        paramIdx++;
      }
      subQueries.push(`
        SELECT
          'client'::text AS entity_type,
          id::text,
          name AS title,
          COALESCE(service_description, '') AS raw_snippet,
          ts_rank(
            to_tsvector('english', COALESCE(name,'') || ' ' || COALESCE(email,'') || ' ' || COALESCE(service_description,'')),
            to_tsquery('english', $1)
          ) AS relevance_score
        FROM clients
        WHERE to_tsvector('english', COALESCE(name,'') || ' ' || COALESCE(email,'') || ' ' || COALESCE(service_description,''))
              @@ to_tsquery('english', $1)
        ${agentFilter}
      `);
    }

    // ── Projects ─────────────────────────────────────────────────────────────
    if (entityTypes.includes('project')) {
      subQueries.push(`
        SELECT
          'project'::text AS entity_type,
          p.id::text,
          COALESCE(c.name, p.reference_number) AS title,
          COALESCE(p.reference_number, '') AS raw_snippet,
          ts_rank(
            to_tsvector('english', COALESCE(p.reference_number,'') || ' ' || COALESCE(c.name,'')),
            to_tsquery('english', $1)
          ) AS relevance_score
        FROM projects p
        LEFT JOIN clients c ON c.id = p.client_id
        WHERE to_tsvector('english', COALESCE(p.reference_number,'') || ' ' || COALESCE(c.name,''))
              @@ to_tsquery('english', $1)
      `);
    }

    // ── Contracts ─────────────────────────────────────────────────────────────
    if (entityTypes.includes('contract')) {
      subQueries.push(`
        SELECT
          'contract'::text AS entity_type,
          ct.id::text,
          ct.reference_number AS title,
          COALESCE(ct.reference_number, '') AS raw_snippet,
          ts_rank(
            to_tsvector('english', COALESCE(ct.reference_number,'') || ' ' || COALESCE(c.name,'')),
            to_tsquery('english', $1)
          ) AS relevance_score
        FROM contracts ct
        LEFT JOIN projects p ON p.id = ct.project_id
        LEFT JOIN clients c ON c.id = p.client_id
        WHERE to_tsvector('english', COALESCE(ct.reference_number,'') || ' ' || COALESCE(c.name,''))
              @@ to_tsquery('english', $1)
      `);
    }

    // ── Property Listings ─────────────────────────────────────────────────────
    if (entityTypes.includes('property')) {
      subQueries.push(`
        SELECT
          'property'::text AS entity_type,
          id::text,
          title,
          COALESCE(description, '') AS raw_snippet,
          ts_rank(
            to_tsvector('english', COALESCE(title,'') || ' ' || COALESCE(description,'') || ' ' || COALESCE(location,'')),
            to_tsquery('english', $1)
          ) AS relevance_score
        FROM property_listings
        WHERE to_tsvector('english', COALESCE(title,'') || ' ' || COALESCE(description,'') || ' ' || COALESCE(location,''))
              @@ to_tsquery('english', $1)
      `);
    }

    if (subQueries.length === 0) {
      return { results: [], total: 0, page, limit, query, durationMs: 0 };
    }

    const unionQuery = subQueries.join('\nUNION ALL\n');

    const countSql = `SELECT COUNT(*) FROM (${unionQuery}) AS combined`;
    const dataSql = `
      SELECT entity_type, id, title, raw_snippet, relevance_score
      FROM (${unionQuery}) AS combined
      ORDER BY relevance_score DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        db.query<{ count: string }>(countSql, params),
        db.query<{
          entity_type: EntityType;
          id: string;
          title: string;
          raw_snippet: string;
          relevance_score: string;
        }>(dataSql, params),
      ]);

      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);
      const durationMs = Date.now() - start;

      if (durationMs > 500) {
        logger.warn('Search query exceeded 500ms', { query, durationMs, entityTypes });
      }

      const results: SearchResult[] = dataResult.rows.map((row) => ({
        entityType: row.entity_type,
        id: row.id,
        title: highlightTerms(row.title, query),
        snippet: highlightTerms(
          row.raw_snippet.length > 200 ? row.raw_snippet.substring(0, 200) + '…' : row.raw_snippet,
          query
        ),
        relevanceScore: parseFloat(row.relevance_score),
      }));

      logger.debug('Search completed', { query, total, durationMs, entityTypes });

      return { results, total, page, limit, query, durationMs };
    } catch (error) {
      logger.error('Search query failed', { error, query, entityTypes });
      throw error;
    }
  }
}

export const searchService = new SearchService();
export default searchService;
