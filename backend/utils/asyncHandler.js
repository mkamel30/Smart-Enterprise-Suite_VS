/**
 * AsyncHandler - Re-exports from errorHandler for backward compatibility
 * All new code should import from '../utils/errorHandler' instead.
 */
const { asyncHandler } = require('./errorHandler');
module.exports = asyncHandler;
