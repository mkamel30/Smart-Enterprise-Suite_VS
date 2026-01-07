import React from 'react';
import { Search, Filter } from 'lucide-react';

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
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
            <div className="relative w-full md:w-96">
                <Search className="absolute right-3 top-2.5 text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="بحث بمسلسل الشريحة، النوع..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 border rounded focus:ring-2 focus:ring-purple-500 outline-none"
                />
            </div>
            {isAdmin && (
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-slate-400" />
                    <select
                        value={filterBranchId}
                        onChange={(e) => onBranchChange(e.target.value)}
                        className="border rounded-lg px-2 py-2 text-sm flex-1 md:w-auto"
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
