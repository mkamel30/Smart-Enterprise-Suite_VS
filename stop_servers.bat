@echo off
echo ========================================
echo   Stopping Servers and Syncing Database
echo ========================================

:: Kill all Node.js processes
echo.
echo [1/7] Stopping Node.js processes...
taskkill /F /IM node.exe 2>nul
if %errorlevel%==0 (
    echo      [OK] Node.js processes stopped
) else (
    echo      [--] Node.js was not running
)

:: Kill npm processes
echo.
echo [2/7] Stopping npm processes...
taskkill /F /IM npm.cmd 2>nul
taskkill /F /IM npm.exe 2>nul

:: Kill PowerShell processes running npm/node (if started via start_dev.bat)
echo.
echo [3/7] Stopping PowerShell dev processes...
for /f "tokens=2" %%a in ('tasklist /FI "WINDOWTITLE eq Administrator: Backend Server*" /NH 2^>nul') do taskkill /F /PID %%a 2>nul
for /f "tokens=2" %%a in ('tasklist /FI "WINDOWTITLE eq Administrator: Frontend Server*" /NH 2^>nul') do taskkill /F /PID %%a 2>nul

:: Free up ports 5000 and 5173 if still occupied
echo.
echo [4/7] Freeing ports 5000 and 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5000" ^| find "LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5173" ^| find "LISTENING"') do taskkill /F /PID %%a 2>nul
echo      [OK] Ports freed

:: Wait for processes to fully stop
timeout /t 3 /nobreak >nul

:: Verify all processes are stopped
echo.
echo [5/7] Verifying shutdown...
set PROCESSES_RUNNING=0
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if %errorlevel%==0 (
    echo      [WARNING] Some node processes still running
    set PROCESSES_RUNNING=1
) else (
    echo      [OK] All node processes stopped
)

netstat -aon | find ":5000" | find "LISTENING" >nul
if %errorlevel%==0 (
    echo      [WARNING] Port 5000 still occupied
    set PROCESSES_RUNNING=1
) else (
    echo      [OK] Port 5000 is free
)

netstat -aon | find ":5173" | find "LISTENING" >nul
if %errorlevel%==0 (
    echo      [WARNING] Port 5173 still occupied
    set PROCESSES_RUNNING=1
) else (
    echo      [OK] Port 5173 is free
)

:: Sync database schema
echo.
echo [6/7] Syncing Database Schema...
cd backend
call npx prisma db push --accept-data-loss
if %errorlevel%==0 (
    echo      [OK] Database synced
) else (
    echo      [ERROR] Database sync failed
)

:: Generate Prisma Client
echo.
echo [7/7] Generating Prisma Client...
call npx prisma generate
if %errorlevel%==0 (
    echo      [OK] Prisma Client generated
) else (
    echo      [ERROR] Prisma generation failed
)

cd ..

echo.
if %PROCESSES_RUNNING%==0 (
    echo ========================================
    echo   Done! You can now run start_dev.bat
    echo ========================================
) else (
    echo ========================================
    echo   Warning: Some processes may still be running
    echo   Try running this script again
    echo ========================================
)
echo.
pause
