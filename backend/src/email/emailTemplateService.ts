/**
 * Email Template Service
 * Manages email templates with versioning, preview, and multi-language support.
 * Requirements: 38.1-38.9
 */

import { db } from '../database/connection';
import { emailTemplateParser, emailTemplateRenderer } from './emailTemplateParser';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
  language: string;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailTemplateVersion {
  id: string;
  templateId: string;
  version: number;
  subject: string;
  htmlContent: string;
  textContent: string;
  createdBy: string;
  createdAt: Date;
  changeSummary: string | null;
}

export interface CreateTemplateInput {
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables?: string[];
  language?: string;
  createdBy: string;
}

export interface UpdateTemplateInput {
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  variables?: string[];
  createdBy: string;
  changeSummary?: string;
}

// ============================================================================
// Default template definitions
// ============================================================================

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

const DEFAULT_TEMPLATES: Omit<CreateTemplateInput, 'createdBy'>[] = [
  {
    name: 'invitation',
    subject: 'You have been invited to {{organization_name}}',
    htmlContent: `<h1>Welcome, {{recipient_name}}!</h1>
<p>You have been invited to join <strong>{{organization_name}}</strong>.</p>
<p>Click the link below to accept your invitation:</p>
<p><a href="{{invitation_url}}">Accept Invitation</a></p>
<p>This invitation expires on {{expiry_date}}.</p>`,
    textContent: `Welcome, {{recipient_name}}!

You have been invited to join {{organization_name}}.

Accept your invitation here: {{invitation_url}}

This invitation expires on {{expiry_date}}.`,
    variables: ['recipient_name', 'organization_name', 'invitation_url', 'expiry_date'],
  },
  {
    name: 'password_reset',
    subject: 'Reset your password',
    htmlContent: `<h1>Password Reset Request</h1>
<p>Hi {{recipient_name}},</p>
<p>We received a request to reset your password. Click the link below to proceed:</p>
<p><a href="{{reset_url}}">Reset Password</a></p>
<p>This link expires in {{expiry_minutes}} minutes.</p>
<p>If you did not request a password reset, please ignore this email.</p>`,
    textContent: `Password Reset Request

Hi {{recipient_name}},

We received a request to reset your password.

Reset your password here: {{reset_url}}

This link expires in {{expiry_minutes}} minutes.

If you did not request a password reset, please ignore this email.`,
    variables: ['recipient_name', 'reset_url', 'expiry_minutes'],
  },
  {
    name: 'payment_confirmation',
    subject: 'Payment confirmation - {{invoice_number}}',
    htmlContent: `<h1>Payment Confirmed</h1>
<p>Hi {{recipient_name}},</p>
<p>Your payment of <strong>{{amount}} {{currency}}</strong> for invoice <strong>{{invoice_number}}</strong> has been received.</p>
<p>Payment date: {{payment_date}}</p>
<p>Thank you for your business!</p>`,
    textContent: `Payment Confirmed

Hi {{recipient_name}},

Your payment of {{amount}} {{currency}} for invoice {{invoice_number}} has been received.

Payment date: {{payment_date}}

Thank you for your business!`,
    variables: ['recipient_name', 'amount', 'currency', 'invoice_number', 'payment_date'],
  },
  {
    name: 'contract_generated',
    subject: 'Contract ready for review - {{contract_title}}',
    htmlContent: `<h1>Contract Ready</h1>
<p>Hi {{recipient_name}},</p>
<p>The contract <strong>{{contract_title}}</strong> has been generated and is ready for your review.</p>
<p>Contract reference: {{contract_reference}}</p>
<p><a href="{{contract_url}}">View Contract</a></p>
<p>Please review and sign by {{due_date}}.</p>`,
    textContent: `Contract Ready

Hi {{recipient_name}},

The contract {{contract_title}} has been generated and is ready for your review.

Contract reference: {{contract_reference}}

View the contract here: {{contract_url}}

Please review and sign by {{due_date}}.`,
    variables: ['recipient_name', 'contract_title', 'contract_reference', 'contract_url', 'due_date'],
  },
  {
    name: 'report_reminder',
    subject: 'Reminder: {{report_name}} is due {{due_date}}',
    htmlContent: `<h1>Report Reminder</h1>
<p>Hi {{recipient_name}},</p>
<p>This is a reminder that the report <strong>{{report_name}}</strong> is due on <strong>{{due_date}}</strong>.</p>
<p><a href="{{report_url}}">Open Report</a></p>`,
    textContent: `Report Reminder

Hi {{recipient_name}},

This is a reminder that the report {{report_name}} is due on {{due_date}}.

Open the report here: {{report_url}}`,
    variables: ['recipient_name', 'report_name', 'due_date', 'report_url'],
  },
  {
    name: 'notification_digest',
    subject: 'Your {{period}} notification digest',
    htmlContent: `<h1>Notification Digest</h1>
<p>Hi {{recipient_name}},</p>
<p>Here is your {{period}} summary of {{notification_count}} notifications:</p>
{{#each notifications}}
<p>- {{this.title}}: {{this.message}}</p>
{{/each}}
<p><a href="{{dashboard_url}}">View Dashboard</a></p>`,
    textContent: `Notification Digest

Hi {{recipient_name}},

Here is your {{period}} summary of {{notification_count}} notifications.

View your dashboard: {{dashboard_url}}`,
    variables: ['recipient_name', 'period', 'notification_count', 'notifications', 'dashboard_url'],
  },
];

// ============================================================================
// Service
// ============================================================================

/**
 * EmailTemplateService
 * Manages email templates with versioning, preview, and multi-language support.
 * Requirements: 38.1-38.9
 */
export class EmailTemplateService {
  /**
   * Get a template by name and optional language.
   * Requirement 38.1: Retrieve templates by name
   */
  async getTemplate(name: string, language = 'en'): Promise<EmailTemplate> {
    const result = await db.query(
      `SELECT id, name, subject, html_content, text_content, variables,
              language, version, created_by, created_at, updated_at
       FROM email_templates
       WHERE name = $1 AND language = $2`,
      [name, language],
    );

    if (result.rows.length === 0) {
      throw new Error(`Email template not found: ${name} (${language})`);
    }

    return this.mapFromDb(result.rows[0]);
  }

  /**
   * List all templates.
   * Requirement 38.2: List all available templates
   */
  async listTemplates(): Promise<EmailTemplate[]> {
    const result = await db.query(
      `SELECT id, name, subject, html_content, text_content, variables,
              language, version, created_by, created_at, updated_at
       FROM email_templates
       ORDER BY name, language`,
    );

    return result.rows.map((row) => this.mapFromDb(row));
  }

  /**
   * Create a new template.
   * Requirement 38.3: Create new templates
   */
  async createTemplate(input: CreateTemplateInput): Promise<EmailTemplate> {
    const language = input.language ?? 'en';
    const variables = input.variables ?? emailTemplateParser.extractVariables(input.htmlContent);

    const result = await db.query(
      `INSERT INTO email_templates
         (name, language, subject, html_content, text_content, variables, version, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7)
       RETURNING id, name, subject, html_content, text_content, variables,
                 language, version, created_by, created_at, updated_at`,
      [input.name, language, input.subject, input.htmlContent, input.textContent,
       JSON.stringify(variables), input.createdBy],
    );

    const template = this.mapFromDb(result.rows[0]);

    logger.info('Email template created', { name: input.name, language, createdBy: input.createdBy });

    return template;
  }

  /**
   * Update a template — saves the current version to history and increments version.
   * Requirement 38.4: Update templates and maintain version history
   */
  async updateTemplate(id: string, input: UpdateTemplateInput): Promise<EmailTemplate> {
    return db.transaction(async (client) => {
      // Fetch current template
      const current = await client.query(
        `SELECT id, name, subject, html_content, text_content, variables,
                language, version, created_by, created_at, updated_at
         FROM email_templates WHERE id = $1 FOR UPDATE`,
        [id],
      );

      if (current.rows.length === 0) {
        throw new Error(`Email template not found: ${id}`);
      }

      const existing = this.mapFromDb(current.rows[0]);

      // Archive current version
      await client.query(
        `INSERT INTO email_template_versions
           (template_id, version, subject, html_content, text_content, created_by, change_summary)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [existing.id, existing.version, existing.subject, existing.htmlContent,
         existing.textContent, input.createdBy, input.changeSummary ?? null],
      );

      // Build updated fields
      const newSubject = input.subject ?? existing.subject;
      const newHtml = input.htmlContent ?? existing.htmlContent;
      const newText = input.textContent ?? existing.textContent;
      const newVariables = input.variables ?? emailTemplateParser.extractVariables(newHtml);
      const newVersion = existing.version + 1;

      const updated = await client.query(
        `UPDATE email_templates
         SET subject = $1, html_content = $2, text_content = $3,
             variables = $4, version = $5, updated_at = NOW()
         WHERE id = $6
         RETURNING id, name, subject, html_content, text_content, variables,
                   language, version, created_by, created_at, updated_at`,
        [newSubject, newHtml, newText, JSON.stringify(newVariables), newVersion, id],
      );

      const template = this.mapFromDb(updated.rows[0]);

      logger.info('Email template updated', { id, version: newVersion, updatedBy: input.createdBy });

      return template;
    });
  }

  /**
   * Preview a template by rendering it with sample data.
   * Requirement 38.5: Preview templates before saving
   */
  async previewTemplate(id: string, sampleData: Record<string, unknown>): Promise<{ html: string; text: string }> {
    const result = await db.query(
      `SELECT html_content, text_content FROM email_templates WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new Error(`Email template not found: ${id}`);
    }

    const { html_content, text_content } = result.rows[0];

    const html = emailTemplateRenderer.renderHtml(html_content, sampleData);
    const text = emailTemplateRenderer.renderText(text_content, sampleData);

    return { html, text };
  }

  /**
   * Get version history for a template by name.
   * Requirement 38.6: Retrieve version history
   */
  async getVersionHistory(templateName: string): Promise<EmailTemplateVersion[]> {
    const result = await db.query(
      `SELECT v.id, v.template_id, v.version, v.subject, v.html_content,
              v.text_content, v.created_by, v.created_at, v.change_summary
       FROM email_template_versions v
       JOIN email_templates t ON t.id = v.template_id
       WHERE t.name = $1
       ORDER BY v.version DESC`,
      [templateName],
    );

    return result.rows.map((row) => this.mapVersionFromDb(row));
  }

  /**
   * Seed the 6 required default templates if they do not already exist.
   * Requirement 38.7: Provide default templates for standard email types
   */
  async seedDefaultTemplates(): Promise<void> {
    for (const tpl of DEFAULT_TEMPLATES) {
      const existing = await db.query(
        `SELECT id FROM email_templates WHERE name = $1 AND language = 'en'`,
        [tpl.name],
      );

      if (existing.rows.length === 0) {
        await this.createTemplate({ ...tpl, createdBy: SYSTEM_USER_ID });
        logger.info('Seeded default email template', { name: tpl.name });
      }
    }
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private mapFromDb(row: any): EmailTemplate {
    return {
      id: row.id,
      name: row.name,
      subject: row.subject,
      htmlContent: row.html_content,
      textContent: row.text_content,
      variables: Array.isArray(row.variables) ? row.variables : JSON.parse(row.variables ?? '[]'),
      language: row.language,
      version: row.version,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapVersionFromDb(row: any): EmailTemplateVersion {
    return {
      id: row.id,
      templateId: row.template_id,
      version: row.version,
      subject: row.subject,
      htmlContent: row.html_content,
      textContent: row.text_content,
      createdBy: row.created_by,
      createdAt: row.created_at,
      changeSummary: row.change_summary ?? null,
    };
  }
}

export const emailTemplateService = new EmailTemplateService();
export default emailTemplateService;
