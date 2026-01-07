import React from 'react';

interface StatsProps {
    stats: {
        orders?: {
            pending: number;
            received: number;
            total: number;
        }
    };
}

export function TransferOrdersStats({ stats }: StatsProps) {
    return (
        <div className="flex gap-4">
            <div className="bg-yellow-50 px-4 py-2 rounded-lg">
                <span className="text-yellow-700 font-bold">{stats?.orders?.pending || 0}</span>
                <span className="text-yellow-600 text-sm mr-1">معلق</span>
            </div>
            <div className="bg-green-50 px-4 py-2 rounded-lg">
                <span className="text-green-700 font-bold">{stats?.orders?.received || 0}</span>
                <span className="text-green-600 text-sm mr-1">مستلم</span>
            </div>
            <div className="bg-blue-50 px-4 py-2 rounded-lg">
                <span className="text-blue-700 font-bold">{stats?.orders?.total || 0}</span>
                <span className="text-blue-600 text-sm mr-1">إجمالي</span>
            </div>
        </div>
    );
}
