import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { config } from '../../config';
import logger from '../../utils/logger';
import { withRetry } from '../../utils/retry';
import { CircuitBreaker } from '../../utils/circuitBreaker';
import metrics from '../../utils/metrics';

export interface JengaPaymentRequest {
  phoneNumber: string;
  amount: number;
  currency: string;
  reference: string;
  description?: string;
}

export interface JengaPaymentResponse {
  requestId: string;
  status: 'PENDING' | 'INITIATED' | 'FAILED';
  message: string;
  transactionId?: string;
}

export interface JengaWebhookPayload {
  transactionId: string;
  status: 'COMPLETED' | 'FAILED';
  amount: number;
  currency: string;
  reference: string;
  timestamp: string;
  errorCode?: string;
  errorMessage?: string;
}

export class JengaAPIClient {
  private client: AxiosInstance;
  private apiKey: string;
  private merchantCode: string;
  private webhookSecret: string;
  private circuitBreaker = new CircuitBreaker({ name: 'jenga', failureThreshold: 5, timeout: 30000 });

  constructor() {
    this.apiKey = config.jenga.apiKey;
    this.merchantCode = config.jenga.merchantCode;
    this.webhookSecret = config.jenga.webhookSecret;

    this.client = axios.create({
      baseURL: config.jenga.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-Merchant-Code': this.merchantCode,
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info('Jenga API Request', {
          method: config.method,
          url: config.url,
          data: config.data,
        });
        return config;
      },
      (error) => {
        logger.error('Jenga API Request Error', { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.info('Jenga API Response', {
          status: response.status,
          data: response.data,
        });
        return response;
      },
      (error) => {
        logger.error('Jenga API Response Error', {
          status: error.response?.status,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Initiate M-Pesa STK Push payment
   */
  async initiateMpesaPayment(request: JengaPaymentRequest): Promise<JengaPaymentResponse> {
    return metrics.time('jenga.mpesa', () =>
      this.circuitBreaker.execute(() =>
        withRetry(async () => {
          try {
            const response = await this.client.post('/payments/mpesa/stkpush', {
              phoneNumber: this.formatPhoneNumber(request.phoneNumber),
              amount: request.amount,
              currency: request.currency,
              reference: request.reference,
              description: request.description || 'Payment',
              merchantCode: this.merchantCode,
            });
            return {
              requestId: response.data.requestId,
              status: response.data.status,
              message: response.data.message,
              transactionId: response.data.transactionId,
            };
          } catch (error: any) {
            logger.error('M-Pesa payment initiation failed', { error, request });
            throw new Error(`M-Pesa payment failed: ${error.message}`);
          }
        }, {}, 'jenga.mpesa')
      )
    );
  }

  /**
   * Initiate Airtel Money payment
   */
  async initiateAirtelPayment(request: JengaPaymentRequest): Promise<JengaPaymentResponse> {
    return metrics.time('jenga.airtel', () =>
      this.circuitBreaker.execute(() =>
        withRetry(async () => {
          try {
            const response = await this.client.post('/payments/airtel', {
              phoneNumber: this.formatPhoneNumber(request.phoneNumber),
              amount: request.amount,
              currency: request.currency,
              reference: request.reference,
              description: request.description || 'Payment',
              merchantCode: this.merchantCode,
            });
            return {
              requestId: response.data.requestId,
              status: response.data.status,
              message: response.data.message,
              transactionId: response.data.transactionId,
            };
          } catch (error: any) {
            logger.error('Airtel Money payment initiation failed', { error, request });
            throw new Error(`Airtel Money payment failed: ${error.message}`);
          }
        }, {}, 'jenga.airtel')
      )
    );
  }

  /**
   * Initiate bank transfer payment
   */
  async initiateBankTransfer(
    accountNumber: string,
    bankCode: string,
    amount: number,
    currency: string,
    reference: string
  ): Promise<JengaPaymentResponse> {
    try {
      const response = await this.client.post('/payments/bank-transfer', {
        accountNumber,
        bankCode,
        amount,
        currency,
        reference,
        merchantCode: this.merchantCode,
      });

      return {
        requestId: response.data.requestId,
        status: response.data.status,
        message: response.data.message,
        transactionId: response.data.transactionId,
      };
    } catch (error: any) {
      logger.error('Bank transfer initiation failed', { error });
      throw new Error(`Bank transfer failed: ${error.message}`);
    }
  }

  /**
   * Initiate card payment
   */
  async initiateCardPayment(
    cardDetails: {
      cardNumber: string;
      expiryMonth: string;
      expiryYear: string;
      cvv: string;
      cardholderName: string;
    },
    amount: number,
    currency: string,
    reference: string
  ): Promise<JengaPaymentResponse> {
    try {
      const response = await this.client.post('/payments/card', {
        ...cardDetails,
        amount,
        currency,
        reference,
        merchantCode: this.merchantCode,
      });

      return {
        requestId: response.data.requestId,
        status: response.data.status,
        message: response.data.message,
        transactionId: response.data.transactionId,
      };
    } catch (error: any) {
      logger.error('Card payment initiation failed', { error });
      throw new Error(`Card payment failed: ${error.message}`);
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(transactionId: string): Promise<any> {
    try {
      // Cache payment status for 30 seconds to reduce API calls
      const cacheKey = `jenga:status:${transactionId}`;
      const { cacheService } = await import('../../cache/cacheService');
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached;

      const response = await this.circuitBreaker.execute(() =>
        withRetry(() => this.client.get(`/payments/status/${transactionId}`), {}, 'jenga.status')
      );

      await cacheService.set(cacheKey, response.data, 30);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get payment status', { error, transactionId });
      throw new Error(`Failed to get payment status: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(signature: string, payload: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  }

  /**
   * Format phone number to international format
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Add country code if not present
    if (!cleaned.startsWith('254') && !cleaned.startsWith('+254')) {
      // Assuming Kenya, adjust as needed
      if (cleaned.startsWith('0')) {
        cleaned = '254' + cleaned.substring(1);
      } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
        cleaned = '254' + cleaned;
      }
    }

    return cleaned.replace(/^\+/, '');
  }
}

export const jengaClient = new JengaAPIClient();
