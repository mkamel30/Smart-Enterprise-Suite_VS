import React from 'react';
import { Building2 } from 'lucide-react';

interface ReportsFiltersProps {
    filters: {
        startDate: string;
        endDate: string;
        branchId: string;
    };
    setFilters: (filters: any) => void;
    isCentral: boolean;
    branches: any[] | undefined;
    onReset: () => void;
}

export function ReportsFilters({ filters, setFilters, isCentral, branches, onReset }: ReportsFiltersProps) {
    return (
        <div className="bg-card p-4 rounded-3xl border border-border flex flex-wrap gap-4 items-center shadow-sm">
            <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-2xl border border-border transition-all focus-within:ring-2 focus-within:ring-primary/20">
                <span className="text-xs font-black text-muted-foreground">من:</span>
                <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="bg-transparent border-none outline-none text-sm font-bold"
                />
            </div>
            <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-2xl border border-border transition-all focus-within:ring-2 focus-within:ring-primary/20">
                <span className="text-xs font-black text-muted-foreground">إلى:</span>
                <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="bg-transparent border-none outline-none text-sm font-bold"
                />
            </div>
            {isCentral && branches && (
                <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-2xl border border-border transition-all focus-within:ring-2 focus-within:ring-primary/20">
                    <Building2 size={16} className="text-muted-foreground" />
                    <select
                        value={filters.branchId}
                        onChange={(e) => setFilters({ ...filters, branchId: e.target.value })}
                        className="bg-transparent border-none outline-none text-sm font-bold min-w-[140px]"
                    >
                        <option value="">جميع الفروع</option>
                        {Array.isArray(branches) && branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
            )}
            <button
                onClick={onReset}
                className="text-xs font-black text-primary hover:underline px-4 hover:scale-105 transition-transform"
            >
                إعادة ضبط الفلاتر
            </button>
        </div>
    );
}
