/**
 * Smart Enterprise Suite — E2E Test Runner
 * Runs both Branch App and Admin Portal test suites sequentially.
 * 
 * Usage: node run-all.js
 * Requires: Both servers running (Branch App on 5002, Admin Portal on 5005)
 */

'use strict';

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function httpCheck(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 5000 }, (res) => {
      resolve(res.statusCode);
    });
    req.on('error', () => resolve(0));
    req.on('timeout', () => { req.destroy(); resolve(0); });
  });
}

function extractSummary(output) {
  const m = output.match(/Total:\s*(\d+)\s*tests[\s\S]*?Passed:\s*(\d+)[\s\S]*?Failed:\s*(\d+)[\s\S]*?Skipped:\s*(\d+)[\s\S]*?Pass Rate:\s*([\d.]+)%/);
  if (m) {
    return { total: +m[1], passed: +m[2], failed: +m[3], skipped: +m[4], rate: +m[5] };
  }
  return null;
}

function printHeader(title) {
  console.log(`\n${C.cyan}${'═'.repeat(70)}${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ${title}${C.reset}`);
  console.log(`${C.cyan}${'═'.repeat(70)}${C.reset}`);
}

async function checkServer(url, name) {
  const status = await httpCheck(url);
  if (status === 200) {
    console.log(`${C.green}✓${C.reset} ${name} server is responding (${url})`);
    return true;
  }
  console.log(`${C.red}✗${C.reset} ${name} server returned ${status}`);
  return false;
}

function runTestSuite(name, scriptPath, cwd) {
  return new Promise((resolve) => {
    printHeader(name);
    const child = spawn('node', [scriptPath], {
      cwd: cwd || path.dirname(scriptPath),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      stderr += chunk;
    });

    child.on('close', () => {
      const summary = extractSummary(stdout);
      resolve({ success: true, output: stdout, summary });
    });

    child.on('error', (e) => {
      console.error(`${C.red}Error running ${name}: ${e.message}${C.reset}`);
      resolve({ success: false, output: '', summary: null });
    });
  });
}

async function main() {
  console.log(`${C.bold}${C.cyan}${'═'.repeat(70)}${C.reset}`);
  console.log(`${C.bold}${C.cyan}  SMART ENTERPRISE SUITE — E2E TEST RUNNER${C.reset}`);
  console.log(`${C.bold}${C.cyan}${'═'.repeat(70)}${C.reset}`);
  console.log(`\n${C.dim}Time: ${new Date().toISOString()}${C.reset}\n`);

  console.log(`${C.bold}[ Pre-flight Checks ]${C.reset}\n`);

  const branchOk = await checkServer('http://localhost:5002/health', 'Branch App');
  const portalOk = await checkServer('http://localhost:5005/health', 'Admin Portal');

  if (!branchOk || !portalOk) {
    console.log(`\n${C.red}✗ One or more servers are not running.${C.reset}`);
    console.log(`  Branch App:    node backend/server.js`);
    console.log(`  Admin Portal:  node SmartEnterprise_AD/backend/server.js`);
    process.exit(1);
  }

  console.log(`\n${C.green}All servers ready. Running test suites...${C.reset}\n`);

  const results = [];

  const branchResult = await runTestSuite(
    'SUITE 1: Branch App E2E Tests',
    path.join(process.cwd(), 'backend/tests/e2e/branch-app-tester.js')
  );
  results.push({ name: 'Branch App', ...branchResult });

  const portalScriptPath = path.resolve(process.cwd(), '../SmartEnterprise_AD/backend/tests/e2e/portal-tester.js');
  const portalResult = await runTestSuite(
    'SUITE 2: Admin Portal E2E Tests',
    portalScriptPath,
    path.dirname(portalScriptPath)
  );
  results.push({ name: 'Admin Portal', ...portalResult });

  printHeader('COMBINED SUMMARY');

  let totalPassed = 0, totalFailed = 0, totalSkipped = 0, totalTests = 0;
  for (const r of results) {
    if (r.summary) {
      totalTests += r.summary.total;
      totalPassed += r.summary.passed;
      totalFailed += r.summary.failed;
      totalSkipped += r.summary.skipped;
      const icon = r.summary.failed === 0 ? `${C.green}✓` : `${C.red}✗`;
      console.log(`  ${icon} ${r.name.padEnd(20)} ${r.summary.passed}/${r.summary.total} passed (${r.summary.rate}%)`);
    } else {
      console.log(`  ${C.red}✗ ${r.name.padEnd(20)} FAILED TO RUN${C.reset}`);
    }
  }

  const overallRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;
  console.log(`\n  ${'─'.repeat(50)}`);
  console.log(`  ${C.bold}TOTAL: ${totalPassed}/${totalTests} passed${C.reset} | ${C.red}Failed: ${totalFailed}${C.reset} | ${C.yellow}Skipped: ${totalSkipped}${C.reset} | ${C.green}Pass Rate: ${overallRate}%${C.reset}`);

  console.log(`\n${C.cyan}${'═'.repeat(70)}${C.reset}\n`);

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch(e => {
  console.error(`${C.red}Fatal error: ${e.message}${C.reset}`);
  process.exit(1);
});
