/**
 * Pagination Utilities
 * 
 * Standardizes pagination response format across all API endpoints
 * to ensure consistency and reduce code duplication.
 */

/**
 * Create a standardized pagination response object
 * @param {Array} data - The data items for current page
 * @param {number} total - Total count of all items
 * @param {number} limit - Items per page
 * @param {number} offset - Current offset
 * @param {Object} options - Additional options
 * @param {boolean} options.hasMore - Whether there are more pages (optional, auto-calculated if not provided)
 * @param {Object} options.meta - Additional metadata to include
 * @returns {Object} Standardized pagination response
 */
function createPaginationResponse(data, total, limit, offset, options = {}) {
  const pages = limit > 0 ? Math.ceil(total / limit) : 1;
  const currentPage = limit > 0 ? Math.floor(offset / limit) + 1 : 1;
  const hasMore = options.hasMore !== undefined 
    ? options.hasMore 
    : (offset + data.length) < total;

  const response = {
    data,
    pagination: {
      total,
      limit,
      offset,
      pages: pages || 1,
      currentPage: currentPage > pages ? pages : currentPage,
      hasMore
    }
  };

  // Include additional metadata if provided
  if (options.meta && Object.keys(options.meta).length > 0) {
    response.meta = options.meta;
  }

  return response;
}

/**
 * Create a cursor-based pagination response (for infinite scroll)
 * @param {Array} data - The data items
 * @param {string|number|null} nextCursor - Cursor for next page
 * @param {boolean} hasMore - Whether there are more items
 * @param {number} limit - Items per page
 * @returns {Object} Cursor pagination response
 */
function createCursorPaginationResponse(data, nextCursor, hasMore, limit) {
  return {
    data,
    pagination: {
      nextCursor,
      hasMore,
      limit,
      count: data.length
    }
  };
}

/**
 * Calculate pagination metadata without full data
 * @param {number} total - Total count
 * @param {number} limit - Items per page
 * @param {number} offset - Current offset
 * @returns {Object} Pagination metadata
 */
function calculatePaginationMeta(total, limit, offset) {
  const pages = limit > 0 ? Math.ceil(total / limit) : 1;
  const currentPage = limit > 0 ? Math.floor(offset / limit) + 1 : 1;
  
  return {
    total,
    limit,
    offset,
    pages: pages || 1,
    currentPage: Math.min(currentPage, pages || 1),
    hasMore: (offset + limit) < total
  };
}

/**
 * Parse pagination parameters from query string with safe defaults
 * @param {Object} query - Express query object
 * @param {Object} defaults - Default values
 * @param {number} defaults.limit - Default items per page (50)
 * @param {number} defaults.maxLimit - Maximum allowed items per page (100)
 * @param {number} defaults.offset - Default offset (0)
 * @returns {Object} Parsed and validated pagination params
 */
function parsePaginationParams(query = {}, defaults = {}) {
  const defaultLimit = defaults.limit || 50;
  const maxLimit = defaults.maxLimit || 100;
  const defaultOffset = defaults.offset || 0;

  // Parse limit
  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  }
  limit = Math.min(limit, maxLimit);

  // Parse offset
  let offset = parseInt(query.offset, 10);
  if (isNaN(offset) || offset < 0) {
    offset = defaultOffset;
  }

  return { limit, offset };
}

/**
 * Create Prisma pagination parameters
 * @param {number} limit - Items per page
 * @param {number} offset - Current offset
 * @returns {Object} Prisma take/skip parameters
 */
function createPrismaPagination(limit, offset) {
  return {
    take: limit,
    skip: offset
  };
}

module.exports = {
  createPaginationResponse,
  createCursorPaginationResponse,
  calculatePaginationMeta,
  parsePaginationParams,
  createPrismaPagination
};
