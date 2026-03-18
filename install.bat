@echo off
SETLOCAL EnableDelayedExpansion
title Enterprise Suite - Full Installer

echo ==========================================
echo    Smart Enterprise Suite - Installer
echo ==========================================
echo.

:: 1. Backend Setup
echo [1/2] Setting up Backend...
cd backend
if not exist .env (
    echo [!] .env missing in backend. Copying from example or creating default...
    echo NODE_ENV=development > .env
    echo PORT=5002 >> .env
    echo DATABASE_URL="file:./dev.db" >> .env
    echo JWT_SECRET="default_secret_key_change_me_123456" >> .env
)

echo [i] Installing backend dependencies...
call npm install --no-audit --no-fund

echo [i] Initializing Database (Prisma)...
call npx prisma db push --accept-data-loss
cd ..

echo.
:: 2. Frontend Setup
echo [2/2] Setting up Frontend...
cd frontend
echo [i] Installing frontend dependencies...
call npm install --no-audit --no-fund --legacy-peer-deps
cd ..

echo.
echo ==========================================
echo Setup Complete!
echo Use start.bat to run the application.
echo ==========================================
pause
