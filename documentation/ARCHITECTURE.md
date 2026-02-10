# System Architecture (Technical Specification)

**Last Updated**: February 10, 2026  
**Status**: ✅ v3.4.0 — Comprehensive Review + Security & Performance Fixes

This document outlines the technical design principles and architectural patterns used in the CS-Dept-Console.

## 1. Tech Stack
- **Frontend**: React 18 (Vite), TypeScript, Tailwind CSS, Framer Motion (Animations), TanStack Query (State & Caching).
- **Backend**: Node.js, Express.js, Prisma ORM.
  - **Security**: Helmet.js, express-rate-limit (global + login-specific), CORS, additional security headers (no-cache on auth, XSS protection)
  - **Validation**: Zod schemas with custom middleware + Transfer validators (v3.1.0)
  - **Logging**: Pino (structured JSON logging) + pino-http
  - **Documentation**: Swagger/OpenAPI (available at /api-docs)
  - **Error Handling**: 6 custom error classes + global error middleware
  - **Testing**: Jest with integration test patterns
  - **Transfer Protection**: Comprehensive validation system for inter-branch transfers
- **Database**: SQLite (WAL Mode enabled for concurrent performance).
- **Storage**: Local filesystem for backups and Excel imports.

## 2. Design Patterns

### 2.1 Backend: Service-Oriented Architecture (SOA)
We have successfully transitioned from "Fat Routes" to a clean Service Layer:
- **Routes**: Handle HTTP concerns (auth, query parsing, response formatting).
  - Enhanced with asyncHandler wrapper (eliminates try/catch boilerplate)
  - Zod validation middleware for input sanitization
  - Swagger JSDoc annotations for auto-generated API docs
  - Status change protection (blocks manual IN_TRANSIT status)
- **Services**: Handle business logic, validation, and multi-step Prisma transactions.
  - **transferService.js**: Enhanced with comprehensive validation (v3.1.0)
  - Auto-freeze items during transfer creation
  - Integration with validation utilities
- **Middleware Stack** (13 phases complete):
  - **Security**: Helmet.js (security headers) + additional security headers (XSS, no-cache), Rate Limiting (global API + stricter login limiter)
  - **Logging**: pino-http (structured HTTP logging), custom logger methods
  - **Authentication**: JWT token validation (authenticateToken)
  - **Authorization**: Role-Based Access Control (checkPermissions)
  - **Validation**: Zod schema validation middleware
  - **Error Handling**: Global error handler with custom error classes
- **Utilities**:
  - Custom error classes: ValidationError, NotFoundError, ForbiddenError, ConflictError, UnauthorizedError, AppError (consolidated in `errorHandler.js`)
  - **Shared Constants** (`utils/constants.js`): Single source of truth for `ROLES`, `GLOBAL_ROLES`, `BRANCH_TYPES`, `MACHINE_STATUS`, `REQUEST_STATUS`, `TRANSFER_STATUS` with helper functions (`isGlobalRole()`, `isCenterRole()`, `isPrivilegedRole()`)
  - Structured logger with methods: logger.http(), logger.db(), logger.event(), logger.security(), logger.metric()
  - Configuration module: Centralized environment variables
  - Health checks: /health (simple), /api/health (detailed with DB check)
  - **Transfer validators** (v3.1.0): `backend/utils/transfer-validators.js`
    - `validateItemsForTransfer()`: Comprehensive item validation
    - `validateBranches()`: Branch validation and compatibility
    - `validateUserPermission()`: Permission checks
    - `validateTransferOrder()`: Complete orchestration

### 2.2 Frontend: Modular Architecture & Custom Hooks
The frontend follows a "Data-UI Separation" strategy to maintain high performance and readability:
- **Data Orchestration (Hooks)**: Complex state, fetching, and business logic are extracted into custom hooks (e.g., `useCustomerData.ts`).
- **Lean Containers**: Page components (e.g., `Customers.tsx`) act as lean orchestrators, delegating UI to specialized sub-components.
- **Component Decomposition**: Large UI blocks are decomposed into granular, focused components (e.g., `CustomerStats.tsx`, `CustomerDetailTabs.tsx`) to improve maintainability and testability.
- **Global API Client**: All network interactions are centralized in `frontend/src/api/client.ts`.
- **UI Primitive Layer**: Shared components (Buttons, Modals, Inputs) are standardized in `frontend/src/components/ui`.

## 3. Data Isolation Protocol (Multitenancy)
The system uses "Soft Isolation" via `branchId`. 
- Every entity (except global settings) contains a `branchId`.
- The `authenticateToken` middleware populates `req.user.branchId`.
- Queries are automatically filtered based on this ID unless the user has a `bypass` role (like `SUPER_ADMIN`).

## 4. Movement Logging (Audit Trail)
All critical inventory changes are logged in two ways:
1. **`SystemLog`**: High-level action tracking (User X did Action Y on Entity Z).
2. **`MovementLog`**: Technical detail tracking (Serial # moved from Branch A to Branch B).

## 5. Transactional Integrity
Critical workflows (like Bulk Transfers or Maintenance Closures) are wrapped in **Prisma Transactions**. This ensures that multiple database operations (e.g., creating a Transfer Order and updating Machine statuses) either all succeed or all fail together, maintaining system consistency.

## 6. Executive Analytics Layer (Strategic Intelligence)
A dedicated reporting layer designed for management:
- **Financial Aggregation**: Real-time sales, collections, and debt monitoring.
- **Branch Performance Comparison**: Dynamic ranking systems.
- **Trend Analysis**: 6-month historical growth tracking for inventory and sales.
- **Parallel Query Execution**: All independent analytics queries run via `Promise.all()` for optimal latency.
- **Fail-Safe Design**: Components use defensive programming to handle missing or delayed API data without crashing.

---

## 🏛️ Guiding Principles (The Soul)
Our development is governed by three core philosophical pillars:

1.  **Max Reliability**: We prioritize data integrity above all. This is why we use dual logging (`SystemLog` and `MovementLog`) and strict Prisma transactions.
2.  **Developer Velocity**: The system is built to be extended. We use a standardized Service Layer and shared API hooks to ensure that adding a new feature is fast and safe.
3.  **Predictability**: If a developer understands how one API endpoint or component works, they should be able to predict how the rest of the system behaves.

---

## 🧠 Decision Rationales (The "Why")

### Why SQLite + WAL Mode?
**Rationale**: For an on-premise system in a local branch network, SQLite offers zero-configuration deployment and simple file-based backups. **Write-Ahead Logging (WAL)** is enabled to allow concurrent reads and writes, solving the "Database Locked" issues common in SQLite while maintaining local performance.

### Why Service Layer?
**Rationale**: Moving logic out of controllers into a `Service Layer` separates the "HOW" (Prisma queries) from the "WHAT" (HTTP Routes). This makes the code unit-testable and allows multiple routes to reuse the same complex business logic.

### Why soft Isolation (`branchId`)?
**Rationale**: Instead of multiple databases, we use a shared schema with strict `branchId` filtering. This allows for easy aggregate reporting for management while ensuring that branch users are logically isolated to their own data scope.

---

## ☁️ Cloud Readiness & Database Migration Guide

The system is designed to be "DB-Agnostic" thanks to Prisma ORM. While we currently use SQLite for local speed and simplicity, transitioning to a production-grade **PostgreSQL** instance is straightforward.

### Migration Steps:

1.  **Environment Variables**:
    Update `backend/.env` to point to your Postgres instance:
    ```env
    # From:
    DATABASE_URL="file:./dev.db"
    # To:
    DATABASE_URL="postgresql://user:password@localhost:5432/cs_console?schema=public"
    ```

2.  **Schema Update**:
    In `prisma/schema.prisma`, change the provider:
    ```prisma
    datasource db {
      provider = "postgresql" // Was "sqlite"
      url      = env("DATABASE_URL")
    }
    ```

3.  **Regenerate & Migrate**:
    Run these commands to initialize the new database structure:
    ```bash
    npx prisma generate
    npx prisma migrate dev --name init_postgres
    ```

4.  **Security Note**: When moving online, ensure the `JWT_SECRET` is changed to a complex string and stored in a secure environment manager (like AWS Secrets Manager or GitHub Secrets).

### 🐳 Containerization
For multi-node deployments, the project includes a `docker-compose.yml` to spin up the Backend, Frontend, and PostgreSQL database with a single command:
```bash
docker-compose up --build
```

---

## 🚀 Future Evolution (Roadmap)
The system is architected for growth. Key future milestones include:
- **Centralized Cloud Hub**: Transitioning from fragmented local instances to a single, high-availability PostgreSQL cluster.
- **Advanced Power BI Integration**: Already partially implemented via the **Executive Analytics Dashboard**; future work involves deep cross-branch trend forecasting.
- **Mobile Technician Portal**: Lightweight interface for field technicians using the existing Service Layer.
- **AI-Powered Diagnostics**: Integrating diagnostic assistance for complex machine repairs based on history.

---

## 🎨 User Personalization & Experience
Dedicated support for accessibility and user preference:
- **Prisma Schema**: `User` model includes `theme` and `fontFamily`.
- **Global Context**: Local preferences (Light/Dark mode) are synced from the DB and applied at the `App.tsx` level using a persistent font-variable and Tailwind CSS `dark` class.
- **Executive Overview**: `SUPER_ADMIN` receives a summarized system view (Global performance vs Branch performance) powered by the `admin-summary` API.

---

## 📚 Related Documentation

### Detailed Architecture & Database Documentation

For comprehensive technical architecture details, refer to the **[project-analysis/](../project-analysis/)** documentation:

#### System Architecture
- **[13-system-architecture.md](../project-analysis/13-system-architecture.md)** - Complete system architecture with:
  - High-level architecture diagrams with all component layers
  - Deployment architecture (single-server and scaled)
  - Data flow architecture and request lifecycle
  - Security architecture with multi-layer security model
  - Service interactions and transaction boundaries
  - Technology stack by layer (Frontend, Backend, Database, DevOps)

#### Database Documentation
- **[01-database-erd.md](../project-analysis/01-database-erd.md)** - Complete Entity Relationship Diagrams showing:
  - All 27 interconnected database models
  - Entity groups: Organization & Users, Customer & Assets, Maintenance Workflow, Inventory Management, Warehouse & Assets, Sales & Financials, Transfer System
  - Visual Mermaid diagrams for all major entity relationships
  - Detailed field specifications for each model

#### Additional Technical References
- **[02-database-schema-reference.md](../project-analysis/02-database-schema-reference.md)** - Detailed schema reference for all 19 models
- **[03-database-query-patterns.md](../project-analysis/03-database-query-patterns.md)** - Complex query patterns and branch isolation
- **[04-database-optimization.md](../project-analysis/04-database-optimization.md)** - Database performance optimization recommendations
- **[14-deployment-guide.md](../project-analysis/14-deployment-guide.md)** - Complete deployment and infrastructure guide

---

*This document is a living document and should be updated as the architecture evolves.*
