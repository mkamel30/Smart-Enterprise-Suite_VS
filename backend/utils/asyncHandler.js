/**
 * AsyncHandler - Wrapper to eliminate try/catch boilerplate
 * Catches errors and passes them to Express error handler
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
