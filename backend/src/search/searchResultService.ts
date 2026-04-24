import { db } from '../database/connection';
import logger from '../utils/logger';
import type { EntityType, SearchResult } from './searchService';

export type SortBy = 'relevance' | 'date' | 'amount' | 'alpha';

/**
 * SearchResultService
 * Handles search result operations: fast counting, sorting, and recent search history.
 * Requirements: 24.9-24.11
 */
export class SearchResultService {
  /**
   * Count search results without fetching full data.
   * Fast count query for displaying result count before loading.
   * Requirements: 24.9
   *
   * @param query - Search query string
   * @param entityTypes - Entity types to search
   * @param userId - Authenticated user ID
   * @param role - Authenticated user role
   */
  async countResults(
    query: string,
    entityTypes: EntityType[] = ['client', 'project', 'contract', 'property'],
    userId: string,
    role: string = ''
  ): Promise<number> {
    if (!query || query.trim().length === 0) {
      return 0;
    }

    const tsQuery = this.toTsQuery(query.trim());
    const isAgent = role.toUpperCase() === 'AGENT';

    const subQueries: string[] = [];
    const params: any[] = [tsQuery];
    let paramIdx = 2;

    // ── Clients ──────────────────────────────────────────────────────────────
    if (entityTypes.includes('client')) {
      let agentFilter = '';
      if (isAgent) {
        agentFilter = `AND agent_id = $${paramIdx}`;
        params.push(userId);
        paramIdx++;
      }
      subQueries.push(`
        SELECT COUNT(*) AS count
        FROM clients
        WHERE to_tsvector('english', COALESCE(name,'') || ' ' || COALESCE(email,'') || ' ' || COALESCE(service_description,''))
              @@ to_tsquery('english', $1)
        ${agentFilter}
      `);
    }

    // ── Projects ─────────────────────────────────────────────────────────────
    if (entityTypes.includes('project')) {
      subQueries.push(`
        SELECT COUNT(*) AS count
        FROM projects p
        LEFT JOIN clients c ON c.id = p.client_id
        WHERE to_tsvector('english', COALESCE(p.reference_number,'') || ' ' || COALESCE(c.name,''))
              @@ to_tsquery('english', $1)
      `);
    }

    // ── Contracts ─────────────────────────────────────────────────────────────
    if (entityTypes.includes('contract')) {
      subQueries.push(`
        SELECT COUNT(*) AS count
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
        SELECT COUNT(*) AS count
        FROM property_listings
        WHERE to_tsvector('english', COALESCE(title,'') || ' ' || COALESCE(description,'') || ' ' || COALESCE(location,''))
              @@ to_tsquery('english', $1)
      `);
    }

    if (subQueries.length === 0) {
      return 0;
    }

    const unionQuery = subQueries.join('\nUNION ALL\n');
    const sql = `SELECT SUM(count)::int AS total FROM (${unionQuery}) AS counts`;

    try {
      const result = await db.query<{ total: number }>(sql, params);
      const total = result.rows[0]?.total ?? 0;
      logger.debug('countResults completed', { query, total, entityTypes });
      return total;
    } catch (error) {
      logger.error('countResults query failed', { error, query, entityTypes });
      throw error;
    }
  }

  /**
   * Sort search results in-memory by specified criteria.
   * Requirements: 24.11
   *
   * @param results - Array of search results
   * @param sortBy - Sort criteria
   */
  sortResults(results: SearchResult[], sortBy: SortBy): SearchResult[] {
    const sorted = [...results];

    switch (sortBy) {
      case 'relevance':
        // Already sorted by relevance from database query
        sorted.sort((a, b) => b.relevanceScore - a.relevanceScore);
        break;

      case 'date':
        // Sort by entity ID (contains timestamp-based sequence)
        sorted.sort((a, b) => b.id.localeCompare(a.id));
        break;

      case 'amount':
        // Extract numeric values from snippets if present
        sorted.sort((a, b) => {
          const amountA = this.extractAmount(a.snippet);
          const amountB = this.extractAmount(b.snippet);
          return amountB - amountA;
        });
        break;

      case 'alpha':
        // Sort alphabetically by title
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return sorted;
  }

  /**
   * Save a recent search for a user.
   * Maintains max 10 recent searches per user.
   * Requirements: 24.7
   *
   * @param userId - User ID
   * @param query - Search query string
   */
  async saveRecentSearch(userId: string, query: string): Promise<void> {
    if (!query || query.trim().length === 0) {
      return;
    }

    const trimmedQuery = query.trim();

    try {
      // Insert the new search
      await db.query(
        `INSERT INTO recent_searches (user_id, query) VALUES ($1, $2)`,
        [userId, trimmedQuery]
      );

      // Keep only the 10 most recent searches per user
      await db.query(
        `
        DELETE FROM recent_searches
        WHERE id IN (
          SELECT id FROM recent_searches
          WHERE user_id = $1
          ORDER BY searched_at DESC
          OFFSET 10
        )
        `,
        [userId]
      );

      logger.debug('saveRecentSearch completed', { userId, query: trimmedQuery });
    } catch (error) {
      logger.error('saveRecentSearch failed', { error, userId, query: trimmedQuery });
      throw error;
    }
  }

  /**
   * Get recent searches for a user.
   * Returns up to 10 most recent searches.
   * Requirements: 24.7
   *
   * @param userId - User ID
   */
  async getRecentSearches(userId: string): Promise<string[]> {
    try {
      const result = await db.query<{ query: string }>(
        `
        SELECT query
        FROM recent_searches
        WHERE user_id = $1
        ORDER BY searched_at DESC
        LIMIT 10
        `,
        [userId]
      );

      const queries = result.rows.map((row) => row.query);
      logger.debug('getRecentSearches completed', { userId, count: queries.length });
      return queries;
    } catch (error) {
      logger.error('getRecentSearches failed', { error, userId });
      throw error;
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Convert a plain search query string to a PostgreSQL tsquery expression.
   */
  private toTsQuery(query: string): string {
    const normalized = query
      .trim()
      .replace(/\bAND\b/g, '&')
      .replace(/\bOR\b/g, '|')
      .replace(/\bNOT\b/g, '!')
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => {
        if (['&', '|', '!'].includes(token)) return token;
        const escaped = token.replace(/['"]/g, '').replace(/[^a-zA-Z0-9_]/g, '');
        return escaped ? `${escaped}:*` : null;
      })
      .filter(Boolean)
      .join(' & ');
    return normalized || query.trim();
  }

  /**
   * Extract numeric amount from snippet text.
   */
  private extractAmount(text: string): number {
    const match = text.match(/\d+(?:,\d{3})*(?:\.\d{2})?/);
    return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
  }
}

export const searchResultService = new SearchResultService();
export default searchResultService;
