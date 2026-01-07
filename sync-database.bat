@echo off
REM =====================================================
REM Smart Enterprise Suite - Database Sync Script
REM =====================================================
color 0E
title Smart Enterprise Suite - Database Sync

echo.
echo ================================================
echo   Syncing Database Schema
echo ================================================
echo.

cd backend

echo [1/2] Pushing schema changes to database...
call npx prisma db push --accept-data-loss
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

cd ..

echo.
echo ================================================
echo   Database sync complete!
echo ================================================
echo.
pause
