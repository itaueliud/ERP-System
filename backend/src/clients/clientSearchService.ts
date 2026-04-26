/**
 * Advanced Client Search & Filtering Service
 */

import { db } from '../database/connection';
import logger from '../utils/logger';
import { ClientStatus, IndustryCategory, Priority } from './clientService';

export interface ClientSearchFilters {
  query?: string;                    // Full-text search across name, email, phone, serviceDescription
  status?: ClientStatus | ClientStatus[];
  industryCategory?: IndustryCategory | IndustryCategory[];
  priority?: Priority | Priority[];
  country?: string | string[];
  agentId?: string;
  estimatedValueMin?: number;
  estimatedValueMax?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  expectedStartAfter?: Date;
  expectedStartBefore?: Date;
  hasPayments?: boolean;
  lastCommunicationAfter?: Date;
  sortBy?: 'createdAt' | 'name' | 'estimatedValue' | 'lastCommunication' | 'expectedStartDate';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface ClientSearchResult {
  id: string;
  referenceNumber: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  industryCategory: string;
  status: string;
  priority?: string;
  estimatedValue?: number;
  expectedStartDate?: Date;
  agentId: string;
  lastCommunicationDate?: Date;
  createdAt: Date;
}

export interface ClientSearchResponse {
  clients: ClientSearchResult[];
  total: number;
  limit: number;
  offset: number;
}

export class ClientSearchService {
  async search(filters: ClientSearchFilters): Promise<ClientSearchResponse> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let p = 1;

      if (filters.agentId) {
        conditions.push(`c.agent_id = $${p++}`);
        values.push(filters.agentId);
      }

      if (filters.query) {
        conditions.push(
          `(c.name ILIKE $${p} OR c.email ILIKE $${p} OR c.phone ILIKE $${p} OR c.service_description ILIKE $${p} OR c.reference_number ILIKE $${p})`
        );
        values.push(`%${filters.query}%`);
        p++;
      }

      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        conditions.push(`c.status = ANY($${p++}::text[])`);
        values.push(statuses);
      }

      if (filters.industryCategory) {
        const cats = Array.isArray(filters.industryCategory) ? filters.industryCategory : [filters.industryCategory];
        conditions.push(`c.industry_category = ANY($${p++}::text[])`);
        values.push(cats);
      }

      if (filters.priority) {
        const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority];
        conditions.push(`c.priority = ANY($${p++}::text[])`);
        values.push(priorities);
      }

      if (filters.country) {
        const countries = Array.isArray(filters.country) ? filters.country : [filters.country];
        conditions.push(`c.country = ANY($${p++}::text[])`);
        values.push(countries);
      }

      if (filters.estimatedValueMin !== undefined) {
        conditions.push(`c.estimated_value >= $${p++}`);
        values.push(filters.estimatedValueMin);
      }

      if (filters.estimatedValueMax !== undefined) {
        conditions.push(`c.estimated_value <= $${p++}`);
        values.push(filters.estimatedValueMax);
      }

      if (filters.createdAfter) {
        conditions.push(`c.created_at >= $${p++}`);
        values.push(filters.createdAfter);
      }

      if (filters.createdBefore) {
        conditions.push(`c.created_at <= $${p++}`);
        values.push(filters.createdBefore);
      }

      if (filters.expectedStartAfter) {
        conditions.push(`c.expected_start_date >= $${p++}`);
        values.push(filters.expectedStartAfter);
      }

      if (filters.expectedStartBefore) {
        conditions.push(`c.expected_start_date <= $${p++}`);
        values.push(filters.expectedStartBefore);
      }

      if (filters.hasPayments !== undefined) {
        if (filters.hasPayments) {
          conditions.push(`EXISTS (SELECT 1 FROM payments pm WHERE pm.client_id = c.id)`);
        } else {
          conditions.push(`NOT EXISTS (SELECT 1 FROM payments pm WHERE pm.client_id = c.id)`);
        }
      }

      if (filters.lastCommunicationAfter) {
        conditions.push(
          `EXISTS (SELECT 1 FROM communications cm WHERE cm.client_id = c.id AND cm.communication_date >= $${p++})`
        );
        values.push(filters.lastCommunicationAfter);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Sort
      const sortMap: Record<string, string> = {
        createdAt: 'c.created_at',
        name: 'c.name',
        estimatedValue: 'c.estimated_value',
        lastCommunication: 'last_comm',
        expectedStartDate: 'c.expected_start_date',
      };
      const sortCol = sortMap[filters.sortBy ?? 'createdAt'] ?? 'c.created_at';
      const sortDir = filters.sortOrder ?? 'DESC';

      const limit = filters.limit ?? 50;
      const offset = filters.offset ?? 0;

      const countResult = await db.query(
        `SELECT COUNT(*) FROM clients c ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count);

      const dataResult = await db.query(
        `SELECT c.id, c.reference_number, c.name, c.email, c.phone, c.country,
                c.industry_category, c.status, c.priority, c.estimated_value,
                c.expected_start_date, c.agent_id, c.created_at,
                (SELECT MAX(cm.communication_date) FROM communications cm WHERE cm.client_id = c.id) as last_comm
         FROM clients c
         ${whereClause}
         ORDER BY ${sortCol} ${sortDir} NULLS LAST
         LIMIT $${p} OFFSET $${p + 1}`,
        [...values, limit, offset]
      );

      const clients: ClientSearchResult[] = dataResult.rows.map((r) => ({
        id: r.id,
        referenceNumber: r.reference_number,
        name: r.name,
        email: r.email,
        phone: r.phone,
        country: r.country,
        industryCategory: r.industry_category,
        status: r.status,
        priority: r.priority,
        estimatedValue: r.estimated_value ? parseFloat(r.estimated_value) : undefined,
        expectedStartDate: r.expected_start_date,
        agentId: r.agent_id,
        lastCommunicationDate: r.last_comm,
        createdAt: r.created_at,
      }));

      return { clients, total, limit, offset };
    } catch (error) {
      logger.error('Client search failed', { error, filters });
      throw error;
    }
  }
}

export const clientSearchService = new ClientSearchService();
export default clientSearchService;
