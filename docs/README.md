# Smart Enterprise Suite - Technical Documentation

Welcome to the technical documentation for the Smart Enterprise Suite (SES).
This directory contains comprehensive guides for developers, system administrators, and security auditors.

## 📂 Documentation Structure

### 🏗️ Technical Guides (`/technical`)
- [**Architecture Overview**](./technical/ARCHITECTURE.md) - System design, data flow, and components
- [**API Documentation**](./technical/API_DOCUMENTATION.md) - Complete API reference
- [**Database Schema**](./technical/DATABASE_SCHEMA.md) - Tables, relationships, and data dictionary
- [**Environment Variables**](./technical/ENV_VARIABLES.md) - Configuration reference
- [**Security Guide**](./technical/SECURITY_GUIDE.md) - Security protocols and best practices

### 🚀 Deployment & Operations (`/deployment`, `/operations`)
- [**Deployment Guide**](./deployment/DEPLOYMENT_GUIDE.md) - Production setup instructions
- [**Installation Guide**](./deployment/INSTALLATION_GUIDE.md) - Step-by-step installation
- [**Maintenance Guide**](./operations/MAINTENANCE_GUIDE.md) - Routine maintenance tasks
- [**Backup & Restore**](./operations/BACKUP_RESTORE_GUIDE.md) - Data protection procedures
- [**Troubleshooting**](./operations/TROUBLESHOOTING_GUIDE.md) - Common issues and solutions

### 👥 User Manuals (`/users`)
- [**Admin Manual**](./users/ADMIN_MANUAL.md) - Guide for system administrators
- [**User Guide**](./users/USER_GUIDE.md) - Guide for end-users
- [**Business Processes**](./users/BUSINESS_PROCESS_DOCUMENTATION.md) - Workflows and business rules

---

## 🚦 Quick Start for Developers

1. **Prerequisites**: Node.js v18+, PostgreSQL (or SQLite for dev), npm
2. **Setup**:
   ```bash
   git clone <repo-url>
   cd frontend && npm install
   cd ../backend && npm install
   ```
3. **Configure**:
   - Copy `backend/.env.example` to `backend/.env`
   - Update `DATABASE_URL` and other required vars
4. **Run**:
   ```bash
   # Terminal 1 (Backend)
   cd backend && npm run dev
   
   # Terminal 2 (Frontend)
   cd frontend && npm run dev
   ```
5. **Access**: Open `http://localhost:5173`

##  Support
For technical support, contact the IT Department or the Lead Developer.
