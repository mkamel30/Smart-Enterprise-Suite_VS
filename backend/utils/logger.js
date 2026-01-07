/**
 * Structured Logger Module
 * 
 * Provides a configured pino logger instance for structured logging across the application.
 * Supports different log levels, pretty printing in development, and JSON output in production.
 * 
 * Features:
 * - Structured JSON logging in production
 * - Pretty formatted logs in development
 * - Automatic request ID tracking
 * - Performance-optimized (pino is one of the fastest Node.js loggers)
 * - Log levels: trace, debug, info, warn, error, fatal
 * 
 * @module utils/logger
 */

const pino = require('pino');
const config = require('../config');

/**
 * Pino logger configuration
 */
const loggerOptions = {
    level: config.logging.level || 'info',

    // Base properties included in every log
    base: {
        name: 'cs-dept-console',
        pid: process.pid,
        hostname: require('os').hostname(),
        env: config.nodeEnv
    },

    // Timestamp format
    timestamp: () => `,"time":"${new Date().toISOString()}"`,

    // Redact sensitive information
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'password',
            'token',
            'secret',
            'apiKey'
        ],
        remove: true
    },

    // Serializers for common objects
    serializers: {
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
        err: pino.stdSerializers.err
    }
};

/**
 * Pretty print configuration for development
 * Makes logs human-readable with colors and formatting
 */
const prettyPrintOptions = {
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
            messageFormat: '{levelLabel} - {msg}',
            errorLikeObjectKeys: ['err', 'error']
        }
    }
};

/**
 * Create logger instance based on environment
 * - Development: Pretty printed, colorized logs
 * - Production: JSON structured logs for log aggregation
 */
const logger = config.nodeEnv === 'development'
    ? pino({ ...loggerOptions, ...prettyPrintOptions })
    : pino(loggerOptions);

/**
 * Create a child logger with additional context
 * 
 * @param {Object} bindings - Context to include in all logs from this child
 * @returns {Object} Child logger instance
 * 
 * @example
 * const requestLogger = logger.child({ requestId: req.id });
 * requestLogger.info('Processing request');
 */
logger.createChild = (bindings) => {
    return logger.child(bindings);
};

/**
 * Log HTTP request/response
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {number} responseTime - Response time in ms
 * 
 * @example
 * logger.http(req, res, 45);
 */
logger.http = (req, res, responseTime) => {
    const logData = {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        userAgent: req.get('user-agent'),
        ip: req.ip
    };

    if (res.statusCode >= 500) {
        logger.error(logData, 'HTTP Request - Server Error');
    } else if (res.statusCode >= 400) {
        logger.warn(logData, 'HTTP Request - Client Error');
    } else {
        logger.info(logData, 'HTTP Request');
    }
};

/**
 * Log database query
 * 
 * @param {string} operation - Database operation (SELECT, INSERT, UPDATE, DELETE)
 * @param {string} model - Prisma model name
 * @param {number} duration - Query duration in ms
 * @param {Object} metadata - Additional metadata
 * 
 * @example
 * logger.db('SELECT', 'Customer', 12, { count: 50 });
 */
logger.db = (operation, model, duration, metadata = {}) => {
    logger.debug({
        operation,
        model,
        duration: `${duration}ms`,
        ...metadata
    }, 'Database Query');
};

/**
 * Log business event
 * 
 * @param {string} event - Event name
 * @param {Object} data - Event data
 * 
 * @example
 * logger.event('customer.created', { customerId: '123', branchId: '456' });
 */
logger.event = (event, data = {}) => {
    logger.info({
        event,
        ...data
    }, 'Business Event');
};

/**
 * Log security event
 * 
 * @param {string} event - Security event type
 * @param {Object} details - Event details
 * 
 * @example
 * logger.security('failed.login', { username: 'admin', ip: '192.168.1.1' });
 */
logger.security = (event, details = {}) => {
    logger.warn({
        securityEvent: event,
        ...details
    }, 'Security Event');
};

/**
 * Log performance metric
 * 
 * @param {string} metric - Metric name
 * @param {number} value - Metric value
 * @param {string} unit - Unit of measurement
 * 
 * @example
 * logger.metric('response.time', 45, 'ms');
 */
logger.metric = (metric, value, unit = '') => {
    logger.debug({
        metric,
        value,
        unit
    }, 'Performance Metric');
};

/**
 * Log an action to the database (legacy audit logging)
 * This function maintains backward compatibility with existing audit logging
 * 
 * @param {Object} params
 * @param {string} params.entityType - 'CUSTOMER', 'USER', 'REQUEST', etc.
 * @param {string} params.entityId - ID of the entity
 * @param {string} params.action - 'CREATE', 'UPDATE', 'DELETE', etc.
 * @param {string} [params.details] - JSON string or description
 * @param {string} [params.userId] - ID of user performing action
 * @param {string} [params.performedBy] - Name of user performing action
 * @param {string} [params.branchId] - ID of user's branch
 */
async function logAction({ entityType, entityId, action, details, userId, performedBy, branchId }) {
    try {
        const db = require('../db');

        await db.systemLog.create({
            data: {
                entityType,
                entityId,
                action,
                details: typeof details === 'object' ? JSON.stringify(details) : details,
                userId,
                performedBy,
                branchId
            }
        });

        // Also log to structured logger for observability
        logger.event('audit.log', {
            entityType,
            entityId,
            action,
            userId,
            performedBy,
            branchId
        });
    } catch (error) {
        logger.error({ err: error, entityType, entityId, action }, 'Failed to create audit log');
        // Don't throw, just log error so main flow isn't interrupted
    }
}

// Export both the logger and logAction for backward compatibility
module.exports = logger;
module.exports.logAction = logAction;
