import React from 'react';
import { X } from 'lucide-react';
import { TYPE_COLORS } from './constants';

interface TypeBreakdownProps {
    counts: {
        byType?: Record<string, number>;
    } | undefined;
    typeFilter: string;
    setTypeFilter: (type: string) => void;
}

export function SimTypeBreakdown({ counts, typeFilter, setTypeFilter }: TypeBreakdownProps) {
    if (!counts?.byType || Object.keys(counts.byType).length === 0) return null;

    return (
        <div className="mb-6">
            <div className="text-sm font-medium text-slate-500 mb-2">تصنيف حسب النوع</div>
            <div className="flex flex-wrap gap-2">
                {Object.entries(counts.byType).map(([type, count]) => (
                    <button
                        key={type}
                        onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${typeFilter === type
                            ? 'ring-2 ring-purple-500 ring-offset-1 shadow-md'
                            : 'hover:shadow-sm bg-white'
                            } ${TYPE_COLORS[type] || TYPE_COLORS['غير محدد']}`}
                    >
                        <span className="font-bold">{type}</span>
                        <span className="mr-2 bg-white/50 px-2 py-0.5 rounded-full text-xs">
                            {count as number}
                        </span>
                    </button>
                ))}
                {typeFilter && (
                    <button
                        onClick={() => setTypeFilter('')}
                        className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                    >
                        <X size={14} />
                        <span className="text-xs">إلغاء الفلتر</span>
                    </button>
                )}
            </div>
        </div>
    );
}
