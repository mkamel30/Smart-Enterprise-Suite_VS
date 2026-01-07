const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Aborting startup.');
  process.exit(1);
}

// ===================== AUTHENTICATION MIDDLEWARE =====================

const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      logger.security({ 
        path: req.path, 
        method: req.method, 
        ip: req.ip 
      }, 'Authentication failed: No token provided');
      
      return res.status(401).json({ 
        error: 'Unauthorized: No token provided',
        code: 'NO_TOKEN'
      });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        const errorCode = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
        
        logger.security({ 
          path: req.path, 
          method: req.method, 
          ip: req.ip, 
          error: err.message,
          errorCode 
        }, 'Authentication failed: Invalid token');
        
        return res.status(403).json({ 
          error: 'Forbidden: Invalid or expired token',
          code: errorCode,
          ...(err.name === 'TokenExpiredError' && { expiredAt: err.expiredAt })
        });
      }
      
      if (!user.id || !user.email || !user.role) {
        logger.security({ userId: user?.id }, 'Token validation failed: Invalid payload');
        return res.status(403).json({ 
          error: 'Invalid token payload',
          code: 'INVALID_TOKEN_PAYLOAD'
        });
      }
      
      req.user = user;
      next();
    });
  } catch (error) {
    logger.error({ error }, 'Authentication middleware error');
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'AUTH_ERROR'
    });
  }
};

// ===================== AUTHORIZATION MIDDLEWARE =====================

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      code: 'NOT_AUTHENTICATED'
    });
  }
  
  if (!['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user.role)) {
    logger.security({ 
      userId: req.user.id,
      userRole: req.user.role,
      attemptedResource: req.path,
      method: req.method
    }, 'Admin access denied');
    
    return res.status(403).json({ 
      error: 'Access denied: Requires Admin or Management role',
      code: 'INSUFFICIENT_PERMISSIONS',
      requiredRole: 'ADMIN'
    });
  }
  
  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      code: 'NOT_AUTHENTICATED'
    });
  }
  
  if (req.user.role !== 'SUPER_ADMIN') {
    logger.security({ 
      userId: req.user.id,
      userRole: req.user.role,
      attemptedResource: req.path,
      method: req.method
    }, 'Super admin access denied');
    
    return res.status(403).json({ 
      error: 'Access denied: Requires SUPER_ADMIN role',
      code: 'INSUFFICIENT_PERMISSIONS',
      requiredRole: 'SUPER_ADMIN'
    });
  }
  
  next();
};

const requireManager = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      code: 'NOT_AUTHENTICATED'
    });
  }
  
  if (!['SUPER_ADMIN', 'MANAGEMENT', 'CENTER_MANAGER'].includes(req.user.role)) {
    return res.status(403).json({ 
      error: 'Access denied: Requires Manager role',
      code: 'INSUFFICIENT_PERMISSIONS'
    });
  }
  
  next();
};

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return next();
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (!err && user && user.id) {
      req.user = user;
    }
    next();
  });
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  requireManager,
  optionalAuth
};

