# ✅ Admin User Created Successfully!

## 🔐 Login Credentials

```
Email:    admin@csdept.com
Password: admin123
Role:     SUPER_ADMIN
```

## 📝 How to Login

### Option 1: Via Frontend Application
1. Start the backend server:
   ```bash
   cd backend
   npm start
   ```

2. Start the frontend application:
   ```bash
   cd frontend
   npm run dev
   ```

3. Navigate to the login page
4. Enter the credentials above
5. Click "Login"

### Option 2: Via API (Testing)
```bash
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "admin@csdept.com",
  "password": "admin123"
}
```

### PowerShell Test Command:
```powershell
$body = @{email='admin@csdept.com';password='admin123'} | ConvertTo-Json
$response = Invoke-RestMethod -Uri 'http://localhost:5000/api/auth/login' -Method Post -Body $body -ContentType 'application/json'
Write-Host "Token: $($response.token)"
```

## 👤 User Details

- **Name:** System Administrator
- **Email:** admin@csdept.com
- **Role:** SUPER_ADMIN
- **Can Do Maintenance:** Yes
- **Theme:** Light
- **Font:** IBM Plex Sans Arabic

## 🔑 Permissions

As a SUPER_ADMIN, this user has full access to:
- ✅ All dashboard views
- ✅ User management
- ✅ Branch management
- ✅ Customer management
- ✅ Machine management
- ✅ Warehouse operations
- ✅ SIM card management
- ✅ Transfer orders
- ✅ Maintenance operations
- ✅ Reports and analytics
- ✅ System settings
- ✅ Backup and restore
- ✅ Permissions management
- ✅ All admin functions

## 🔄 Re-creating the Admin User

If you need to recreate the admin user in the future, run:

```bash
cd backend
node scripts/create_admin.js
```

This script will:
- Check if admin exists
- If not, create a new admin user with the credentials above
- If yes, display the existing credentials

## 🔒 Security Notes

1. **Change the default password** after first login for security
2. The password is hashed using bcrypt with 10 salt rounds
3. JWT tokens are used for authentication
4. Sessions expire based on JWT_EXPIRATION setting in .env

## 📊 Database Information

- **Database:** SQLite (dev.db)
- **User ID:** cmjvey37w000013h643nqf0mq
- **Created:** January 1, 2026
- **Migrations Applied:** ✅ All up to date

## 🚀 Quick Start

1. **Start Backend:**
   ```bash
   cd backend
   npm start
   ```
   Server will be available at: http://localhost:5000

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```
   Application will be available at: http://localhost:5173

3. **Login with:**
   - Email: admin@csdept.com
   - Password: admin123

## ⚙️ Additional Scripts

Located in `backend/scripts/`:

- **create_admin.js** - Create/check admin user
- **reset_admin.js** - Reset first user to admin
- **check_users.js** - List all users in database

## 📚 API Documentation

Once the server is running, visit:
- **Swagger UI:** http://localhost:5000/api-docs
- **Health Check:** http://localhost:5000/health

---

**Status:** ✅ Ready to use  
**Last Updated:** January 1, 2026
