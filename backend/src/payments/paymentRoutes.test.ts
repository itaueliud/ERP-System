import request from 'supertest';
import express from 'express';
import paymentRoutes from './paymentRoutes';
import { paymentService, PaymentStatus, PaymentMethod } from './paymentService';

// Mock dependencies
jest.mock('./paymentService');
jest.mock('../utils/logger');
jest.mock('../database/connection');
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
    daraja: {
      consumerKey: 'test-consumer-key',
      consumerSecret: 'test-consumer-secret',
      shortCode: '174379',
      passKey: 'test-pass-key',
      callbackUrl: 'http://localhost:3000',
      webhookSecret: 'test-webhook-secret',
      apiUrl: 'https://sandbox.safaricom.co.ke',
      b2cInitiatorName: 'testapi',
      b2cSecurityCredential: 'test-credential',
    },
  },
}));

const app = express();
app.use(express.json());
app.use('/api/payments', paymentRoutes);

describe('Payment Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/payments/webhook', () => {
    it('should process valid webhook with correct signature', async () => {
      const mockPayload = {
        transactionId: 'TXN123456',
        status: 'COMPLETED',
        amount: 1000,
        currency: 'KES',
        reference: 'REF123',
        timestamp: '2024-01-01T00:00:00Z',
      };

      (paymentService.handleWebhook as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('x-daraja-signature', 'valid-signature')
        .send(mockPayload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Webhook processed successfully',
      });
      expect(paymentService.handleWebhook).toHaveBeenCalledWith('valid-signature', mockPayload);
    });

    it('should reject webhook with missing signature', async () => {
      const mockPayload = {
        transactionId: 'TXN123456',
        status: 'COMPLETED',
      };

      const response = await request(app)
        .post('/api/payments/webhook')
        .send(mockPayload);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing webhook signature');
      expect(paymentService.handleWebhook).not.toHaveBeenCalled();
    });

    it('should reject webhook with invalid signature', async () => {
      const mockPayload = {
        transactionId: 'TXN123456',
        status: 'COMPLETED',
      };

      (paymentService.handleWebhook as jest.Mock).mockRejectedValue(
        new Error('Invalid webhook signature')
      );

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('x-daraja-signature', 'invalid-signature')
        .send(mockPayload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid webhook signature');
    });

    it('should reject webhook with invalid payload structure', async () => {
      const mockPayload = {
        // Missing required fields
        amount: 1000,
      };

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('x-daraja-signature', 'valid-signature')
        .send(mockPayload);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid webhook payload');
      expect(paymentService.handleWebhook).not.toHaveBeenCalled();
    });

    it('should handle webhook processing errors', async () => {
      const mockPayload = {
        transactionId: 'TXN123456',
        status: 'COMPLETED',
      };

      (paymentService.handleWebhook as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('x-daraja-signature', 'valid-signature')
        .send(mockPayload);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to process webhook');
    });
  });

  describe('GET /api/payments/:transactionId', () => {
    it('should return payment status for valid transaction ID', async () => {
      const mockPayment = {
        id: '1',
        transactionId: 'TXN123456',
        amount: 1000,
        currency: 'KES',
        paymentMethod: PaymentMethod.MPESA,
        status: PaymentStatus.COMPLETED,
        createdAt: new Date(),
      };

      (paymentService.getPaymentStatus as jest.Mock).mockResolvedValue(mockPayment);

      const response = await request(app).get('/api/payments/TXN123456');

      expect(response.status).toBe(200);
      expect(response.body.transactionId).toBe('TXN123456');
      expect(response.body.status).toBe(PaymentStatus.COMPLETED);
    });

    it('should return 404 for non-existent transaction', async () => {
      (paymentService.getPaymentStatus as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/payments/INVALID');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Payment not found');
    });
  });

  describe('POST /api/payments/mpesa', () => {
    it('should initiate M-Pesa payment with valid data', async () => {
      const mockPayment = {
        id: '1',
        transactionId: 'TXN123456',
        amount: 1000,
        currency: 'KES',
        paymentMethod: PaymentMethod.MPESA,
        status: PaymentStatus.PENDING,
        createdAt: new Date(),
      };

      (paymentService.initiateMpesaPayment as jest.Mock).mockResolvedValue(mockPayment);

      const response = await request(app)
        .post('/api/payments/mpesa')
        .send({
          phoneNumber: '254712345678',
          amount: 1000,
          currency: 'KES',
          reference: 'REF123',
          description: 'Test payment',
        });

      expect(response.status).toBe(201);
      expect(response.body.transactionId).toBe('TXN123456');
      expect(response.body.status).toBe(PaymentStatus.PENDING);
    });

    it('should reject M-Pesa payment with missing fields', async () => {
      const response = await request(app)
        .post('/api/payments/mpesa')
        .send({
          phoneNumber: '254712345678',
          // Missing amount, currency, reference
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });
  });

  describe('POST /api/payments/airtel', () => {
    it('should initiate Airtel Money payment with valid data', async () => {
      const mockPayment = {
        id: '1',
        transactionId: 'TXN123456',
        amount: 1000,
        currency: 'KES',
        paymentMethod: PaymentMethod.AIRTEL_MONEY,
        status: PaymentStatus.PENDING,
        createdAt: new Date(),
      };

      (paymentService.initiateAirtelPayment as jest.Mock).mockResolvedValue(mockPayment);

      const response = await request(app)
        .post('/api/payments/airtel')
        .send({
          phoneNumber: '254712345678',
          amount: 1000,
          currency: 'KES',
          reference: 'REF123',
        });

      expect(response.status).toBe(201);
      expect(response.body.transactionId).toBe('TXN123456');
    });
  });

  describe('POST /api/payments/bank-transfer', () => {
    it('should initiate bank transfer with valid data', async () => {
      const mockPayment = {
        id: '1',
        transactionId: 'TXN123456',
        amount: 5000,
        currency: 'KES',
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.PENDING,
        createdAt: new Date(),
      };

      (paymentService.initiateBankTransfer as jest.Mock).mockResolvedValue(mockPayment);

      const response = await request(app)
        .post('/api/payments/bank-transfer')
        .send({
          accountNumber: '1234567890',
          bankCode: 'EQBL',
          amount: 5000,
          currency: 'KES',
          reference: 'REF123',
        });

      expect(response.status).toBe(201);
      expect(response.body.transactionId).toBe('TXN123456');
    });

    it('should reject bank transfer with missing fields', async () => {
      const response = await request(app)
        .post('/api/payments/bank-transfer')
        .send({
          accountNumber: '1234567890',
          // Missing bankCode, amount, currency, reference
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });
  });

  describe('POST /api/payments/card', () => {
    it('should initiate card payment with valid data', async () => {
      const mockPayment = {
        id: '1',
        transactionId: 'TXN123456',
        amount: 2000,
        currency: 'KES',
        paymentMethod: PaymentMethod.VISA,
        status: PaymentStatus.PENDING,
        createdAt: new Date(),
      };

      (paymentService.initiateCardPayment as jest.Mock).mockResolvedValue(mockPayment);

      const response = await request(app)
        .post('/api/payments/card')
        .send({
          cardNumber: '4111111111111111',
          expiryMonth: '12',
          expiryYear: '2025',
          cvv: '123',
          cardholderName: 'John Doe',
          amount: 2000,
          currency: 'KES',
          reference: 'REF123',
        });

      expect(response.status).toBe(201);
      expect(response.body.transactionId).toBe('TXN123456');
    });

    it('should reject card payment with missing fields', async () => {
      const response = await request(app)
        .post('/api/payments/card')
        .send({
          cardNumber: '4111111111111111',
          // Missing other required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });
  });

  describe('POST /api/payments/:transactionId/retry', () => {
    it('should retry failed payment', async () => {
      const mockPayment = {
        id: '1',
        transactionId: 'TXN123456',
        amount: 1000,
        currency: 'KES',
        paymentMethod: PaymentMethod.MPESA,
        status: PaymentStatus.COMPLETED,
        createdAt: new Date(),
      };

      (paymentService.retryPayment as jest.Mock).mockResolvedValue(mockPayment);

      const response = await request(app).post('/api/payments/TXN123456/retry');

      expect(response.status).toBe(200);
      expect(response.body.transactionId).toBe('TXN123456');
      expect(response.body.status).toBe(PaymentStatus.COMPLETED);
    });

    it('should handle retry errors', async () => {
      (paymentService.retryPayment as jest.Mock).mockRejectedValue(
        new Error('Only failed payments can be retried')
      );

      const response = await request(app).post('/api/payments/TXN123456/retry');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Only failed payments can be retried');
    });

    it('should return 400 for missing transaction ID', async () => {
      const response = await request(app).post('/api/payments//retry');

      expect(response.status).toBe(404);
    });

    it('should handle payment not found error', async () => {
      (paymentService.retryPayment as jest.Mock).mockRejectedValue(
        new Error('Payment not found')
      );

      const response = await request(app).post('/api/payments/NON_EXISTENT/retry');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Payment not found');
    });

    it('should return updated payment with still failed status', async () => {
      const mockPayment = {
        id: '2',
        transactionId: 'TXN789',
        amount: 2000,
        currency: 'KES',
        paymentMethod: PaymentMethod.MPESA,
        status: PaymentStatus.FAILED,
        errorCode: 'INSUFFICIENT_FUNDS',
        errorMessage: 'Insufficient funds in account',
        createdAt: new Date(),
      };

      (paymentService.retryPayment as jest.Mock).mockResolvedValue(mockPayment);

      const response = await request(app).post('/api/payments/TXN789/retry');

      expect(response.status).toBe(200);
      expect(response.body.transactionId).toBe('TXN789');
      expect(response.body.status).toBe(PaymentStatus.FAILED);
      expect(response.body.errorCode).toBe('INSUFFICIENT_FUNDS');
    });

    it('should call paymentService.retryPayment with correct transaction ID', async () => {
      const mockPayment = {
        id: '3',
        transactionId: 'TXN_CUSTOM_123',
        amount: 5000,
        currency: 'USD',
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.COMPLETED,
        createdAt: new Date(),
      };

      (paymentService.retryPayment as jest.Mock).mockResolvedValue(mockPayment);

      await request(app).post('/api/payments/TXN_CUSTOM_123/retry');

      expect(paymentService.retryPayment).toHaveBeenCalledWith('TXN_CUSTOM_123');
    });
  });
});

describe('Payment Approval Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/payments/approvals', () => {
    it('should create payment approval request with valid data', async () => {
      const mockApproval = {
        id: 'approval-123',
        projectId: 'project-123',
        amount: 10000,
        purpose: 'Project milestone payment',
        requesterId: 'user-123',
        status: 'PENDING_APPROVAL',
        createdAt: new Date(),
      };

      (paymentService.createApprovalRequest as jest.Mock).mockResolvedValue(mockApproval);

      const response = await request(app)
        .post('/api/payments/approvals')
        .send({
          projectId: 'project-123',
          amount: 10000,
          purpose: 'Project milestone payment',
          requesterId: 'user-123',
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('approval-123');
      expect(response.body.status).toBe('PENDING_APPROVAL');
    });

    it('should reject approval request with missing fields', async () => {
      const response = await request(app)
        .post('/api/payments/approvals')
        .send({
          projectId: 'project-123',
          // Missing amount, purpose, requesterId
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });
  });

  describe('GET /api/payments/approvals/pending', () => {
    it('should get all pending approvals', async () => {
      const mockApprovals = [
        {
          id: 'approval-1',
          projectId: 'project-1',
          amount: 5000,
          purpose: 'Payment 1',
          requesterId: 'user-1',
          status: 'PENDING_APPROVAL',
          createdAt: new Date(),
        },
        {
          id: 'approval-2',
          projectId: 'project-2',
          amount: 8000,
          purpose: 'Payment 2',
          requesterId: 'user-2',
          status: 'PENDING_APPROVAL',
          createdAt: new Date(),
        },
      ];

      (paymentService.getPendingApprovals as jest.Mock).mockResolvedValue(mockApprovals);

      const response = await request(app).get('/api/payments/approvals/pending');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].status).toBe('PENDING_APPROVAL');
    });
  });

  describe('GET /api/payments/approvals/approved-pending-execution', () => {
    it('should get all approved pending execution', async () => {
      const mockApprovals = [
        {
          id: 'approval-3',
          projectId: 'project-3',
          amount: 12000,
          purpose: 'Payment 3',
          requesterId: 'user-3',
          status: 'APPROVED_PENDING_EXECUTION',
          approverId: 'cfo-123',
          createdAt: new Date(),
        },
      ];

      (paymentService.getApprovedPendingExecution as jest.Mock).mockResolvedValue(mockApprovals);

      const response = await request(app).get('/api/payments/approvals/approved-pending-execution');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe('APPROVED_PENDING_EXECUTION');
    });
  });

  describe('GET /api/payments/approvals/overdue', () => {
    it('should get overdue approvals', async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 72);

      const mockApprovals = [
        {
          id: 'approval-overdue',
          projectId: 'project-overdue',
          amount: 15000,
          purpose: 'Overdue payment',
          requesterId: 'user-overdue',
          status: 'PENDING_APPROVAL',
          createdAt: oldDate,
        },
      ];

      (paymentService.getOverdueApprovals as jest.Mock).mockResolvedValue(mockApprovals);

      const response = await request(app).get('/api/payments/approvals/overdue');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe('approval-overdue');
    });
  });

  describe('GET /api/payments/approvals/:approvalId', () => {
    it('should get approval by ID', async () => {
      const mockApproval = {
        id: 'approval-123',
        projectId: 'project-123',
        amount: 10000,
        purpose: 'Test payment',
        requesterId: 'user-123',
        status: 'PENDING_APPROVAL',
        createdAt: new Date(),
      };

      (paymentService.getApproval as jest.Mock).mockResolvedValue(mockApproval);

      const response = await request(app).get('/api/payments/approvals/approval-123');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('approval-123');
    });

    it('should return 404 for non-existent approval', async () => {
      (paymentService.getApproval as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/payments/approvals/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Payment approval not found');
    });
  });

  describe('POST /api/payments/approvals/:approvalId/approve', () => {
    it('should approve payment successfully', async () => {
      const mockApproval = {
        id: 'approval-123',
        projectId: 'project-123',
        amount: 10000,
        purpose: 'Project milestone payment',
        requesterId: 'user-123',
        status: 'APPROVED_PENDING_EXECUTION',
        approverId: 'cfo-123',
        approvedAt: new Date(),
        createdAt: new Date(),
      };

      (paymentService.approvePayment as jest.Mock).mockResolvedValue(mockApproval);

      const response = await request(app)
        .post('/api/payments/approvals/approval-123/approve')
        .send({
          approverId: 'cfo-123',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('APPROVED_PENDING_EXECUTION');
      expect(response.body.approverId).toBe('cfo-123');
    });

    it('should reject approval with missing approver ID', async () => {
      const response = await request(app)
        .post('/api/payments/approvals/approval-123/approve')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Approver ID is required');
    });

    it('should handle approval errors', async () => {
      (paymentService.approvePayment as jest.Mock).mockRejectedValue(
        new Error('Payment approval not found or already processed')
      );

      const response = await request(app)
        .post('/api/payments/approvals/approval-123/approve')
        .send({
          approverId: 'cfo-123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Payment approval not found or already processed');
    });
  });

  describe('POST /api/payments/approvals/:approvalId/reject', () => {
    it('should reject payment successfully', async () => {
      const mockApproval = {
        id: 'approval-123',
        projectId: 'project-123',
        amount: 10000,
        purpose: 'Project milestone payment',
        requesterId: 'user-123',
        status: 'REJECTED',
        approverId: 'cfo-123',
        rejectionReason: 'Insufficient budget',
        approvedAt: new Date(),
        createdAt: new Date(),
      };

      (paymentService.rejectPayment as jest.Mock).mockResolvedValue(mockApproval);

      const response = await request(app)
        .post('/api/payments/approvals/approval-123/reject')
        .send({
          approverId: 'cfo-123',
          reason: 'Insufficient budget',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('REJECTED');
      expect(response.body.rejectionReason).toBe('Insufficient budget');
    });

    it('should reject rejection with missing fields', async () => {
      const response = await request(app)
        .post('/api/payments/approvals/approval-123/reject')
        .send({
          approverId: 'cfo-123',
          // Missing reason
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Approver ID and rejection reason are required');
    });
  });

  describe('POST /api/payments/approvals/:approvalId/execute', () => {
    it('should execute payment successfully', async () => {
      const mockResult = {
        approval: {
          id: 'approval-123',
          projectId: 'project-123',
          amount: 10000,
          purpose: 'Project milestone payment',
          requesterId: 'user-123',
          status: 'EXECUTED',
          approverId: 'cfo-123',
          executorId: 'ea-123',
          executedAt: new Date(),
          createdAt: new Date(),
        },
        payment: {
          id: 'payment-123',
          transactionId: 'txn-123',
          amount: 10000,
          currency: 'KES',
          paymentMethod: PaymentMethod.MPESA,
          status: PaymentStatus.PENDING,
          projectId: 'project-123',
          createdAt: new Date(),
        },
      };

      (paymentService.executePayment as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/payments/approvals/approval-123/execute')
        .send({
          executorId: 'ea-123',
          paymentDetails: {
            paymentMethod: 'MPESA',
            phoneNumber: '+254712345678',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.approval.status).toBe('EXECUTED');
      expect(response.body.payment.transactionId).toBe('txn-123');
    });

    it('should reject execution with missing fields', async () => {
      const response = await request(app)
        .post('/api/payments/approvals/approval-123/execute')
        .send({
          executorId: 'ea-123',
          // Missing paymentDetails
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Executor ID and payment details are required');
    });

    it('should handle execution errors', async () => {
      (paymentService.executePayment as jest.Mock).mockRejectedValue(
        new Error('Same user cannot approve and execute a payment')
      );

      const response = await request(app)
        .post('/api/payments/approvals/approval-123/execute')
        .send({
          executorId: 'same-user-123',
          paymentDetails: {
            paymentMethod: 'MPESA',
            phoneNumber: '+254712345678',
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Same user cannot approve and execute a payment');
    });
  });
});
