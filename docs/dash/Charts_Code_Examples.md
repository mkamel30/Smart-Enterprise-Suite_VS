# 📈 أمثلة عملية: التشارتس والمقاييس

> دليل عملي لإنشاء التشارتس والتقارير مع أمثلة حقيقية

---

## 🎨 I. أمثلة التشارتس بالكود

### **1. Revenue Dashboard (لوحة الإيرادات)**

```javascript
// React + Recharts Example
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

export const RevenueChart = ({ data, dateRange, selectedBranch }) => {
  const transformedData = data.map(month => ({
    name: month.monthName,
    revenue: month.totalRevenue,
    machineSales: month.machineSales,
    maintenance: month.maintenanceRevenue,
    spareParts: month.sparePartsRevenue,
    target: month.monthlyTarget
  }));

  return (
    <div className="dashboard-grid">
      {/* 1. Revenue Trend Line Chart */}
      <div className="chart-container">
        <h3>📈 اتجاه الإيرادات</h3>
        <LineChart width={500} height={300} data={transformedData}>
          <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} dot={{ r: 5 }} />
          <Line type="monotone" dataKey="target" stroke="#EF4444" strokeDasharray="5 5" />
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip 
            formatter={(value) => `${(value / 1000).toFixed(0)}K ج.م`}
            labelStyle={{ color: '#000' }}
          />
          <Legend />
        </LineChart>
      </div>

      {/* 2. Revenue Breakdown Pie Chart */}
      <div className="chart-container">
        <h3>📊 توزيع الإيرادات</h3>
        <PieChart width={400} height={300}>
          <Pie
            data={[
              { name: 'بيع ماكينات', value: transformedData[transformedData.length - 1].machineSales },
              { name: 'صيانة مدفوعة', value: transformedData[transformedData.length - 1].maintenance },
              { name: 'قطع غيار', value: transformedData[transformedData.length - 1].spareParts }
            ]}
            cx={200}
            cy={150}
            labelLine={false}
            label={(entry) => `${entry.name}: ${(entry.value / 1000).toFixed(0)}K`}
            outerRadius={100}
          >
            <Cell fill="#10B981" />
            <Cell fill="#3B82F6" />
            <Cell fill="#F59E0B" />
          </Pie>
          <Tooltip formatter={(value) => `${(value / 1000).toFixed(0)}K ج.م`} />
        </PieChart>
      </div>

      {/* 3. Branch Comparison Bar Chart */}
      <div className="chart-container full-width">
        <h3>🏢 مقارنة الفروع</h3>
        <BarChart width={700} height={300} data={branchData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="branchName" />
          <YAxis />
          <Tooltip formatter={(value) => `${(value / 1000).toFixed(0)}K ج.م`} />
          <Legend />
          <Bar dataKey="machineRevenue" stackId="a" fill="#3B82F6" name="ماكينات" />
          <Bar dataKey="maintenanceRevenue" stackId="a" fill="#10B981" name="صيانة" />
          <Bar dataKey="sparesRevenue" stackId="a" fill="#F59E0B" name="قطع" />
        </BarChart>
      </div>
    </div>
  );
};
```

---

### **2. KPI Cards (بطاقات المؤشرات)**

```javascript
export const KPICard = ({ title, value, unit, change, status, target }) => {
  const isPositive = change >= 0;
  const percentageDisplay = Math.abs(change);
  
  const getColor = (status) => {
    switch(status) {
      case 'success': return 'text-green-600';
      case 'warning': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-blue-600';
    }
  };

  const getIcon = (status) => {
    if (isPositive) return '▲';
    return '▼';
  };

  return (
    <div className={`kpi-card border-l-4 ${getColor(status).replace('text', 'border')}`}>
      <div className="card-header">
        <h4 className="text-gray-600">{title}</h4>
        <span className={`badge ${status}`}>
          {status === 'success' ? '✓' : '!'}
        </span>
      </div>
      
      <div className="card-value">
        <span className="text-3xl font-bold">{value.toLocaleString()}</span>
        <span className="text-gray-500 ml-2">{unit}</span>
      </div>

      <div className="card-footer">
        <span className={`change ${isPositive ? 'positive' : 'negative'}`}>
          {getIcon(status)} {percentageDisplay}%
        </span>
        {target && (
          <span className="text-gray-500">الهدف: {target}</span>
        )}
      </div>

      {/* Mini sparkline chart */}
      <div className="sparkline">
        <svg viewBox="0 0 100 20">
          <polyline points="0,15 10,10 20,12 30,8 40,14 50,6 60,10 70,4 80,12 90,8 100,5"
            fill="none" stroke="#3B82F6" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
};

// Usage
<div className="kpi-grid">
  <KPICard
    title="إجمالي الإيرادات"
    value={450000}
    unit="ج.م"
    change={15}
    status="success"
    target="500K"
  />
  <KPICard
    title="معدل حل الشكاوى"
    value={92}
    unit="%"
    change={5}
    status="success"
    target="95%"
  />
  <KPICard
    title="المستحقات المعلقة"
    value={125000}
    unit="ج.م"
    change={-8}
    status="warning"
    target="< 100K"
  />
</div>
```

---

### **3. Performance Ranking Table**

```javascript
export const PerformanceRanking = ({ branches, metric = 'revenue' }) => {
  const sorted = [...branches].sort((a, b) => b[metric] - a[metric]);
  
  return (
    <div className="ranking-table">
      <table>
        <thead>
          <tr>
            <th className="rank">الترتيب</th>
            <th className="name">الفرع</th>
            <th className="value">{metric === 'revenue' ? 'الإيراد' : 'معدل الحل'}</th>
            <th className="change">التغير</th>
            <th className="badge">الحالة</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((branch, index) => (
            <tr key={branch.id} className={getBadgeClass(index)}>
              <td className="rank">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
              </td>
              <td className="name">{branch.name}</td>
              <td className="value">
                {metric === 'revenue' 
                  ? `${(branch[metric] / 1000).toFixed(0)}K ج.م`
                  : `${branch[metric]}%`
                }
              </td>
              <td className={`change ${branch.change >= 0 ? 'up' : 'down'}`}>
                {branch.change >= 0 ? '▲' : '▼'} {Math.abs(branch.change)}%
              </td>
              <td className="badge">
                {branch.status === 'excellent' && '✅ ممتاز'}
                {branch.status === 'good' && '✓ جيد'}
                {branch.status === 'warning' && '⚠️ تحذير'}
                {branch.status === 'critical' && '❌ حرج'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

---

### **4. Inventory Heatmap**

```javascript
export const InventoryHeatmap = ({ items, branches }) => {
  const getColor = (quantity, minimumStock) => {
    const percentage = (quantity / minimumStock) * 100;
    if (percentage > 100) return '#10B981'; // أخضر - متوفر
    if (percentage > 50) return '#F59E0B';  // أصفر - منخفض
    if (percentage > 0) return '#EF4444';   // أحمر - حرج جداً
    return '#DC2626';                        // أحمر داكن - نافد
  };

  return (
    <div className="heatmap-container">
      <table className="heatmap-table">
        <thead>
          <tr>
            <th>القطعة</th>
            {branches.map(branch => (
              <th key={branch.id}>{branch.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td className="item-name">{item.name}</td>
              {branches.map(branch => {
                const stock = item.stock[branch.id];
                const color = getColor(stock.quantity, stock.minimumStock);
                return (
                  <td 
                    key={`${item.id}-${branch.id}`}
                    style={{ backgroundColor: color }}
                    className="heatmap-cell"
                    title={`${stock.quantity} / ${stock.minimumStock}`}
                  >
                    <span className="qty">{stock.quantity}</span>
                    <span className="status">
                      {stock.quantity <= stock.minimumStock * 0.2 ? '🔴' : '✓'}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

---

### **5. Forecasting Chart (التنبؤات)**

```javascript
export const ForecastChart = ({ historicalData, forecastData }) => {
  const combineData = [
    ...historicalData.map(d => ({
      ...d,
      type: 'actual',
      revenue: d.actualRevenue,
      target: null
    })),
    ...forecastData.map(d => ({
      ...d,
      type: 'forecast',
      revenue: d.forecastedRevenue,
      target: null
    }))
  ];

  return (
    <div className="forecast-container">
      <div className="chart-info">
        <span className="legend-item">
          <span className="line actual"></span> البيانات الفعلية
        </span>
        <span className="legend-item">
          <span className="line forecast"></span> التنبؤ
        </span>
        <span className="legend-item">
          <span className="circle confidence"></span> نطاق الثقة (95%)
        </span>
      </div>

      <ComposedChart width={800} height={400} data={combineData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        
        {/* Confidence interval as area */}
        <Area
          type="monotone"
          dataKey="upperBound"
          fill="#E0F2FE"
          stroke="none"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="lowerBound"
          fill="#FFFFFF"
          stroke="none"
          isAnimationActive={false}
        />

        {/* Actual line */}
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#3B82F6"
          strokeWidth={3}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
          isAnimationActive={true}
        />

        <Tooltip
          content={({ active, payload }) => {
            if (active && payload?.length) {
              const data = payload[0].payload;
              return (
                <div className="tooltip-box">
                  <p className="tooltip-label">{data.name}</p>
                  <p className="tooltip-value">
                    {data.type === 'actual' ? 'الفعلي' : 'التنبؤ'}: 
                    {(data.revenue / 1000).toFixed(0)}K ج.م
                  </p>
                  {data.upperBound && (
                    <p className="tooltip-range">
                      النطاق: {(data.lowerBound / 1000).toFixed(0)}K - {(data.upperBound / 1000).toFixed(0)}K
                    </p>
                  )}
                </div>
              );
            }
            return null;
          }}
        />

        <Legend />
      </ComposedChart>

      <div className="forecast-stats">
        <div className="stat-item">
          <label>متوسط النمو المتوقع</label>
          <value className="positive">+{(forecastData[forecastData.length - 1].growthRate * 100).toFixed(1)}%</value>
        </div>
        <div className="stat-item">
          <label>درجة الثقة</label>
          <value>95%</value>
        </div>
        <div className="stat-item">
          <label>الانحراف المعياري</label>
          <value>{(forecastData[0].stdDeviation / 1000).toFixed(0)}K ج.م</value>
        </div>
      </div>
    </div>
  );
};
```

---

### **6. Maintenance Performance Dashboard**

```javascript
export const MaintenanceMetrics = ({ branchId, dateRange }) => {
  const metrics = useFetchMaintenanceMetrics(branchId, dateRange);

  return (
    <div className="maintenance-dashboard">
      <div className="metrics-grid">
        
        {/* Closure Rate Gauge */}
        <div className="metric-card">
          <h3>معدل الإغلاق</h3>
          <GaugeChart
            value={metrics.closureRate}
            max={100}
            target={95}
            color={metrics.closureRate >= 95 ? '#10B981' : '#F59E0B'}
            label="%"
          />
          <p className="target-text">الهدف: 95%</p>
        </div>

        {/* Resolution Time */}
        <div className="metric-card">
          <h3>متوسط وقت الحل</h3>
          <div className="large-value">
            {metrics.avgResolutionTime}
            <span className="unit">يوم</span>
          </div>
          <ProgressBar
            current={metrics.avgResolutionTime}
            target={3}
            label="يوم"
          />
        </div>

        {/* Overdue Tickets */}
        <div className="metric-card alert">
          <h3>طلبات متأخرة</h3>
          <div className="alert-value">
            {metrics.overdueCount}
            <span className="unit">طلب</span>
          </div>
          <p className="alert-text">⚠️ جاوز 7 أيام بدون إغلاق</p>
        </div>

        {/* Rework Rate */}
        <div className="metric-card">
          <h3>معدل الإعادة</h3>
          <div className="percentage-badge">
            {metrics.reworkRate}%
          </div>
          <p className="target-text">الهدف: < 5%</p>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="status-breakdown">
        <h3>توزيع حالات الطلبات</h3>
        <BarChart width={600} height={300} data={[
          { name: 'مكتملة', value: metrics.closed, color: '#10B981' },
          { name: 'قيد العمل', value: metrics.inProgress, color: '#3B82F6' },
          { name: 'بانتظار موافقة', value: metrics.pendingApproval, color: '#F59E0B' },
          { name: 'متأخرة', value: metrics.overdueCount, color: '#EF4444' }
        ]}>
          <Bar dataKey="value" fill="#3B82F6">
            {metrics.statusBreakdown.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </div>
    </div>
  );
};
```

---

## 📊 II. بيانات تجريبية وسيناريوهات

### **Sample Data for Testing**

```javascript
const mockDashboardData = {
  // KPIs
  kpis: {
    totalRevenue: 450000,
    prevMonthRevenue: 390000,
    targetRevenue: 500000,
    pendingDebts: 125000,
    closureRate: 92,
    avgResolutionTime: 2.5,
    inventoryHealth: 87
  },

  // Monthly Trend
  monthlyData: [
    { month: 'يناير', revenue: 350000, machineRevenue: 200000, maintenance: 100000, spares: 50000, target: 450000 },
    { month: 'فبراير', revenue: 380000, machineRevenue: 220000, maintenance: 110000, spares: 50000, target: 450000 },
    { month: 'مارس', revenue: 420000, machineRevenue: 240000, maintenance: 130000, spares: 50000, target: 450000 },
    { month: 'أبريل', revenue: 450000, machineRevenue: 250000, maintenance: 150000, spares: 50000, target: 500000 }
  ],

  // Branch Performance
  branches: [
    {
      id: 'br_001',
      name: 'فرع الجمال',
      revenue: 180000,
      prevRevenue: 165000,
      change: 9.1,
      closureRate: 95,
      reworkRate: 3,
      status: 'excellent',
      rank: 1
    },
    {
      id: 'br_002',
      name: 'الإسكندرية',
      revenue: 157500,
      prevRevenue: 150000,
      change: 5,
      closureRate: 90,
      reworkRate: 4,
      status: 'good',
      rank: 2
    },
    {
      id: 'br_003',
      name: 'فرع الجيزة',
      revenue: 112500,
      prevRevenue: 75000,
      change: 50,
      closureRate: 88,
      reworkRate: 6,
      status: 'warning',
      rank: 3
    }
  ],

  // Forecast
  forecast: [
    { month: 'مايو', forecastedRevenue: 480000, upperBound: 520000, lowerBound: 440000, growthRate: 0.07 },
    { month: 'يونيو', forecastedRevenue: 510000, upperBound: 555000, lowerBound: 465000, growthRate: 0.06 },
    { month: 'يوليو', forecastedRevenue: 450000, upperBound: 495000, lowerBound: 405000, growthRate: -0.12 }
  ]
};
```

---

## 🎯 III. API Endpoints المطلوبة

```javascript
// Backend APIs for Dashboard

// 1. Get KPIs
GET /api/dashboard/kpis
Query: ?dateRange=month&branchId=br_001

// 2. Get Revenue Trend
GET /api/reports/revenue-trend
Query: ?startDate=2024-01-01&endDate=2024-04-30&groupBy=month

// 3. Get Branch Ranking
GET /api/reports/branch-ranking
Query: ?metric=revenue&limit=10

// 4. Get Maintenance Metrics
GET /api/reports/maintenance-metrics
Query: ?branchId=br_001&dateRange=month

// 5. Get Inventory Status
GET /api/reports/inventory-status
Query: ?branchId=br_001&threshold=critical

// 6. Get Forecast
GET /api/reports/forecast
Query: ?type=revenue&months=3

// 7. Get Customer Satisfaction
GET /api/reports/satisfaction-score
Query: ?branchId=all&dateRange=quarter

// 8. Get Alerts & Notifications
GET /api/alerts
Query: ?severity=critical&limit=10
```

---

## 💾 IV. تخزين البيانات المحسوبة مسبقاً

```javascript
// Pre-computed aggregations (في قاعدة البيانات)

// جدول يومي
DailyMetrics:
- date
- branchId
- totalRevenue
- closedTickets
- newTickets
- overdue
- createdAt

// جدول شهري
MonthlyMetrics:
- year
- month
- branchId
- totalRevenue
- avgClosureTime
- reworkRate
- customerSatisfaction
- computedAt

// جدول التنبؤات
Forecasts:
- forecastDate
- metric (revenue, tickets, etc.)
- predictedValue
- confidenceInterval (upper, lower)
- algorithm
- createdAt
```

---

## 🔧 V. Performance Tips

```javascript
// 1. استخدام Redis للـ cache
const cacheKey = `dashboard:${branchId}:${dateRange}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// 2. استخدام aggregation pipeline في MongoDB
const pipeline = [
  { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
  { $group: {
      _id: '$branchId',
      totalRevenue: { $sum: '$amount' },
      count: { $sum: 1 }
  }},
  { $sort: { totalRevenue: -1 } }
];

// 3. استخدام indexed columns
CREATE INDEX idx_revenue_date_branch 
ON Revenue(date, branchId, amount);

// 4. Lazy load charts
const [showChart, setShowChart] = useState(false);
useEffect(() => {
  const timer = setTimeout(() => setShowChart(true), 500);
  return () => clearTimeout(timer);
}, []);
```

---

## ✅ Checklist للتنفيذ

- [ ] تصميم وتطوير KPI Cards (الأسبوع 1)
- [ ] تطوير Revenue Trend Chart (الأسبوع 2)
- [ ] تطوير Branch Comparison (الأسبوع 2)
- [ ] تطوير Maintenance Metrics (الأسبوع 3)
- [ ] تطوير Inventory Heatmap (الأسبوع 3)
- [ ] تطوير Forecasting Chart (الأسبوع 4)
- [ ] إضافة Filters والـ Interactions (الأسبوع 4-5)
- [ ] إضافة Real-time Updates (الأسبوع 5)
- [ ] إضافة Export و Print (الأسبوع 6)
- [ ] Testing و Optimization (الأسبوع 6-7)

