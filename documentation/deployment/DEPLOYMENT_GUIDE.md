# Deployment Guide

This guide covers the deployment of the Smart Enterprise Suite to a production environment.

## 📋 Prerequisites

- **OS**: Linux (Ubuntu 20.04/22.04 LTS recommended)
- **Runtime**: Node.js v18.x or v20.x
- **Database**: PostgreSQL 14+
- **Process Manager**: PM2
- **Web Server**: Nginx (Reverse Proxy)

## 🚀 Step-by-Step Deployment

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2
```

### 2. Application Setup

```bash
# Clone Repository
git clone <repository_url> /var/www/smart-enterprise
cd /var/www/smart-enterprise

# Install Dependencies
cd backend && npm ci --production
cd ../frontend && npm ci
```

### 3. Configuration

```bash
# Backend Config
cd /var/www/smart-enterprise/backend
cp .env.example .env
nano .env
# -> Fill in DATABASE_URL, JWT_SECRET, etc.
```

### 4. Build Frontend

```bash
cd /var/www/smart-enterprise/frontend
npm run build
```

The build output will be in `/var/www/smart-enterprise/frontend/dist`.

### 5. Database Migration

```bash
cd /var/www/smart-enterprise/backend
npx prisma migrate deploy
```

### 6. Start Backend with PM2

```bash
cd /var/www/smart-enterprise/backend
pm2 start server.js --name "ses-backend"
pm2 save
pm2 startup
```

### 7. Configure Nginx

Create config file `/etc/nginx/sites-available/smart-enterprise`:

```nginx
server {
    listen 80;
    server_name ses.yourdomain.com;

    # Frontend (Static Files)
    location / {
        root /var/www/smart-enterprise/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/smart-enterprise /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 8. SSL Setup (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d ses.yourdomain.com
```

## ✅ Verification Checklist

- [ ] Backend is running (`pm2 status`)
- [ ] Database migrations applied successfully
- [ ] Frontend loads at `https://ses.yourdomain.com`
- [ ] API is accessible at `https://ses.yourdomain.com/api/health` (if health endpoint exists)
- [ ] Login works
- [ ] SSL certificate is valid
