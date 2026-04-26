import { DarajaAPIClient } from './client';
import crypto from 'crypto';
import axios from 'axios';

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
  get: jest.fn(),
}));

jest.mock('../../config', () => ({
  config: {
    daraja: {
      apiUrl: 'https://sandbox.safaricom.co.ke',
      consumerKey: 'test-consumer-key',
      consumerSecret: 'test-consumer-secret',
      shortCode: '174379',
      passKey: 'test-pass-key',
      callbackUrl: 'http://localhost:3000',
      webhookSecret: 'test-webhook-secret',
      b2cInitiatorName: 'testapi',
      b2cSecurityCredential: 'test-credential',
    },
  },
}));

describe('DarajaAPIClient', () => {
  let client: DarajaAPIClient;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock OAuth token call
    (axios.get as jest.Mock).mockResolvedValue({ data: { access_token: 'test-token' } });
    client = new DarajaAPIClient();
  });

  describe('initiateMpesaPayment (STK Push)', () => {
    it('should initiate M-Pesa STK Push successfully', async () => {
      const mockResponse = {
        data: {
          MerchantRequestID: 'req-123',
          CheckoutRequestID: 'ws_CO_123456',
          ResponseCode: '0',
          ResponseDescription: 'Success',
          CustomerMessage: 'Success. Request accepted for processing',
        },
      };

      (client as any).client.post = jest.fn().mockResolvedValue(mockResponse);

      const result = await client.initiateMpesaPayment({
        phoneNumber: '0712345678',
        amount: 1000,
        accountReference: 'TST-2024-000001',
        transactionDesc: 'Test payment',
      });

      expect(result.status).toBe('INITIATED');
      expect(result.requestId).toBe('req-123');
      expect(result.transactionId).toBe('ws_CO_123456');
    });

    it('should handle STK Push failure', async () => {
      (client as any).client.post = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        client.initiateMpesaPayment({
          phoneNumber: '0712345678',
          amount: 1000,
          accountReference: 'TST-2024-000001',
        })
      ).rejects.toThrow('M-Pesa payment failed');
    });

    it('should return FAILED when ResponseCode is not 0', async () => {
      const mockResponse = {
        data: {
          MerchantRequestID: 'req-456',
          CheckoutRequestID: '',
          ResponseCode: '1',
          ResponseDescription: 'Rejected',
          CustomerMessage: 'Request rejected',
        },
      };

      (client as any).client.post = jest.fn().mockResolvedValue(mockResponse);

      const result = await client.initiateMpesaPayment({
        phoneNumber: '0712345678',
        amount: 1000,
        accountReference: 'TST-2024-000002',
      });

      expect(result.status).toBe('FAILED');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid webhook signature', () => {
      const payload = JSON.stringify({ Body: { stkCallback: { ResultCode: 0 } } });
      const signature = crypto
        .createHmac('sha256', 'test-webhook-secret')
        .update(payload)
        .digest('hex');

      expect(client.verifyWebhookSignature(signature, payload)).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload = JSON.stringify({ Body: { stkCallback: { ResultCode: 0 } } });
      expect(client.verifyWebhookSignature('invalid-signature', payload)).toBe(false);
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format phone number with leading zero', () => {
      expect(client.formatPhoneNumber('0712345678')).toBe('254712345678');
    });

    it('should format phone number without country code', () => {
      expect(client.formatPhoneNumber('712345678')).toBe('254712345678');
    });

    it('should keep already formatted phone number', () => {
      expect(client.formatPhoneNumber('254712345678')).toBe('254712345678');
    });

    it('should strip leading +', () => {
      expect(client.formatPhoneNumber('+254712345678')).toBe('254712345678');
    });
  });

  describe('initiateAirtelPayment', () => {
    it('should return INITIATED with a generated reference', async () => {
      const result = await client.initiateAirtelPayment({
        phoneNumber: '0733123456',
        amount: 500,
        accountReference: 'AIRTEL-REF-001',
      });

      expect(result.status).toBe('INITIATED');
      expect(result.requestId).toMatch(/^AIRTEL-/);
    });
  });

  describe('initiateCardPayment', () => {
    it('should return INITIATED with a generated reference', async () => {
      const result = await client.initiateCardPayment(
        { cardNumber: '4111111111111111', expiryMonth: '12', expiryYear: '2026', cvv: '123', cardholderName: 'Test User' },
        1000, 'KES', 'CARD-REF-001'
      );

      expect(result.status).toBe('INITIATED');
      expect(result.requestId).toMatch(/^CARD-/);
    });
  });
});
