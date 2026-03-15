# Smart Enterprise Suite - Comprehensive Deployment Guide

**Version:** 1.0.0  
**Last Updated:** 2026-01-31  
**Maintainer:** Development Team  

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Development Setup](#2-development-setup)
3. [Production Deployment](#3-production-deployment)
4. [Docker Deployment](#4-docker-deployment)
5. [Database Migration](#5-database-migration)
6. [Post-Deployment](#6-post-deployment)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

### 1.1 System Requirements

#### Development Environment
| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8 GB |
| Storage | 10 GB free | 20 GB SSD |
| OS | Windows 10/11, macOS 10.15+, Ubuntu 20.04+ | Latest stable |

#### Production Environment
| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8-16 GB |
| Storage | 50 GB free | 100 GB SSD |
| OS | Ubuntu 22.04 LTS, CentOS 8+, Debian 11+ | Ubuntu 22.04 LTS |
| Network | 10 Mbps | 100+ Mbps |

### 1.2 Software Dependencies

#### Required Software
```bash
# Node.js (v22.x or higher)
node --version  # Should be v22.x or higher

# npm (v10.x or higher)
npm --version   # Should be v10.x or higher

# Git (v2.30 or higher)
git --version   # Should be v2.30 or higher

# PostgreSQL (v15.x for production)
psql --version  # Should be v15.x for production
```

#### Installation Commands

**Ubuntu/Debian:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Git
sudo apt-get install -y git

# Install PostgreSQL 15
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get install -y postgresql-15 postgresql-client-15

# Install additional tools
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

**macOS (using Homebrew):**
```bash
# Install Homebrew if not present
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node@22

# Install Git
brew install git

# Install PostgreSQL
brew install postgresql@15
brew services start postgresql@15

# Install Nginx
brew install nginx
```

**Windows:**
```powershell
# Install via Chocolatey (Run as Administrator)
choco install nodejs-lts git postgresql nginx
```

### 1.3 Database Requirements

#### Development (SQLite)
- **Engine:** SQLite 3.39+
- **File:** `prisma/dev.db`
- **No additional setup required**

#### Production (PostgreSQL)
- **Engine:** PostgreSQL 15.x
- **Database Name:** `smart_enterprise`
- **User:** Dedicated application user
- **Character Set:** UTF-8
- **Connection Pool:** 20 connections recommended

#### PostgreSQL Configuration (production)
```sql
-- Create database
CREATE DATABASE smart_enterprise;

-- Create application user
CREATE USER app_user WITH ENCRYPTED PASSWORD 'strong_password_here';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE smart_enterprise TO app_user;

-- Enable required extensions
\c smart_enterprise
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### 1.4 Environment Variables

#### Backend Environment Variables
```bash
# Core Application
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/smart_enterprise"

# Security (REQUIRED - Generate these!)
JWT_SECRET=                        # 64+ character hex string
COOKIE_SECRET=                     # 64+ character hex string

# CORS
CORS_ORIGIN=https://yourdomain.com
CORS_CREDENTIALS=true

# Security Settings
BCRYPT_ROUNDS=12
HELMET_ENABLED=true
CSRF_ENABLED=true
SESSION_TIMEOUT=3600
PASSWORD_EXPIRATION_DAYS=90

# File Uploads
MAX_FILE_SIZE=10mb
UPLOAD_DIR=./uploads
ALLOWED_FILE_EXTENSIONS=.pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX_REQUESTS=5

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
REQUEST_LOGGING=true

# Email (Optional)
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# Backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
BACKUP_DIR=./backups

# Timezone
TZ=Africa/Cairo
```

#### Frontend Environment Variables
```bash
# API Configuration
VITE_API_URL=https://api.yourdomain.com/api

# Application
VITE_APP_NAME=Smart Enterprise Suite
VITE_APP_VERSION=1.0.0

# Features
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_NOTIFICATIONS=true

# Logging
VITE_LOG_LEVEL=error
VITE_MOCK_ENABLED=false
```

---

## 2. Development Setup

### 2.1 Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-org/smart-enterprise-suite.git
cd smart-enterprise-suite

# Verify structure
ls -la
# Should show: backend/, frontend/, docker-compose.yml, README.md
```

### 2.2 Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations (SQLite)
npx prisma migrate dev

# Seed database (optional)
npx prisma db seed

# Return to root
cd ..
```

### 2.3 Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Return to root
cd ..
```

### 2.4 Database Setup

#### Initialize SQLite Database
```bash
cd backend

# Create initial migration
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Verify database
cd prisma
ls -la dev.db
```

#### Database Structure
```
backend/prisma/
├── schema.prisma          # Database schema definition
├── dev.db                 # SQLite database file
├── dev.db-shm            # Shared memory file
├── dev.db-wal            # Write-ahead log
└── migrations/           # Migration history
    ├── migration_lock.toml
    └── [timestamp]_init/
        └── migration.sql
```

### 2.5 Environment Configuration

#### Backend Environment
```bash
cd backend

# Copy example environment file
cp .env.example .env

# Edit .env with your settings
nano .env

# Key settings for development:
# NODE_ENV=development
# PORT=5000
# DATABASE_URL="file:./prisma/dev.db"
# JWT_SECRET=your_dev_secret_32chars_minimum
# CORS_ORIGIN=http://localhost:5173
```

#### Frontend Environment
```bash
cd frontend

# Copy example environment file
cp .env.example .env

# Edit .env with your settings
nano .env

# Key settings:
# VITE_API_URL=http://localhost:5000/api
# VITE_MOCK_ENABLED=false
```

### 2.6 Running Development Servers

#### Start Backend (Terminal 1)
```bash
cd backend

# Using npm script
npm run dev

# Or using nodemon directly
npx nodemon server.js

# Server should start on http://localhost:5000
```

#### Start Frontend (Terminal 2)
```bash
cd frontend

# Using npm script
npm run dev

# Vite dev server should start on http://localhost:5173
```

#### Verify Development Setup
```bash
# Check backend health
curl http://localhost:5000/health

# Expected response:
# {"status":"ok","timestamp":"2026-01-31T...","uptime":...}
```

---

## 3. Production Deployment

### 3.1 Environment Preparation

#### Pre-Deployment Checklist
- [ ] Server provisioned with required specs
- [ ] Domain name configured with DNS
- [ ] SSL certificate obtained (Let's Encrypt)
- [ ] Firewall rules configured (ports 22, 80, 443, 5000)
- [ ] Backup strategy defined
- [ ] Monitoring tools installed

#### Server Setup Script
```bash
#!/bin/bash
# production-setup.sh

# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx certbot python3-certbot-nginx

# Install PM2 globally
sudo npm install -g pm2

# Create application directory
sudo mkdir -p /var/www/smart-enterprise-suite
sudo chown $USER:$USER /var/www/smart-enterprise-suite

# Create log directories
sudo mkdir -p /var/log/smart-enterprise
sudo chown $USER:$USER /var/log/smart-enterprise

# Create backup directory
mkdir -p /var/backups/smart-enterprise

# Setup firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw allow 5000/tcp
sudo ufw enable

echo "Server preparation complete!"
```

### 3.2 Database Migration to PostgreSQL

See [Section 5: Database Migration](#5-database-migration) for detailed steps.

### 3.3 Security Hardening Checklist

#### System Level
- [ ] Disable root SSH login
- [ ] Enable SSH key authentication only
- [ ] Configure fail2ban for brute force protection
- [ ] Keep system packages updated
- [ ] Configure automatic security updates

#### Application Level
- [ ] Use strong JWT and cookie secrets
- [ ] Enable Helmet security headers
- [ ] Configure CSRF protection
- [ ] Implement rate limiting
- [ ] Use HTTPS only
- [ ] Sanitize all user inputs
- [ ] Validate file uploads
- [ ] Enable request logging

#### Security Configuration
```bash
# Install fail2ban
sudo apt install fail2ban -y

# Configure SSH hardening
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
# Set: PasswordAuthentication no
# Set: PubkeyAuthentication yes

# Restart SSH
sudo systemctl restart sshd
```

### 3.4 SSL/TLS Configuration

#### Using Let's Encrypt
```bash
# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal test
sudo certbot renew --dry-run

# Setup auto-renewal cron job
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### Manual SSL Configuration
```nginx
# /etc/nginx/sites-available/smart-enterprise
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
}
```

### 3.5 PM2 Process Management

#### PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'smart-enterprise-backend',
    script: './backend/server.js',
    instances: 'max',        // Use all CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    log_file: '/var/log/smart-enterprise/combined.log',
    out_file: '/var/log/smart-enterprise/out.log',
    error_file: '/var/log/smart-enterprise/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    restart_delay: 3000,
    max_restarts: 10,
    min_uptime: '10s',
    watch: false,
    kill_timeout: 5000,
    listen_timeout: 10000,
    // Health check
    health_check_grace_period: 30000,
    health_check_fatal_exceptions: true
  }]
};
```

#### PM2 Commands
```bash
# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup systemd

# Monitor logs
pm2 logs smart-enterprise-backend

# Restart application
pm2 restart smart-enterprise-backend

# Reload (zero-downtime)
pm2 reload smart-enterprise-backend

# Stop application
pm2 stop smart-enterprise-backend

# View status
pm2 status
pm2 monit
```

### 3.6 Nginx Reverse Proxy Setup

#### Nginx Configuration
```nginx
# /etc/nginx/sites-available/smart-enterprise
upstream backend {
    server 127.0.0.1:5000;
    keepalive 32;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    # Frontend - Static Files
    location / {
        root /var/www/smart-enterprise-suite/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # WebSocket Support (if using Socket.io)
    location /socket.io {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API Documentation (if enabled)
    location /api-docs {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Uploads directory
    location /uploads {
        alias /var/www/smart-enterprise-suite/backend/uploads;
        try_files $uri =404;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://backend;
        access_log off;
    }
}
```

#### Enable Nginx Configuration
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/smart-enterprise /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Restart Nginx
sudo systemctl restart nginx

# Enable auto-start
sudo systemctl enable nginx
```

### 3.7 Environment Variables for Production

#### Backend .env.production
```bash
# /var/www/smart-enterprise-suite/backend/.env
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# Database (PostgreSQL)
DATABASE_URL="postgresql://app_user:strong_password@localhost:5432/smart_enterprise?schema=public&connection_limit=20"

# Security (Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=your_128_character_hex_string_here
COOKIE_SECRET=your_128_character_hex_string_here

# CORS
CORS_ORIGIN=https://yourdomain.com
CORS_CREDENTIALS=true

# Security
BCRYPT_ROUNDS=12
HELMET_ENABLED=true
CSRF_ENABLED=true
SESSION_TIMEOUT=3600
PASSWORD_EXPIRATION_DAYS=90

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX_REQUESTS=5

# File Uploads
MAX_FILE_SIZE=10mb
UPLOAD_DIR=/var/www/smart-enterprise-suite/backend/uploads
ALLOWED_FILE_EXTENSIONS=.pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/smart-enterprise/app.log
REQUEST_LOGGING=true

# Backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
BACKUP_DIR=/var/backups/smart-enterprise

# API & Frontend URLs
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Timezone
TZ=Africa/Cairo

# Email (configure for your provider)
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your_app_password
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="Smart Enterprise Suite"
```

#### Frontend Build Configuration
```bash
cd /var/www/smart-enterprise-suite/frontend

# Create production .env
cat > .env.production << EOF
VITE_API_URL=https://yourdomain.com/api
VITE_APP_NAME=Smart Enterprise Suite
VITE_APP_VERSION=1.0.0
VITE_LOG_LEVEL=error
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_NOTIFICATIONS=true
VITE_MOCK_ENABLED=false
EOF

# Build for production
npm run build

# Verify build output
ls -la dist/
```

---

## 4. Docker Deployment

### 4.1 Dockerfile for Backend

```dockerfile
# backend/Dockerfile
FROM node:22-alpine

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create uploads directory
RUN mkdir -p uploads && chown -R nodejs:nodejs uploads

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start application
CMD ["node", "server.js"]
```

### 4.2 Dockerfile for Frontend

```dockerfile
# frontend/Dockerfile
# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

#### Frontend Nginx Configuration
```nginx
# frontend/nginx.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### 4.3 Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  # PostgreSQL Database
  db:
    image: postgres:15-alpine
    container_name: smart-enterprise-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-changeme}
      POSTGRES_DB: ${DB_NAME:-smart_enterprise}
      PGDATA: /var/lib/postgresql/data/pgdata
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-smart_enterprise}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - smart-enterprise-network

  # Redis (Optional - for caching/sessions)
  redis:
    image: redis:7-alpine
    container_name: smart-enterprise-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - smart-enterprise-network

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: smart-enterprise-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 5000
      DATABASE_URL: postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-changeme}@db:5432/${DB_NAME:-smart_enterprise}?schema=public
      JWT_SECRET: ${JWT_SECRET}
      COOKIE_SECRET: ${COOKIE_SECRET}
      CORS_ORIGIN: ${FRONTEND_URL:-http://localhost}
      REDIS_URL: redis://redis:6379
      LOG_LEVEL: info
    ports:
      - "5000:5000"
    volumes:
      - ./backend/uploads:/app/uploads
      - ./logs:/app/logs
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - smart-enterprise-network

  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: smart-enterprise-frontend
    restart: unless-stopped
    environment:
      VITE_API_URL: ${API_URL:-http://localhost:5000/api}
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - smart-enterprise-network

  # Nginx Reverse Proxy (Optional - for production)
  nginx:
    image: nginx:alpine
    container_name: smart-enterprise-nginx
    restart: unless-stopped
    ports:
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
    depends_on:
      - backend
      - frontend
    networks:
      - smart-enterprise-network
    profiles:
      - production

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  smart-enterprise-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### 4.4 Environment Variables for Docker

```bash
# .env.docker
# Database
DB_USER=postgres
DB_PASSWORD=your_secure_password_here
DB_NAME=smart_enterprise

# Security (Generate these!)
JWT_SECRET=your_128_character_hex_string
COOKIE_SECRET=your_128_character_hex_string

# URLs
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Optional Services
REDIS_URL=redis://redis:6379
```

### 4.5 Docker Commands

```bash
# Build and start all services
docker-compose up -d

# Build with no cache
docker-compose build --no-cache

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db

# Scale backend instances
docker-compose up -d --scale backend=3

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data!)
docker-compose down -v

# Execute commands in containers
docker-compose exec backend sh
docker-compose exec db psql -U postgres

# Backup database
docker-compose exec db pg_dump -U postgres smart_enterprise > backup.sql

# Restore database
docker-compose exec -T db psql -U postgres smart_enterprise < backup.sql
```

---

## 5. Database Migration

### 5.1 SQLite to PostgreSQL Migration

#### Step 1: Prepare PostgreSQL Database
```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database
CREATE DATABASE smart_enterprise;

# Create application user
CREATE USER app_user WITH ENCRYPTED PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE smart_enterprise TO app_user;

# Connect to database and enable extensions
\c smart_enterprise
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

# Exit
\q
```

#### Step 2: Update Database Schema
```prisma
// prisma/schema.prisma - Change datasource
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ... rest of schema remains the same
```

#### Step 3: Create New Migration
```bash
cd backend

# Update environment variable
export DATABASE_URL="postgresql://app_user:password@localhost:5432/smart_enterprise"

# Create baseline migration for PostgreSQL
npx prisma migrate dev --name postgres_init --create-only

# Review and edit the generated migration if needed
# Then apply it
npx prisma migrate deploy

# Generate new Prisma client
npx prisma generate
```

#### Step 4: Export Data from SQLite
```bash
# Using sqlite3 command line
sqlite3 prisma/dev.db <<EOF
.mode insert
.output data_export.sql
.dump
EOF

# Or use a more selective approach with Prisma
# Create export script: scripts/export-data.js
```

#### Step 5: Data Export Script
```javascript
// scripts/export-data.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const sqlitePrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./prisma/dev.db'
    }
  }
});

async function exportData() {
  const data = {};
  
  // Export all tables
  data.users = await sqlitePrisma.user.findMany();
  data.branches = await sqlitePrisma.branch.findMany();
  data.customers = await sqlitePrisma.customer.findMany();
  // ... add all other models
  
  fs.writeFileSync('data_export.json', JSON.stringify(data, null, 2));
  console.log('Data exported successfully');
}

exportData()
  .catch(console.error)
  .finally(() => sqlitePrisma.$disconnect());
```

#### Step 6: Import Data to PostgreSQL
```javascript
// scripts/import-data.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const postgresPrisma = new PrismaClient();

async function importData() {
  const data = JSON.parse(fs.readFileSync('data_export.json', 'utf8'));
  
  // Import in correct order (respect foreign keys)
  console.log('Importing branches...');
  for (const branch of data.branches) {
    await postgresPrisma.branch.create({ data: branch }).catch(console.error);
  }
  
  console.log('Importing users...');
  for (const user of data.users) {
    await postgresPrisma.user.create({ data: user }).catch(console.error);
  }
  
  // ... import other tables
  
  console.log('Data import complete!');
}

importData()
  .catch(console.error)
  .finally(() => postgresPrisma.$disconnect());
```

#### Step 7: Alternative: Using pgloader (Recommended for large datasets)
```bash
# Install pgloader
sudo apt install pgloader

# Create migration script
cat > migrate.load << EOF
LOAD DATABASE
     FROM sqlite:///path/to/prisma/dev.db
     INTO postgresql://app_user:password@localhost:5432/smart_enterprise

WITH include drop, create tables, create indexes, reset sequences

SET work_mem to '16MB', maintenance_work_mem to '512 MB';
EOF

# Run migration
pgloader migrate.load
```

### 5.2 Prisma Migration Commands

```bash
# Development migrations
npx prisma migrate dev          # Create and apply migration in development
npx prisma migrate dev --name add_users_table
npx prisma migrate dev --create-only   # Create without applying

# Production migrations
npx prisma migrate deploy       # Apply pending migrations in production
npx prisma migrate status       # Check migration status
npx prisma migrate resolve --applied 20260101120000_add_feature  # Mark as applied

# Reset and introspect
npx prisma migrate reset        # Reset database (DEVELOPMENT ONLY!)
npx prisma db pull              # Introspect existing database
npx prisma db push              # Push schema without migration

# Generate client
npx prisma generate             # Generate Prisma client

# Studio (GUI)
npx prisma studio               # Open Prisma Studio
```

### 5.3 Data Export/Import

#### Complete Database Backup
```bash
# PostgreSQL dump
pg_dump -h localhost -U app_user -d smart_enterprise > full_backup.sql

# Compressed backup
pg_dump -h localhost -U app_user -d smart_enterprise | gzip > full_backup.sql.gz

# Custom format (allows selective restore)
pg_dump -h localhost -U app_user -F c -d smart_enterprise > full_backup.dump
```

#### Selective Table Export
```bash
# Export specific tables
pg_dump -h localhost -U app_user -d smart_enterprise \
  --table=users \
  --table=branches \
  --table=customers > selective_backup.sql
```

#### Restore from Backup
```bash
# Restore from SQL
psql -h localhost -U app_user -d smart_enterprise < full_backup.sql

# Restore compressed backup
gunzip -c full_backup.sql.gz | psql -h localhost -U app_user -d smart_enterprise

# Restore custom format
pg_restore -h localhost -U app_user -d smart_enterprise full_backup.dump
```

### 5.4 Post-Migration Validation

#### Validation Checklist
- [ ] All tables migrated successfully
- [ ] Row counts match between source and destination
- [ ] Foreign key constraints intact
- [ ] Indexes created properly
- [ ] Application connects successfully
- [ ] All features working correctly

#### Validation Script
```bash
#!/bin/bash
# validate-migration.sh

echo "=== Migration Validation ==="

# Check PostgreSQL connection
psql -h localhost -U app_user -d smart_enterprise -c "SELECT version();"

# Count tables
echo "Table count:"
psql -h localhost -U app_user -d smart_enterprise -c "
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public';
"

# Row counts for key tables
echo "Row counts:"
psql -h localhost -U app_user -d smart_enterprise -c "
SELECT 
  'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'branches', COUNT(*) FROM branches
UNION ALL
SELECT 'customers', COUNT(*) FROM customers
UNION ALL
SELECT 'machines', COUNT(*) FROM posmachines;
"

# Check for missing foreign keys
echo "Checking foreign keys..."
psql -h localhost -U app_user -d smart_enterprise -c "
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
"

# Test application health
curl -s http://localhost:5000/health | jq .

echo "=== Validation Complete ==="
```

---

## 6. Post-Deployment

### 6.1 Health Checks

#### Application Health Check
```bash
# Backend health endpoint
curl https://yourdomain.com/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-01-31T12:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

#### Database Health Check
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -h localhost -U app_user -d smart_enterprise -c "SELECT 1;"

# Check active connections
psql -h localhost -U app_user -d smart_enterprise -c "
SELECT count(*), state 
FROM pg_stat_activity 
WHERE datname = 'smart_enterprise' 
GROUP BY state;
"
```

#### Nginx Health Check
```bash
# Check Nginx status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log
```

### 6.2 Monitoring Setup

#### Application Monitoring (PM2)
```bash
# Install PM2 monitoring
pm2 install pm2-server-monit

# Configure monitoring
pm2 set pm2-server-monit:drive /dev/sda1
pm2 set pm2-server-monit:interval 10

# View monitoring dashboard
pm2 monit
```

#### System Monitoring (Optional - Netdata)
```bash
# Install Netdata
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# Access at http://your-server:19999
```

#### Log Monitoring (Optional - Logrotate)
```bash
# Install logrotate
sudo apt install logrotate

# Create configuration
sudo tee /etc/logrotate.d/smart-enterprise << EOF
/var/log/smart-enterprise/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

### 6.3 Backup Configuration

#### Automated Backup Script
```bash
#!/bin/bash
# backup.sh - Run via cron

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/smart-enterprise"
DB_NAME="smart_enterprise"
DB_USER="app_user"
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
echo "Backing up database..."
pg_dump -h localhost -U $DB_USER -d $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Uploads backup
echo "Backing up uploads..."
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/smart-enterprise-suite/backend/uploads/

# Application backup (config files)
echo "Backing up configuration..."
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
  /var/www/smart-enterprise-suite/backend/.env \
  /etc/nginx/sites-available/smart-enterprise \
  /etc/systemd/system/

# Clean old backups
echo "Cleaning old backups..."
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "config_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup complete: $DATE"
```

#### Cron Configuration
```bash
# Edit crontab
sudo crontab -e

# Add backup job (runs at 2 AM daily)
0 2 * * * /var/www/smart-enterprise-suite/scripts/backup.sh >> /var/log/smart-enterprise/backup.log 2>&1

# Add database optimization (weekly, Sunday at 3 AM)
0 3 * * 0 sudo -u postgres psql -c "VACUUM ANALYZE;" smart_enterprise
```

### 6.4 Log Rotation

#### Application Logs
```bash
# Create logrotate config for application
sudo tee /etc/logrotate.d/smart-enterprise-app << 'EOF'
/var/log/smart-enterprise/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 www-data www-data
    dateext
    dateformat -%Y%m%d-%s
    sharedscripts
    postrotate
        /usr/bin/pm2 reloadLogs > /dev/null 2>&1
    endscript
}
EOF
```

#### Nginx Logs
```bash
# Nginx logrotate is usually configured by default
# Verify configuration
cat /etc/logrotate.d/nginx
```

#### PostgreSQL Logs
```bash
# Add PostgreSQL log rotation
sudo tee /etc/logrotate.d/postgresql << 'EOF'
/var/log/postgresql/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 postgres postgres
    sharedscripts
    postrotate
        /usr/bin/killall -HUP rsyslogd
    endscript
}
EOF
```

### 6.5 SSL Certificate Renewal

#### Let's Encrypt Auto-Renewal
```bash
# Test renewal
sudo certbot renew --dry-run

# Auto-renewal is usually configured by certbot
# Verify cron job exists
sudo systemctl status certbot.timer

# Manual renewal (if needed)
sudo certbot renew

# Reload nginx after renewal
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh << 'EOF'
#!/bin/bash
systemctl reload nginx
EOF
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

---

## 7. Troubleshooting

### 7.1 Common Deployment Issues

#### Issue: Application Won't Start
```bash
# Check PM2 logs
pm2 logs

# Check for port conflicts
sudo lsof -i :5000

# Check environment variables
cat /var/www/smart-enterprise-suite/backend/.env

# Verify database connection
psql $DATABASE_URL -c "SELECT 1;"
```

#### Issue: Database Connection Failed
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Test connection manually
psql -h localhost -U app_user -d smart_enterprise

# Check firewall
sudo ufw status

# Verify pg_hba.conf
cat /etc/postgresql/15/main/pg_hba.conf | grep -v "^#" | grep -v "^$"
```

#### Issue: Frontend Not Loading
```bash
# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify build output exists
ls -la /var/www/smart-enterprise-suite/frontend/dist/

# Check Nginx configuration
sudo nginx -t

# Test static file serving
curl -I https://yourdomain.com/assets/main.js
```

### 7.2 Port Conflicts

#### Detect and Resolve Port Conflicts
```bash
# Find process using port 5000
sudo lsof -i :5000
sudo netstat -tulpn | grep :5000
sudo ss -tulpn | grep :5000

# Kill process if needed
sudo kill -9 <PID>

# Or change application port
# Edit backend/.env: PORT=5001
# Update Nginx upstream configuration
```

### 7.3 Database Connection Issues

#### Connection Pool Exhaustion
```bash
# Check active connections
psql -h localhost -U app_user -d smart_enterprise -c "
SELECT count(*), state 
FROM pg_stat_activity 
GROUP BY state;
"

# Increase max connections (in postgresql.conf)
sudo nano /etc/postgresql/15/main/postgresql.conf
# max_connections = 200

# Restart PostgreSQL
sudo systemctl restart postgresql
```

#### Connection String Issues
```bash
# Test connection string
psql "postgresql://app_user:password@localhost:5432/smart_enterprise"

# Common issues:
# - Wrong password
# - User doesn't exist
# - Database doesn't exist
# - PostgreSQL not running
# - Firewall blocking port 5432
```

### 7.4 Permission Problems

#### File Permissions
```bash
# Fix application permissions
sudo chown -R www-data:www-data /var/www/smart-enterprise-suite
sudo chmod -R 755 /var/www/smart-enterprise-suite/backend/uploads

# Fix log permissions
sudo chown -R www-data:www-data /var/log/smart-enterprise

# Fix backup permissions
sudo chown -R $USER:$USER /var/backups/smart-enterprise
```

#### Database Permissions
```bash
# Grant necessary permissions
sudo -u postgres psql << EOF
GRANT ALL PRIVILEGES ON DATABASE smart_enterprise TO app_user;
\c smart_enterprise
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
EOF
```

### 7.5 Performance Optimization

#### Database Optimization
```sql
-- Analyze tables for query planner
ANALYZE;

-- Update statistics
VACUUM ANALYZE;

-- Check for missing indexes
SELECT 
    schemaname,
    tablename,
    attname as column,
    n_tup_read,
    n_tup_fetch
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY n_tup_read DESC;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_requests_status ON "MaintenanceRequest"(status);
CREATE INDEX IF NOT EXISTS idx_customers_branch ON "Customer"(branchId);
CREATE INDEX IF NOT EXISTS idx_machines_customer ON "PosMachine"(customerId);
```

#### Application Optimization
```bash
# Enable gzip compression in Nginx (already in config)

# Optimize PM2 settings
pm2 reload ecosystem.config.js --update-env

# Monitor memory usage
pm2 monit

# Check for memory leaks
pm2 logs | grep -i "memory"
```

#### System Optimization
```bash
# Increase file descriptor limits
sudo tee -a /etc/security/limits.conf << EOF
www-data soft nofile 65536
www-data hard nofile 65536
EOF

# Optimize kernel parameters
sudo tee -a /etc/sysctl.conf << EOF
# Increase max connections
net.core.somaxconn = 65535

# TCP optimizations
net.ipv4.tcp_max_syn_backlog = 65536
net.ipv4.tcp_tw_reuse = 1
EOF

sudo sysctl -p
```

---

## Appendix A: Quick Reference Commands

### Essential Commands
```bash
# Development
npm run dev          # Start development servers
npx prisma studio    # Open database GUI
npx prisma migrate dev --name <name>  # Create migration

# Production
pm2 start ecosystem.config.js --env production
pm2 logs
pm2 reload all
pm2 monit

# Docker
docker-compose up -d
docker-compose logs -f
docker-compose down

# Database
npx prisma migrate deploy
npx prisma db seed
pg_dump -h localhost -U app_user -d smart_enterprise > backup.sql

# Nginx
sudo nginx -t
sudo systemctl reload nginx
sudo tail -f /var/log/nginx/error.log

# SSL
sudo certbot --nginx -d yourdomain.com
sudo certbot renew --dry-run
```

### Environment Variables Quick Reference
| Variable | Development | Production |
|----------|-------------|------------|
| NODE_ENV | development | production |
| PORT | 5000 | 5000 |
| DATABASE_URL | file:./prisma/dev.db | postgresql://... |
| CORS_ORIGIN | http://localhost:5173 | https://yourdomain.com |
| LOG_LEVEL | debug | info |

---

## Appendix B: Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] SSL certificates obtained
- [ ] Backup strategy in place
- [ ] Monitoring configured

### Deployment
- [ ] Code deployed to server
- [ ] Dependencies installed
- [ ] Database migrated
- [ ] Environment variables set
- [ ] Application started (PM2)
- [ ] Nginx configured
- [ ] SSL configured
- [ ] Health checks passing

### Post-Deployment
- [ ] Smoke tests completed
- [ ] Logs reviewed for errors
- [ ] Monitoring alerts tested
- [ ] Backup jobs scheduled
- [ ] Documentation updated
- [ ] Team notified

---

**Document Information:**
- **Created:** 2026-01-31
- **Version:** 1.0.0
- **Next Review:** 2026-04-30
