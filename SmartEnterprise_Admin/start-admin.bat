@echo off
title Smart Enterprise - Admin Portal Runner

echo ==========================================
echo    Starting Central Admin Portal...
echo ==========================================
echo.

:: Check for node_modules
if not exist "backend\node_modules" (
    echo [!] Backend modules missing. Running installer first...
    call install-admin.bat
)

:: Start Backend
echo [*] Launching Backend on port 5005...
start "Admin Backend" cmd /k "cd backend && npm run dev"

:: Start Frontend
echo [*] Launching Frontend...
start "Admin Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Management Portal is initializing.
echo API: http://localhost:5005
echo UI:  http://localhost:5175
echo.
echo Keep this window open or close it once servers are up.
pause
