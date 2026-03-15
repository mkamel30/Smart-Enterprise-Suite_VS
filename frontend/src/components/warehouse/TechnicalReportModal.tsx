import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    X,
    Wrench,
    Clock,
    ArrowLeftRight,
    FileText,
    CheckCircle,
    AlertCircle,
    Package,
    Hash,
    User,
    Calendar,
    Printer,
    Sparkles,
    Activity,
    ChevronLeft,
    DollarSign,
    Info
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '../../api/client';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface TechnicalReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    serialNumber: string;
}

const TYPE_CONFIG: Record<string, { icon: LucideIcon, color: string, label: string }> = {
    'maintenance': { icon: Wrench, color: 'text-blue-600 bg-blue-50 border-blue-100', label: 'صيانة' },
    'payment': { icon: DollarSign, color: 'text-emerald-600 bg-emerald-50 border-emerald-100', label: 'دفعة' },
    'movement': { icon: ArrowLeftRight, color: 'text-purple-600 bg-purple-50 border-purple-100', label: 'حركة' }
};

export const TechnicalReportModal: React.FC<TechnicalReportModalProps> = ({
    isOpen,
    onClose,
    serialNumber
}) => {
    const { data: report, isLoading, error } = useQuery({
        queryKey: ['machine-history', serialNumber],
        queryFn: () => api.getMachineHistory(serialNumber),
        enabled: isOpen && !!serialNumber
    });

    // ESC key support
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const handlePrint = () => {
        window.print();
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 flex flex-col max-h-[96vh] h-auto overflow-hidden sm:max-w-4xl rounded-[2.5rem] shadow-2xl bg-slate-50 [&>button]:hidden print:shadow-none print:max-h-none print:w-full print:bg-white" dir="rtl">

                {/* Modal Header */}
                <div className="modal-header shrink-0 p-8 pb-6 bg-gradient-to-br from-indigo-700 to-indigo-900 relative overflow-hidden text-right print:bg-white print:text-black">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none print:hidden">
                        <div className="absolute top-[-50%] left-[-20%] w-[100%] h-[150%] bg-white rounded-full blur-[80px]"></div>
                    </div>

                    <div className="modal-header-content relative z-10 flex justify-between items-center sm:flex-row flex-col gap-6">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl text-white print:text-black print:border-black/10">
                                <Activity size={28} strokeWidth={2.5} />
                            </div>
                            <div className="text-right">
                                <DialogTitle className="modal-title font-black text-white leading-tight tracking-tight text-2xl print:text-black">التقرير الفني الشامل</DialogTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse print:hidden"></div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 print:hidden">
                            <button
                                onClick={handlePrint}
                                className="h-12 px-6 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black text-sm flex items-center gap-2 transition-all active:scale-95"
                            >
                                <Printer size={18} />
                                طباعة
                            </button>
                            <button
                                onClick={onClose}
                                className="h-12 w-12 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition-all active:scale-95"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scroll print:overflow-visible print:p-0">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-6">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Activity size={24} className="text-indigo-600 animate-pulse" />
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="font-black text-slate-900 text-lg">جاري استرجاع السجل التاريخي...</p>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Deep Metadata Analysis</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="p-10 text-center bg-rose-50 rounded-[2rem] border-2 border-dashed border-rose-100">
                            <AlertCircle size={48} className="mx-auto text-rose-400 mb-4" />
                            <h3 className="text-rose-900 font-black text-lg">خطأ في تحميل البيانات</h3>
                            <p className="text-rose-600 font-bold text-sm">عذراً، لم نتمكن من العثور على سجل لهذه الماكينة.</p>
                        </div>
                    ) : report && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                            {/* Summary Card */}
                            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Hash size={12} />
                                            الرقم التسلسلي
                                        </p>
                                        <h4 className="font-mono text-xl font-black text-indigo-600">{report.machine.serialNumber}</h4>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Package size={12} />
                                            الموديل والنوع
                                        </p>
                                        <h4 className="font-black text-slate-800">{report.machine.model}</h4>
                                        <p className="text-xs font-bold text-slate-400">{report.machine.manufacturer}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <User size={12} />
                                            العميل الحالي
                                        </p>
                                        <h4 className="font-black text-slate-800">{report.machine.customerName || 'مخزن الشركة'}</h4>
                                        <p className="text-xs font-bold text-slate-400">{report.machine.customerId ? 'مرتبطة بعميل' : 'متاحة بالمخزن'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Calendar size={12} />
                                            تاريخ الإصدار
                                        </p>
                                        <h4 className="font-black text-slate-800">
                                            {report.timeline.length > 0
                                                ? format(new Date(report.timeline[report.timeline.length - 1].date), 'dd MMMM yyyy', { locale: ar })
                                                : 'غير مسجل'}
                                        </h4>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100/50 text-center group hover:bg-blue-50 transition-all">
                                    <div className="w-10 h-10 bg-white rounded-2xl shadow-sm flex items-center justify-center text-blue-600 mx-auto mb-3 group-hover:scale-110 transition-transform">
                                        <Wrench size={20} />
                                    </div>
                                    <div className="text-2xl font-black text-slate-800">{report.stats.totalMaintenance}</div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">عملية صيانة</div>
                                </div>
                                <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100/50 text-center group hover:bg-emerald-50 transition-all">
                                    <div className="w-10 h-10 bg-white rounded-2xl shadow-sm flex items-center justify-center text-emerald-600 mx-auto mb-3 group-hover:scale-110 transition-transform">
                                        <DollarSign size={20} />
                                    </div>
                                    <div className="text-2xl font-black text-slate-800">{report.stats.totalPayments}</div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">دفعات محصلة</div>
                                </div>
                                <div className="bg-purple-50/50 p-6 rounded-3xl border border-purple-100/50 text-center group hover:bg-purple-50 transition-all">
                                    <div className="w-10 h-10 bg-white rounded-2xl shadow-sm flex items-center justify-center text-purple-600 mx-auto mb-3 group-hover:scale-110 transition-transform">
                                        <ArrowLeftRight size={20} />
                                    </div>
                                    <div className="text-2xl font-black text-slate-800">{report.stats.totalMovements}</div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">حركات مخزنية</div>
                                </div>
                                <div className="bg-slate-900 p-6 rounded-3xl text-center shadow-xl shadow-slate-200">
                                    <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center text-white mx-auto mb-3">
                                        <Sparkles size={20} />
                                    </div>
                                    <div className="text-2xl font-black text-white">{report.stats.totalCost.toLocaleString()}</div>
                                    <div className="text-[10px] font-black text-white/40 uppercase tracking-tighter">إجمالي التكلفة ج.م</div>
                                </div>
                            </div>

                            {/* Timeline View */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 px-2">
                                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                                    <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">السجل الزمني للأحداث</h3>
                                    <span className="text-[10px] font-black bg-slate-200 text-slate-500 px-3 py-1 rounded-full">{report.timeline.length} نشاط</span>
                                </div>

                                <div className="relative space-y-8 before:absolute before:inset-y-0 before:right-6 before:w-1 before:bg-slate-200 before:rounded-full pt-4">
                                    {report.timeline.map((item: any, idx: number) => {
                                        const config = TYPE_CONFIG[item.type] || { icon: Activity, color: 'text-slate-600 bg-slate-100 border-slate-200', label: 'حدث' };
                                        const Icon = config.icon;

                                        return (
                                            <div key={idx} className="relative flex gap-8 items-start pr-12 group">
                                                {/* Timeline Node */}
                                                <div className={cn(
                                                    "absolute right-[17px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white ring-4 ring-slate-100 z-10 transition-transform group-hover:scale-125",
                                                    item.type === 'maintenance' ? 'bg-blue-500' :
                                                        item.type === 'payment' ? 'bg-emerald-500' : 'bg-purple-500'
                                                )}></div>

                                                <div className="flex-1 space-y-4">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn("p-2.5 rounded-xl border shadow-sm", config.color)}>
                                                                <Icon size={18} strokeWidth={2.5} />
                                                            </div>
                                                            <div>
                                                                <h5 className="font-black text-slate-800 leading-none">{item.title}</h5>
                                                                <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-100 px-2 py-0.5 rounded-md mt-1 inline-block uppercase tracking-widest">{config.label}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-slate-400 font-black text-[11px] bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                                                            <Clock size={12} />
                                                            {format(new Date(item.date), 'dd/MM/yyyy - hh:mm a', { locale: ar })}
                                                        </div>
                                                    </div>

                                                    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm group-hover:shadow-md transition-all">
                                                        {item.type === 'maintenance' && (
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                                <div className="space-y-3">
                                                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase">
                                                                        <AlertCircle size={12} />
                                                                        وصف العطل
                                                                    </div>
                                                                    <p className="text-sm font-bold text-slate-700 leading-relaxed italic">"{item.details.complaint}"</p>
                                                                </div>
                                                                {item.details.action && (
                                                                    <div className="space-y-3">
                                                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase">
                                                                            <CheckCircle size={12} />
                                                                            الإجراء المتخذ
                                                                        </div>
                                                                        <p className="text-sm font-bold text-slate-700 leading-relaxed">{item.details.action}</p>
                                                                    </div>
                                                                )}
                                                                <div className="col-span-1 sm:col-span-2 flex flex-wrap gap-4 pt-4 border-t border-slate-50">
                                                                    {item.details.technician && (
                                                                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                                                            <User size={14} className="text-slate-400" />
                                                                            <span className="text-[11px] font-black text-slate-600">{item.details.technician}</span>
                                                                        </div>
                                                                    )}
                                                                    {item.details.receiptNumber && (
                                                                        <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                                                                            <FileText size={14} className="text-indigo-500" />
                                                                            <span className="text-[11px] font-black text-indigo-700">إيصال: {item.details.receiptNumber}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {item.type === 'payment' && (
                                                            <div className="flex flex-col sm:flex-row items-center gap-6">
                                                                <div className="w-full sm:w-auto p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                                                                    <div className="text-[10px] font-black text-emerald-600 uppercase mb-1">المبلغ المحصل</div>
                                                                    <div className="text-2xl font-black text-emerald-700">{item.details.amount.toLocaleString()} <span className="text-xs">ج.م</span></div>
                                                                </div>
                                                                <div className="flex-1 space-y-1">
                                                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase">
                                                                        <Info size={12} />
                                                                        سبب التحصيل / التفاصيل
                                                                    </div>
                                                                    <p className="text-sm font-bold text-slate-700">{item.details.reason}</p>
                                                                    <p className="text-[10px] font-bold text-slate-400">مكان السداد: {item.details.paymentPlace}</p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {item.type === 'movement' && (
                                                            <div className="flex items-start gap-4">
                                                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                                                    <ArrowLeftRight size={20} className="text-slate-400" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold text-slate-700 leading-relaxed">{item.details.details}</p>
                                                                    <div className="flex items-center gap-2 mt-2">
                                                                        <span className="text-[10px] font-black text-slate-400 uppercase">بواسطة:</span>
                                                                        <span className="text-[10px] font-black text-slate-600">{item.details.performedBy}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="modal-footer p-8 pt-4 bg-white border-t border-slate-100 shrink-0 print:hidden">
                    <button
                        onClick={onClose}
                        className="h-14 px-10 rounded-2xl border-2 border-slate-100 bg-white font-black text-slate-500 hover:bg-slate-50 transition-all active:scale-95"
                    >
                        إغلاق التقرير
                    </button>
                    <div className="flex-1 text-left">
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};


