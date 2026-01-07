const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set. Aborting startup.');
    process.exit(1);
}

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <TOKEN>

    if (token == null) {
        logger.security({ path: req.path, method: req.method, ip: req.ip }, 'Authentication failed: No token provided');
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            logger.security({ path: req.path, method: req.method, ip: req.ip, error: err.message }, 'Authentication failed: Invalid token');
            return res.status(403).json({ error: 'Forbidden: Invalid token' });
        }
        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'SUPER_ADMIN' || req.user.role === 'MANAGEMENT')) {
        next();
    } else {
        res.status(403).json({ error: 'Access denied: Requires Admin or Management role' });
    }
};

// Backward compatibility: export the function directly as default
// while also allowing destructured imports
authenticateToken.authenticateToken = authenticateToken;
authenticateToken.requireAdmin = requireAdmin;

module.exports = authenticateToken;
