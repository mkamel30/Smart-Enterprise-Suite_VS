const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');
const distDir = path.join(backendDir, 'public');
const pkgOutDir = path.join(rootDir, 'dist');

async function build() {
  console.log('=== Smart Enterprise Suite Build Script ===\n');

  try {
    fs.ensureDirSync(pkgOutDir);

    console.log('[1/4] Building frontend...');
    execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });
    console.log('Frontend built.\n');

    console.log('[2/4] Copying frontend dist to backend/public...');
    fs.emptyDirSync(distDir);
    fs.copySync(path.join(frontendDir, 'dist'), distDir);
    console.log('Frontend copied.\n');

    console.log('[3/4] Generating Prisma client...');
    execSync('npx prisma generate', { cwd: backendDir, stdio: 'inherit' });
    console.log('Prisma generated.\n');

    console.log('[4/4] Building pkg executables (win, linux, alpine)...');
    const targets = ['node18-win-x64', 'node18-linux-x64', 'node18-alpine-x64'];
    for (const target of targets) {
      console.log(`  Building ${target}...`);
      try {
        execSync(`npx pkg package.json --targets ${target} --output ${path.join(pkgOutDir, `smart-enterprise-${target}`)}`, {
          cwd: backendDir,
          stdio: 'inherit'
        });
        console.log(`  ${target} done.`);
      } catch (e) {
        console.warn(`  Warning: ${target} build may have issues with native modules.`);
      }
    }

    const pkgAssets = [
      'prisma/**/*',
      'node_modules/@prisma/client/**/*',
      'node_modules/.prisma/**/*',
      'node_modules/better-sqlite3/**/*',
      'node_modules/sqlite3/**/*',
    ];

    console.log('\n=== Build Complete ===');
    console.log(`Output: ${pkgOutDir}`);
    console.log('\nNote: For Windows Service, run: node packaging/service-setup.js');
    console.log('For installer, use Inno Setup with: packaging/installer.iss');
  } catch (e) {
    console.error('Build failed:', e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  build();
}

module.exports = { build };
