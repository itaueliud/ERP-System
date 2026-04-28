import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import config from './config';
import { swaggerSpec } from './config/swagger';
import { initializeSentry, getSentryErrorHandler } from './config/sentry';
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
import developerTeamRoutes from './payments/developerTeamRoutes';
import staffPaymentRoutes from './payments/staffPaymentRoutes';
import { contractRoutes } from './contracts';
import { projectRoutes } from './projects';
import { notificationRoutes } from './notifications';
import { auditRoutes } from './audit';
import { chatRoutes, chatServer } from './chat';
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
import marketerRoutes from './marketer/marketerRoutes';
import marketerAdminRoutes from './marketer/marketerAdminRoutes';
import incidentRoutes from './incidents/incidentRoutes';
import deploymentRoutes from './deployments/deploymentRoutes';
import riskRoutes from './risks/riskRoutes';
import sseRoutes from './realtime/sseRoutes';
import { perUserRateLimit } from './middleware/perUserRateLimit';
import metrics from './utils/metrics';
import { startPaymentPoller, stopPaymentPoller } from './payments/paymentPoller';
import { webhookRouter } from './payments/webhookRouter';

const app = express();

// Trust the first proxy hop so req.ip reflects the real client IP from X-Forwarded-For.
// Required for accurate audit logging and rate limiting behind a load balancer / reverse proxy.
// Set to the number of trusted proxy hops in your infrastructure (1 for a single LB).
app.set('trust proxy', parseInt(process.env.TRUST_PROXY_HOPS || '1', 10));

// Initialize Sentry (must be first)
initializeSentry(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline needed for Swagger UI
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // allow Swagger UI to load external resources
}));
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

// Cookie parsing (required for httpOnly auth_token cookie support)
app.use(cookieParser());

// Body parsing middleware — 1 MB default; specific upload routes override as needed
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health check endpoint — minimal info, no infrastructure details
app.get('/health', async (_req, res) => {
  try {
    const dbConnected = await db.testConnection();
    const redisConnected = await redis.testConnection();

    const allHealthy = dbConnected && redisConnected;
    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
    });
  }
});

// API root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'TechSwiftTrix ERP Backend API',
    version: '1.0.0',
    environment: config.env,
    documentation: '/api-docs',
  });
});

// API Documentation — gated behind authentication in production
if (config.env === 'production') {
  app.use('/api-docs', authenticate, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'TechSwiftTrix ERP API Documentation',
  }));
} else {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'TechSwiftTrix ERP API Documentation',
  }));
}

// Serve uploaded marketer property images — requires authentication
app.use('/uploads', authenticate, express.static(require('path').join(process.cwd(), 'uploads')));

// Public image serve — property images stored in DB (no auth needed for img tags)
app.get('/api/v1/marketer/images/:propertyId/:index', async (req: any, res: any) => {
  try {
    // Validate propertyId is a UUID and index is a non-negative integer
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.params.propertyId)) {
      return res.status(400).send('Invalid property ID');
    }
    const index = parseInt(req.params.index, 10);
    if (isNaN(index) || index < 0 || index > 99) {
      return res.status(400).send('Invalid index');
    }

    const { db } = await import('./database/connection');
    const result = await db.query(
      `SELECT data, mimetype, filename FROM marketer_property_images
       WHERE property_id = $1 AND sort_order = $2 LIMIT 1`,
      [req.params.propertyId, index]
    );
    if (!result.rows.length || !result.rows[0].data) {
      return res.status(404).send('Not found');
    }
    const { data, mimetype } = result.rows[0];
    // Sanitize filename — strip any characters that could break the header
    const safeFilename = (result.rows[0].filename || 'image')
      .replace(/[^\w.\-]/g, '_')
      .substring(0, 100);
    res.set('Content-Type', mimetype || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Content-Disposition', `inline; filename="${safeFilename}"`);
    return res.send(data);
  } catch { return res.status(500).send('Error'); }
});

// API routes — auth is public, all others require JWT + per-user rate limiting
app.use('/api/v1/auth', authRoutes);

// Daraja webhook — dedicated public router (webhook only, no other payment routes)
app.use('/api/payments', webhookRouter);

const authAndLimit = [authenticate, perUserRateLimit()];

app.use('/api/v1/users', authAndLimit, userRoutes);
app.use('/api/v1/organization', authAndLimit, organizationRoutes);
app.use('/api/v1/clients', authAndLimit, clientRoutes);
app.use('/api/v1/clients', authAndLimit, communicationRoutes);
app.use('/api/v1/payments', authAndLimit, paymentRoutes);
app.use('/api/v1/developer-teams', authAndLimit, developerTeamRoutes);
app.use('/api/v1/staff-payments', authAndLimit, staffPaymentRoutes);
app.use('/api/v1/contracts', authAndLimit, contractRoutes);
app.use('/api/v1/projects', authAndLimit, projectRoutes);
app.use('/api/v1/notifications', authAndLimit, notificationRoutes);
app.use('/api/v1/audit-logs', authAndLimit, auditRoutes);
app.use('/api/v1/chat', authAndLimit, chatRoutes);
app.use('/api/v1/reports', authAndLimit, reportRoutes);
app.use('/api/v1/tasks', authAndLimit, taskRoutes);
app.use('/api/v1/properties', authAndLimit, propertyRoutes);
app.use('/api/v1/dashboard', authAndLimit, dashboardRoutes);
app.use('/api/reports', authAndLimit, reportingRoutes);
app.use('/api/v1/training', authAndLimit, trainingRoutes);
app.use('/api/v1/trainer', authAndLimit, trainerRoutes);
app.use('/api/v1/agents', authAndLimit, agentRoutes);
app.use('/api/v1/admin', authAndLimit, adminRoutes);
app.use('/api/v1/pricing', authAndLimit, pricingRoutes);
app.use('/api/v1/teams', authAndLimit, teamRoutes);
app.use('/api/v1/daily-reports', authAndLimit, dailyReportRoutes);
app.use('/api/v1/marketer', authAndLimit, marketerRoutes);
app.use('/api/v1/plotconnect', authAndLimit, marketerAdminRoutes);
app.use('/api/v1/incidents', authAndLimit, incidentRoutes);
app.use('/api/v1/deployments', authAndLimit, deploymentRoutes);
app.use('/api/v1/risks', authAndLimit, riskRoutes);
app.use('/api/v1/sse', authAndLimit, sseRoutes);
app.use('/api/v1', authAndLimit, miscRoutes);

// Sentry error handler (must be before other error handlers)
app.use(getSentryErrorHandler());

// Metrics endpoint — internal only, requires authentication
app.get('/metrics', authenticate, (_req, res) => {
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
    const httpServer = app.listen(config.port, () => {
      logger.info(`TechSwiftTrix ERP Backend running on port ${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`API URL: ${config.apiBaseUrl}`);
      logger.info(`Database: ${config.database.host}:${config.database.port}/${config.database.name}`);
      logger.info(`Redis: ${config.redis.host}:${config.redis.port}`);
    });

    // Attach Socket.IO for real-time chat
    chatServer.initialize(httpServer);

    // Start background payment poller — auto-resolves pending STK push payments
    startPaymentPoller();
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Handle graceful shutdown — guard against double-close (tsx watch triggers both SIGTERM + SIGINT)
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down gracefully...`);
  stopPaymentPoller();
  try { await db.close(); } catch { /* already closed */ }
  try { await redis.close(); } catch { /* already closed */ }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

startServer();

export default app;
