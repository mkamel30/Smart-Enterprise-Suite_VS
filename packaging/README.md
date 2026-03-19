# Smart Enterprise Suite - Packaging Guide

## Prerequisites

1. **Node.js 18+** installed
2. **Inno Setup 6+** installed (for Windows installer)
3. Clone the repository

## Build Steps

### 1. Build the Executable

```powershell
cd Smart-Enterprise-Suite
node packaging/build.js
```

This will:
- Build the React frontend
- Copy dist to `backend/public/`
- Generate Prisma client
- Build pkg executables (Windows, Linux, Alpine)
- Output to `dist/` directory

### 2. Create Windows Installer

1. Install [Inno Setup](https://jrsoftware.org/isinfo.php)
2. Open `packaging/installer.iss` in Inno Setup
3. Click Build → Compile
4. The installer will be created at `installer/SmartEnterpriseSuite-Setup-1.0.0.exe`

### 3. Register as Windows Service

```powershell
cd Smart-Enterprise-Suite
node packaging/service-setup.js install
```

## Service Management

```powershell
node packaging/service-setup.js status   # Check status
node packaging/service-setup.js start    # Start service
node packaging/service-setup.js stop     # Stop service
node packaging/service-setup.js uninstall # Remove service
```

## Firewall Configuration

The installer automatically configures Windows Firewall rules for:
- **Port 5002**: Backend API
- **Port 5173**: Frontend (Vite dev server)

For manual configuration:
```powershell
netsh advfirewall firewall add rule name="Smart Enterprise Backend" dir=in action=allow protocol=TCP localport=5002
netsh advfirewall firewall add rule name="Smart Enterprise Frontend" dir=in action=allow protocol=TCP localport=5173
```

## File Structure

```
packaging/
  build.js          - Build script (pkg + frontend)
  installer.iss      - Inno Setup installer script
  service-setup.js   - Windows Service manager
```

## Package Outputs

| File | Description |
|------|-------------|
| `dist/smart-enterprise-win-x64.exe` | Windows standalone executable |
| `dist/smart-enterprise-linux-x64` | Linux executable |
| `dist/smart-enterprise-alpine-x64` | Alpine Linux executable |
| `installer/SmartEnterpriseSuite-Setup-1.0.0.exe` | Windows installer |
