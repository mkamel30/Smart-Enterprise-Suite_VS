require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const { Server } = require('socket.io');
const cron = require('node-cron');

// Database and configuration
const db = require('./db');
const config = require('./config');
const logger = require('./utils/logger');

// Middleware imports
const { authenticateToken } = require('./middleware/auth');
const { apiLimiter, loginLimiter } = require('./middleware/rateLimits');
const { csrfMiddleware, injectCsrfToken, csrfErrorHandler } = require('./middleware/csrf');
const { 
  securityHeaders, 
  enforceHttps, 
  sanitizeRequest, 
  removeServerHeader 
} = require('./middleware/security');
const { errorHandler, notFoundHandler } = require('./utils/errorHandler');

// Swagger documentation
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();

// ===================== SECURITY MIDDLEWARE (ORDER MATTERS) =====================

// 1. Remove server header
app.use(removeServerHeader);

// 2. Enforce HTTPS in production
app.use(enforceHttps);

// 3. Security headers via Helmet
app.use(securityHeaders);

// 4. CORS Configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  maxAge: 86400
}));

// 5. Body parsing with size limits
app.use(express.json({ 
  limit: config.uploads.maxFileSize,
  strict: true
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: config.uploads.maxFileSize 
}));

// 6. CSRF Protection (must come after body parser)
app.use(csrfMiddleware);
app.use(injectCsrfToken);

// 7. Request sanitization
app.use(sanitizeRequest);

// 8. HTTP Request logging
app.use(pinoHttp({
  logger: logger,
  autoLogging: {
    ignore: (req) => req.url === '/health' || req.url === '/api/health'
  },
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} ${res.statusCode} - ${err.message}`,
  redact: ['req.headers.authorization', 'req.headers.cookie']
}));

// 9. Global rate limiting
app.use('/api', apiLimiter);

// ===================== SWAGGER DOCUMENTATION =====================

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Smart Enterprise Suite API',
      version: '1.0.0',
      description: 'Complete backend API for branch and maintenance management',
      contact: {
        name: 'API Support',
        email: 'support@smartenterprise.com'
      }
    },
    servers: [
      { 
        url: 'http://localhost:5000', 
        description: 'Development server' 
      },
      { 
        url: process.env.API_URL || 'http://localhost:5000', 
        description: 'Production server' 
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header using the Bearer scheme'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                code: { type: 'string' },
                timestamp: { type: 'string' }
              }
            }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ===================== HEALTH CHECK ENDPOINTS =====================

/**
 * @route GET /health
 * @summary Simple health check (no database)
 * @returns {Object} Health status
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'up',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv
  });
});

/**
 * @route GET /api/health
 * @summary Detailed health check with database
 * @returns {Object} Detailed health status
 */
app.get('/api/health', async (req, res, next) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime(),
      environment: config.nodeEnv,
      version: '1.0.0'
    });
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// ===================== ROUTE IMPORTS & SETUP =====================

// Authentication routes (with special rate limiting)
const authRouter = require('./routes/auth');
app.post('/api/auth/login', loginLimiter, authRouter);
app.use('/api/auth', authRouter);

// All other routes
app.use('/api', require('./routes/customers'));
app.use('/api', require('./routes/requests'));
app.use('/api', require('./routes/technicians'));
app.use('/api', require('./routes/settings'));
app.use('/api', require('./routes/warehouse'));
app.use('/api', require('./routes/stats'));
app.use('/api', require('./routes/inventory'));
app.use('/api', require('./routes/admin'));
app.use('/api', require('./routes/payments'));
app.use('/api', require('./routes/reports'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/branches', require('./routes/branches'));
app.use('/api/transfer-orders', require('./routes/transfer-orders'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/permissions', require('./routes/permissions'));
app.use('/api/warehouse-machines', require('./routes/warehouse-machines'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api', require('./routes/ai'));
app.use('/api/db', require('./routes/db'));
app.use('/api', require('./routes/simcards'));
app.use('/api', require('./routes/machines'));
app.use('/api', require('./routes/machine-history'));
app.use('/api/warehouse-sims', require('./routes/warehouseSims'));
app.use('/api/approvals', require('./routes/approvals'));
app.use('/api/machine-workflow', require('./routes/machine-workflow'));
app.use('/api/service-assignments', require('./routes/service-assignments'));
app.use('/api/maintenance-approvals', require('./routes/maintenance-approvals'));
app.use('/api/pending-payments', require('./routes/pending-payments'));
app.use('/api/track-machines', require('./routes/track-machines'));
app.use('/api/user', require('./routes/user-preferences'));
app.use('/api/push', require('./routes/push-notifications'));

// ===================== ERROR HANDLING =====================

// CSRF error handler (must come before general error handler)
app.use(csrfErrorHandler);

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// ===================== SERVER STARTUP =====================

const PORT = config.port;
const server = app.listen(PORT, () => {
  logger.info({
    port: PORT,
    host: config.host,
    apiUrl: `http://${config.host}:${PORT}/api`,
    docsUrl: `http://${config.host}:${PORT}/api-docs`,
    healthUrl: `http://${config.host}:${PORT}/health`,
    env: config.nodeEnv
  }, '✅ Server started successfully');

  // ===================== SOCKET.IO SETUP =====================

  const io = new Server(server, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
      methods: ['GET', 'POST']
    },
    maxHttpBufferSize: 1e6,
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on('connection', (socket) => {
    try {
      logger.info({ socketId: socket.id }, 'Client connected');

      // Join Branch Room
      socket.on('join-branch', (branchId, callback) => {
        try {
          if (!branchId || typeof branchId !== 'string') {
            return callback?.({ error: 'Invalid branch ID' });
          }
          socket.join(`branch-${branchId}`);
          logger.debug({ socketId: socket.id, branchId }, 'Joined branch room');
          callback?.({ success: true });
        } catch (error) {
          logger.error({ error, socketId: socket.id }, 'Join branch error');
          callback?.({ error: error.message });
        }
      });

      // Join User Room
      socket.on('join-user', (userId, callback) => {
        try {
          if (!userId || typeof userId !== 'string') {
            return callback?.({ error: 'Invalid user ID' });
          }
          socket.join(`user-${userId}`);
          logger.debug({ socketId: socket.id, userId }, 'Joined user room');
          callback?.({ success: true });
        } catch (error) {
          logger.error({ error, socketId: socket.id }, 'Join user error');
          callback?.({ error: error.message });
        }
      });

      // Disconnect Handler
      socket.on('disconnect', () => {
        logger.info({ socketId: socket.id }, 'Client disconnected');
      });

      // Error Handler
      socket.on('error', (error) => {
        logger.error({ error, socketId: socket.id }, 'Socket error');
      });
    } catch (error) {
      logger.error({ error }, 'Socket connection error');
    }
  });

  // Make io globally accessible for notifications
  global.io = io;
  logger.info('✅ Socket.IO server initialized');

  // ===================== SCHEDULED TASKS =====================

  // Daily backup at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('⏰ Running scheduled backup...');
    try {
      const { createBackup, cleanOldBackups } = require('./utils/backup');
      const backup = await createBackup('scheduled');
      logger.info({ filename: backup.filename }, '✅ Scheduled backup created');

      // Clean old backups (keep last 30 days)
      const deletedCount = await cleanOldBackups(30);
      if (deletedCount > 0) {
        logger.info({ deletedCount }, `✅ Cleaned ${deletedCount} old backups`);
      }
    } catch (error) {
      logger.error({ error }, '❌ Scheduled backup failed');
    }
  });

  logger.info('✅ Scheduled daily backup at 2:00 AM');

  // Optional: Hourly health check
  cron.schedule('0 * * * *', async () => {
    try {
      await db.$queryRaw`SELECT 1`;
      logger.debug('✅ Hourly health check passed');
    } catch (error) {
      logger.error({ error }, '❌ Hourly health check failed');
    }
  });

  // ===================== GRACEFUL SHUTDOWN =====================

  const gracefulShutdown = async (signal) => {
    logger.info(`📛 Received ${signal}, shutting down gracefully...`);

    // Close Socket.IO
    if (global.io) {
      global.io.close(() => {
        logger.info('✅ Socket.IO server closed');
      });
    }

    // Close HTTP server
    server.close(async () => {
      logger.info('✅ HTTP server closed');

      // Disconnect database
      await db.$disconnect();
      logger.info('✅ Database disconnected');

      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('⚠️ Forced shutdown - graceful shutdown timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error({ error }, '💥 Uncaught Exception');
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, '💥 Unhandled Rejection');
    process.exit(1);
  });
});

module.exports = { app, db, server };
