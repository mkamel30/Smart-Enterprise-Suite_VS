@echo off
cd /d "%~dp0.."
echo ===========================================
echo 🚀 Automated PostgreSQL Migration Started
echo ===========================================

REM 1. Clean Slate (Stop Everything)
echo.
echo [1/5] Stopping old containers...
docker-compose down -v

REM 2. Update Config
echo.
echo [2/5] Updating configuration files for PostgreSQL...
node scripts/setup_postgres_config.js
if %errorlevel% neq 0 (
    echo ❌ Failed to update config!
    exit /b %errorlevel%
)

REM 3. Start PostgreSQL
echo.
echo [3/5] Starting new PostgreSQL container...
docker-compose up -d

REM Wait slightly for DB to init
echo Waiting 15 seconds for DB to initialize...
timeout /t 15

REM 4. Create Tables (Prisma)
echo.
echo [4/5] Creating Database Schema...
echo Clearing old SQLite migrations (required for provider switch)...
if exist prisma\migrations rmdir /s /q prisma\migrations

echo NOTE: If prompted, confirm to reset database.
call npx prisma migrate dev --name init_postgres
if %errorlevel% neq 0 (
    echo ❌ Failed to create database schema! Authentication or connection failed.
    echo Ensure Docker is running and ports are free.
    exit /b %errorlevel%
)

REM 5. Run Node.js Data Migration
echo.
echo [5/5] Migrating Data (Node.js Script)...
echo Installing sqlite3 driver...
call npm install better-sqlite3

echo Running migration script...
node scripts/node_migrate.js
if %errorlevel% neq 0 (
    echo ❌ Failed to migrate data via Node.js!
    exit /b %errorlevel%
)

echo.
echo ===========================================
echo ✅ MIGRATION COMPLETE!
echo Try restarting your app with 'npm run dev'
echo ===========================================
pause
