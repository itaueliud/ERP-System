import { db } from '../database/connection';
import logger from '../utils/logger';

export enum ProjectStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// Valid status transitions
const STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  [ProjectStatus.PENDING_APPROVAL]: [ProjectStatus.ACTIVE, ProjectStatus.CANCELLED],
  [ProjectStatus.ACTIVE]: [ProjectStatus.ON_HOLD, ProjectStatus.COMPLETED, ProjectStatus.CANCELLED],
  [ProjectStatus.ON_HOLD]: [ProjectStatus.ACTIVE, ProjectStatus.CANCELLED],
  [ProjectStatus.COMPLETED]: [],
  [ProjectStatus.CANCELLED]: [],
};

export interface Project {
  id: string;
  referenceNumber: string;
  clientId: string;
  agentId: string;
  status: ProjectStatus;
  serviceAmount: number;
  currency: string;
  startDate?: Date;
  endDate?: Date;
  githubRepoId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  clientId: string;
  agentId: string;
  serviceAmount: number;
  currency?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface UpdateProjectInput {
  serviceAmount?: number;
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  githubRepoId?: string;
}

export interface ProjectFilters {
  clientId?: string;
  agentId?: string;
  status?: ProjectStatus;
  currency?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Project Management Service
 * Handles project CRUD operations, status workflow, and reference number generation
 * Requirements: 6.5-6.10
 */
export class ProjectService {
  /**
   * Generate unique project reference number in format TST-PRJ-YYYY-NNNNNN
   * Requirement 6.6: Assign unique project reference number
   */
  async generateReferenceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `TST-PRJ-${year}-`;

    const result = await db.query(
      `SELECT reference_number FROM projects
       WHERE reference_number LIKE $1
       ORDER BY reference_number DESC
       LIMIT 1`,
      [`${prefix}%`]
    );

    let sequence = 1;
    if (result.rows.length > 0) {
      const lastRef = result.rows[0].reference_number as string;
      const parts = lastRef.split('-');
      const lastSequence = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    return `${prefix}${sequence.toString().padStart(6, '0')}`;
  }

  /**
   * Create a new project record
   * Requirements: 6.5, 6.6, 6.7, 6.8
   */
  async createProject(input: CreateProjectInput): Promise<Project> {
    try {
      if (input.serviceAmount <= 0) {
        throw new Error('Service amount must be greater than 0');
      }

      if (input.startDate && input.endDate && input.endDate < input.startDate) {
        throw new Error('End date must be on or after start date');
      }

      // Verify client exists and get agent_id
      const clientResult = await db.query(
        `SELECT id, agent_id FROM clients WHERE id = $1`,
        [input.clientId]
      );
      if (clientResult.rows.length === 0) {
        throw new Error('Client not found');
      }

      const referenceNumber = await this.generateReferenceNumber();

      const result = await db.query(
        `INSERT INTO projects (
           reference_number, client_id, status, service_amount, currency, start_date, end_date
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, reference_number, client_id, status, service_amount, currency,
                   start_date, end_date, github_repo_id, created_at, updated_at`,
        [
          referenceNumber,
          input.clientId,
          ProjectStatus.PENDING_APPROVAL,
          input.serviceAmount,
          input.currency || 'KES',
          input.startDate || null,
          input.endDate || null,
        ]
      );

      const project = result.rows[0];

      logger.info('Project created successfully', {
        projectId: project.id,
        referenceNumber: project.reference_number,
        clientId: input.clientId,
      });

      return this.mapProjectFromDb(project, input.agentId);
    } catch (error) {
      logger.error('Failed to create project', { error, input });
      throw error;
    }
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string): Promise<Project | null> {
    try {
      const result = await db.query(
        `SELECT p.id, p.reference_number, p.client_id, c.agent_id,
                p.status, p.service_amount, p.currency,
                p.start_date, p.end_date, p.github_repo_id,
                p.created_at, p.updated_at
         FROM projects p
         JOIN clients c ON c.id = p.client_id
         WHERE p.id = $1`,
        [projectId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapProjectFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get project', { error, projectId });
      throw error;
    }
  }

  /**
   * Get project by reference number
   */
  async getProjectByReference(referenceNumber: string): Promise<Project | null> {
    try {
      const result = await db.query(
        `SELECT p.id, p.reference_number, p.client_id, c.agent_id,
                p.status, p.service_amount, p.currency,
                p.start_date, p.end_date, p.github_repo_id,
                p.created_at, p.updated_at
         FROM projects p
         JOIN clients c ON c.id = p.client_id
         WHERE p.reference_number = $1`,
        [referenceNumber]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapProjectFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get project by reference', { error, referenceNumber });
      throw error;
    }
  }

  /**
   * List projects with optional filters
   * Requirement 6.7: Link project to original client and agent records
   */
  async listProjects(filters: ProjectFilters = {}): Promise<{ projects: Project[]; total: number }> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters.clientId) {
        conditions.push(`p.client_id = $${paramIndex++}`);
        values.push(filters.clientId);
      }

      if (filters.agentId) {
        conditions.push(`c.agent_id = $${paramIndex++}`);
        values.push(filters.agentId);
      }

      if (filters.status) {
        conditions.push(`p.status = $${paramIndex++}`);
        values.push(filters.status);
      }

      if (filters.currency) {
        conditions.push(`p.currency = $${paramIndex++}`);
        values.push(filters.currency);
      }

      if (filters.search) {
        conditions.push(`p.reference_number ILIKE $${paramIndex++}`);
        values.push(`%${filters.search}%`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await db.query(
        `SELECT COUNT(*) FROM projects p JOIN clients c ON c.id = p.client_id ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const dataValues = [...values, limit, offset];
      const result = await db.query(
        `SELECT p.id, p.reference_number, p.client_id, c.agent_id,
                p.status, p.service_amount, p.currency,
                p.start_date, p.end_date, p.github_repo_id,
                p.created_at, p.updated_at
         FROM projects p
         JOIN clients c ON c.id = p.client_id
         ${whereClause}
         ORDER BY p.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        dataValues
      );

      const projects = result.rows.map((row) => this.mapProjectFromDb(row));

      return { projects, total };
    } catch (error) {
      logger.error('Failed to list projects', { error, filters });
      throw error;
    }
  }

  /**
   * Update project status with workflow validation
   * Requirement 6.5: Project status workflow
   */
  async updateProjectStatus(
    projectId: string,
    newStatus: ProjectStatus,
    userId: string
  ): Promise<Project> {
    try {
      const project = await this.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const allowedTransitions = STATUS_TRANSITIONS[project.status];
      if (!allowedTransitions.includes(newStatus)) {
        throw new Error(
          `Invalid status transition from ${project.status} to ${newStatus}. ` +
          `Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`
        );
      }

      const result = await db.query(
        `UPDATE projects
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, reference_number, client_id, status, service_amount, currency,
                   start_date, end_date, github_repo_id, created_at, updated_at`,
        [newStatus, projectId]
      );

      if (result.rows.length === 0) {
        throw new Error('Project not found');
      }

      logger.info('Project status updated', { projectId, newStatus, userId });

      return this.mapProjectFromDb(result.rows[0], project.agentId);
    } catch (error) {
      logger.error('Failed to update project status', { error, projectId, newStatus });
      throw error;
    }
  }

  /**
   * Update project fields
   */
  async updateProject(projectId: string, updates: UpdateProjectInput): Promise<Project> {
    try {
      const project = await this.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      if (updates.serviceAmount !== undefined && updates.serviceAmount <= 0) {
        throw new Error('Service amount must be greater than 0');
      }

      const startDate = updates.startDate ?? project.startDate;
      const endDate = updates.endDate ?? project.endDate;
      if (startDate && endDate && endDate < startDate) {
        throw new Error('End date must be on or after start date');
      }

      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.serviceAmount !== undefined) {
        fields.push(`service_amount = $${paramIndex++}`);
        values.push(updates.serviceAmount);
      }
      if (updates.currency !== undefined) {
        fields.push(`currency = $${paramIndex++}`);
        values.push(updates.currency);
      }
      if (updates.startDate !== undefined) {
        fields.push(`start_date = $${paramIndex++}`);
        values.push(updates.startDate);
      }
      if (updates.endDate !== undefined) {
        fields.push(`end_date = $${paramIndex++}`);
        values.push(updates.endDate);
      }
      if (updates.githubRepoId !== undefined) {
        fields.push(`github_repo_id = $${paramIndex++}`);
        values.push(updates.githubRepoId);
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push(`updated_at = NOW()`);
      values.push(projectId);

      const result = await db.query(
        `UPDATE projects
         SET ${fields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, reference_number, client_id, status, service_amount, currency,
                   start_date, end_date, github_repo_id, created_at, updated_at`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Project not found');
      }

      logger.info('Project updated', { projectId, updates });

      return this.mapProjectFromDb(result.rows[0], project.agentId);
    } catch (error) {
      logger.error('Failed to update project', { error, projectId, updates });
      throw error;
    }
  }

  /**
   * Calculate project timeline in days
   * Requirement 6.9: Calculate project timeline
   */
  calculateTimeline(startDate: Date, endDate: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay);
  }

  private mapProjectFromDb(row: any, agentId?: string): Project {
    return {
      id: row.id,
      referenceNumber: row.reference_number,
      clientId: row.client_id,
      agentId: agentId ?? row.agent_id,
      status: row.status as ProjectStatus,
      serviceAmount: parseFloat(row.service_amount),
      currency: row.currency,
      startDate: row.start_date ?? undefined,
      endDate: row.end_date ?? undefined,
      githubRepoId: row.github_repo_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const projectService = new ProjectService();
export default projectService;

// ============================================================================
// Service Amount Change Control
// Requirements: 8.1-8.10
// ============================================================================

export enum ServiceAmountChangeStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface ServiceAmountChange {
  id: string;
  projectId: string;
  originalAmount: number;
  newAmount: number;
  justification: string;
  requesterId: string;
  status: ServiceAmountChangeStatus;
  ceoDecision?: string;
  ceoNotes?: string;
  decidedAt?: Date;
  createdAt: Date;
}

export interface RequestServiceAmountChangeInput {
  projectId: string;
  newAmount: number;
  justification: string;
  requesterId: string;
}

/**
 * Service Amount Change Control Service
 * Handles CEO-approval workflow for service amount changes
 * Requirements: 8.1-8.10
 */
export class ServiceAmountChangeService {
  /**
   * Request a service amount change — creates a pending change request
   * Requirement 8.1: Create change request when user attempts to change service amount
   * Requirement 8.3: Prevent changes until CEO confirmation
   * Requirement 8.9: Require justification comment
   */
  async requestServiceAmountChange(input: RequestServiceAmountChangeInput): Promise<ServiceAmountChange> {
    try {
      if (input.newAmount <= 0) {
        throw new Error('New service amount must be greater than 0');
      }

      if (!input.justification || input.justification.trim().length === 0) {
        throw new Error('Justification is required for service amount change requests');
      }

      // Get current project to capture original amount
      const projectResult = await db.query(
        `SELECT id, service_amount FROM projects WHERE id = $1`,
        [input.projectId]
      );

      if (projectResult.rows.length === 0) {
        throw new Error('Project not found');
      }

      const originalAmount = parseFloat(projectResult.rows[0].service_amount);

      if (originalAmount === input.newAmount) {
        throw new Error('New amount must differ from the current service amount');
      }

      const result = await db.query(
        `INSERT INTO service_amount_changes
           (project_id, original_amount, new_amount, justification, requester_id, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, project_id, original_amount, new_amount, justification,
                   requester_id, status, ceo_decision, ceo_notes, decided_at, created_at`,
        [
          input.projectId,
          originalAmount,
          input.newAmount,
          input.justification.trim(),
          input.requesterId,
          ServiceAmountChangeStatus.PENDING,
        ]
      );

      const change = this.mapChangeFromDb(result.rows[0]);

      logger.info('Service amount change request created', {
        changeId: change.id,
        projectId: input.projectId,
        originalAmount,
        newAmount: input.newAmount,
        requesterId: input.requesterId,
      });

      return change;
    } catch (error) {
      logger.error('Failed to create service amount change request', { error, input });
      throw error;
    }
  }

  /**
   * CEO approves a service amount change — applies the new amount
   * Requirement 8.4: Apply new amount when CEO confirms
   * Requirement 8.6: Log original amount, new amount, requester, and CEO decision
   */
  async approveServiceAmountChange(
    changeId: string,
    ceoId: string,
    notes?: string
  ): Promise<ServiceAmountChange> {
    try {
      const changeResult = await db.query(
        `SELECT id, project_id, original_amount, new_amount, justification,
                requester_id, status, ceo_decision, ceo_notes, decided_at, created_at
         FROM service_amount_changes
         WHERE id = $1`,
        [changeId]
      );

      if (changeResult.rows.length === 0) {
        throw new Error('Service amount change request not found');
      }

      const change = this.mapChangeFromDb(changeResult.rows[0]);

      if (change.status !== ServiceAmountChangeStatus.PENDING) {
        throw new Error('Only pending change requests can be approved');
      }

      // Update the change record
      const updatedResult = await db.query(
        `UPDATE service_amount_changes
         SET status = $1, ceo_decision = $2, ceo_notes = $3, decided_at = NOW()
         WHERE id = $4
         RETURNING id, project_id, original_amount, new_amount, justification,
                   requester_id, status, ceo_decision, ceo_notes, decided_at, created_at`,
        [ServiceAmountChangeStatus.APPROVED, ceoId, notes || null, changeId]
      );

      // Apply the new amount to the project
      await db.query(
        `UPDATE projects SET service_amount = $1, updated_at = NOW() WHERE id = $2`,
        [change.newAmount, change.projectId]
      );

      const updatedChange = this.mapChangeFromDb(updatedResult.rows[0]);

      logger.info('Service amount change approved', {
        changeId,
        ceoId,
        projectId: change.projectId,
        originalAmount: change.originalAmount,
        newAmount: change.newAmount,
      });

      return updatedChange;
    } catch (error) {
      logger.error('Failed to approve service amount change', { error, changeId, ceoId });
      throw error;
    }
  }

  /**
   * CEO rejects a service amount change — original amount is maintained
   * Requirement 8.5: Maintain original amount and notify requester when CEO rejects
   * Requirement 8.6: Log original amount, new amount, requester, and CEO decision
   */
  async rejectServiceAmountChange(
    changeId: string,
    ceoId: string,
    notes: string
  ): Promise<ServiceAmountChange> {
    try {
      if (!notes || notes.trim().length === 0) {
        throw new Error('Notes are required when rejecting a service amount change');
      }

      const changeResult = await db.query(
        `SELECT id, project_id, original_amount, new_amount, justification,
                requester_id, status, ceo_decision, ceo_notes, decided_at, created_at
         FROM service_amount_changes
         WHERE id = $1`,
        [changeId]
      );

      if (changeResult.rows.length === 0) {
        throw new Error('Service amount change request not found');
      }

      const change = this.mapChangeFromDb(changeResult.rows[0]);

      if (change.status !== ServiceAmountChangeStatus.PENDING) {
        throw new Error('Only pending change requests can be rejected');
      }

      const updatedResult = await db.query(
        `UPDATE service_amount_changes
         SET status = $1, ceo_decision = $2, ceo_notes = $3, decided_at = NOW()
         WHERE id = $4
         RETURNING id, project_id, original_amount, new_amount, justification,
                   requester_id, status, ceo_decision, ceo_notes, decided_at, created_at`,
        [ServiceAmountChangeStatus.REJECTED, ceoId, notes.trim(), changeId]
      );

      const updatedChange = this.mapChangeFromDb(updatedResult.rows[0]);

      logger.info('Service amount change rejected', {
        changeId,
        ceoId,
        projectId: change.projectId,
        originalAmount: change.originalAmount,
        newAmount: change.newAmount,
      });

      return updatedChange;
    } catch (error) {
      logger.error('Failed to reject service amount change', { error, changeId, ceoId });
      throw error;
    }
  }

  /**
   * Get all pending service amount changes (for CEO dashboard)
   * Requirement 8.7: Display pending changes on CEO dashboard
   */
  async getPendingServiceAmountChanges(): Promise<ServiceAmountChange[]> {
    try {
      const result = await db.query(
        `SELECT id, project_id, original_amount, new_amount, justification,
                requester_id, status, ceo_decision, ceo_notes, decided_at, created_at
         FROM service_amount_changes
         WHERE status = $1
         ORDER BY created_at ASC`,
        [ServiceAmountChangeStatus.PENDING]
      );

      return result.rows.map((row) => this.mapChangeFromDb(row));
    } catch (error) {
      logger.error('Failed to get pending service amount changes', { error });
      throw error;
    }
  }

  /**
   * Get overdue pending changes (pending for more than 24 hours)
   * Requirement 8.8: Send escalation notification for requests pending > 24 hours
   */
  async getOverdueServiceAmountChanges(): Promise<ServiceAmountChange[]> {
    try {
      const result = await db.query(
        `SELECT id, project_id, original_amount, new_amount, justification,
                requester_id, status, ceo_decision, ceo_notes, decided_at, created_at
         FROM service_amount_changes
         WHERE status = $1
           AND created_at < NOW() - INTERVAL '24 hours'
         ORDER BY created_at ASC`,
        [ServiceAmountChangeStatus.PENDING]
      );

      return result.rows.map((row) => this.mapChangeFromDb(row));
    } catch (error) {
      logger.error('Failed to get overdue service amount changes', { error });
      throw error;
    }
  }

  /**
   * Get service amount changes, optionally filtered by project
   * Requirement 8.6: Log and retrieve change history
   */
  async getServiceAmountChanges(projectId?: string): Promise<ServiceAmountChange[]> {
    try {
      const query = projectId
        ? `SELECT id, project_id, original_amount, new_amount, justification,
                  requester_id, status, ceo_decision, ceo_notes, decided_at, created_at
           FROM service_amount_changes
           WHERE project_id = $1
           ORDER BY created_at DESC`
        : `SELECT id, project_id, original_amount, new_amount, justification,
                  requester_id, status, ceo_decision, ceo_notes, decided_at, created_at
           FROM service_amount_changes
           ORDER BY created_at DESC`;

      const result = await db.query(query, projectId ? [projectId] : []);

      return result.rows.map((row) => this.mapChangeFromDb(row));
    } catch (error) {
      logger.error('Failed to get service amount changes', { error, projectId });
      throw error;
    }
  }

  private mapChangeFromDb(row: any): ServiceAmountChange {
    return {
      id: row.id,
      projectId: row.project_id,
      originalAmount: parseFloat(row.original_amount),
      newAmount: parseFloat(row.new_amount),
      justification: row.justification,
      requesterId: row.requester_id,
      status: row.status as ServiceAmountChangeStatus,
      ceoDecision: row.ceo_decision ?? undefined,
      ceoNotes: row.ceo_notes ?? undefined,
      decidedAt: row.decided_at ?? undefined,
      createdAt: row.created_at,
    };
  }
}

export const serviceAmountChangeService = new ServiceAmountChangeService();
