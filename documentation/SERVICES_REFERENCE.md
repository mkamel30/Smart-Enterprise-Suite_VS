# 📚 دليل الخدمات والدوال (Services Reference)

> مرجع شامل لجميع الخدمات (Services) والدوال (Functions) المركزية في النظام

---

## 📦 Services (الخدمات المركزية)

الخدمات موجودة في: `backend/services/`

---

### 1. 💰 paymentService.js - خدمة الدفع

**المسار:** `backend/services/paymentService.js`

**الوصف:** خدمة مركزية لجميع عمليات الدفع والمبالغ المالية.

| Function | الوصف | Parameters | Returns |
|----------|-------|------------|---------|
| `roundMoney(value)` | تقريب المبالغ المالية لمنزلتين عشريتين - يمنع أخطاء مثل 2999.98 بدلاً من 3000 | `value: number\|string` | `number` |
| `createMaintenancePayment(...)` | إنشاء دفعة صيانة واحدة لمجموعة قطع غيار | انظر التفاصيل أدناه | `Promise<Payment\|null>` |
| `createManualPayment(data, user)` | إنشاء دفعة يدوية مع التحقق من العميل | `data: object, user: object` | `Promise<Payment>` |
| `getRequestPayments(requestId)` | جلب جميع المدفوعات المرتبطة بطلب صيانة | `requestId: string` | `Promise<Payment[]>` |
| `getCustomerTotalPayments(customerId)` | حساب إجمالي مدفوعات عميل معين | `customerId: string` | `Promise<number>` |

#### تفاصيل `createMaintenancePayment`:
```javascript
createMaintenancePayment(
    parts,          // Array<{name, quantity, cost, isPaid}>
    requestId,      // String - معرف طلب الصيانة
    customer,       // {id, name}
    user,           // {id, name}
    receiptNumber,  // String | null
    tx,             // Prisma Transaction | null
    branchId        // String
)
```

#### تفاصيل `createManualPayment`:
```javascript
createManualPayment(
    data: {
        customerId,     // String - كود العميل (bkcode)
        amount,         // Number - المبلغ
        reason,         // String - سبب الدفع
        paymentPlace,   // String - مكان الدفع
        receiptNumber,  // String - رقم الإيصال
        notes,          // String - ملاحظات
        branchId        // String - معرف الفرع
    },
    user: {id, name}
)
```

---

### 2. 📦 inventoryService.js - خدمة المخزون

**المسار:** `backend/services/inventoryService.js`

**الوصف:** إدارة مخزون قطع الغيار بشكل مركزي مع التحقق من الكميات.

| Function | الوصف | Parameters | Returns |
|----------|-------|------------|---------|
| `deductParts(...)` | خصم قطع غيار من المخزون مع التحقق من الكمية | انظر التفاصيل | `Promise<StockMovement[]>` |
| `addStock(...)` | إضافة كمية للمخزون | انظر التفاصيل | `Promise<InventoryItem>` |
| `getCurrentStock(partId, branchId)` | الحصول على الكمية الحالية لقطعة معينة | `partId, branchId` | `Promise<object\|null>` |
| `getLowStockItems(branchId)` | جلب القطع ذات الكمية المنخفضة | `branchId: string` | `Promise<InventoryItem[]>` |

#### تفاصيل `deductParts`:
```javascript
deductParts(
    parts,          // Array<{partId, name, quantity, reason}>
    requestId,      // String
    performedBy,    // String - اسم المستخدم
    branchId,       // String
    tx              // Prisma Transaction | null
)
// Throws Error if: الكمية غير كافية أو القطعة غير موجودة
```

#### تفاصيل `addStock`:
```javascript
addStock(
    partId,         // String
    quantity,       // Number
    reason,         // String
    performedBy,    // String
    branchId        // String
)
```

---

### 3. 🖥️ machineService.js - خدمة الماكينات

**المسار:** `backend/services/machineService.js`

**الوصف:** عمليات تبديل وإرجاع الماكينات بين العملاء والمخزن.

| Function | الوصف | Parameters | Returns |
|----------|-------|------------|---------|
| `exchangeMachine(...)` | تبديل ماكينة عميل بماكينة أخرى | انظر التفاصيل | `Promise<{oldMachine, newMachine}>` |
| `returnMachine(...)` | إرجاع ماكينة من عميل للمخزن | انظر التفاصيل | `Promise<Machine>` |

#### تفاصيل `exchangeMachine`:
```javascript
exchangeMachine(
    customerId,     // String - كود العميل
    oldSerial,      // String - سيريال الماكينة القديمة
    newSerial,      // String - سيريال الماكينة الجديدة
    newStatus,      // String - حالة الماكينة الجديدة
    notes,          // String
    user            // {id, name}
)
```

#### تفاصيل `returnMachine`:
```javascript
returnMachine(
    serial,         // String - سيريال الماكينة
    customerId,     // String - كود العميل
    reason,         // String - سبب الإرجاع
    incomingStatus, // 'WAREHOUSE' | 'DEFECTIVE'
    notes,          // String
    user            // {id, name}
)
```

---

### 4. 🔄 machineStateService.js - خدمة حالة الماكينة (Kanban)

**المسار:** `backend/services/machineStateService.js`

**الوصف:** إدارة دورة حياة الماكينة في الصيانة (State Machine).

| Function | الوصف | Parameters | Returns |
|----------|-------|------------|---------|
| `transition(...)` | تغيير حالة الماكينة مع التحقق من صحة الانتقال | انظر التفاصيل | `Promise<Machine>` |
| `isValidTransition(from, to)` | التحقق من صحة الانتقال بين حالتين | `from, to: string` | `boolean` |
| `getKanbanStats(branchId)` | إحصائيات أعداد الماكينات في كل حالة | `branchId: string` | `Promise<object>` |

#### تفاصيل `transition`:
```javascript
transition(
    machineId,      // String
    targetStatus,   // MachineStatus enum
    context: {
        performedBy,    // String
        notes,          // String
        payload,        // {resolution?, cost?, parts?}
        branchId        // String
    }
)
```

#### حالات الماكينة (MachineStatus):
```javascript
{
    IN_TRANSIT: 'IN_TRANSIT',           // في الطريق
    RETURNING: 'RETURNING',             // في طريق العودة
    RECEIVED_AT_CENTER: 'RECEIVED_AT_CENTER', // تم الاستلام بالمركز
    UNDER_INSPECTION: 'UNDER_INSPECTION',     // تحت الفحص
    AWAITING_APPROVAL: 'AWAITING_APPROVAL',   // بانتظار الموافقة
    IN_PROGRESS: 'IN_PROGRESS',               // جاري الإصلاح
    READY_FOR_RETURN: 'READY_FOR_RETURN',     // جاهزة للإرجاع
    COMPLETED: 'COMPLETED'                     // مكتملة
}
```

#### نتائج الصيانة (Resolution):
```javascript
{
    REPAIRED: 'REPAIRED',           // تم الإصلاح
    SCRAPPED: 'SCRAPPED',           // تالفة (خردة)
    REJECTED_REPAIR: 'REJECTED_REPAIR' // رفض الإصلاح
}
```

#### خريطة الانتقالات الصالحة:
```
IN_TRANSIT → RECEIVED_AT_CENTER
RECEIVED_AT_CENTER → UNDER_INSPECTION
UNDER_INSPECTION → AWAITING_APPROVAL | IN_PROGRESS | READY_FOR_RETURN
AWAITING_APPROVAL → IN_PROGRESS | READY_FOR_RETURN
IN_PROGRESS → READY_FOR_RETURN
READY_FOR_RETURN → RETURNING
RETURNING → COMPLETED
```

---

### 5. 📝 movementService.js - خدمة سجل الحركات

**المسار:** `backend/services/movementService.js`

**الوصف:** تسجيل جميع حركات الماكينات والشرائح في سجل مركزي.

---

### 6. 🔄 transferService.js - خدمة التحويلات

**المسار:** `backend/services/transferService.js`

**الوصف:** إدارة كاملة لعمليات التحويل بين الفروع (ماكينات وشرائح) مع نظام حماية شامل.

| Function | الوصف | Parameters | Returns |
|----------|-------|------------|---------|
| `createTransferOrder(data, user)` | إنشاء إذن تحويل جديد مع validation شامل | انظر التفاصيل | `Promise<TransferOrder>` |
| `receiveTransferOrder(orderId, data, user)` | استقبال وإتمام إذن تحويل | `orderId, {receivedBy, receivedByName, receivedItems}, user` | `Promise<TransferOrder>` |
| `createBulkTransfer(data, user)` | إنشاء تحويل جماعي للصيانة مع validation | `{serialNumbers, toBranchId, waybillNumber, notes}, user` | `Promise<TransferOrder>` |
| `listTransferOrders(filters, user)` | جلب قائمة أوامر التحويل | `{branchId, status, type, fromDate, toDate, q}, user` | `Promise<TransferOrder[]>` |
| `getPendingOrders(filters, user)` | جلب التحويلات المعلقة | `{branchId, type}, user` | `Promise<TransferOrder[]>` |
| `getPendingSerials(filters, user)` | جلب أرقام الماكينات/الشرائح في تحويلات معلقة | `{branchId, type}, user` | `Promise<string[]>` |
| `getTransferOrderById(id, user)` | جلب إذن تحويل محدد | `id, user` | `Promise<TransferOrder>` |
| `importTransferFromExcel(buffer, data, user)` | استيراد تحويل من Excel | `buffer, {branchId, type, createdBy, notes}, user` | `Promise<TransferOrder>` |

#### تفاصيل `createTransferOrder`:
```javascript
createTransferOrder(
    data: {
        fromBranchId,    // String - الفرع المرسل
        toBranchId,      // String - الفرع المستقبل
        type,            // 'MACHINE' | 'SIM' | 'MAINTENANCE' | 'SEND_TO_CENTER'
        items,           // Array<{serialNumber, type?, notes?}>
        notes,           // String - ملاحظات
        createdBy,       // String - المنشئ
        createdByName    // String - اسم المنشئ
    },
    user: {id, branchId, role, displayName}
)

// ✅ Validates:
// - Items not in pending transfers (ANY branch)
// - Items exist in source branch
// - Items have valid status (not IN_TRANSIT, SOLD, ASSIGNED, UNDER_MAINTENANCE)
// - Branches are valid and active
// - User has permission to transfer
// - No transfer to same branch

// ⚡ Auto Actions:
// - Sets all items status to IN_TRANSIT
// - Creates transfer order
// - Updates maintenance requests to PENDING_TRANSFER
// - Sends notification to destination branch
```

#### أنواع التحويل (Transfer Types):
```javascript
{
    MACHINE: 'MACHINE',               // تحويل ماكينات عادي
    SIM: 'SIM',                       // تحويل شرائح
    MAINTENANCE: 'MAINTENANCE',       // تحويل للصيانة
    SEND_TO_CENTER: 'SEND_TO_CENTER'  // إرسال لمركز الصيانة
}
```

#### حالات التحويل (Transfer Status):
```javascript
{
    PENDING: 'PENDING',     // معلق (لم يُستلم بعد)
    PARTIAL: 'PARTIAL',     // استلام جزئي
    RECEIVED: 'RECEIVED',   // تم الاستلام
    CANCELLED: 'CANCELLED'  // ملغي
}
```

#### 🛡️ نظام الحماية (Validation System):
يستخدم `transferService` الـ validators من `backend/utils/transfer-validators.js`:

**Validators المتاحة:**
- `validateItemsForTransfer(serialNumbers, type, fromBranchId)` - التحقق من العناصر
- `validateBranches(fromBranchId, toBranchId, type)` - التحقق من الفروع
- `validateUserPermission(user, fromBranchId)` - التحقق من الصلاحيات
- `validateTransferOrder(data, user)` - validation شامل

**الحالات المحظورة:**
- ❌ `IN_TRANSIT` - قيد النقل
- ❌ `SOLD` - مباعة
- ❌ `ASSIGNED` - معينة لمختص
- ❌ `UNDER_MAINTENANCE` - تحت الصيانة

**رسائل الخطأ (أمثلة):**
```
"الماكينات التالية موجودة في تحويلات معلقة:
ABC123 (إذن TO-20260101-001 من القاهرة إلى الإسكندرية)"

"الماكينات التالية غير متاحة للتحويل:
XYZ789 (الحالة: قيد النقل)"

"لا يمكن التحويل لنفس الفرع"
```

---

### 7. 📝 movementService.js - خدمة سجل الحركات (تابع)

**المسار:** `backend/services/movementService.js`

**الوصف:** تسجيل جميع حركات الماكينات والشرائح في سجل مركزي.

| Function | الوصف | Parameters | Returns |
|----------|-------|------------|---------|
| `logMachineMovement(tx, data)` | تسجيل حركة ماكينة | انظر التفاصيل | `Promise<MachineMovementLog>` |
| `logSimMovement(tx, data)` | تسجيل حركة شريحة SIM | انظر التفاصيل | `Promise<SimMovementLog>` |
| `logSystemAction(tx, data)` | تسجيل action عام في سجل النظام | انظر التفاصيل | `Promise<SystemLog>` |

#### تفاصيل `logMachineMovement`:
```javascript
logMachineMovement(tx, {
    machineId,      // String
    serialNumber,   // String
    action,         // String - نوع الحركة
    details,        // String | Object
    performedBy,    // String
    branchId,       // String
    fromBranchId,   // String | null
    customerId      // String | null
})
```

#### تفاصيل `logSimMovement`:
```javascript
logSimMovement(tx, {
    serialNumber,   // String
    action,         // String
    details,        // String | Object
    performedBy,    // String
    branchId,       // String
    fromBranchId,   // String | null
    customerId      // String | null
})
```

#### تفاصيل `logSystemAction`:
```javascript
logSystemAction(tx, {
    entityType,     // 'CUSTOMER' | 'USER' | 'REQUEST' | 'PAYMENT' | etc.
    entityId,       // String
    action,         // 'CREATE' | 'UPDATE' | 'DELETE' | etc.
    details,        // String | Object
    userId,         // String
    performedBy,    // String
    branchId        // String
})
```

---

### 6. 🔧 requestService.js - خدمة طلبات الصيانة

**المسار:** `backend/services/requestService.js`

**الوصف:** إدارة دورة حياة طلبات الصيانة من الإنشاء للإغلاق.

| Function | الوصف | Parameters | Returns |
|----------|-------|------------|---------|
| `createRequest(data, user)` | إنشاء طلب صيانة جديد | انظر التفاصيل | `Promise<Request>` |
| `closeRequest(...)` | إغلاق طلب صيانة مع خصم القطع وإنشاء الدفعة | انظر التفاصيل | `Promise<Request>` |
| `updateStatus(requestId, status, user)` | تحديث حالة الطلب | `requestId, status, user` | `Promise<Request>` |
| `receiveMachineToWarehouse(tx, data)` | استلام ماكينة في مخزن الفرع | انظر التفاصيل | `Promise<WarehouseMachine>` |

#### تفاصيل `createRequest`:
```javascript
createRequest(
    data: {
        customerId,     // String
        machineId,      // String | null
        problemDescription, // String
        branchId        // String
    },
    user: {id, name, branchId}
)
```

#### تفاصيل `closeRequest`:
```javascript
closeRequest(
    requestId,      // String
    actionTaken,    // String - الإجراء المتخذ
    usedParts,      // Array<{partId, name, quantity, cost, isPaid, reason}>
    user,           // {id, name}
    receiptNumber   // String | null
)
// ⚠️ TRANSACTION: إما كل العمليات تنجح أو كلها تفشل
```

#### تفاصيل `receiveMachineToWarehouse`:
```javascript
receiveMachineToWarehouse(tx, {
    serialNumber,   // String
    customerId,     // String
    customerName,   // String
    requestId,      // String | null
    branchId,       // String
    performedBy     // String
})
```

---

## 🔧 Utilities (الأدوات المساعدة)

الأدوات موجودة في: `backend/utils/`

---

### 🔍 machine-validation.js

**المسار:** `backend/utils/machine-validation.js`

**الوصف:** أدوات التحقق من الماكينات واستخراج معلوماتها.

| Function | الوصف | Parameters | Returns |
|----------|-------|------------|---------|
| `checkMachineDuplication(serialNumber, db)` | فحص إذا كانت الماكينة موجودة في المخزن والعميل معاً | `serialNumber, db` | `Promise<{inWarehouse, withCustomer, isDuplicated}>` |
| `detectMachineParams(serialNumber, machineParams)` | استخراج الموديل والمصنع من السيريال | `serialNumber, machineParams[]` | `{model, manufacturer}` |

#### مثال `detectMachineParams`:
```javascript
const params = [
    { prefix: '3C7', model: 'N910', manufacturer: 'PAX' },
    { prefix: 'PAX', model: 'A920', manufacturer: 'PAX' }
];

detectMachineParams('3C784537', params);
// Returns: { model: 'N910', manufacturer: 'PAX' }
```

---

### 📋 logger.js

**المسار:** `backend/utils/logger.js`

**الوصف:** تسجيل الأحداث في سجل النظام (Audit Log).

| Function | الوصف | Parameters | Returns |
|----------|-------|------------|---------|
| `logAction(params)` | تسجيل حدث في قاعدة البيانات | انظر التفاصيل | `Promise<void>` |

#### تفاصيل `logAction`:
```javascript
logAction({
    entityType,     // 'CUSTOMER' | 'USER' | 'REQUEST' | 'PAYMENT' | etc.
    entityId,       // String - معرف الكيان
    action,         // 'CREATE' | 'UPDATE' | 'DELETE' | etc.
    details,        // String - تفاصيل إضافية
    userId,         // String - معرف المستخدم
    performedBy,    // String - اسم المستخدم
    branchId        // String - معرف الفرع
})
```

---

### 🔐 auth-helpers.js

**المسار:** `backend/utils/auth-helpers.js`

**الوصف:** أدوات مساعدة للصلاحيات وعزل البيانات حسب الفرع.

| Function | الوصف | Parameters | Returns |
|----------|-------|------------|---------|
| `getBranchFilter(req)` | إرجاع فلتر Prisma للفرع | `req: Express Request` | `{branchId: string} \| {}` |
| `canAccessBranch(req, targetBranchId)` | التحقق من صلاحية الوصول | `req, targetBranchId` | `boolean` |

#### مثال الاستخدام:
```javascript
router.get('/customers', async (req, res) => {
    const branchFilter = getBranchFilter(req);
    // SUPER_ADMIN/MANAGEMENT → {} (يرى الكل)
    // Others → { branchId: 'xxx' } (يرى فرعه فقط)
    
    const customers = await db.customer.findMany({
        where: branchFilter
    });
});
```

---

## 🏷️ MachineParameter Model

**الموقع في الـ Schema:** `backend/prisma/schema.prisma`

**الوصف:** جدول إعدادات الماكينات - يُستخدم لاستخراج نوع الماكينة والمصنع تلقائياً من رقم السيريال.

| Field | Type | الوصف |
|-------|------|-------|
| `id` | String | معرف فريد (cuid) |
| `prefix` | String (unique) | بادئة السيريال (مثل: "3C7", "PAX", "N91") |
| `model` | String | اسم الموديل |
| `manufacturer` | String | اسم المصنع |

#### مثال:
| prefix | model | manufacturer |
|--------|-------|--------------|
| 3C7 | N910 | PAX |
| PAX | A920 | PAX |
| VER | VX520 | Verifone |
| ING | DX8000 | Ingenico |

#### الاستخدام:
```javascript
// عند إدخال سيريال "3C784537"
// النظام يبحث عن بادئة تطابق
// يجد "3C7" → يستخرج {model: 'N910', manufacturer: 'PAX'}
```

---

## 🔗 كيفية استخدام الخدمات

### استيراد الخدمات:
```javascript
// في أي route file
const paymentService = require('../services/paymentService');
const inventoryService = require('../services/inventoryService');
const machineService = require('../services/machineService');
const requestService = require('../services/requestService');
const movementService = require('../services/movementService');
const machineStateService = require('../services/machineStateService');

// استخدام roundMoney
const { roundMoney } = require('../services/paymentService');
```

### مثال كامل - إغلاق طلب صيانة:
```javascript
const requestService = require('../services/requestService');

router.post('/close/:id', async (req, res) => {
    try {
        const result = await requestService.closeRequest(
            req.params.id,
            req.body.actionTaken,
            req.body.usedParts,
            { id: req.user.id, name: req.user.displayName },
            req.body.receiptNumber
        );
        
        res.json(result);
    } catch (error) {
        // ⚠️ Transaction Rollback happens automatically
        res.status(400).json({ error: error.message });
    }
});
```

---

## 📝 ملاحظات هامة

1. **Transaction Safety:** جميع العمليات المعقدة تستخدم `db.$transaction()` لضمان consistency
2. **Branch Isolation:** استخدم `getBranchFilter()` دائماً لضمان عزل بيانات الفروع
3. **Money Precision:** استخدم `roundMoney()` دائماً للمبالغ المالية
4. **Audit Logging:** استخدم `logAction()` أو `movementService` لتسجيل جميع العمليات المهمة
5. **Notification Navigation:** عند إنشاء notifications، أضف `link` للتوجيه المباشر للصفحة المطلوبة

---

## 🔔 Notification System

### createNotification()

**المسار:** `backend/routes/notifications.js`

**الوصف:** إنشاء إشعارات قابلة للنقر للمستخدمين/الفروع مع إمكانية التوجيه التلقائي.

#### Parameters:
```javascript
{
  branchId: string,        // معرف الفرع المستهدف (اختياري إذا كان userId موجود)
  userId: string,          // معرف المستخدم المستهدف (اختياري إذا كان branchId موجود)
  type: string,            // نوع الإشعار (TRANSFER_ORDER, ASSIGNMENT, APPROVAL_REQUEST, etc.)
  title: string,           // عنوان الإشعار (بالعربية)
  message: string,         // نص الإشعار (بالعربية)
  data: object,            // بيانات إضافية (اختياري)
  link: string             // رابط التوجيه (مطلوب للإشعارات القابلة للنقر)
}
```

#### Navigation Links المستخدمة:
- **Transfer Orders** (وارد): `/receive-orders?orderId=${orderId}`
- **Transfer Orders** (صادر/مرفوض): `/transfer-orders?orderId=${orderId}`  
- **Service Assignments**: `/maintenance/shipments`
- **Maintenance Approvals**: `/maintenance-approvals`
- **Pending Payments**: `/pending-payments`

#### Example:
```javascript
const { createNotification } = require('./notifications');

// إشعار بإذن صرف جديد مع رابط مباشر
await createNotification({
  branchId: destinationBranchId,
  type: 'TRANSFER_ORDER',
  title: 'إذن صرف جديد',
  message: `تم إرسال إذن صرف جديد رقم ${orderNumber} يحتوي على ${items.length} صنف`,
  data: { orderId: order.id, orderNumber },
  link: `/receive-orders?orderId=${order.id}`  // عند النقر → يفتح الإذن مباشرة
});
```

#### Frontend Auto-Navigation:
- **ReceiveOrders.tsx**: يكشف عن `?orderId` parameter ويفتح تفاصيل الإذن تلقائياً
- **TransferOrders.tsx**: يكشف عن `?orderId` parameter ويعرض الإذن تلقائياً
- **NotificationBell.tsx**: يتعامل مع حدث النقر ويوجه إلى `notification.link`

#### كيفية العمل:
1. عند إنشاء notification، يتم حفظ الـ `link` في قاعدة البيانات
2. عند عرض الإشعار في `NotificationBell`، يكون قابل للنقر
3. عند النقر، يتم:
   - تعليم الإشعار كمقروء (`markAsRead`)
   - التوجيه إلى الصفحة المطلوبة (`navigate(notification.link)`)
   - الصفحة المستهدفة تكشف عن الـ query parameters وتعرض السجل المطلوب

---

## 🎨 Frontend Hooks (دوال الواجهة البرمجية)

المسار: `frontend/src/hooks/`

### 1. 👤 useCustomerData.ts
الهدف: عزل منطق البيانات لصفحة العملاء.
- **التصفية**: تدعم الفلترة التلقائية حسب الفرع (`branchId`).
- **الإحصائيات**: حساب فوري لعدد الماكينات والشرائح والعملاء.
- **البحث الموحد**: البحث في العملاء، السيريالات، والشرائح في مكان واحد.

---

*آخر تحديث: 30 ديسمبر 2024*
