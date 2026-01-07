const { AppError } = require('./errors');
const logger = require('./logger');

/**
 * Global error handler middleware
 * Must be registered after all other middleware and routes
 */
const errorHandler = (err, req, res, next) => {
  // Default to 500 if no status code
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  // Log error with structured logging
  const errorContext = {
    code,
    statusCode,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    branchId: req.user?.branchId,
    err: {
      message: err.message,
      stack: err.stack
    }
  };

  if (statusCode >= 500) {
    logger.error(errorContext, 'Server error occurred');
  } else {
    logger.warn(errorContext, 'Client error occurred');
  }

  // Response payload
  const response = {
    error: err.message,
    code,
    timestamp: new Date().toISOString()
  };

  // Add details for validation errors
  if (err.details) {
    response.details = err.details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
