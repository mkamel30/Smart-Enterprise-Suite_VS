@echo off
SETLOCAL EnableDelayedExpansion
title Admin Portal Installer

echo ==========================================
echo    Central Admin Portal - Installer
echo ==========================================
echo.

:: 1. Backend Setup
echo [1/2] Setting up Backend...
cd backend
if not exist .env (
    echo [!] Creating default .env file...
    echo DATABASE_URL="file:./dev.db" > .env
    echo PORT=5005 >> .env
    echo JWT_SECRET="central_portal_secret_!@#_2026" >> .env
    echo PORTAL_API_KEY="master_portal_key_internal" >> .env
)

echo [i] Installing node modules...
call npm install --no-audit --no-fund

echo [i] Initializing Database (Prisma)...
call npx prisma db push --accept-data-loss

echo [i] Seeding initial admin data...
call node seed.js
cd ..

echo.
:: 2. Frontend Setup
echo [2/2] Setting up Frontend...
cd frontend
echo [i] Installing node modules...
call npm install --no-audit --no-fund --legacy-peer-deps
cd ..

echo.
echo ==========================================
echo Setup Complete!
echo Use start-admin.bat to run the portal.
echo ==========================================
pause
