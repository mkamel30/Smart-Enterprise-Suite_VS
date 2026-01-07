@echo off
REM =====================================================
REM Smart Enterprise Suite - Stop Servers Script
REM =====================================================
color 0C
title Smart Enterprise Suite - Stop Servers

echo.
echo ================================================
echo   Stopping Smart Enterprise Suite Servers
echo ================================================
echo.

echo [1/4] Stopping Node.js processes...
taskkill /F /IM node.exe 2>nul
if %errorlevel%==0 (
    echo       OK - Node.js processes stopped
) else (
    echo       -- Node.js was not running
)

echo.
echo [2/4] Stopping npm processes...
taskkill /F /IM npm.cmd 2>nul
taskkill /F /IM npm.exe 2>nul

echo.
echo [3/4] Freeing ports 5000 and 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5000" ^| find "LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5173" ^| find "LISTENING"') do taskkill /F /PID %%a 2>nul
echo       OK - Ports freed

timeout /t 2 /nobreak >nul

echo.
echo [4/4] Verifying shutdown...
set CLEAN=1

netstat -aon | find ":5000" | find "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo       WARNING: Port 5000 still occupied
    set CLEAN=0
) else (
    echo       OK - Port 5000 is free
)

netstat -aon | find ":5173" | find "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo       WARNING: Port 5173 still occupied
    set CLEAN=0
) else (
    echo       OK - Port 5173 is free
)

echo.
if %CLEAN%==1 (
    echo ================================================
    echo   All servers stopped successfully!
    echo   You can now run: start-dev.bat
    echo ================================================
) else (
    echo ================================================
    echo   Warning: Some processes may still be running
    echo   Try running this script again or restart PC
    echo ================================================
)
echo.
timeout /t 3 /nobreak >nul
