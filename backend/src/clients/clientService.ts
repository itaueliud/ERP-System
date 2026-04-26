import { db } from '../database/connection';
import logger from '../utils/logger';
import { realtimeEvents } from '../realtime/realtimeEvents';

export interface CreateClientInput {
  name: string;
  email: string;
  phone: string;
  country: string;
  industryCategory: IndustryCategory;
  serviceDescription: string;
  agentId: string;
  paymentPlan?: string;
}

export interface UpdateClientInput {
  name?: string;
  email?: string;
  phone?: string;
  country?: string;
  industryCategory?: IndustryCategory;
  serviceDescription?: string;
  estimatedValue?: number;
  priority?: Priority;
  expectedStartDate?: Date;
}

export interface Client {
  id: string;
  referenceNumber: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  industryCategory: IndustryCategory;
  serviceDescription: string;
  status: ClientStatus;
  agentId: string;
  estimatedValue?: number;
  priority?: Priority;
  expectedStartDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum ClientStatus {
  // Doc §10 Lead Status Table — exact status names from spec
  NEW_LEAD        = 'NEW_LEAD',         // Agent submits client information form
  CONVERTED       = 'CONVERTED',        // Agent selects product and service
  LEAD_ACTIVATED  = 'LEAD_ACTIVATED',   // Commitment payment confirmed (Full Payment plan)
  LEAD_QUALIFIED  = 'LEAD_QUALIFIED',   // Commitment payment confirmed (50/50 or Milestone plan)
  NEGOTIATION     = 'NEGOTIATION',      // Trainer in active engagement with client
  CLOSED_WON      = 'CLOSED_WON',       // Full deposit payment received → becomes a Project
}

export enum IndustryCategory {
  SCHOOLS = 'SCHOOLS',
  CHURCHES = 'CHURCHES',
  HOTELS = 'HOTELS',
  HOSPITALS = 'HOSPITALS',
  COMPANIES = 'COMPANIES',
  REAL_ESTATE = 'REAL_ESTATE',
  SHOPS = 'SHOPS',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/**
 * Client Management Service
 * Handles client CRUD operations, validation, and reference number generation
 * Requirements: 4.1-4.12, 19.1-19.10
 */
export class ClientService {
  private async generateReferenceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `TST-${year}-`;
    const result = await db.query(
      `SELECT reference_number FROM clients WHERE reference_number LIKE $1 ORDER BY reference_number DESC LIMIT 1`,
      [`${prefix}%`]
    );
    let sequence = 1;
    if (result.rows.length > 0) {
      const lastSequence = parseInt(result.rows[0].reference_number.split('-')[2]);
      sequence = lastSequence + 1;
    }
    return `${prefix}${sequence.toString().padStart(6, '0')}`;
  }

  private async validateCountry(country: string): Promise<boolean> {
    // Check exact match first, then case-insensitive
    const result = await db.query(
      'SELECT COUNT(*) FROM countries WHERE LOWER(name) = LOWER($1)', [country]
    );
    return parseInt(result.rows[0].count) > 0;
  }

  private validateIndustryCategory(category: string): boolean {
    return Object.values(IndustryCategory).includes(category as IndustryCategory);
  }

  /** Create new client — status starts as NEW_LEAD (doc §10) */
  async createClient(input: CreateClientInput): Promise<Client> {
    try {
      const isValidCountry = await this.validateCountry(input.country);
      if (!isValidCountry) {
        // Log warning but don't block — country may be set from agent profile
        logger.warn('Client country not in countries table', { country: input.country });
      }
      if (!this.validateIndustryCategory(input.industryCategory)) throw new Error('Invalid industry category.');
      const agentResult = await db.query('SELECT id FROM users WHERE id = $1', [input.agentId]);
      if (agentResult.rows.length === 0) throw new Error('Agent not found');
      const referenceNumber = await this.generateReferenceNumber();
      const result = await db.query(
        `INSERT INTO clients (reference_number, name, email, phone, country, industry_category, service_description, status, agent_id, payment_plan)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, reference_number, name, email, phone, country, industry_category, service_description, status, agent_id, estimated_value, priority, expected_start_date, created_at, updated_at`,
        [referenceNumber, input.name, input.email, input.phone, input.country, input.industryCategory, input.serviceDescription, ClientStatus.NEW_LEAD, input.agentId, input.paymentPlan || null]
      );
      const client = this.mapClientFromDb(result.rows[0]);
      logger.info('Client created', { clientId: client.id, referenceNumber, agentId: input.agentId });
      realtimeEvents.publish('client:created', { clientId: client.id, agentId: input.agentId });
      return client;
    } catch (error) { logger.error('Failed to create client', { error, input }); throw error; }
  }

  /** Update client — only while NEW_LEAD (doc §10) */
  async updateClient(clientId: string, agentId: string, updates: UpdateClientInput): Promise<Client> {
    try {
      const currentClient = await this.getClient(clientId);
      if (!currentClient) throw new Error('Client not found');
      if (currentClient.agentId !== agentId) throw new Error('Unauthorized: You can only update your own clients');
      if (currentClient.status !== ClientStatus.NEW_LEAD) throw new Error('Client can only be updated while status is NEW_LEAD');
      if (updates.country) {
        const valid = await this.validateCountry(updates.country);
        if (!valid) throw new Error('Invalid country.');
      }
      if (updates.industryCategory && !this.validateIndustryCategory(updates.industryCategory)) throw new Error('Invalid industry category.');
      const fields: string[] = [];
      const values: any[] = [];
      let p = 1;
      if (updates.name !== undefined) { fields.push(`name = $${p++}`); values.push(updates.name); }
      if (updates.email !== undefined) { fields.push(`email = $${p++}`); values.push(updates.email); }
      if (updates.phone !== undefined) { fields.push(`phone = $${p++}`); values.push(updates.phone); }
      if (updates.country !== undefined) { fields.push(`country = $${p++}`); values.push(updates.country); }
      if (updates.industryCategory !== undefined) { fields.push(`industry_category = $${p++}`); values.push(updates.industryCategory); }
      if (updates.serviceDescription !== undefined) { fields.push(`service_description = $${p++}`); values.push(updates.serviceDescription); }
      if (updates.estimatedValue !== undefined) { fields.push(`estimated_value = $${p++}`); values.push(updates.estimatedValue); }
      if (updates.priority !== undefined) { fields.push(`priority = $${p++}`); values.push(updates.priority); }
      if (updates.expectedStartDate !== undefined) { fields.push(`expected_start_date = $${p++}`); values.push(updates.expectedStartDate); }
      if (fields.length === 0) throw new Error('No fields to update');
      fields.push(`updated_at = NOW()`);
      values.push(clientId);
      const result = await db.query(
        `UPDATE clients SET ${fields.join(', ')} WHERE id = $${p}
         RETURNING id, reference_number, name, email, phone, country, industry_category, service_description, status, agent_id, estimated_value, priority, expected_start_date, created_at, updated_at`,
        values
      );
      if (result.rows.length === 0) throw new Error('Client not found');
      const updated = this.mapClientFromDb(result.rows[0]);
      realtimeEvents.publish('client:updated', { clientId });
      return updated;
    } catch (error) { logger.error('Failed to update client', { error, clientId }); throw error; }
  }

  async getClient(clientId: string): Promise<Client | null> {
    try {
      const result = await db.query(
        `SELECT id, reference_number, name, email, phone, country, industry_category, service_description, status, agent_id, estimated_value, priority, expected_start_date, created_at, updated_at FROM clients WHERE id = $1`,
        [clientId]
      );
      if (result.rows.length === 0) return null;
      return this.mapClientFromDb(result.rows[0]);
    } catch (error) { logger.error('Failed to get client', { error, clientId }); throw error; }
  }

  async listAllClients(filters: { search?: string; limit?: number; offset?: number } = {}): Promise<{ clients: any[]; total: number }> {
      const conditions: string[] = [];
      const values: any[] = [];
      let p = 1;
      if (filters.search) {
        conditions.push(`(c.name ILIKE $${p} OR c.email ILIKE $${p} OR c.phone ILIKE $${p})`);
        values.push(`%${filters.search}%`);
        p++;
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const countResult = await db.query(`SELECT COUNT(*) FROM clients c ${where}`, values);
      const total = parseInt(countResult.rows[0].count);
      const limit = filters.limit || 200;
      const offset = filters.offset || 0;
      values.push(limit, offset);
      const result = await db.query(
        `SELECT c.id, c.reference_number, c.name, c.email, c.phone, c.country,
                c.industry_category, c.service_description, c.status, c.agent_id,
                c.estimated_value, c.priority, c.expected_start_date, c.created_at, c.updated_at,
                u.full_name as agent_name
         FROM clients c
         LEFT JOIN users u ON u.id = c.agent_id
         ${where}
         ORDER BY c.created_at DESC
         LIMIT $${p} OFFSET $${p + 1}`,
        values
      );
      return {
        clients: result.rows.map(r => ({ ...this.mapClientFromDb(r), agentName: r.agent_name })),
        total,
      };
    }

  async listClientsForAgent(agentId: string, filters: { status?: ClientStatus; country?: string; industryCategory?: IndustryCategory; search?: string; limit?: number; offset?: number; }): Promise<{ clients: Client[]; total: number }> {
    try {
      const conditions: string[] = ['agent_id = $1'];
      const values: any[] = [agentId];
      let p = 2;
      if (filters.status) { conditions.push(`status = $${p++}`); values.push(filters.status); }
      if (filters.country) { conditions.push(`country = $${p++}`); values.push(filters.country); }
      if (filters.industryCategory) { conditions.push(`industry_category = $${p++}`); values.push(filters.industryCategory); }
      if (filters.search) { conditions.push(`(name ILIKE $${p} OR email ILIKE $${p} OR phone ILIKE $${p})`); values.push(`%${filters.search}%`); p++; }
      const where = `WHERE ${conditions.join(' AND ')}`;
      const countResult = await db.query(`SELECT COUNT(*) FROM clients ${where}`, values);
      const total = parseInt(countResult.rows[0].count);
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;
      values.push(limit, offset);
      const result = await db.query(
        `SELECT id, reference_number, name, email, phone, country, industry_category, service_description, status, agent_id, estimated_value, priority, expected_start_date, created_at, updated_at FROM clients ${where} ORDER BY created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
        values
      );
      return { clients: result.rows.map(r => this.mapClientFromDb(r)), total };
    } catch (error) { logger.error('Failed to list clients for agent', { error, agentId }); throw error; }
  }

  async deleteClient(clientId: string, agentId: string): Promise<void> {
    try {
      const client = await this.getClient(clientId);
      if (!client) throw new Error('Client not found');
      if (client.agentId !== agentId) throw new Error('Unauthorized');
      if (client.status !== ClientStatus.NEW_LEAD) throw new Error('Client can only be deleted while status is NEW_LEAD');
      await db.query('DELETE FROM clients WHERE id = $1', [clientId]);
      logger.info('Client deleted', { clientId, agentId });
    } catch (error) { logger.error('Failed to delete client', { error, clientId }); throw error; }
  }

  /** CONVERTED — Agent selects product and service (doc §10) */
  async markConverted(clientId: string): Promise<Client> {
    return this._transition(clientId, ClientStatus.CONVERTED, [ClientStatus.NEW_LEAD], 'Client marked CONVERTED');
  }

  /** LEAD_ACTIVATED — Full Payment commitment confirmed (doc §10) */
  async activateLead(clientId: string, transactionId: string): Promise<Client> {
    logger.info('Activating lead (Full Payment)', { clientId, transactionId });
    return this._transition(clientId, ClientStatus.LEAD_ACTIVATED, [ClientStatus.CONVERTED], 'Lead ACTIVATED');
  }

  /** LEAD_QUALIFIED — 50/50 or Milestone commitment confirmed (doc §10) */
  async qualifyLead(clientId: string, transactionId: string): Promise<Client> {
    logger.info('Qualifying lead (50/50 or Milestone)', { clientId, transactionId });
    return this._transition(clientId, ClientStatus.LEAD_QUALIFIED, [ClientStatus.CONVERTED], 'Lead QUALIFIED');
  }

  /** NEGOTIATION — Trainer in active engagement (doc §10) */
  async moveToNegotiation(clientId: string): Promise<Client> {
    return this._transition(clientId, ClientStatus.NEGOTIATION, [ClientStatus.LEAD_ACTIVATED, ClientStatus.LEAD_QUALIFIED], 'Lead in NEGOTIATION');
  }

  /** CLOSED_WON — Full deposit received → becomes a Project (doc §10) */
  async closeWon(clientId: string): Promise<Client> {
    return this._transition(clientId, ClientStatus.CLOSED_WON, [ClientStatus.LEAD_ACTIVATED, ClientStatus.LEAD_QUALIFIED, ClientStatus.NEGOTIATION], 'Lead CLOSED WON');
  }

  /** Legacy alias kept for backward compatibility */
  async convertToLead(clientId: string, transactionId: string): Promise<Client> {
    return this.activateLead(clientId, transactionId);
  }

  /** Qualify lead with data (legacy alias) */
  async qualifyLeadWithData(leadId: string, qualificationData: { estimatedValue: number; priority: Priority; expectedStartDate: Date; }): Promise<Client> {
    const client = await this.getClient(leadId);
    if (!client) throw new Error('Client not found');
    await db.query(
      `UPDATE clients SET estimated_value = $1, priority = $2, expected_start_date = $3, updated_at = NOW() WHERE id = $4`,
      [qualificationData.estimatedValue, qualificationData.priority, qualificationData.expectedStartDate, leadId]
    );
    return this.qualifyLead(leadId, 'manual');
  }

  /** Convert to project (legacy alias — triggers closeWon) */
  async convertToProject(leadId: string, projectData: { serviceAmount: number; currency?: string; startDate?: Date; endDate?: Date; }): Promise<{ client: Client; project: any }> {
    const client = await this.closeWon(leadId);
    const year = new Date().getFullYear();
    const prefix = `TST-PRJ-${year}-`;
    const refResult = await db.query(`SELECT reference_number FROM projects WHERE reference_number LIKE $1 ORDER BY reference_number DESC LIMIT 1`, [`${prefix}%`]);
    let seq = 1;
    if (refResult.rows.length > 0) seq = parseInt(refResult.rows[0].reference_number.split('-')[3]) + 1;
    const projectRef = `${prefix}${seq.toString().padStart(6, '0')}`;
    await db.query('BEGIN');
    try {
      const projectResult = await db.query(
        `INSERT INTO projects (reference_number, client_id, status, service_amount, currency, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, reference_number, client_id, status, service_amount, currency, start_date, end_date, created_at, updated_at`,
        [projectRef, leadId, 'PENDING_APPROVAL', projectData.serviceAmount, projectData.currency || 'KES', projectData.startDate || null, projectData.endDate || null]
      );
      await db.query('COMMIT');
      const project = projectResult.rows[0];
      logger.info('Lead converted to project', { leadId, projectId: project.id });
      return { client, project: { id: project.id, referenceNumber: project.reference_number, clientId: project.client_id, status: project.status, serviceAmount: parseFloat(project.service_amount), currency: project.currency, startDate: project.start_date, endDate: project.end_date, createdAt: project.created_at, updatedAt: project.updated_at } };
    } catch (error) { await db.query('ROLLBACK'); throw error; }
  }

  private async _transition(clientId: string, newStatus: ClientStatus, validFrom: ClientStatus[], logMsg: string): Promise<Client> {
    try {
      const client = await this.getClient(clientId);
      if (!client) throw new Error('Client not found');
      if (!validFrom.includes(client.status)) throw new Error(`Cannot transition from ${client.status} to ${newStatus}`);
      const result = await db.query(
        `UPDATE clients SET status = $1, updated_at = NOW() WHERE id = $2
         RETURNING id, reference_number, name, email, phone, country, industry_category, service_description, status, agent_id, estimated_value, priority, expected_start_date, created_at, updated_at`,
        [newStatus, clientId]
      );
      if (result.rows.length === 0) throw new Error('Client not found');
      logger.info(logMsg, { clientId, newStatus });
      realtimeEvents.publish('client:status_changed', { clientId, newStatus });
      return this.mapClientFromDb(result.rows[0]);
    } catch (error) { logger.error(`Failed transition to ${newStatus}`, { error, clientId }); throw error; }
  }

  private mapClientFromDb(row: any): Client {
    return {
      id: row.id,
      referenceNumber: row.reference_number,
      name: row.name,
      email: row.email,
      phone: row.phone,
      country: row.country,
      industryCategory: row.industry_category as IndustryCategory,
      serviceDescription: row.service_description,
      status: row.status as ClientStatus,
      agentId: row.agent_id,
      estimatedValue: row.estimated_value ? parseFloat(row.estimated_value) : undefined,
      priority: row.priority as Priority,
      expectedStartDate: row.expected_start_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const clientService = new ClientService();
export default clientService;
