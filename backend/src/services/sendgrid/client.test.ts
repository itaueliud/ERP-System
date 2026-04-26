import { SendGridClient } from './client';
import sgMail from '@sendgrid/mail';

jest.mock('@sendgrid/mail');
jest.mock('../../config', () => ({
  config: {
    sendgrid: {
      apiKey: 'test-api-key',
      fromEmail: 'test@techswifttrix.com',
      fromName: 'TechSwiftTrix ERP',
    },
  },
}));

describe('SendGridClient', () => {
  let client: SendGridClient;
  const mockedSgMail = sgMail as jest.Mocked<typeof sgMail>;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new SendGridClient();
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      mockedSgMail.send = jest.fn().mockResolvedValue([{ statusCode: 202 }]);

      await client.sendEmail({
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'Test message',
        html: '<p>Test message</p>',
      });

      expect(mockedSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@example.com',
          subject: 'Test Email',
          text: 'Test message',
          html: '<p>Test message</p>',
        })
      );
    });

    it('should send email with template', async () => {
      mockedSgMail.send = jest.fn().mockResolvedValue([{ statusCode: 202 }]);

      await client.sendEmail({
        to: 'recipient@example.com',
        subject: 'Test Email',
        templateId: 'template-123',
        dynamicTemplateData: { name: 'John' },
      });

      expect(mockedSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 'template-123',
          dynamicTemplateData: { name: 'John' },
        })
      );
    });

    it('should handle send failure', async () => {
      mockedSgMail.send = jest.fn().mockRejectedValue(new Error('Send failed'));

      await expect(
        client.sendEmail({
          to: 'recipient@example.com',
          subject: 'Test',
          text: 'Test',
        })
      ).rejects.toThrow('Failed to send email');
    });
  });

  describe('sendBulkEmails', () => {
    it('should send bulk emails successfully', async () => {
      mockedSgMail.send = jest.fn().mockResolvedValue([{ statusCode: 202 }]);

      await client.sendBulkEmails({
        personalizations: [
          { to: 'user1@example.com', subject: 'Test 1' },
          { to: 'user2@example.com', subject: 'Test 2' },
        ],
        subject: 'Default Subject',
        text: 'Test message',
      });

      expect(mockedSgMail.send).toHaveBeenCalled();
    });
  });

  describe('sendInvitationEmail', () => {
    it('should send invitation email with correct content', async () => {
      mockedSgMail.send = jest.fn().mockResolvedValue([{ statusCode: 202 }]);

      await client.sendInvitationEmail(
        'newuser@example.com',
        'https://app.tst.com/register?token=abc123',
        'John Doe'
      );

      expect(mockedSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'newuser@example.com',
          subject: 'Invitation to TechSwiftTrix ERP System',
        })
      );

      const callArgs = (mockedSgMail.send as jest.Mock).mock.calls[0][0];
      expect(callArgs.html).toContain('John Doe');
      expect(callArgs.html).toContain('https://app.tst.com/register?token=abc123');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with correct content', async () => {
      mockedSgMail.send = jest.fn().mockResolvedValue([{ statusCode: 202 }]);

      await client.sendPasswordResetEmail(
        'user@example.com',
        'https://app.tst.com/reset?token=xyz789',
        'Jane Smith'
      );

      expect(mockedSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Password Reset Request - TechSwiftTrix ERP',
        })
      );

      const callArgs = (mockedSgMail.send as jest.Mock).mock.calls[0][0];
      expect(callArgs.html).toContain('Jane Smith');
      expect(callArgs.html).toContain('https://app.tst.com/reset?token=xyz789');
    });
  });

  describe('sendNotificationEmail', () => {
    it('should send notification email without action button', async () => {
      mockedSgMail.send = jest.fn().mockResolvedValue([{ statusCode: 202 }]);

      await client.sendNotificationEmail(
        'user@example.com',
        'Payment Approved',
        'Your payment has been approved.'
      );

      expect(mockedSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Payment Approved',
        })
      );
    });

    it('should send notification email with action button', async () => {
      mockedSgMail.send = jest.fn().mockResolvedValue([{ statusCode: 202 }]);

      await client.sendNotificationEmail(
        'user@example.com',
        'New Task Assigned',
        'You have been assigned a new task.',
        'https://app.tst.com/tasks/123',
        'View Task'
      );

      const callArgs = (mockedSgMail.send as jest.Mock).mock.calls[0][0];
      expect(callArgs.html).toContain('View Task');
      expect(callArgs.html).toContain('https://app.tst.com/tasks/123');
    });
  });
});
