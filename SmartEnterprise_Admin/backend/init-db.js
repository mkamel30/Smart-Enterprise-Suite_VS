const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const env = { ...process.env, DATABASE_URL: 'file:./dev.db' };

function run(cmd) {
  console.log(`Running: ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', env });
  } catch (e) {
    console.error(`Failed: ${cmd}`);
    process.exit(1);
  }
}

run('npx prisma generate');
run('npx prisma db push --accept-data-loss');
run('node seed.js');
