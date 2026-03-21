require('dotenv').config();
require('express-async-errors');

// --- SECURITY & HWID BINDING ---
const security = require('./utils/security');
(async () => {
  await security.validateMachineBinding();
})();


const express = require('express');
const path = require('path');
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
  removeServerHeader,
  additionalSecurityHeaders
} = require('./middleware/security');
const { contextMiddleware } = require('./middleware/context');
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

// 3b. Additional security headers (no-cache on auth, XSS protection)
app.use(additionalSecurityHeaders);

// 4. CORS Configuration
const allowedOrigins = config.cors.origin;
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // If wildcard is used, reflect the origin to allow credentials
    if (allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'x-portal-sync-key'],
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

// Establish request context (async context tracking)
app.use(contextMiddleware);

// 5b. Force UTF-8 Encoding
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// 6. CSRF Protection (must come after body parser)
if (config.security.csrfEnabled) {
  // 1. Always use cookie parser first
  app.use(csrfMiddleware[0]);

  // 2. Conditional CSRF protection
  app.use((req, res, next) => {
    const excludedPaths = ['/api/auth/login', '/health', '/api/health'];
    if (excludedPaths.some(path => req.path === path)) {
      return next();
    }
    // Validation happens here for POST/PUT/DELETE
    return csrfMiddleware[1](req, res, next);
  });

  // 3. Inject token into responses
  app.use((req, res, next) => {
    // Only inject if csurf has been initialized on this request
    // (csurf initializes on GET or if validation passes/is skipped)
    if (typeof req.csrfToken === 'function') {
      injectCsrfToken(req, res, next);
    } else {
      next();
    }
  });
}

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
        url: `http://localhost:${config.port || 5002}`,
        description: 'Development server'
      },
      {
        url: config.urls.api,
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

// ===================== FIRST-RUN SETUP (PUBLIC) =====================

// Public endpoint for first-run setup — no auth required
app.post('/api/setup/create-user', async (req, res) => {
  try {
    const { uid, username, email, displayName, role, password, branchId, branchCode } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبين' });
    }

    // Check if any users exist — only allow setup when DB is empty
    const userCount = await db.user.count();
    if (userCount > 0) {
      return res.status(403).json({ error: 'الإعداد مكتمل بالفعل — يوجد مستخدمون' });
    }

    // Create or link branch
    if (branchId && branchCode) {
      const existingBranch = await db.branch.findUnique({ where: { id: branchId } });
      if (!existingBranch) {
        await db.branch.create({
          data: {
            id: branchId,
            code: branchCode,
            name: req.body.branchName || branchCode,
            type: req.body.branchType || 'BRANCH',
            isActive: true
          }
        });
      }
    }

    // Create user
    const user = await db.user.create({
      data: {
        uid,
        username,
        email,
        displayName,
        role: role || 'ADMIN',
        password,
        branchId,
        isActive: true,
        mustChangePassword: false
      }
    });

    logger.info(`[SETUP] First user created: ${username}`);
    res.json({ success: true, user: { id: user.id, username: user.username, displayName: user.displayName } });
  } catch (error) {
    logger.error({ err: error }, '[SETUP] Failed to create user');
    res.status(500).json({ error: 'فشل إنشاء المستخدم' });
  }
});

// Load all modules via centralized module loader
const apiModules = require('./src/modules/index');
app.use('/api', apiModules);

// Root health check
app.use('/health', require('./src/modules/system/health.routes'));

// ===================== FRONTEND SERVING (PRODUCTION) =====================

/**
 * In production mode, the backend serves the frontend static files
 * to provide a single-executable/standalone experience.
 */
if (process.env.NODE_ENV === 'production') {
  // When packaged with 'pkg', the executable is in a different location relative to the frontend files
  const isPackaged = process.pkg !== undefined;
  const distPath = isPackaged 
    ? path.join(path.dirname(process.execPath), 'frontend-dist')
    : path.join(__dirname, '../frontend/dist');
  
  logger.info({ distPath, isPackaged }, '[SERVER] Serving frontend static files');
  
  // Serve static assets from the frontend build directory
  app.use(express.static(distPath));

  // Handle SPA (Single Page Application) routing - serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    // If it's an API route that somehow wasn't caught, pass to 404 handler
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next();
    }
    
    // Serve the main application file
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ===================== ERROR HANDLING =====================

// 404 handler
app.use(notFoundHandler);

// CSRF error handler
app.use(csrfErrorHandler);

// Global error handler
app.use(errorHandler);

// ===================== SERVER STARTUP =====================

const PORT = config.port;

let server;

if (require.main === module) {
  server = app.listen(PORT, config.host, () => {
    logger.info(`[SERVER] Server running on http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${PORT}`);
    logger.info(`[DOCS] API Docs: http://localhost:${PORT}/api-docs`);
    logger.info(`[ENV] Environment: ${config.nodeEnv}`);
  });
} else {
  const http = require('http');
  server = http.createServer(app);
}

// ===================== SOCKET.IO FOR REAL-TIME =====================

const socketManager = require('./utils/socketManager');
socketManager.init(server, {
  origin: config.cors.origin,
  methods: ['GET', 'POST'],
  credentials: true
});

// ===================== SCHEDULED TASKS =====================

// Initialize metrics cache on startup
const metricsCache = require('./src/modules/shared/metricsCache.service');
metricsCache.initializeCache().catch(err => {
  logger.warn({ error: err.message }, 'Initial metrics cache failed - will retry on schedule');
});

// Initialize Admin Sync service (Polling from Portal)
const adminSyncService = require('./src/services/adminSync.service');
adminSyncService.init();

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

// Daily backup at 5:30 PM
if (config.backup.enabled) {
  cron.schedule('30 17 * * *', async () => {
    logger.info('Running scheduled backup...');
    try {
      const backupService = require('./utils/backup');
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

module.exports = { app, server };
 
