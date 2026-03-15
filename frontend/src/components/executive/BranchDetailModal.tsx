import React from 'react';
import {
    AlertCircle,
    RefreshCw,
    DollarSign,
    Wrench,
    Package,
    Users
} from 'lucide-react';
import { COLORS } from './ExecutiveDashboardConstants';
import type { BranchDrillDown } from './ExecutiveDashboardTypes';

interface BranchDetailModalProps {
    branchData: BranchDrillDown | null;
    onClose: () => void;
    isLoading: boolean;
    isError?: boolean;
    error?: any;
}

const BranchDetailModal: React.FC<BranchDetailModalProps> = ({ branchData, onClose, isLoading, isError, error }) => {
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

export default BranchDetailModal;
