const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');
const logger = require('../utils/logger');
const config = require('../config');

// Optional: Use Redis for distributed rate limiting (recommended for production)
// If Redis is not available, it will fall back to in-memory store
let redisClient = null;
let useRedis = false;

if (process.env.REDIS_URL) {
  try {
    redisClient = redis.createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => {
      logger.warn({ error: err }, 'Redis connection failed, using in-memory store');
      useRedis = false;
    });
    redisClient.on('connect', () => {
      logger.info('Redis connected for rate limiting');
      useRedis = true;
    });
    redisClient.connect();
  } catch (err) {
    logger.warn({ error: err }, 'Redis setup failed, using in-memory store');
  }
}

// ===================== RATE LIMITER CONFIGURATIONS =====================

/**
 * Global API rate limiter
 * Uses values from config/index.js
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimiting.windowMs,
  max: config.rateLimiting.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting in development
    if (config.isDevelopment) {
      return true;
    }
    // Skip rate limiting for health checks
    if (req.path === '/health' || req.path === '/api/health') {
      return true;
    }
    return false;
  },
  handler: (req, res) => {
    logger.warn({ ip: req.ip, path: req.path }, 'Rate limit exceeded');
    res.status(429).json({
      error: {
        message: 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: req.rateLimit.resetTime,
        timestamp: new Date().toISOString()
      }
    });
  },
  store: useRedis ? new RedisStore({
    client: redisClient,
    prefix: 'rl:api:'
  }) : undefined
});

/**
 * Strict login rate limiter
 * 30 attempts per 15 minutes per IP (Increased for dev convenience, keeps security in prod)
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isDevelopment ? 100 : 10,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true, // Don't count successful requests
  skipFailedRequests: false, // Count all requests (including successful)
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ ip: req.ip, email: req.body?.email }, 'Login rate limit exceeded');
    res.status(429).json({
      error: {
        message: 'Too many login attempts, please try again in 15 minutes',
        code: 'LOGIN_RATE_LIMIT_EXCEEDED',
        retryAfter: req.rateLimit.resetTime,
        timestamp: new Date().toISOString()
      }
    });
  },
  store: useRedis ? new RedisStore({
    client: redisClient,
    prefix: 'rl:login:'
  }) : undefined
});

/**
 * Password reset rate limiter
 * 3 attempts per hour per IP
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 reset attempts per hour
  message: 'Too many password reset attempts, please try again later.',
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ ip: req.ip, email: req.body?.email }, 'Password reset rate limit exceeded');
    res.status(429).json({
      error: {
        message: 'Too many password reset attempts, please try again in 1 hour',
        code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
        retryAfter: req.rateLimit.resetTime,
        timestamp: new Date().toISOString()
      }
    });
  },
  store: useRedis ? new RedisStore({
    client: redisClient,
    prefix: 'rl:password:'
  }) : undefined
});

/**
 * API creation rate limiter (for POST requests)
 * 200 requests per 15 minutes per IP (Increased for bulk imports)
 */
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isDevelopment ? 1000 : 200,
  message: 'Too many items created, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isDevelopment,
  keyGenerator: (req) => {
    // Use user ID if authenticated, fallback to IP
    return req.user?.id || req.ip;
  },
  handler: (req, res) => {
    logger.warn({ ip: req.ip, userId: req.user?.id, path: req.path }, 'Create rate limit exceeded');
    res.status(429).json({
      error: {
        message: 'Too many requests to create items, please try again later',
        code: 'CREATE_RATE_LIMIT_EXCEEDED',
        retryAfter: req.rateLimit.resetTime,
        timestamp: new Date().toISOString()
      }
    });
  },
  store: useRedis ? new RedisStore({
    client: redisClient,
    prefix: 'rl:create:'
  }) : undefined
});

/**
 * API update rate limiter (for PUT/PATCH requests)
 * 500 requests per 15 minutes per IP
 */
const updateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isDevelopment ? 1000 : 500,
  message: 'Too many items updated, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isDevelopment,
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  handler: (req, res) => {
    logger.warn({ ip: req.ip, userId: req.user?.id, path: req.path }, 'Update rate limit exceeded');
    res.status(429).json({
      error: {
        message: 'Too many requests to update items, please try again later',
        code: 'UPDATE_RATE_LIMIT_EXCEEDED',
        retryAfter: req.rateLimit.resetTime,
        timestamp: new Date().toISOString()
      }
    });
  },
  store: useRedis ? new RedisStore({
    client: redisClient,
    prefix: 'rl:update:'
  }) : undefined
});

/**
 * API deletion rate limiter (for DELETE requests)
 * 50 requests per 15 minutes per IP
 */
const deleteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isDevelopment ? 200 : 50,
  message: 'Too many items deleted, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isDevelopment,
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  handler: (req, res) => {
    logger.warn({ ip: req.ip, userId: req.user?.id, path: req.path }, 'Delete rate limit exceeded');
    res.status(429).json({
      error: {
        message: 'Too many requests to delete items, please try again later',
        code: 'DELETE_RATE_LIMIT_EXCEEDED',
        retryAfter: req.rateLimit.resetTime,
        timestamp: new Date().toISOString()
      }
    });
  },
  store: useRedis ? new RedisStore({
    client: redisClient,
    prefix: 'rl:delete:'
  }) : undefined
});

/**
 * File upload rate limiter
 * 100 uploads per 1 hour per IP (Increased for bulk operations)
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: config.isDevelopment ? 1000 : 100,
  message: 'Too many file uploads, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  handler: (req, res) => {
    logger.warn({ ip: req.ip, userId: req.user?.id }, 'Upload rate limit exceeded');
    res.status(429).json({
      error: {
        message: 'Too many file uploads, please try again later',
        code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
        retryAfter: req.rateLimit.resetTime,
        timestamp: new Date().toISOString()
      }
    });
  },
  store: useRedis ? new RedisStore({
    client: redisClient,
    prefix: 'rl:upload:'
  }) : undefined
});

/**
 * Factory function to create custom rate limiters
 */
const createLimiter_ = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = 'Too many requests',
    code = 'RATE_LIMIT_EXCEEDED',
    skipSuccessful = false
  } = options;

  return rateLimit({
    windowMs,
    max,
    message,
    skipSuccessfulRequests: skipSuccessful,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn({ ip: req.ip, userId: req.user?.id }, `Rate limit exceeded: ${code}`);
      res.status(429).json({
        error: {
          message,
          code,
          retryAfter: req.rateLimit.resetTime,
          timestamp: new Date().toISOString()
        }
      });
    },
    store: useRedis ? new RedisStore({
      client: redisClient,
      prefix: `rl:${code}:`
    }) : undefined
  });
};

module.exports = {
  apiLimiter,
  loginLimiter,
  passwordResetLimiter,
  createLimiter,
  updateLimiter,
  deleteLimiter,
  uploadLimiter,
  createLimiter_
};
