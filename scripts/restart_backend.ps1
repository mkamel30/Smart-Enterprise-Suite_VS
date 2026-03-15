# Restart Backend Server Script
$ErrorActionPreference = "Stop"

Write-Host "Stopping any running backend servers..." -ForegroundColor Yellow

# Kill any node processes related to this project
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like '*Smart-Enterprise-Suite*'
} | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2

Write-Host "Starting backend server..." -ForegroundColor Green
Set-Location "backend"

# Start the server in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"

Write-Host "Backend server started in new window!" -ForegroundColor Cyan
Write-Host "Server should be running on http://localhost:5002" -ForegroundColor Cyan
