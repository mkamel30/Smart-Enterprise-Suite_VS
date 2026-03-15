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
  AreaChart
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Users,
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building2,
  BarChart3,
  RefreshCw,
  Filter,
  ShoppingBag
} from 'lucide-react';

// Components
import KPICard from '../components/executive/KPICard';
import AlertCard from '../components/executive/AlertCard';
import BranchRankingTable from '../components/executive/BranchRankingTable';
import ForecastChart from '../components/executive/ForecastChart';
import BranchDetailModal from '../components/executive/BranchDetailModal';

// Types & Constants
import type { ExecutiveData, BranchDrillDown } from '../components/executive/ExecutiveDashboardTypes';
import { COLORS, CHART_COLORS, REVENUE_TYPE_LABELS } from '../components/executive/ExecutiveDashboardConstants';

// Styles
import './ExecutiveDashboard.css';

const ExecutiveDashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState<'month' | 'quarter' | 'year'>('month');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [drillDownBranchId, setDrillDownBranchId] = useState<string | null>(null);

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

  const { data, isLoading, error, refetch } = useQuery<ExecutiveData>({
    queryKey: ['executive-dashboard', dateParams],
    queryFn: () => api.getExecutiveDashboard(dateParams),
    refetchInterval: 60000,
  });

  const { data: branchesData } = useQuery({
    queryKey: ['branches-lookup'],
    queryFn: () => api.getBranchesLookup(),
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Ensure branches is always an array
  const branches = Array.isArray(branchesData) ? branchesData : [];

  const {
    data: branchDetail,
    isLoading: isBranchLoading,
    isError: isBranchError,
    error: branchError
  } = useQuery<BranchDrillDown>({
    queryKey: ['branch-detail', drillDownBranchId],
    queryFn: () => api.getExecutiveBranchDetail(drillDownBranchId!),
    enabled: !!drillDownBranchId,
    retry: 1,
  });

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

  // Validate data structure
  if (!data || !data.summary || !data.quickCounts || !data.monthlyTrend) {
    return (
      <div className="executive-dashboard error-state">
        <AlertTriangle size={48} />
        <span>البيانات غير مكتملة</span>
        <button onClick={() => refetch()}>إعادة المحاولة</button>
      </div>
    );
  }

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

          <div className="header-filters">
            <div className="filter-group">
              <Filter size={16} />
              <select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)}>
                <option value="month">هذا الشهر</option>
                <option value="quarter">هذا الربع</option>
                <option value="year">هذه السنة</option>
              </select>
            </div>

            {branches && Array.isArray(branches) && branches.length > 0 && (
              <div className="filter-group">
                <Building2 size={16} />
                <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
                  <option value="">كل الفروع</option>
                  {Array.isArray(branches) && branches.map((branch: any) => (
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

      {/* KPI Cards */}
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
        <KPICard
          title="مبيعات الماكينات"
          value={((data.summary.machineSales?.cash.amount || 0) + (data.summary.machineSales?.installment.amount || 0)).toLocaleString()}
          unit="ج.م"
          icon={<Package size={24} />}
          color={COLORS.info}
          subtext={`💵 ${data.summary.machineSales?.cash.count || 0} كاش • 💳 ${data.summary.machineSales?.installment.count || 0} تقسيط`}
        />
        <KPICard
          title="قيمة المنصرف مجاناً"
          value={(data.summary.freePartsValue || 0).toLocaleString()}
          unit="ج.م"
          icon={<AlertTriangle size={24} />}
          color={COLORS.danger}
          subtext="قطع غيار منصرفة بدون مقابل"
        />
        <KPICard
          title="إيرادات قطع الغيار"
          value={(data.summary.paidPartsRevenue || 0).toLocaleString()}
          unit="ج.م"
          icon={<ShoppingBag size={24} />}
          color={COLORS.success}
          subtext="قطع غيار مدفوعة (صيانة + مباشر)"
        />
      </section>

      {/* Quick Counts */}
      <section className="quick-stats">
        <div className="stat-item">
          <span className="stat-value">{(data.quickCounts.totalCustomers || 0).toLocaleString()}</span>
          <span className="stat-label">عميل</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{(data.quickCounts.totalMachines || 0).toLocaleString()}</span>
          <span className="stat-label">ماكينة</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{(data.quickCounts.totalRequests || 0).toLocaleString()}</span>
          <span className="stat-label">إجمالي الطلبات</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{data.quickCounts.closedRequests.toLocaleString()}</span>
          <span className="stat-label">طلب مغلق</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item pending">
          <span className="stat-value">{(data.pendingActions?.approvals || 0) + (data.pendingActions?.transfers || 0)}</span>
          <span className="stat-label">إجراء معلق</span>
        </div>
      </section>

      <AlertCard alerts={data.alerts} />

      {/* Revenue & Comparison Charts */}
      <section className="charts-row">
        <div className="chart-card large">
          <h3 className="chart-title"><TrendingUp size={20} /> اتجاه الإيرادات (آخر 6 شهور)</h3>
          <ResponsiveContainer width="100%" height={300} minHeight={300}>
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
              <Area type="monotone" dataKey="total" name="الإجمالي" stroke={COLORS.primary} fill="url(#totalGradient)" strokeWidth={3} />
              <Line type="monotone" dataKey="maintenance" name="صيانة" stroke={COLORS.success} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="sales" name="مبيعات" stroke={COLORS.warning} strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card large">
          <h3 className="chart-title"><Building2 size={20} /> مقارنة أداء الفروع</h3>
          <ResponsiveContainer width="100%" height={300} minHeight={300}>
            <BarChart data={Array.isArray(data.branchSummary) ? data.branchSummary.slice(0, 8) : []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="name" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
              <Legend verticalAlign="top" align="right" />
              <Bar dataKey="revenue" name="الإيرادات" fill={COLORS.primary} radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="closedRequests" name="الطلبات المغلقة" fill={COLORS.success} radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3 className="chart-title"><TrendingUp size={20} /> توزيع الإيرادات</h3>
          <ResponsiveContainer width="100%" height={250} minHeight={250}>
            <PieChart>
              <Pie
                data={Array.isArray(data.revenueBreakdown) ? data.revenueBreakdown : []}
                cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="amount" nameKey="type"
                label={({ name, percent }) => `${REVENUE_TYPE_LABELS[name] || name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: '#F1F5F9', strokeWidth: 2 }}
                animationBegin={0}
                animationDuration={1500}
              >
                {Array.isArray(data?.revenueBreakdown) && data.revenueBreakdown.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="rgba(255,255,255,0.2)" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  border: '1px solid rgba(148, 163, 184, 0.4)',
                  borderRadius: '12px',
                  color: '#F1F5F9',
                  textAlign: 'right',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}
                itemStyle={{ color: '#F1F5F9', fontSize: '15px', fontWeight: 700, padding: '4px 0' }}
                labelStyle={{ color: '#94A3B8', marginBottom: '8px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', paddingBottom: '4px' }}
                formatter={(value: number, name: string) => [
                  `${value.toLocaleString()} ج.م`,
                  REVENUE_TYPE_LABELS[name] || name
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Branch Rankings & Inventory */}
      <section className="split-section">
        <BranchRankingTable branches={data.branchSummary} onBranchClick={(id) => setDrillDownBranchId(id)} />

        <div className="inventory-status-card">
          <h3 className="section-title"><Package size={20} /> حالة المخزون</h3>
          <div className="inventory-bars">
            {[
              { label: 'متوفر', key: 'inStock', color: 'success' },
              { label: 'منخفض', key: 'lowStock', color: 'warning' },
              { label: 'حرج', key: 'critical', color: 'danger' },
              { label: 'نافد', key: 'outOfStock', color: 'critical' }
            ].map(item => (
              <div key={item.key} className="inventory-bar-group">
                <label>{item.label}</label>
                <div className="inventory-bar">
                  <div
                    className={`bar-fill ${item.color}`}
                    style={{ width: `${(data.inventoryStatus[item.key as keyof typeof data.inventoryStatus] / data.inventoryStatus.total) * 100}%` }}
                  />
                </div>
                <span>{data.inventoryStatus[item.key as keyof typeof data.inventoryStatus]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technician Productivity */}
      {data.technicianProductivity?.length > 0 && (
        <section className="top-performers-section">
          <h3 className="section-title"><Users size={20} /> إنتاجية الفنيين (هذا الشهر)</h3>
          <div className="performers-grid">
            {Array.isArray(data.technicianProductivity) && data.technicianProductivity.slice(0, 5).map((performer, index) => (
              <div key={index} className="performer-card">
                <div className="performer-rank">{index + 1}</div>
                <div className="performer-info">
                  <span className="performer-name">{performer.name}</span>
                  <span className="performer-stats">{performer.closedRequests} طلب مغلق • {(performer.revenue / 1000).toFixed(1)}ألف ج.م</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Forecast Charts */}
      {data.forecast && (
        <>
          <ForecastChart monthlyTrend={data.monthlyTrend} forecast={data.forecast} />

          <section className="forecast-section">
            <h3 className="section-title"><TrendingUp size={20} /> التوقعات (الـ 3 شهور القادمة)</h3>
            <div className="forecast-cards">
              {data.forecast.predictions.map((pred, index) => (
                <div key={index} className="forecast-card">
                  <div className="forecast-month">{pred.month}</div>
                  <div className="forecast-value">{(pred.predicted / 1000).toFixed(0)} ألف</div>
                  <div className="forecast-range">{(pred.lowerBound / 1000).toFixed(0)} ألف - {(pred.upperBound / 1000).toFixed(0)} ألف</div>
                  <div className="forecast-confidence">ثقة {pred.confidence}%</div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <BranchDetailModal
        branchData={branchDetail || null}
        onClose={() => setDrillDownBranchId(null)}
        isLoading={isBranchLoading}
        isError={isBranchError}
        error={branchError}
      />
    </div>
  );
};

export default ExecutiveDashboard;
