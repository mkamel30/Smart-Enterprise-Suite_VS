# 🏢 Smart Enterprise Suite (Branch Version)

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
- 🚀 **[Admin Portal Repository (Separate)](https://github.com/mkamel30/SmartEnterprise_AD)**

---

> [!IMPORTANT]
> **Note:** The Central Admin Portal has been moved to its own repository for better deployment and maintenance. You can find it here: [SmartEnterprise_AD](https://github.com/mkamel30/SmartEnterprise_AD).

## 🚀 Quick Start & Run (Branch App)

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
*   Frontend UI: `http://localhost:5173`
*   Backend API: `http://localhost:5002`

---

## ✨ Core Features

1. **Multi-branch & Customers** - Manage local business branches, clients, and POS machine assignments.
2. **Maintenance Workflows** - Create, assign to technicians, track lifecycle, and close maintenance orders.
3. **Inventory & Warehouse** - Track spare parts, SIM cards, and log all inwards/outwards movements.
4. **Real-Time System** - Socket.IO (Local) pushes live notifications for maintenance updates.
5. **Admin Sync** - Bidirectional communication with the Central Admin via WebSockets.

If you encounter any issues during local development or testing, please consult the `IMPLEMENTATION_GUIDE.md`.
