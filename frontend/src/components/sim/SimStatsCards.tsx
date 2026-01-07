import React from 'react';

interface StatsCardsProps {
    counts: {
        total?: number;
        ACTIVE?: number;
        IN_TRANSIT?: number;
        DEFECTIVE?: number;
    } | undefined;
}

export function SimStatsCards({ counts }: StatsCardsProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
            <div className="bg-white rounded-lg border p-4 shadow-sm">
                <div className="text-sm text-slate-500">إجمالي الشرائح</div>
                <div className="text-2xl font-bold text-purple-600">{counts?.total || 0}</div>
            </div>
            <div className="bg-white rounded-lg border p-4 shadow-sm">
                <div className="text-sm text-slate-500">شرائح سليمة</div>
                <div className="text-2xl font-bold text-green-600">{counts?.ACTIVE || 0}</div>
            </div>
            <div className="bg-white rounded-lg border p-4 shadow-sm">
                <div className="text-sm text-slate-500">شرائح في الطريق</div>
                <div className="text-2xl font-bold text-blue-600">{counts?.IN_TRANSIT || 0}</div>
            </div>
            <div className="bg-white rounded-lg border p-4 shadow-sm">
                <div className="text-sm text-slate-500">شرائح تالفة</div>
                <div className="text-2xl font-bold text-red-600">{counts?.DEFECTIVE || 0}</div>
            </div>
        </div>
    );
}
