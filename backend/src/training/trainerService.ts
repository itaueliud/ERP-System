/**
 * Trainer Service
 * Handles Trainer workflow per spec §4, §7:
 *  - View leads from own agents
 *  - Move leads through conversion
 *  - Modify property placement tier (Trainer-only permission)
 *  - Daily report submission
 *  - View own-country achievements (no revenue)
 */
import { db } from '../database/connection';
import logger from '../utils/logger';

export class TrainerService {
  // ── Trainer dashboard overview ────────────────────────────────────────────
  async getDashboard(trainerId: string) {
    // Get trainer's country
    const trainerResult = await db.query(
      `SELECT u.country, u.region FROM users u WHERE u.id = $1`,
      [trainerId]
    );
    if (!trainerResult.rows.length) throw new Error('Trainer not found');
    const { country } = trainerResult.rows[0];

    // Agents assigned to this trainer
    const agentsResult = await db.query(
      `SELECT COUNT(DISTINCT agent_id) AS agent_count FROM clients WHERE trainer_id = $1`,
      [trainerId]
    );

    // Lead counts from trainer's agents
    const leadsResult = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status NOT IN ('CLOSED_WON')) AS active_leads,
         COUNT(*) FILTER (WHERE status = 'CLOSED_WON') AS converted_this_month,
         COUNT(*) AS total_leads
       FROM clients
       WHERE trainer_id = $1
         AND (status NOT IN ('NEW_LEAD') OR created_at >= NOW() - INTERVAL '30 days')`,
      [trainerId]
    );

    return {
      country,
      agentCount: parseInt(agentsResult.rows[0].agent_count),
      activeLeads: parseInt(leadsResult.rows[0].active_leads),
      convertedThisMonth: parseInt(leadsResult.rows[0].converted_this_month),
      totalLeads: parseInt(leadsResult.rows[0].total_leads),
    };
  }

  // ── Get clients assigned to this trainer ─────────────────────────────────
  async getMyClients(trainerId: string, filters: { status?: string; limit?: number; offset?: number }) {
    const conditions = ['trainer_id = $1'];
    const values: any[] = [trainerId];
    let p = 2;

    if (filters.status) { conditions.push(`status = $${p++}`); values.push(filters.status); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const total = await db.query(`SELECT COUNT(*) FROM clients ${where}`, values);
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    values.push(limit, offset);

    const rows = await db.query(
      `SELECT c.id, c.reference_number, c.name, c.organization_name, c.phone, c.email,
              c.location, c.country, c.industry_category, c.service_description,
              c.selected_services, c.status, c.payment_plan, c.discount_applied,
              c.created_at, c.updated_at,
              u.full_name AS agent_name
       FROM clients c
       LEFT JOIN users u ON u.id = c.agent_id
       ${where}
       ORDER BY c.created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      values
    );

    return { clients: rows.rows, total: parseInt(total.rows[0].count) };
  }

  // ── Move lead to NEGOTIATION ──────────────────────────────────────────────
  async startNegotiation(trainerId: string, clientId: string) {
    await this._assertTrainerOwnsClient(trainerId, clientId);
    const client = await db.query(`SELECT status FROM clients WHERE id = $1`, [clientId]);
    const { status } = client.rows[0];

    if (!['LEAD_ACTIVATED', 'LEAD_QUALIFIED'].includes(status)) {
      throw new Error(`Cannot start negotiation from status: ${status}`);
    }

    await db.query(
      `UPDATE clients SET status = 'NEGOTIATION', updated_at = NOW() WHERE id = $1`,
      [clientId]
    );
    logger.info('Lead moved to NEGOTIATION', { clientId, trainerId });
    return { clientId, status: 'NEGOTIATION' };
  }

  // ── Modify property placement tier (Trainer-only — doc §11) ──────────────
  async modifyPlacementTier(trainerId: string, propertyId: string, newTier: 'TOP' | 'MEDIUM' | 'BASIC') {
    const validTiers = ['TOP', 'MEDIUM', 'BASIC'];
    if (!validTiers.includes(newTier)) throw new Error('Invalid placement tier');

    // Verify property was created by an agent under this trainer
    const result = await db.query(
      `SELECT pl.id, pl.placement_tier, pl.created_by
       FROM property_listings pl
       JOIN clients c ON c.agent_id = pl.created_by
       WHERE pl.id = $1 AND c.trainer_id = $2
       LIMIT 1`,
      [propertyId, trainerId]
    );

    if (!result.rows.length) {
      throw new Error('Property not found or not under your trainer scope');
    }

    await db.query(
      `UPDATE property_listings SET placement_tier = $1, updated_at = NOW() WHERE id = $2`,
      [newTier, propertyId]
    );

    logger.info('Placement tier modified by Trainer', { propertyId, newTier, trainerId });
    return { propertyId, placementTier: newTier };
  }

  // ── View other trainers' achievements in same country (no revenue) ────────
  async getCountryAchievements(trainerId: string) {
    const trainerResult = await db.query(`SELECT country FROM users WHERE id = $1`, [trainerId]);
    if (!trainerResult.rows.length) throw new Error('Trainer not found');
    const { country } = trainerResult.rows[0];

    // Achievements only — no revenue data
    const result = await db.query(
      `SELECT
         u.full_name AS trainer_name,
         COUNT(c.id) AS total_clients,
         COUNT(c.id) FILTER (WHERE c.status = 'CLOSED_WON') AS closed_deals,
         COUNT(c.id) FILTER (WHERE c.status NOT IN ('CLOSED_WON','NEW_LEAD')) AS active_leads
       FROM users u
       JOIN roles r ON r.id = u.role_id AND r.name = 'TRAINER'
       LEFT JOIN clients c ON c.trainer_id = u.id
       WHERE u.country = $1
       GROUP BY u.id, u.full_name
       ORDER BY closed_deals DESC`,
      [country]
    );

    return { country, trainers: result.rows };
  }

  // ── Submit daily report (doc §20 — due before 10 PM) ─────────────────────
  async submitDailyReport(trainerId: string, data: {
    accomplishments: string;
    challenges?: string;
    tomorrowPlan?: string;
    hoursWorked?: number;
  }) {
    const today = new Date().toISOString().split('T')[0];

    const result = await db.query(
      `INSERT INTO daily_reports
         (user_id, report_date, accomplishments, challenges, tomorrow_plan, hours_worked, report_type)
       VALUES ($1, $2, $3, $4, $5, $6, 'DAILY')
       ON CONFLICT (user_id, report_date) DO UPDATE SET
         accomplishments = EXCLUDED.accomplishments,
         challenges = EXCLUDED.challenges,
         tomorrow_plan = EXCLUDED.tomorrow_plan,
         hours_worked = EXCLUDED.hours_worked,
         submitted_at = NOW()
       RETURNING *`,
      [trainerId, today, data.accomplishments, data.challenges || null, data.tomorrowPlan || null, data.hoursWorked || null]
    );

    logger.info('Trainer daily report submitted', { trainerId, date: today });
    return result.rows[0];
  }

  private async _assertTrainerOwnsClient(trainerId: string, clientId: string) {
    const result = await db.query(
      `SELECT id FROM clients WHERE id = $1 AND trainer_id = $2`,
      [clientId, trainerId]
    );
    if (!result.rows.length) throw new Error('Client not found or not assigned to this trainer');
  }
}

export const trainerService = new TrainerService();
export default trainerService;
