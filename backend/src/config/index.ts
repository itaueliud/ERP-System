import dotenv from 'dotenv';
import path from 'path';

// Load environment-specific .env file
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
// Resolve relative to the backend directory (two levels up from src/config/)
dotenv.config({ path: path.resolve(__dirname, '../../', envFile) });

// Validate required environment variables
const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'REDIS_HOST',
  'REDIS_PORT',
  'JWT_SECRET',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const config = {
  // Server Configuration
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Database Configuration
  database: {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    poolMin: parseInt(process.env.DB_POOL_MIN || '10', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '100', 10),
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // GitHub OAuth Configuration
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    callbackUrl: process.env.GITHUB_CALLBACK_URL || '',
  },

  // Daraja API Configuration (Safaricom M-Pesa)
  daraja: {
    apiUrl: process.env.DARAJA_API_URL || 'https://sandbox.safaricom.co.ke',
    consumerKey: process.env.DARAJA_CONSUMER_KEY || '',
    consumerSecret: process.env.DARAJA_CONSUMER_SECRET || '',
    shortCode: process.env.DARAJA_SHORT_CODE || '',
    passKey: process.env.DARAJA_PASS_KEY || '',
    callbackUrl: process.env.DARAJA_CALLBACK_URL || 'http://localhost:3000',
    webhookSecret: process.env.DARAJA_WEBHOOK_SECRET || '',
    b2cInitiatorName: process.env.DARAJA_B2C_INITIATOR_NAME || '',
    b2cSecurityCredential: process.env.DARAJA_B2C_SECURITY_CREDENTIAL || '',
    // true when using sandbox.safaricom.co.ke — auto-detected from URL
    sandboxMode: (process.env.DARAJA_API_URL || 'https://sandbox.safaricom.co.ke').includes('sandbox'),
  },

  // Firebase Configuration
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    databaseUrl: process.env.FIREBASE_DATABASE_URL || '',
  },

  // SendGrid Configuration
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@techswifttrix.com',
    fromName: process.env.SENDGRID_FROM_NAME || 'TechSwiftTrix ERP',
  },

  // Africa's Talking Configuration
  africasTalking: {
    username: process.env.AFRICAS_TALKING_USERNAME || '',
    apiKey: process.env.AFRICAS_TALKING_API_KEY || '',
    senderId: process.env.AFRICAS_TALKING_SENDER_ID || 'TechSwift',
  },

  // File Storage Configuration
  storage: {
    provider: (process.env.STORAGE_PROVIDER || 's3') as 's3' | 'r2',
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_REGION || 'us-east-1',
      bucket: process.env.AWS_S3_BUCKET || '',
    },
    r2: {
      accountId: process.env.R2_ACCOUNT_ID || '',
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      bucket: process.env.R2_BUCKET || '',
    },
  },

  // Security Configuration
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    sessionSecret: process.env.SESSION_SECRET || process.env.JWT_SECRET!,
    corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(o => o.trim()),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || 'logs/app.log',
  },

  // Background Jobs Configuration
  bull: {
    redis: {
      host: process.env.BULL_REDIS_HOST || process.env.REDIS_HOST!,
      port: parseInt(process.env.BULL_REDIS_PORT || process.env.REDIS_PORT || '6379', 10),
      db: parseInt(process.env.BULL_REDIS_DB || '1', 10),
    },
  },

  // Notification Configuration
  notifications: {
    batchIntervalHours: parseInt(process.env.NOTIFICATION_BATCH_INTERVAL_HOURS || '4', 10),
    retryAttempts: parseInt(process.env.NOTIFICATION_RETRY_ATTEMPTS || '3', 10),
    retryDelayMs: parseInt(process.env.NOTIFICATION_RETRY_DELAY_MS || '5000', 10),
  },

  // Report Configuration
  reports: {
    dailyDeadlineHour: parseInt(process.env.DAILY_REPORT_DEADLINE_HOUR || '22', 10),
    reminderIntervalMinutes: parseInt(
      process.env.DAILY_REPORT_REMINDER_INTERVAL_MINUTES || '30',
      10
    ),
    overdueHour: parseInt(process.env.DAILY_REPORT_OVERDUE_HOUR || '23', 10),
  },

  // GitHub Integration Configuration
  githubIntegration: {
    syncIntervalMinutes: parseInt(process.env.GITHUB_SYNC_INTERVAL_MINUTES || '15', 10),
  },

  // File Upload Configuration
  fileUpload: {
    maxSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'pdf,docx,xlsx,png,jpg,jpeg,gif').split(','),
  },

  // Audit Log Configuration
  auditLog: {
    retentionYears: parseInt(process.env.AUDIT_LOG_RETENTION_YEARS || '7', 10),
  },

  // Chat Configuration
  chat: {
    messageRetentionDays: parseInt(process.env.CHAT_MESSAGE_RETENTION_DAYS || '90', 10),
    maxAttachmentSizeMb: parseInt(process.env.CHAT_MAX_ATTACHMENT_SIZE_MB || '10', 10),
  },
};

export default config;

// ConfigService is exported after `config` to avoid circular dependency:
// configService → database/connection → config (needs config to be defined first)
export { configService, ConfigService } from './configService';
export type { ConfigChange, Environment } from './configService';
