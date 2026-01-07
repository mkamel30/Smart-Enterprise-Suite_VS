import React from 'react';
import { Search } from 'lucide-react';
import { ORDER_TYPES } from './constants';

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
    userBranchId
}: FiltersProps) {
    return (
        <div className="p-4 border-b flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
                <input
                    type="text"
                    placeholder="بحث برقم الإذن، الفرع، أو سيريال الماكينة أو الشريحة..."
                    value={searchTerm}
                    onChange={e => onSearchChange(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 border rounded-lg"
                />
            </div>
            <select
                value={filterStatus}
                onChange={e => onStatusChange(e.target.value)}
                className="border rounded-lg px-3 py-2"
            >
                <option value="">كل الحالات</option>
                <option value="PENDING">معلق</option>
                <option value="RECEIVED">مستلم</option>
                <option value="PARTIAL">جزئي</option>
                <option value="REJECTED">مرفوض</option>
            </select>
            <select
                value={filterType}
                onChange={e => onTypeChange(e.target.value)}
                className="border rounded-lg px-3 py-2"
            >
                <option value="">كل الأنواع</option>
                {ORDER_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                ))}
            </select>
            {!userBranchId && (
                <select
                    value={filterBranch}
                    onChange={e => onBranchChange(e.target.value)}
                    className="border rounded-lg px-3 py-2"
                >
                    <option value="">كل الفروع</option>
                    {branches?.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
            )}
        </div>
    );
}
