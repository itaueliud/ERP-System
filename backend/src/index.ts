import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from './config';
import { compressionMiddleware } from './middleware/compression';
import { queryMonitorMiddleware, requestTimingMiddleware } from './middleware/performanceMiddleware';
import { db } from './database';
import { redis } from './cache';
import logger from './utils/logger';
import { authRoutes } from './auth';
import { authenticate } from './auth/authMiddleware';
import userRoutes from './users/userRoutes';
import { organizationRoutes } from './organization';
import { clientRoutes, communicationRoutes } from './clients';
import { paymentRoutes } from './payments';
import { contractRoutes } from './contracts';
import { projectRoutes } from './projects';
import { notificationRoutes } from './notifications';
import { auditRoutes } from './audit';
import { chatRoutes } from './chat';
import { reportRoutes } from './reports';
import { taskRoutes } from './tasks';
import { propertyRoutes } from './properties';
import { dashboardRoutes } from './dashboard';
import { reportingRoutes } from './reporting';
import trainingRoutes from './training/trainingRoutes';
import trainerRoutes from './training/trainerRoutes';
import agentRoutes from './agents/agentRoutes';
import miscRoutes from './misc/miscRoutes';
import adminRoutes from './admin/adminRoutes';
import pricingRoutes from './admin/pricingRoutes';
import teamRoutes from './teams/teamRoutes';
import dailyReportRoutes from './reports/dailyReportRoutes';
import metrics from './utils/metrics';

const app = express();

// Security middleware
app.use(helmet());
app.use(compressionMiddleware());
app.use(queryMonitorMiddleware());
app.use(requestTimingMiddleware());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman)
      if (!origin) return callback(null, true);
      if ((config.security.corsOrigin as string[]).includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    const dbConnected = await db.testConnection();
    const redisConnected = await redis.testConnection();
    const poolStats = db.getPoolStats();

    res.json({
      status: 'ok',
      environment: config.env,
      timestamp: new Date().toISOString(),
      database: {
        connected: dbConnected,
        pool: poolStats,
      },
      redis: {
        connected: redisConnected,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      environment: config.env,
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
      },
      redis: {
        connected: false,
      },
    });
  }
});

// API root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'TechSwiftTrix ERP Backend API',
    version: '1.0.0',
    environment: config.env,
  });
});

// API routes — auth is public, all others require JWT
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', authenticate, userRoutes);
app.use('/api/v1/organization', authenticate, organizationRoutes);
app.use('/api/v1/clients', authenticate, clientRoutes);
app.use('/api/v1/clients', authenticate, communicationRoutes);
app.use('/api/v1/payments', authenticate, paymentRoutes);
app.use('/api/v1/contracts', authenticate, contractRoutes);
app.use('/api/v1/projects', authenticate, projectRoutes);
app.use('/api/v1/notifications', authenticate, notificationRoutes);
app.use('/api/v1/audit-logs', authenticate, auditRoutes);
app.use('/api/v1/chat', authenticate, chatRoutes);
app.use('/api/v1/reports', authenticate, reportRoutes);
app.use('/api/v1/tasks', authenticate, taskRoutes);
app.use('/api/v1/properties', authenticate, propertyRoutes);
app.use('/api/v1/dashboard', authenticate, dashboardRoutes);
app.use('/api/reports', authenticate, reportingRoutes);
app.use('/api/v1/training', authenticate, trainingRoutes);
app.use('/api/v1/trainer', authenticate, trainerRoutes);
app.use('/api/v1/agents', authenticate, agentRoutes);
app.use('/api/v1/admin', authenticate, adminRoutes);
app.use('/api/v1/pricing', authenticate, pricingRoutes);
app.use('/api/v1/teams', authenticate, teamRoutes);
app.use('/api/v1/daily-reports', authenticate, dailyReportRoutes);
app.use('/api/v1', authenticate, miscRoutes);

// Metrics endpoint (internal — restrict in production via middleware if needed)
app.get('/metrics', (_req, res) => {
  res.json(metrics.snapshot());
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err, path: req.path });
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.env === 'development' ? err.message : undefined,
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    logger.info('Testing database connection...');
    const dbConnected = await db.testConnection();
    
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    logger.info('Database connection successful');

    // Connect to Redis
    logger.info('Connecting to Redis...');
    await redis.connect();
    const redisConnected = await redis.testConnection();
    
    if (!redisConnected) {
      throw new Error('Redis connection failed');
    }

    logger.info('Redis connection successful');

    // Start server
    app.listen(config.port, () => {
      logger.info(`🚀 TechSwiftTrix ERP Backend running on port ${config.port}`);
      logger.info(`📦 Environment: ${config.env}`);
      logger.info(`🔗 API URL: ${config.apiBaseUrl}`);
      logger.info(`💾 Database: ${config.database.host}:${config.database.port}/${config.database.name}`);
      logger.info(`🔴 Redis: ${config.redis.host}:${config.redis.port}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await db.close();
  await redis.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await db.close();
  await redis.close();
  process.exit(0);
});

startServer();

export default app;
