/**
 * Standard API Response Utility
 */

/**
 * Success Response
 * @param {Response} res - Express response object
 * @param {any} data - Data to send
 * @param {number} statusCode - HTTP status code
 * @param {Object} meta - Optional metadata (pagination, etc)
 */
const success = (res, data = null, statusCode = 200, meta = null) => {
    // For backward compatibility with the current frontend, we return the raw data.
    // In a future version, we can transition to the { success: true, data } wrapper.
    return res.status(statusCode).json(data);
};

/**
 * Error Response
 * @param {Response} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {any} details - Optional error details
 */
const error = (res, message = 'Internal Server Error', statusCode = 500, details = null) => {
    const response = {
        success: false,
        error: {
            message,
            code: getErrorCode(statusCode),
            details
        },
        timestamp: new Date().toISOString()
    };

    return res.status(statusCode).json(response);
};

/**
 * Helper to get standard error codes based on status
 */
const getErrorCode = (status) => {
    switch (status) {
        case 400: return 'BAD_REQUEST';
        case 401: return 'UNAUTHORIZED';
        case 403: return 'FORBIDDEN';
        case 404: return 'NOT_FOUND';
        case 422: return 'VALIDATION_ERROR';
        case 429: return 'TOO_MANY_REQUESTS';
        case 500: return 'INTERNAL_ERROR';
        default: return 'ERROR';
    }
};

/**
 * Paginated Response Helper
 */
const paginated = (res, data, total, limit, offset, statusCode = 200) => {
    return success(res, data, statusCode, {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit)
    });
};

module.exports = {
    success,
    error,
    paginated
};
