const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');
const logger = require('../utils/logger');

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
 * 100 requests per 15 minutes per IP
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
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
 * 5 attempts per 15 minutes per IP
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
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
 * 30 requests per 15 minutes per IP
 */
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 POST requests per windowMs
  message: 'Too many items created, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
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
 * 50 requests per 15 minutes per IP
 */
const updateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 PUT/PATCH requests per windowMs
  message: 'Too many items updated, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
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
 * 10 requests per 15 minutes per IP (strictest)
 */
const deleteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 DELETE requests per windowMs
  message: 'Too many items deleted, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
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
 * 20 uploads per 1 hour per IP
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
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
