# 🏢 Smart Enterprise Suite

A comprehensive **enterprise-grade business management system** for branch operations, maintenance management, inventory tracking, and real-time reporting.

**Built with:**  
- 🚀 **Express.js** (Node.js backend)
- ⚛️ **React + Vite + TailwindCSS** (Frontend)
- 📊 **Prisma ORM** (Database)
- 🔒 **Security-first architecture** with Role-Based Access Control

---

## 📋 Quick Links
- [🧑‍💻 System Architecture & Concepts](docs/ARCHITECTURE.md)
- [🛠️ Developer Implementation Guide](docs/IMPLEMENTATION_GUIDE.md)
- [🤖 Guidelines for AI Agents](AGENTS.md)
- *(Note: Legacy analysis & design docs are archived in `docs/archive/`)*

---

## 🚀 Quick Start & Run

```bash
# To run both Backend and Frontend simultaneously (Windows):
start_dev.bat
```

### Or Run Manually:

**Terminal 1 - Backend:**
```bash
cd backend
npm install
# If schema changes exist, run: npx prisma generate
node server.js
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Endpoints:**
*   Frontend UI: `http://localhost:5174`
*   Backend API: `http://localhost:5000/api` (or `5002` based on `.env`)

---

## ✨ Core Features

1. **Multi-branch & Customers** - Manage unlimited business branches, clients, and POS machine assignments.
2. **Maintenance Workflows** - Create, assign to technicians, track lifecycle, and close maintenance orders.
3. **Inventory & Warehouse** - Track spare parts, SIM cards, and log all inwards/outwards movements.
4. **Real-Time System** - Socket.IO pushes live notifications for maintenance updates and low stock alerts.
5. **Dashboard & Accounting** - Monitor debt, sales, parts consumption, and technician KPI rankings.

If you encounter any issues during local development or testing, please consult the `IMPLEMENTATION_GUIDE.md`.
