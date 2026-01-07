# 📁 Batch Files Reference

This document describes all the batch scripts available in the Smart Enterprise Suite project.

## Quick Start

```
Double-click: start-dev.bat    → Start development servers
Double-click: stop-servers.bat → Stop all servers
```

---

## 📁 Available Scripts

| File | Purpose | Description |
|------|---------|-------------|
| **`start-dev.bat`** | 🚀 Start Development | Starts both backend (port 5000) and frontend (port 5173) servers. Auto-opens browser when ready. |
| **`stop-servers.bat`** | 🛑 Stop Servers | Stops all Node.js processes and frees up ports 5000 and 5173. |
| **`sync-database.bat`** | 🗄️ Database Sync | Syncs Prisma schema to database and regenerates the Prisma client. Run after schema changes. |
| **`setup.bat`** | ⚙️ Initial Setup | First-time setup: installs all dependencies, creates `.env` files, and prepares the project. |
| **`clear-logs.bat`** | 🗑️ Clear Logs | Deletes all log files from `backend/logs/` and `logs/` directories. |
| **`view-logs.bat`** | 👁️ View Logs | Displays the last 50 lines of application logs and last 20 lines of error logs. |
| **`backend/reset/run-smart-reset.bat`** | 💥 Database Reset | **DANGER!** Wipes transactional data (sales, requests) while preserving configuration. Use only for testing. |

---

## 📂 File Locations

```
📂 Project Root
├── start-dev.bat           # Start development
├── stop-servers.bat        # Stop development  
├── sync-database.bat       # Sync Prisma schema
├── setup.bat               # Initial setup
├── clear-logs.bat          # Clear log files
├── view-logs.bat           # View log files
│
└── backend/
    └── reset/
        └── run-smart-reset.bat  # Database reset (use with caution!)
```

---

## 🔧 Usage Guide

### First Time Setup
```
1. Run: setup.bat
2. Edit: backend/.env (configure database, JWT secret, etc.)
3. Run: sync-database.bat
4. Run: start-dev.bat
```

### Daily Development
```
Start:  start-dev.bat
Stop:   stop-servers.bat
```

### After Schema Changes
```
1. Stop servers: stop-servers.bat
2. Sync database: sync-database.bat
3. Start servers: start-dev.bat
```

### Troubleshooting
```
View logs:   view-logs.bat
Clear logs:  clear-logs.bat
```

---

## ⚠️ Important Notes

1. **`run-smart-reset.bat`**: Only use this for testing environments. It will delete all sales, requests, and transactional data!

2. **Ports**: The application uses:
   - Port 5000 for Backend API
   - Port 5173 for Frontend (Vite)

3. **Prerequisites**: Node.js must be installed before running any scripts.

---

*Last Updated: January 2026*
