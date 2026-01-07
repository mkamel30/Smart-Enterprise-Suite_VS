const { PrismaClient } = require('@prisma/client');
const { attachBranchEnforcer } = require('./prisma/branchEnforcer');

// Initialize Prisma with connection limits and query logging
const db = new PrismaClient({
  log: ['error', 'warn'], // Log only errors and warnings
});

// Attach branch-enforcement middleware to fail-fast on unscoped queries
try {
  attachBranchEnforcer(db);
} catch (err) {
  // If middleware attachment fails, still export db but log error
  // (attachment should not throw under normal circumstances)
  // eslint-disable-next-line no-console
  console.error('Failed to attach branch enforcer middleware:', err.message || err);
}

module.exports = db;
