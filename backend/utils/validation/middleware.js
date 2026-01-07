const { ValidationError } = require('../errors');

/**
 * Validation middleware factory
 * Use: router.post('/path', validate('body', schema), handler)
 */
const validate = (source, schema) => async (req, res, next) => {
  try {
    const data = req[source];
    const result = await schema.parseAsync(data);
    req[source] = result; // Replace with validated/coerced data
    next();
  } catch (error) {
    if (error.errors) {
      // Zod validation error
      const details = error.errors.reduce((acc, err) => {
        const path = err.path.join('.');
        acc[path] = err.message;
        return acc;
      }, {});
      throw new ValidationError(`Invalid ${source}`, details);
    }
    throw error;
  }
};

module.exports = validate;
