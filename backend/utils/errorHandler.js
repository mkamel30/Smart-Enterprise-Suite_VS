const logger = require('./logger');

// ===================== CUSTOM ERROR CLASSES =====================

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} غير موجود`, 404, 'NOT_FOUND');
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'غير مصرح لك بالوصول') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'تم رفض الوصول') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

class RateLimitError extends AppError {
  constructor(retryAfter = 60) {
    super('طلبات كثيرة جداً. يرجى المحاولة مرة أخرى لاحقاً.', 429, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
  }
}

// ===================== ASYNC HANDLER WRAPPER =====================

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    logger.error({
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      userId: req.user?.id
    }, 'Unhandled async error');
    next(error);
  });
};

// ===================== GLOBAL ERROR HANDLER =====================

const errorHandler = (err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'INTERNAL_ERROR';
  let details = err.details || null;

  // ===================== PRISMA ERROR HANDLING =====================

  if (err.code === 'P2002') {
    statusCode = 409;
    code = 'DUPLICATE_RECORD';
    const field = err.meta?.target?.[0] || 'الحقل';
    message = `السجل بهذا ${field} موجود بالفعل`;
  }
  else if (err.code === 'P2025') {
    statusCode = 404;
    code = 'NOT_FOUND';
    message = 'السجل غير موجود';
  }
  else if (err.code === 'P2024') {
    statusCode = 400;
    code = 'INVALID_RELATION';
    message = 'مرجع علاقة غير صالح';
  }
  else if (err.code === 'P2003') {
    statusCode = 400;
    code = 'FOREIGN_KEY_ERROR';
    message = 'لا يمكن الحذف: السجل مستخدم في سجلات أخرى';
  }
  else if (err.code === 'P2014') {
    statusCode = 400;
    code = 'RELATION_REQUIRED';
    message = 'العلاقة المطلوبة غير موجودة';
  }

  // ===================== JWT ERROR HANDLING =====================

  if (err.name === 'JsonWebTokenError') {
    statusCode = 403;
    code = 'INVALID_TOKEN';
    message = 'رمز وصول غير صالح';
  }
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'انتهت صلاحية رمز الوصول';
  }

  // ===================== VALIDATION ERROR HANDLING =====================

  if (err instanceof ValidationError && err.details) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    details = err.details;
  }

  // ===================== STRUCTURED LOGGING =====================

  const errorLog = {
    code,
    message,
    statusCode,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    userRole: req.user?.role,
    ip: req.ip,
    timestamp: new Date().toISOString(),
    // Always include the raw error object for the logger to serialize (includes stack)
    err: err,
    ...(isDevelopment && {
      details: err
    })
  };

  if (statusCode >= 500) {
    logger.error(errorLog, 'Server error');
  } else if (statusCode >= 400 && statusCode < 500) {
    logger.warn(errorLog, 'Client error');
  }

  // ===================== RESPONSE FORMATTING =====================

  const response = {
    error: {
      message,
      code,
      timestamp: new Date().toISOString(),
      ...(details && { details }),
      ...(isDevelopment && { debug: { stack: err.stack } })
    }
  };

  if (code === 'RATE_LIMIT_EXCEEDED') {
    response.error.retryAfter = err.retryAfter || 60;
  }

  res.status(statusCode).json(response);
};

// ===================== 404 HANDLER =====================

const notFoundHandler = (req, res) => {
  logger.warn({ path: req.path, method: req.method }, 'Route not found');

  res.status(404).json({
    error: {
      message: `المسار ${req.path} غير موجود`,
      code: 'ROUTE_NOT_FOUND',
      timestamp: new Date().toISOString()
    }
  });
};

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  asyncHandler,
  errorHandler,
  notFoundHandler
};
