const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Strict limit for login attempts - Brute force protection
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  skipFailedRequests: false,
  message: 'Too many login attempts. Please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.security({ ip: req.ip, path: req.path }, 'Rate limit exceeded: login');
    res.status(429).json({
      error: 'Too many login attempts',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

// Moderate limit for data creation
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  skip: (req) => ['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user?.role),
  message: 'Too many creation requests. Please try again later.',
  standardHeaders: true,
  handler: (req, res) => {
    logger.warn({ userId: req.user?.id, path: req.path }, 'Create rate limit exceeded');
    res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

// Strict limit for admin operations
const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skip: (req) => req.user?.role === 'SUPER_ADMIN',
  message: 'Rate limit exceeded for admin operations',
  standardHeaders: true,
  handler: (req, res) => {
    logger.security({ userId: req.user?.id, path: req.path }, 'Admin rate limit exceeded');
    res.status(429).json({
      error: 'Admin operation rate limit exceeded',
      code: 'ADMIN_RATE_LIMIT_EXCEEDED'
    });
  }
});

// File upload limiter
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many file uploads',
  standardHeaders: true,
  handler: (req, res) => {
    logger.warn({ userId: req.user?.id }, 'Upload rate limit exceeded');
    res.status(429).json({
      error: 'Too many file uploads',
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
    });
  }
});

// Global API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => {
    if (req.user?.role === 'SUPER_ADMIN') return 1000;
    if (req.user?.role === 'MANAGEMENT') return 300;
    if (req.user) return 100;
    return 30;
  },
  message: 'Too many requests from this IP',
  standardHeaders: true,
  skip: (req) => {
    return req.path === '/health' || req.path === '/api/health';
  },
  handler: (req, res) => {
    logger.warn({ ip: req.ip, path: req.path }, 'Global API rate limit exceeded');
    res.status(429).json({
      error: 'Too many requests',
      code: 'GLOBAL_RATE_LIMIT_EXCEEDED',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

// Report/Analytics limiter
const analyticsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max
