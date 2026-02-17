# Administrator Manual

This guide is for System Administrators and Branch Managers.

## 👥 User Management

### Adding a User
1. Go to **Settings** > **Users**.
2. Click **Add User**.
3. Fill in: Name, Email, Role, Branch.
4. Set a temporary password.

### Roles & Permissions
- **Super Admin**: Full access to all branches and settings.
- **Center Manager**: Manages maintenance center operations.
- **Branch Manager**: Full access to their specific branch.
- **Technician**: Can view/edit maintenance requests assigned to them.
- **CS Agent**: Can create requests and search customers.

## 🏢 Branch Configuration

### Adding a Branch
1. Go to **Settings** > **Branches**.
2. Click **Add Branch**.
3. **Type**: Select 'Main Center' or 'Branch'.
4. **Parent**: Link to a parent branch if applicable.

## ⚙️ System Settings

### Pricing Updates
To update spare part prices:
1. Go to **Warehouse** > **Parts Manager**.
2. Select the part.
3. Update **Default Cost**.
4. Note: This affects *future* requests only.

## 🔒 Security Best Practices
- **Password Resets**: Force password reset for new users on first login.
- **clean-up**: Deactivate users immediately upon termination.
- **Audit Logs**: Regularly check **System Logs** for suspicious activity (e.g., bulk exports).

## 💾 Backup & Maintenance
- Automated backups run daily at 02:00 AM.
- To verify backups: Check the `backups/` directory on the server.
- Report server errors to the IT Infrastructure team.
