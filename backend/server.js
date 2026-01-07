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
    // Lower log level for auth endpoints to prevent sensitive data leaks
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
                timestamp: { type: '
