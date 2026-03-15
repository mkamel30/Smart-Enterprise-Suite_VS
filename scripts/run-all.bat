@echo off
echo Starting Smart Enterprise Suite (Branch Edition)...

start "Backend Server" cmd /c "run-backend.bat"
start "Frontend Server" cmd /c "run-frontend.bat"

echo.
echo Both servers are starting in separate windows.
echo - Backend: http://localhost:5002
echo - Frontend: http://localhost:5173
echo.
pause
