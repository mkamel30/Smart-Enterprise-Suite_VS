# Central Admin Portal Implementation Plan (SmartEnterprise_Admin)

هذه الخطة تشرح بناء "بوابة الأدمن المركزية" التي ستدير فروع تطبيق Smart Enterprise Suite.

## 1. الأهداف الرئيسية
- إدارة مركزية لجميع الفروع.
- توحيد الإعدادات والأسعار (Global Parameters) عبر الفروع.
- توفير لوحة تحكم عليا (Executive Dashboard) تجمع البيانات من جميع الفروع.
- إدارة النسخ الاحتياطي المركزي والتحديثات.

## 2. الهيكلية التقنية (Tech Stack)
- **Backend**: Node.js + Express.
- **ORM**: Prisma (SQLite للتطوير، PostgreSQL للإنتاج).
- **Frontend**: React + Vite + Tailwind CSS + Radix UI.
- **Authentication**: JWT-based Auth (Central Admin specific).

## 3. المكونات المقترحة (Components)

### 3.1 قاعدة البيانات (Central Registry)
- `Branch`: بيانات الفرع (الاسم، الكود، الـ API Key، حالة الاتصال).
- `GlobalParameter`: إعدادات يتم دفعها للفروع (سعر الصرف، رسوم الصيانة، إلخ).
- `Release`: إدارة نسخ البرنامج (Version, Download URL, Severity).
- `AdminUser`: مستخدمي البوابة المركزية.

### 3.2 الخدمات المركزية (Services)
- `AdminSyncService`: لاستقبال طلبات الـ Polling من الفروع.
- `ExecutiveReportAggregator`: لجمع ومعالجة تقارير الفروع.
- `BackupManager`: لاستقبال وتخزين ملفات الـ SQLite من الفروع.

## 4. خطة التنفيذ للفروع الصديقة (Branch Integration)
- كل فرع سيتم تزويده بـ `PORTAL_URL` و `PORTAL_API_KEY`.
- الفروع ستقوم بعمل Polling كل 5 دقائق للحصول على آخر التحديثات.
- الفروع ستوفر endpoints مؤمنة للـ Portal لسحب التقارير الحية.

## 5. خطة التحقق (Verification)
- اختبار اتصال فرع تجريبي بالـ Portal.
- التحقق من مزامنة الـ Parameters.
- التحقق من ظهور بيانات الفرع في الـ Executive Dashboard.
