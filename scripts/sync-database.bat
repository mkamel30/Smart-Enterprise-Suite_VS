@echo off
REM =====================================================
REM Smart Enterprise Suite - Database Sync Script
REM =====================================================
chcp 65001 >nul
color 0E
title Smart Enterprise Suite - Database Sync

echo.
echo ================================================
echo   Syncing Database Schema
echo ================================================
echo.

REM Ensure PostgreSQL is running
echo [0/2] Checking database status...
docker-compose up -d postgres
if errorlevel 1 (
    echo.
    echo ❌ ERROR: Failed to start PostgreSQL container!
    echo Ensure Docker Desktop is running.
    pause
    exit /b 1
)
timeout /t 5 /nobreak >nul

echo.
cd /d "%~dp0..\backend"

echo [1/2] Syncing database schema...
call npx prisma db push --accept-data-loss --skip-generate
if %errorlevel%==0 (
    echo       OK - Database synced
) else (
    echo       ERROR - Database sync failed
    echo       Check your database connection settings in .env
    cd ..
    pause
    exit /b 1
)

echo.
echo [2/2] Generating Prisma Client...
call npx prisma generate
if %errorlevel%==0 (
    echo       OK - Prisma Client generated
) else (
    echo       ERROR - Prisma generation failed
)

cd /d "%~dp0.."

echo.
echo ================================================
echo   Database sync complete!
echo ================================================
echo.
pause
