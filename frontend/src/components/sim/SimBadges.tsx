import React from 'react';
import { TYPE_COLORS, STATUS_MAP } from './constants';

interface SimTypeBadgeProps {
    type: string | null;
}

export function SimTypeBadge({ type }: SimTypeBadgeProps) {
    const colorClass = TYPE_COLORS[type || ''] || TYPE_COLORS['غير محدد'];
    return (
        <span className={`px-2 py-1 rounded text-xs ${colorClass.split(' ').slice(0, 3).join(' ')}`}>
            {type || 'غير محدد'}
        </span>
    );
}

interface SimStatusBadgeProps {
    status: string;
}

export function SimStatusBadge({ status }: SimStatusBadgeProps) {
    const config = STATUS_MAP[status] || { label: status, color: 'gray' };
    return (
        <span className={`px-2 py-1 rounded text-xs bg-${config.color}-100 text-${config.color}-700`}>
            {config.label}
        </span>
    );
}
