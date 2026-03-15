# Smart Enterprise Suite - Implementation Guide

This document outlines the development, testing, and operational workflows for the system.

## 1. Local Development
*   **Backend**: Run from `backend/` using `node server.js` or `npm run dev` (if nodemon is configured). 
*   **Frontend**: Run from `frontend/` using `npm run dev`. It connects to the backend API (`http://localhost:5000/api` or `5002` as configured in `.env`).

## 2. Testing Protocol
*   **Backend Tests**: We use Jest for backend integrity and API tests.
    *   `cd backend`
    *   `npm run test`
    *   Logs and dumps from tests are strictly written to `backend/tests/logs/` and `backend/tests/dumps/`.
*   **Admin / Ops Scripts**: Dedicated scripts for database checking, fixing roles, or toggling MFA are located in `backend/ops/scripts/`. Run them via Node from the `backend/` directory.

## 3. Database Management (Prisma)
*   Whenever `schema.prisma` is modified, you must regenerate the client:
    `npx prisma generate`
*   To synchronize changes locally without full migrations:
    `npx prisma db push`

## 4. Deployment
*   The application is containerized using Docker. Refer to the `docker-compose.yml` file in the root directory for orchestrating the frontend and backend services.
*   Production environments should use PostgreSQL instead of SQLite. Ensure `DATABASE_URL` in `.env` is updated appropriately before building.
