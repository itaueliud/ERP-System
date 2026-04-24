import { db } from '../database/connection';
import logger from '../utils/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DateRange {
  from?: Date;
  to?: Date;
}

export interface AmountRange {
  min?: number;
  max?: number;
}

/**
 * Input filters for building SQL WHERE clauses.
 * Requirements: 24.3, 24.5
 */
export interface FilterInput {
  dateRange?: DateRange;
  status?: string[];
  country?: string[];
  industryCategory?: string[];
  assignedUser?: string;
  amountRange?: AmountRange;
  /** Boolean operator applied between top-level filter conditions. Defaults to 'AND'. */
  booleanOperator?: 'AND' | 'OR';
}

export interface FilterQuery {
  whereClause: string;
  params: any[];
}

export interface AutocompleteSuggestion {
  value: string;
  label: string;
}

export interface SavedView {
  id: string;
  userId: string;
  name: string;
  filters: FilterInput;
  createdAt: Date;
  updatedAt: Date;
}

// ── Allowed autocomplete fields (whitelist to prevent SQL injection) ───────────

const AUTOCOMPLETE_FIELDS: Record<string, { table: string; column: string; roleFilter?: string }> = {
  status: { table: 'clients', column: 'status' },
  country: { table: 'clients', column: 'country' },
  industry_category: { table: 'clients', column: 'industry_category' },
  assigned_user: { table: 'users', column: 'full_name' },
};

// ── FilterService ─────────────────────────────────────────────────────────────

/**
 * FilterService
 * Builds SQL WHERE clauses from structured filter inputs, provides autocomplete
 * suggestions, and manages saved filter views per user.
 * Requirements: 24.3, 24.5-24.8
 */
export class FilterService {
  /**
   * Build a parameterised SQL WHERE clause from a FilterInput.
   * Supports AND / OR boolean operators between conditions.
   * NOT is expressed by passing negated values (e.g. status: ['!LEAD']).
   *
   * @param filters - Structured filter input
   * @param startParamIndex - Starting $N index for query parameters (default 1)
   * @returns { whereClause, params } ready to append to a SQL query
   */
  buildFilterQuery(filters: FilterInput, startParamIndex: number = 1): FilterQuery {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = startParamIndex;

    const operator = filters.booleanOperator === 'OR' ? ' OR ' : ' AND ';

    // ── Date range ────────────────────────────────────────────────────────────
    if (filters.dateRange) {
      if (filters.dateRange.from) {
        conditions.push(`created_at >= $${idx}`);
        params.push(filters.dateRange.from);
        idx++;
      }
      if (filters.dateRange.to) {
        conditions.push(`created_at <= $${idx}`);
        params.push(filters.dateRange.to);
        idx++;
      }
    }

    // ── Status ────────────────────────────────────────────────────────────────
    if (filters.status && filters.status.length > 0) {
      const positives = filters.status.filter((s) => !s.startsWith('!'));
      const negatives = filters.status.filter((s) => s.startsWith('!')).map((s) => s.slice(1));

      if (positives.length > 0) {
        const placeholders = positives.map(() => `$${idx++}`).join(', ');
        conditions.push(`status IN (${placeholders})`);
        params.push(...positives);
      }
      if (negatives.length > 0) {
        const placeholders = negatives.map(() => `$${idx++}`).join(', ');
        conditions.push(`status NOT IN (${placeholders})`);
        params.push(...negatives);
      }
    }

    // ── Country ───────────────────────────────────────────────────────────────
    if (filters.country && filters.country.length > 0) {
      const placeholders = filters.country.map(() => `$${idx++}`).join(', ');
      conditions.push(`country IN (${placeholders})`);
      params.push(...filters.country);
    }

    // ── Industry category ─────────────────────────────────────────────────────
    if (filters.industryCategory && filters.industryCategory.length > 0) {
      const placeholders = filters.industryCategory.map(() => `$${idx++}`).join(', ');
      conditions.push(`industry_category IN (${placeholders})`);
      params.push(...filters.industryCategory);
    }

    // ── Assigned user ─────────────────────────────────────────────────────────
    if (filters.assignedUser) {
      conditions.push(`agent_id = $${idx}`);
      params.push(filters.assignedUser);
      idx++;
    }

    // ── Amount range ──────────────────────────────────────────────────────────
    if (filters.amountRange) {
      if (filters.amountRange.min !== undefined) {
        conditions.push(`estimated_value >= $${idx}`);
        params.push(filters.amountRange.min);
        idx++;
      }
      if (filters.amountRange.max !== undefined) {
        conditions.push(`estimated_value <= $${idx}`);
        params.push(filters.amountRange.max);
        idx++;
      }
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(operator)}` : '';

    return { whereClause, params };
  }

  /**
   * Return autocomplete suggestions for a given field and prefix.
   * Role-based: agents only see their own data.
   * Requirements: 24.6
   *
   * @param field  - Field name (status, country, industry_category, assigned_user)
   * @param prefix - User-typed prefix to filter suggestions
   * @param userId - Authenticated user ID
   * @param role   - Authenticated user role
   */
  async getSuggestions(
    field: string,
    prefix: string,
    userId: string,
    role: string
  ): Promise<AutocompleteSuggestion[]> {
    const fieldDef = AUTOCOMPLETE_FIELDS[field];
    if (!fieldDef) {
      logger.warn('getSuggestions: unknown field', { field });
      return [];
    }

    const { table, column } = fieldDef;
    const isAgent = role.toUpperCase() === 'AGENT';
    const params: any[] = [`${prefix}%`];
    let agentFilter = '';

    if (isAgent && table === 'clients') {
      agentFilter = `AND agent_id = $2`;
      params.push(userId);
    }

    const sql = `
      SELECT DISTINCT ${column} AS value
      FROM ${table}
      WHERE ${column} ILIKE $1
      ${agentFilter}
      ORDER BY ${column}
      LIMIT 10
    `;

    try {
      const result = await db.query<{ value: string }>(sql, params);
      return result.rows.map((row) => ({ value: row.value, label: row.value }));
    } catch (error) {
      logger.error('getSuggestions query failed', { error, field, prefix });
      throw error;
    }
  }

  /**
   * Save a named filter combination for a user.
   * Requirements: 24.8
   */
  async saveSavedView(userId: string, name: string, filters: FilterInput): Promise<SavedView> {
    const sql = `
      INSERT INTO saved_views (user_id, name, filters)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, name)
      DO UPDATE SET filters = EXCLUDED.filters, updated_at = NOW()
      RETURNING id, user_id, name, filters, created_at, updated_at
    `;

    try {
      const result = await db.query<{
        id: string;
        user_id: string;
        name: string;
        filters: FilterInput;
        created_at: Date;
        updated_at: Date;
      }>(sql, [userId, name, JSON.stringify(filters)]);

      const row = result.rows[0];
      logger.debug('Saved view upserted', { userId, name });
      return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        filters: row.filters,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      logger.error('saveSavedView failed', { error, userId, name });
      throw error;
    }
  }

  /**
   * Retrieve all saved views for a user.
   * Requirements: 24.8
   */
  async getSavedViews(userId: string): Promise<SavedView[]> {
    const sql = `
      SELECT id, user_id, name, filters, created_at, updated_at
      FROM saved_views
      WHERE user_id = $1
      ORDER BY name ASC
    `;

    try {
      const result = await db.query<{
        id: string;
        user_id: string;
        name: string;
        filters: FilterInput;
        created_at: Date;
        updated_at: Date;
      }>(sql, [userId]);

      return result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        filters: row.filters,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      logger.error('getSavedViews failed', { error, userId });
      throw error;
    }
  }

  /**
   * Delete a saved view by ID, scoped to the owning user.
   * Requirements: 24.8
   */
  async deleteSavedView(userId: string, viewId: string): Promise<boolean> {
    const sql = `
      DELETE FROM saved_views
      WHERE id = $1 AND user_id = $2
    `;

    try {
      const result = await db.query(sql, [viewId, userId]);
      const deleted = (result.rowCount ?? 0) > 0;
      logger.debug('deleteSavedView', { userId, viewId, deleted });
      return deleted;
    } catch (error) {
      logger.error('deleteSavedView failed', { error, userId, viewId });
      throw error;
    }
  }
}

export const filterService = new FilterService();
export default filterService;
