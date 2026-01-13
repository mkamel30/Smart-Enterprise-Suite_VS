import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { X, TrendingUp, Users, Clock, Package, DollarSign, AlertTriangle, CheckCircle, Activity, FileDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';

interface PerformanceReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchId?: string;
}

export function PerformanceReportModal({ isOpen, onClose, branchId }: PerformanceReportModalProps) {
    const { data: report, isLoading, error } = useQuery({
        queryKey: ['performance-report', branchId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (branchId) params.append('branchId', branchId);
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/maintenance/branch-performance-report?${params}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) throw new Error('Failed to fetch report');
            return response.json();
        },
        enabled: isOpen
    });

    const handleExport = () => {
        if (!report) return;

        const exportData = [
            { 'القسم': 'إحصائيات الطلبات', 'البيان': 'إجمالي الطلبات', 'القيمة': report.requestMetrics?.total || 0 },
            { 'القسم': 'إحصائيات الطلبات', 'البيان': 'متوسط وقت الإغلاق (ساعة)', 'القيمة': report.requestMetrics?.avgTimeToCompletionHours || 0 },
            { 'القسم': 'إحصائيات الطلبات', 'البيان': 'نسبة الإنجاز في الوقت', 'القيمة': `${report.requestMetrics?.onTimeRate || 0}%` },
            { 'القسم': 'إحصائيات الطلبات', 'البيان': 'طلبات معلقة للموافقة', 'القيمة': report.requestMetrics?.pendingApproval || 0 },
            { 'القسم': 'الفنيين', 'البيان': 'إجمالي التكليفات', 'القيمة': report.technicianMetrics?.totalAssignments || 0 },
            { 'القسم': 'الفنيين', 'البيان': 'معدل الإكمال', 'القيمة': `${report.technicianMetrics?.completionRate || 0}%` },
            { 'القسم': 'الموافقات', 'البيان': 'طلبات مقدمة', 'القيمة': report.approvalMetrics?.submitted || 0 },
            { 'القسم': 'الموافقات', 'البيان': 'معدل الموافقة', 'القيمة': `${report.approvalMetrics?.approvalRate || 0}%` },
            { 'القسم': 'الموافقات', 'البيان': 'متوسط وقت الانتظار (ساعة)', 'القيمة': report.approvalMetrics?.avgWaitTimeHours || 0 },
            { 'القسم': 'قطع الغيار', 'البيان': 'إجمالي القطع المستخدمة', 'القيمة': report.partsMetrics?.totalPartsUsed || 0 },
            { 'القسم': 'قطع الغيار', 'البيان': 'إجمالي التكلفة', 'القيمة': report.partsMetrics?.totalPartsCost || 0 },
            { 'القسم': 'المدفوعات', 'البيان': 'إجمالي الإيرادات', 'القيمة': report.paymentMetrics?.totalRevenue || 0 },
            { 'القسم': 'الأداء', 'البيان': 'درجة الصحة', 'القيمة': `${report.performanceIndicators?.healthScore || 0} (${report.performanceIndicators?.healthGrade || 'N/A'})` },
        ];

        const ws = XLSX.utils.json_to_sheet(exportData);
        ws['!dir'] = { rtl: true };
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'تقرير الأداء');
        XLSX.writeFile(wb, `performance_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    if (!isOpen) return null;

    const getHealthColor = (grade: string) => {
        switch (grade) {
            case 'A': return 'text-green-600 bg-green-50 border-green-200';
            case 'B': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'C': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
            case 'D': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'F': return 'text-red-600 bg-red-50 border-red-200';
            default: return 'text-slate-600 bg-slate-50 border-slate-200';
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" dir="rtl">
            <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b bg-gradient-to-r from-[#0A2472] to-[#0A2472]/90 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <Activity size={24} />
                        <div>
                            <h2 className="text-xl font-black">تقرير أداء الصيانة</h2>
                            {report?.dateRange && (
                                <p className="text-sm text-white/70">
                                    {new Date(report.dateRange.start).toLocaleDateString('ar-EG')} - {new Date(report.dateRange.end).toLocaleDateString('ar-EG')}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExport}
                            disabled={!report}
                            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <FileDown size={18} />
                            تصدير
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading && (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-10 h-10 border-4 border-slate-200 border-t-[#0A2472] rounded-full animate-spin"></div>
                        </div>
                    )}

                    {error && (
                        <div className="text-center py-20 text-red-500">
                            <AlertTriangle size={48} className="mx-auto mb-4" />
                            <p>فشل في تحميل التقرير</p>
                        </div>
                    )}

                    {report && (
                        <div className="space-y-6">
                            {/* Health Score */}
                            <div className={`p-6 rounded-2xl border-2 ${getHealthColor(report.performanceIndicators?.healthGrade)}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="text-5xl font-black">{report.performanceIndicators?.healthGrade}</div>
                                        <div>
                                            <h3 className="text-lg font-bold">درجة صحة النظام</h3>
                                            <p className="text-sm opacity-70">{report.performanceIndicators?.healthScore}/100</p>
                                        </div>
                                    </div>
                                    <div className="text-left">
                                        <div className="text-sm font-bold mb-2">مؤشرات</div>
                                        <div className="text-xs space-y-1 opacity-70">
                                            <div>معدل الإنجاز بالوقت: {report.requestMetrics?.onTimeRate}%</div>
                                            <div>معدل الموافقة الأولى: {report.performanceIndicators?.firstTimeFixRate}%</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Request Metrics */}
                                <MetricCard
                                    icon={<Clock size={24} />}
                                    title="الطلبات"
                                    value={report.requestMetrics?.total || 0}
                                    subtext={`${report.requestMetrics?.closedThisPeriod || 0} مغلق`}
                                    color="blue"
                                />

                                {/* Technician Metrics */}
                                <MetricCard
                                    icon={<Users size={24} />}
                                    title="التكليفات"
                                    value={report.technicianMetrics?.totalAssignments || 0}
                                    subtext={`${report.technicianMetrics?.completionRate || 0}% معدل الإكمال`}
                                    color="purple"
                                />

                                {/* Parts Metrics */}
                                <MetricCard
                                    icon={<Package size={24} />}
                                    title="قطع الغيار"
                                    value={report.partsMetrics?.totalPartsUsed || 0}
                                    subtext={`${(report.partsMetrics?.totalPartsCost || 0).toLocaleString()} ج.م`}
                                    color="orange"
                                />

                                {/* Payment Metrics */}
                                <MetricCard
                                    icon={<DollarSign size={24} />}
                                    title="الإيرادات"
                                    value={`${(report.paymentMetrics?.totalRevenue || 0).toLocaleString()}`}
                                    subtext="ج.م"
                                    color="green"
                                />
                            </div>

                            {/* Status Breakdown */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Request Status */}
                                <div className="bg-white rounded-2xl border p-6">
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                        <TrendingUp size={20} className="text-blue-600" />
                                        توزيع حالات الطلبات
                                    </h3>
                                    <div className="space-y-3">
                                        {Object.entries(report.requestMetrics?.byStatus || {}).map(([status, count]: [string, any]) => (
                                            <div key={status} className="flex justify-between items-center">
                                                <span className="text-sm text-slate-600">{status}</span>
                                                <span className="font-bold text-slate-800">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Approval Metrics */}
                                <div className="bg-white rounded-2xl border p-6">
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                        <CheckCircle size={20} className="text-green-600" />
                                        إحصائيات الموافقات
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-slate-600">طلبات مقدمة</span>
                                            <span className="font-bold text-slate-800">{report.approvalMetrics?.submitted || 0}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-slate-600">موافق عليها</span>
                                            <span className="font-bold text-green-600">{report.approvalMetrics?.approved || 0}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-slate-600">مرفوضة</span>
                                            <span className="font-bold text-red-600">{report.approvalMetrics?.rejected || 0}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-slate-600">متوسط وقت الانتظار</span>
                                            <span className="font-bold text-slate-800">{report.approvalMetrics?.avgWaitTimeHours?.toFixed(1) || 0} ساعة</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recommendations */}
                            {report.performanceIndicators?.recommendations?.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                                    <h3 className="font-bold text-lg mb-4 text-amber-800 flex items-center gap-2">
                                        <AlertTriangle size={20} />
                                        توصيات لتحسين الأداء
                                    </h3>
                                    <ul className="space-y-2">
                                        {report.performanceIndicators.recommendations.map((rec: string, idx: number) => (
                                            <li key={idx} className="text-sm text-amber-700 flex items-start gap-2">
                                                <span className="text-amber-500">•</span>
                                                {rec}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Bottlenecks */}
                            {report.performanceIndicators?.bottlenecks?.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                                    <h3 className="font-bold text-lg mb-4 text-red-800 flex items-center gap-2">
                                        <AlertTriangle size={20} />
                                        نقاط الاختناق
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {report.performanceIndicators.bottlenecks.map((bottleneck: any, idx: number) => (
                                            <div key={idx} className="bg-white p-4 rounded-xl border border-red-100">
                                                <div className="font-bold text-red-700">{bottleneck.area}</div>
                                                <div className="text-sm text-red-600 mt-1">
                                                    {bottleneck.count && `العدد: ${bottleneck.count}`}
                                                    {bottleneck.avgHours && `المتوسط: ${bottleneck.avgHours} ساعة`}
                                                    {bottleneck.rate && `المعدل: ${bottleneck.rate}%`}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Top Parts */}
                            {report.partsMetrics?.topParts?.length > 0 && (
                                <div className="bg-white rounded-2xl border p-6">
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                        <Package size={20} className="text-orange-600" />
                                        أكثر القطع استخداماً
                                    </h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="text-right p-3 font-bold">القطعة</th>
                                                    <th className="text-center p-3 font-bold">الكمية</th>
                                                    <th className="text-center p-3 font-bold">التكلفة</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {report.partsMetrics.topParts.slice(0, 5).map((part: any, idx: number) => (
                                                    <tr key={idx} className="border-t">
                                                        <td className="p-3">{part.name}</td>
                                                        <td className="p-3 text-center font-mono">{part.quantity}</td>
                                                        <td className="p-3 text-center font-bold text-green-600">{part.cost?.toLocaleString()} ج.م</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

// Helper component for metric cards
function MetricCard({ icon, title, value, subtext, color }: {
    icon: React.ReactNode;
    title: string;
    value: string | number;
    subtext: string;
    color: 'blue' | 'green' | 'purple' | 'orange';
}) {
    const colors = {
        blue: 'bg-blue-50 text-blue-600 border-blue-200',
        green: 'bg-green-50 text-green-600 border-green-200',
        purple: 'bg-purple-50 text-purple-600 border-purple-200',
        orange: 'bg-orange-50 text-orange-600 border-orange-200'
    };

    return (
        <div className={`p-4 rounded-xl border ${colors[color]}`}>
            <div className="flex items-center gap-3 mb-2">
                {icon}
                <span className="font-bold">{title}</span>
            </div>
            <div className="text-2xl font-black">{value}</div>
            <div className="text-xs opacity-70">{subtext}</div>
        </div>
    );
}
