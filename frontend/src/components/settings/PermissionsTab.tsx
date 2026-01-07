import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Users, Lock, Check, Plus, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { ROLES, getRoleDisplayName } from '../../lib/permissions';

// Role colors for visual distinction
const ROLE_COLORS: Record<string, string> = {
    [ROLES.SUPER_ADMIN]: 'bg-red-100 text-red-800 border-red-200',
    [ROLES.MANAGEMENT]: 'bg-orange-100 text-orange-800 border-orange-200',
    [ROLES.ADMIN_AFFAIRS]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    [ROLES.CENTER_MANAGER]: 'bg-blue-100 text-blue-800 border-blue-200',
    [ROLES.CENTER_TECH]: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    [ROLES.BRANCH_MANAGER]: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    [ROLES.CS_SUPERVISOR]: 'bg-green-100 text-green-800 border-green-200',
    [ROLES.CS_AGENT]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

// Page labels in Arabic
const PAGE_LABELS: Record<string, string> = {
    '/': 'لوحة التحكم',
    '/requests': 'طلبات الصيانة',
    '/customers': 'العملاء',
    '/warehouse': 'مخزن قطع الغيار',
    '/warehouse-machines': 'مخزن الماكينات',
    '/warehouse-sims': 'مخزن الشرائح',
    '/transfer-orders': 'إنشاء الأذونات',
    '/receive-orders': 'استلام الأذونات',
    '/receipts': 'المبيعات والأقساط',
    '/payments': 'المدفوعات',
    '/reports': 'التقارير',
    '/technicians': 'إدارة المستخدمين',
    '/approvals': 'الموافقات',
    '/branches': 'إدارة الفروع',
    '/settings': 'الإعدادات',
};

// Action labels in Arabic
const ACTION_LABELS: Record<string, string> = {
    CREATE_REQUEST: 'فتح طلب صيانة',
    CLOSE_REQUEST: 'إغلاق طلب صيانة',
    DELETE_REQUEST: 'حذف طلب صيانة',
    EXCHANGE_MACHINE: 'استبدال ماكينة',
    RETURN_MACHINE: 'إرجاع ماكينة',
    SELL_MACHINE: 'بيع ماكينة',
    ADD_MACHINE: 'إضافة ماكينة للمخزن',
    DELETE_MACHINE: 'حذف ماكينة',
    EXCHANGE_SIM: 'استبدال شريحة',
    ADD_SIM: 'إضافة شريحة',
    DELETE_SIM: 'حذف شريحة',
    CREATE_TRANSFER: 'إنشاء أمر تحويل',
    RECEIVE_TRANSFER: 'استلام تحويل',
    REJECT_TRANSFER: 'رفض تحويل',
    ADD_CUSTOMER: 'إضافة عميل',
    EDIT_CUSTOMER: 'تعديل عميل',
    DELETE_CUSTOMER: 'حذف عميل',
    VIEW_PAYMENTS: 'عرض المدفوعات',
    ADD_PAYMENT: 'إضافة دفعة',
    MANAGE_USERS: 'إدارة المستخدمين',
    MANAGE_BRANCHES: 'إدارة الفروع',
    VIEW_ALL_BRANCHES: 'عرض كل الفروع',
};

export function PermissionsTab() {
    const [viewMode, setViewMode] = useState<'pages' | 'actions'>('pages');
    const [permissions, setPermissions] = useState<{
        pages: Record<string, Record<string, boolean>>;
        actions: Record<string, Record<string, boolean>>;
        roles: string[];
    } | null>(null);
    const [pendingChanges, setPendingChanges] = useState<Map<string, { role: string; permissionType: 'PAGE' | 'ACTION'; permissionKey: string; isAllowed: boolean }>>(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Fetch permissions from backend
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['permissions'],
        queryFn: () => api.getPermissions()
    });

    // Set permissions when data loads
    React.useEffect(() => {
        if (data) {
            setPermissions(data);
        }
    }, [data]);

    const displayRoles = [
        ROLES.SUPER_ADMIN,
        ROLES.MANAGEMENT,
        ROLES.ADMIN_AFFAIRS,
        ROLES.CENTER_MANAGER,
        ROLES.CENTER_TECH,
        ROLES.BRANCH_MANAGER,
        ROLES.CS_SUPERVISOR,
        ROLES.CS_AGENT,
    ];

    // Toggle a permission
    const togglePermission = (permissionType: 'PAGE' | 'ACTION', key: string, role: string) => {
        if (!permissions) return;

        // Prevent modifying SUPER_ADMIN critical permissions
        const criticalPerms = ['/', '/settings', '/technicians', '/branches', 'MANAGE_USERS', 'MANAGE_BRANCHES'];
        if (role === 'SUPER_ADMIN' && criticalPerms.includes(key)) {
            setMessage({ type: 'error', text: 'لا يمكن إزالة صلاحيات مدير النظام الأساسية' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        const source = permissionType === 'PAGE' ? permissions.pages : permissions.actions;
        const currentValue = source[key]?.[role] ?? false;
        const newValue = !currentValue;

        // Update local state
        setPermissions(prev => {
            if (!prev) return prev;
            const newPerms = { ...prev };
            if (permissionType === 'PAGE') {
                newPerms.pages = { ...newPerms.pages, [key]: { ...newPerms.pages[key], [role]: newValue } };
            } else {
                newPerms.actions = { ...newPerms.actions, [key]: { ...newPerms.actions[key], [role]: newValue } };
            }
            return newPerms;
        });

        // Track pending change
        const changeKey = `${permissionType}:${key}:${role}`;
        setPendingChanges(prev => {
            const newChanges = new Map(prev);
            newChanges.set(changeKey, { role, permissionType, permissionKey: key, isAllowed: newValue });
            return newChanges;
        });
    };

    // Save all pending changes
    const saveChanges = async () => {
        if (pendingChanges.size === 0) return;

        setIsSaving(true);
        try {
            const permissionsArray = Array.from(pendingChanges.values());
            await api.bulkUpdatePermissions(permissionsArray);
            setPendingChanges(new Map());
            setMessage({ type: 'success', text: `تم حفظ ${permissionsArray.length} تغيير بنجاح` });
            refetch();
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'فشل حفظ التغييرات' });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    // Reset to defaults
    const resetToDefaults = async () => {
        if (!confirm('هل أنت متأكد من استعادة الصلاحيات الافتراضية؟ سيتم حذف جميع التعديلات.')) return;

        setIsSaving(true);
        try {
            await api.resetPermissions();
            setPendingChanges(new Map());
            setMessage({ type: 'success', text: 'تم استعادة الصلاحيات الافتراضية' });
            refetch();
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'فشل استعادة الصلاحيات' });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    // Discard changes
    const discardChanges = () => {
        setPendingChanges(new Map());
        if (data) setPermissions(data);
    };

    if (isLoading || !permissions) {
        return (
            <div className="bg-white rounded-lg border shadow-sm p-8 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-500">جاري تحميل الصلاحيات...</p>
            </div>
        );
    }

    const hasChanges = pendingChanges.size > 0;

    return (
        <div className="bg-card rounded-[2.5rem] border border-border shadow-2xl overflow-hidden animate-fade-in relative">
            <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-[120px] -ml-40 -mt-40 pointer-events-none" />

            <div className="p-4 sm:p-6 border-b border-border relative z-10">
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black flex items-center gap-3 text-foreground">
                            <div className="p-2 sm:p-3 bg-primary/10 rounded-2xl text-primary">
                                <Shield size={24} />
                            </div>
                            مصفوفة الصلاحيات المتقدمة
                        </h2>
                    </div>
                    <div className="flex p-1 bg-muted rounded-xl gap-1">
                        <button
                            onClick={() => setViewMode('pages')}
                            className={`px-4 sm:px-6 py-2 rounded-lg text-xs font-black transition-all ${viewMode === 'pages' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:bg-card/50'}`}
                        >
                            <Users size={14} className="inline-block ml-1 opacity-50" />
                            الصفحات
                        </button>
                        <button
                            onClick={() => setViewMode('actions')}
                            className={`px-4 sm:px-6 py-2 rounded-lg text-xs font-black transition-all ${viewMode === 'actions' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:bg-card/50'}`}
                        >
                            <Lock size={14} className="inline-block ml-1 opacity-50" />
                            الإجراءات
                        </button>
                    </div>
                </div>
            </div>

            {/* Message Bar */}
            {message && (
                <div className={`p-5 text-sm font-black text-center animate-fade-in flex items-center justify-center gap-3 border-b ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                    {message.type === 'success' ? <Check size={20} /> : <Trash2 size={20} />}
                    {message.text}
                </div>
            )}

            {/* Roles Legend */}
            <div className="px-6 py-3 bg-muted/20 border-b border-border flex items-center gap-4 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">الأدوار المتاحة:</span>
                <div className="flex gap-2">
                    {displayRoles.map(role => (
                        <span key={role} className={`px-3 py-1 text-[9px] rounded-lg font-black border transition-all ${ROLE_COLORS[role] || 'bg-card border-border'}`}>
                            {getRoleDisplayName(role)}
                        </span>
                    ))}
                </div>
            </div>

            <div className="overflow-auto custom-scroll relative z-10 max-h-[calc(100vh-320px)] min-h-[300px]">
                <table className="w-full">
                    <thead className="sticky top-0 z-30">
                        <tr className="bg-muted/90 backdrop-blur-md border-b border-border">
                            <th className="text-right p-3 font-black uppercase tracking-widest text-[10px] text-muted-foreground sticky right-0 top-0 bg-muted/95 backdrop-blur-md z-50 min-w-[200px] shadow-[0_1px_4px_rgba(0,0,0,0.05)] border-b border-border">
                                {viewMode === 'pages' ? 'مسار الصفحة / الواجهة' : 'الإجراء الوظيفي'}
                            </th>
                            {displayRoles.map(role => (
                                <th key={role} className="p-3 text-center font-black text-[9px] uppercase tracking-tighter text-muted-foreground bg-muted/95 backdrop-blur-md sticky top-0 z-30 border-b border-border">
                                    {getRoleDisplayName(role)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                        {Object.entries(viewMode === 'pages' ? permissions.pages : permissions.actions).map(([key, rolePerms]) => (
                            <tr key={key} className="group hover:bg-primary/[0.02] transition-colors">
                                <td className="p-3 font-bold sticky right-0 bg-card/95 backdrop-blur-sm z-10 min-w-[200px] shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)]">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-foreground transition-colors group-hover:text-primary">
                                            {viewMode === 'pages' ? (PAGE_LABELS[key] || key) : (ACTION_LABELS[key] || key)}
                                        </span>
                                        {viewMode === 'pages' && <code className="text-[9px] text-muted-foreground mt-0.5 opacity-50 font-mono italic">{key}</code>}
                                    </div>
                                </td>
                                {displayRoles.map(role => {
                                    const isAllowed = rolePerms[role] ?? false;
                                    const changeKey = `${viewMode === 'pages' ? 'PAGE' : 'ACTION'}:${key}:${role}`;
                                    const isPending = pendingChanges.has(changeKey);

                                    return (
                                        <td key={role} className="p-2 text-center">
                                            <button
                                                onClick={() => togglePermission(viewMode === 'pages' ? 'PAGE' : 'ACTION', key, role)}
                                                className={`w-9 h-9 rounded-xl flex items-center justify-center mx-auto transition-all duration-300 relative group/btn ${isAllowed
                                                    ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                                                    : 'bg-muted/50 text-muted-foreground/30 hover:bg-muted/100'
                                                    } ${isPending ? 'ring-2 ring-primary/20 scale-105 shadow-md' : ''}`}
                                            >
                                                <div className={`transition-all duration-500 ${isAllowed ? 'scale-100 rotate-0' : 'scale-75 rotate-45'}`}>
                                                    {isAllowed ? <Check size={18} strokeWidth={4} /> : <Plus size={18} strokeWidth={4} className="opacity-20" />}
                                                </div>
                                                {isPending && (
                                                    <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-primary rounded-full animate-pulse -translate-y-1/3 translate-x-1/3 border border-white dark:border-slate-900" />
                                                )}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Action Bar Updated */}
            <div className={`p-4 sm:p-6 border-t flex justify-between items-center transition-all ${hasChanges ? 'bg-primary/5 border-primary/20' : 'bg-muted/20'}`}>
                <div className="flex items-center gap-3">
                    {hasChanges ? (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                                <Check className="text-primary" size={16} />
                            </div>
                            <span className="text-sm text-foreground font-black">
                                {pendingChanges.size} تغيير...
                            </span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground text-[10px] font-bold">
                            لا توجد تغييرات معلقة
                        </span>
                    )}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={resetToDefaults}
                        className="px-4 py-2 text-xs font-black text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all disabled:opacity-50"
                        disabled={isSaving}
                    >
                        استعادة الافتراضي
                    </button>
                    {hasChanges && (
                        <>
                            <button
                                onClick={discardChanges}
                                className="px-4 py-2 text-xs font-black text-muted-foreground hover:bg-muted rounded-xl transition-all"
                                disabled={isSaving}
                            >
                                تراجع
                            </button>
                            <button
                                onClick={saveChanges}
                                className="px-6 py-2 text-xs font-black bg-primary text-primary-foreground rounded-xl shadow-lg hover:shadow-xl transition-all"
                                disabled={isSaving}
                            >
                                {isSaving ? 'جاري...' : 'حفظ التغييرات'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
