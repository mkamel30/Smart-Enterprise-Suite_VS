import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { api } from '../api/client';
import toast from 'react-hot-toast';

export default function SyncStatus() {
    const [queues, setQueues] = useState<any[]>([]);
    const [summary, setSummary] = useState({ total: 0, pending: 0, synced: 0, error: 0 });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');

    const fetchSyncQueue = async () => {
        try {
            setLoading(true);
            const statusParams = filter !== 'ALL' ? `?status=${filter}` : '';
            const response = (await api.get(`/sync-queue${statusParams}`)) as any;
            setQueues(response.data.data);
            setSummary(response.data.summary);
        } catch (error) {
            toast.error('فشل في جلب بيانات طابور المزامنة');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSyncQueue();
        const interval = setInterval(fetchSyncQueue, 15000); // Auto refresh every 15s
        return () => clearInterval(interval);
    }, [filter]);

    const getStatusIcon = (status: string) => {
        if (status === 'SYNCED') return <CheckCircle2 className="text-success" size={18} />;
        if (status === 'PENDING') return <Clock className="text-warning animate-pulse" size={18} />;
        return <XCircle className="text-danger" size={18} />;
    };

    const getStatusText = (status: string) => {
        if (status === 'SYNCED') return 'مكتمل';
        if (status === 'PENDING') return 'قيد الانتظار';
        return 'خطأ';
    };

    return (
        <div className="space-y-8 animate-fade-in pl-10 pr-4">
            {/* Header Section */}
            <div className="flex justify-between items-center mb-10 layout-card p-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
                        <RefreshCw className="text-brand-primary" size={28} />
                        محرك المزامنة اللحظية
                    </h1>
                    <p className="text-slate-400 font-bold text-sm mt-3 tracking-widest text-[11px] uppercase pr-10">
                        مراقبة طابور التحديثات بين المركز الرئيسي والفروع
                    </p>
                </div>
                <div className="flex gap-4">
                    <button onClick={fetchSyncQueue} className="btn-secondary text-[11px]" disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        تحديث البيانات
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-6">
                {[
                    { label: 'إجمالي العمليات', value: summary.total, color: 'text-brand-primary', bg: 'bg-brand-primary/10' },
                    { label: 'مكتمل بنجاح', value: summary.synced, color: 'text-success', bg: 'bg-success/10' },
                    { label: 'قيد الانتظار', value: summary.pending, color: 'text-warning', bg: 'bg-warning/10' },
                    { label: 'عمليات فاشلة', value: summary.error, color: 'text-danger', bg: 'bg-danger/10' }
                ].map((stat, i) => (
                    <div key={i} className="layout-card p-6 border-l-4 border-white transition-all hover:border-brand-primary">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                        <h3 className={`text-3xl font-black mt-2 ${stat.color}`}>{stat.value}</h3>
                    </div>
                ))}
            </div>

            {/* Main Log Table */}
            <div className="layout-card overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="font-black text-slate-700 tracking-wide text-sm flex items-center gap-3">
                        <div className="w-1.5 h-4 bg-brand-cyan rounded-full"></div>
                        سجل طابور المزامنة
                    </h2>
                    <div className="flex gap-3">
                        <select 
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="bg-white border-none shadow-sm rounded-xl px-4 py-2 text-xs font-black text-slate-600 focus:ring-2 focus:ring-brand-primary focus:outline-none"
                        >
                            <option value="ALL">الكل</option>
                            <option value="SYNCED">المكتملة</option>
                            <option value="PENDING">قيد الانتظار</option>
                            <option value="ERROR">فاشلة</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">رقم العملية</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">الفرع الوجهة</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">نوع الكيان</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">الإجراء</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">تاريخ الإرسال</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">الحالة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {queues.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold">
                                        لا توجد عمليات مزامنة حالياً
                                    </td>
                                </tr>
                            ) : (
                                queues.map((q) => (
                                    <tr key={q.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs text-slate-500">#{q.id.substring(q.id.length - 6).toUpperCase()}</td>
                                        <td className="px-6 py-4 font-black text-brand-primary text-xs">{q.branch?.name || q.branchId}</td>
                                        <td className="px-6 py-4 font-bold text-slate-600 text-[11px] uppercase tracking-widest">{q.entityType}</td>
                                        <td className="px-6 py-4 font-bold text-slate-600 text-[11px] uppercase tracking-widest">{q.action}</td>
                                        <td className="px-6 py-4 text-xs text-slate-400 font-medium">
                                            {new Date(q.createdAt).toLocaleString('ar-EG')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(q.status)}
                                                <span className={`text-[11px] font-black tracking-widest ${
                                                    q.status === 'SYNCED' ? 'text-success' : 
                                                    q.status === 'PENDING' ? 'text-warning' : 'text-danger'
                                                }`}>
                                                    {getStatusText(q.status)}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
