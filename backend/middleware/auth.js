const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const db = require('../db');

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
const { getAuthorizedBranchIds } = require('../utils/branchUtils');
const { ROLES, isGlobalRole } = require('../utils/constants');

// ===================== AUTHENTICATE TOKEN =====================
/**
 * Middleware to verify JWT token and attach user to request
 * Throws 401 if token invalid, expired, or missing
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];

    // --- NEW: Portal Sync Key Support ---
    const portalSyncKey = req.headers['x-portal-sync-key'];
    const MASTER_SYNC_KEY = process.env.PORTAL_API_KEY || 'master_portal_key_internal';

    if (portalSyncKey && portalSyncKey === MASTER_SYNC_KEY) {
      req.user = {
        id: 'SYSTEM_SYNC',
        displayName: 'Central Portal Sync',
        role: 'SUPER_ADMIN',
        branchId: null,
        permissions: ['*'],
        authorizedBranchIds: []
      };
      logger.debug('[Auth] Internal sync key verified');
      return next();
    }
    // ------------------------------------

    // Fallback to cookie if header is missing
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      throw new AppError('Access token required', 401, 'NO_TOKEN');
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // FETCH USER FROM DB TO ENFORCE REAL-TIME STATUS (Active/Locked)
    const dbUser = await db.user.findUnique({
      where: { id: decoded.id },
      include: { accountLockout: true }
    });

    if (!dbUser) {
      throw new AppError('User account no longer exists', 401, 'USER_NOT_FOUND');
    }

    if (!dbUser.isActive) {
      throw new AppError('تم إغلاق الحساب من قبل مدير النظام', 401, 'ACCOUNT_DISABLED');
    }

    // Check for lockout
    if (dbUser.accountLockout?.lockedUntil && new Date(dbUser.accountLockout.lockedUntil) > new Date()) {
      throw new AppError('هذا الحساب مغلق حالياً، يرجى التواصل مع الإدارة', 401, 'ACCOUNT_LOCKED');
    }

    // Attach user info to request
    req.user = {
      id: dbUser.id,
      displayName: dbUser.displayName,
      role: dbUser.role,
      branchId: dbUser.branchId,
      email: dbUser.email,
      permissions: decoded.permissions || []
    };

    // --- EXPANSION: Branch Hierarchy ---
    // Populate authorizedBranchIds (user's branch + all children)
    if (req.user.branchId) {
      if (!req.user.authorizedBranchIds) {
        const branches = await db.branch.findMany({
          where: {
            OR: [
              { id: req.user.branchId },
              { parentBranchId: req.user.branchId }
            ]
          },
          select: { id: true }
        });
        req.user.authorizedBranchIds = branches.map(b => b.id);
      }
    } else {
      req.user.authorizedBranchIds = [];
    }

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

  // Admin roles include Super Admin and HQ-level management roles
  const adminRoles = [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ROLES.BRANCH_ADMIN, ROLES.ACCOUNTANT, ROLES.ADMIN_AFFAIRS, 'ADMIN'];

  if (!adminRoles.includes(req.user.role)) {
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

  const managerRoles = [
    ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ROLES.BRANCH_ADMIN,
    ROLES.ACCOUNTANT, ROLES.ADMIN_AFFAIRS, ROLES.BRANCH_MANAGER,
    ROLES.CS_SUPERVISOR, 'ADMIN', 'MANAGER', 'CENTER_MANAGER'
  ];

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

  // Any role that isn't purely administrative or low-level should have technician-level read access
  const techRoles = [
    ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ROLES.BRANCH_ADMIN,
    ROLES.ACCOUNTANT, ROLES.ADMIN_AFFAIRS, ROLES.BRANCH_MANAGER,
    ROLES.CS_SUPERVISOR, ROLES.TECHNICIAN, ROLES.BRANCH_TECH,
    'ADMIN', 'MANAGER', 'CENTER_MANAGER', 'CENTER_TECH', 'CS_AGENT'
  ];

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

    // HQ/Global roles can access any branch
    if (isGlobalRole(req.user.role)) {
      return next();
    }

    // Regular users must match branch or have it in their authorized list (hierarchy)
    const authorizedIds = getAuthorizedBranchIds(req.user);
    if (!authorizedIds.includes(requiredBranchId)) {
      logger.warn(
        { userId: req.user.id, branchId: req.user.branchId, requiredBranchId, authorizedIds },
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
 * Generic RBAC middleware
 * @param {Array<string>} allowedRoles 
 */
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
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
  authorize,
  JWT_SECRET,
  JWT_EXPIRY
};
