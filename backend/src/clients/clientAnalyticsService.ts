/**
 * Client Analytics & Reporting Service
 * Provides conversion funnel, revenue, and activity analytics for clients
 */

import { db } from '../database/connection';
import logger from '../utils/logger';

export interface ConversionFunnelStats {
  pendingCommitment: number;
  lead: number;
  qualifiedLead: number;
  project: number;
  conversionRates: {
    pendingToLead: number;
    leadToQualified: number;
    qualifiedToProject: number;
    overall: number;
  };
}

export interface ClientRevenueStats {
  totalEstimatedValue: number;
  currency: string;
  byIndustry: Array<{ industry: string; count: number; estimatedValue: number }>;
  byPriority: Array<{ priority: string; count: number; estimatedValue: number }>;
  byAgent: Array<{ agentId: string; agentName: string; count: number; estimatedValue: number }>;
}

export interface ClientActivityStats {
  totalClients: number;
  newThisMonth: number;
  newThisWeek: number;
  avgCommunicationsPerClient: number;
  topIndustries: Array<{ industry: string; count: number }>;
  clientsByCountry: Array<{ country: string; count: number }>;
}

export interface ClientAnalyticsDashboard {
  funnel: ConversionFunnelStats;
  revenue: ClientRevenueStats;
  activity: ClientActivityStats;
  generatedAt: Date;
}

export class ClientAnalyticsService {
  /**
   * Get full analytics dashboard for clients
   */
  async getDashboard(agentId?: string): Promise<ClientAnalyticsDashboard> {
    const [funnel, revenue, activity] = await Promise.all([
      this.getConversionFunnel(agentId),
      this.getRevenueStats(agentId),
      this.getActivityStats(agentId),
    ]);

    return { funnel, revenue, activity, generatedAt: new Date() };
  }

  /**
   * Get conversion funnel statistics
   */
  async getConversionFunnel(agentId?: string): Promise<ConversionFunnelStats> {
    try {
      const whereClause = agentId ? 'WHERE agent_id = $1' : '';
      const params = agentId ? [agentId] : [];

      const result = await db.query(
        `SELECT status, COUNT(*) as count
         FROM clients
         ${whereClause}
         GROUP BY status`,
        params
      );

      const counts: Record<string, number> = {
        PENDING_COMMITMENT: 0,
        LEAD: 0,
        QUALIFIED_LEAD: 0,
        PROJECT: 0,
      };

      for (const row of result.rows) {
        counts[row.status] = parseInt(row.count);
      }

      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

      return {
        pendingCommitment: counts.PENDING_COMMITMENT,
        lead: counts.LEAD,
        qualifiedLead: counts.QUALIFIED_LEAD,
        project: counts.PROJECT,
        conversionRates: {
          pendingToLead: pct(counts.LEAD, counts.PENDING_COMMITMENT + counts.LEAD),
          leadToQualified: pct(counts.QUALIFIED_LEAD, counts.LEAD + counts.QUALIFIED_LEAD),
          qualifiedToProject: pct(counts.PROJECT, counts.QUALIFIED_LEAD + counts.PROJECT),
          overall: pct(counts.PROJECT, total),
        },
      };
    } catch (error) {
      logger.error('Failed to get conversion funnel', { error, agentId });
      throw error;
    }
  }

  /**
   * Get revenue statistics — default currency KES
   */
  async getRevenueStats(agentId?: string): Promise<ClientRevenueStats> {
    try {
      const agentFilter = agentId ? 'AND c.agent_id = $1' : '';
      const params = agentId ? [agentId] : [];

      const [totalResult, byIndustry, byPriority, byAgent] = await Promise.all([
        db.query(
          `SELECT COALESCE(SUM(estimated_value), 0) as total FROM clients c WHERE 1=1 ${agentFilter}`,
          params
        ),
        db.query(
          `SELECT industry_category as industry, COUNT(*) as count,
                  COALESCE(SUM(estimated_value), 0) as estimated_value
           FROM clients c WHERE 1=1 ${agentFilter}
           GROUP BY industry_category ORDER BY estimated_value DESC`,
          params
        ),
        db.query(
          `SELECT priority, COUNT(*) as count,
                  COALESCE(SUM(estimated_value), 0) as estimated_value
           FROM clients c WHERE priority IS NOT NULL ${agentFilter}
           GROUP BY priority ORDER BY estimated_value DESC`,
          params
        ),
        db.query(
          `SELECT c.agent_id, u.full_name as agent_name, COUNT(*) as count,
                  COALESCE(SUM(c.estimated_value), 0) as estimated_value
           FROM clients c
           JOIN users u ON c.agent_id = u.id
           WHERE 1=1 ${agentFilter}
           GROUP BY c.agent_id, u.full_name ORDER BY estimated_value DESC LIMIT 10`,
          params
        ),
      ]);

      return {
        totalEstimatedValue: parseFloat(totalResult.rows[0].total),
        currency: 'KES',
        byIndustry: byIndustry.rows.map((r) => ({
          industry: r.industry,
          count: parseInt(r.count),
          estimatedValue: parseFloat(r.estimated_value),
        })),
        byPriority: byPriority.rows.map((r) => ({
          priority: r.priority,
          count: parseInt(r.count),
          estimatedValue: parseFloat(r.estimated_value),
        })),
        byAgent: byAgent.rows.map((r) => ({
          agentId: r.agent_id,
          agentName: r.agent_name,
          count: parseInt(r.count),
          estimatedValue: parseFloat(r.estimated_value),
        })),
      };
    } catch (error) {
      logger.error('Failed to get revenue stats', { error, agentId });
      throw error;
    }
  }

  /**
   * Get activity statistics
   */
  async getActivityStats(agentId?: string): Promise<ClientActivityStats> {
    try {
      const agentFilter = agentId ? 'WHERE agent_id = $1' : '';
      const params = agentId ? [agentId] : [];

      const [totals, topIndustries, byCountry] = await Promise.all([
        db.query(
          `SELECT
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW())) as new_this_month,
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as new_this_week
           FROM clients ${agentFilter}`,
          params
        ),
        db.query(
          `SELECT industry_category as industry, COUNT(*) as count
           FROM clients ${agentFilter}
           GROUP BY industry_category ORDER BY count DESC LIMIT 5`,
          params
        ),
        db.query(
          `SELECT country, COUNT(*) as count
           FROM clients ${agentFilter}
           GROUP BY country ORDER BY count DESC LIMIT 10`,
          params
        ),
      ]);

      // Avg communications per client
      const commResult = await db.query(
        `SELECT COALESCE(AVG(comm_count), 0) as avg
         FROM (
           SELECT client_id, COUNT(*) as comm_count
           FROM communications
           GROUP BY client_id
         ) sub`
      );

      return {
        totalClients: parseInt(totals.rows[0].total),
        newThisMonth: parseInt(totals.rows[0].new_this_month),
        newThisWeek: parseInt(totals.rows[0].new_this_week),
        avgCommunicationsPerClient: parseFloat(commResult.rows[0].avg),
        topIndustries: topIndustries.rows.map((r) => ({
          industry: r.industry,
          count: parseInt(r.count),
        })),
        clientsByCountry: byCountry.rows.map((r) => ({
          country: r.country,
          count: parseInt(r.count),
        })),
      };
    } catch (error) {
      logger.error('Failed to get activity stats', { error, agentId });
      throw error;
    }
  }
}

export const clientAnalyticsService = new ClientAnalyticsService();
export default clientAnalyticsService;
