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
const { authenticateToken, requireManager } = require('./middleware/auth');
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

// 8. HTTP Request logging with enhanced redaction
app.use(pinoHttp({
  logger: logger,
  autoLogging: {
    ignore: (req) => req.url === '/health' || req.url === '/api/health'
  },
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    if (['/api/auth', '/api/user'].some(p => req.url.includes(p))) return 'debug';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} ${res.statusCode} - ${err.message}`,
  redact: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.body.password',
    'req.body.cardNumber',
    'req.body.accountNumber',
    'req.body.ssn',
    'req.body.pin',
    'req.body.token',
    'res.body.token',
    'res.body.refreshToken',
    'res.body.password'
  ]
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
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ===================== API ROUTES =====================

// Auth Routes
app.use('/api/auth', require('./routes/auth'));

// Main Routes
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/executive-dashboard', require('./routes/executive-dashboard'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api', require('./routes/requests'));
app.use('/api/users', require('./routes/auth'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/pending-payments', require('./routes/pending-payments'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/admin', require('./routes/admin'));

// Settings & Configuration
app.use('/api/settings', require('./routes/settings'));
app.use('/api/branches-lookup', require('./routes/branches'));
app.use('/api', require('./routes/branches'));

// Inventory & Warehouse
app.use('/api', require('./routes/inventory'));
app.use('/api/spare-parts', require('./routes/warehouse'));
app.use('/api/warehouse-machines', require('./routes/warehouse-machines'));
app.use('/api/warehouse-sims', require('./routes/warehouseSims'));

// Machines & SimCards
app.use('/api/machines', require('./routes/machines'));
app.use('/api/machine-parameters', require('./routes/settings'));
app.use('/api', require('./routes/simcards'));

// Sales
app.use('/api/sales', require('./routes/sales'));

// Transfers
app.use('/api/transfer-orders', require('./routes/transfer-orders'));

// Maintenance workflows
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/maintenance-approvals', require('./routes/maintenance-approvals'));
app.use('/api/service-assignments', require('./routes/service-assignments'));
app.use('/api/approvals', require('./routes/approvals'));
app.use('/api/track-machines', require('./routes/track-machines'));

// Notifications
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api', require('./routes/push-notifications'));

// Utilities
app.use('/api/ai', require('./routes/ai'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/db', require('./routes/db'));
app.use('/api/db-health', require('./routes/db-health'));

// ===================== HEALTH CHECK =====================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.nodeEnv
  });
});

// ===================== ERROR HANDLING =====================

// 404 handler
app.use(notFoundHandler);

// CSRF error handler
app.use(csrfErrorHandler);

// Global error handler
app.use(errorHandler);

// ===================== SERVER STARTUP =====================

const PORT = config.port;

const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  logger.info(`🔒 Environment: ${config.nodeEnv}`);
});

// ===================== SOCKET.IO FOR REAL-TIME =====================

const io = new Server(server, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

io.on('connection', (socket) => {
  logger.debug({ socketId: socket.id }, 'Client connected');

  socket.on('join-branch', (branchId) => {
    socket.join(`branch-${branchId}`);
    logger.debug({ branchId }, 'Client joined branch room');
  });

  socket.on('disconnect', () => {
    logger.debug({ socketId: socket.id }, 'Client disconnected');
  });
});

// Make io available globally for notifications
global.io = io;

// ===================== SCHEDULED TASKS =====================

// Initialize metrics cache on startup
const metricsCache = require('./services/metricsCache');
metricsCache.initializeCache().catch(err => {
  logger.warn({ error: err.message }, 'Initial metrics cache failed - will retry on schedule');
});

// Refresh metrics cache every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  logger.debug('Refreshing metrics cache...');
  try {
    await metricsCache.calculateAllMetrics();
    logger.debug('Metrics cache refreshed');
  } catch (error) {
    logger.warn({ error: error.message }, 'Metrics cache refresh failed');
  }
});

// Daily backup at 2 AM
if (config.backup.enabled) {
  cron.schedule(config.backup.schedule, async () => {
    logger.info('Running scheduled backup...');
    try {
      const backupService = require('./services/backupService');
      await backupService.createBackup();
      logger.info('Scheduled backup completed');
    } catch (error) {
      logger.error({ error }, 'Scheduled backup failed');
    }
  });
}

// ===================== GRACEFUL SHUTDOWN =====================

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

module.exports = { app, io };
