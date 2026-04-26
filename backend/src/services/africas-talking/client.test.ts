import { AfricasTalkingClient } from './client';

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
}));
jest.mock('../../config', () => ({
  config: {
    africasTalking: {
      username: 'test-username',
      apiKey: 'test-api-key',
      senderId: 'TestSender',
    },
  },
}));

describe('AfricasTalkingClient', () => {
  let client: AfricasTalkingClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new AfricasTalkingClient();
  });

  describe('sendSMS', () => {
    it('should send SMS to single recipient successfully', async () => {
      const mockResponse = {
        data: {
          SMSMessageData: {
            Message: 'Sent to 1/1 Total Cost: KES 0.8000',
            Recipients: [
              {
                number: '+254712345678',
                status: 'Success',
                messageId: 'ATXid_123',
                cost: 'KES 0.8000',
              },
            ],
          },
        },
      };

      (client as any).client.post = jest.fn().mockResolvedValue(mockResponse);

      const result = await client.sendSMS({
        to: '+254712345678',
        message: 'Test message',
      });

      expect(result.recipients).toHaveLength(1);
      expect(result.recipients[0].status).toBe('Success');
      expect(result.recipients[0].number).toBe('+254712345678');
    });

    it('should send SMS to multiple recipients', async () => {
      const mockResponse = {
        data: {
          SMSMessageData: {
            Message: 'Sent to 2/2 Total Cost: KES 1.6000',
            Recipients: [
              {
                number: '+254712345678',
                status: 'Success',
                messageId: 'ATXid_123',
                cost: 'KES 0.8000',
              },
              {
                number: '+254787654321',
                status: 'Success',
                messageId: 'ATXid_124',
                cost: 'KES 0.8000',
              },
            ],
          },
        },
      };

      (client as any).client.post = jest.fn().mockResolvedValue(mockResponse);

      const result = await client.sendSMS({
        to: ['+254712345678', '+254787654321'],
        message: 'Test message',
      });

      expect(result.recipients).toHaveLength(2);
      expect(result.recipients.every((r) => r.status === 'Success')).toBe(true);
    });

    it('should handle SMS sending failure', async () => {
      (client as any).client.post = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        client.sendSMS({
          to: '+254712345678',
          message: 'Test message',
        })
      ).rejects.toThrow('Failed to send SMS');
    });
  });

  describe('sendOTP', () => {
    it('should send OTP SMS successfully', async () => {
      const mockResponse = {
        data: {
          SMSMessageData: {
            Message: 'Sent to 1/1 Total Cost: KES 0.8000',
            Recipients: [
              {
                number: '+254712345678',
                status: 'Success',
                messageId: 'ATXid_123',
                cost: 'KES 0.8000',
              },
            ],
          },
        },
      };

      (client as any).client.post = jest.fn().mockResolvedValue(mockResponse);

      const result = await client.sendOTP('+254712345678', '123456');

      expect(result.recipients[0].status).toBe('Success');
      expect((client as any).client.post).toHaveBeenCalled();
    });
  });

  describe('sendPaymentConfirmation', () => {
    it('should send payment confirmation SMS successfully', async () => {
      const mockResponse = {
        data: {
          SMSMessageData: {
            Message: 'Sent to 1/1 Total Cost: KES 0.8000',
            Recipients: [
              {
                number: '+254712345678',
                status: 'Success',
                messageId: 'ATXid_123',
                cost: 'KES 0.8000',
              },
            ],
          },
        },
      };

      (client as any).client.post = jest.fn().mockResolvedValue(mockResponse);

      const result = await client.sendPaymentConfirmation(
        '+254712345678',
        1000,
        'KES',
        'TXN-123'
      );

      expect(result.recipients[0].status).toBe('Success');
    });
  });

  describe('sendNotificationSMS', () => {
    it('should send notification SMS successfully', async () => {
      const mockResponse = {
        data: {
          SMSMessageData: {
            Message: 'Sent to 1/1 Total Cost: KES 0.8000',
            Recipients: [
              {
                number: '+254712345678',
                status: 'Success',
                messageId: 'ATXid_123',
                cost: 'KES 0.8000',
              },
            ],
          },
        },
      };

      (client as any).client.post = jest.fn().mockResolvedValue(mockResponse);

      const result = await client.sendNotificationSMS(
        '+254712345678',
        'Alert',
        'This is a test notification'
      );

      expect(result.recipients[0].status).toBe('Success');
    });
  });

  describe('fetchDeliveryReports', () => {
    it('should fetch delivery reports successfully', async () => {
      const mockResponse = {
        data: {
          SMSMessageData: {
            DeliveryReports: [
              {
                id: 'ATXid_123',
                phoneNumber: '+254712345678',
                status: 'Success',
                networkCode: '63902',
                retryCount: 0,
              },
            ],
          },
        },
      };

      (client as any).client.get = jest.fn().mockResolvedValue(mockResponse);

      const reports = await client.fetchDeliveryReports('ATXid_123');

      expect(reports).toHaveLength(1);
      expect(reports[0].status).toBe('Success');
      expect(reports[0].phoneNumber).toBe('+254712345678');
    });

    it('should handle delivery report fetch failure', async () => {
      (client as any).client.get = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(client.fetchDeliveryReports('ATXid_123')).rejects.toThrow(
        'Failed to fetch delivery reports'
      );
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format phone number with leading zero', () => {
      const formatted = client.formatPhoneNumber('0712345678', '254');
      expect(formatted).toBe('+254712345678');
    });

    it('should format phone number without country code', () => {
      const formatted = client.formatPhoneNumber('712345678', '254');
      expect(formatted).toBe('+254712345678');
    });

    it('should keep already formatted phone number', () => {
      const formatted = client.formatPhoneNumber('254712345678', '254');
      expect(formatted).toBe('+254712345678');
    });

    it('should add plus sign if missing', () => {
      const formatted = client.formatPhoneNumber('254712345678', '254');
      expect(formatted).toBe('+254712345678');
    });
  });

  describe('sendBulkSMS', () => {
    it('should send bulk SMS messages', async () => {
      const mockResponse = {
        data: {
          SMSMessageData: {
            Message: 'Sent to 1/1 Total Cost: KES 0.8000',
            Recipients: [
              {
                number: '+254712345678',
                status: 'Success',
                messageId: 'ATXid_123',
                cost: 'KES 0.8000',
              },
            ],
          },
        },
      };

      (client as any).client.post = jest.fn().mockResolvedValue(mockResponse);

      const messages = [
        { to: '+254712345678', message: 'Message 1' },
        { to: '+254787654321', message: 'Message 2' },
      ];

      const results = await client.sendBulkSMS(messages);

      expect(results).toHaveLength(2);
      expect((client as any).client.post).toHaveBeenCalledTimes(2);
    });

    it('should continue sending even if one message fails', async () => {
      (client as any).client.post = jest
        .fn()
        .mockResolvedValueOnce({
          data: {
            SMSMessageData: {
              Message: 'Sent',
              Recipients: [{ number: '+254712345678', status: 'Success', messageId: '1', cost: '0.8' }],
            },
          },
        })
        .mockRejectedValueOnce(new Error('Failed'));

      const messages = [
        { to: '+254712345678', message: 'Message 1' },
        { to: '+254787654321', message: 'Message 2' },
      ];

      const results = await client.sendBulkSMS(messages);

      expect(results).toHaveLength(1); // Only successful one
    });
  });

  describe('sendReminder', () => {
    it('should send reminder SMS successfully', async () => {
      const mockResponse = {
        data: {
          SMSMessageData: {
            Message: 'Sent to 1/1 Total Cost: KES 0.8000',
            Recipients: [
              {
                number: '+254712345678',
                status: 'Success',
                messageId: 'ATXid_123',
                cost: 'KES 0.8000',
              },
            ],
          },
        },
      };

      (client as any).client.post = jest.fn().mockResolvedValue(mockResponse);

      const result = await client.sendReminder(
        '+254712345678',
        'Daily Report',
        'Please submit your daily report by 10 PM'
      );

      expect(result.recipients[0].status).toBe('Success');
    });
  });
});
