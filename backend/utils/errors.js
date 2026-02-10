/**
 * Error classes - Re-exports from errorHandler for backward compatibility.
 * All new code should import from '../utils/errorHandler' instead.
 */
const {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError
} = require('./errorHandler');

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError
};
