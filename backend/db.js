const { PrismaClient } = require('@prisma/client');
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

const { securityExtension } = require('./prisma/extensions');

// Initialize Prisma
const prisma = new PrismaClient({
  log: logConfig,
});

// Attach structured logging
prisma.$on('query', (e) => {
  if (isDebug) {
    logger.db('QUERY', 'Prisma', e.duration, { query: e.query, params: e.params });
  }
});

prisma.$on('info', (e) => {
  logger.info({ context: 'Prisma' }, e.message);
});

prisma.$on('warn', (e) => {
  logger.warn({ context: 'Prisma' }, e.message);
});

prisma.$on('error', (e) => {
  logger.error({ context: 'Prisma', err: e }, e.message);
});

// Attach security extension (Automatic Branch Filtering)
const db = prisma.$extends(securityExtension);

module.exports = db;
