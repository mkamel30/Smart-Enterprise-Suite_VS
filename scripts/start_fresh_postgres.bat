@echo off
echo ===========================================
echo 🚀 Start Fresh PostgreSQL (Empty DB)
echo ===========================================

REM 1. Backup SQLite
echo.
echo [1/4] Backing up SQLite database...
if not exist backups mkdir backups
copy prisma\dev.db backups\dev_backup_final.db
echo ✅ Backup created at backups\dev_backup_final.db

REM 2. Update Config
echo.
echo [2/4] Updating configuration files...
node scripts/setup_postgres_config.js

REM 3. Reset Docker
echo.
echo [3/4] Starting clean PostgreSQL container...
docker-compose down -v
docker-compose up -d

echo Waiting 15 seconds for DB to initialize...
timeout /t 15

REM 4. Create Schema
echo.
echo [4/4] Creating Database Schema (Empty)...
echo NOTE: If prompted, confirm to reset database.

REM Clear old migrations to avoid conflicts
if exist prisma\migrations rmdir /s /q prisma\migrations

call npx prisma migrate dev --name init_postgres

echo.
echo ===========================================
echo ✅ FRESH START COMPLETE!
echo Your database is now empty and ready for use.
echo Old data is preserved in 'backups\dev_backup_final.db'.
echo ===========================================
pause
