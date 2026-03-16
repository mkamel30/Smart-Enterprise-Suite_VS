const pino = require('pino');

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    base: {
        name: 'smart-enterprise-suite_ADMIN',
        pid: process.pid,
        env: process.env.NODE_ENV || 'development'
    },
    transport: process.env.NODE_ENV === 'production' ? undefined : {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
            messageFormat: '{levelLabel} - {msg}'
        }
    }
});

module.exports = logger;
