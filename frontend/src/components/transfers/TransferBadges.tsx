import React from 'react';
import { STATUS_MAP, ORDER_TYPES } from './constants';

export function TransferOrderStatusBadge({ status }: { status: string }) {
    const config = STATUS_MAP[status] || STATUS_MAP.PENDING;
    const StatusIcon = config.icon;

    return (
        <span className={`flex items-center gap-1 px-2 py-1 rounded text-sm bg-${config.color}-100 text-${config.color}-700`}>
            <StatusIcon size={14} />
            {config.label}
        </span>
    );
}

export function TransferOrderTypeBadge({ type }: { type: string }) {
    const orderType = ORDER_TYPES.find(t => t.value === type);
    if (!orderType) return <span className="px-2 py-1 rounded text-sm bg-slate-100 text-slate-700">{type}</span>;

    return (
        <span className={`px-2 py-1 rounded text-sm bg-${orderType.color}-100 text-${orderType.color}-700`}>
            {orderType.label}
        </span>
    );
}
