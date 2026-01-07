# Smart Enterprise Suite
## نظام إدارة ذكي للفروع والصيانة

**Smart Enterprise Suite** is a modern, intelligent branch and maintenance management system for POS machines with real-time notifications, user preferences, and comprehensive workflow automation.

نظام متكامل وذكي لإدارة طلبات صيانة ماكينات نقاط البيع (POS) مع إشعارات فورية وإعدادات مستخدم متقدمة.

---

> [!IMPORTANT]
> **New Developer?** Start with our **[documentation/_START_HERE.md](file:///e:/Programming/CS_under%20DEvelopment/CS-Dept-Console/documentation/_START_HERE.md)** guide to find your documentation path.

---

## 🚀 التشغيل / Quick Start

```bash
# تشغيل الباك اند والفرونت اند معًا / Run backend and frontend together
start_dev.bat

# أو يدويًا / Or manually:
# Terminal 1 - Backend
cd backend && node server.js

# Terminal 2 - Frontend
cd frontend && npm run dev
```

**الروابط:**
- Frontend: http://localhost:5174
- Backend API: http://localhost:5000/api

---

## 📁 هيكل المشروع

```
CS-Dept-Console/
├── backend/           # Node.js/Express API
│   ├── routes/        # API routes
│   ├── server.js      # Main server
│   └── .env           # Database config
├── frontend/          # Vite + React
│   ├── src/
│   │   ├── pages/     # App pages
│   │   ├── api/       # API client
│   │   └── components/
│   └── .env           # API URL config
├── prisma/            # Database schema
│   ├── schema.prisma
│   └── dev.db         # SQLite database
└── start_dev.bat      # Start script
```

---

## 📋 الميزات

### العملاء
- عرض وإدارة العملاء
- بيانات الفروع والماكينات

### طلبات الصيانة
- إنشاء طلب جديد (مع خيار استلام الماكينة في مخزن الفرع)
- تحويل الماكينات جماعياً لمركز الصيانة برقم بوليصة
- تعيين فني وإغلاق الطلب مع قطع الغيار
- طباعة تقارير الصيانة والاستلام

### الفنيين
- إدارة المستخدمين
- استيراد/تصدير Excel

### المخزن
- تتبع كميات قطع الغيار
- سجل حركة الدخول والخروج
- استيراد الكميات من Excel

### الإحصائيات والتقارير الاستراتيجية [جديد]
- لوحة تحكم الإدارة العليا (Executive Dashboard)
- مراقبة المبيعات والتحصيلات والديون لحظياً
- مقارنة أداء الفروع وترتيبها (Rankings)
- تحليل توجهات المخزون والمبيعات (Charts)

### الإعدادات والصلاحيات
- بارامترات الماكينات وقانون قطع الغيار
- نظام متقدم لإدارة الصلاحيات (Permissions Matrix) من واجهة المستخدم
- تخصيص المظهر (Dark/Light) والخطوط العربية لكل مستخدم

---

## 🛠 التقنيات

- **Backend:** Node.js, Express, Prisma ORM
- **Frontend:** React, Vite, TailwindCSS, React Query
- **Database:** SQLite

---

## 📦 التثبيت

```bash
# Backend
cd backend
npm install
npx prisma generate

# Frontend
cd frontend
npm install
```
# 🏢 Smart Enterprise Suite

A comprehensive **enterprise-grade business management system** for branch operations, maintenance management, inventory tracking, and real-time reporting.

**Built with:**  
- 🚀 Express.js (Node.js backend)
- ⚛️ React + TypeScript (Frontend)
- 📊 PostgreSQL (Database)
- 🔒 Security-first architecture

---

## 📋 Table of Contents

1. [Features](#-features)
2. [Requirements](#-requirements)
3. [Installation](#-installation)
4. [Configuration](#-configuration)
5. [Running the Application](#-running-the-application)
6. [Project Structure](#-project-structure)
7. [API Documentation](#-api-documentation)
8. [Development](#-development)
9. [Deployment](#-deployment)
10. [Troubleshooting](#-troubleshooting)
11. [Contributing](#-contributing)
12. [Support](#-support)

---

## ✨ Features

### Core Features
- **Multi-branch management** - Support for multiple business branches with isolated data
- **Customer management** - Complete customer information with machine inventory
- **Maintenance tracking** - Request creation, assignment, completion tracking
- **Inventory management** - POS machines and SIM cards tracking
- **Real-time notifications** - Socket.IO powered live updates
- **User management** - Role-based access control (RBAC)
- **Audit logging** - Complete audit trail of all system operations
- **Mobile responsive** - Works on desktop, tablet, and mobile devices

### Advanced Features
- **Excel import/export** - Bulk data operations with validation
- **Advanced reporting** - Custom dashboards and statistics
- **Automated backups** - Scheduled database backups
- **API documentation** - Auto-generated Swagger/OpenAPI docs
- **System health monitoring** - Real-time system status
- **Rate limiting** - API rate limiting and DDoS protection
- **Data validation** - Comprehensive input validation with Zod
- **Error handling** - Standardized error responses across API

---

## 💻 Requirements

### System Requirements
- **Operating System**: Windows 10+, macOS 10.14+, or Linux
- **RAM**: Minimum 4GB, recommended 8GB+
- **Disk Space**: Minimum 5GB free space

### Software Requirements
- **Node.js**: v16.0.0 or higher ([Download](https://nodejs.org/))
- **npm**: v7.0.0 or higher (comes with Node.js)
- **PostgreSQL**: v12.0 or higher ([Download](https://www.postgresql.org/))
- **Git**: v2.0 or higher (for version control)

### Optional Requirements
- **Redis**: For distributed caching (recommended for production)
- **Docker**: For containerized deployment

---

## 🚀 Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/mkamel30/Smart-Enterprise-Suite_VS.git
cd Smart-Enterprise-Suite_VS
