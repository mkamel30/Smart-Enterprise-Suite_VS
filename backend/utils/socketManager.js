const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('./logger');

let io;

const init = (server, corsOptions) => {
    io = new Server(server, {
        cors: corsOptions
    });

    // Authentication middleware for Socket.io
    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers['authorization']?.split(' ')[1];

        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            logger.warn({ error: err.message }, 'Socket authentication failed');
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const { id, role, branchId, displayName } = socket.user;

        logger.info({ socketId: socket.id, userId: id, displayName }, 'User connected to Socket.io');

        // Join global room
        socket.join('global');

        // Join branch-specific room
        if (branchId) {
            socket.join(`branch-${branchId}`);
            logger.debug({ userId: id, branchId }, 'User joined branch room');
        }

        // Join role-specific room
        if (role) {
            socket.join(`role-${role}`);
            logger.debug({ userId: id, role }, 'User joined role room');
        }

        socket.on('disconnect', () => {
            logger.info({ socketId: socket.id, userId: id }, 'User disconnected from Socket.io');
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

/**
 * Emit to a specific branch
 * @param {string} branchId 
 * @param {string} event 
 * @param {any} data 
 */
const emitToBranch = (branchId, event, data) => {
    if (io) {
        io.to(`branch-${branchId}`).emit(event, data);
    }
};

/**
 * Emit to a specific role
 * @param {string} role 
 * @param {string} event 
 * @param {any} data 
 */
const emitToRole = (role, event, data) => {
    if (io) {
        io.to(`role-${role}`).emit(event, data);
    }
};

/**
 * Emit to all connected clients
 * @param {string} event 
 * @param {any} data 
 */
const emitGlobal = (event, data) => {
    if (io) {
        io.to('global').emit(event, data);
    }
};

module.exports = {
    init,
    getIO,
    emitToBranch,
    emitToRole,
    emitGlobal
};
