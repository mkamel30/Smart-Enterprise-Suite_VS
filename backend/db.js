const { PrismaClient } = require('@prisma/client');
const { attachBranchEnforcer } = require('./prisma/branchEnforcer');
const logger = require('./utils/logger');
const config = require('./config');

// Define log levels based on environment
const msgLevel = config.logging?.level || 'info';
const isDebug = msgLevel === 'debug' || msgLevel === 'trace' || process.env.NODE_ENV === 'development';

const logConfig = [
  { emit: 'event', level: 'error' },
  { emit: 'event', level: 'warn' },
  { emit: 'event', level: 'info' },
];

// Only log queries if we are debugging, to avoid massive noise in production
if (isDebug) {
  logConfig.push({ emit: 'event', level: 'query' });
}

// Initialize Prisma
const db = new PrismaClient({
  log: logConfig,
});

// Attach structured logging
db.$on('query', (e) => {
  if (isDebug) {
    logger.db('QUERY', 'Prisma', e.duration, { query: e.query, params: e.params });
  }
});

db.$on('info', (e) => {
  logger.info({ context: 'Prisma' }, e.message);
});

db.$on('warn', (e) => {
  logger.warn({ context: 'Prisma' }, e.message);
});

db.$on('error', (e) => {
  logger.error({ context: 'Prisma', err: e }, e.message);
});

// Attach branch-enforcement middleware
try {
  attachBranchEnforcer(db);
} catch (err) {
  logger.error({ err, context: 'PrismaMiddleware' }, 'Failed to attach branch enforcer middleware');
}

module.exports = db;
