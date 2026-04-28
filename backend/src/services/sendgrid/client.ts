import sgMail from '@sendgrid/mail';
import { config } from '../../config';
import logger from '../../utils/logger';

export interface EmailMessage {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  content: string; // Base64 encoded content
  filename: string;
  type?: string;
  disposition?: 'attachment' | 'inline';
  contentId?: string;
}

export interface BulkEmailMessage {
  personalizations: Array<{
    to: string;
    subject?: string;
    dynamicTemplateData?: Record<string, any>;
  }>;
  subject?: string;
  text?: string;
  html?: string;
  templateId?: string;
}

export class SendGridClient {
  private readonly configured: boolean;

  constructor() {
    if (!config.sendgrid.apiKey) {
      logger.warn('SendGrid API key not configured — email sending disabled');
      this.configured = false;
      return;
    }
    sgMail.setApiKey(config.sendgrid.apiKey);
    this.configured = true;
    logger.info('SendGrid client initialized');
  }

  private assertConfigured(): void {
    if (!this.configured) {
      throw new Error('SendGrid is not configured — set SENDGRID_API_KEY to enable email sending');
    }
  }

  /**
   * Send a single email
   */
  async sendEmail(message: EmailMessage): Promise<void> {
    this.assertConfigured();
    try {
      const msg: any = {
        to: message.to,
        from: {
          email: config.sendgrid.fromEmail,
          name: config.sendgrid.fromName,
        },
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments,
      };

      // Use dynamic template if provided
      if (message.templateId) {
        msg.templateId = message.templateId;
        msg.dynamicTemplateData = message.dynamicTemplateData || {};
      }

      await sgMail.send(msg);
      logger.info('Email sent successfully', { to: message.to, subject: message.subject });
    } catch (error: any) {
      logger.error('Failed to send email', { error, message });
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send multiple emails (bulk send)
   */
  async sendBulkEmails(message: BulkEmailMessage): Promise<void> {
    this.assertConfigured();
    try {
      const msg: any = {
        personalizations: message.personalizations.map((p) => ({
          to: [{ email: p.to }],
          subject: p.subject || message.subject,
          dynamicTemplateData: p.dynamicTemplateData,
        })),
        from: {
          email: config.sendgrid.fromEmail,
          name: config.sendgrid.fromName,
        },
        subject: message.subject,
        text: message.text,
        html: message.html,
      };

      // Use dynamic template if provided
      if (message.templateId) {
        msg.templateId = message.templateId;
      }

      await sgMail.send(msg);
      logger.info('Bulk emails sent successfully', {
        count: message.personalizations.length,
      });
    } catch (error: any) {
      logger.error('Failed to send bulk emails', { error, message });
      throw new Error(`Failed to send bulk emails: ${error.message}`);
    }
  }

  /**
   * Send email with template
   */
  async sendTemplateEmail(
    to: string | string[],
    templateId: string,
    dynamicTemplateData: Record<string, any>
  ): Promise<void> {
    this.assertConfigured();
    try {
      const msg = {
        to,
        from: {
          email: config.sendgrid.fromEmail,
          name: config.sendgrid.fromName,
        },
        templateId,
        dynamicTemplateData,
      };

      await sgMail.send(msg);
      logger.info('Template email sent successfully', { to, templateId });
    } catch (error: any) {
      logger.error('Failed to send template email', { error, to, templateId });
      throw new Error(`Failed to send template email: ${error.message}`);
    }
  }

  /**
   * Send invitation email
   */
  async sendInvitationEmail(
    to: string,
    invitationLink: string,
    recipientName: string
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to TechSwiftTrix ERP</h2>
        <p>Hello ${recipientName},</p>
        <p>You have been invited to join the TechSwiftTrix ERP System. Click the button below to set up your account:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${invitationLink}" 
             style="background-color: #4CAF50; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Set Up Account
          </a>
        </div>
        <p>This invitation link will expire in 72 hours.</p>
        <p>If you did not expect this invitation, please ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">
          TechSwiftTrix ERP System<br>
          This is an automated message, please do not reply.
        </p>
      </div>
    `;

    await this.sendEmail({
      to,
      subject: 'Invitation to TechSwiftTrix ERP System',
      html,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    to: string,
    resetLink: string,
    recipientName: string
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hello ${recipientName},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #2196F3; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">
          TechSwiftTrix ERP System<br>
          This is an automated message, please do not reply.
        </p>
      </div>
    `;

    await this.sendEmail({
      to,
      subject: 'Password Reset Request - TechSwiftTrix ERP',
      html,
    });
  }

  /**
   * Send notification email
   */
  async sendNotificationEmail(
    to: string,
    title: string,
    message: string,
    actionUrl?: string,
    actionText?: string
  ): Promise<void> {
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${title}</h2>
        <p>${message}</p>
    `;

    if (actionUrl && actionText) {
      html += `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${actionUrl}" 
             style="background-color: #FF9800; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; display: inline-block;">
            ${actionText}
          </a>
        </div>
      `;
    }

    html += `
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">
          TechSwiftTrix ERP System<br>
          This is an automated message, please do not reply.
        </p>
      </div>
    `;

    await this.sendEmail({
      to,
      subject: title,
      html,
    });
  }
}

export const sendgridClient = new SendGridClient();
