@echo off
echo ==========================================
echo    Smart Enterprise Suite - Stop All
echo ==========================================

echo.
echo [1/3] Killing processes on port 5002 (Main Backend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5002 " ^| findstr LISTENING') do (
    echo     Killing PID %%a
    taskkill /F /PID %%a >nul 2>&1
)

echo [2/3] Killing processes on port 5005 (Admin Backend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5005 " ^| findstr LISTENING') do (
    echo     Killing PID %%a
    taskkill /F /PID %%a >nul 2>&1
)

echo [3/3] Killing all remaining Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo     All node.exe processes terminated.
) else (
    echo     No node.exe processes found.
)

echo.
echo ==========================================
echo    All servers stopped successfully.
echo ==========================================
echo.
pause
