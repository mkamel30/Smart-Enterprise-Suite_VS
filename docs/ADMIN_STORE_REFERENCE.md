# 📦 دليل مخزن الشئون الإدارية (Admin Store Reference)

> مرجع شامل لنظام إدارة المخزون الإداري والتحويلات

**Last Updated**: February 18, 2026

---

## 📋 نظرة عامة (Overview)

**مخزن الشئون الإدارية** هو نظام مركزي لإدارة الأصول الجديدة (ماكينات، شرائح، أصول إدارية) وتوزيعها على الفروع. يتميز بنظام تتبع دقيق لكل صنف ونظام حماية متقدم ضد التحويلات المكررة.

### الأهداف الرئيسية:
1. **إدارة المخزون المركزي**: تسجيل وتتبع جميع الأصناف الجديدة
2. **التوزيع الآمن**: تحويل الأصناف للفروع مع ضمان سلامة البيانات
3. **التتبع الكامل**: سجل حركة شامل لكل صنف من لحظة الإدخال حتى التحويل
4. **الحماية من الأخطاء**: منع التحويلات المكررة والتلاعب بالبيانات

---

## 🗂️ هيكل قاعدة البيانات (Database Schema)

### 1. AdminStoreItemType (أنواع الأصناف)

```prisma
model AdminStoreItemType {
  id           String   @id @default(cuid())
  code         String   @unique          // كود الصنف (مثل: IT-001)
  name         String                    // اسم الصنف (مثل: ماكينة PAX A920)
  description  String?                   // وصف تفصيلي
  category     String   @default("MACHINE")  // MACHINE, SIM, CONSUMABLE
  isActive     Boolean  @default(true)   // فعال/معطل
  defaultUnit  String   @default("وحدة")  // وحدة القياس
  trackingMode String   @default("SERIAL_BASED")  // SERIAL_BASED, QUANTITY_BASED
  createdBy    String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  assets         AdminStoreAsset[]
  cartons        AdminStoreCarton[]
  stocks         AdminStoreStock[]
  stockMovements AdminStoreStockMovement[]
}
```

**أنماط التتبع (Tracking Modes)**:
- `SERIAL_BASED`: تتبع بالسيريال (ماكينات، شرائح) - كل قطعة لها سيريال فريد
- `QUANTITY_BASED`: تتبع بالكمية (مستهلكات، أصول إدارية) - يتم العد فقط

**الفئات (Categories)**:
- `MACHINE`: ماكينات POS
- `SIM`: شرائح بيانات
- `CONSUMABLE`: مستهلكات (أوراق، أحبار، الخ)

---

### 2. AdminStoreCarton (الكراتين)

```prisma
model AdminStoreCarton {
  id                 String   @id @default(cuid())
  cartonCode         String   @unique          // كود الكرتونة (مثل: CR-0001)
  itemTypeCode       String                    // FK to AdminStoreItemType
  machinesCount      Int                       // عدد القطع في الكرتونة
  isSerialContinuous Boolean  @default(false)  // هل السيريالات متتالية؟
  firstSerialNumber  String?                   // أول سيريال
  lastSerialNumber   String?                   // آخر سيريال
  notes              String?
  createdBy          String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  
  itemType AdminStoreItemType @relation(fields: [itemTypeCode], references: [code])
  assets   AdminStoreAsset[]
}
```

**استخدامات الكراتين**:
- تسهيل إدخال كميات كبيرة من الأصناف دفعة واحدة
- تتبع الشحنات الواردة من الموردين
- إمكانية تحويل كرتونة كاملة للفرع

---

### 3. AdminStoreAsset (الأصناف الفردية)

```prisma
model AdminStoreAsset {
  id             String   @id @default(cuid())
  itemTypeCode   String                        // FK to AdminStoreItemType
  serialNumber   String   @unique              // السيريال الفريد
  model          String?                       // الموديل (للماكينات)
  manufacturer   String?                       // المصنع (للماكينات)
  
  // حقول خاصة بالشرائح
  simProvider    String?  // Vodafone, Orange, Etisalat, WE
  simNetworkType String?  // 2G, 3G, 4G
  
  cartonCode     String?                       // FK to AdminStoreCarton (اختياري)
  status         String   @default("IN_ADMIN_STORE")  // IN_ADMIN_STORE, TRANSFERRED, DISPOSED
  branchId       String?                       // الفرع الحالي (null = في المخزن الإداري)
  notes          String?
  createdBy      String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  itemType  AdminStoreItemType  @relation(fields: [itemTypeCode], references: [code])
  carton    AdminStoreCarton?   @relation(fields: [cartonCode], references: [cartonCode])
  branch    Branch?             @relation(fields: [branchId], references: [id])
  movements AdminStoreMovement[]
}
```

**حالات الأصناف (Asset Status)**:
- `IN_ADMIN_STORE`: موجود في المخزن الإداري (متاح للتحويل)
- `TRANSFERRED`: تم تحويله لفرع
- `DISPOSED`: تم التخلص منه/إتلافه

---

### 4. AdminStoreMovement (سجل الحركات)

```prisma
model AdminStoreMovement {
  id           String   @id @default(cuid())
  assetId      String                        // FK to AdminStoreAsset
  type         String                        // TRANSFER, STATUS_CHANGE, IMPORT
  fromBranchId String?                       // من أي فرع (null = المخزن الإداري)
  toBranchId   String?                       // إلى أي فرع
  fromStatus   String?                       // الحالة السابقة
  toStatus     String?                       // الحالة الجديدة
  notes        String?
  performedBy  String?
  createdAt    DateTime @default(now())
  
  asset AdminStoreAsset @relation(fields: [assetId], references: [id])
}
```

**أنواع الحركات (Movement Types)**:
- `TRANSFER`: تحويل لفرع
- `STATUS_CHANGE`: تغيير حالة
- `IMPORT`: إدخال جديد للمخزن

---

### 5. AdminStoreStock (المخزون الكمي)

```prisma
model AdminStoreStock {
  id           String   @id @default(cuid())
  itemTypeCode String                        // FK to AdminStoreItemType
  branchId     String?                       // NULL = المخزن الإداري
  quantity     Int      @default(0)          // الكمية الحالية
  updatedAt    DateTime @updatedAt
  
  itemType AdminStoreItemType @relation("ItemStocks", fields: [itemTypeCode], references: [code])
  branch   Branch?            @relation(fields: [branchId], references: [id])
  
  @@unique([itemTypeCode, branchId])  // سجل واحد لكل صنف في كل موقع
}
```

**الاستخدام**: للأصناف ذات التتبع الكمي (`QUANTITY_BASED`)

---

### 6. AdminStoreStockMovement (حركات المخزون الكمي)

```prisma
model AdminStoreStockMovement {
  id           String   @id @default(cuid())
  itemTypeCode String                        // FK to AdminStoreItemType
  type         String                        // IMPORT, TRANSFER, CONSUME
  quantity     Int                           // الكمية
  fromBranchId String?
  toBranchId   String?
  notes        String?
  performedBy  String?
  createdAt    DateTime @default(now())
  
  itemType AdminStoreItemType @relation("ItemStockMovements", fields: [itemTypeCode], references: [code])
}
```

---

## 🔧 Backend Service (adminStoreService.js)

**المسار**: `backend/services/adminStoreService.js`

### الوظائف الرئيسية:

#### 1. إدارة أنواع الأصناف (Item Types)

```javascript
// جلب جميع أنواع الأصناف
listItemTypes(filters)
// Parameters: { category?, isActive?, search? }
// Returns: Promise<AdminStoreItemType[]>

// إنشاء نوع صنف جديد
createItemType(data, user)
// Parameters: { code, name, description, category, trackingMode, defaultUnit }
// Returns: Promise<AdminStoreItemType>

// تحديث نوع صنف
updateItemType(code, data, user)
// Returns: Promise<AdminStoreItemType>
```

---

#### 2. إدارة الأصناف الفردية (Assets)

```javascript
// جلب قائمة الأصناف
listAssets(filters)
// Parameters: { itemTypeCode?, status?, branchId?, search?, cartonCode? }
// Returns: Promise<AdminStoreAsset[]>

// إنشاء صنف مفرد
createAsset(data, user)
// Parameters: { itemTypeCode, serialNumber, model?, manufacturer?, simProvider?, simNetworkType?, notes? }
// Returns: Promise<AdminStoreAsset>

// استيراد أصناف من Excel
bulkImportAssets(buffer, itemTypeCode, user)
// Parameters: buffer (Excel file), itemTypeCode, user
// Returns: Promise<{ success, failed, total }>
```

---

#### 3. إدارة الكراتين (Cartons)

```javascript
// إنشاء كرتونة جديدة
createCarton(data, user)
// Parameters: {
//   cartonCode,
//   itemTypeCode,
//   machinesCount,
//   isSerialContinuous,
//   firstSerialNumber?,
//   lastSerialNumber?,
//   generatedSerials?,  // Array of serial numbers
//   notes?
// }
// Returns: Promise<AdminStoreCarton>

// جلب تفاصيل كرتونة
getCartonDetails(cartonCode)
// Returns: Promise<AdminStoreCarton with assets>
```

---

#### 4. التحويلات (Transfers) ⚡ مع نظام الحماية

```javascript
// تحويل صنف مفرد
async transferAsset(assetId, toBranchId, notes, user)
// ✅ Atomic validation inside transaction
// ✅ Prevents duplicate transfers
// Returns: Promise<TransferOrder>

// تحويل كرتونة كاملة
async transferCarton(cartonId, toBranchId, notes, user)
// ✅ Validates all assets in carton atomically
// Returns: Promise<TransferOrder>

// تحويل جماعي (أصناف + كراتين)
async bulkTransferAssetsAndCartons(data, user)
// Parameters: {
//   assetIds?: string[],
//   cartonCodes?: string[],
//   toBranchId: string,
//   notes?: string
// }
// ✅ Atomic validation for all items
// Returns: Promise<TransferOrder>
```

**🛡️ نظام الحماية من التكرار (Race Condition Protection)**:

جميع وظائف التحويل تطبق التحقق الذري التالي:

```javascript
// داخل Transaction
const asset = await tx.adminStoreAsset.findUnique({
    where: { id: assetId },
    include: { itemType: true }
});

if (!asset) throw new NotFoundError('Asset not found');

// ✅ التحقق الذري من الحالة
if (asset.status !== 'IN_ADMIN_STORE') {
    throw new BadRequestError('هذا الصنف محول بالفعل أو غير موجود في المخزن الإداري حالياً');
}

// ... إكمال التحويل
```

**الفوائد**:
- ✅ منع التحويلات المكررة حتى مع الضغط المتكرر على الزر
- ✅ حماية من race conditions في البيئات متعددة المستخدمين
- ✅ رسائل خطأ واضحة ومحددة

---

#### 5. سجل الحركات (Movement History)

```javascript
// جلب سجل حركات صنف معين
getAssetHistory(assetId)
// Returns: Promise<AdminStoreMovement[]>

// تسجيل حركة جديدة (داخلي)
_logMovement(tx, assetId, type, data)
// Parameters: transaction, assetId, type, { fromBranchId?, toBranchId?, fromStatus?, toStatus?, notes?, performedBy? }
```

---

## 🎨 Frontend Components

### 1. AdminAffairsDashboard.tsx

**المسار**: `frontend/src/pages/AdminAffairsDashboard.tsx`

**الوصف**: لوحة تحكم مخصصة لمخزن الشئون الإدارية بتصميم 3x2 Grid

**المكونات**:
- إحصائيات الماكينات والشرائح
- التحويلات المعلقة
- الأصناف منخفضة المخزون
- حالة الطلبات

---

### 2. CreateCartonModal.tsx

**المسار**: `frontend/src/components/admin-store/CreateCartonModal.tsx`

**الوصف**: نافذة إنشاء كرتونة جديدة مع دعم توليد السيريالات التلقائي

**الميزات**:
- إدخال يدوي للسيريالات
- توليد تلقائي للسيريالات المتتالية
- معاينة السيريالات قبل الحفظ
- دعم حقول SIM (Provider, Network Type)
- ✅ حل مشكلة Duplicate Keys في المعاينة

**مثال الاستخدام**:
```tsx
<CreateCartonModal
  isOpen={isOpen}
  onClose={handleClose}
  onSuccess={handleSuccess}
  itemTypes={itemTypes}
/>
```

---

### 3. AdminStockTransferModal.tsx

**المسار**: `frontend/src/components/admin-store/AdminStockTransferModal.tsx`

**الوصف**: نافذة تحويل الأصناف للفروع

**الميزات**:
- اختيار أصناف مفردة أو كراتين كاملة
- اختيار الفرع المستهدف
- معاينة الأصناف المحددة
- إرسال إشعار تلقائي للفرع المستلم

---

## 🔄 دورة العمل الكاملة (Complete Workflow)

```
1. إنشاء نوع صنف (Item Type)
   ↓
2. إدخال الأصناف:
   - إدخال مفرد (Manual Entry)
   - إنشاء كرتونة (Carton Creation)
   - استيراد من Excel (Bulk Import)
   ↓
3. الأصناف في المخزن الإداري
   Status: IN_ADMIN_STORE
   ↓
4. تحويل للفرع:
   - اختيار الأصناف/الكراتين
   - اختيار الفرع المستهدف
   - إنشاء Transfer Order
   ↓
5. تحديث الحالة:
   - Asset.status → TRANSFERRED
   - Asset.branchId → targetBranchId
   - تسجيل حركة في AdminStoreMovement
   ↓
6. إشعار الفرع المستلم
   ↓
7. الفرع يستلم الأصناف
```

---

## 🏷️ تصحيح بيانات الشرائح (SIM Data Mapping)

**المشكلة السابقة**: كانت بيانات الشرائح تظهر بشكل خاطئ في أذون التحويل:
- النوع (Model) = اسم الشركة (Vodafone)
- المصنع (Manufacturer) = "الشئون الإدارية"

**الحل الحالي (v3.5.1)**:
```javascript
// في transferAsset, transferCarton, bulkTransferAssetsAndCartons
const isSim = itemType.category === 'SIM';

{
    serialNumber: asset.serialNumber,
    type: itemType.category,
    model: isSim ? (asset.simNetworkType || '4G') : (detected.model || itemType.name),
    manufacturer: isSim ? (asset.simProvider || 'Vodafone') : (detected.manufacturer || 'الشئون الإدارية'),
    notes: `الصنف الأصلي: ${itemType.name} (وارد الشئون الإدارية)`
}
```

**النتيجة**:
- ✅ النوع (Model) = نوع الشبكة (4G, 3G, 2G)
- ✅ المصنع (Manufacturer) = الشركة (Vodafone, Orange, WE, Etisalat)
- ✅ "الشئون الإدارية" تظهر في الملاحظات فقط

---

## 📊 إحصائيات ومؤشرات الأداء

```javascript
// جلب إحصائيات المخزن
GET /api/admin-store/stats

Response:
{
  totalAssets: 1250,
  totalCartons: 45,
  assetsByCategory: {
    MACHINE: 800,
    SIM: 400,
    CONSUMABLE: 50
  },
  assetsByStatus: {
    IN_ADMIN_STORE: 950,
    TRANSFERRED: 280,
    DISPOSED: 20
  },
  lowStockItems: [...]
}
```

---

## 🔐 الصلاحيات (Permissions)

**الدور المسموح**: `ADMIN_AFFAIRS`

**الصلاحيات**:
- ✅ إنشاء وتعديل أنواع الأصناف
- ✅ إدخال أصناف جديدة (مفردة/كراتين/استيراد)
- ✅ تحويل أصناف للفروع
- ✅ عرض سجل الحركات
- 👁️ عرض مخزون الفروع (قراءة فقط)
- ❌ لا يمكن الوصول لبيانات العملاء
- ❌ لا يمكن الوصول لطلبات الصيانة

---

## 🐛 الأخطاء الشائعة وحلولها

### 1. "هذا الصنف محول بالفعل"
**السبب**: محاولة تحويل صنف تم تحويله مسبقاً
**الحل**: تحديث الصفحة والتأكد من حالة الصنف

### 2. "Duplicate Key Error" في معاينة السيريالات
**السبب**: استخدام السيريال فقط كـ key في React
**الحل**: ✅ تم الإصلاح في v3.5.1 باستخدام `key={${s}-${idx}}`

### 3. "لا يمكن تحويل الكرتونة لأنها تحتوي على أصناف محولة"
**السبب**: بعض الأصناف داخل الكرتونة تم تحويلها مسبقاً
**الحل**: تحويل الأصناف المتبقية بشكل مفرد

---

## 📝 ملاحظات هامة

1. **Atomic Transactions**: جميع عمليات التحويل تتم داخل transactions لضمان سلامة البيانات
2. **Status Validation**: التحقق من الحالة يتم داخل الـ transaction لمنع race conditions
3. **SIM Data Integrity**: بيانات الشرائح تُحفظ وتُعرض بدقة (Network Type + Provider)
4. **Movement Logging**: كل حركة تُسجل تلقائياً في `AdminStoreMovement`
5. **Notification System**: إشعارات تلقائية للفروع عند استلام تحويلات جديدة

---

*آخر تحديث: 18 فبراير 2026*
