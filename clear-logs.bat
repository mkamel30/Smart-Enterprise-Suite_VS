@echo off
echo Clearing log files...
if exist "logs" (
    del logs\*.log
    echo Logs cleared
) else (
    echo No logs folder found
)
pause
