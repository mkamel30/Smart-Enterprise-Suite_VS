const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// Validate JWT secret exists and meets security requirements
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

if (!JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

if (JWT_SECRET.length < 32) {
  logger.error('FATAL: JWT_SECRET must be at least 32 characters long');
  process.exit(1);
}

const { AppError, NotFoundError } = require('../utils/errorHandler');

// ===================== AUTHENTICATE TOKEN =====================
/**
 * Middleware to verify JWT token and attach user to request
 * Throws 401 if token invalid, expired, or missing
 */
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new AppError('Access token required', 401, 'NO_TOKEN');
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user info to request
    req.user = {
      id: decoded.id,
      displayName: decoded.displayName,
      role: decoded.role,
      branchId: decoded.branchId,
      email: decoded.email,
      permissions: decoded.permissions || []
    };

    logger.debug({ userId: req.user.id, role: req.user.role }, 'Token verified');
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: {
          message: 'Token expired',
          code: 'TOKEN_EXPIRED',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: {
          message: 'Invalid token',
          code: 'INVALID_TOKEN',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        error: {
          message: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        }
      });
    }

    logger.error({ error }, 'Unexpected error in token authentication');
    res.status(500).json({
      error: {
        message: 'Authentication failed',
        code: 'AUTH_ERROR',
        timestamp: new Date().toISOString()
      }
    });
  }
};

// ===================== ROLE-BASED MIDDLEWARE =====================

/**
 * Require user to have admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'NO_AUTH');
  }

  if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError('Admin access required', 403, 'FORBIDDEN');
  }

  next();
};

/**
 * Require user to have super admin role
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'NO_AUTH');
  }

  if (req.user.role !== 'SUPER_ADMIN') {
    throw new AppError('Super admin access required', 403, 'FORBIDDEN');
  }

  logger.info({ userId: req.user.id }, 'Super admin action initiated');
  next();
};

/**
 * Require user to have manager or admin role
 */
const requireManager = (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'NO_AUTH');
  }

  const managerRoles = ['MANAGER', 'CENTER_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_MANAGER', 'CS_SUPERVISOR'];

  if (!managerRoles.includes(req.user.role)) {
    throw new AppError('Manager access required', 403, 'FORBIDDEN');
  }

  next();
};

/**
 * Require user to have technician or higher role
 */
const requireTechnician = (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'NO_AUTH');
  }

  const techRoles = ['TECHNICIAN', 'SUPERVISOR', 'MANAGER', 'CENTER_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'BRANCH_TECH', 'CENTER_TECH', 'CS_AGENT', 'CS_SUPERVISOR', 'BRANCH_MANAGER'];

  if (!techRoles.includes(req.user.role)) {
    throw new AppError('Technician access required', 403, 'FORBIDDEN');
  }

  next();
};

/**
 * Verify user belongs to specific branch (for branch isolation)
 */
const requireBranchAccess = (requiredBranchId) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'NO_AUTH');
    }

    // Super admins can access any branch
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    // Regular users must match branch
    if (req.user.branchId !== requiredBranchId) {
      logger.warn(
        { userId: req.user.id, branchId: req.user.branchId, requiredBranchId },
        'Branch access denied'
      );
      throw new AppError('Access denied for this branch', 403, 'FORBIDDEN');
    }

    next();
  };
};

/**
 * Verify user has specific permission
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'NO_AUTH');
    }

    if (!req.user.permissions || !req.user.permissions.includes(permission)) {
      logger.warn(
        { userId: req.user.id, requiredPermission: permission },
        'Permission denied'
      );
      throw new AppError(`Permission required: ${permission}`, 403, 'FORBIDDEN');
    }

    next();
  };
};

/**
 * Generate JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      permissions: user.permissions || []
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};

/**
 * Refresh token validation (for refresh token endpoints)
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Refresh token expired', 401, 'REFRESH_TOKEN_EXPIRED');
    }
    throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  requireManager,
  requireTechnician,
  requireBranchAccess,
  requirePermission,
  generateToken,
  verifyRefreshToken,
  JWT_SECRET,
  JWT_EXPIRY
};
