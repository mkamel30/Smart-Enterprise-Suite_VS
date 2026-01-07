@echo off
color 0A
title Smart Enterprise Suite - Development

echo.
echo ============================================
echo   Smart Enterprise Suite
echo   Development Mode
echo ============================================
echo.
echo Starting services...
echo.

REM Start Backend
echo Starting Backend Server on port 5000...
cd backend
start "Backend - Smart Enterprise Suite" cmd /k npm run dev
timeout /t 3 /nobreak

REM Start Frontend
echo Starting Frontend Server on port 5173...
cd ../frontend
start "Frontend - Smart Enterprise Suite" cmd /k npm run dev
timeout /t 2 /nobreak

cd ..
color 0B
cls
echo ============================================
echo   Services Running
echo ============================================
echo.
echo Frontend:  http://localhost:5173
echo Backend:   http://localhost:5000
echo API Docs:  http://localhost:5000/api-docs
echo Health:    http://localhost:5000/health
echo.
echo ============================================
echo.
echo Press CTRL+C in each window to stop
echo Or run: stop-servers.bat
echo.
pause
