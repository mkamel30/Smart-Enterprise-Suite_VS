@echo off
setlocal

:: Ensure we are in the script's directory (backend)
cd /d "%~dp0"

:: Generate Timestamp using PowerShell for reliability
for /f %%i in ('powershell -Command "Get-Date -Format 'yyyyMMdd_HHmmss'"') do set TIMESTAMP=%%i
set "LOGFILE=test_results_%TIMESTAMP%.txt"

echo.
echo ========================================================
echo   SMART ENTERPRISE SUITE - AUTOMATED TEST RUNNER
echo ========================================================
echo.
echo  timestamp: %TIMESTAMP%
echo  logfile:   %LOGFILE%
echo.

:: Initialize Log File
echo ======================================================== > %LOGFILE%
echo  SMART ENTERPRISE SUITE - BACKEND TEST REPORT >> %LOGFILE%
echo  Timestamp: %TIMESTAMP% >> %LOGFILE%
echo ======================================================== >> %LOGFILE%
echo. >> %LOGFILE%

:: Test 1: Integration Tests
echo [1/3] Running General Integration Tests...
echo [1/3] Running General Integration Tests (integration.test.js)... >> %LOGFILE%
echo -------------------------------------------------------- >> %LOGFILE%
call npx jest tests/integration.test.js --detectOpenHandles --forceExit --no-colors >> %LOGFILE% 2>&1
if %ERRORLEVEL% EQU 0 (echo   PASS >> %LOGFILE%) else (echo   FAIL >> %LOGFILE%)
echo. >> %LOGFILE%

:: Test 2: Transfer Service Logic
echo [2/3] Running Transfer Service Tests...
echo [2/3] Running Transfer Service Tests (transferService.test.js)... >> %LOGFILE%
echo -------------------------------------------------------- >> %LOGFILE%
call npx jest tests/transferService.test.js --detectOpenHandles --forceExit --no-colors >> %LOGFILE% 2>&1
if %ERRORLEVEL% EQU 0 (echo   PASS >> %LOGFILE%) else (echo   FAIL >> %LOGFILE%)
echo. >> %LOGFILE%

:: Test 3: Smoke Tests
echo [3/3] Running Transfer Smoke Tests...
echo [3/3] Running Transfer Smoke Tests (transferService.smoke2.test.js)... >> %LOGFILE%
echo -------------------------------------------------------- >> %LOGFILE%
call npx jest tests/transferService.smoke2.test.js --detectOpenHandles --forceExit --no-colors >> %LOGFILE% 2>&1
if %ERRORLEVEL% EQU 0 (echo   PASS >> %LOGFILE%) else (echo   FAIL >> %LOGFILE%)
echo. >> %LOGFILE%

:: Summary
echo ======================================================== >> %LOGFILE%
echo  TEST RUN COMPLETE >> %LOGFILE%
echo ======================================================== >> %LOGFILE%

echo.
echo --------------------------------------------------------
echo  Tests Finished.
echo  Report saved to: %LOGFILE%
echo --------------------------------------------------------
echo.
pause
