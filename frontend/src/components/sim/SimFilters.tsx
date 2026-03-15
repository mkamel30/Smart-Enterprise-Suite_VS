import React from 'react';
import { Search, Filter } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FiltersProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    isAdmin: boolean;
    filterBranchId: string;
    onBranchChange: (value: string) => void;
    branches: any[] | undefined;
}

export function SimFilters({
    searchTerm,
    onSearchChange,
    isAdmin,
    filterBranchId,
    onBranchChange,
    branches
}: FiltersProps) {
    return (
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
            <div className="relative flex-1 group">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                <input
                    type="text"
                    placeholder="بحث بمسلسل الشريحة أو الشركة..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pr-12 pl-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                />
            </div>

            {isAdmin && (
                <div className="flex items-center gap-3 bg-slate-100/50 p-2 rounded-2xl border border-slate-200/50 shadow-sm">
                    <Filter size={18} className="text-slate-400 mr-2" />
                    <select
                        value={filterBranchId}
                        onChange={(e) => onBranchChange(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 outline-none min-w-[150px] cursor-pointer"
                    >
                        <option value="">كل الفروع</option>
                        {branches?.map((branch: any) => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
}
