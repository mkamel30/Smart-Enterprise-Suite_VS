/**
 * SMART ENTERPRISE SUITE - MASTER SYSTEM INTEGRITY RUNNER
 * 
 * This script orchestrates the entire testing suite:
 * 1. Prisma Schema Validation
 * 2. Backend Service Logic (Jest)
 * 3. Live API Endpoint Health
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load .env from backend directory
const envPath = path.resolve(__dirname, 'backend', '.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
}

const COLORS = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    cyan: "\x1b[36m"
};

const LOG_DIR = path.join(__dirname, 'backend', 'tests', 'logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}
const LOG_FILE = path.join(LOG_DIR, `master_test_results_${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

function log(msg, color = COLORS.reset) {
    const timestamp = new Date().toLocaleTimeString();
    const formattedMsg = `[${timestamp}] ${msg}`;
    console.log(`${color}${formattedMsg}${COLORS.reset}`);
    fs.appendFileSync(LOG_FILE, formattedMsg + '\n');
}

function runCommand(command, cwd, name) {
    log(`Starting: ${name}... (this may take a moment)`, COLORS.cyan);
    try {
        const output = execSync(command, {
            cwd,
            env: { ...process.env },
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });
        fs.appendFileSync(LOG_FILE, `\n--- START ${name} OUTPUT ---\n${output}\n--- END ${name} OUTPUT ---\n`);
        log(`PASSED: ${name}`, COLORS.green);
        return true;
    } catch (error) {
        fs.appendFileSync(LOG_FILE, `\n--- START ${name} ERROR OUTPUT ---\n${error.stdout || ''}\n${error.stderr || ''}\n--- END ${name} ERROR OUTPUT ---\n`);
        log(`FAILED: ${name}`, COLORS.red);
        if (error.stdout) log("Check the log file for detailed error output.", COLORS.yellow);
        return false;
    }
}

async function waitForServer(url, timeoutMs = 20000) {
    const start = Date.now();
    const http = require('http');

    return new Promise((resolve, reject) => {
        const check = () => {
            if (Date.now() - start > timeoutMs) {
                reject(new Error(`Server did not start within ${timeoutMs}ms`));
                return;
            }

            const req = http.get(url + '/api/health', (res) => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    setTimeout(check, 1000); // Retry if not 200
                }
            });

            req.on('error', () => {
                setTimeout(check, 1000);
            });
            req.end();
        };
        check();
    });
}

async function runMaster() {
    log("========================================================", COLORS.bright);
    log("   SMART ENTERPRISE SUITE - MASTER INTEGRITY RUNNER", COLORS.bright);
    log("========================================================", COLORS.bright);
    log(`Logging to: ${LOG_FILE}\n`);

    const results = {
        prisma: false,
        logic: false,
        api: false
    };

    // --- PHASE 1: PRISMA ---
    log("--- Phase 1: Prisma Integrity ---", COLORS.yellow);
    results.prisma = runCommand('npx prisma validate', path.join(__dirname, 'backend'), 'Prisma Schema Validation');

    // --- PHASE 2: LOGIC (JEST) ---
    log("\n--- Phase 2: Service Logic (Jest) ---", COLORS.yellow);
    results.logic = runCommand('npm test -- --runInBand', path.join(__dirname, 'backend'), 'Backend Jest Tests');

    // --- PHASE 3: FRONTEND BUILD ---
    log("\n--- Phase 3: Frontend Build Verification ---", COLORS.yellow);
    results.frontend = runCommand('npm run build', path.join(__dirname, 'frontend'), 'Frontend Vite Build');

    // --- PHASE 4: API ENDPOINTS ---
    log("\n--- Phase 4: API Endpoint Pulse ---", COLORS.yellow);

    const API_URL = process.env.API_URL || 'http://localhost:5002';
    let serverProcess = null;

    try {
        log(`Starting Backend Server on port ${API_URL.split(':').pop()}...`, COLORS.cyan);

        // Start server in background
        serverProcess = spawn('node', ['server.js'], {
            cwd: path.join(__dirname, 'backend'),
            env: { ...process.env, PORT: '5002' }, // Ensure port matches
            stdio: 'ignore' // Ignore stdout/stderr to keep runner clean (log file captures tests)
        });

        // Wait for it to be ready
        await waitForServer(API_URL);
        log("Server is up and running.", COLORS.green);

        // Run Tests
        results.api = runCommand('node scripts/test-api-integrity.js', path.join(__dirname, 'backend'), 'API Endpoint Integrity');

    } catch (e) {
        log(`Failed to execute Phase 3: ${e.message}`, COLORS.red);
        results.api = false;
    } finally {
        if (serverProcess) {
            log("Stopping Backend Server...", COLORS.cyan);
            // On Windows, simple kill might not work for tree. Using taskkill to be sure if PID exists.
            try {
                if (process.platform === 'win32') {
                    execSync(`taskkill /PID ${serverProcess.pid} /T /F `);
                } else {
                    serverProcess.kill('SIGTERM');
                }
            } catch (err) {
                // Ignore if already dead
            }
        }
    }

    // --- FINAL SUMMARY ---
    log("\n========================================================", COLORS.bright);
    log("                FINAL SYSTEM HEALTH REPORT", COLORS.bright);
    log("========================================================", COLORS.bright);

    const printStatus = (name, ok) => {
        const icon = ok ? "✅" : "❌";
        const status = ok ? "PASS" : "FAIL";
        const color = ok ? COLORS.green : COLORS.red;
        log(`${icon} ${name.padEnd(25)}: ${status}`, color);
    };

    printStatus("Prisma Schema Integrity", results.prisma);
    printStatus("Backend Service Logic", results.logic);
    printStatus("Frontend Build", results.frontend);
    printStatus("API Endpoint Health", results.api);

    log("========================================================");

    const allPassed = Object.values(results).every(v => v);
    if (!allPassed) {
        log("\n⚠️  Some subsystems failed integrity checks. Review the logs above.", COLORS.red);
        process.exit(1);
    } else {
        log("\n✨ SYSTEM IS COMPLIANT AND HEALTHY!", COLORS.green);
        process.exit(0);
    }
}

runMaster();
