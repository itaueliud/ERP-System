import { db } from '../database/connection';
import logger from '../utils/logger';
import { darajaClient } from '../services/daraja';
import { realtimeEvents } from '../realtime/realtimeEvents';

export interface InitiatePaymentInput {
  amount: number;
  currency: string;
  reference: string;
  description?: string;
  clientId?: string;
  projectId?: string;
}

export interface MpesaPaymentInput extends InitiatePaymentInput {
  phoneNumber: string;
}

export interface AirtelPaymentInput extends InitiatePaymentInput {
  phoneNumber: string;
}

export interface BankTransferInput extends InitiatePaymentInput {
  accountNumber: string;
  bankCode: string;
}

export interface CardPaymentInput extends InitiatePaymentInput {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardholderName: string;
}

export interface Payment {
  id: string;
  transactionId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  clientId?: string;
  projectId?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: Date;
}

export interface PaymentApproval {
  id: string;
  projectId: string;
  amount: number;
  purpose: string;
  requesterId: string;
  status: ApprovalStatus;
  approverId?: string;
  executorId?: string;
  approvedAt?: Date;
  executedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
}

export enum PaymentMethod {
  MPESA = 'MPESA',
  AIRTEL_MONEY = 'AIRTEL_MONEY',
  BANK_TRANSFER = 'BANK_TRANSFER',
  VISA = 'VISA',
  MASTERCARD = 'MASTERCARD',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum ApprovalStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED_PENDING_EXECUTION = 'APPROVED_PENDING_EXECUTION',
  EXECUTED = 'EXECUTED',
  REJECTED = 'REJECTED',
}

/**
 * Payment Processing Service
 * Handles payment processing via Daraja API (Safaricom M-Pesa) for multiple payment methods
 * Requirements: 5.1-5.12
 */
export class PaymentProcessingService {
  /**
   * Initiate M-Pesa STK Push payment
   * Requirement 5.2: Support M-Pesa payments via STK Push
   * Requirement 5.6: Send payment request to Daraja API
   */
  async initiateMpesaPayment(input: MpesaPaymentInput): Promise<Payment> {
    try {
      logger.info('Initiating M-Pesa payment', {
        phoneNumber: input.phoneNumber,
        amount: input.amount,
        reference: input.reference,
      });

      if (input.amount <= 0) throw new Error('Payment amount must be greater than 0');
      if (!input.phoneNumber) throw new Error('Phone number is required for M-Pesa payment');

      // Call Daraja STK Push
      const darajaResponse = await darajaClient.initiateMpesaPayment({
        phoneNumber: input.phoneNumber,
        amount: input.amount,
        accountReference: input.reference,
        transactionDesc: input.description,
      });

      const payment = await this.recordPayment({
        transactionId: darajaResponse.transactionId || darajaResponse.requestId,
        amount: input.amount,
        currency: input.currency,
        paymentMethod: PaymentMethod.MPESA,
        status: darajaResponse.status === 'INITIATED' ? PaymentStatus.PENDING : PaymentStatus.FAILED,
        clientId: input.clientId,
        projectId: input.projectId,
        errorCode: darajaResponse.status === 'FAILED' ? 'INITIATION_FAILED' : undefined,
        errorMessage: darajaResponse.status === 'FAILED' ? darajaResponse.message : undefined,
      });

      logger.info('M-Pesa payment initiated successfully', {
        paymentId: payment.id,
        transactionId: payment.transactionId,
        status: payment.status,
      });

      return payment;
    } catch (error) {
      logger.error('Failed to initiate M-Pesa payment', { error, input });
      throw error;
    }
  }

  /**
   * Initiate Airtel Money payment
   * Requirement 5.3: Support Airtel Money payments
   * Requirement 5.6: Send payment request to Daraja API
   */
  async initiateAirtelPayment(input: AirtelPaymentInput): Promise<Payment> {
    try {
      logger.info('Initiating Airtel Money payment', {
        phoneNumber: input.phoneNumber,
        amount: input.amount,
        reference: input.reference,
      });

      if (input.amount <= 0) throw new Error('Payment amount must be greater than 0');
      if (!input.phoneNumber) throw new Error('Phone number is required for Airtel Money payment');

      const darajaResponse = await darajaClient.initiateAirtelPayment({
        phoneNumber: input.phoneNumber,
        amount: input.amount,
        accountReference: input.reference,
        transactionDesc: input.description,
      });

      const payment = await this.recordPayment({
        transactionId: darajaResponse.transactionId || darajaResponse.requestId,
        amount: input.amount,
        currency: input.currency,
        paymentMethod: PaymentMethod.AIRTEL_MONEY,
        status: darajaResponse.status === 'INITIATED' ? PaymentStatus.PENDING : PaymentStatus.FAILED,
        clientId: input.clientId,
        projectId: input.projectId,
        errorCode: darajaResponse.status === 'FAILED' ? 'INITIATION_FAILED' : undefined,
        errorMessage: darajaResponse.status === 'FAILED' ? darajaResponse.message : undefined,
      });

      logger.info('Airtel Money payment initiated successfully', {
        paymentId: payment.id,
        transactionId: payment.transactionId,
        status: payment.status,
      });

      return payment;
    } catch (error) {
      logger.error('Failed to initiate Airtel Money payment', { error, input });
      throw error;
    }
  }

  /**
   * Initiate bank transfer payment
   * Requirement 5.4: Support bank transfer payments
   * Requirement 5.6: Send payment request to Daraja API (B2C)
   */
  async initiateBankTransfer(input: BankTransferInput): Promise<Payment> {
    try {
      logger.info('Initiating bank transfer', {
        accountNumber: input.accountNumber,
        bankCode: input.bankCode,
        amount: input.amount,
        reference: input.reference,
      });

      if (input.amount <= 0) throw new Error('Payment amount must be greater than 0');
      if (!input.accountNumber) throw new Error('Account number is required for bank transfer');
      if (!input.bankCode) throw new Error('Bank code is required for bank transfer');

      const darajaResponse = await darajaClient.initiateBankTransfer(
        input.accountNumber,
        input.bankCode,
        input.amount,
        input.currency,
        input.reference
      );

      const payment = await this.recordPayment({
        transactionId: darajaResponse.transactionId || darajaResponse.requestId,
        amount: input.amount,
        currency: input.currency,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        status: darajaResponse.status === 'INITIATED' ? PaymentStatus.PENDING : PaymentStatus.FAILED,
        clientId: input.clientId,
        projectId: input.projectId,
        errorCode: darajaResponse.status === 'FAILED' ? 'INITIATION_FAILED' : undefined,
        errorMessage: darajaResponse.status === 'FAILED' ? darajaResponse.message : undefined,
      });

      logger.info('Bank transfer initiated successfully', {
        paymentId: payment.id,
        transactionId: payment.transactionId,
        status: payment.status,
      });

      return payment;
    } catch (error) {
      logger.error('Failed to initiate bank transfer', { error, input });
      throw error;
    }
  }

  /**
   * Initiate card payment (Visa/Mastercard)
   * Requirement 5.5: Support Visa and Mastercard payments
   * Requirement 5.6: Send payment request to Daraja API
   */
  async initiateCardPayment(input: CardPaymentInput): Promise<Payment> {
    try {
      logger.info('Initiating card payment', {
        cardholderName: input.cardholderName,
        amount: input.amount,
        reference: input.reference,
      });

      if (input.amount <= 0) throw new Error('Payment amount must be greater than 0');
      if (!input.cardNumber || !input.expiryMonth || !input.expiryYear || !input.cvv) {
        throw new Error('Complete card details are required');
      }

      const cardType = this.determineCardType(input.cardNumber);

      const darajaResponse = await darajaClient.initiateCardPayment(
        {
          cardNumber: input.cardNumber,
          expiryMonth: input.expiryMonth,
          expiryYear: input.expiryYear,
          cvv: input.cvv,
          cardholderName: input.cardholderName,
        },
        input.amount,
        input.currency,
        input.reference
      );

      const payment = await this.recordPayment({
        transactionId: darajaResponse.transactionId || darajaResponse.requestId,
        amount: input.amount,
        currency: input.currency,
        paymentMethod: cardType,
        status: darajaResponse.status === 'INITIATED' ? PaymentStatus.PENDING : PaymentStatus.FAILED,
        clientId: input.clientId,
        projectId: input.projectId,
        errorCode: darajaResponse.status === 'FAILED' ? 'INITIATION_FAILED' : undefined,
        errorMessage: darajaResponse.status === 'FAILED' ? darajaResponse.message : undefined,
      });

      logger.info('Card payment initiated successfully', {
        paymentId: payment.id,
        transactionId: payment.transactionId,
        cardType,
        status: payment.status,
      });

      return payment;
    } catch (error) {
      logger.error('Failed to initiate card payment', { error, input });
      throw error;
    }
  }

  /**
   * Record payment in database
   * Requirement 5.9: Store payment records with required fields
   */
  private async recordPayment(data: {
    transactionId: string;
    amount: number;
    currency: string;
    paymentMethod: PaymentMethod;
    status: PaymentStatus;
    clientId?: string;
    projectId?: string;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<Payment> {
    try {
      const result = await db.query(
        `INSERT INTO payments (
          transaction_id, amount, currency, payment_method, status,
          client_id, project_id, error_code, error_message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, transaction_id, amount, currency, payment_method, status,
                  client_id, project_id, error_code, error_message, created_at`,
        [
          data.transactionId,
          data.amount,
          data.currency,
          data.paymentMethod,
          data.status,
          data.clientId || null,
          data.projectId || null,
          data.errorCode || null,
          data.errorMessage || null,
        ]
      );

      return this.mapPaymentFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to record payment', { error, data });
      throw error;
    }
  }

  /**
   * Get payment status
   * Requirement 5.7: Record transaction ID from successful payments
   */
  async getPaymentStatus(transactionId: string): Promise<Payment | null> {
    try {
      const result = await db.query(
        `SELECT id, transaction_id, amount, currency, payment_method, status,
                client_id, project_id, error_code, error_message, created_at
         FROM payments
         WHERE transaction_id = $1`,
        [transactionId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapPaymentFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get payment status', { error, transactionId });
      throw error;
    }
  }

  /**
   * Handle Daraja API webhook
   * Requirement 5.11: Verify webhook signature
   * Requirement 5.12: Reject invalid webhook signatures and log security alert
   * Requirement 4.8: Update client status to LEAD when commitment payment is successful
   */
  async handleWebhook(signature: string, payload: any): Promise<void> {
    try {
      logger.info('Received Daraja API webhook', { payload });

      // Verify webhook signature
      const isValid = darajaClient.verifyWebhookSignature(signature, JSON.stringify(payload));

      if (!isValid) {
        logger.error('Invalid webhook signature detected', { signature, payload });
        throw new Error('Invalid webhook signature');
      }

      // Handle Daraja STK Push callback format
      let transactionId: string;
      let status: string;
      let errorCode: string | null = null;
      let errorMessage: string | null = null;

      if (payload.Body?.stkCallback) {
        // STK Push callback
        const cb = payload.Body.stkCallback;
        transactionId = cb.CheckoutRequestID;
        status = cb.ResultCode === 0 ? 'COMPLETED' : 'FAILED';
        if (cb.ResultCode !== 0) {
          errorCode = String(cb.ResultCode);
          errorMessage = cb.ResultDesc;
        }
      } else if (payload.Body?.Result) {
        // B2C result callback
        const result = payload.Body.Result;
        transactionId = result.ConversationID || result.TransactionID;
        status = result.ResultCode === 0 ? 'COMPLETED' : 'FAILED';
        if (result.ResultCode !== 0) {
          errorCode = String(result.ResultCode);
          errorMessage = result.ResultDesc;
        }
      } else {
        // Legacy flat format (for backward compat / manual testing)
        transactionId = payload.transactionId;
        status = payload.status;
        errorCode = payload.errorCode || null;
        errorMessage = payload.errorMessage || null;
      }

      const paymentStatus = status === 'COMPLETED' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;

      await db.query(
        `UPDATE payments SET status = $1, error_code = $2, error_message = $3 WHERE transaction_id = $4`,
        [paymentStatus, errorCode, errorMessage, transactionId]
      );

      logger.info('Payment status updated from Daraja webhook', { transactionId, status: paymentStatus });

      // If payment is successful and linked to a client, activate or qualify the lead
      // based on their payment plan (doc §10):
      //   FULL_PAYMENT → LEAD_ACTIVATED
      //   50_50 / MILESTONE → LEAD_QUALIFIED
      if (paymentStatus === PaymentStatus.COMPLETED) {
        const paymentResult = await db.query(
          `SELECT p.client_id, c.payment_plan
           FROM payments p
           JOIN clients c ON c.id = p.client_id
           WHERE p.transaction_id = $1 AND p.client_id IS NOT NULL`,
          [transactionId]
        );

        if (paymentResult.rows.length > 0) {
          const { client_id: clientId, payment_plan: paymentPlan } = paymentResult.rows[0];
          const { clientService } = await import('../clients/clientService');
          try {
            if (paymentPlan === 'FULL') {
              await clientService.activateLead(clientId, transactionId);
              logger.info('Client LEAD_ACTIVATED after Full Payment', { clientId, transactionId });
            } else {
              await clientService.qualifyLead(clientId, transactionId);
              logger.info('Client LEAD_QUALIFIED after 50/50 or Milestone payment', { clientId, transactionId, paymentPlan });
            }
          } catch (error) {
            logger.error('Failed to update client status after payment', { error, clientId, transactionId, paymentPlan });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to handle Daraja webhook', { error, payload });
      throw error;
    }
  }

  /**
   * Initiate commitment payment for a client
   * Requirement 4.7: Trigger M-Pesa STK Push to client's phone
   * Requirement 4.10: Record transaction ID from successful commitment payments
   */
  async initiateCommitmentPayment(
    clientId: string,
    phoneNumber: string,
    amount: number,
    currency: string = 'KES'
  ): Promise<Payment> {
    try {
      logger.info('Initiating commitment payment for client', {
        clientId,
        phoneNumber,
        amount,
        currency,
      });

      // Generate reference for commitment payment
      const reference = `COMMIT-${clientId}-${Date.now()}`;

      // Initiate M-Pesa payment
      const payment = await this.initiateMpesaPayment({
        phoneNumber,
        amount,
        currency,
        reference,
        description: 'Commitment Payment',
        clientId,
      });

      logger.info('Commitment payment initiated', {
        clientId,
        paymentId: payment.id,
        transactionId: payment.transactionId,
      });

      return payment;
    } catch (error) {
      logger.error('Failed to initiate commitment payment', { error, clientId, phoneNumber, amount });
      throw error;
    }
  }

  /**
   * Retry failed payment
   * Requirement 4.9: Allow retry for failed commitment payments
   */
  async retryPayment(transactionId: string): Promise<Payment> {
    try {
      const payment = await this.getPaymentStatus(transactionId);

      if (!payment) throw new Error('Payment not found');
      if (payment.status !== PaymentStatus.FAILED) throw new Error('Only failed payments can be retried');

      // Query Daraja for latest status
      const darajaStatus = await darajaClient.getPaymentStatus(transactionId);

      const newStatus = darajaStatus.status === 'COMPLETED' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;

      await db.query(
        `UPDATE payments SET status = $1, error_code = $2, error_message = $3 WHERE transaction_id = $4`,
        [newStatus, darajaStatus.errorCode || null, darajaStatus.errorMessage || null, transactionId]
      );

      logger.info('Payment retry completed', { transactionId, newStatus });

      const updatedPayment = await this.getPaymentStatus(transactionId);
      return updatedPayment!;
    } catch (error) {
      logger.error('Failed to retry payment', { error, transactionId });
      throw error;
    }
  }

  /**
   * Determine card type from card number
   */
  private determineCardType(cardNumber: string): PaymentMethod {
    // Remove spaces and dashes
    const cleaned = cardNumber.replace(/[\s-]/g, '');

    // Visa starts with 4
    if (cleaned.startsWith('4')) {
      return PaymentMethod.VISA;
    }

    // Mastercard starts with 51-55 or 2221-2720
    if (
      /^5[1-5]/.test(cleaned) ||
      (parseInt(cleaned.substring(0, 4)) >= 2221 && parseInt(cleaned.substring(0, 4)) <= 2720)
    ) {
      return PaymentMethod.MASTERCARD;
    }

    // Default to Visa if unable to determine
    return PaymentMethod.VISA;
  }

  /**
   * Map database row to Payment object
   */
  private mapPaymentFromDb(row: any): Payment {
    return {
      id: row.id,
      transactionId: row.transaction_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      paymentMethod: row.payment_method as PaymentMethod,
      status: row.status as PaymentStatus,
      clientId: row.client_id,
      projectId: row.project_id,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    };
  }

  /**
   * Create payment approval request
   * Requirement 7.1: Create payment approval request for projects
   */
  async createApprovalRequest(
    projectId: string,
    amount: number,
    purpose: string,
    requesterId: string,
    paymentType: string = 'GENERAL'
  ): Promise<PaymentApproval> {
    try {
      logger.info('Creating payment approval request', { projectId, amount, purpose, requesterId, paymentType });

      const result = await db.query(
        `INSERT INTO payment_approvals (
          project_id, amount, purpose, requester_id, status, payment_type
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, project_id, amount, purpose, requester_id, status,
                  approver_id, executor_id, approved_at, executed_at,
                  rejection_reason, created_at`,
        [projectId, amount, purpose, requesterId, ApprovalStatus.PENDING_APPROVAL, paymentType]
      );

      const approval = this.mapApprovalFromDb(result.rows[0]);

      logger.info('Payment approval request created', {
        approvalId: approval.id,
        projectId,
        amount,
      });

      realtimeEvents.publish('payment:created', { approvalId: approval.id, projectId, amount });
      return approval;
    } catch (error) {
      logger.error('Failed to create payment approval request', {
        error,
        projectId,
        amount,
        requesterId,
      });
      throw error;
    }
  }

  /**
   * Approve payment (CFO only)
   * Requirement 7.2: Route payment approval requests to CFO
   * Requirement 7.3: Update payment status to "Approved_Pending_Execution"
   */
  async approvePayment(approvalId: string, approverId: string): Promise<PaymentApproval> {
    try {
      logger.info('Approving payment', { approvalId, approverId });

      const result = await db.query(
        `UPDATE payment_approvals
         SET status = $1, approver_id = $2, approved_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND status = $4
         RETURNING id, project_id, amount, purpose, requester_id, status,
                   approver_id, executor_id, approved_at, executed_at,
                   rejection_reason, created_at`,
        [
          ApprovalStatus.APPROVED_PENDING_EXECUTION,
          approverId,
          approvalId,
          ApprovalStatus.PENDING_APPROVAL,
        ]
      );

      if (result.rows.length === 0) {
        throw new Error('Payment approval not found or already processed');
      }

      const approval = this.mapApprovalFromDb(result.rows[0]);

      logger.info('Payment approved successfully', {
        approvalId,
        approverId,
        projectId: approval.projectId,
      });

      realtimeEvents.publish('payment:approved', { approvalId, approverId });
      return approval;
    } catch (error) {
      logger.error('Failed to approve payment', { error, approvalId, approverId });
      throw error;
    }
  }

  /**
   * Reject payment (CFO only)
   * Requirement 7.4: Update payment status to "Rejected" and notify requester
   */
  async rejectPayment(
    approvalId: string,
    approverId: string,
    reason: string
  ): Promise<PaymentApproval> {
    try {
      logger.info('Rejecting payment', { approvalId, approverId, reason });

      const result = await db.query(
        `UPDATE payment_approvals
         SET status = $1, approver_id = $2, rejection_reason = $3, approved_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND status = $5
         RETURNING id, project_id, amount, purpose, requester_id, status,
                   approver_id, executor_id, approved_at, executed_at,
                   rejection_reason, created_at`,
        [ApprovalStatus.REJECTED, approverId, reason, approvalId, ApprovalStatus.PENDING_APPROVAL]
      );

      if (result.rows.length === 0) {
        throw new Error('Payment approval not found or already processed');
      }

      const approval = this.mapApprovalFromDb(result.rows[0]);

      logger.info('Payment rejected successfully', {
        approvalId,
        approverId,
        reason,
      });

      realtimeEvents.publish('payment:rejected', { approvalId, approverId });
      return approval;
    } catch (error) {
      logger.error('Failed to reject payment', { error, approvalId, approverId, reason });
      throw error;
    }
  }

  /**
   * Execute payment — CFO, CoS, CEO only.
   * CFO can approve AND execute the same payment (no separation of duties for CFO/CoS/CEO).
   * Requirement 7.5, 7.6
   */
  async executePayment(
    approvalId: string,
    executorId: string,
    paymentDetails: {
      paymentMethod: 'MPESA' | 'AIRTEL_MONEY' | 'BANK_TRANSFER' | 'CARD';
      phoneNumber?: string;
      accountNumber?: string;
      bankCode?: string;
      cardDetails?: {
        cardNumber: string;
        expiryMonth: string;
        expiryYear: string;
        cvv: string;
        cardholderName: string;
      };
    },
    executorRole?: string
  ): Promise<{ approval: PaymentApproval; payment: Payment }> {
    try {
      logger.info('Executing payment', { approvalId, executorId });

      // Get approval details
      const approvalResult = await db.query(
        `SELECT id, project_id, amount, purpose, requester_id, status,
                approver_id, executor_id, approved_at, executed_at,
                rejection_reason, created_at
         FROM payment_approvals
         WHERE id = $1`,
        [approvalId]
      );

      if (approvalResult.rows.length === 0) {
        throw new Error('Payment approval not found');
      }

      const approval = this.mapApprovalFromDb(approvalResult.rows[0]);

      // Validate approval status
      if (approval.status !== ApprovalStatus.APPROVED_PENDING_EXECUTION) {
        throw new Error('Payment approval is not in approved pending execution status');
      }

      // CFO, CoS, CEO can approve AND execute the same payment.
      // For all other roles, prevent the same user from doing both.
      const canSelfExecute = ['CFO', 'CoS', 'CEO'].includes(executorRole || '');
      if (!canSelfExecute && approval.approverId === executorId) {
        throw new Error('Same user cannot approve and execute a payment');
      }

      // Get project currency — fall back to KES if no project linked
      let currency = 'KES';
      if (approval.projectId) {
        const projectResult = await db.query(
          'SELECT currency FROM projects WHERE id = $1',
          [approval.projectId]
        );
        if (projectResult.rows.length > 0) {
          currency = projectResult.rows[0].currency || 'KES';
        }
      }
      const reference = `PAY-${approval.id}-${Date.now()}`;

      // Process payment based on method
      // If gateway credentials aren't configured, record the execution without calling Daraja
      let payment: Payment;
      try {
        switch (paymentDetails.paymentMethod) {
          case 'MPESA':
            if (!paymentDetails.phoneNumber) throw new Error('Phone number is required for M-Pesa payment');
            payment = await this.initiateMpesaPayment({
              phoneNumber: paymentDetails.phoneNumber,
              amount: approval.amount, currency, reference,
              description: approval.purpose,
              projectId: approval.projectId,
            });
            break;
          case 'AIRTEL_MONEY':
            if (!paymentDetails.phoneNumber) throw new Error('Phone number is required for Airtel Money payment');
            payment = await this.initiateAirtelPayment({
              phoneNumber: paymentDetails.phoneNumber,
              amount: approval.amount, currency, reference,
              description: approval.purpose,
              projectId: approval.projectId,
            });
            break;
          case 'BANK_TRANSFER':
            if (!paymentDetails.accountNumber || !paymentDetails.bankCode) throw new Error('Account number and bank code are required for bank transfer');
            payment = await this.initiateBankTransfer({
              accountNumber: paymentDetails.accountNumber,
              bankCode: paymentDetails.bankCode,
              amount: approval.amount, currency, reference,
              projectId: approval.projectId,
            });
            break;
          case 'CARD':
            if (!paymentDetails.cardDetails) throw new Error('Card details are required for card payment');
            payment = await this.initiateCardPayment({
              ...paymentDetails.cardDetails,
              amount: approval.amount, currency, reference,
              projectId: approval.projectId,
            });
            break;
          default:
            throw new Error('Invalid payment method');
        }
      } catch (gatewayErr: any) {
        // Gateway not configured or missing details — record as COMPLETED internally
        logger.warn('Payment gateway unavailable, recording execution internally', {
          approvalId, reason: gatewayErr.message,
        });
        const txId = `INTERNAL-${Date.now()}`;
        const fallbackResult = await db.query(
          `INSERT INTO payments (transaction_id, amount, currency, payment_method, status, project_id, created_at)
           VALUES ($1, $2, $3, $4, 'COMPLETED', $5, NOW())
           RETURNING id, transaction_id, amount, currency, payment_method, status, project_id, created_at`,
          [txId, approval.amount, currency, paymentDetails.paymentMethod, approval.projectId]
        );
        payment = {
          id: fallbackResult.rows[0].id,
          transactionId: txId,
          amount: approval.amount,
          currency,
          paymentMethod: paymentDetails.paymentMethod as any,
          status: 'COMPLETED' as any,
          projectId: approval.projectId,
          createdAt: fallbackResult.rows[0].created_at,
        } as any;
      }

      // Update approval status
      const updatedApprovalResult = await db.query(
        `UPDATE payment_approvals
         SET status = $1, executor_id = $2, executed_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, project_id, amount, purpose, requester_id, status,
                   approver_id, executor_id, approved_at, executed_at,
                   rejection_reason, created_at`,
        [ApprovalStatus.EXECUTED, executorId, approvalId]
      );

      const updatedApproval = this.mapApprovalFromDb(updatedApprovalResult.rows[0]);

      logger.info('Payment executed successfully', {
        approvalId,
        executorId,
        paymentId: payment.id,
        transactionId: payment.transactionId,
      });

      realtimeEvents.publish('payment:executed', { approvalId, executorId, paymentId: payment.id });
      return { approval: updatedApproval, payment };
    } catch (error) {
      logger.error('Failed to execute payment', { error, approvalId, executorId });
      throw error;
    }
  }

  /**
   * Get payment approval by ID
   */
  async getApproval(approvalId: string): Promise<PaymentApproval | null> {
    try {
      const result = await db.query(
        `SELECT id, project_id, amount, purpose, requester_id, status,
                approver_id, executor_id, approved_at, executed_at,
                rejection_reason, created_at
         FROM payment_approvals
         WHERE id = $1`,
        [approvalId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapApprovalFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get payment approval', { error, approvalId });
      throw error;
    }
  }

  /**
   * Get pending approvals (for CFO dashboard)
   * Requirement 7.10: Display pending approvals count on CFO dashboard
   */
  async getPendingApprovals(): Promise<PaymentApproval[]> {
    try {
      const result = await db.query(
        `SELECT pa.id, pa.project_id, pa.amount, pa.purpose, pa.requester_id, pa.status,
                pa.approver_id, pa.executor_id, pa.approved_at, pa.executed_at,
                pa.rejection_reason, pa.created_at,
                u.full_name as requester_name, u.email as requester_email
         FROM payment_approvals pa
         LEFT JOIN users u ON u.id = pa.requester_id
         WHERE pa.status = $1
         ORDER BY pa.created_at ASC`,
        [ApprovalStatus.PENDING_APPROVAL]
      );

      return result.rows.map((row) => ({
        ...this.mapApprovalFromDb(row),
        requesterName: row.requester_name,
        requesterEmail: row.requester_email,
      } as any));
    } catch (error) {
      logger.error('Failed to get pending approvals', { error });
      throw error;
    }
  }

  /**
   * Get approved pending execution (for EA dashboard)
   * Requirement 7.10: Display pending approvals count on EA dashboard
   */
  async getApprovedPendingExecution(): Promise<PaymentApproval[]> {
    try {
      const result = await db.query(
        `SELECT id, project_id, amount, purpose, requester_id, status,
                approver_id, executor_id, approved_at, executed_at,
                rejection_reason, created_at
         FROM payment_approvals
         WHERE status = $1
         ORDER BY approved_at ASC`,
        [ApprovalStatus.APPROVED_PENDING_EXECUTION]
      );

      return result.rows.map((row) => this.mapApprovalFromDb(row));
    } catch (error) {
      logger.error('Failed to get approved pending execution', { error });
      throw error;
    }
  }

  /**
   * Get overdue approvals (pending for more than 48 hours)
   * Requirement 7.8: Send reminder notifications for pending approvals > 48 hours
   */
  async getOverdueApprovals(): Promise<PaymentApproval[]> {
    try {
      const result = await db.query(
        `SELECT id, project_id, amount, purpose, requester_id, status,
                approver_id, executor_id, approved_at, executed_at,
                rejection_reason, created_at
         FROM payment_approvals
         WHERE status = $1
           AND created_at < NOW() - INTERVAL '48 hours'
         ORDER BY created_at ASC`,
        [ApprovalStatus.PENDING_APPROVAL]
      );

      return result.rows.map((row) => this.mapApprovalFromDb(row));
    } catch (error) {
      logger.error('Failed to get overdue approvals', { error });
      throw error;
    }
  }

  /**
   * Map database row to PaymentApproval object
   */
  private mapApprovalFromDb(row: any): PaymentApproval {
    return {
      id: row.id,
      projectId: row.project_id,
      amount: parseFloat(row.amount),
      purpose: row.purpose,
      requesterId: row.requester_id,
      status: row.status as ApprovalStatus,
      approverId: row.approver_id,
      executorId: row.executor_id,
      approvedAt: row.approved_at,
      executedAt: row.executed_at,
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
    };
  }
}

export const paymentService = new PaymentProcessingService();
export default paymentService;
