@echo off
REM =====================================================
REM Smart Enterprise Suite - Clear Logs Script
REM =====================================================
color 0E
title Smart Enterprise Suite - Clear Logs

echo.
echo ================================================
echo   Clearing Log Files
echo ================================================
echo.

set CLEARED=0

if exist "backend\logs" (
    echo Clearing backend logs...
    del /Q "backend\logs\*.log" 2>nul
    echo       OK - Backend logs cleared
    set /a CLEARED+=1
)

if exist "logs" (
    echo Clearing root logs...
    del /Q "logs\*.log" 2>nul
    echo       OK - Root logs cleared
    set /a CLEARED+=1
)

echo.
if %CLEARED%==0 (
    echo No log files found to clear.
) else (
    echo %CLEARED% log location(s) cleared successfully!
)
echo.
timeout /t 2 /nobreak >nul
