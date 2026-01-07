const { z } = require('zod');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');

// ===================== VALIDATION MIDDLEWARE =====================

/**
 * Middleware to validate request body against Zod schema
 * Throws AppError with validation details if invalid
 */
const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      // Parse and validate the request body
      const validated = schema.parse(req.body);
      
      // Attach validated data to request for use in handlers
      req.validated = validated;
      
      logger.debug({ path: req.path, method: req.method }, 'Request validation passed');
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Format Zod validation errors
        const fieldErrors = error.errors.reduce((acc, err) => {
          const path = err.path.join('.');
          acc[path] = err.message;
          return acc;
        }, {});

        logger.warn(
          { path: req.path, method: req.method, errors: fieldErrors },
          'Request validation failed'
        );

        return res.status(400).json({
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            fields: fieldErrors,
            timestamp: new Date().toISOString()
          }
        });
      }

      logger.error({ error }, 'Unexpected error during validation');
      res.status(500).json({
        error: {
          message: 'Validation error',
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
};

/**
 * Middleware to validate query parameters against Zod schema
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      
      logger.debug({ path: req.path, query: validated }, 'Query validation passed');
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.errors.reduce((acc, err) => {
          const path = err.path.join('.');
          acc[path] = err.message;
          return acc;
        }, {});

        logger.warn(
          { path: req.path, errors: fieldErrors },
          'Query validation failed'
        );

        return res.status(400).json({
          error: {
            message: 'Invalid query parameters',
            code: 'QUERY_VALIDATION_ERROR',
            fields: fieldErrors,
            timestamp: new Date().toISOString()
          }
        });
      }

      logger.error({ error }, 'Unexpected error during query validation');
      res.status(500).json({
        error: {
          message: 'Query validation error',
          code: 'QUERY_VALIDATION_ERROR',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
};

/**
 * Middleware to validate URL parameters against Zod schema
 */
const validateParams = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated;
      
      logger.debug({ path: req.path, params: validated }, 'Parameter validation passed');
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.errors.reduce((acc, err) => {
          const path = err.path.join('.');
          acc[path] = err.message;
          return acc;
        }, {});

        logger.warn(
          { path: req.path, errors: fieldErrors },
          'Parameter validation failed'
        );

        return res.status(400).json({
          error: {
            message: 'Invalid parameters',
            code: 'PARAM_VALIDATION_ERROR',
            fields: fieldErrors,
            timestamp: new Date().toI
