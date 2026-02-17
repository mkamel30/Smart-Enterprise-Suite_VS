# Security Guide

This document outlines the security measures implemented in the Smart Enterprise Suite and provides guidelines for maintaining a secure environment.

## 1. Authentication & Authorization

### JWT (JSON Web Tokens)
- **Mechanism**: We use JWTs for stateless authentication.
- **Storage**: Tokens should be stored securely on the client side (e.g., HTTPOnly cookies or local storage with caution).
- **Expiration**: Standard token expiry is set to 24 hours (`JWT_EXPIRY`).
- **Rotation**: Recommend implementing short-lived access tokens and refresh tokens for higher security.
- **Secret Management**: The `JWT_SECRET` must be a strong, random string (min 64 chars) and kept secret.

### Password Security
- **Hashing**: All passwords are hashed using `bcrypt` before storage.
- **Salting**: Automatic checks are handled by hashing library.
- **Complexity**: Enforce minimum password length (8 chars) and complexity requirements on the frontend and backend.

## 2. Secrets Management

- **Environment Variables**: NO secrets (API keys, passwords, tokens) should ever be committed to the code repository.
- **.env File**: Use a `.env` file for local development.
- **Production Secrets**: In production, use your platform's secret management system (e.g., Docker Secrets, AWS Secrets Manager, or strictly controlled environment variables).
- **Leak Prevention**: Regular scans using tools like `git-secrets` or `trufflehog` are recommended.

## 3. Network Security

### HTTPS
- **Production Requirement**: The application must run over HTTPS in production.
- **SSL/TLS**: Ensure valid certificates are installed (e.g., via Let's Encrypt).
- **HSTS**: HTTP Strict Transport Security headers are enabled by default via Helmet.

### CORS (Cross-Origin Resource Sharing)
- **Configuration**: Strictly limit `CORS_ORIGIN` to trusted frontend domains.
- **Wildcards**: Do NOT use `*` for allow-origin in production if credentials are allowed.

### Rate Limiting
- **DoS Protection**: API rate limiting is implemented (`express-rate-limit`) to prevent abuse.
- **Configuration**: Default is 2000 requests per 15 minutes. Adjust based on traffic needs.

## 4. Input Validation & Injection Prevention

### SQL Injection
- **Prisma ORM**: We use Prisma ORM which automatically parameterizes queries, protecting against SQL injection.
- **Raw SQL**: If `queryRaw` is used, ensure manual parameterization is strictly followed.

### XSS (Cross-Site Scripting)
- **Data Sanitization**: Sanitize user inputs before rendering.
- **React**: React automatically escapes content, preventing most XSS attacks.
- **Headers**: `Helmet` sets appropriate Content Security Policy (CSP) headers.

## 5. Deployment Checklist

Before deploying to production, verify:
- [ ] `NODE_ENV` is set to `production`.
- [ ] All default secrets (JWT, Cookie) are changed to new secure random values.
- [ ] Debug logging is disabled.
- [ ] `CORS_ORIGIN` is updated to the production frontend URL.
- [ ] Database user has least-privilege access.
- [ ] SSL is correctly configured.

## 6. Incident Response

If a security breach is suspected:
1. **Rotate Secrets**: Immediately change `JWT_SECRET`, database passwords, and API keys.
2. **Revoke Sessions**: Invalidate all active tokens (requires token blacklist implementation if not stateless).
3. **Audit Logs**: Check application logs for suspicious activity.
4. **Patch**: Apply necessary security patches.
