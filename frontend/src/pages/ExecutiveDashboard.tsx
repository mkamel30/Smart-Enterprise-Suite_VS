import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ComposedChart
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building2,
  Wrench,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  RefreshCw,
  Award,
  PieChart as PieChartIcon
} from 'lucide-react';

// ===================== TYPES =====================

interface ForecastPrediction {
  month: string;
  predicted: number;
  upperBound: number;
  lowerBound: number;
  confidence: number;
}

interface BranchDrillDown {
  branch: { id: string; name: string; code: string; type: string };
  revenue: {
    currentMonth: number;
    byType: { type: string; amount: number }[];
    trend: { month: string; amount: number }[];
  };
  requests: {
    total: number;
    distribution: Record<string, number>;
    closedCount: number;
    avgResolutionDays: number;
    closureRate: number;
  };
  inventory: {
    total: number;
    lowStockCount: number;
    outOfStockCount: number;
    lowStockItems: { name: string; quantity: number; minLevel: number }[];
    outOfStockItems: { name: string }[];
  };
  team: {
    total: number;
    active: number;
    byRole: { technicians: number; supervisors: number };
    topPerformers: { name: string; closedCount: number; revenue: number }[];
  };
  topCustomers: { id: string; name: string; bkcode: string; machineCount: number }[];
  recentActivity: { id: string; amount: number; type: string; createdAt: string }[];
}

interface ExecutiveData {
  summary: {
    dateRange: { start: string; end: string };
    totalRevenue: number;
    previousRevenue: number;
    revenueChange: number;
    pendingDebts: number;
    overdueDebts: number;
    closureRate: number;
    avgResolutionTime: number;
    overdueRequests: number;
    inventoryHealth: number;
  };
  revenueBreakdown: { type: string; amount: number }[];
  inventoryStatus: {
    inStock: number;
    lowStock: number;
    critical: number;
    outOfStock: number;
    total: number;
  };
  branchPerformance: {
    id: string;
    name: string;
    code: string;
    revenue: number;
    previousRevenue: number;
    change: number;
    closureRate: number;
    totalRequests: number;
    closedRequests: number;
  }[];
  monthlyTrend: { name: string; total: number; maintenance: number; sales: number; parts: number }[];
  topPerformers: { name: string; closedCount: number; revenue: number }[];
  alerts: { type: string; severity: string; message: string; count?: number; amount?: number }[];
  pendingActions: { approvals: number; transfers: number };
  quickStats: {
    totalMachines: number;
    machinesWithCustomers: number;
    machineUtilization: number;
    totalCustomers: number;
    totalRequests: number;
    closedRequests: number;
  };
  forecast?: {
    predictions: ForecastPrediction[];
    growthRate: number;
    algorithm: string;
    lastUpdated: string;
  };
}

// ===================== CONSTANTS =====================

const COLORS = {
  primary: '#6366F1',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  purple: '#8B5CF6',
  pink: '#EC4899',
  cyan: '#06B6D4',
  gray: '#6B7280'
};

const CHART_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'];

// ===================== COMPONENTS =====================

const KPICard: React.FC<{
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
  subtext?: string;
}> = ({ title, value, unit, change, icon, trend, color = COLORS.primary, subtext }) => {
  const isPositive = (change ?? 0) >= 0;

  return (
    <div className="kpi-card" style={{ borderRightColor: color }}>
      <div className="kpi-header">
        <div className="kpi-icon" style={{ backgroundColor: `${color}15`, color }}>
          {icon}
        </div>
        <span className="kpi-title">{title}</span>
      </div>
      <div className="kpi-value">
        <span className="value">{typeof value === 'number' ? value.toLocaleString('ar-EG') : value}</span>
        {unit && <span className="unit">{unit}</span>}
      </div>
      {change !== undefined && (
        <div className={`kpi-change ${isPositive ? 'positive' : 'negative'}`}>
          {isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          <span>{Math.abs(change)}%</span>
          <span className="period">عن الفترة السابقة</span>
        </div>
      )}
      {subtext && <div className="kpi-subtext">{subtext}</div>}
    </div>
  );
};

const AlertCard: React.FC<{
  alerts: ExecutiveData['alerts'];
}> = ({ alerts }) => {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="alert-card success">
        <CheckCircle size={24} />
        <span>لا توجد تنبيهات حرجة</span>
      </div>
    );
  }

  return (
    <div className="alerts-container">
      <h3 className="section-title">
        <AlertTriangle size={20} />
        تنبيهات تحتاج انتباهك
      </h3>
      <div className="alerts-list">
        {alerts.map((alert, index) => (
          <div key={index} className={`alert-item ${alert.severity}`}>
            <div className="alert-icon">
              {alert.severity === 'critical' ? <AlertTriangle size={18} /> : <Clock size={18} />}
            </div>
            <div className="alert-content">
              <span className="alert-message">{alert.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const BranchRankingTable: React.FC<{
  branches: ExecutiveData['branchPerformance'];
  onBranchClick?: (branchId: string) => void;
}> = ({ branches, onBranchClick }) => {
  if (!branches || branches.length === 0) return null;

  return (
    <div className="ranking-table-container">
      <h3 className="section-title">
        <Award size={20} />
        تصنيف الفروع
        <span className="click-hint">اضغط للتفاصيل</span>
      </h3>
      <table className="ranking-table">
        <thead>
          <tr>
            <th>#</th>
            <th>الفرع</th>
            <th>الإيراد</th>
            <th>التغير</th>
            <th>نسبة الإغلاق</th>
          </tr>
        </thead>
        <tbody>
          {branches.slice(0, 10).map((branch, index) => (
            <tr
              key={branch.id}
              className={`${index < 3 ? 'top-performer' : ''} clickable-row`}
              onClick={() => onBranchClick?.(branch.id)}
            >
              <td className="rank-cell">
                {index === 0 && '🥇'}
                {index === 1 && '🥈'}
                {index === 2 && '🥉'}
                {index > 2 && index + 1}
              </td>
              <td className="branch-name">{branch.name}</td>
              <td className="revenue">{(branch.revenue / 1000).toFixed(0)}ألف ج.م</td>
              <td className={`change ${branch.change >= 0 ? 'positive' : 'negative'}`}>
                {branch.change >= 0 ? '▲' : '▼'} {Math.abs(branch.change)}%
              </td>
              <td className="closure-rate">
                <div className="progress-bar-mini">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${branch.closureRate}%`,
                      backgroundColor: branch.closureRate >= 90 ? COLORS.success : branch.closureRate >= 70 ? COLORS.warning : COLORS.danger
                    }}
                  />
                </div>
                <span>{branch.closureRate}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ===================== FORECAST CHART =====================

const ForecastChart: React.FC<{
  monthlyTrend: ExecutiveData['monthlyTrend'];
  forecast?: ExecutiveData['forecast'];
}> = ({ monthlyTrend, forecast }) => {
  // Combine historical and forecast data
  const chartData = [
    ...monthlyTrend.map(d => ({ ...d, type: 'actual' })),
    ...(forecast?.predictions || []).map(p => ({
      name: p.month,
      total: p.predicted,
      upperBound: p.upperBound,
      lowerBound: p.lowerBound,
      type: 'forecast'
    }))
  ];

  return (
    <div className="chart-card large">
      <h3 className="chart-title">
        <TrendingUp size={20} />
        اتجاه الإيرادات والتوقعات
        {forecast && (
          <span className="forecast-badge">
            📈 نمو متوقع: {forecast.growthRate}%
          </span>
        )}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData}>
          <defs>
            <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.2} />
              <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="name" stroke="#6B7280" fontSize={12} />
          <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)} ألف`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }}
            formatter={(value: number, name: string) => [
              `${(value / 1000).toFixed(1)}ألف ج.م`,
              name === 'total' ? 'الإيراد' : name === 'upperBound' ? 'الحد الأعلى' : name === 'lowerBound' ? 'الحد الأدنى' : name
            ]}
          />
          <Legend />
          {/* Confidence interval for forecast */}
          <Area
            type="monotone"
            dataKey="upperBound"
            name="الحد الأعلى"
            stroke="transparent"
            fill={COLORS.purple}
            fillOpacity={0.1}
          />
          <Area
            type="monotone"
            dataKey="lowerBound"
            name="الحد الأدنى"
            stroke="transparent"
            fill="transparent"
          />
          {/* Main revenue line */}
          <Area
            type="monotone"
            dataKey="total"
            name="الإيراد"
            stroke={COLORS.primary}
            fill="url(#totalGradient)"
            strokeWidth={3}
            strokeDasharray="5 5"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// ===================== BRANCH DETAIL MODAL =====================

const BranchDetailModal: React.FC<{
  branchData: BranchDrillDown | null;
  onClose: () => void;
  isLoading: boolean;
  isError?: boolean;
  error?: any;
}> = ({ branchData, onClose, isLoading, isError, error }) => {
  if (!branchData && !isLoading && !isError) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content branch-detail-modal" onClick={e => e.stopPropagation()}>
        {isLoading ? (
          <div className="modal-loading">
            <RefreshCw className="spin" size={32} />
            <span>جاري تحميل بيانات الفرع...</span>
          </div>
        ) : isError ? (
          <div className="modal-error">
            <AlertCircle size={32} color={COLORS.danger} />
            <span>فشل تحميل بيانات الفرع</span>
            <p>{error?.message || 'حدث خطأ غير متوقع'}</p>
            <button className="btn-secondary" onClick={onClose}>إغلاق</button>
          </div>
        ) : branchData ? (
          <>
            <div className="modal-header">
              <h2>{branchData.branch.name}</h2>
              <button className="modal-close" onClick={onClose}>×</button>
            </div>

            <div className="modal-body">
              {/* Revenue Section */}
              <div className="detail-section">
                <h4><DollarSign size={16} /> الإيرادات</h4>
                <div className="detail-value-large">
                  {(branchData.revenue.currentMonth / 1000).toFixed(0)}ألف ج.م
                </div>
                <div className="mini-chart">
                  {branchData.revenue.trend.map((t, i) => (
                    <div key={i} className="mini-bar-group">
                      <div
                        className="mini-bar"
                        style={{
                          height: `${Math.min(100, (t.amount / Math.max(...branchData.revenue.trend.map(x => x.amount || 1))) * 100)}%`
                        }}
                      />
                      <span>{t.month}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Requests Section */}
              <div className="detail-section">
                <h4><Wrench size={16} /> طلبات الصيانة</h4>
                <div className="stats-row">
                  <div className="stat-box">
                    <span className="stat-number">{branchData.requests.total}</span>
                    <span className="stat-label">إجمالي</span>
                  </div>
                  <div className="stat-box success">
                    <span className="stat-number">{branchData.requests.closedCount}</span>
                    <span className="stat-label">مغلق</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-number">{branchData.requests.closureRate}%</span>
                    <span className="stat-label">نسبة الإغلاق</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-number">{branchData.requests.avgResolutionDays}</span>
                    <span className="stat-label">متوسط الأيام</span>
                  </div>
                </div>
              </div>

              {/* Inventory Alerts */}
              {(branchData.inventory.lowStockCount > 0 || branchData.inventory.outOfStockCount > 0) && (
                <div className="detail-section warning">
                  <h4><Package size={16} /> تنبيهات المخزون</h4>
                  {branchData.inventory.outOfStockItems.slice(0, 3).map((item, i) => (
                    <div key={i} className="alert-row critical">🔴 نافد: {item.name}</div>
                  ))}
                  {branchData.inventory.lowStockItems.slice(0, 3).map((item, i) => (
                    <div key={i} className="alert-row warning">🟡 منخفض: {item.name} ({item.quantity}/{item.minLevel})</div>
                  ))}
                </div>
              )}

              {/* Top Performers */}
              {branchData.team.topPerformers.length > 0 && (
                <div className="detail-section">
                  <h4><Users size={16} /> أفضل الفنيين</h4>
                  {branchData.team.topPerformers.slice(0, 3).map((p, i) => (
                    <div key={i} className="performer-row">
                      <span className="performer-rank">{i + 1}</span>
                      <span className="performer-name">{p.name}</span>
                      <span className="performer-count">{p.closedCount} طلب</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

// ===================== MAIN COMPONENT =====================


const ExecutiveDashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState<'month' | 'quarter' | 'year'>('month');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [drillDownBranchId, setDrillDownBranchId] = useState<string | null>(null);

  // Calculate date range
  const dateParams = useMemo(() => {
    const today = new Date();
    let start: Date;
    let end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    switch (dateRange) {
      case 'quarter':
        start = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
        end = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 + 3, 0);
        break;
      case 'year':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
      default:
        start = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      branchId: selectedBranch || undefined
    };
  }, [dateRange, selectedBranch]);

  // Fetch main dashboard data
  const { data, isLoading, error, refetch } = useQuery<ExecutiveData>({
    queryKey: ['executive-dashboard', dateParams],
    queryFn: () => api.getExecutiveDashboard(dateParams),
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch branches for filter dropdown
  const { data: branches } = useQuery({
    queryKey: ['branches-lookup'],
    queryFn: () => api.getBranchesLookup(),
  });

  // Fetch branch details for drill-down modal
  const {
    data: branchDetail,
    isLoading: isBranchLoading,
    isError: isBranchError,
    error: branchError
  } = useQuery<BranchDrillDown>({
    queryKey: ['branch-detail', drillDownBranchId],
    queryFn: () => api.getExecutiveBranchDetail(drillDownBranchId!),
    enabled: !!drillDownBranchId,
    retry: 1, // Only retry once to avoid long "loading" hangs
  });

  const handleBranchClick = (branchId: string) => {
    setDrillDownBranchId(branchId);
  };

  const closeBranchModal = () => {
    setDrillDownBranchId(null);
  };

  if (isLoading) {
    return (
      <div className="executive-dashboard loading-state">
        <div className="loading-spinner">
          <RefreshCw className="spin" size={48} />
          <span>جاري تحميل البيانات...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="executive-dashboard error-state">
        <AlertTriangle size={48} />
        <span>حدث خطأ في تحميل البيانات</span>
        <button onClick={() => refetch()}>إعادة المحاولة</button>
      </div>
    );
  }

  if (!data) return null;

  const revenueTypeLabels: Record<string, string> = {
    'MAINTENANCE': 'صيانة',
    'SALE': 'مبيعات',
    'INSTALLMENT': 'أقساط',
    'SPARE_PARTS': 'قطع غيار',
    'OTHER': 'أخرى'
  };

  return (
    <div className="executive-dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-title">
            <BarChart3 size={32} />
            <div>
              <h1>لوحة تحكم الإدارة العليا</h1>
              <p>نظرة شاملة على أداء المؤسسة</p>
            </div>
          </div>

          {/* Filters */}
          <div className="header-filters">
            <div className="filter-group">
              <Filter size={16} />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
              >
                <option value="month">هذا الشهر</option>
                <option value="quarter">هذا الربع</option>
                <option value="year">هذه السنة</option>
              </select>
            </div>

            {branches && (
              <div className="filter-group">
                <Building2 size={16} />
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                >
                  <option value="">كل الفروع</option>
                  {branches.map((branch: any) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button className="refresh-btn" onClick={() => refetch()}>
              <RefreshCw size={16} />
              تحديث
            </button>
          </div>
        </div>
      </header>

      {/* KPI Cards Row */}
      <section className="kpi-grid">
        <KPICard
          title="إجمالي الإيرادات"
          value={(data.summary.totalRevenue / 1000).toFixed(0)}
          unit="ألف ج.م"
          change={data.summary.revenueChange}
          icon={<DollarSign size={24} />}
          color={COLORS.success}
        />
        <KPICard
          title="المستحقات المعلقة"
          value={(data.summary.pendingDebts / 1000).toFixed(0)}
          unit="ألف ج.م"
          icon={<Clock size={24} />}
          color={data.summary.overdueDebts > 0 ? COLORS.danger : COLORS.warning}
          subtext={data.summary.overdueDebts > 0 ? `⚠️ ${(data.summary.overdueDebts / 1000).toFixed(0)} ألف متأخر` : undefined}
        />
        <KPICard
          title="معدل حل الشكاوى"
          value={data.summary.closureRate}
          unit="%"
          icon={<CheckCircle size={24} />}
          color={data.summary.closureRate >= 90 ? COLORS.success : data.summary.closureRate >= 70 ? COLORS.warning : COLORS.danger}
          subtext={`متوسط ${data.summary.avgResolutionTime} يوم للحل`}
        />
        <KPICard
          title="صحة المخزون"
          value={data.summary.inventoryHealth}
          unit="%"
          icon={<Package size={24} />}
          color={data.summary.inventoryHealth >= 80 ? COLORS.success : data.summary.inventoryHealth >= 60 ? COLORS.warning : COLORS.danger}
        />
      </section>

      {/* Quick Stats */}
      <section className="quick-stats">
        <div className="stat-item">
          <span className="stat-value">{data.quickStats.totalCustomers.toLocaleString()}</span>
          <span className="stat-label">عميل</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{data.quickStats.totalMachines.toLocaleString()}</span>
          <span className="stat-label">ماكينة</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{data.quickStats.machineUtilization}%</span>
          <span className="stat-label">نسبة الاستخدام</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{data.quickStats.closedRequests}</span>
          <span className="stat-label">طلب مغلق</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item pending">
          <span className="stat-value">{data.pendingActions.approvals + data.pendingActions.transfers}</span>
          <span className="stat-label">إجراء معلق</span>
        </div>
      </section>

      {/* Alerts Section */}
      <AlertCard alerts={data.alerts} />

      {/* Charts Row */}
      <section className="charts-row">
        {/* Revenue Trend */}
        <div className="chart-card large">
          <h3 className="chart-title">
            <TrendingUp size={20} />
            اتجاه الإيرادات (آخر 6 شهور)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.monthlyTrend}>
              <defs>
                <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)} ألف`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                formatter={(value: number) => [`${(value / 1000).toFixed(1)}ألف ج.م`, '']}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="total"
                name="الإجمالي"
                stroke={COLORS.primary}
                fill="url(#totalGradient)"
                strokeWidth={3}
              />
              <Line
                type="monotone"
                dataKey="maintenance"
                name="صيانة"
                stroke={COLORS.success}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="sales"
                name="مبيعات"
                stroke={COLORS.warning}
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Breakdown */}
        <div className="chart-card">
          <h3 className="chart-title">
            <PieChartIcon size={20} />
            توزيع الإيرادات
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data.revenueBreakdown}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="amount"
                nameKey="type"
                label={({ name, percent }) => `${revenueTypeLabels[name] || name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.revenueBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${(value / 1000).toFixed(1)}ألف ج.م`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Branch Performance & Inventory */}
      <section className="split-section">
        <BranchRankingTable
          branches={data.branchPerformance}
          onBranchClick={handleBranchClick}
        />

        {/* Inventory Status */}
        <div className="inventory-status-card">
          <h3 className="section-title">
            <Package size={20} />
            حالة المخزون
          </h3>
          <div className="inventory-bars">
            <div className="inventory-bar-group">
              <label>متوفر</label>
              <div className="inventory-bar">
                <div
                  className="bar-fill success"
                  style={{ width: `${(data.inventoryStatus.inStock / data.inventoryStatus.total) * 100}%` }}
                />
              </div>
              <span>{data.inventoryStatus.inStock}</span>
            </div>
            <div className="inventory-bar-group">
              <label>منخفض</label>
              <div className="inventory-bar">
                <div
                  className="bar-fill warning"
                  style={{ width: `${(data.inventoryStatus.lowStock / data.inventoryStatus.total) * 100}%` }}
                />
              </div>
              <span>{data.inventoryStatus.lowStock}</span>
            </div>
            <div className="inventory-bar-group">
              <label>حرج</label>
              <div className="inventory-bar">
                <div
                  className="bar-fill danger"
                  style={{ width: `${(data.inventoryStatus.critical / data.inventoryStatus.total) * 100}%` }}
                />
              </div>
              <span>{data.inventoryStatus.critical}</span>
            </div>
            <div className="inventory-bar-group">
              <label>نافد</label>
              <div className="inventory-bar">
                <div
                  className="bar-fill critical"
                  style={{ width: `${(data.inventoryStatus.outOfStock / data.inventoryStatus.total) * 100}%` }}
                />
              </div>
              <span>{data.inventoryStatus.outOfStock}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Top Performers */}
      {data.topPerformers && data.topPerformers.length > 0 && (
        <section className="top-performers-section">
          <h3 className="section-title">
            <Users size={20} />
            أفضل الفنيين أداءً
          </h3>
          <div className="performers-grid">
            {data.topPerformers.slice(0, 5).map((performer, index) => (
              <div key={index} className="performer-card">
                <div className="performer-rank">{index + 1}</div>
                <div className="performer-info">
                  <span className="performer-name">{performer.name}</span>
                  <span className="performer-stats">
                    {performer.closedCount} طلب مغلق • {(performer.revenue / 1000).toFixed(1)}ألف ج.م
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Forecast Section */}
      {data.forecast && data.forecast.predictions.length > 0 && (
        <section className="forecast-section">
          <h3 className="section-title">
            <TrendingUp size={20} />
            التوقعات (الـ 3 شهور القادمة)
          </h3>
          <div className="forecast-cards">
            {data.forecast.predictions.map((pred, index) => (
              <div key={index} className="forecast-card">
                <div className="forecast-month">{pred.month}</div>
                <div className="forecast-value">
                  {(pred.predicted / 1000).toFixed(0)} ألف
                </div>
                <div className="forecast-range">
                  {(pred.lowerBound / 1000).toFixed(0)} ألف - {(pred.upperBound / 1000).toFixed(0)} ألف
                </div>
                <div className="forecast-confidence">
                  ثقة {pred.confidence}%
                </div>
              </div>
            ))}
          </div>
          {data.forecast.growthRate !== 0 && (
            <div className={`growth-indicator ${data.forecast.growthRate > 0 ? 'positive' : 'negative'}`}>
              {data.forecast.growthRate > 0 ? '📈' : '📉'}
              معدل النمو المتوقع: {Math.abs(data.forecast.growthRate)}%
            </div>
          )}
        </section>
      )}

      {/* Branch Detail Modal */}
      <BranchDetailModal
        branchData={branchDetail || null}
        onClose={closeBranchModal}
        isLoading={isBranchLoading}
        isError={isBranchError}
        error={branchError}
      />

      <style>{`
        .executive-dashboard {
          padding: 24px;
          background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
          min-height: 100vh;
          direction: rtl;
        }

        /* Loading & Error States */
        .loading-state, .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          color: #94A3B8;
          gap: 16px;
        }

        .loading-spinner .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Header */
        .dashboard-header {
          margin-bottom: 24px;
          padding: 24px;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
          border-radius: 16px;
          border: 1px solid rgba(99, 102, 241, 0.2);
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 16px;
          color: #F1F5F9;
        }

        .header-title h1 {
          font-size: 28px;
          font-weight: 700;
          margin: 0;
          background: linear-gradient(135deg, #fff 0%, #94A3B8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .header-title p {
          margin: 0;
          font-size: 14px;
          color: #94A3B8;
        }

        .header-filters {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(30, 41, 59, 0.8);
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.1);
        }

        .filter-group svg {
          color: #94A3B8;
        }

        .filter-group select {
          background: transparent;
          border: none;
          color: #F1F5F9;
          font-size: 14px;
          outline: none;
          cursor: pointer;
        }

        .filter-group option {
          background: #1E293B;
        }

        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .refresh-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
        }

        /* KPI Grid */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 24px;
        }

        @media (max-width: 1200px) {
          .kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .kpi-grid {
            grid-template-columns: 1fr;
          }
        }

        .kpi-card {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%);
          border-radius: 16px;
          padding: 24px;
          border-right: 4px solid;
          border-top: 1px solid rgba(148, 163, 184, 0.1);
          border-left: 1px solid rgba(148, 163, 184, 0.1);
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
          transition: all 0.3s ease;
        }

        .kpi-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }

        .kpi-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .kpi-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .kpi-title {
          font-size: 14px;
          color: #94A3B8;
          font-weight: 500;
        }

        .kpi-value {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }

        .kpi-value .value {
          font-size: 32px;
          font-weight: 700;
          color: #F1F5F9;
        }

        .kpi-value .unit {
          font-size: 16px;
          color: #94A3B8;
        }

        .kpi-change {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 12px;
          font-size: 14px;
        }

        .kpi-change.positive {
          color: #10B981;
        }

        .kpi-change.negative {
          color: #EF4444;
        }

        .kpi-change .period {
          color: #6B7280;
          margin-right: 8px;
        }

        .kpi-subtext {
          margin-top: 8px;
          font-size: 13px;
          color: #94A3B8;
        }

        /* Quick Stats */
        .quick-stats {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 24px;
          padding: 20px 32px;
          background: rgba(30, 41, 59, 0.5);
          border-radius: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .stat-item {
          text-align: center;
        }

        .stat-item.pending .stat-value {
          color: #F59E0B;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 700;
          color: #F1F5F9;
          display: block;
        }

        .stat-label {
          font-size: 13px;
          color: #94A3B8;
        }

        .stat-divider {
          width: 1px;
          height: 40px;
          background: rgba(148, 163, 184, 0.2);
        }

        /* Alerts */
        .alerts-container {
          background: rgba(30, 41, 59, 0.5);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .alert-card.success {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 12px;
          color: #10B981;
          margin-bottom: 24px;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #F1F5F9;
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .alerts-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .alert-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 8px;
          border-right: 3px solid;
        }

        .alert-item.critical {
          background: rgba(239, 68, 68, 0.1);
          border-right-color: #EF4444;
        }

        .alert-item.warning {
          background: rgba(245, 158, 11, 0.1);
          border-right-color: #F59E0B;
        }

        .alert-icon {
          color: inherit;
        }

        .alert-item.critical .alert-icon {
          color: #EF4444;
        }

        .alert-item.warning .alert-icon {
          color: #F59E0B;
        }

        .alert-message {
          color: #F1F5F9;
          font-size: 14px;
        }

        /* Charts */
        .charts-row {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        @media (max-width: 1024px) {
          .charts-row {
            grid-template-columns: 1fr;
          }
        }

        .chart-card {
          background: rgba(30, 41, 59, 0.5);
          border-radius: 16px;
          padding: 24px;
          border: 1px solid rgba(148, 163, 184, 0.1);
        }

        .chart-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #F1F5F9;
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 20px;
        }

        /* Split Section */
        .split-section {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        @media (max-width: 1024px) {
          .split-section {
            grid-template-columns: 1fr;
          }
        }

        /* Ranking Table */
        .ranking-table-container {
          background: rgba(30, 41, 59, 0.5);
          border-radius: 16px;
          padding: 24px;
          border: 1px solid rgba(148, 163, 184, 0.1);
        }

        .ranking-table {
          width: 100%;
          border-collapse: collapse;
        }

        .ranking-table th {
          text-align: right;
          padding: 12px;
          color: #94A3B8;
          font-weight: 500;
          font-size: 13px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }

        .ranking-table td {
          padding: 12px;
          color: #F1F5F9;
          font-size: 14px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.05);
        }

        .ranking-table tr.top-performer {
          background: rgba(99, 102, 241, 0.05);
        }

        .rank-cell {
          font-size: 18px;
        }

        .change.positive {
          color: #10B981;
        }

        .change.negative {
          color: #EF4444;
        }

        .closure-rate {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .progress-bar-mini {
          width: 60px;
          height: 6px;
          background: rgba(148, 163, 184, 0.1);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          border-radius: 3px;
        }

        /* Inventory Status */
        .inventory-status-card {
          background: rgba(30, 41, 59, 0.5);
          border-radius: 16px;
          padding: 24px;
          border: 1px solid rgba(148, 163, 184, 0.1);
        }

        .inventory-bars {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .inventory-bar-group {
          display: grid;
          grid-template-columns: 60px 1fr 40px;
          align-items: center;
          gap: 12px;
        }

        .inventory-bar-group label {
          color: #94A3B8;
          font-size: 13px;
        }

        .inventory-bar-group span {
          color: #F1F5F9;
          font-size: 14px;
          font-weight: 500;
          text-align: left;
        }

        .inventory-bar {
          height: 8px;
          background: rgba(148, 163, 184, 0.1);
          border-radius: 4px;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.5s ease;
        }

        .bar-fill.success { background: #10B981; }
        .bar-fill.warning { background: #F59E0B; }
        .bar-fill.danger { background: #F97316; }
        .bar-fill.critical { background: #EF4444; }

        /* Top Performers */
        .top-performers-section {
          background: rgba(30, 41, 59, 0.5);
          border-radius: 16px;
          padding: 24px;
          border: 1px solid rgba(148, 163, 184, 0.1);
        }

        .performers-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
        }

        @media (max-width: 1200px) {
          .performers-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 768px) {
          .performers-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .performer-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: rgba(99, 102, 241, 0.05);
          border: 1px solid rgba(99, 102, 241, 0.1);
          border-radius: 12px;
        }

        .performer-rank {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
        }

        .performer-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .performer-name {
          color: #F1F5F9;
          font-weight: 500;
          font-size: 14px;
        }

        .performer-stats {
          color: #94A3B8;
          font-size: 12px;
        }

        /* Recharts Customization */
        .recharts-text {
          fill: #94A3B8 !important;
        }

        .recharts-legend-item-text {
          color: #94A3B8 !important;
        }

        /* Clickable Table Rows */
        .clickable-row {
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .clickable-row:hover {
          background: rgba(99, 102, 241, 0.1) !important;
        }

        .click-hint {
          font-size: 11px;
          color: #6B7280;
          margin-right: auto;
          margin-left: 12px;
          font-weight: 400;
        }

        /* Forecast Section */
        .forecast-section {
          background: rgba(30, 41, 59, 0.5);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          border: 1px solid rgba(148, 163, 184, 0.1);
        }

        .forecast-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 16px;
        }

        @media (max-width: 768px) {
          .forecast-cards {
            grid-template-columns: 1fr;
          }
        }

        .forecast-card {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }

        .forecast-month {
          color: #94A3B8;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .forecast-value {
          color: #F1F5F9;
          font-size: 28px;
          font-weight: 700;
        }

        .forecast-range {
          color: #6B7280;
          font-size: 12px;
          margin-top: 4px;
        }

        .forecast-confidence {
          color: #8B5CF6;
          font-size: 11px;
          margin-top: 8px;
        }

        .growth-indicator {
          text-align: center;
          margin-top: 16px;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
        }

        .growth-indicator.positive {
          background: rgba(16, 185, 129, 0.1);
          color: #10B981;
        }

        .growth-indicator.negative {
          background: rgba(239, 68, 68, 0.1);
          color: #EF4444;
        }

        .forecast-badge {
          margin-right: auto;
          margin-left: 12px;
          background: rgba(139, 92, 246, 0.2);
          color: #8B5CF6;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
          border-radius: 20px;
          width: 100%;
          max-width: 600px;
          max-height: 85vh;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.1);
          animation: modal-appear 0.3s ease;
        }

        @keyframes modal-appear {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }

        .modal-header h2 {
          color: #F1F5F9;
          font-size: 20px;
          font-weight: 600;
          margin: 0;
        }

        .modal-close {
          background: transparent;
          border: none;
          color: #94A3B8;
          font-size: 28px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          transition: color 0.2s;
        }

        .modal-close:hover {
          color: #F1F5F9;
        }

        .modal-body {
          padding: 24px;
          overflow-y: auto;
          max-height: calc(85vh - 80px);
        }

        .modal-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px;
          color: #94A3B8;
          gap: 16px;
        }

        .detail-section {
          margin-bottom: 24px;
          padding: 16px;
          background: rgba(30, 41, 59, 0.5);
          border-radius: 12px;
        }

        .detail-section.warning {
          border-right: 3px solid #F59E0B;
        }

        .detail-section h4 {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #F1F5F9;
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 12px 0;
        }

        .detail-value-large {
          font-size: 32px;
          font-weight: 700;
          color: #F1F5F9;
          margin-bottom: 12px;
        }

        .mini-chart {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          height: 60px;
        }

        .mini-bar-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .mini-bar {
          width: 100%;
          background: linear-gradient(180deg, #6366F1 0%, #8B5CF6 100%);
          border-radius: 4px 4px 0 0;
          min-height: 4px;
        }

        .mini-bar-group span {
          font-size: 10px;
          color: #6B7280;
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .stat-box {
          text-align: center;
          padding: 12px;
          background: rgba(30, 41, 59, 0.5);
          border-radius: 8px;
        }

        .stat-box.success {
          background: rgba(16, 185, 129, 0.1);
        }

        .stat-number {
          display: block;
          font-size: 20px;
          font-weight: 700;
          color: #F1F5F9;
        }

        .stat-box.success .stat-number {
          color: #10B981;
        }

        .stat-box .stat-label {
          font-size: 11px;
          color: #6B7280;
        }

        .alert-row {
          padding: 8px 12px;
          margin-bottom: 8px;
          border-radius: 6px;
          font-size: 13px;
        }

        .alert-row.critical {
          background: rgba(239, 68, 68, 0.1);
          color: #F87171;
        }

        .alert-row.warning {
          background: rgba(245, 158, 11, 0.1);
          color: #FBBF24;
        }

        .performer-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid rgba(148, 163, 184, 0.05);
        }

        .performer-row .performer-rank {
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
        }

        .performer-row .performer-name {
          flex: 1;
          color: #F1F5F9;
          font-size: 13px;
        }

        .performer-row .performer-count {
          color: #94A3B8;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
};

export default ExecutiveDashboard;
