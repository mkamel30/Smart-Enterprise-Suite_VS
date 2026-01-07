@echo off
REM =====================================================
REM Smart Enterprise Suite - Development Startup Script
REM =====================================================
color 0A
title Smart Enterprise Suite - Development Mode

echo.
echo ============================================
echo   Smart Enterprise Suite
echo   Development Mode
echo ============================================
echo.

REM Check if we're in the right directory
if not exist "backend" (
    echo ERROR: backend folder not found!
    echo Please run this script from the project root directory.
    pause
    exit /b 1
)

if not exist "frontend" (
    echo ERROR: frontend folder not found!
    echo Please run this script from the project root directory.
    pause
    exit /b 1
)

REM Kill any existing node processes to avoid conflicts
echo Stopping any existing servers...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Starting Backend Server on port 5000...
cd backend
start "Backend - Smart Enterprise Suite" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul

echo Starting Frontend Server on port 5173...
cd ../frontend
start "Frontend - Smart Enterprise Suite" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul

cd ..
color 0B
cls
echo.
echo ================================================
echo   Smart Enterprise Suite - Services Running
echo ================================================
echo.
echo   Frontend:    http://localhost:5173
echo   Backend:     http://localhost:5000
echo   API Docs:    http://localhost:5000/api-docs
echo   Health:      http://localhost:5000/health
echo.
echo ================================================
echo.
echo   To stop servers, run: stop-servers.bat
echo   Or press CTRL+C in each window
echo.
echo ================================================
echo.

REM Auto-open frontend in default browser after 5 seconds
timeout /t 3 /nobreak >nul
start "" http://localhost:5173

pause
