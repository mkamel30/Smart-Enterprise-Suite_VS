@echo off
REM =====================================================
REM Smart Enterprise Suite - Windows Setup Script
REM For: Windows PC Initial Setup
REM =====================================================

setlocal enabledelayedexpansion
cls

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║     Smart Enterprise Suite - Windows Setup Script      ║
echo ║                   Version 1.0.0                        ║
echo ╚════════════════════════════════════════════════════════╝
echo.

REM Check if Node.js and npm are installed
echo [1/10] Checking Node.js installation...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed!
    echo    Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js found: 
node --version

echo.
echo [2/10] Checking npm installation...
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm is not installed!
    echo    Please reinstall Node.js with npm
    pause
    exit /b 1
)
echo ✅ npm found: 
npm --version

REM Check if git is installed
echo.
echo [3/10] Checking Git installation...
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  Git not found (optional, but recommended)
) else (
    echo ✅ Git found: 
    git --version
)

REM Backend Setup
echo.
echo [4/10] Setting up Backend...
cd backend
if not exist "node_modules" (
    echo    Installing backend dependencies...
    call npm install
    if !errorlevel! neq 0 (
        echo ❌ Failed to install backend dependencies
        pause
        exit /b 1
    )
) else (
    echo    ✅ Backend dependencies already installed
)

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo    Creating .env file...
    (
        echo # Environment
        echo NODE_ENV=development
        echo PORT=5000
        echo HOST=localhost
        echo.
        echo # Database
        echo DATABASE_URL="postgresql://user:password@localhost:5432/smart_enterprise"
        echo.
        echo # JWT
        echo JWT_SECRET=your_jwt_secret_key_here_minimum_32_characters
        echo JWT_EXPIRY=24h
        echo.
        echo # CORS
        echo CORS_ORIGIN=http://localhost:5173
        echo CORS_CREDENTIALS=true
        echo.
        echo # Uploads
        echo MAX_FILE_SIZE=10mb
        echo UPLOAD_DIR=./uploads
        echo.
        echo # Rate Limiting
        echo RATE_LIMIT_WINDOW_MS=900000
        echo RATE_LIMIT_MAX_REQUESTS=100
        echo.
        echo # Security
        echo COOKIE_SECRET=your_cookie_secret_key_here_minimum_32_characters
        echo HELMET_ENABLED=true
        echo CSRF_ENABLED=true
        echo.
        echo # Logging
        echo LOG_LEVEL=info
        echo LOG_FILE=./logs/app.log
        echo.
        echo # URLs
        echo API_URL=http://localhost:5000
        echo FRONTEND_URL=http://localhost:5173
        echo.
        echo # Backup
        echo BACKUP_ENABLED=true
        echo BACKUP_SCHEDULE=0 2 * * *
        echo BACKUP_RETENTION_DAYS=30
    ) > .env
    echo    ✅ .env file created (EDIT THIS WITH YOUR SETTINGS!)
) else (
    echo    ✅ .env file already exists
)

REM Create logs directory
if not exist "logs" (
    mkdir logs
    echo    ✅ Created logs directory
)

REM Create uploads directory
if not exist "uploads" (
    mkdir uploads
    echo    ✅ Created uploads directory
)

cd ..

REM Frontend Setup
echo.
echo [5/10] Setting up Frontend...
cd frontend
if not exist "node_modules" (
    echo    Installing frontend dependencies...
    call npm install
    if !errorlevel! neq 0 (
        echo ❌ Failed to install frontend dependencies
        pause
        exit /b 1
    )
) else (
    echo    ✅ Frontend dependencies already installed
)

REM Create .env file for frontend if it doesn't exist
if not exist ".env" (
    echo    Creating frontend .env file...
    (
        echo VITE_API_URL=http://localhost:5000
        echo VITE_APP_NAME=Smart Enterprise Suite
    ) > .env
    echo    ✅ Frontend .env file created
) else (
    echo    ✅ Frontend .env file already exists
)

cd ..

REM Prisma Setup
echo.
echo [6/10] Setting up Prisma Database...
cd backend
echo    Installing Prisma...
call npm install -D prisma
if !errorlevel! neq 0 (
    echo ⚠️  Failed to install Prisma
)

echo    Generating Prisma client...
call npx prisma generate
if !errorlevel! neq 0 (
    echo ⚠️  Failed to generate Prisma client
)

echo    ✅ Prisma setup completed
cd ..

REM Create necessary directories
echo.
echo [7/10] Creating project directories...
if not exist "logs" (
    mkdir logs
    echo    ✅ Created logs directory
)
if not exist "backups" (
    mkdir backups
    echo    ✅ Created backups directory
)
if not exist "docs" (
    mkdir docs
    echo    ✅ Created docs directory
)

REM Check ports
echo.
echo [8/10] Checking required ports...
netstat -ano | findstr ":5000" >nul
if !errorlevel! equ 0 (
    echo ⚠️  Port 5000 (Backend) is already in use
    echo    Make sure no other process is using it before running the server
)

netstat -ano | findstr ":5173" >nul
if !errorlevel! equ 0 (
    echo ⚠️  Port 5173 (Frontend) is already in use
    echo    Make sure no other process is using it before running the server
)
echo ✅ Port check completed

REM Summary
echo.
echo [9/10] Setup Summary...
echo ✅ Backend installed: backend\
echo ✅ Frontend installed: frontend\
echo ✅ Environment files created
echo ✅ Project directories created

REM Next Steps
echo.
echo [10/10] Next Steps:
echo.
echo 1. Edit configuration files:
echo    - backend\.env (database, JWT secret, etc.)
echo    - frontend\.env (API URL)
echo.
echo 2. Setup Database:
echo    - Make sure PostgreSQL is installed and running
echo    - Create database: smart_enterprise
echo    - Run: cd backend ^&^& npx prisma migrate dev
echo.
echo 3. Run Development Servers:
echo    Terminal 1 (Backend):
echo    - cd backend
echo    - npm run dev
echo.
echo    Terminal 2 (Frontend):
echo    - cd frontend
echo    - npm run dev
echo.
echo 4. Access the application:
echo    - Frontend: http://localhost:5173
echo    - API: http://localhost:5000
echo    - API Docs: http://localhost:5000/api-docs
echo.
echo ═════════════════════════════════════════════════════════
echo              ✅ Setup Complete!
echo ═════════════════════════════════════════════════════════
echo.
pause
