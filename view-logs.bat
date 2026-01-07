@echo off
color 0A
title Smart Enterprise Suite - Logs Viewer
if exist "logs\app.log" (
    type logs\app.log
) else (
    echo No log file found
)
pause
