require('dotenv').config();

/**
 * Centralized configuration module
 * All environment variables and app configuration in one place
 */
module.exports = {
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',

  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || 'localhost',

  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/cs-dept',
    ssl: process.env.DATABASE_SSL === 'true'
  },

  // JWT & Auth
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },

  // CORS
  cors: {
    // Allow multiple origins (comma-separated). Default to Vite (5173) and CRA (3000) in dev.
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: process.env.CORS_CREDENTIALS !== 'false'
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
    prettyPrint: process.env.LOG_PRETTY !== 'false' && process.env.NODE_ENV === 'development'
  },

  // Rate limiting
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || ''
  },

  // File uploads
  uploads: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50MB
    allowedMimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
  },

  // Features
  features: {
    enableAI: process.env.ENABLE_AI !== 'false',
    enableBackup: process.env.ENABLE_BACKUP !== 'false'
  }
};
