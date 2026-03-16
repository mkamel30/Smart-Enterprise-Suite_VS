# Task Checklist - Central Admin Portal (SmartEnterprise_Admin)

## Phase 1: الأساسيات والهيكل (Scaffold)
- [/] إعداد هيكل المشروع (Backend + Frontend)
- [x] إعداد قاعدة البيانات (Prisma + SQLite)
- [x] إعداد نظام التوثيق (Central Admin Auth)
- [ ] بناء الهيكل الأساسي للـ Layout والـ Sidebar

## Phase 2: إدارة الفروع (Branch Management)
- [x] نموذج بيانات الفروع (Branch Registry)
- [x] واجهة إضافة وتفعيل الفروع (Backend Endpoints)
- [ ] إدارة مفاتيح الـ API (API Keys) لكل فرع
- [ ] تتبع حالة الاتصال (Online/Offline Status)

## Phase 3: المزامنة والإعدادات المركزية (Sync & Global Settings)
- [x] نظام الـ Parameters المركزي (أسعار، إعدادات عامة)
- [/] API لتزويد الفروع بالإعدادات (Polling Endpoint)
- [ ] واجهة تحرير الـ Parameters المركزية

## Phase 4: لوحة التحكم العليا (Executive Dashboard & Aggregation)
- [ ] استقبال التقارير الدورية من الفروع
- [ ] واجهة التقارير المجمعة (Sales, Machines, Stock)
- [ ] الرسوم البيانية للمقارنة بين الفروع

## Phase 5: إدارة الإصدارات والنسخ الاحتياطية (Releases & Backup)
- [ ] موديول رفع الإصدارات (GitHub Releases Proxy/Manager)
- [ ] استقبال وتخزين النسخ الاحتياطية من الفروع (Backup Aggregator)
- [ ] سجل الأحداث المركزي (Central Audit Logs)

## Phase 6: التأمين والنشر
- [ ] تأمين اتصال الـ Portal <=> Branch عبر tokens
- [ ] إعدادات النشر على Cloud/VPS
- [ ] وثيقة التشغيل النهائية
