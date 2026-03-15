const { contextStore } = require('../utils/context');

/**
 * Middleware to establish request context
 */
const contextMiddleware = (req, res, next) => {
    const context = {
        get user() { return req.user; }, // Getter to stay in sync with req.user updates
        requestId: req.headers['x-request-id'] || Math.random().toString(36).substring(7),
        ip: req.ip
    };

    contextStore.run(context, () => {
        next();
    });
};

module.exports = { contextMiddleware };
