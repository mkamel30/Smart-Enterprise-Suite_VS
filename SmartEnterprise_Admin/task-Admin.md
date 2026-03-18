# Task Checklist - Central Admin Portal (SmartEnterprise_Admin)

## Phase 1: الأساسيات والهيكل (Scaffold)
- [x] إعداد هيكل المشروع (Backend + Frontend)
- [x] إعداد قاعدة البيانات (Prisma + SQLite)
- [x] إعداد نظام التوثيق (Central Admin Auth)
- [x] بناء الهيكل الأساسي للـ Layout والـ Sidebar

## Phase 2: إدارة الفروع (Branch Management)
- [x] نموذج بيانات الفروع (Branch Registry)
- [x] واجهة إضافة وتفعيل الفروع (Backend Endpoints)
- [x] إدارة مفاتيح الـ API (API Keys) لكل فرع
- [x] تتبع حالة الاتصال (Online/Offline Status)

## Phase 3: المزامنة والإعدادات المركزية (Sync & Global Settings)
- [x] نظام الـ Parameters المركزي (أسعار، إعدادات عامة)
- [x] API لتزويد الفروع بالإعدادات (Polling Endpoint)
- [x] واجهة تحرير الـ Parameters المركزية

## Phase 4: لوحة التحكم العليا (Executive Dashboard & Aggregation)
- [x] استقبال التقارير الدورية من الفروع
- [x] واجهة التقارير المجمعة (Sales, Machines, Stock)
- [x] الرسوم البيانية للمقارنة بين الفروع

## Phase 5: إدارة الإصدارات والنسخ الاحتياطية (Releases & Backup)
- [ ] موديول رفع الإصدارات (GitHub Releases Proxy/Manager)
- [ ] استقبال وتخزين النسخ الاحتياطية من الفروع (Backup Aggregator)
- [ ] سجل الأحداث المركزي (Central Audit Logs)

## Phase 6: التأمين والنشر
- [ ] تأمين اتصال الـ Portal <=> Branch عبر tokens
- [ ] إعدادات النشر على Cloud/VPS
- [ ] وثيقة التشغيل النهائية

## Phase 7: المزامنة اللحظية (Bidirectional WebSocket Sync)
- [ ] هيكل الـ `SyncQueue` في قاعدة بيانات الأدمن لمراقبة التحديثات لكل فرع.
- [ ] تثبيت وإعداد `socket.io` في الأدمن و `socket.io-client` في الفرع.
- [ ] إرسال التحديثات (الإعدادات، قطع الغيار، الموديلات، إلخ) عبر Socket مع الإشعارات المحلية بالفروع (Push & Queue).
- [ ] استقبال التحديثات من الفرع (مستخدمين وفروع جديدة) لتحديثها في القاعدة المركزية (Upward Sync).
- [ ] شاشة مراقبة طابور المزامنة بالأدمن (Sync Status Log).
