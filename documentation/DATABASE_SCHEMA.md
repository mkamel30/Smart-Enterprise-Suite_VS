# Smart Enterprise Suite - Database Schema Documentation

**Version:** 3.2.0  
**Last Updated:** January 31, 2026  
**Database:** SQLite (Development) / PostgreSQL (Production)  
**ORM:** Prisma

---

## Overview

This document provides an overview of the Smart Enterprise Suite database schema. The system uses Prisma ORM with SQLite for development and PostgreSQL for production deployments.

---

## 📚 Related Documentation

### Comprehensive Database Documentation

For detailed database documentation, refer to the **[project-analysis/](../project-analysis/)** documentation:

#### Database Design & Structure
- **[01-database-erd.md](../project-analysis/01-database-erd.md)** - Complete Entity Relationship Diagrams:
  - **27 interconnected database models** with visual Mermaid diagrams
  - Complete ERD showing all entity relationships
  - 7 entity groups: Organization & Users, Customer & Assets, Maintenance Workflow, Inventory Management, Warehouse & Assets, Sales & Financials, Transfer System
  - Detailed field specifications for each model
  - Self-referential relationships (Branch hierarchy)
  - Foreign key mappings and constraints

- **[02-database-schema-reference.md](../project-analysis/02-database-schema-reference.md)** - Detailed schema reference:
  - Complete documentation for all **19 database models**
  - Field types, constraints, and default values
  - Index definitions and unique constraints
  - Model relationships and foreign keys
  - Enum definitions and valid values
  - Table: User, Branch, Customer, PosMachine, SimCard, MachineParameter, SparePart, InventoryItem, MaintenanceRequest, TransferOrder, TransferOrderItem, PriceChangeLog, UsedPartLog, StockMovement, Payment, MachineMovementLog, SystemLog, MaintenanceApproval, RepairVoucher

#### Database Patterns & Optimization
- **[03-database-query-patterns.md](../project-analysis/03-database-query-patterns.md)** - Complex query patterns and implementation:
  - **Branch isolation patterns** - How data is filtered by branch for multi-tenancy
  - `ensureBranchWhere` helper function documentation
  - Transaction safety patterns for multi-step operations
  - Batch query patterns to avoid N+1 queries
  - Complex aggregation queries with examples
  - Prisma middleware usage patterns
  - Query optimization strategies

- **[04-database-optimization.md](../project-analysis/04-database-optimization.md)** - Performance optimization recommendations:
  - **Missing indexes** on high-traffic queries (60-85% performance improvement)
  - Query performance analysis and bottlenecks
  - Memory usage optimization (40-50% reduction)
  - Connection pooling recommendations
  - Dashboard query optimization (70% load time reduction)
  - Specific index recommendations for WarehouseMachine, Customer, MaintenanceRequest, Payment, and TransferOrder tables

#### Migration & Deployment
- **[14-deployment-guide.md](../project-analysis/14-deployment-guide.md)** - Database migration and deployment:
  - SQLite to PostgreSQL migration guide
  - Prisma migration workflows
  - Database backup and recovery procedures
  - Production database configuration
  - Docker database containerization

---

## Key Schema Characteristics

### Multi-Tenant Architecture
- **Branch Isolation**: Every entity (except global settings) contains a `branchId` field
- **Soft Isolation**: Data is filtered by `branchId` rather than separate databases
- **Super Admin Access**: `SUPER_ADMIN` role can bypass branch filtering for aggregate reporting

### Core Entity Groups
1. **Organization & Users**: Branch hierarchy, User management, Role permissions
2. **Customer & Assets**: Customer profiles, POS Machines, SIM Cards
3. **Maintenance Workflow**: Requests, Approvals, Repair Vouchers, Used Parts
4. **Inventory Management**: Spare Parts, Inventory Items, Stock Movements
5. **Warehouse & Assets**: Warehouse Machines, SIMs, Movement Logs
6. **Sales & Financials**: Machine Sales, Installments, Payments
7. **Transfer System**: Transfer Orders between branches

### Data Integrity
- **Audit Logging**: All critical changes logged in `SystemLog` and `MovementLog`
- **Transactions**: Multi-step operations wrapped in Prisma transactions
- **Foreign Keys**: Proper referential integrity with cascading rules
- **Validation**: Zod schemas validate data before database operations

---

*For backend architecture details, see [ARCHITECTURE.md](./ARCHITECTURE.md)*
*For system data flow, see [SYSTEM_BLUEPRINT.md](./SYSTEM_BLUEPRINT.md)*
