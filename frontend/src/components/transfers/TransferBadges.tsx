import React from 'react';
import { STATUS_MAP, ORDER_TYPES } from './constants';
import { cn } from '../../lib/utils';

export function TransferOrderStatusBadge({ status }: { status: string }) {
    const config = (STATUS_MAP as any)[status] || (STATUS_MAP as any).PENDING;
    const StatusIcon = config.icon;

    const colorStyles: Record<string, string> = {
        amber: 'bg-amber-100 text-amber-700 border-amber-200 shadow-amber-50',
        emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-emerald-50',
        blue: 'bg-blue-100 text-blue-700 border-blue-200 shadow-blue-50',
        red: 'bg-red-100 text-red-700 border-red-200 shadow-red-50',
        slate: 'bg-slate-100 text-slate-700 border-slate-200 shadow-slate-50',
    };

    return (
        <span className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border shadow-sm transition-all",
            colorStyles[config.color] || colorStyles.slate
        )}>
            <StatusIcon size={14} className="opacity-70" />
            {config.label}
        </span>
    );
}

export function TransferOrderTypeBadge({ type }: { type: string }) {
    const orderType = ORDER_TYPES.find(t => t.value === type);
    if (!orderType) return <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-slate-100 text-slate-700 border border-slate-200 shadow-sm">{type}</span>;

    const colorStyles: Record<string, string> = {
        indigo: 'bg-primary/10 text-primary border-primary/10 shadow-primary/20',
        purple: 'bg-purple-50 text-purple-700 border-purple-100 shadow-purple-50',
        gray: 'bg-slate-50 text-slate-700 border-slate-100 shadow-slate-50',
    };

    return (
        <span className={cn(
            "inline-flex px-3 py-1.5 rounded-xl text-xs font-black border shadow-sm",
            colorStyles[orderType.color] || colorStyles.gray
        )}>
            {orderType.label}
        </span>
    );
}
