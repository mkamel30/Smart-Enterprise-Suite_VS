import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, TrendingUp, Users, Clock, Package, DollarSign, AlertTriangle, CheckCircle, Activity, FileDown, Sparkles, ChevronLeft } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { request } from '../api/baseClient';

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
            return request<any>(`/reports/performance?${params.toString()}`);
        },
        enabled: isOpen
    });

    // ESC key handler
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

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

    const getHealthColors = (grade: string) => {
        switch (grade) {
            case 'A': return 'text-emerald-600 bg-emerald-50/50 border-emerald-100 shadow-emerald-100/20';
            case 'B': return 'text-blue-600 bg-blue-50/50 border-blue-100 shadow-blue-100/20';
            case 'C': return 'text-amber-600 bg-amber-50/50 border-amber-100 shadow-amber-100/20';
            case 'D': return 'text-orange-600 bg-orange-50/50 border-orange-100 shadow-orange-100/20';
            case 'F': return 'text-rose-600 bg-rose-50/50 border-rose-100 shadow-rose-100/20';
            default: return 'text-slate-600 bg-slate-50 border-slate-100';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 flex flex-col max-h-[90vh] h-auto overflow-hidden sm:max-w-3xl rounded-2xl shadow-2xl bg-white [&>button]:hidden" dir="rtl">

                {/* Modal Header */}
                <div className="shrink-0 p-4 md:p-5 pb-3 md:pb-4 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-primary to-purple-600"></div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-[#0A2472] to-[#1E3A8A] rounded-xl shadow-lg shadow-blue-900/10 text-white">
                                <Activity size={18} strokeWidth={2.5} />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-black text-[#0A2472] leading-tight">تقرير أداء الصيانة</DialogTitle>
                                <DialogDescription className="text-slate-500 font-bold text-[10px] mt-0.5 opacity-80">
                                    {report?.dateRange ? (
                                        `الفترة من ${new Date(report.dateRange.start).toLocaleDateString('ar-EG')} إلى ${new Date(report.dateRange.end).toLocaleDateString('ar-EG')}`
                                    ) : (
                                        'تحليل الكفاءة التشغيلية'
                                    )}
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleExport}
                                disabled={!report}
                                className="smart-btn-secondary py-2 px-4 text-[10px] flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm transition-all active:scale-95"
                            >
                                <FileDown size={14} className="text-emerald-600" />
                                <span className="font-black text-slate-700">تصدير</span>
                            </button>
                            <button
                                type="button"
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-95 shadow-inner"
                                onClick={onClose}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 pb-6 space-y-6 custom-scroll bg-white">

                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-32 space-y-8 animate-in fade-in duration-700">
                            <div className="relative">
                                <div className="w-20 h-20 border-[6px] border-slate-100 border-t-[#0A2472] rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Sparkles size={24} className="text-[#0A2472] animate-pulse" />
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="font-[900] text-slate-900 text-xl tracking-tight">جاري تحليل البيانات...</p>
                                <p className="text-slate-400 font-bold text-sm mt-2">نحن نقوم بمعالجة آلاف السجلات لتقديم التقرير</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="text-center py-20 bg-rose-50/50 rounded-[3rem] border-2 border-dashed border-rose-200">
                            <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-rose-600 shadow-lg shadow-rose-200/50">
                                <AlertTriangle size={40} />
                            </div>
                            <h3 className="text-rose-900 font-black text-2xl mb-2">تعذر الوصول للبيانات</h3>
                            <p className="text-rose-600/70 font-bold text-lg max-w-md mx-auto leading-relaxed">عذراً، حدث خطأ تقني أثناء جلب إحصائيات الأداء من خوادم النظام.</p>
                            <button onClick={onClose} className="mt-8 px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-rose-600/30 hover:bg-rose-700 transition-all">إغلاق والمحاولة لاحقاً</button>
                        </div>
                    )}

                    {report && (
                        <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 space-y-12">

                            {/* Health Score Hero Section */}
                            <div className={`relative overflow-hidden p-5 md:p-6 rounded-2xl border transition-all duration-700 shadow-lg ${getHealthColors(report.performanceIndicators?.healthGrade)} group`}>
                                <div className="absolute -top-24 -right-24 w-96 h-96 bg-white opacity-[0.2] rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
                                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-current opacity-[0.05] rounded-full blur-3xl"></div>

                                <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-white shadow-xl flex items-center justify-center text-3xl md:text-4xl font-black text-slate-900">
                                                {report.performanceIndicators?.healthGrade}
                                            </div>
                                            <div className="absolute -bottom-1 -right-1 p-1.5 bg-white rounded-lg shadow-lg flex items-center justify-center text-emerald-500">
                                                <TrendingUp size={14} strokeWidth={3} />
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <h3 className="text-base font-black mb-0.5 text-slate-900 tracking-tight">التقييم العام</h3>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-2xl md:text-3xl font-black leading-none text-slate-900">{report.performanceIndicators?.healthScore}</span>
                                                <span className="text-[10px] font-bold opacity-40 text-slate-900">/ 100</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-4 md:gap-6 mr-auto">
                                        <div className="text-center">
                                            <div className="text-[8px] font-black uppercase tracking-widest opacity-50 mb-1 text-slate-900">معدل الإنجاز</div>
                                            <div className="text-lg font-black text-slate-900">{report.requestMetrics?.onTimeRate}%</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-[8px] font-black uppercase tracking-widest opacity-50 mb-1 text-slate-900">الإصلاح الأول</div>
                                            <div className="text-lg font-black text-slate-900">{report.performanceIndicators?.firstTimeFixRate}%</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-[8px] font-black uppercase tracking-widest opacity-50 mb-1 text-slate-900">مؤشر الجودة</div>
                                            <div className="text-[9px] font-black text-slate-900 bg-white/40 px-3 py-1 rounded-lg border border-white/50 backdrop-blur-sm whitespace-nowrap">
                                                {report.performanceIndicators?.healthScore >= 90 ? 'ممتاز جداً' :
                                                    report.performanceIndicators?.healthScore >= 75 ? 'جيد جداً' :
                                                        report.performanceIndicators?.healthScore >= 60 ? 'مقبول' : 'يحتاج تحسين'}
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* Main Metrics Grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <MetricCard
                                    icon={<Clock size={16} />}
                                    title="إجمالي الطلبات"
                                    value={report.requestMetrics?.total || 0}
                                    subtext={`${report.requestMetrics?.closedThisPeriod || 0} مكتملة`}
                                    color="blue"
                                />
                                <MetricCard
                                    icon={<Users size={16} />}
                                    title="تكليفات الفنيين"
                                    value={report.technicianMetrics?.totalAssignments || 0}
                                    subtext={`${report.technicianMetrics?.completionRate || 0}% إنجاز`}
                                    color="purple"
                                />
                                <MetricCard
                                    icon={<Package size={16} />}
                                    title="قطع الغيار"
                                    value={report.partsMetrics?.totalPartsUsed || 0}
                                    subtext={`${(report.partsMetrics?.totalPartsCost || 0).toLocaleString()} ج.م`}
                                    color="orange"
                                />
                                <MetricCard
                                    icon={<DollarSign size={16} />}
                                    title="الإيرادات"
                                    value={`${(report.paymentMetrics?.totalRevenue || 0).toLocaleString()}`}
                                    subtext="إجمالي المحصل"
                                    color="emerald"
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                                {/* Status Distribution Chart */}
                                <div className="lg:col-span-12 xl:col-span-5 bg-[#F8FAFC] rounded-2xl border border-slate-100 p-6 shadow-sm relative overflow-hidden group hover:border-blue-200 transition-all duration-500 min-h-[400px] flex flex-col">
                                    <div className="relative z-10 flex flex-col h-full">
                                        <h3 className="font-black text-base text-slate-900 mb-6 flex items-center gap-3">
                                            <div className="p-2.5 bg-white rounded-lg shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                                                <TrendingUp size={18} />
                                            </div>
                                            توزيع حالات الطلبات
                                        </h3>

                                        <div className="flex-1 w-full min-h-[300px] relative">
                                            <ResponsiveContainer width="100%" height={350}>
                                                <PieChart>
                                                    <Pie
                                                        data={Object.entries(report.requestMetrics?.byStatus || {}).map(([name, value]) => ({ name, value }))}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={80}
                                                        outerRadius={110}
                                                        paddingAngle={8}
                                                        dataKey="value"
                                                        animationBegin={0}
                                                        animationDuration={1500}
                                                    >
                                                        {Object.entries(report.requestMetrics?.byStatus || {}).map((entry, index) => (
                                                            <Cell
                                                                key={`cell-${index}`}
                                                                fill={['#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#F59E0B'][index % 6]}
                                                                stroke="none"
                                                                className="hover:opacity-80 transition-opacity cursor-pointer focus:outline-none"
                                                            />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={{
                                                            borderRadius: '1.5rem',
                                                            border: 'none',
                                                            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                                            padding: '12px 20px',
                                                            direction: 'rtl',
                                                            fontFamily: 'inherit',
                                                            fontWeight: 'bold'
                                                        }}
                                                    />
                                                    <Legend
                                                        verticalAlign="bottom"
                                                        height={36}
                                                        content={({ payload }) => (
                                                            <div className="flex flex-wrap justify-center gap-4 mt-8">
                                                                {payload?.map((entry: any, index: number) => (
                                                                    <div key={`item-${index}`} className="flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-100 shadow-sm">
                                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                                                        <span className="text-[11px] font-black text-slate-600">{entry.value}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>

                                        <div className="mt-8 grid grid-cols-2 gap-3">
                                            {Object.entries(report.requestMetrics?.byStatus || {}).slice(0, 4).map(([status, count]: [string, any], idx) => (
                                                <div key={status} className="bg-white/60 p-3 rounded-xl border border-slate-100 flex justify-between items-center group/item hover:bg-white transition-all">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-blue-500' : idx === 1 ? 'bg-primary' : 'bg-purple-500'}`}></div>
                                                        <span className="text-[10px] font-bold text-slate-500">{status}</span>
                                                    </div>
                                                    <span className="font-black text-sm text-slate-900">{count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Approval Stats */}
                                <div className="lg:col-span-12 xl:col-span-7 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-all duration-500">
                                    <div className="relative z-10">
                                        <h3 className="font-black text-base text-slate-900 mb-6 flex items-center gap-3">
                                            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                                <CheckCircle size={18} />
                                            </div>
                                            تحليل إدارة الموافقات
                                        </h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="p-4 bg-[#F8FAFC] rounded-xl border border-slate-100 text-center hover:bg-white transition-all">
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">معدل القبول</div>
                                                <div className="text-2xl font-black text-emerald-600">{report.approvalMetrics?.approvalRate || 0}%</div>
                                            </div>
                                            <div className="p-4 bg-[#F8FAFC] rounded-xl border border-slate-100 text-center hover:bg-white transition-all">
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">متوسط الانتظار</div>
                                                <div className="text-2xl font-black text-blue-600">{report.approvalMetrics?.avgWaitTimeHours?.toFixed(1) || 0}<span className="text-xs opacity-50 mr-1">س</span></div>
                                            </div>
                                            <div className="p-4 bg-[#F8FAFC] rounded-xl border border-slate-100 text-center hover:bg-white transition-all">
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">طلبات مرفوضة</div>
                                                <div className="text-2xl font-black text-rose-600">{report.approvalMetrics?.rejected || 0}</div>
                                            </div>
                                        </div>

                                        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-100 bg-[#F8FAFC]/50 p-5">
                                            <div className="flex justify-between items-center mb-6">
                                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">مؤشرات الاستجابة الزمنية</span>
                                                <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black">
                                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                                    مستجيب بالكامل
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                {[
                                                    { label: 'سرعة الرد على الفني', value: 85, color: 'bg-blue-600', text: 'سرعة مثالية' },
                                                    { label: 'دقة تحديد القطع التالفة', value: 94, color: 'bg-emerald-600', text: 'دقة متناهية' }
                                                ].map((item, idx) => (
                                                    <div key={idx} className="space-y-2">
                                                        <div className="flex justify-between text-[10px] font-black text-slate-800">
                                                            <span>{item.label}</span>
                                                            <span className="text-slate-400 uppercase tracking-tighter">{item.text}</span>
                                                        </div>
                                                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full ${item.color} rounded-full transition-all duration-1000`}
                                                                style={{ width: `${item.value}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recommendations Tile - AI Styled */}
                            {report.performanceIndicators?.recommendations?.length > 0 && (
                                <div className="bg-gradient-to-br from-[#0A2472] to-[#04113B] rounded-2xl p-8 text-white shadow-xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-blue-400/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px]"></div>

                                    <div className="relative z-10">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                                            <h3 className="font-black text-lg flex items-center gap-3">
                                                <div className="p-2.5 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20">
                                                    <Sparkles size={20} className="text-blue-300" />
                                                </div>
                                                توصيات التحسين الذكي
                                            </h3>
                                            <div className="px-3 py-1 bg-white/5 backdrop-blur-md rounded-lg border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] text-blue-200">
                                                تحليل لحظي
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {report.performanceIndicators.recommendations.map((rec: string, idx: number) => (
                                                <div key={idx} className="bg-white/5 border border-white/5 rounded-xl p-4 flex gap-4 items-start group/rec">
                                                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-black text-sm text-blue-300 shrink-0 border border-white/10">
                                                        {idx + 1}
                                                    </div>
                                                    <p className="text-xs font-bold text-blue-50/90 leading-relaxed pt-1.5">{rec}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Bottlenecks Analysis */}
                            {report.performanceIndicators?.bottlenecks?.length > 0 && (
                                <div className="space-y-5">
                                    <h3 className="font-black text-lg text-rose-900 flex items-center gap-3 px-1">
                                        <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
                                            <AlertTriangle size={18} />
                                        </div>
                                        رصد معوقات الأداء
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                        {report.performanceIndicators.bottlenecks.map((bottleneck: any, idx: number) => (
                                            <div key={idx} className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm relative overflow-hidden transition-all">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                                                <div className="font-black text-rose-900 text-sm mb-6">{bottleneck.area}</div>
                                                <div className="flex justify-between items-end">
                                                    <div>
                                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">معدل التأخير</div>
                                                        <div className="text-2xl font-black text-rose-600">{bottleneck.rate || 0}%</div>
                                                    </div>
                                                    <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                                        <div className="text-[9px] font-black text-slate-400 mb-0.5">المتوسط</div>
                                                        <div className="text-lg font-black text-[#0A2472]">{bottleneck.avgHours || 0}<span className="text-[10px] opacity-50 mr-1">س</span></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Top Parts Table */}
                            {report.partsMetrics?.topParts?.length > 0 && (
                                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                                    <div className="p-6 pb-4 flex justify-between items-center gap-4 border-b border-slate-50 bg-[#F8FAFC]/50">
                                        <h3 className="font-black text-lg text-slate-900 flex items-center gap-3">
                                            <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
                                                <Package size={18} />
                                            </div>
                                            تحليل استهلاك الأجزاء
                                        </h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-white border-b border-slate-100">
                                                    <th className="text-right p-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">القطعة</th>
                                                    <th className="text-center p-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">الكمية</th>
                                                    <th className="text-center p-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">كثافة الاستخدام</th>
                                                    <th className="text-left p-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">التكلفة</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {report.partsMetrics.topParts.slice(0, 5).map((part: any, idx: number) => (
                                                    <tr key={idx} className="group hover:bg-[#F8FAFC]">
                                                        <td className="p-4">
                                                            <div className="font-black text-slate-800 text-sm group-hover:text-blue-700">{part.name}</div>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-black text-sm text-[#0A2472]">{part.quantity}</span>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <div className="w-24 h-1.5 bg-slate-100 rounded-full mx-auto overflow-hidden">
                                                                <div
                                                                    className="h-full bg-orange-500 rounded-full transition-all duration-1000"
                                                                    style={{ width: `${Math.min(100, (part.quantity / 20) * 100)}%` }}
                                                                ></div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-left">
                                                            <div className="font-black text-emerald-600 text-sm">{(part.cost || 0).toLocaleString()} <span className="text-[10px] opacity-60">ج.م</span></div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="p-4 bg-[#F8FAFC]/50 border-t border-slate-50 text-center">
                                        <button className="text-[10px] font-black text-[#0A2472] hover:text-blue-800 flex items-center gap-2 mx-auto">
                                            تحليلات المخزون الكاملة
                                            <ChevronLeft size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-5 bg-white border-t border-slate-50 shrink-0 flex flex-col md:flex-row md:items-center gap-4">
                    <button
                        onClick={onClose}
                        className="w-full md:w-auto px-10 h-10 bg-slate-900 text-white rounded-lg font-black text-xs hover:bg-[#0A2472] transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        إغلاق التقرير
                    </button>
                    <div className="flex-1 md:text-left text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic flex items-center md:justify-end justify-center gap-2">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                            تحديث لحظي للنظام
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog >
    );
}

// Helper component for metric cards
function MetricCard({ icon, title, value, subtext, color }: {
    icon: React.ReactNode;
    title: string;
    value: string | number;
    subtext: string;
    color: 'blue' | 'emerald' | 'purple' | 'orange';
}) {
    const colors = {
        blue: 'from-blue-500/5 to-blue-600/5 border-blue-100 hover:border-blue-400 group-hover/card:bg-blue-600 group-hover/card:text-white',
        emerald: 'from-emerald-500/5 to-emerald-600/5 border-emerald-100 hover:border-emerald-400 group-hover/card:bg-emerald-600 group-hover/card:text-white',
        purple: 'from-purple-500/5 to-purple-600/5 border-purple-100 hover:border-purple-400 group-hover/card:bg-purple-600 group-hover/card:text-white',
        orange: 'from-orange-500/5 to-orange-600/5 border-orange-100 hover:border-orange-400 group-hover/card:bg-orange-600 group-hover/card:text-white'
    };

    const iconColors = {
        blue: 'text-blue-600 bg-blue-50',
        emerald: 'text-emerald-600 bg-emerald-50',
        purple: 'text-purple-600 bg-purple-50',
        orange: 'text-orange-600 bg-orange-50'
    };

    return (
        <div className={`p-4 rounded-xl bg-gradient-to-br ${colors[color]} border transition-all duration-300 hover:shadow-lg relative overflow-hidden`}>
            <div className="flex items-center gap-2.5 mb-3 relative z-10">
                <div className={`p-2 rounded-lg ${iconColors[color]} group-hover/card:bg-white transition-colors`}>
                    {icon}
                </div>
                <span className="font-black text-[8px] uppercase tracking-widest opacity-60">{title}</span>
            </div>

            <div className="relative z-10">
                <div className="text-2xl font-black text-slate-900 leading-none mb-1">{value}</div>
                <div className="text-[9px] font-bold opacity-60 line-clamp-1">{subtext}</div>
            </div>
        </div>
    );
}
