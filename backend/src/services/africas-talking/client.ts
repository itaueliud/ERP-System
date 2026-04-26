import axios, { AxiosInstance } from 'axios';
import { config } from '../../config';
import logger from '../../utils/logger';

export interface SMSMessage {
  to: string | string[];
  message: string;
  from?: string;
}

export interface SMSResponse {
  recipients: Array<{
    number: string;
    status: string;
    messageId: string;
    cost: string;
  }>;
  message: string;
}

export interface SMSDeliveryReport {
  id: string;
  phoneNumber: string;
  status: 'Success' | 'Failed' | 'Sent' | 'Queued' | 'Rejected';
  networkCode: string;
  failureReason?: string;
  retryCount: number;
}

export class AfricasTalkingClient {
  private client: AxiosInstance;
  private username: string;
  private apiKey: string;
  private senderId: string;

  constructor() {
    this.username = config.africasTalking.username;
    this.apiKey = config.africasTalking.apiKey;
    this.senderId = config.africasTalking.senderId;

    this.client = axios.create({
      baseURL: 'https://api.africastalking.com/version1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey': this.apiKey,
        'Accept': 'application/json',
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info('Africa\'s Talking API Request', {
          method: config.method,
          url: config.url,
        });
        return config;
      },
      (error) => {
        logger.error('Africa\'s Talking API Request Error', { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.info('Africa\'s Talking API Response', {
          status: response.status,
        });
        return response;
      },
      (error) => {
        logger.error('Africa\'s Talking API Response Error', {
          status: error.response?.status,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );

    logger.info('Africa\'s Talking client initialized');
  }

  /**
   * Send SMS to one or multiple recipients
   */
  async sendSMS(message: SMSMessage): Promise<SMSResponse> {
    try {
      const recipients = Array.isArray(message.to) ? message.to.join(',') : message.to;

      const params = new URLSearchParams();
      params.append('username', this.username);
      params.append('to', recipients);
      params.append('message', message.message);
      params.append('from', message.from || this.senderId);

      const response = await this.client.post('/messaging', params);

      const result: SMSResponse = {
        recipients: response.data.SMSMessageData.Recipients.map((r: any) => ({
          number: r.number,
          status: r.status,
          messageId: r.messageId,
          cost: r.cost,
        })),
        message: response.data.SMSMessageData.Message,
      };

      logger.info('SMS sent successfully', {
        recipientCount: result.recipients.length,
        successCount: result.recipients.filter((r) => r.status === 'Success').length,
      });

      return result;
    } catch (error: any) {
      logger.error('Failed to send SMS', { error, message });
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulkSMS(messages: Array<{ to: string; message: string }>): Promise<SMSResponse[]> {
    const results: SMSResponse[] = [];

    for (const msg of messages) {
      try {
        const result = await this.sendSMS(msg);
        results.push(result);
      } catch (error: any) {
        logger.error('Failed to send bulk SMS message', { error, to: msg.to });
        // Continue with other messages even if one fails
      }
    }

    return results;
  }

  /**
   * Send high-priority notification SMS
   */
  async sendNotificationSMS(
    phoneNumber: string,
    title: string,
    message: string
  ): Promise<SMSResponse> {
    const fullMessage = `${title}\n\n${message}\n\n- TechSwiftTrix ERP`;

    return this.sendSMS({
      to: phoneNumber,
      message: fullMessage,
    });
  }

  /**
   * Send OTP SMS
   */
  async sendOTP(phoneNumber: string, otp: string): Promise<SMSResponse> {
    const message = `Your TechSwiftTrix ERP verification code is: ${otp}. This code will expire in 10 minutes. Do not share this code with anyone.`;

    return this.sendSMS({
      to: phoneNumber,
      message,
    });
  }

  /**
   * Send payment confirmation SMS
   */
  async sendPaymentConfirmation(
    phoneNumber: string,
    amount: number,
    currency: string,
    transactionId: string
  ): Promise<SMSResponse> {
    const message = `Payment Confirmed!\n\nAmount: ${currency} ${amount.toFixed(2)}\nTransaction ID: ${transactionId}\n\nThank you for your payment.\n\n- TechSwiftTrix ERP`;

    return this.sendSMS({
      to: phoneNumber,
      message,
    });
  }

  /**
   * Send reminder SMS
   */
  async sendReminder(
    phoneNumber: string,
    reminderType: string,
    details: string
  ): Promise<SMSResponse> {
    const message = `Reminder: ${reminderType}\n\n${details}\n\n- TechSwiftTrix ERP`;

    return this.sendSMS({
      to: phoneNumber,
      message,
    });
  }

  /**
   * Fetch delivery reports
   */
  async fetchDeliveryReports(messageId?: string): Promise<SMSDeliveryReport[]> {
    try {
      const params = new URLSearchParams();
      params.append('username', this.username);
      if (messageId) {
        params.append('messageId', messageId);
      }

      const response = await this.client.get('/messaging', { params });

      return response.data.SMSMessageData.DeliveryReports.map((report: any) => ({
        id: report.id,
        phoneNumber: report.phoneNumber,
        status: report.status,
        networkCode: report.networkCode,
        failureReason: report.failureReason,
        retryCount: report.retryCount,
      }));
    } catch (error: any) {
      logger.error('Failed to fetch delivery reports', { error, messageId });
      throw new Error(`Failed to fetch delivery reports: ${error.message}`);
    }
  }

  /**
   * Format phone number for Africa's Talking (E.164 format)
   */
  formatPhoneNumber(phoneNumber: string, countryCode: string = '254'): string {
    // Remove any non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Add country code if not present
    if (!cleaned.startsWith(countryCode)) {
      if (cleaned.startsWith('0')) {
        cleaned = countryCode + cleaned.substring(1);
      } else if (cleaned.length < 12) {
        cleaned = countryCode + cleaned;
      }
    }

    return '+' + cleaned;
  }
}

export const africasTalkingClient = new AfricasTalkingClient();
