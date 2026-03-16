# Smart Enterprise Suite Standalone Packaging Script
# This script bundles the frontend and backend into a distributable standalone package

$ErrorActionPreference = "Stop"
$ProjectRoot = Get-Location
$DistFolder = Join-Path $ProjectRoot "dist-standalone"

Write-Host "--- 1. Cleaning up previous build ---" -ForegroundColor Cyan
if (Test-Path $DistFolder) {
    Remove-Item -Path $DistFolder -Recurse -Force
}
New-Item -ItemType Directory -Path $DistFolder

Write-Host "--- 2. Building Frontend ---" -ForegroundColor Cyan
Set-Location "$ProjectRoot/frontend"
npm run build

Write-Host "--- 3. Preparing Standalone Backend ---" -ForegroundColor Cyan
# Ensure packaging dependencies are installed
if (!(Test-Path "node_modules/.bin/pkg.cmd")) {
    npm install -D pkg@latest
}

Write-Host "--- 4. Obfuscating Backend Source ---" -ForegroundColor Cyan
node obfuscate.js

Write-Host "--- 5. Bundling Protected Backend with PKG ---" -ForegroundColor Cyan
# Using the obfuscated build as the source for pkg
Set-Location "$ProjectRoot/build-backend"

# We must have production dependencies for pkg to resolve imports correctly
Write-Host "Installing production dependencies in build folder..."
& npm install --omit=dev --no-audit --no-fund

Write-Host "Running PKG..."
& "$ProjectRoot/backend/node_modules/.bin/pkg.cmd" . --targets node18-win-x64 --output "$DistFolder/SmartEnterprise.exe"

Set-Location "$ProjectRoot/backend"

Write-Host "--- 6. Collecting Assets ---" -ForegroundColor Cyan
# Copy frontend build
Copy-Item -Path "$ProjectRoot/frontend/dist" -Destination "$DistFolder/frontend-dist" -Recurse

# Copy Prisma engine and schema (some tools expect them next to the executable)
New-Item -ItemType Directory -Path "$DistFolder/prisma"
Copy-Item -Path "$ProjectRoot/backend/prisma/schema.prisma" -Destination "$DistFolder/prisma/"
Copy-Item -Path "$ProjectRoot/backend/node_modules/.prisma/client/*.node" -Destination "$DistFolder/"

# Copy environment example
Copy-Item -Path "$ProjectRoot/backend/.env.example" -Destination "$DistFolder/.env.template"

# Create a simple runner/installer helper
@'
@echo off
echo Starting Smart Enterprise Suite...
if not exist .env (
    echo [ERROR] .env file missing! Please copy .env.template to .env and configure it.
    pause
    exit /b 1
)
SmartEnterprise.exe
'@ | Out-File -FilePath "$DistFolder/run.bat" -Encoding ascii

Write-Host "--- Packaging Complete! ---" -ForegroundColor Green
Write-Host "The standalone package is available at: $DistFolder" -ForegroundColor Green
Write-Host "To run: 1. Copy .env.template to .env. 2. Configure .env. 3. Run SmartEnterprise.exe" -ForegroundColor Yellow

Set-Location $ProjectRoot
