import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import {
    Database,
    Download,
    RefreshCw,
    Trash2,
    History,
    ShieldCheck,
    AlertTriangle,
    Clock,
    HardDrive,
    Save
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApiMutation } from '../hooks/useApiMutation';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHeader from '../components/PageHeader';

export default function AdminBackups() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGEMENT';
    const [backupToDelete, setBackupToDelete] = useState<string | null>(null);
    const [backupToRestore, setBackupToRestore] = useState<string | null>(null);

    const queryClient = useQueryClient();

    // Fetch Backups
    const { data: backups, isLoading: isBackupsLoading } = useQuery<any[]>({
        queryKey: ['backups'],
        queryFn: () => api.listBackups(),
        enabled: isAdmin
    });

    // Fetch Backup Logs
    const { data: logs, isLoading: isLogsLoading } = useQuery<any[]>({
        queryKey: ['backup-logs'],
        queryFn: () => api.getLogs(10),
        enabled: isAdmin
    });

    const createMutation = useApiMutation<any, void>({
        mutationFn: () => api.createBackup(),
        successMessage: 'تم إنشاء النسخة الاحتياطية بنجاح',
        errorMessage: 'فشل إنشاء النسخة الاحتياطية',
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backups'] });
            queryClient.invalidateQueries({ queryKey: ['backup-logs'] });
        }
    });

    const deleteMutation = useApiMutation({
        mutationFn: (filename: string) => api.deleteBackup(filename),
        successMessage: 'تم حذف النسخة الاحتياطية',
        errorMessage: 'فشل حذف النسخة الاحتياطية',
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backups'] });
            queryClient.invalidateQueries({ queryKey: ['backup-logs'] });
        }
    });

    const restoreMutation = useApiMutation({
        mutationFn: (filename: string) => api.restoreBackup(filename),
        successMessage: 'تم استرجاع نسخة البيانات بنجاح. يرجى الانتظار لإعادة تشغيل النظام.',
        errorMessage: 'فشل استرجاع نسخة البيانات',
        onSuccess: () => {
            // Usually, restore might need a full page reload or wait for server restart
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        }
    });

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    if (!isAdmin) {
        return (
            <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center" dir="rtl">
                <ShieldCheck size={64} className="text-red-500 mb-4 opacity-20" />
                <h2 className="text-2xl font-black text-slate-800">صلاحية غير كافية</h2>
                <p className="text-slate-500 mt-2 font-bold">عذراً، هذه الصفحة مخصصة للمديرين فقط.</p>
            </div>
        );
    }

    const actionElements = (
        <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="smart-btn-primary flex items-center gap-2"
        >
            {createMutation.isPending ? <RefreshCw className="animate-spin" size={20} /> : <Database size={20} />}
            إنشاء نسخة احتياطية فورية
        </button>
    );

    return (
        <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen" dir="rtl">
            <PageHeader
                title="إدارة النسخ الاحتياطية"
                subtitle="تأمين بيانات النظام وعمليات الاسترجاع"
                actions={actionElements}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Management & Settings */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Status Card */}
                    <div className="smart-card p-6 bg-white border-2 border-primary/5 flex items-start gap-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-primary/10 transition-all" />

                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <ShieldCheck size={32} />
                        </div>

                        <div className="flex-1">
                            <h3 className="text-lg font-black text-primary">حالة حماية البيانات</h3>
                            <p className="text-sm text-slate-500 font-bold mb-4">النظام يقوم بعمل نسخة احتياطية آلية بشكل يومي في الساعة 2:00 صباحاً.</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                        <History size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-black text-emerald-600/60 leading-none mb-1">آخر نسخة</p>
                                        <p className="text-xs font-black text-emerald-700">{backups && backups.length > 0 ? new Date(backups[0].createdAt).toLocaleString('ar-EG') : 'لا يوجد'}</p>
                                    </div>
                                </div>

                                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                                        <HardDrive size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-black text-blue-600/60 leading-none mb-1">مساحة التخزين</p>
                                        <p className="text-xs font-black text-blue-700">{backups ? formatSize(backups.reduce((sum, b) => sum + b.size, 0)) : '0 MB'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Backups Table */}
                    <div className="bg-white rounded-3xl shadow-xl border-2 border-primary/10 overflow-hidden">
                        <div className="p-6 border-b border-primary/10 bg-slate-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <History size={20} className="text-primary" />
                                <h3 className="text-lg font-black text-primary">أرشيف النسخ الاحتياطية</h3>
                            </div>
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{backups?.length || 0} نسخة محفوظة</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                                        <th className="px-6 py-4">اسم الملف</th>
                                        <th className="px-6 py-4">تاريخ الإنشاء</th>
                                        <th className="px-6 py-4">الحجم</th>
                                        <th className="px-6 py-4 text-center">الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isBackupsLoading ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center">
                                                <RefreshCw className="animate-spin text-primary inline-block mb-3" size={32} />
                                                <p className="text-slate-400 font-bold">جاري تحميل النسخ الاحتياطية...</p>
                                            </td>
                                        </tr>
                                    ) : backups?.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center">
                                                <Database className="text-slate-200 inline-block mb-3" size={48} />
                                                <p className="text-slate-400 font-bold">لا توجد نسخ احتياطية حتى الآن</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        backups?.map((backup) => (
                                            <tr key={backup.filename} className="hover:bg-blue-50/30 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-slate-100 rounded-lg text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                                            <Save size={16} />
                                                        </div>
                                                        <span className="text-sm font-black text-slate-700 truncate max-w-[200px]" dir="ltr">
                                                            {backup.filename}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-slate-500 text-sm">
                                                    {new Date(backup.createdAt).toLocaleString('ar-EG')}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black">
                                                        {formatSize(backup.size)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => setBackupToRestore(backup.filename)}
                                                            className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all"
                                                            title="استرجاع"
                                                        >
                                                            <RefreshCw size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => setBackupToDelete(backup.filename)}
                                                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                                            title="حذف"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
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

                {/* Right Column: Logs & Activity */}
                <div className="space-y-8">
                    {/* Activity Logs */}
                    <div className="bg-white rounded-3xl shadow-xl border-2 border-primary/10 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <Clock size={20} className="text-primary" />
                            <h3 className="text-lg font-black text-primary">آخر العمليات</h3>
                        </div>

                        <div className="space-y-4">
                            {isLogsLoading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <div key={i} className="animate-pulse flex items-start gap-3">
                                        <div className="w-8 h-8 bg-slate-100 rounded-lg" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-3 bg-slate-100 rounded w-3/4" />
                                            <div className="h-2 bg-slate-100 rounded w-1/2" />
                                        </div>
                                    </div>
                                ))
                            ) : logs?.length === 0 ? (
                                <p className="text-center text-slate-400 py-4 font-bold">لا يوجد سجل نشاط</p>
                            ) : (
                                logs?.map((log) => (
                                    <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className={`p-2 rounded-lg shrink-0 ${log.action === 'BACKUP_CREATE' ? 'bg-emerald-100 text-emerald-600' :
                                            log.action === 'BACKUP_RESTORE' ? 'bg-blue-100 text-blue-600' :
                                                'bg-rose-100 text-rose-600'
                                            }`}>
                                            {log.action === 'BACKUP_CREATE' ? <Database size={14} /> :
                                                log.action === 'BACKUP_RESTORE' ? <RefreshCw size={14} /> :
                                                    <Trash2 size={14} />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-black text-slate-800 leading-tight">
                                                {log.action === 'BACKUP_CREATE' ? 'تم إنشاء نسخة احتياطية' :
                                                    log.action === 'BACKUP_RESTORE' ? 'تم استرجاع النظام' :
                                                        'تم حذف نسخة احتياطية'}
                                            </p>
                                            <p className="text-[9px] font-bold text-slate-400 mt-1">
                                                بواسطة: {log.performedBy} • {new Date(log.createdAt).toLocaleDateString('ar-EG')}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Warning Card */}
                    <div className="smart-alert smart-alert-warning">
                        <div className="shrink-0 pt-1">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <p className="text-xs font-black mb-1">تنبيه هام</p>
                            <p className="text-[10px] font-bold opacity-80 leading-relaxed">
                                عملية استرجاع البيانات هي عملية "إحلال"، سيؤدي استرجاع نسخة قديمة إلى مسح كافة البيانات الحالية التي أُضيفت بعد ذلك التاريخ.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation */}
            <ConfirmDialog
                isOpen={!!backupToDelete}
                title="حذف النسخة الاحتياطية"
                message={`هل أنت متأكد من حذف الملف "${backupToDelete}"؟`}
                confirmText="نعم، حذف نهائياً"
                onConfirm={() => {
                    if (backupToDelete) {
                        deleteMutation.mutate(backupToDelete);
                        setBackupToDelete(null);
                    }
                }}
                onCancel={() => setBackupToDelete(null)}
                type="danger"
            />

            {/* Restore Confirmation */}
            <ConfirmDialog
                isOpen={!!backupToRestore}
                title="استرجاع البيانات"
                message={`هل أنت متأكد من استرجاع البيانات من الملف "${backupToRestore}"؟ سيتم الاحتفاظ بنسخة من الحالة الحالية تلقائياً قبل البدء.`}
                confirmText="بدء عملية الاسترجاع"
                onConfirm={() => {
                    if (backupToRestore) {
                        restoreMutation.mutate(backupToRestore);
                        setBackupToRestore(null);
                    }
                }}
                onCancel={() => setBackupToRestore(null)}
                type="warning"
            />
        </div>
    );
}
