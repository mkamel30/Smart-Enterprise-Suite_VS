import React from 'react';
import { Search, Filter, Landmark, Tag } from 'lucide-react';
import { ORDER_TYPES } from './constants';
import { cn } from '../../lib/utils';

interface FiltersProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    filterStatus: string;
    onStatusChange: (value: string) => void;
    filterType: string;
    onTypeChange: (value: string) => void;
    filterBranch: string;
    onBranchChange: (value: string) => void;
    branches: any[] | undefined;
    userBranchId?: string;
    userRole?: string;
}

export function TransferOrdersFilters({
    searchTerm,
    onSearchChange,
    filterStatus,
    onStatusChange,
    filterType,
    onTypeChange,
    filterBranch,
    onBranchChange,
    branches,
    userRole
}: FiltersProps) {
    const isGlobal = userRole === 'SUPER_ADMIN' || userRole === 'MANAGEMENT' || userRole === 'ADMIN_AFFAIRS';

    return (
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
            <div className="relative flex-1 group">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                <input
                    type="text"
                    placeholder="بحث برقم الإذن، الفرع، أو سيريال الماكينة..."
                    value={searchTerm}
                    onChange={e => onSearchChange(e.target.value)}
                    className="w-full pr-12 pl-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium"
                />
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-100/50 p-2 rounded-2xl border border-slate-200/50 shadow-sm min-w-[140px]">
                    <Tag size={18} className="text-slate-400 mr-2" />
                    <select
                        value={filterStatus}
                        onChange={e => onStatusChange(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-xs font-black text-slate-700 outline-none cursor-pointer flex-1"
                    >
                        <option value="">كل الحالات</option>
                        <option value="PENDING">معلق</option>
                        <option value="COMPLETED">مستلم</option>
                        <option value="PARTIAL">جزئي</option>
                        <option value="REJECTED">مرفوض</option>
                        <option value="CANCELLED">ملغي</option>
                    </select>
                </div>

                <div className="flex items-center gap-2 bg-slate-100/50 p-2 rounded-2xl border border-slate-200/50 shadow-sm min-w-[140px]">
                    <Filter size={18} className="text-slate-400 mr-2" />
                    <select
                        value={filterType}
                        onChange={e => onTypeChange(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-xs font-black text-slate-700 outline-none cursor-pointer flex-1"
                    >
                        <option value="">كل الأنواع</option>
                        {ORDER_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>

                {isGlobal && (
                    <div className="flex items-center gap-2 bg-slate-100/50 p-2 rounded-2xl border border-slate-200/50 shadow-sm min-w-[160px]">
                        <Landmark size={18} className="text-slate-400 mr-2" />
                        <select
                            value={filterBranch}
                            onChange={e => onBranchChange(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-xs font-black text-slate-700 outline-none cursor-pointer flex-1"
                        >
                            <option value="">كل الفروع</option>
                            {branches?.map((b: any) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
}
