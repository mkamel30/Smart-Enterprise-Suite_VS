@echo off
echo Starting CS Dept Console (Node.js + Vite Version)...
echo.

:: Kill any existing node processes to be safe
taskkill /F /IM node.exe /T 2>nul

echo.
echo Starting Backend Server (Express + SQLite)...
:: Ensure JWT_SECRET is set for the backend window. If not defined, provide a safe dev value.
start "Backend Server" cmd /k "if not defined JWT_SECRET set JWT_SECRET=dev_secret_for_tests & cd backend & node server.js"

timeout /t 3 /nobreak >nul

echo.
echo Starting Frontend (Vite + React)...
start "Frontend Dev" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo  Backend: http://localhost:5000
echo  Frontend: http://localhost:5173
echo ========================================
echo.
echo Both servers are starting in separate windows.
echo Close this window when done.
pause
