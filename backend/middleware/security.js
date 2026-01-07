const helmet = require('helmet');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');

// ===================== SECURITY HEADERS MIDDLEWARE =====================

/**
 * Comprehensive security headers using Helmet
 * Protects against common web vulnerabilities
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
    usb: [],
    accelerometer: [],
    gyroscope: [],
    magnetometer: [],
    vr: []
  }
});

// ===================== HTTPS ENFORCEMENT =====================

/**
 * Enforce HTTPS in production
 * Redirect HTTP to HTTPS and set HSTS header
 */
const enforceHttps = (req, res, next) => {
  // Skip for development and health checks
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Allow X-Forwarded-Proto header from reverse proxies
  if (req.headers['x-forwarded-proto'] === 'https' || req.protocol === 'https') {
    return next();
  }

  logger.warn(
    { ip: req.ip, host: req.hostname, path: req.path },
    'Redirecting HTTP to HTTPS'
  );

  res.redirect(`https://${req.hostname}${req.url}`);
};

// ===================== REQUEST SANITIZATION =====================

/**
 * Sanitize incoming request data
 * - Remove dangerous characters from headers
 * - Prevent NoSQL injection
 * - Prevent XSS in query parameters
 */
const sanitizeRequest = (req, res, next) => {
  try {
    // Sanitize headers
    const dangerousHeaders = ['x-original-url', 'x-rewrite-url', 'x-auth'];
    dangerousHeaders.forEach(header => {
      if (req.headers[header]) {
        logger.warn(
          { header, value: req.headers[header] },
          'Dangerous header detected'
        );
        delete req.headers[header];
      }
    });

    // Sanitize query parameters (prevent NoSQL injection)
    if (req.query) {
      const sanitizedQuery = {};
      Object.keys(req.query).forEach(key => {
        const value = req.query[key];
        
        // Remove $ and . from keys to prevent MongoDB operators
        if (key.includes('$') || key.includes('.')) {
          logger.warn({ key }, 'Suspicious query parameter key detected');
          return;
        }

        // If value is string, remove dangerous characters
        if (typeof value === 'string') {
          sanitizedQuery[key] = value
            .replace(/[<>]/g, '') // Remove angle brackets
            .trim();
        } else if (typeof value === 'object' && value !== null) {
          // For object queries, skip (likely injection attempt)
          logger.warn({ key }, 'Complex query parameter detected, skipping');
          return;
        } else {
          sanitizedQuery[key] = value;
        }
      });
      req.query = sanitizedQuery;
    }

    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      const sanitizeValue = (value) => {
        if (typeof value === 'string') {
          return value
            .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .trim();
        } else if (Array.isArray(value)) {
          return value.map(sanitizeValue);
        } else if (typeof value === 'object' && value !== null) {
          return sanitizeBody(value);
        }
        return value;
      };

      const sanitizeBody = (obj) => {
        const sanitized = {};
        Object.keys(obj).forEach(key => {
          sanitized[key] = sanitizeValue(obj[key]);
        });
        return sanitized;
      };

      req.body = sanitizeBody(req.body);
    }

    next();
  } catch (error) {
    logger.error({ error }, 'Request sanitization error');
    res.status(400).json({
      error: {
        message: 'Invalid request format',
        code: 'INVALID_REQUEST',
        timestamp: new Date().toISOString()
      }
    });
  }
};

// ===================== SERVER HEADER REMOVAL =====================

/**
 * Remove Server header to hide technology stack
 * Prevents information disclosure attacks
 */
const removeServerHeader = (req, res, next) => {
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');
  next();
};

// ===================== REQUEST SIZE LIMIT =====================

/**
 * Prevent large request attacks
 * Returns 413 Payload Too Large if exceeded
 */
const requestSizeLimit = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = req.headers['content-length'];
    
    // Parse max size to bytes
    const parseSize = (size) => {
      const units = {
        b: 1,
        kb: 1024,
        mb: 1024 * 1024,
        gb: 1024 * 1024 * 1024
      };
      const match = size.match(/^(\d+)(kb?|mb?|gb?)?$/i);
      if (!match) return parseInt(size);
      return parseInt(match[1]) * units[match[2]?.toLowerCase() || 'b'];
    };

    const limit = parseSize(maxSize);
    const size = parseInt(contentLength) || 0;

    if (size > limit) {
      logger.warn(
        { contentLength: size, limit },
        'Request exceeds size limit'
      );
      return res.status(413).json({
        error: {
          message: `Request payload too large. Maximum allowed: ${maxSize}`,
          code: 'PAYLOAD_TOO_LARGE',
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  };
};

// ===================== SECURITY HEADERS INLINE =====================

/**
 * Additional security headers not covered by Helmet
 */
const additionalSecurityHeaders = (req, res, next) => {
  // Prevent browsers from MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent embedding in iframes
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  
  // Block referrer leakage
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Disable client-side caching for sensitive data
  if (req.path.includes('/api/auth') || req.path.includes('/api/user')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
};

module.exports = {
  securityHeaders,
  enforceHttps,
  sanitizeRequest,
  removeServerHeader,
  requestSizeLimit,
  additionalSecurityHeaders
};
