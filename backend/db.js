const { PrismaClient } = require('@prisma/client');
const logger = require('./utils/logger');
const config = require('./config');

const msgLevel = config.logging?.level || 'info';
const isDebug = msgLevel === 'debug' || msgLevel === 'trace' || process.env.NODE_ENV === 'development';

const logConfig = [
  { emit: 'event', level: 'error' },
  { emit: 'event', level: 'warn' },
  { emit: 'event', level: 'info' },
];

if (isDebug) {
  logConfig.push({ emit: 'event', level: 'query' });
}

const { securityExtension } = require('./prisma/extensions');

const prisma = new PrismaClient({
  log: logConfig,
});

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

const db = prisma.$extends(securityExtension);

if (config.database?.url?.startsWith('file:')) {
  prisma.$queryRaw`PRAGMA journal_mode=WAL;`
    .then(() => logger.info({ context: 'Prisma' }, 'SQLite WAL mode enabled'))
    .catch(err => logger.error({ context: 'Prisma', err }, 'Failed to enable SQLite WAL mode'));
}

module.exports = db;
