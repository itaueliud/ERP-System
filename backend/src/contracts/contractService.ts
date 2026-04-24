/**
 * Contract Generation Service
 * Orchestrates the full contract generation workflow:
 * - Fetches project/client data
 * - Renders contract using ContractPrettyPrinter
 * - Stores PDF in file storage (S3/R2)
 * - Emails contract copy to client
 * Requirements: 9.1-9.11
 */

import { db } from '../database/connection';
import logger from '../utils/logger';
import { contractPrettyPrinter, ContractData } from './contractPrettyPrinter';
import { storageClient } from '../services/storage';
import { sendgridClient } from '../services/sendgrid';

export interface Contract {
  id: string;
  referenceNumber: string;
  projectId: string;
  version: number;
  content: ContractContent;
  pdfUrl: string;
  status: ContractStatus;
  createdBy: string;
  createdAt: Date;
}

export interface ContractContent {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCountry: string;
  serviceDescription: string;
  serviceAmount: number;
  currency: string;
  transactionIds: string[];
  projectReferenceNumber: string;
  startDate?: Date;
  endDate?: Date;
  industryCategory: string;
}

export enum ContractStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
}

export interface ContractVersion {
  id: string;
  contractId: string;
  versionNumber: number;
  content: ContractContent;
  pdfUrl: string;
  changeSummary: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface GenerateContractInput {
  projectId: string;
  requesterId: string;
}

export interface ListContractsFilters {
  projectId?: string;
  status?: ContractStatus;
  limit?: number;
  offset?: number;
}

/**
 * Default contract template used when generating contracts
 * Requirement 9.2: Include client details, service description, amounts, transaction IDs
 */
const DEFAULT_CONTRACT_TEMPLATE = `
<h1>SERVICE AGREEMENT</h1>
<p><strong>Contract Reference:</strong> {{referenceNumber}}</p>
<p><strong>Date:</strong> {{contractDate}}</p>

<h2>PARTIES</h2>
<div class="party-section">
  <p><strong>Service Provider:</strong> TechSwiftTrix (TST)</p>
  <p><strong>Client Name:</strong> {{clientName}}</p>
  <p><strong>Client Email:</strong> {{clientEmail}}</p>
  <p><strong>Client Phone:</strong> {{clientPhone}}</p>
  <p><strong>Client Country:</strong> {{clientCountry}}</p>
</div>

<h2>PROJECT DETAILS</h2>
<p><strong>Project Reference:</strong> {{projectReferenceNumber}}</p>
<p><strong>Industry Category:</strong> {{industryCategory}}</p>
<p><strong>Service Description:</strong></p>
<p>{{serviceDescription}}</p>

{{#if startDate}}
<p><strong>Project Start Date:</strong> {{startDate}}</p>
{{/if}}
{{#if endDate}}
<p><strong>Project End Date:</strong> {{endDate}}</p>
{{/if}}

<h2>FINANCIAL TERMS</h2>
<div class="financial-terms">
  <p><strong>Service Amount:</strong> {{currency}} {{serviceAmount}}</p>
  <p><strong>Payment Terms:</strong> As agreed between the parties.</p>
</div>

<h2>TRANSACTION REFERENCES</h2>
{{#if hasTransactions}}
<p>The following payment transaction IDs are associated with this contract:</p>
<ul>
{{#each transactionIds}}
  <li>{{this}}</li>
{{/each}}
</ul>
{{/if}}

<h2>TERMS AND CONDITIONS</h2>
<div class="terms-section">
  <ol>
    <li>TechSwiftTrix agrees to deliver the services described above within the agreed timeline.</li>
    <li>The client agrees to pay the service amount as specified in the financial terms.</li>
    <li>Any modifications to the scope of work must be agreed upon in writing by both parties.</li>
    <li>This agreement is governed by the laws of the jurisdiction in which services are delivered.</li>
    <li>Either party may terminate this agreement with 30 days written notice.</li>
    <li>TechSwiftTrix retains intellectual property rights to all tools and frameworks developed.</li>
    <li>The client retains ownership of all data and content provided to TechSwiftTrix.</li>
    <li>Confidentiality obligations survive the termination of this agreement for 2 years.</li>
  </ol>
</div>

<div class="signature-block">
  <h2>SIGNATURES</h2>
  <p>By proceeding with this agreement, both parties acknowledge and accept the terms above.</p>
  <div style="display: flex; justify-content: space-between; margin-top: 40px;">
    <div>
      <div class="signature-line"></div>
      <p><strong>TechSwiftTrix Representative</strong></p>
      <p>Date: _______________</p>
    </div>
    <div>
      <div class="signature-line"></div>
      <p><strong>{{clientName}}</strong></p>
      <p>Date: _______________</p>
    </div>
  </div>
</div>
`;

/**
 * ContractGenerationService
 * Handles contract creation, storage, and delivery
 * Requirements: 9.1-9.11
 */
export class ContractGenerationService {
  /**
   * Generate a unique contract reference number in format TST-CNT-YYYY-NNNNNN
   * Requirement 9.3: Assign unique contract reference number
   */
  async generateReferenceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `TST-CNT-${year}-`;

    const result = await db.query(
      `SELECT reference_number FROM contracts
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
   * Fetch project data with client and payment information
   */
  private async fetchProjectData(projectId: string): Promise<{
    project: any;
    client: any;
    transactionIds: string[];
  }> {
    // Fetch project with client details
    const projectResult = await db.query(
      `SELECT p.id, p.reference_number, p.status, p.service_amount, p.currency,
              p.start_date, p.end_date, p.client_id,
              c.name AS client_name, c.email AS client_email, c.phone AS client_phone,
              c.country AS client_country, c.service_description, c.industry_category
       FROM projects p
       JOIN clients c ON c.id = p.client_id
       WHERE p.id = $1`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const row = projectResult.rows[0];

    // Fetch all completed payment transaction IDs for this project
    const paymentsResult = await db.query(
      `SELECT transaction_id FROM payments
       WHERE project_id = $1 AND status = 'COMPLETED'
       ORDER BY created_at ASC`,
      [projectId]
    );

    // Also fetch commitment payment transaction IDs linked to the client
    const commitmentResult = await db.query(
      `SELECT p.transaction_id FROM payments p
       WHERE p.client_id = $1 AND p.status = 'COMPLETED'
       ORDER BY p.created_at ASC`,
      [row.client_id]
    );

    const transactionIds = [
      ...paymentsResult.rows.map((r: any) => r.transaction_id as string),
      ...commitmentResult.rows.map((r: any) => r.transaction_id as string),
    ];

    // Deduplicate
    const uniqueTransactionIds = [...new Set(transactionIds)];

    return {
      project: {
        id: row.id,
        referenceNumber: row.reference_number,
        status: row.status,
        serviceAmount: parseFloat(row.service_amount),
        currency: row.currency,
        startDate: row.start_date,
        endDate: row.end_date,
        clientId: row.client_id,
      },
      client: {
        name: row.client_name,
        email: row.client_email,
        phone: row.client_phone,
        country: row.client_country,
        serviceDescription: row.service_description,
        industryCategory: row.industry_category,
      },
      transactionIds: uniqueTransactionIds,
    };
  }

  /**
   * Generate contract for a project
   * Requirement 9.1: Auto-generate contract when project is approved
   * Requirement 9.2: Include client details, service description, amounts, transaction IDs
   * Requirement 9.3: Assign unique contract reference number (TST-CNT-YYYY-NNNNNN)
   * Requirement 9.4: Embed all related transaction IDs
   * Requirement 9.5: Generate as PDF
   * Requirement 9.6: Store in file storage
   * Requirement 9.7: Send copy to client via email
   */
  async generateContract(projectId: string, requesterId: string): Promise<Contract> {
    logger.info('Generating contract for project', { projectId, requesterId });

    // Verify requester exists
    const requesterResult = await db.query('SELECT id FROM users WHERE id = $1', [requesterId]);
    if (requesterResult.rows.length === 0) {
      throw new Error('Requester not found');
    }

    // Fetch project and client data
    const { project, client, transactionIds } = await this.fetchProjectData(projectId);

    // Generate reference number
    const referenceNumber = await this.generateReferenceNumber();

    // Determine next version number for this project
    const versionResult = await db.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM contracts WHERE project_id = $1`,
      [projectId]
    );
    const version = parseInt(versionResult.rows[0].next_version, 10);

    // Build contract content
    const contractContent: ContractContent = {
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      clientCountry: client.country,
      serviceDescription: client.serviceDescription,
      serviceAmount: project.serviceAmount,
      currency: project.currency,
      transactionIds,
      projectReferenceNumber: project.referenceNumber,
      startDate: project.startDate,
      endDate: project.endDate,
      industryCategory: client.industryCategory,
    };

    // Build template data for rendering
    const templateData: ContractData = {
      referenceNumber,
      contractDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      clientCountry: client.country,
      serviceDescription: client.serviceDescription,
      serviceAmount: project.serviceAmount.toFixed(2),
      currency: project.currency,
      projectReferenceNumber: project.referenceNumber,
      industryCategory: client.industryCategory,
      startDate: project.startDate
        ? new Date(project.startDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : '',
      endDate: project.endDate
        ? new Date(project.endDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : '',
      hasTransactions: transactionIds.length > 0 ? 'true' : '',
      transactionIds,
    };

    // Render contract to PDF
    logger.info('Rendering contract PDF', { referenceNumber });
    const pdfBuffer = await contractPrettyPrinter.renderToPDF(
      DEFAULT_CONTRACT_TEMPLATE,
      templateData
    );

    // Store PDF in file storage
    // Requirement 9.6: Store generated contracts in File_Storage
    const storageKey = `contracts/${projectId}/${referenceNumber}-v${version}.pdf`;
    const uploadResult = await storageClient.upload({
      key: storageKey,
      buffer: pdfBuffer,
      contentType: 'application/pdf',
      metadata: {
        projectId,
        referenceNumber,
        version: String(version),
        generatedBy: requesterId,
      },
    });

    const pdfUrl = uploadResult.url;

    // If there's an existing ACTIVE contract for this project, mark it as SUPERSEDED
    if (version > 1) {
      await db.query(
        `UPDATE contracts SET status = $1
         WHERE project_id = $2 AND status = $3`,
        [ContractStatus.SUPERSEDED, projectId, ContractStatus.ACTIVE]
      );
    }

    // Store contract metadata in database
    const insertResult = await db.query(
      `INSERT INTO contracts (
         reference_number, project_id, version, content, pdf_url, status, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, reference_number, project_id, version, content, pdf_url, status,
                 created_by, created_at`,
      [
        referenceNumber,
        projectId,
        version,
        JSON.stringify(contractContent),
        pdfUrl,
        ContractStatus.ACTIVE,
        requesterId,
      ]
    );

    const contractRow = insertResult.rows[0];

    // Also store in contract_versions table for history
    await db.query(
      `INSERT INTO contract_versions (
         contract_id, version_number, content, pdf_url, change_summary, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        contractRow.id,
        version,
        JSON.stringify(contractContent),
        pdfUrl,
        version === 1 ? 'Initial contract generation' : `Version ${version} generated`,
        requesterId,
      ]
    );

    // Send contract copy to client via email
    // Requirement 9.7: Send copy to client via email
    try {
      await this.sendContractEmail(client.email, client.name, referenceNumber, pdfBuffer);
      logger.info('Contract email sent to client', {
        clientEmail: client.email,
        referenceNumber,
      });
    } catch (emailError) {
      // Log but don't fail the contract generation if email fails
      logger.error('Failed to send contract email', {
        error: emailError,
        clientEmail: client.email,
        referenceNumber,
      });
    }

    const contract = this.mapContractFromDb(contractRow);

    logger.info('Contract generated successfully', {
      contractId: contract.id,
      referenceNumber,
      projectId,
      version,
    });

    return contract;
  }

  /**
   * Send contract copy to client via email
   * Requirement 9.7: Send copy to client via email
   */
  private async sendContractEmail(
    clientEmail: string,
    clientName: string,
    referenceNumber: string,
    pdfBuffer: Buffer
  ): Promise<void> {
    const pdfBase64 = pdfBuffer.toString('base64');

    await sendgridClient.sendEmail({
      to: clientEmail,
      subject: `Your Service Agreement - ${referenceNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Your Service Agreement is Ready</h2>
          <p>Dear ${clientName},</p>
          <p>Please find attached your service agreement with TechSwiftTrix (TST).</p>
          <p><strong>Contract Reference:</strong> ${referenceNumber}</p>
          <p>Please review the agreement carefully. If you have any questions, please contact us.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 12px;">
            TechSwiftTrix ERP System<br>
            This is an automated message, please do not reply.
          </p>
        </div>
      `,
      attachments: [
        {
          content: pdfBase64,
          filename: `${referenceNumber}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment',
        },
      ],
    });
  }

  /**
   * Get contract by ID
   * Requirement 9.8: Allow authorized users to download contracts
   */
  async getContract(contractId: string): Promise<Contract | null> {
    try {
      const result = await db.query(
        `SELECT id, reference_number, project_id, version, content, pdf_url, status,
                created_by, created_at
         FROM contracts
         WHERE id = $1`,
        [contractId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapContractFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get contract', { error, contractId });
      throw error;
    }
  }

  /**
   * Get contract by reference number
   */
  async getContractByReference(referenceNumber: string): Promise<Contract | null> {
    try {
      const result = await db.query(
        `SELECT id, reference_number, project_id, version, content, pdf_url, status,
                created_by, created_at
         FROM contracts
         WHERE reference_number = $1`,
        [referenceNumber]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapContractFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get contract by reference', { error, referenceNumber });
      throw error;
    }
  }

  /**
   * List contracts with optional project filter
   * Requirement 9.11: Maintain complete history of all contract versions
   */
  async listContracts(filters: ListContractsFilters = {}): Promise<{
    contracts: Contract[];
    total: number;
  }> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters.projectId) {
        conditions.push(`project_id = $${paramIndex++}`);
        values.push(filters.projectId);
      }

      if (filters.status) {
        conditions.push(`status = $${paramIndex++}`);
        values.push(filters.status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count total
      const countResult = await db.query(
        `SELECT COUNT(*) FROM contracts ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Fetch contracts
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const query = `
        SELECT id, reference_number, project_id, version, content, pdf_url, status,
               created_by, created_at
        FROM contracts
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await db.query(query, values);

      const contracts = result.rows.map((row: any) => this.mapContractFromDb(row));

      return { contracts, total };
    } catch (error) {
      logger.error('Failed to list contracts', { error, filters });
      throw error;
    }
  }

  /**
   * Get a pre-signed download URL for a contract PDF
   * Requirement 9.8: Allow authorized users to download contracts
   */
  async getDownloadUrl(contractId: string, expiresIn: number = 3600): Promise<string> {
    const contract = await this.getContract(contractId);
    if (!contract) {
      throw new Error('Contract not found');
    }

    // Extract storage key from URL
    const storageKey = this.extractStorageKey(contract.pdfUrl);
    return storageClient.getSignedDownloadUrl(storageKey, expiresIn);
  }

  /**
   * Get all versions for a contract
   * Requirement 51.1, 51.5, 51.10: Maintain and view version history
   */
  async getContractVersions(contractId: string): Promise<ContractVersion[]> {
    // Verify contract exists
    const contract = await this.getContract(contractId);
    if (!contract) {
      throw new Error('Contract not found');
    }

    const result = await db.query(
      `SELECT id, contract_id, version_number, content, pdf_url, change_summary,
              created_by, created_at
       FROM contract_versions
       WHERE contract_id = $1
       ORDER BY version_number ASC`,
      [contractId]
    );

    return result.rows.map((row: any) => this.mapVersionFromDb(row));
  }

  /**
   * Get a specific version of a contract
   * Requirement 51.5: Allow viewing any previous version
   */
  async getContractVersion(contractId: string, versionNumber: number): Promise<ContractVersion | null> {
    // Verify contract exists
    const contract = await this.getContract(contractId);
    if (!contract) {
      throw new Error('Contract not found');
    }

    const result = await db.query(
      `SELECT id, contract_id, version_number, content, pdf_url, change_summary,
              created_by, created_at
       FROM contract_versions
       WHERE contract_id = $1 AND version_number = $2`,
      [contractId, versionNumber]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapVersionFromDb(result.rows[0]);
  }

  /**
   * Get a pre-signed download URL for a specific contract version
   * Requirement 51.9: Allow downloading any version
   */
  async getVersionDownloadUrl(contractId: string, versionNumber: number, expiresIn: number = 3600): Promise<string> {
    const version = await this.getContractVersion(contractId, versionNumber);
    if (!version) {
      throw new Error('Contract version not found');
    }

    const storageKey = this.extractStorageKey(version.pdfUrl);
    return storageClient.getSignedDownloadUrl(storageKey, expiresIn);
  }

  /**
   * Extract storage key from a full URL
   */
  private extractStorageKey(url: string): string {
    // URL format: https://bucket.s3.region.amazonaws.com/key
    // or: https://bucket.accountId.r2.cloudflarestorage.com/key
    try {
      const urlObj = new URL(url);
      // Remove leading slash
      return urlObj.pathname.replace(/^\//, '');
    } catch {
      return url;
    }
  }

  /**
   * Map database row to Contract object
   */
  private mapContractFromDb(row: any): Contract {
    let content: ContractContent;
    try {
      content = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
    } catch {
      content = row.content;
    }

    return {
      id: row.id,
      referenceNumber: row.reference_number,
      projectId: row.project_id,
      version: parseInt(row.version, 10),
      content,
      pdfUrl: row.pdf_url,
      status: row.status as ContractStatus,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }
  /**
   * Map database row to ContractVersion object
   */
  private mapVersionFromDb(row: any): ContractVersion {
    let content: ContractContent;
    try {
      content = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
    } catch {
      content = row.content;
    }

    return {
      id: row.id,
      contractId: row.contract_id,
      versionNumber: parseInt(row.version_number, 10),
      content,
      pdfUrl: row.pdf_url,
      changeSummary: row.change_summary ?? null,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }
}

export const contractService = new ContractGenerationService();
export default contractService;
