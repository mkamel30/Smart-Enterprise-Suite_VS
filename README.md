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
