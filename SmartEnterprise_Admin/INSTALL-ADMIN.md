# Central Admin Portal - Installation & Setup Guide

This guide covers the steps required to install and run the **Central Admin Portal** sub-project.

## 🔑 Environment Variables

### Backend (`/backend/.env`)
Create a file at `SmartEnterprise_Admin/backend/.env` with the following:
```env
DATABASE_URL="file:./dev.db"
PORT=5005
JWT_SECRET="your_secure_random_secret_here"
PORTAL_API_KEY="master_sync_key_for_branches"
```

### Frontend (`/frontend/.env`) - Optional
Create a file at `SmartEnterprise_Admin/frontend/.env` if you need to change the API URL:
```env
VITE_API_URL="http://localhost:5005/api"
```

---

## 🛠️ Installation Steps

### 1. Backend Setup
1. Navigate to the backend directory:
   ```powershell
   cd SmartEnterprise_Admin/backend
   ```
2. Install dependencies:
   ```powershell
   npm install
   ```
3. Initialize the database (SQLite):
   ```powershell
   npx prisma db push
   ```
4. Seed the initial admin user and parameters:
   ```powershell
   node seed.js
   ```
   *Default Credentials:* `admin` / `admin_password_2026`

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```powershell
   cd SmartEnterprise_Admin/frontend
   ```
2. Install dependencies:
   ```powershell
   npm install
   ```

---

## 🚀 Running the Portal

### Start Backend
In `SmartEnterprise_Admin/backend`:
```powershell
npm run dev
```
*Portal API will be available at http://localhost:5005*

### Start Frontend
In `SmartEnterprise_Admin/frontend`:
```powershell
npm run dev
```
*Dashboard will be available at http://localhost:5175*

---

## 📋 Pre-run Checklist
- [ ] Ensure Node.js (v18+) is installed.
- [ ] Verify `backend/.env` exists and contains a `JWT_SECRET`.
- [ ] Run `node seed.js` at least once to create the login account.
- [ ] Ensure port `5005` (API) and `5175` (UI) are not in use.
