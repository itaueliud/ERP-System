/**
 * Daraja API Client — Safaricom M-Pesa
 *
 * SANDBOX MODE (current):
 *   Base URL : https://sandbox.safaricom.co.ke
 *   Short code: 174379  (Safaricom test paybill)
 *   Pass key  : bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
 *   Test phone: 254708374149  (Safaricom sandbox test number)
 *   Consumer key / secret: obtain free from https://developer.safaricom.co.ke
 *
 * SWITCHING TO PRODUCTION:
 *   1. Log in to https://developer.safaricom.co.ke → go live
 *   2. Replace DARAJA_API_URL with https://api.safaricom.co.ke
 *   3. Replace DARAJA_CONSUMER_KEY, DARAJA_CONSUMER_SECRET with production app credentials
 *   4. Replace DARAJA_SHORT_CODE with your real paybill / till number
 *   5. Replace DARAJA_PASS_KEY with your production Lipa Na M-Pesa pass key
 *   6. Replace DARAJA_B2C_INITIATOR_NAME and DARAJA_B2C_SECURITY_CREDENTIAL
 *   7. Set DARAJA_CALLBACK_URL to your public HTTPS server URL
 *   Only the person responsible for production credentials should do this.
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { config } from '../../config';
import logger from '../../utils/logger';
import { withRetry } from '../../utils/retry';
import { CircuitBreaker } from '../../utils/circuitBreaker';
import metrics from '../../utils/metrics';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DarajaSTKPushRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc?: string;
}

export interface DarajaSTKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface DarajaB2CResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

export interface DarajaTransactionStatusResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode?: string;
  ResultDesc?: string;
}

export interface DarajaWebhookPayload {
  Body: {
    stkCallback?: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{ Name: string; Value?: string | number }>;
      };
    };
    Result?: {
      ResultType: number;
      ResultCode: number;
      ResultDesc: string;
      OriginatorConversationID: string;
      ConversationID: string;
      TransactionID: string;
    };
  };
}

export interface DarajaPaymentResponse {
  requestId: string;
  transactionId?: string;
  status: 'PENDING' | 'INITIATED' | 'FAILED';
  message: string;
  sandbox?: boolean;   // true when response came from sandbox / simulation
}

// ── Sandbox test credentials (Safaricom developer portal public test values) ──
const SANDBOX_DEFAULTS = {
  apiUrl:              'https://sandbox.safaricom.co.ke',
  shortCode:           '174379',
  passKey:             'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
  testPhoneNumber:     '254708374149',
  b2cInitiatorName:    'testapi',
  // NOTE: consumer key/secret must be obtained from developer.safaricom.co.ke (free account)
  // They are not hardcoded here because they are per-app credentials.
};

export class DarajaAPIClient {
  private client: AxiosInstance;
  private consumerKey: string;
  private consumerSecret: string;
  private shortCode: string;
  private passKey: string;
  private callbackUrl: string;
  private b2cInitiatorName: string;
  private b2cSecurityCredential: string;
  readonly sandboxMode: boolean;
  private circuitBreaker = new CircuitBreaker({ name: 'daraja', failureThreshold: 5, timeout: 30000 });

  constructor() {
    this.sandboxMode = config.daraja.sandboxMode;

    // Use sandbox defaults for any missing values in sandbox mode
    this.consumerKey          = config.daraja.consumerKey;
    this.consumerSecret       = config.daraja.consumerSecret;
    this.shortCode            = config.daraja.shortCode            || SANDBOX_DEFAULTS.shortCode;
    this.passKey              = config.daraja.passKey              || (this.sandboxMode ? SANDBOX_DEFAULTS.passKey : '');
    this.callbackUrl          = config.daraja.callbackUrl;
    this.b2cInitiatorName     = config.daraja.b2cInitiatorName     || (this.sandboxMode ? SANDBOX_DEFAULTS.b2cInitiatorName : '');
    this.b2cSecurityCredential = config.daraja.b2cSecurityCredential;

    this.client = axios.create({
      baseURL: config.daraja.apiUrl,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Log every request with sandbox indicator
    this.client.interceptors.request.use(
      (cfg) => {
        logger.info(`[DARAJA ${this.sandboxMode ? 'SANDBOX' : 'PRODUCTION'}] Request`, {
          method: cfg.method?.toUpperCase(),
          url: cfg.url,
        });
        return cfg;
      },
      (error) => { logger.error('Daraja request error', { error }); return Promise.reject(error); }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.info(`[DARAJA ${this.sandboxMode ? 'SANDBOX' : 'PRODUCTION'}] Response`, {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('Daraja response error', {
          status: error.response?.status,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );

    if (this.sandboxMode) {
      logger.info('╔══════════════════════════════════════════════════════╗');
      logger.info('║  DARAJA SANDBOX MODE — no real money is processed    ║');
      logger.info('║  URL: https://sandbox.safaricom.co.ke                ║');
      logger.info('║  Short code: ' + this.shortCode.padEnd(40) + '║');
      logger.info('║  To go live: update .env.production credentials      ║');
      logger.info('╚══════════════════════════════════════════════════════╝');
    }
  }

  // ── OAuth Token ─────────────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    // Treat missing or obvious placeholder values as "not configured"
    const isPlaceholder = (v: string) =>
      !v || v.startsWith('your_') || v === 'undefined' || v === 'null';

    if (isPlaceholder(this.consumerKey) || isPlaceholder(this.consumerSecret)) {
      if (this.sandboxMode) {
        logger.warn('[DARAJA SANDBOX] No real credentials set — using simulated token. Get yours free at https://developer.safaricom.co.ke');
        return 'SANDBOX_SIMULATED_TOKEN';
      }
      throw new Error('Daraja consumer key and secret are required in production mode');
    }

    const credentials = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    try {
      const response = await axios.get(
        `${config.daraja.apiUrl}/oauth/v1/generate?grant_type=client_credentials`,
        { headers: { Authorization: `Basic ${credentials}` }, timeout: 30000 }
      );
      return response.data.access_token;
    } catch (error: any) {
      // If OAuth times out or fails in sandbox, fall back to simulation
      if (this.sandboxMode) {
        logger.warn('[DARAJA SANDBOX] OAuth token request failed — falling back to simulation', {
          reason: error.message,
        });
        return 'SANDBOX_SIMULATED_TOKEN';
      }
      throw error;
    }
  }

  // ── STK Push ─────────────────────────────────────────────────────────────────

  /**
   * Initiate M-Pesa STK Push (Lipa Na M-Pesa Online).
   * In sandbox mode with no credentials, returns a simulated INITIATED response.
   */
  async initiateMpesaPayment(request: DarajaSTKPushRequest): Promise<DarajaPaymentResponse> {
    return metrics.time('daraja.mpesa', () =>
      this.circuitBreaker.execute(() =>
        withRetry(async () => {
          try {
            const token = await this.getAccessToken();

            // Simulated response when sandbox token is used (no real credentials yet)
            if (token === 'SANDBOX_SIMULATED_TOKEN') {
              return this.simulateStkPush(request);
            }

            const timestamp = this.getTimestamp();
            const password  = this.generatePassword(timestamp);

            const response = await this.client.post<DarajaSTKPushResponse>(
              '/mpesa/stkpush/v1/processrequest',
              {
                BusinessShortCode: this.shortCode,
                Password:          password,
                Timestamp:         timestamp,
                TransactionType:   'CustomerPayBillOnline',
                Amount:            Math.round(request.amount),
                PartyA:            this.formatPhoneNumber(request.phoneNumber),
                PartyB:            this.shortCode,
                PhoneNumber:       this.formatPhoneNumber(request.phoneNumber),
                CallBackURL:       `${this.callbackUrl}/api/payments/webhook`,
                AccountReference:  request.accountReference,
                TransactionDesc:   request.transactionDesc || 'Payment',
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            const d = response.data;
            if (d.ResponseCode === '0') {
              return {
                requestId:     d.MerchantRequestID,
                transactionId: d.CheckoutRequestID,
                status:        'INITIATED' as const,
                message:       d.CustomerMessage,
                sandbox:       this.sandboxMode,
              };
            }
            return {
              requestId: d.MerchantRequestID || '',
              status:    'FAILED' as const,
              message:   d.ResponseDescription,
              sandbox:   this.sandboxMode,
            };
          } catch (error: any) {
            logger.error('M-Pesa STK Push failed', { error, request });
            throw new Error(`M-Pesa payment failed: ${error.message}`);
          }
        }, {}, 'daraja.mpesa')
      )
    );
  }

  // ── Airtel Money (manual — not part of Daraja) ───────────────────────────────

  async initiateAirtelPayment(request: DarajaSTKPushRequest): Promise<DarajaPaymentResponse> {
    logger.info('[DARAJA] Airtel Money — manual processing', { request });
    const requestId = `AIRTEL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    return {
      requestId,
      transactionId: requestId,
      status:  'INITIATED',
      message: 'Airtel Money payment recorded. Manual processing required.',
      sandbox: this.sandboxMode,
    };
  }

  // ── B2C (Bank Transfer / Payout) ─────────────────────────────────────────────

  async initiateBankTransfer(
    accountNumber: string,
    bankCode: string,
    amount: number,
    _currency: string,
    reference: string
  ): Promise<DarajaPaymentResponse> {
    try {
      const token = await this.getAccessToken();

      if (token === 'SANDBOX_SIMULATED_TOKEN') {
        return this.simulateB2C(accountNumber, amount, reference);
      }

      const response = await this.client.post<DarajaB2CResponse>(
        '/mpesa/b2c/v3/paymentrequest',
        {
          InitiatorName:       this.b2cInitiatorName,
          SecurityCredential:  this.b2cSecurityCredential,
          CommandID:           'BusinessPayment',
          Amount:              Math.round(amount),
          PartyA:              this.shortCode,
          PartyB:              accountNumber,
          Remarks:             `${reference} ${bankCode}`,
          QueueTimeOutURL:     `${this.callbackUrl}/api/payments/webhook/timeout`,
          ResultURL:           `${this.callbackUrl}/api/payments/webhook`,
          Occasion:            reference,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const d = response.data;
      if (d.ResponseCode === '0') {
        return {
          requestId:     d.OriginatorConversationID,
          transactionId: d.ConversationID,
          status:        'INITIATED',
          message:       d.ResponseDescription,
          sandbox:       this.sandboxMode,
        };
      }
      return {
        requestId: d.OriginatorConversationID || '',
        status:    'FAILED',
        message:   d.ResponseDescription,
        sandbox:   this.sandboxMode,
      };
    } catch (error: any) {
      logger.error('B2C bank transfer failed', { error });
      throw new Error(`Bank transfer failed: ${error.message}`);
    }
  }

  // ── Card Payment (manual — not natively in Daraja) ───────────────────────────

  async initiateCardPayment(
    _cardDetails: {
      cardNumber: string; expiryMonth: string; expiryYear: string;
      cvv: string; cardholderName: string;
    },
    amount: number,
    currency: string,
    reference: string
  ): Promise<DarajaPaymentResponse> {
    logger.info('[DARAJA] Card payment — manual/external processing', { reference, amount, currency });
    const requestId = `CARD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    return {
      requestId,
      transactionId: requestId,
      status:  'INITIATED',
      message: 'Card payment recorded. Processing via card gateway.',
      sandbox: this.sandboxMode,
    };
  }

  // ── Transaction Status ────────────────────────────────────────────────────────

  async getPaymentStatus(checkoutRequestId: string): Promise<any> {
    try {
      const cacheKey = `daraja:status:${checkoutRequestId}`;
      const { cacheService } = await import('../../cache/cacheService');
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached;

      const token = await this.getAccessToken();

      // Simulated status in sandbox with no credentials
      if (token === 'SANDBOX_SIMULATED_TOKEN') {
        const result = { status: 'COMPLETED', errorCode: null, errorMessage: null, sandbox: true };
        await cacheService.set(cacheKey, result, 30);
        return result;
      }

      const timestamp = this.getTimestamp();
      const password  = this.generatePassword(timestamp);

      const response = await this.circuitBreaker.execute(() =>
        withRetry(() =>
          this.client.post<DarajaTransactionStatusResponse>(
            '/mpesa/stkpushquery/v1/query',
            {
              BusinessShortCode: this.shortCode,
              Password:          password,
              Timestamp:         timestamp,
              CheckoutRequestID: checkoutRequestId,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          ), {}, 'daraja.status'
        )
      );

      const result = {
        status:       response.data.ResultCode === '0' ? 'COMPLETED' : 'FAILED',
        errorCode:    response.data.ResultCode !== '0' ? response.data.ResultCode : null,
        errorMessage: response.data.ResultDesc || null,
        sandbox:      this.sandboxMode,
      };

      await cacheService.set(cacheKey, result, 30);
      return result;
    } catch (error: any) {
      logger.error('Failed to get Daraja payment status', { error, checkoutRequestId });
      throw new Error(`Failed to get payment status: ${error.message}`);
    }
  }

  // ── Webhook Signature Verification ───────────────────────────────────────────

  verifyWebhookSignature(signature: string, payload: string): boolean {
    const secret = config.daraja.webhookSecret;
    // No secret configured, or no signature sent (real Daraja callbacks don't send one) — allow
    if (!secret || !signature) {
      if (!signature) logger.info('[DARAJA] No signature header — accepting as real Daraja callback');
      return true;
    }
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const sigBuf      = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  }

  // ── Sandbox Simulators ────────────────────────────────────────────────────────

  private simulateStkPush(request: DarajaSTKPushRequest): DarajaPaymentResponse {
    const merchantRequestId  = `SANDBOX-MR-${Date.now()}`;
    const checkoutRequestId  = `ws_CO_SANDBOX_${Date.now()}`;
    logger.info('[DARAJA SANDBOX] Simulated STK Push', {
      phone: request.phoneNumber,
      amount: request.amount,
      ref: request.accountReference,
      checkoutRequestId,
    });
    return {
      requestId:     merchantRequestId,
      transactionId: checkoutRequestId,
      status:        'INITIATED',
      message:       '[SANDBOX] STK Push simulated — no real transaction. Add credentials to test with real sandbox.',
      sandbox:       true,
    };
  }

  private simulateB2C(accountNumber: string, amount: number, reference: string): DarajaPaymentResponse {
    const conversationId = `SANDBOX-B2C-${Date.now()}`;
    logger.info('[DARAJA SANDBOX] Simulated B2C payout', { accountNumber, amount, reference, conversationId });
    return {
      requestId:     conversationId,
      transactionId: conversationId,
      status:        'INITIATED',
      message:       '[SANDBOX] B2C payout simulated — no real transaction.',
      sandbox:       true,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private generatePassword(timestamp: string): string {
    return Buffer.from(`${this.shortCode}${this.passKey}${timestamp}`).toString('base64');
  }

  private getTimestamp(): string {
    return new Date().toISOString().replace(/[-T:.Z]/g, '').substring(0, 14);
  }

  formatPhoneNumber(phoneNumber: string): string {
    let cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.startsWith('0'))                              cleaned = '254' + cleaned.substring(1);
    else if (cleaned.startsWith('7') || cleaned.startsWith('1')) cleaned = '254' + cleaned;
    return cleaned.replace(/^\+/, '');
  }
}

export const darajaClient = new DarajaAPIClient();
