require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const pinoHttp = require('pino-http');
const { Server } = require('socket.io');
const db = require('./db');
const config = require('./config');
const logger = require('./utils/logger');
const errorHandler = require('./utils/errorHandler');
const { AppError } = require('./utils/errors');
const cron = require('node-cron');

const app = express();

// Swagger documentation
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CS Department Console API',
      version: '1.0.0',
      description: 'Backend API for CS Department Management System'
    },
    servers: [
      { url: 'http://localhost:5000', description: 'Development server' },
      { url: process.env.API_URL || 'http://localhost:5000', description: 'Production server' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Security & Rate Limiting
app.use(helmet());
// Rate limiting (relaxed in development to avoid blocking health polling)
const limiter = rateLimit({
  windowMs: config.rateLimiting.windowMs,
  max: config.isDevelopment ? 1000 : config.rateLimiting.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// CORS Configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials
}));



// Body parsing
app.use((req, res, next) => {
    // Skip JSON parsing for multipart/form-data
    if (req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data')) {
        return next();
    }
    express.json({ limit: config.uploads.maxFileSize })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: config.uploads.maxFileSize }));

// HTTP Request logging with pino-http
app.use(pinoHttp({
    logger: logger,
    // Skip logging for health check endpoints to reduce noise
    autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/api/health'
    },
    customLogLevel: (req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    },
    customSuccessMessage: (req, res) => {
        return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage: (req, res, err) => {
        return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
    },
    // Redact sensitive headers
    redact: ['req.headers.authorization', 'req.headers.cookie']
}));

// Import routes
const customersRouter = require('./routes/customers');
const requestsRouter = require('./routes/requests');
const techniciansRouter = require('./routes/technicians');
const settingsRouter = require('./routes/settings');
const warehouseRouter = require('./routes/warehouse');
const statsRouter = require('./routes/stats');
const inventoryRouter = require('./routes/inventory');
const adminRouter = require('./routes/admin');
const paymentsRouter = require('./routes/payments');
const backupRouter = require('./routes/backup');

// Use routes
app.use('/api', customersRouter);
app.use('/api', requestsRouter);
app.use('/api', techniciansRouter);
app.use('/api', settingsRouter);
app.use('/api', warehouseRouter);
app.use('/api', statsRouter);
app.use('/api', inventoryRouter);
app.use('/api', adminRouter);
app.use('/api', paymentsRouter);
app.use('/api', require('./routes/reports'));
app.use('/api/warehouse-machines', require('./routes/warehouse-machines'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api', require('./routes/ai'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/backup', backupRouter);
app.use('/api/db', require('./routes/db'));
app.use('/api', require('./routes/simcards'));
app.use('/api', require('./routes/machines'));
app.use('/api', require('./routes/machine-history'));
app.use('/api/warehouse-sims', require('./routes/warehouseSims'));
app.use('/api/branches', require('./routes/branches'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/transfer-orders', require('./routes/transfer-orders'));
app.use('/api/permissions', require('./routes/permissions'));
app.use('/api/approvals', require('./routes/approvals'));
app.use('/api/machine-workflow', require('./routes/machine-workflow'));

// Service Center Workflow Routes
app.use('/api/service-assignments', require('./routes/service-assignments'));
app.use('/api/maintenance-approvals', require('./routes/maintenance-approvals'));
app.use('/api/pending-payments', require('./routes/pending-payments'));
app.use('/api/track-machines', require('./routes/track-machines'));
app.use('/api/maintenance', require('./routes/maintenance'));

// User Preferences Routes
app.use('/api/user', require('./routes/user-preferences'));

// Push Notifications Routes
app.use('/api/push', require('./routes/push-notifications'));

// RE-EXPORTED ROUTE FOR DEBUGGING/FIXING 404
const { authenticateToken, requireAdmin } = require('./middleware/auth');
app.get('/api/reports/executive', authenticateToken, requireAdmin, require('./routes/reports').executiveHandler);



// Health check endpoints
/**
 * @route GET /health
 * @summary Simple health check
 * @returns {Object} Health status
 */
app.get('/health', (req, res) => {
  // Light health endpoint (no DB). Add permissive CORS headers.
  res.setHeader('Access-Control-Allow-Origin', Array.isArray(config.cors.origin) ? config.cors.origin[0] : config.cors.origin);
  res.setHeader('Access-Control-Allow-Credentials', config.cors.credentials ? 'true' : 'false');
  res.json({ 
    status: 'up',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv
  });
});

/**
 * @route GET /api/health
 * @summary Detailed health check with DB connectivity
 * @returns {Object} Detailed health status
 */
app.get('/api/health', async (req, res, next) => {
  try {
    // Test database connection
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
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

const PORT = config.port;

// Error handler (must be last middleware)
app.use(errorHandler);

// 404 handler
app.use((req, res, next) => {
  throw new AppError(`Route ${req.path} not found`, 404, 'NOT_FOUND');
});

// Start HTTP server
const server = app.listen(PORT, () => {
    logger.info({
        port: PORT,
        host: config.host,
        apiUrl: `http://${config.host}:${PORT}/api`,
        docsUrl: `http://${config.host}:${PORT}/api-docs`,
        healthUrl: `http://${config.host}:${PORT}/health`,
        env: config.nodeEnv
    }, 'Server started successfully');

    // Setup Socket.IO
    const io = new Server(server, {
        cors: {
            origin: config.cors.origin,
            credentials: true
        }
    });

    // Socket.IO connection handling
    io.on('connection', (socket) => {
        logger.info({ socketId: socket.id }, 'Client connected to WebSocket');

        // Join user to their branch room for targeted notifications
        socket.on('join-branch', (branchId) => {
            socket.join(`branch-${branchId}`);
            logger.info({ socketId: socket.id, branchId }, 'Client joined branch room');
        });

        // Join user to their personal room for user-specific notifications
        socket.on('join-user', (userId) => {
            socket.join(`user-${userId}`);
            logger.info({ socketId: socket.id, userId }, 'Client joined user room');
        });

        socket.on('disconnect', () => {
            logger.info({ socketId: socket.id }, 'Client disconnected from WebSocket');
        });
    });

    // Make io globally accessible for notifications
    global.io = io;
    logger.info('Socket.IO server initialized');

    // Schedule daily backup at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
        logger.info('Running scheduled backup...');
        try {
            const { createBackup, cleanOldBackups } = require('./utils/backup');
            const backup = await createBackup('scheduled');
            logger.info({ filename: backup.filename }, 'Scheduled backup created');

            // Clean old backups (keep last 30 days)
            const deletedCount = await cleanOldBackups(30);
            if (deletedCount > 0) {
                logger.info({ deletedCount }, 'Cleaned old backups');
            }
        } catch (error) {
            logger.error({ err: error }, 'Scheduled backup failed');
        }
    });

    logger.info('Scheduled daily backup at 2:00 AM');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down gracefully...');
    
    // Close Socket.IO connections
    if (global.io) {
        global.io.close(() => {
            logger.info('Socket.IO server closed');
        });
    }
    
    await db.$disconnect();
    logger.info('Database connection closed');
    process.exit(0);
});

module.exports = { app, db, server };
