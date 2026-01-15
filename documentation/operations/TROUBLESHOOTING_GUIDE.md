# Troubleshooting Guide

## 🚨 Common Issues

### 1. "Database Connection Failed"
**Symptoms**: App crashes on start, or 500 errors on login.
**Possible Causes**:
- Database server is down.
- Incorrect `DATABASE_URL` in `.env`.
- Network firewall blocking port 5432.
**Solution**:
1. Check if PostgreSQL is running: `sudo systemctl status postgresql`
2. Verify credentials in `.env`.
3. Try connecting manually: `psql -h localhost -U user -d dbname`

### 2. "Cors Error" (Cross-Origin Resource Sharing)
**Symptoms**: Frontend shows red console errors about CORS.
**Solution**:
1. Check `CORS_ORIGIN` in `backend/.env`.
2. Ensure it matches the frontend URL exactly (e.g., `https://ses.yourdomain.com`).
3. Restart backend after changes.

### 3. "Token Expired" Loop
**Symptoms**: User keeps getting logged out immediately.
**Solution**:
1. Check server time. If server time is drifted, tokens may appear invalid.
2. Verify `JWT_EXPIRY` setting.
3. Clear browser cookies/local storage.

### 4. File Upload Failures
**Symptoms**: "File too large" or "Upload error".
**Solution**:
1. Check `MAX_FILE_SIZE` in `.env`.
2. Check Nginx configuration `client_max_body_size`. It must match or exceed the app limit.
   ```nginx
   # /etc/nginx/nginx.conf
   http {
       client_max_body_size 10M;
   }
   ```

## 📝 Logs

### Backend Logs
Using PM2:
```bash
pm2 logs ses-backend
```
Or check file: `./logs/app.log`

### Frontend Logs
Check the browser Developer Tools (F12) > Console.

## 🆘 Escalation
If issues persist:
1. Gather logs.
2. Note the reproduction steps.
3. Contact Level 3 Support / Development Team.
