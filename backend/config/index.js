require('dotenv').config();

const config = {
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Server
  port: parseInt(process.env.PORT, 10) || 5000,
  host: process.env.HOST || 'localhost',

  // Database
  database: {
    url: process.env.DATABASE_URL || 'file:./dev.db'
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiry: process.env.JWT_EXPIRY || '24h'
  },

  // CORS
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
    credentials: process.env.CORS_CREDENTIALS === 'true'
  },

  // Uploads
  uploads: {
    maxFileSize: process.env.MAX_FILE_SIZE || '10mb',
    uploadDir: process.env.UPLOAD_DIR || './uploads'
  },

  // Rate Limiting
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 2000
  },

  // Security
  security: {
    cookieSecret: process.env.COOKIE_SECRET,
    helmetEnabled: process.env.HELMET_ENABLED !== 'false',
    csrfEnabled: process.env.CSRF_ENABLED !== 'false'
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log'
  },

  // URLs
  urls: {
    api: process.env.API_URL || 'http://localhost:5000',
    frontend: process.env.FRONTEND_URL || 'http://localhost:5173'
  },

  // Backup
  backup: {
    enabled: process.env.BACKUP_ENABLED !== 'false',
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *',
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 30
  }
};

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'COOKIE_SECRET'];

if (config.isProduction) {
  requiredEnvVars.push('DATABASE_URL', 'API_URL');
}

const missingVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);

if (missingVars.length > 0) {
  console.error(
    `â‌Œ Missing required environment variables: ${missingVars.join(', ')}`
  );
  if (config.isProduction) {
    process.exit(1);
  }
}

module.exports = config;
