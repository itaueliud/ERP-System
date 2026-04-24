import { JengaAPIClient } from './client';
import crypto from 'crypto';

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
    jenga: {
      apiUrl: 'https://sandbox.jengahq.io',
      apiKey: 'test-api-key',
      merchantCode: 'test-merchant',
      webhookSecret: 'test-webhook-secret',
    },
  },
}));

describe('JengaAPIClient', () => {
  let client: JengaAPIClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new JengaAPIClient();
  });

  describe('initiateMpesaPayment', () => {
    it('should initiate M-Pesa payment successfully', async () => {
      const mockResponse = {
        data: {
          requestId: 'req-123',
          status: 'INITIATED',
          message: 'Payment initiated',
          transactionId: 'txn-123',
        },
      };

      (client as any).client.post = jest.fn().mockResolvedValue(mockResponse);

      const result = await client.initiateMpesaPayment({
        phoneNumber: '0712345678',
        amount: 1000,
        currency: 'KES',
        reference: 'TST-2024-000001',
      });

      expect(result).toEqual({
        requestId: 'req-123',
        status: 'INITIATED',
        message: 'Payment initiated',
        transactionId: 'txn-123',
      });
    });

    it('should handle payment failure', async () => {
      (client as any).client.post = jest.fn().mockRejectedValue(new Error('Payment failed'));

      await expect(
        client.initiateMpesaPayment({
          phoneNumber: '0712345678',
          amount: 1000,
          currency: 'KES',
          reference: 'TST-2024-000001',
        })
      ).rejects.toThrow('M-Pesa payment failed');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid webhook signature', () => {
      const payload = JSON.stringify({ transactionId: 'txn-123' });
      const signature = crypto
        .createHmac('sha256', 'test-webhook-secret')
        .update(payload)
        .digest('hex');

      const isValid = client.verifyWebhookSignature(signature, payload);

      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload = JSON.stringify({ transactionId: 'txn-123' });
      const invalidSignature = 'invalid-signature';

      const isValid = client.verifyWebhookSignature(invalidSignature, payload);

      expect(isValid).toBe(false);
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format phone number with leading zero', () => {
      const formatted = (client as any).formatPhoneNumber('0712345678');
      expect(formatted).toBe('254712345678');
    });

    it('should format phone number without country code', () => {
      const formatted = (client as any).formatPhoneNumber('712345678');
      expect(formatted).toBe('254712345678');
    });

    it('should keep already formatted phone number', () => {
      const formatted = (client as any).formatPhoneNumber('254712345678');
      expect(formatted).toBe('254712345678');
    });
  });
});
