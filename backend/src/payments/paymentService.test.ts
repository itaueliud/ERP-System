import { PaymentProcessingService, PaymentMethod, PaymentStatus } from './paymentService';
import { db } from '../database/connection';
import { jengaClient } from '../services/jenga';

// Mock dependencies
jest.mock('../database/connection');
jest.mock('../services/jenga');
jest.mock('../utils/logger');
jest.mock('../config', () => ({
  config: {
    apiBaseUrl: 'http://localhost:3000',
    logging: {
      level: 'info',
      filePath: '/tmp/test.log',
    },
    database: {
      host: 'localhost',
      port: 5432,
      name: 'test',
      user: 'test',
      password: 'test',
    },
    jenga: {
      apiUrl: 'https://sandbox.jengahq.io',
      apiKey: 'test-api-key',
      merchantCode: 'test-merchant',
      webhookSecret: 'test-webhook-secret',
    },
  },
}));

describe('PaymentProcessingService', () => {
  let service: PaymentProcessingService;
  let mockQuery: jest.Mock;
  let mockInitiateMpesaPayment: jest.Mock;
  let mockInitiateAirtelPayment: jest.Mock;
  let mockInitiateBankTransfer: jest.Mock;
  let mockInitiateCardPayment: jest.Mock;
  let mockVerifyWebhookSignature: jest.Mock;
  let mockGetPaymentStatus: jest.Mock;

  beforeEach(() => {
    service = new PaymentProcessingService();
    mockQuery = jest.fn();
    (db.query as jest.Mock) = mockQuery;

    mockInitiateMpesaPayment = jest.fn();
    mockInitiateAirtelPayment = jest.fn();
    mockInitiateBankTransfer = jest.fn();
    mockInitiateCardPayment = jest.fn();
    mockVerifyWebhookSignature = jest.fn();
    mockGetPaymentStatus = jest.fn();

    (jengaClient.initiateMpesaPayment as jest.Mock) = mockInitiateMpesaPayment;
    (jengaClient.initiateAirtelPayment as jest.Mock) = mockInitiateAirtelPayment;
    (jengaClient.initiateBankTransfer as jest.Mock) = mockInitiateBankTransfer;
    (jengaClient.initiateCardPayment as jest.Mock) = mockInitiateCardPayment;
    (jengaClient.verifyWebhookSignature as jest.Mock) = mockVerifyWebhookSignature;
    (jengaClient.getPaymentStatus as jest.Mock) = mockGetPaymentStatus;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateMpesaPayment', () => {
    it('should initiate M-Pesa payment successfully', async () => {
      const input = {
        phoneNumber: '+254712345678',
        amount: 1000,
        currency: 'KES',
        reference: 'TEST-REF-001',
        description: 'Test payment',
        clientId: 'client-123',
      };

      mockInitiateMpesaPayment.mockResolvedValue({
        requestId: 'req-123',
        transactionId: 'txn-123',
        status: 'INITIATED',
        message: 'Payment initiated',
      });

      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'payment-123',
            transaction_id: 'txn-123',
            amount: '1000',
            currency: 'KES',
            payment_method: 'MPESA',
            status: 'PENDING',
            client_id: 'client-123',
            project_id: null,
            error_code: null,
            error_message: null,
            created_at: new Date(),
          },
        ],
      });

      const result = await service.initiateMpesaPayment(input);

      expect(mockInitiateMpesaPayment).toHaveBeenCalledWith({
        phoneNumber: input.phoneNumber,
        amount: input.amount,
        currency: input.currency,
        reference: input.reference,
        description: input.description,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payments'),
        expect.arrayContaining(['txn-123', 1000, 'KES', 'MPESA', 'PENDING', 'client-123'])
      );

      expect(result.transactionId).toBe('txn-123');
      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(result.paymentMethod).toBe(PaymentMethod.MPESA);
    });

    it('should throw error for invalid amount', async () => {
      const input = {
        phoneNumber: '+254712345678',
        amount: 0,
        currency: 'KES',
        reference: 'TEST-REF-001',
      };

      await expect(service.initiateMpesaPayment(input)).rejects.toThrow(
        'Payment amount must be greater than 0'
      );
    });

    it('should throw error for missing phone number', async () => {
      const input = {
        phoneNumber: '',
        amount: 1000,
        currency: 'KES',
        reference: 'TEST-REF-001',
      };

      await expect(service.initiateMpesaPayment(input)).rejects.toThrow(
        'Phone number is required for M-Pesa payment'
      );
    });

    it('should handle failed payment initiation', async () => {
      const input = {
        phoneNumber: '+254712345678',
        amount: 1000,
        currency: 'KES',
        reference: 'TEST-REF-001',
      };

      mockInitiateMpesaPayment.mockResolvedValue({
        requestId: 'req-123',
        status: 'FAILED',
        message: 'Insufficient funds',
      });

      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'payment-123',
            transaction_id: 'req-123',
            amount: '1000',
            currency: 'KES',
            payment_method: 'MPESA',
            status: 'FAILED',
            client_id: null,
            project_id: null,
            error_code: 'INITIATION_FAILED',
            error_message: 'Insufficient funds',
            created_at: new Date(),
          },
        ],
      });

      const result = await service.initiateMpesaPayment(input);

      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.errorCode).toBe('INITIATION_FAILED');
      expect(result.errorMessage).toBe('Insufficient funds');
    });
  });

  describe('initiateAirtelPayment', () => {
    it('should initiate Airtel Money payment successfully', async () => {
      const input = {
        phoneNumber: '+254712345678',
        amount: 500,
        currency: 'KES',
        reference: 'TEST-REF-002',
      };

      mockInitiateAirtelPayment.mockResolvedValue({
        requestId: 'req-456',
        transactionId: 'txn-456',
        status: 'INITIATED',
        message: 'Payment initiated',
      });

      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'payment-456',
            transaction_id: 'txn-456',
            amount: '500',
            currency: 'KES',
            payment_method: 'AIRTEL_MONEY',
            status: 'PENDING',
            client_id: null,
            project_id: null,
            error_code: null,
            error_message: null,
            created_at: new Date(),
          },
        ],
      });

      const result = await service.initiateAirtelPayment(input);

      expect(result.transactionId).toBe('txn-456');
      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(result.paymentMethod).toBe(PaymentMethod.AIRTEL_MONEY);
    });
  });

  describe('initiateBankTransfer', () => {
    it('should initiate bank transfer successfully', async () => {
      const input = {
        accountNumber: '1234567890',
        bankCode: 'EQUITY',
        amount: 5000,
        currency: 'KES',
        reference: 'TEST-REF-003',
      };

      mockInitiateBankTransfer.mockResolvedValue({
        requestId: 'req-789',
        transactionId: 'txn-789',
        status: 'INITIATED',
        message: 'Transfer initiated',
      });

      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'payment-789',
            transaction_id: 'txn-789',
            amount: '5000',
            currency: 'KES',
            payment_method: 'BANK_TRANSFER',
            status: 'PENDING',
            client_id: null,
            project_id: null,
            error_code: null,
            error_message: null,
            created_at: new Date(),
          },
        ],
      });

      const result = await service.initiateBankTransfer(input);

      expect(mockInitiateBankTransfer).toHaveBeenCalledWith(
        input.accountNumber,
        input.bankCode,
        input.amount,
        input.currency,
        input.reference
      );

      expect(result.transactionId).toBe('txn-789');
      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(result.paymentMethod).toBe(PaymentMethod.BANK_TRANSFER);
    });

    it('should throw error for missing account number', async () => {
      const input = {
        accountNumber: '',
        bankCode: 'EQUITY',
        amount: 5000,
        currency: 'KES',
        reference: 'TEST-REF-003',
      };

      await expect(service.initiateBankTransfer(input)).rejects.toThrow(
        'Account number is required for bank transfer'
      );
    });

    it('should throw error for missing bank code', async () => {
      const input = {
        accountNumber: '1234567890',
        bankCode: '',
        amount: 5000,
        currency: 'KES',
        reference: 'TEST-REF-003',
      };

      await expect(service.initiateBankTransfer(input)).rejects.toThrow(
        'Bank code is required for bank transfer'
      );
    });
  });

  describe('initiateCardPayment', () => {
    it('should initiate Visa card payment successfully', async () => {
      const input = {
        cardNumber: '4111111111111111',
        expiryMonth: '12',
        expiryYear: '2025',
        cvv: '123',
        cardholderName: 'John Doe',
        amount: 2000,
        currency: 'USD',
        reference: 'TEST-REF-004',
      };

      mockInitiateCardPayment.mockResolvedValue({
        requestId: 'req-card-123',
        transactionId: 'txn-card-123',
        status: 'INITIATED',
        message: 'Payment initiated',
      });

      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'payment-card-123',
            transaction_id: 'txn-card-123',
            amount: '2000',
            currency: 'USD',
            payment_method: 'VISA',
            status: 'PENDING',
            client_id: null,
            project_id: null,
            error_code: null,
            error_message: null,
            created_at: new Date(),
          },
        ],
      });

      const result = await service.initiateCardPayment(input);

      expect(result.transactionId).toBe('txn-card-123');
      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(result.paymentMethod).toBe(PaymentMethod.VISA);
    });

    it('should initiate Mastercard payment successfully', async () => {
      const input = {
        cardNumber: '5555555555554444',
        expiryMonth: '12',
        expiryYear: '2025',
        cvv: '123',
        cardholderName: 'Jane Doe',
        amount: 3000,
        currency: 'USD',
        reference: 'TEST-REF-005',
      };

      mockInitiateCardPayment.mockResolvedValue({
        requestId: 'req-card-456',
        transactionId: 'txn-card-456',
        status: 'INITIATED',
        message: 'Payment initiated',
      });

      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'payment-card-456',
            transaction_id: 'txn-card-456',
            amount: '3000',
            currency: 'USD',
            payment_method: 'MASTERCARD',
            status: 'PENDING',
            client_id: null,
            project_id: null,
            error_code: null,
            error_message: null,
            created_at: new Date(),
          },
        ],
      });

      const result = await service.initiateCardPayment(input);

      expect(result.paymentMethod).toBe(PaymentMethod.MASTERCARD);
    });

    it('should throw error for incomplete card details', async () => {
      const input = {
        cardNumber: '4111111111111111',
        expiryMonth: '',
        expiryYear: '2025',
        cvv: '123',
        cardholderName: 'John Doe',
        amount: 2000,
        currency: 'USD',
        reference: 'TEST-REF-004',
      };

      await expect(service.initiateCardPayment(input)).rejects.toThrow(
        'Complete card details are required'
      );
    });
  });

  describe('getPaymentStatus', () => {
    it('should retrieve payment status successfully', async () => {
      const transactionId = 'txn-123';

      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'payment-123',
            transaction_id: 'txn-123',
            amount: '1000',
            currency: 'KES',
            payment_method: 'MPESA',
            status: 'COMPLETED',
            client_id: 'client-123',
            project_id: null,
            error_code: null,
            error_message: null,
            created_at: new Date(),
          },
        ],
      });

      const result = await service.getPaymentStatus(transactionId);

      expect(result).not.toBeNull();
      expect(result!.transactionId).toBe('txn-123');
      expect(result!.status).toBe(PaymentStatus.COMPLETED);
    });

    it('should return null for non-existent payment', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await service.getPaymentStatus('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('handleWebhook', () => {
    it('should handle valid webhook successfully', async () => {
      const signature = 'valid-signature';
      const payload = {
        transactionId: 'txn-123',
        status: 'COMPLETED',
        amount: 1000,
        currency: 'KES',
        reference: 'TEST-REF-001',
        timestamp: new Date().toISOString(),
      };

      mockVerifyWebhookSignature.mockReturnValue(true);
      mockQuery.mockResolvedValue({ rows: [] });

      await service.handleWebhook(signature, payload);

      expect(mockVerifyWebhookSignature).toHaveBeenCalledWith(signature, JSON.stringify(payload));
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payments'),
        expect.arrayContaining(['COMPLETED', null, null, 'txn-123'])
      );
    });

    it('should reject invalid webhook signature', async () => {
      const signature = 'invalid-signature';
      const payload = {
        transactionId: 'txn-123',
        status: 'COMPLETED',
      };

      mockVerifyWebhookSignature.mockReturnValue(false);

      await expect(service.handleWebhook(signature, payload)).rejects.toThrow(
        'Invalid webhook signature'
      );
    });

    it('should handle failed payment webhook', async () => {
      const signature = 'valid-signature';
      const payload = {
        transactionId: 'txn-456',
        status: 'FAILED',
        errorCode: 'INSUFFICIENT_FUNDS',
        errorMessage: 'Insufficient funds in account',
      };

      mockVerifyWebhookSignature.mockReturnValue(true);
      mockQuery.mockResolvedValue({ rows: [] });

      await service.handleWebhook(signature, payload);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payments'),
        expect.arrayContaining([
          'FAILED',
          'INSUFFICIENT_FUNDS',
          'Insufficient funds in account',
          'txn-456',
        ])
      );
    });
  });

  describe('retryPayment', () => {
    it('should retry failed payment successfully', async () => {
      const transactionId = 'txn-failed';

      // First call to getPaymentStatus (internal)
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'payment-failed',
            transaction_id: 'txn-failed',
            amount: '1000',
            currency: 'KES',
            payment_method: 'MPESA',
            status: 'FAILED',
            client_id: null,
            project_id: null,
            error_code: 'TIMEOUT',
            error_message: 'Request timeout',
            created_at: new Date(),
          },
        ],
      });

      mockGetPaymentStatus.mockResolvedValue({
        status: 'COMPLETED',
        errorCode: null,
        errorMessage: null,
      });

      // Update query
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // Second call to getPaymentStatus (internal)
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'payment-failed',
            transaction_id: 'txn-failed',
            amount: '1000',
            currency: 'KES',
            payment_method: 'MPESA',
            status: 'COMPLETED',
            client_id: null,
            project_id: null,
            error_code: null,
            error_message: null,
            created_at: new Date(),
          },
        ],
      });

      const result = await service.retryPayment(transactionId);

      expect(result.status).toBe(PaymentStatus.COMPLETED);
      expect(mockGetPaymentStatus).toHaveBeenCalledWith(transactionId);
    });

    it('should throw error for non-existent payment', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await expect(service.retryPayment('non-existent')).rejects.toThrow('Payment not found');
    });

    it('should throw error for non-failed payment', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'payment-123',
            transaction_id: 'txn-123',
            amount: '1000',
            currency: 'KES',
            payment_method: 'MPESA',
            status: 'COMPLETED',
            client_id: null,
            project_id: null,
            error_code: null,
            error_message: null,
            created_at: new Date(),
          },
        ],
      });

      await expect(service.retryPayment('txn-123')).rejects.toThrow(
        'Only failed payments can be retried'
      );
    });

    it('should handle payment still failed after retry', async () => {
      const transactionId = 'txn-still-failed';

      // First call to getPaymentStatus (internal)
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'payment-still-failed',
            transaction_id: 'txn-still-failed',
            amount: '2000',
            currency: 'KES',
            payment_method: 'MPESA',
            status: 'FAILED',
            client_id: null,
            project_id: null,
            error_code: 'INSUFFICIENT_FUNDS',
            error_message: 'Insufficient funds',
            created_at: new Date(),
          },
        ],
      });

      mockGetPaymentStatus.mockResolvedValue({
        status: 'FAILED',
        errorCode: 'INSUFFICIENT_FUNDS',
        errorMessage: 'Insufficient funds in account',
      });

      // Update query
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // Second call to getPaymentStatus (internal)
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'payment-still-failed',
            transaction_id: 'txn-still-failed',
            amount: '2000',
            currency: 'KES',
            payment_method: 'MPESA',
            status: 'FAILED',
            client_id: null,
            project_id: null,
            error_code: 'INSUFFICIENT_FUNDS',
            error_message: 'Insufficient funds in account',
            created_at: new Date(),
          },
        ],
      });

      const result = await service.retryPayment(transactionId);

      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.errorCode).toBe('INSUFFICIENT_FUNDS');
      expect(result.errorMessage).toBe('Insufficient funds in account');
      expect(mockGetPaymentStatus).toHaveBeenCalledWith(transactionId);
    });

    it('should throw error for pending payment', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'payment-pending',
            transaction_id: 'txn-pending',
            amount: '1500',
            currency: 'KES',
            payment_method: 'MPESA',
            status: 'PENDING',
            client_id: null,
            project_id: null,
            error_code: null,
            error_message: null,
            created_at: new Date(),
          },
        ],
      });

      await expect(service.retryPayment('txn-pending')).rejects.toThrow(
        'Only failed payments can be retried'
      );
    });

    it('should update error details when retrying', async () => {
      const transactionId = 'txn-retry-update';

      // First call to getPaymentStatus (internal)
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'payment-retry-update',
            transaction_id: 'txn-retry-update',
            amount: '3000',
            currency: 'USD',
            payment_method: 'BANK_TRANSFER',
            status: 'FAILED',
            client_id: null,
            project_id: 'project-123',
            error_code: 'NETWORK_ERROR',
            error_message: 'Network timeout',
            created_at: new Date(),
          },
        ],
      });

      mockGetPaymentStatus.mockResolvedValue({
        status: 'FAILED',
        errorCode: 'INVALID_ACCOUNT',
        errorMessage: 'Invalid bank account number',
      });

      // Update query
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // Second call to getPaymentStatus (internal)
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'payment-retry-update',
            transaction_id: 'txn-retry-update',
            amount: '3000',
            currency: 'USD',
            payment_method: 'BANK_TRANSFER',
            status: 'FAILED',
            client_id: null,
            project_id: 'project-123',
            error_code: 'INVALID_ACCOUNT',
            error_message: 'Invalid bank account number',
            created_at: new Date(),
          },
        ],
      });

      const result = await service.retryPayment(transactionId);

      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.errorCode).toBe('INVALID_ACCOUNT');
      expect(result.errorMessage).toBe('Invalid bank account number');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payments'),
        ['FAILED', 'INVALID_ACCOUNT', 'Invalid bank account number', transactionId]
      );
    });

    it('should clear error details when payment succeeds on retry', async () => {
      const transactionId = 'txn-retry-success';

      // First call to getPaymentStatus (internal)
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'payment-retry-success',
            transaction_id: 'txn-retry-success',
            amount: '5000',
            currency: 'KES',
            payment_method: 'AIRTEL_MONEY',
            status: 'FAILED',
            client_id: 'client-456',
            project_id: null,
            error_code: 'TIMEOUT',
            error_message: 'Request timeout',
            created_at: new Date(),
          },
        ],
      });

      mockGetPaymentStatus.mockResolvedValue({
        status: 'COMPLETED',
        errorCode: null,
        errorMessage: null,
      });

      // Update query
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // Second call to getPaymentStatus (internal)
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'payment-retry-success',
            transaction_id: 'txn-retry-success',
            amount: '5000',
            currency: 'KES',
            payment_method: 'AIRTEL_MONEY',
            status: 'COMPLETED',
            client_id: 'client-456',
            project_id: null,
            error_code: null,
            error_message: null,
            created_at: new Date(),
          },
        ],
      });

      const result = await service.retryPayment(transactionId);

      expect(result.status).toBe(PaymentStatus.COMPLETED);
      expect(result.errorCode).toBeNull();
      expect(result.errorMessage).toBeNull();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payments'),
        ['COMPLETED', null, null, transactionId]
      );
    });
  });

  describe('initiateCommitmentPayment', () => {
    it('should initiate commitment payment for client successfully', async () => {
      const clientId = 'client-123';
      const phoneNumber = '+254712345678';
      const amount = 5000;
      const currency = 'KES';

      mockInitiateMpesaPayment.mockResolvedValue({
        requestId: 'req-commit-123',
        transactionId: 'txn-commit-123',
        status: 'INITIATED',
        message: 'Payment initiated',
      });

      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'payment-commit-123',
            transaction_id: 'txn-commit-123',
            amount: '5000',
            currency: 'KES',
            payment_method: 'MPESA',
            status: 'PENDING',
            client_id: 'client-123',
            project_id: null,
            error_code: null,
            error_message: null,
            created_at: new Date(),
          },
        ],
      });

      const result = await service.initiateCommitmentPayment(clientId, phoneNumber, amount, currency);

      expect(mockInitiateMpesaPayment).toHaveBeenCalledWith({
        phoneNumber,
        amount,
        currency,
        reference: expect.stringContaining(`COMMIT-${clientId}`),
        description: 'Commitment Payment',
      });

      expect(result.transactionId).toBe('txn-commit-123');
      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(result.clientId).toBe(clientId);
      expect(result.paymentMethod).toBe(PaymentMethod.MPESA);
    });

    it('should use default currency KES if not provided', async () => {
      const clientId = 'client-456';
      const phoneNumber = '+254712345678';
      const amount = 3000;

      mockInitiateMpesaPayment.mockResolvedValue({
        requestId: 'req-commit-456',
        transactionId: 'txn-commit-456',
        status: 'INITIATED',
        message: 'Payment initiated',
      });

      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'payment-commit-456',
            transaction_id: 'txn-commit-456',
            amount: '3000',
            currency: 'KES',
            payment_method: 'MPESA',
            status: 'PENDING',
            client_id: 'client-456',
            project_id: null,
            error_code: null,
            error_message: null,
            created_at: new Date(),
          },
        ],
      });

      const result = await service.initiateCommitmentPayment(clientId, phoneNumber, amount);

      expect(mockInitiateMpesaPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'KES',
        })
      );

      expect(result.currency).toBe('KES');
    });

    it('should generate unique reference for each commitment payment', async () => {
      const clientId = 'client-789';
      const phoneNumber = '+254712345678';
      const amount = 2000;

      mockInitiateMpesaPayment.mockResolvedValue({
        requestId: 'req-commit-789',
        transactionId: 'txn-commit-789',
        status: 'INITIATED',
        message: 'Payment initiated',
      });

      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'payment-commit-789',
            transaction_id: 'txn-commit-789',
            amount: '2000',
            currency: 'KES',
            payment_method: 'MPESA',
            status: 'PENDING',
            client_id: 'client-789',
            project_id: null,
            error_code: null,
            error_message: null,
            created_at: new Date(),
          },
        ],
      });

      await service.initiateCommitmentPayment(clientId, phoneNumber, amount);

      expect(mockInitiateMpesaPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: expect.stringMatching(/^COMMIT-client-789-\d+$/),
        })
      );
    });
  });

  describe('handleWebhook - commitment payment auto-conversion', () => {
    it('should auto-convert client to LEAD when commitment payment succeeds', async () => {
      const signature = 'valid-signature';
      const payload = {
        transactionId: 'txn-commit-123',
        status: 'COMPLETED',
        amount: 5000,
        currency: 'KES',
      };

      mockVerifyWebhookSignature.mockReturnValue(true);

      // Update payment status
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // Check if payment has client_id
      mockQuery.mockResolvedValueOnce({
        rows: [{ client_id: 'client-123' }],
      });

      await service.handleWebhook(signature, payload);

      expect(mockVerifyWebhookSignature).toHaveBeenCalledWith(signature, JSON.stringify(payload));
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payments'),
        expect.arrayContaining(['COMPLETED', null, null, 'txn-commit-123'])
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT client_id FROM payments'),
        ['txn-commit-123']
      );
    });

    it('should not attempt conversion if payment has no client_id', async () => {
      const signature = 'valid-signature';
      const payload = {
        transactionId: 'txn-project-123',
        status: 'COMPLETED',
        amount: 10000,
        currency: 'USD',
      };

      mockVerifyWebhookSignature.mockReturnValue(true);

      // Update payment status
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // Check if payment has client_id - returns empty
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.handleWebhook(signature, payload);

      expect(mockQuery).toHaveBeenCalledTimes(2);
      // Should not attempt to import clientService
    });

    it('should not attempt conversion if payment failed', async () => {
      const signature = 'valid-signature';
      const payload = {
        transactionId: 'txn-commit-failed',
        status: 'FAILED',
        errorCode: 'INSUFFICIENT_FUNDS',
        errorMessage: 'Insufficient funds',
      };

      mockVerifyWebhookSignature.mockReturnValue(true);

      // Update payment status
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.handleWebhook(signature, payload);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      // Should not check for client_id since payment failed
    });
  });
});


describe('Payment Approval Workflow', () => {
  let service: PaymentProcessingService;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    service = new PaymentProcessingService();
    mockQuery = jest.fn();
    (db.query as jest.Mock) = mockQuery;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createApprovalRequest', () => {
    it('should create payment approval request successfully', async () => {
      const projectId = 'project-123';
      const amount = 10000;
      const purpose = 'Project milestone payment';
      const requesterId = 'user-123';

      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'approval-123',
            project_id: projectId,
            amount: amount.toString(),
            purpose,
            requester_id: requesterId,
            status: 'PENDING_APPROVAL',
            approver_id: null,
            executor_id: null,
            approved_at: null,
            executed_at: null,
            rejection_reason: null,
            created_at: new Date(),
          },
        ],
      });

      const result = await service.createApprovalRequest(projectId, amount, purpose, requesterId);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payment_approvals'),
        [projectId, amount, purpose, requesterId, 'PENDING_APPROVAL']
      );

      expect(result.id).toBe('approval-123');
      expect(result.projectId).toBe(projectId);
      expect(result.amount).toBe(amount);
      expect(result.purpose).toBe(purpose);
      expect(result.requesterId).toBe(requesterId);
      expect(result.status).toBe('PENDING_APPROVAL');
    });
  });

  describe('approvePayment', () => {
    it('should approve payment successfully', async () => {
      const approvalId = 'approval-123';
      const approverId = 'cfo-user-123';

      mockQuery.mockResolvedValue({
        rows: [
          {
            id: approvalId,
            project_id: 'project-123',
            amount: '10000',
            purpose: 'Project milestone payment',
            requester_id: 'user-123',
            status: 'APPROVED_PENDING_EXECUTION',
            approver_id: approverId,
            executor_id: null,
            approved_at: new Date(),
            executed_at: null,
            rejection_reason: null,
            created_at: new Date(),
          },
        ],
      });

      const result = await service.approvePayment(approvalId, approverId);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payment_approvals'),
        ['APPROVED_PENDING_EXECUTION', approverId, approvalId, 'PENDING_APPROVAL']
      );

      expect(result.status).toBe('APPROVED_PENDING_EXECUTION');
      expect(result.approverId).toBe(approverId);
      expect(result.approvedAt).toBeDefined();
    });

    it('should throw error if approval not found or already processed', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await expect(service.approvePayment('non-existent', 'cfo-123')).rejects.toThrow(
        'Payment approval not found or already processed'
      );
    });
  });

  describe('rejectPayment', () => {
    it('should reject payment successfully', async () => {
      const approvalId = 'approval-123';
      const approverId = 'cfo-user-123';
      const reason = 'Insufficient budget allocation';

      mockQuery.mockResolvedValue({
        rows: [
          {
            id: approvalId,
            project_id: 'project-123',
            amount: '10000',
            purpose: 'Project milestone payment',
            requester_id: 'user-123',
            status: 'REJECTED',
            approver_id: approverId,
            executor_id: null,
            approved_at: new Date(),
            executed_at: null,
            rejection_reason: reason,
            created_at: new Date(),
          },
        ],
      });

      const result = await service.rejectPayment(approvalId, approverId, reason);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payment_approvals'),
        ['REJECTED', approverId, reason, approvalId, 'PENDING_APPROVAL']
      );

      expect(result.status).toBe('REJECTED');
      expect(result.approverId).toBe(approverId);
      expect(result.rejectionReason).toBe(reason);
    });
  });

  describe('executePayment', () => {
    it('should execute M-Pesa payment successfully', async () => {
      const approvalId = 'approval-123';
      const executorId = 'ea-user-123';
      const approverId = 'cfo-user-123';

      // Mock get approval
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: approvalId,
            project_id: 'project-123',
            amount: '10000',
            purpose: 'Project milestone payment',
            requester_id: 'user-123',
            status: 'APPROVED_PENDING_EXECUTION',
            approver_id: approverId,
            executor_id: null,
            approved_at: new Date(),
            executed_at: null,
            rejection_reason: null,
            created_at: new Date(),
          },
        ],
      });

      // Mock get project currency
      mockQuery.mockResolvedValueOnce({
        rows: [{ currency: 'KES' }],
      });

      // Mock initiate M-Pesa payment (via recordPayment)
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'payment-123',
            transaction_id: 'txn-123',
            amount: '10000',
            currency: 'KES',
            payment_method: 'MPESA',
            status: 'PENDING',
            client_id: null,
            project_id: 'project-123',
            error_code: null,
            error_message: null,
            created_at: new Date(),
          },
        ],
      });

      // Mock update approval
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: approvalId,
            project_id: 'project-123',
            amount: '10000',
            purpose: 'Project milestone payment',
            requester_id: 'user-123',
            status: 'EXECUTED',
            approver_id: approverId,
            executor_id: executorId,
            approved_at: new Date(),
            executed_at: new Date(),
            rejection_reason: null,
            created_at: new Date(),
          },
        ],
      });

      const jengaClient = require('../services/jenga').jengaClient;
      jengaClient.initiateMpesaPayment = jest.fn().mockResolvedValue({
        requestId: 'req-123',
        transactionId: 'txn-123',
        status: 'INITIATED',
        message: 'Payment initiated',
      });

      const result = await service.executePayment(approvalId, executorId, {
        paymentMethod: 'MPESA',
        phoneNumber: '+254712345678',
      });

      expect(result.approval.status).toBe('EXECUTED');
      expect(result.approval.executorId).toBe(executorId);
      expect(result.payment.transactionId).toBe('txn-123');
      expect(result.payment.projectId).toBe('project-123');
    });

    it('should prevent same user from approving and executing', async () => {
      const approvalId = 'approval-123';
      const userId = 'same-user-123';

      // Mock get approval with same approver and executor
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: approvalId,
            project_id: 'project-123',
            amount: '10000',
            purpose: 'Project milestone payment',
            requester_id: 'user-123',
            status: 'APPROVED_PENDING_EXECUTION',
            approver_id: userId,
            executor_id: null,
            approved_at: new Date(),
            executed_at: null,
            rejection_reason: null,
            created_at: new Date(),
          },
        ],
      });

      await expect(
        service.executePayment(approvalId, userId, {
          paymentMethod: 'MPESA',
          phoneNumber: '+254712345678',
        })
      ).rejects.toThrow('Same user cannot approve and execute a payment');
    });

    it('should throw error if approval not in correct status', async () => {
      const approvalId = 'approval-123';
      const executorId = 'ea-user-123';

      // Mock get approval with wrong status
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: approvalId,
            project_id: 'project-123',
            amount: '10000',
            purpose: 'Project milestone payment',
            requester_id: 'user-123',
            status: 'PENDING_APPROVAL',
            approver_id: null,
            executor_id: null,
            approved_at: null,
            executed_at: null,
            rejection_reason: null,
            created_at: new Date(),
          },
        ],
      });

      await expect(
        service.executePayment(approvalId, executorId, {
          paymentMethod: 'MPESA',
          phoneNumber: '+254712345678',
        })
      ).rejects.toThrow('Payment approval is not in approved pending execution status');
    });

    it('should execute bank transfer payment successfully', async () => {
      const approvalId = 'approval-456';
      const executorId = 'ea-user-123';
      const approverId = 'cfo-user-456';

      // Mock get approval
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: approvalId,
            project_id: 'project-456',
            amount: '50000',
            purpose: 'Vendor payment',
            requester_id: 'user-456',
            status: 'APPROVED_PENDING_EXECUTION',
            approver_id: approverId,
            executor_id: null,
            approved_at: new Date(),
            executed_at: null,
            rejection_reason: null,
            created_at: new Date(),
          },
        ],
      });

      // Mock get project currency
      mockQuery.mockResolvedValueOnce({
        rows: [{ currency: 'USD' }],
      });

      // Mock initiate bank transfer (via recordPayment)
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'payment-456',
            transaction_id: 'txn-456',
            amount: '50000',
            currency: 'USD',
            payment_method: 'BANK_TRANSFER',
            status: 'PENDING',
            client_id: null,
            project_id: 'project-456',
            error_code: null,
            error_message: null,
            created_at: new Date(),
          },
        ],
      });

      // Mock update approval
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: approvalId,
            project_id: 'project-456',
            amount: '50000',
            purpose: 'Vendor payment',
            requester_id: 'user-456',
            status: 'EXECUTED',
            approver_id: approverId,
            executor_id: executorId,
            approved_at: new Date(),
            executed_at: new Date(),
            rejection_reason: null,
            created_at: new Date(),
          },
        ],
      });

      const jengaClient = require('../services/jenga').jengaClient;
      jengaClient.initiateBankTransfer = jest.fn().mockResolvedValue({
        requestId: 'req-456',
        transactionId: 'txn-456',
        status: 'INITIATED',
        message: 'Transfer initiated',
      });

      const result = await service.executePayment(approvalId, executorId, {
        paymentMethod: 'BANK_TRANSFER',
        accountNumber: '1234567890',
        bankCode: 'EQUITY',
      });

      expect(result.approval.status).toBe('EXECUTED');
      expect(result.payment.paymentMethod).toBe('BANK_TRANSFER');
    });
  });

  describe('getPendingApprovals', () => {
    it('should get all pending approvals', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'approval-1',
            project_id: 'project-1',
            amount: '5000',
            purpose: 'Payment 1',
            requester_id: 'user-1',
            status: 'PENDING_APPROVAL',
            approver_id: null,
            executor_id: null,
            approved_at: null,
            executed_at: null,
            rejection_reason: null,
            created_at: new Date('2024-01-01'),
          },
          {
            id: 'approval-2',
            project_id: 'project-2',
            amount: '8000',
            purpose: 'Payment 2',
            requester_id: 'user-2',
            status: 'PENDING_APPROVAL',
            approver_id: null,
            executor_id: null,
            approved_at: null,
            executed_at: null,
            rejection_reason: null,
            created_at: new Date('2024-01-02'),
          },
        ],
      });

      const result = await service.getPendingApprovals();

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('PENDING_APPROVAL');
      expect(result[1].status).toBe('PENDING_APPROVAL');
    });
  });

  describe('getApprovedPendingExecution', () => {
    it('should get all approved pending execution', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'approval-3',
            project_id: 'project-3',
            amount: '12000',
            purpose: 'Payment 3',
            requester_id: 'user-3',
            status: 'APPROVED_PENDING_EXECUTION',
            approver_id: 'cfo-123',
            executor_id: null,
            approved_at: new Date('2024-01-03'),
            executed_at: null,
            rejection_reason: null,
            created_at: new Date('2024-01-01'),
          },
        ],
      });

      const result = await service.getApprovedPendingExecution();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('APPROVED_PENDING_EXECUTION');
      expect(result[0].approverId).toBe('cfo-123');
    });
  });

  describe('getOverdueApprovals', () => {
    it('should get approvals pending for more than 48 hours', async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 72); // 72 hours ago

      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'approval-overdue',
            project_id: 'project-overdue',
            amount: '15000',
            purpose: 'Overdue payment',
            requester_id: 'user-overdue',
            status: 'PENDING_APPROVAL',
            approver_id: null,
            executor_id: null,
            approved_at: null,
            executed_at: null,
            rejection_reason: null,
            created_at: oldDate,
          },
        ],
      });

      const result = await service.getOverdueApprovals();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("created_at < NOW() - INTERVAL '48 hours'"),
        ['PENDING_APPROVAL']
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('approval-overdue');
    });
  });

  describe('getApproval', () => {
    it('should get approval by ID', async () => {
      const approvalId = 'approval-123';

      mockQuery.mockResolvedValue({
        rows: [
          {
            id: approvalId,
            project_id: 'project-123',
            amount: '10000',
            purpose: 'Test payment',
            requester_id: 'user-123',
            status: 'PENDING_APPROVAL',
            approver_id: null,
            executor_id: null,
            approved_at: null,
            executed_at: null,
            rejection_reason: null,
            created_at: new Date(),
          },
        ],
      });

      const result = await service.getApproval(approvalId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(approvalId);
    });

    it('should return null if approval not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await service.getApproval('non-existent');

      expect(result).toBeNull();
    });
  });
});
