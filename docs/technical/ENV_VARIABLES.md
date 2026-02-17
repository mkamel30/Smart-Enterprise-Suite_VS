# Environment Variables Guide

This document lists all environment variables used in the Smart Enterprise Suite backend.
Configure these variables in your `.env` file (copy from `.env.example`).

## Required Variables

These variables **MUST** be set for the application to function correctly.

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Connection string for the database | `postgresql://user:pass@localhost:5432/db` or `file:./dev.db` |
| `JWT_SECRET` | Secret key for signing JSON Web Tokens. Must be a long, random string. | `d8e8fca2dc0f896...` |
| `COOKIE_SECRET` | Secret key for signing cookies. Must be a long, random string. | `9a7d8c6e5b4f3a2...` |

## Server Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode (`development`, `production`, `staging`) | `development` |
| `PORT` | Port the server listens on | `5000` |
| `HOST` | Hostname to bind to | `localhost` |
| `API_URL` | Full URL of the backend API | `http://localhost:5000` |
| `FRONTEND_URL` | Full URL of the frontend application (for CORS) | `http://localhost:5173` |

## Security

| Variable | Description | Default |
|----------|-------------|---------|
| `CORS_ORIGIN` | Comma-separated list of allowed origins | `http://localhost:5173` |
| `CORS_CREDENTIALS` | Allow credentials (cookies) in CORS | `true` |
| `JWT_EXPIRY` | Token expiration time | `24h` |
| `HELMET_ENABLED` | Enable Helmet security headers | `true` |
| `CSRF_ENABLED` | Enable CSRF protection | `true` |

## Rate Limiting

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_WINDOW_MS` | Time window for rate limiting in ms | `900000` (15m) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `2000` |

## External Services

| Variable | Description | Required? |
|----------|-------------|-----------|
| `OPENROUTER_API_KEY` | API key for OpenRouter AI services | Optional (for AI features) |
| `OPENAI_API_KEY` | API key for OpenAI | Optional |
| `SMTP_HOST` | SMTP server host | Optional (for email) |
| `SMTP_USER` | SMTP username | Optional |
| `SMTP_PASSWORD` | SMTP password | Optional |

## Backup Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `BACKUP_ENABLED` | Enable automatic backups | `true` |
| `BACKUP_SCHEDULE` | Cron schedule for backups | `0 2 * * *` (2 AM) |
| `BACKUP_RETENTION_DAYS` | Days to keep backups | `30` |

## Logging

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging verbosity (`error`, `warn`, `info`, `debug`) | `info` |

---

### How to Generate Secrets

For `JWT_SECRET` and `COOKIE_SECRET`, generating a cryptographically secure random string is recommended:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
