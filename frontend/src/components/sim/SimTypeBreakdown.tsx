import React from 'react';
import { X, PieChart } from 'lucide-react';
import { TYPE_COLORS } from './constants';
import { cn } from '../../lib/utils';

interface TypeBreakdownProps {
    counts: {
        byType?: Record<string, number>;
    } | undefined;
    typeFilter: string;
    setTypeFilter: (type: string) => void;
}

export function SimTypeBreakdown({ counts, typeFilter, setTypeFilter }: TypeBreakdownProps) {
    const byType = counts?.byType || {};
    if (Object.keys(byType).length === 0) {
        return (
            <div className="bg-white/50 border border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center text-center gap-2 h-full min-h-[200px]">
                <div className="p-3 bg-slate-100 rounded-2xl text-slate-400">
                    <PieChart size={24} />
                </div>
                <p className="text-slate-500 font-bold text-sm">لا يوجد تصنيف حالياً</p>
                <p className="text-slate-400 text-xs">قم بإضافة شرائح لتفعيل الإحصائيات</p>
            </div>
        );
    }

    return (
        <div className="bg-white/50 border border-slate-200 rounded-3xl p-6 shadow-sm h-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                        <PieChart size={18} />
                    </div>
                    <h3 className="font-black text-slate-800 text-sm tracking-tight">تصنيف الشركات</h3>
                </div>
                {typeFilter && (
                    <button
                        onClick={() => setTypeFilter('')}
                        className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 transition-colors"
                    >
                        <X size={14} />
                        إلغاء التحديد
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {Object.entries(byType).map(([type, count]) => (
                    <button
                        key={type}
                        onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
                        className={cn(
                            "w-full flex items-center justify-between p-3 rounded-2xl border transition-all duration-300",
                            typeFilter === type
                                ? "ring-2 ring-primary border-primary bg-white shadow-lg shadow-primary/20 translate-x-2"
                                : "border-slate-100 bg-white hover:border-primary/20 hover:shadow-md hover:translate-x-1"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <div className={cn("w-3 h-3 rounded-full", (TYPE_COLORS as any)[type] || (TYPE_COLORS as any)['غير محدد'])} />
                            <span className="font-bold text-slate-700 text-sm">{type}</span>
                        </div>
                        <span className="bg-slate-50 text-slate-600 px-2.5 py-1 rounded-lg text-xs font-black border border-slate-100">
                            {count as number}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
