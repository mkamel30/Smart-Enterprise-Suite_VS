@echo off
echo.
echo Stopping all Node.js processes...
echo.
taskkill /F /IM node.exe
echo.
echo ✓ All servers stopped
echo.
timeout /t 2 /nobreak
