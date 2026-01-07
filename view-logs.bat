@echo off
REM =====================================================
REM Smart Enterprise Suite - View Logs Script
REM =====================================================
color 0A
title Smart Enterprise Suite - Logs Viewer

echo.
echo ================================================
echo   Smart Enterprise Suite - Log Viewer
echo ================================================
echo.
echo Checking for log files...
echo.

set FOUND=0

REM Check backend logs
if exist "backend\logs\app.log" (
    echo === Backend Application Log (Last 50 lines) ===
    echo.
    powershell -command "Get-Content 'backend\logs\app.log' -Tail 50"
    echo.
    set FOUND=1
)

if exist "backend\logs\error.log" (
    echo === Backend Error Log (Last 20 lines) ===
    echo.
    powershell -command "Get-Content 'backend\logs\error.log' -Tail 20"
    echo.
    set FOUND=1
)

REM Check root logs
if exist "logs\app.log" (
    echo === Root Application Log (Last 50 lines) ===
    echo.
    powershell -command "Get-Content 'logs\app.log' -Tail 50"
    echo.
    set FOUND=1
)

if %FOUND%==0 (
    echo No log files found.
    echo.
    echo Log locations checked:
    echo   - backend\logs\app.log
    echo   - backend\logs\error.log
    echo   - logs\app.log
)

echo.
echo ================================================
echo Press any key to exit...
pause >nul
