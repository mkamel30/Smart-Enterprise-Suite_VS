@echo off
title Smart Enterprise Suite - Runner

echo ==========================================
echo    Starting Smart Enterprise Suite...
echo ==========================================
echo.

:: Check for node_modules
if not exist "backend\node_modules" (
    echo [!] Backend modules missing. Running installer first...
    call install.bat
)

:: Start Backend
echo [*] Launching Backend on port 5002...
start "Enterprise Backend" cmd /k "cd backend && npm run dev"

:: Start Frontend
echo [*] Launching Frontend...
start "Enterprise Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Application is initializing.
echo API: http://localhost:5002
echo UI:  http://localhost:5173
echo.
echo Keep this window open or close it once servers are up.
pause
