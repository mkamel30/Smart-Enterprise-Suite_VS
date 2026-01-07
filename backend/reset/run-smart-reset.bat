@echo off
title Smart Database Reset Tool
color 0C
cls
echo ===================================================
echo   SMART DATABASE RESET TOOL
echo ===================================================
echo.
echo This tool will:
echo  1. Create a full backup of the current database
echo  2. Wipe all transactional data (Sales, Requests, etc.)
echo  3. PRESERVE: Users, Branches, Permissions, Settings,
echo     Spare Parts, and Machine Configurations.
echo  4. Zero out inventory quantities (set to 0)
echo.
echo ---------------------------------------------------
echo  WARNING: Ensure no one is using the system.
echo ---------------------------------------------------
echo.
pause

:: Switch to script directory
cd /d "%~dp0"

echo.
echo Starting Reset Script...
echo.
node smart-reset.js

echo.
echo ===================================================
echo   Process Finished
echo ===================================================
pause
