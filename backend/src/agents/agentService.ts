/**
 * Agent Service
 * Handles the full Agent workflow per spec §7:
 *  - Client capture form (Step 1)
 *  - Product/service selection (Step 2)
 *  - Commitment payment via Daraja API STK Push (Step 3)
 *  - Lead status lifecycle management
 *  - Agent dashboard metrics (personal data only — enforced at API level)
 */
import { db } from '../database/connection';
import logger from '../utils/logger';
import { darajaClient } from '../services/daraja';

// ── Payment plans (doc §7 Step 3) ──────────────────────────────────────────
export enum PaymentPlan {
  FULL_PAYMENT = 'FULL_PAYMENT',   // KSh 500 → Lead Activated
  FIFTY_FIFTY  = 'FIFTY_FIFTY',    // KSh 750 → Lead Qualified
  MILESTONE    = 'MILESTONE',      // KSh 1,000 → Lead Qualified
}

export interface ClientCaptureInput {
  // Step 1 — Client Information Form (doc §7)
  clientName: string;
  organizationName?: string;
  phoneNumber: string;
  email: string;
  location: string;          // Town / Area (country inherited from Trainer)
  notes?: string;
  agentId: string;
}

export interface ServiceSelectionInput {
  clientId: string;
  productType: 'SYSTEM' | 'PLOTCONNECT';
  // For SYSTEM: category A-G + service keys
  industryCategory?: string;
  selectedServices?: string[];
  // For PLOTCONNECT: handled by property module
}

export interface CommitmentPaymentInput {
  clientId: string;
  paymentPlan: PaymentPlan;
  mpesaPhone: string;
  agentId: string;
}

export interface AgentDashboardMetrics {
  clientsAdded: number;
  activeLeads: number;
  closedDeals: number;
  leadStatusBreakdown: Record<string, number>;
}

export class AgentService {
  // ── Step 1: Client Capture ────────────────────────────────────────────────
  async captureClient(input: ClientCaptureInput) {
    // Verify agent exists and is active
    const agentResult = await db.query(
      `SELECT u.id, u.country FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND r.name = 'AGENT' AND u.is_active = TRUE`,
      [input.agentId]
    );
    if (agentResult.rows.length === 0) throw new Error('Agent not found or inactive');

    const agentCountry = agentResult.rows[0].country;

    // Generate reference number
    const year = new Date().getFullYear();
    const prefix = `TST-${year}-`;
    const lastRef = await db.query(
      `SELECT reference_number FROM clients WHERE reference_number LIKE $1 ORDER BY reference_number DESC LIMIT 1`,
      [`${prefix}%`]
    );
    let seq = 1;
    if (lastRef.rows.length > 0) {
      seq = parseInt(lastRef.rows[0].reference_number.split('-')[2]) + 1;
    }
    const referenceNumber = `${prefix}${seq.toString().padStart(6, '0')}`;

    const result = await db.query(
      `INSERT INTO clients
         (reference_number, name, organization_name, phone, email, location, country,
          notes, status, agent_id, industry_category, service_description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'NEW_LEAD',$9,'SCHOOLS','Pending service selection')
       RETURNING *`,
      [
        referenceNumber,
        input.clientName,
        input.organizationName || null,
        input.phoneNumber,
        input.email,
        input.location,
        agentCountry,   // inherited from agent's country
        input.notes || null,
        input.agentId,
      ]
    );

    logger.info('Agent captured new client', { clientId: result.rows[0].id, agentId: input.agentId });
    return result.rows[0];
  }

  // ── Step 2: Product / Service Selection ──────────────────────────────────
  async selectServices(input: ServiceSelectionInput) {
    const client = await this._getClientForAgent(input.clientId);
    if (client.status !== 'NEW_LEAD') throw new Error('Service selection only allowed on NEW_LEAD');

    if (input.productType === 'SYSTEM') {
      if (!input.industryCategory || !input.selectedServices?.length) {
        throw new Error('industryCategory and selectedServices are required for SYSTEM product');
      }

      // Validate services exist in catalogue
      const svcResult = await db.query(
        `SELECT service_key, service_name, base_amount FROM service_catalogue
         WHERE service_key = ANY($1) AND is_active = TRUE`,
        [input.selectedServices]
      );
      if (svcResult.rows.length !== input.selectedServices.length) {
        throw new Error('One or more selected services are invalid');
      }

      // Calculate discount (doc §8: 10% if >1 service from same category)
      const discountApplied = input.selectedServices.length > 1;
      const serviceDesc = svcResult.rows.map((r: any) => r.service_name).join(', ');

      await db.query(
        `UPDATE clients SET
           industry_category = $1,
           selected_services = $2,
           service_description = $3,
           discount_applied = $4,
           status = 'CONVERTED',
           updated_at = NOW()
         WHERE id = $5`,
        [
          input.industryCategory,
          JSON.stringify(input.selectedServices),
          serviceDesc,
          discountApplied,
          input.clientId,
        ]
      );
    } else {
      // PLOTCONNECT — just mark converted, property form handled separately
      await db.query(
        `UPDATE clients SET
           industry_category = 'REAL_ESTATE',
           service_description = 'TST PlotConnect Property Listing',
           status = 'CONVERTED',
           updated_at = NOW()
         WHERE id = $1`,
        [input.clientId]
      );
    }

    logger.info('Client services selected', { clientId: input.clientId, productType: input.productType });
    return this._getClientForAgent(input.clientId);
  }

  // ── Step 3: Commitment Payment via Daraja STK Push ──────────────────────────
  async initiateCommitmentPayment(input: CommitmentPaymentInput) {
    const client = await this._getClientForAgent(input.clientId);
    if (client.status !== 'CONVERTED') {
      throw new Error('Commitment payment only allowed after service selection (CONVERTED status)');
    }

    const amtResult = await db.query(
      `SELECT amount, currency FROM commitment_amounts WHERE payment_plan = $1`,
      [input.paymentPlan]
    );
    if (amtResult.rows.length === 0) throw new Error('Invalid payment plan');
    const { amount, currency } = amtResult.rows[0];

    const reference = `COMMIT-${input.clientId}-${Date.now()}`;

    // Trigger Daraja STK Push (doc §7: commitment payments via M-Pesa only)
    const darajaResponse = await darajaClient.initiateMpesaPayment({
      phoneNumber: input.mpesaPhone,
      amount: parseFloat(amount),
      accountReference: reference,
      transactionDesc: `TST Commitment Payment - ${input.paymentPlan}`,
    });

    // Record payment
    await db.query(
      `INSERT INTO payments (transaction_id, amount, currency, payment_method, status, client_id)
       VALUES ($1,$2,$3,'MPESA',$4,$5)`,
      [
        darajaResponse.transactionId || darajaResponse.requestId,
        amount,
        currency,
        darajaResponse.status === 'INITIATED' ? 'PENDING' : 'FAILED',
        input.clientId,
      ]
    );

    await db.query(
      `UPDATE clients SET payment_plan = $1, commitment_amount = $2, updated_at = NOW() WHERE id = $3`,
      [input.paymentPlan, amount, input.clientId]
    );

    logger.info('Commitment payment initiated', {
      clientId: input.clientId,
      plan: input.paymentPlan,
      transactionId: darajaResponse.transactionId,
    });

    return {
      transactionId: darajaResponse.transactionId || darajaResponse.requestId,
      amount,
      currency,
      paymentPlan: input.paymentPlan,
      status: darajaResponse.status,
    };
  }

  // ── Called by Daraja webhook when commitment payment confirmed ────────────
  async confirmCommitmentPayment(clientId: string, transactionId: string) {
    const client = await db.query(`SELECT * FROM clients WHERE id = $1`, [clientId]);
    if (client.rows.length === 0) throw new Error('Client not found');

    const { payment_plan } = client.rows[0];

    // Update payment record
    await db.query(
      `UPDATE payments SET status = 'COMPLETED' WHERE transaction_id = $1`,
      [transactionId]
    );

    // Update client status per payment plan (doc §7 Step 3)
    const newStatus = payment_plan === 'FULL_PAYMENT' ? 'LEAD_ACTIVATED' : 'LEAD_QUALIFIED';
    await db.query(
      `UPDATE clients SET
         status = $1,
         commitment_transaction_id = $2,
         updated_at = NOW()
       WHERE id = $3`,
      [newStatus, transactionId, clientId]
    );

    logger.info('Commitment payment confirmed, lead status updated', {
      clientId,
      transactionId,
      newStatus,
    });

    return newStatus;
  }

  // ── Agent Dashboard Metrics (personal data only — doc §6 Portal 6) ────────
  async getDashboardMetrics(agentId: string): Promise<AgentDashboardMetrics> {
    const result = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE TRUE) AS clients_added,
         COUNT(*) FILTER (WHERE status NOT IN ('CLOSED_WON')) AS active_leads,
         COUNT(*) FILTER (WHERE status = 'CLOSED_WON') AS closed_deals,
         COUNT(*) FILTER (WHERE status = 'NEW_LEAD') AS new_lead,
         COUNT(*) FILTER (WHERE status = 'CONVERTED') AS converted,
         COUNT(*) FILTER (WHERE status = 'LEAD_ACTIVATED') AS lead_activated,
         COUNT(*) FILTER (WHERE status = 'LEAD_QUALIFIED') AS lead_qualified,
         COUNT(*) FILTER (WHERE status = 'NEGOTIATION') AS negotiation,
         COUNT(*) FILTER (WHERE status = 'CLOSED_WON') AS closed_won
       FROM clients WHERE agent_id = $1`,
      [agentId]
    );

    const row = result.rows[0];
    return {
      clientsAdded: parseInt(row.clients_added),
      activeLeads: parseInt(row.active_leads),
      closedDeals: parseInt(row.closed_deals),
      leadStatusBreakdown: {
        NEW_LEAD: parseInt(row.new_lead),
        CONVERTED: parseInt(row.converted),
        LEAD_ACTIVATED: parseInt(row.lead_activated),
        LEAD_QUALIFIED: parseInt(row.lead_qualified),
        NEGOTIATION: parseInt(row.negotiation),
        CLOSED_WON: parseInt(row.closed_won),
      },
    };
  }

  // ── Agent's own client list (doc §6: personal data only) ─────────────────
  async getMyClients(agentId: string, filters: { status?: string; limit?: number; offset?: number }) {
    const conditions = ['agent_id = $1'];
    const values: any[] = [agentId];
    let p = 2;

    if (filters.status) { conditions.push(`status = $${p++}`); values.push(filters.status); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const total = await db.query(`SELECT COUNT(*) FROM clients ${where}`, values);
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    values.push(limit, offset);

    const rows = await db.query(
      `SELECT id, reference_number, name, organization_name, phone, email, location,
              industry_category, selected_services, service_description, status,
              payment_plan, commitment_amount, discount_applied, created_at, updated_at
       FROM clients ${where}
       ORDER BY created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      values
    );

    return { clients: rows.rows, total: parseInt(total.rows[0].count) };
  }

  private async _getClientForAgent(clientId: string) {
    const result = await db.query(`SELECT * FROM clients WHERE id = $1`, [clientId]);
    if (result.rows.length === 0) throw new Error('Client not found');
    return result.rows[0];
  }
}

export const agentService = new AgentService();
export default agentService;
