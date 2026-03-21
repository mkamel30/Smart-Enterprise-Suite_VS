import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { RefreshCw, CheckCircle, XCircle, Clock, Wifi, Filter, ChevronRight, ChevronLeft } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
    CONNECT: 'اتصال',
    DISCONNECT: 'انفصال',
    PULL: 'سحب',
    PUSH: 'إرسال',
    UPDATE: 'تحديث',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    SUCCESS: { label: 'نجاح', color: 'bg-success/10 text-success', icon: CheckCircle },
    FAILED: { label: 'فشل', color: 'bg-destructive/10 text-destructive', icon: XCircle },
    SKIPPED: { label: 'تخطي', color: 'bg-slate-100 text-slate-500', icon: Clock },
};

export function SyncLogsTab() {
    const [page, setPage] = useState(0);
    const [typeFilter, setTypeFilter] = useState('');
    const limit = 20;

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['sync-logs', page, typeFilter],
        queryFn: () => api.getSyncLogs({ limit, offset: page * limit, type: typeFilter || undefined }),
    });

    const logs = data?.data || [];
    const pagination = data?.pagination || {};
    const totalPages = pagination.pages || 1;

    return (
        <div className='space-y-6'>
            <div className='flex items-center justify-between'>
                <div>
                    <h2 className='text-xl font-black text-foreground flex items-center gap-2'>
                        <Wifi size={20} /> سجل المزامنة
                    </h2>
                    <p className='text-sm text-muted-foreground mt-1'>آخر عمليات الاتصال والمزامنة مع الخادم المركزي</p>
                </div>
                <button onClick={() => refetch()} className='p-2 rounded-xl hover:bg-muted transition-all' title='تحديث'>
                    <RefreshCw size={18} className={isLoading ? 'animate-spin text-primary' : 'text-muted-foreground'} />
                </button>
            </div>

            {/* Type Filter */}
            <div className='flex flex-wrap gap-2'>
                <button onClick={() => { setTypeFilter(''); setPage(0); }}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${!typeFilter ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                    الكل
                </button>
                {Object.entries(TYPE_LABELS).map(([key, label]) => (
                    <button key={key} onClick={() => { setTypeFilter(key); setPage(0); }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${typeFilter === key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {/* Logs Table */}
            {isLoading ? (
                <div className='text-center py-12 text-muted-foreground font-bold'>جاري التحميل...</div>
            ) : logs.length === 0 ? (
                <div className='bg-white rounded-2xl border-2 border-primary/10 p-12 text-center'>
                    <Clock size={40} className='mx-auto mb-3 text-muted-foreground/30' />
                    <p className='font-black text-lg text-muted-foreground'>لا توجد سجلات</p>
                    <p className='text-sm text-muted-foreground/60 mt-1'>ستظهر سجلات المزامنة عند بدء الاتصال بالخادم</p>
                </div>
            ) : (
                <div className='bg-white rounded-2xl border-2 border-primary/10 shadow-sm overflow-hidden'>
                    <div className='overflow-x-auto'>
                        <table className='w-full text-right'>
                            <thead className='bg-muted/50 border-b-2 border-primary/10'>
                                <tr>
                                    <th className='p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground'>النوع</th>
                                    <th className='p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground'>الحالة</th>
                                    <th className='p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground'>الرسالة</th>
                                    <th className='p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground'>العناصر</th>
                                    <th className='p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground'>الوقت</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-border/50'>
                                {logs.map((log: any) => {
                                    const statusCfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.SKIPPED;
                                    const StatusIcon = statusCfg.icon;
                                    return (
                                        <tr key={log.id} className='hover:bg-muted/20 transition-colors'>
                                            <td className='p-4'>
                                                <span className='text-sm font-bold text-foreground'>{TYPE_LABELS[log.type] || log.type}</span>
                                            </td>
                                            <td className='p-4'>
                                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black ${statusCfg.color}`}>
                                                    <StatusIcon size={12} /> {statusCfg.label}
                                                </span>
                                            </td>
                                            <td className='p-4'>
                                                <span className='text-sm font-medium text-foreground'>{log.message}</span>
                                                {log.details && (
                                                    <p className='text-[10px] text-muted-foreground mt-1 font-mono truncate max-w-xs'>{log.details}</p>
                                                )}
                                            </td>
                                            <td className='p-4'>
                                                <span className='text-sm font-bold text-muted-foreground'>{log.itemCount}</span>
                                            </td>
                                            <td className='p-4'>
                                                <span className='text-[10px] text-muted-foreground font-bold'>
                                                    {new Date(log.createdAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className='flex items-center justify-between p-4 border-t border-border/50'>
                            <span className='text-[10px] text-muted-foreground font-bold'>صفحة {page + 1} من {totalPages}</span>
                            <div className='flex items-center gap-2'>
                                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                                    className='p-2 rounded-lg hover:bg-muted transition-all disabled:opacity-30'>
                                    <ChevronLeft size={16} />
                                </button>
                                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                                    className='p-2 rounded-lg hover:bg-muted transition-all disabled:opacity-30'>
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
