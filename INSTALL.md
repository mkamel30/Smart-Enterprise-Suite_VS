# Smart Enterprise Suite - Installation & Setup Guide

This guide covers the steps required to install and run the main **Smart Enterprise Suite** application.

## 🔑 Environment Variables

### Backend (`/backend/.env`)
The system comes with a default `.env` file configured for local development using SQLite. 
If you need to customize it, ensure the following keys are set:
```env
DATABASE_URL="file:./dev.db"
PORT=5002
JWT_SECRET="your_secure_secret_here"
```

---

## 🛠️ Installation Steps

### 1. Manual Setup
If you prefer manual installation:

#### Backend
1. Navigate to the backend directory:
   ```powershell
   cd backend
   ```
2. Install dependencies:
   ```powershell
   npm install
   ```
3. Initialize the database:
   ```powershell
   npx prisma db push
   ```

#### Frontend
1. Navigate to the frontend directory:
   ```powershell
   cd frontend
   ```
2. Install dependencies:
   ```powershell
   npm install
   ```

---

## 🚀 Running the Application

### Using Automation Scripts (Recommended)
1. **`install.bat`**: Run this once to install everything and setup the database.
2. **`start.bat`**: Run this to launch both the Backend (port 5002) and Frontend (port 5173).

### Manual Run
- Backend: `cd backend && npm run dev`
- Frontend: `cd frontend && npm run dev`

---

## 📋 Pre-run Checklist
- [ ] Node.js (v18+) installed.
- [ ] Backend `.env` file verified.
- [ ] Ports 5002 and 5173 are available.
