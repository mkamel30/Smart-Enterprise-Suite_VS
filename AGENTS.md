# Smart Enterprise Suite - AI Agent Guidelines

Welcome to the Smart Enterprise Suite. This document provides critical pathing and rules for AI Coding Agents.

## 🏗️ Project Structure
- **Backend (`/backend`)**: Node.js + Express REST API. Uses Prisma ORM with SQLite (WAL mode).
  - Main Entry: `backend/server.js`
  - Routes: `backend/src/modules/*/*.routes.js`
  - Services: `backend/src/modules/*/*.service.js`
  - Module loader: `backend/src/modules/index.js`
  - Database: `backend/prisma/schema.prisma`
  - Security extension: `backend/prisma/extensions.js`
- **Frontend (`/frontend`)**: React + Vite + Tailwind CSS.
  - Main App: `frontend/src/App.tsx`
  - Routes/Pages: `frontend/src/pages/*.tsx`
  - API Client: `frontend/src/api/client.ts`

## 🚨 Critical Rules for AI Agents
1. **Never edit `.log`, `.txt`, or database dump files**. They have been moved to `backend/tests/logs/` and `backend/tests/dumps/`. Do not clutter the root directories.
2. **Environment Variables**: Always assume `.env` exists locally. Do not commit secrets.
3. **Database Changes**: If you modify `schema.prisma`, you MUST run `npx prisma generate` in the `backend/` directory. If applying to the DB, use `npx prisma db push` or create a migration.
4. **Testing**: 
   - Backend tests must be run using `npm run test` inside the `/backend` directory.
   - For backend manual script checks, use scripts in `/backend/ops/scripts/`.
5. **Code Style**:
   - Frontend: Use Radix UI primitives and Tailwind CSS. Prefer functional components and hooks.
   - Backend: Use `asyncHandler` for all Express routes. Validate inputs before hitting Prisma.
6. **Documentation**: Keep explanations concise. Do not recreate `.md` files outside this core set (`README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_GUIDE.md`).
