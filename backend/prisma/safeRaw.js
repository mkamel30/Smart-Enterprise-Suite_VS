// Safe wrappers for raw SQL usage. Prevents accidental use of unsafe raw queries
// in request handlers. To allow intentionally, set env `ALLOW_UNSAFE_RAW=1`.
const db = require('../db');

function ensureAllowed() {
  if (process.env.ALLOW_UNSAFE_RAW === '1') return true;
  throw new Error('Unsafe raw SQL usage blocked. Set ALLOW_UNSAFE_RAW=1 to allow in dev or refactor to Prisma APIs.');
}

async function queryRawUnsafeSafe(sql, ...params) {
  ensureAllowed();
  return db.$queryRawUnsafe(sql, ...params);
}

async function executeRawUnsafeSafe(sql, ...params) {
  ensureAllowed();
  return db.$executeRawUnsafe(sql, ...params);
}

module.exports = { queryRawUnsafeSafe, executeRawUnsafeSafe };
