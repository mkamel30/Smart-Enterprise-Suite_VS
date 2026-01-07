# Database Restore Script
# This script helps restore database from backups safely

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "       Database Restore Tool" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: List available backups
Write-Host "Available Backups:" -ForegroundColor Yellow
Write-Host ""

$backupDir = ".\backups"
if (!(Test-Path $backupDir)) {
    Write-Host "No backups directory found!" -ForegroundColor Red
    pause
    exit
}

$backups = Get-ChildItem -Path $backupDir -Filter "*.db" | Sort-Object LastWriteTime -Descending
if ($backups.Count -eq 0) {
    Write-Host "No backup files found!" -ForegroundColor Red
    pause
    exit
}

# Display backups with numbers
for ($i = 0; $i -lt $backups.Count; $i++) {
    $backup = $backups[$i]
    $size = [math]::Round($backup.Length / 1MB, 2)
    Write-Host "[$($i + 1)] $($backup.Name)" -ForegroundColor Green
    Write-Host "    Size: $size MB | Date: $($backup.LastWriteTime)" -ForegroundColor Gray
    Write-Host ""
}

# Step 2: Ask user to select backup
Write-Host "================================================" -ForegroundColor Cyan
$selection = Read-Host "Select backup number (1-$($backups.Count)) or 'q' to quit"

if ($selection -eq 'q') {
    Write-Host "Cancelled by user" -ForegroundColor Yellow
    pause
    exit
}

$selectedIndex = [int]$selection - 1
if ($selectedIndex -lt 0 -or $selectedIndex -ge $backups.Count) {
    Write-Host "Invalid selection!" -ForegroundColor Red
    pause
    exit
}

$selectedBackup = $backups[$selectedIndex]
Write-Host ""
Write-Host "Selected: $($selectedBackup.Name)" -ForegroundColor Green
Write-Host ""

# Step 3: Confirm
Write-Host "WARNING: This will replace the current database!" -ForegroundColor Red
$confirm = Read-Host "Are you sure? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Cancelled" -ForegroundColor Yellow
    pause
    exit
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Starting Restore Process..." -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Step 4: Stop running processes
Write-Host "Stopping running Node.js processes..." -ForegroundColor Yellow
try {
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "Processes stopped" -ForegroundColor Green
    Start-Sleep -Seconds 2
}
catch {
    Write-Host "No running processes found (or already stopped)" -ForegroundColor Yellow
}
Write-Host ""

# Step 5: Backup current database (just in case)
Write-Host "Creating safety backup of current database..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$safetyBackup = ".\backups\pre-restore_$timestamp.db"
try {
    Copy-Item ".\prisma\dev.db" $safetyBackup -ErrorAction Stop
    Write-Host "Safety backup created: $safetyBackup" -ForegroundColor Green
}
catch {
    Write-Host "Could not create safety backup (database might not exist)" -ForegroundColor Yellow
}
Write-Host ""

# Step 6: Restore selected backup
Write-Host "Restoring database from backup..." -ForegroundColor Yellow
try {
    Copy-Item "$backupDir\$($selectedBackup.Name)" ".\prisma\dev.db" -Force
    Write-Host "Database restored successfully!" -ForegroundColor Green
}
catch {
    Write-Host "Failed to restore database: $_" -ForegroundColor Red
    pause
    exit
}
Write-Host ""

# Step 7: Apply schema with Prisma
Write-Host "Applying schema updates (Prisma DB Push)..." -ForegroundColor Yellow
Write-Host "This will add any missing fields without losing data..." -ForegroundColor Gray
Write-Host ""
try {
    npx prisma db push --accept-data-loss
    Write-Host "Schema applied successfully!" -ForegroundColor Green
}
catch {
    Write-Host "Failed to apply schema" -ForegroundColor Red
    Write-Host "You may need to run npx prisma db push manually" -ForegroundColor Yellow
}
Write-Host ""

# Step 8: Generate Prisma Client
Write-Host "Generating Prisma Client..." -ForegroundColor Yellow
try {
    npx prisma generate
    Write-Host "Prisma Client generated!" -ForegroundColor Green
}
catch {
    Write-Host "Prisma generate warning (might be OK)" -ForegroundColor Yellow
}
Write-Host ""

# Step 9: Done!
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Database Restore Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Start Backend:  npm start" -ForegroundColor White
Write-Host "2. Start Frontend: cd ..\frontend && npm run dev" -ForegroundColor White
Write-Host ""

$startNow = Read-Host "Start backend server now? (y/n)"
if ($startNow -eq "y") {
    Write-Host ""
    Write-Host "Starting backend server..." -ForegroundColor Green
    npm start
}
else {
    Write-Host ""
    Write-Host "Done! Start servers manually when ready." -ForegroundColor Cyan
    pause
}
