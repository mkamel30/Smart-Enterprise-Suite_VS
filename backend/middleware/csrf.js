const csrf = require('csurf');
const cookieParser = require('cookie-parser');
const logger = require('../utils/logger');

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000,
    signed: true
  }
});

const csrfMiddleware = [
  cookieParser(process.env.COOKIE_SECRET || 'dev-secret'),
  csrfProtection
];

const injectCsrfToken = (req, res, next) => {
  try {
    const token = req.csrfToken();
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000
    });
    res.setHeader('X-CSRF-Token', token);
    next();
  } catch (error) {
    logger.error({ error }, 'CSRF token generation failed');
    next(error);
  }
};

const csrfErrorHandler = (err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    logger.security({ path: req.path, method: req.method }, 'CSRF validation failed');
    return res.status(403).json({
      error: 'CSRF token validation failed',
      code: 'CSRF_VALIDATION_ERROR'
    });
  }
  next(err);
};

module.exports = {
  csrfProtection,
  csrfMiddleware,
  injectCsrfToken,
  csrfErrorHandler
};
