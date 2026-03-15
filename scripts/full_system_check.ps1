# Full System Check and Fix Script
# This script will diagnose, build, and test the entire application.

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$backendPath = Join-Path $root "backend"
$frontendPath = Join-Path $root "frontend"

Write-Host "Starting Full System Check..." -ForegroundColor Cyan

# --- Backend Check ---
Write-Host "`n[Backend] Checking Backend Setup..." -ForegroundColor Yellow
Set-Location $backendPath

Write-Host "[Backend] Installing Dependencies..."
npm install --silent > $null

Write-Host "[Backend] Generating Prisma Client..." -ForegroundColor Green
try {
    npx prisma generate
    Write-Host "[Backend] Success: Prisma Client Generated" -ForegroundColor Green
} catch {
    Write-Host "[Backend] Error: Failed to generate Prisma Client. Ensure no other process is locking the files." -ForegroundColor Red
    exit 1
}

Write-Host "[Backend] Pushing Database Schema..." -ForegroundColor Green
try {
    npx prisma db push --accept-data-loss
    Write-Host "[Backend] Success: Database Schema Pushed" -ForegroundColor Green
} catch {
    Write-Host "[Backend] Error: Failed to push database schema." -ForegroundColor Red
    exit 1
}

Write-Host "[Backend] Running Tests..." -ForegroundColor Green
# We use cmd /c to ensure the exit code is captured correctly from npm test
cmd /c "npm test -- --passWithNoTests" 
if ($LASTEXITCODE -ne 0) {
    Write-Host "[Backend] Warning: Some tests failed. Proceeding to Frontend check..." -ForegroundColor Yellow
} else {
    Write-Host "[Backend] Success: All tests passed." -ForegroundColor Green
}

# --- Frontend Check ---
Write-Host "`n[Frontend] Checking Frontend Setup..." -ForegroundColor Yellow
Set-Location $frontendPath

Write-Host "[Frontend] Installing Dependencies..."
npm install --silent > $null

Write-Host "[Frontend] Running TypeScript Type Check..." -ForegroundColor Green
try {
    # Run tsc and capture output, but don't stop script on type errors, just report them
    $tscOutput = npx tsc --noEmit 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[Frontend] Error: TypeScript check failed." -ForegroundColor Red
        $tscOutput | Select-Object -First 20 | ForEach-Object { Write-Host $_ }
        Write-Host "... (output truncated)"
    } else {
        Write-Host "[Frontend] Success: TypeScript check passed." -ForegroundColor Green
    }
} catch {
    Write-Host "[Frontend] Error running tsc." -ForegroundColor Red
}

Write-Host "`n[System Check] Completed." -ForegroundColor Cyan
