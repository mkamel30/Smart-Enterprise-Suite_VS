import React from 'react';
import { TYPE_COLORS, STATUS_MAP } from './constants';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

interface SimTypeBadgeProps {
    type: string | null;
}

export function SimTypeBadge({ type }: SimTypeBadgeProps) {
    const colorClass = (TYPE_COLORS as any)[type || ''] || (TYPE_COLORS as any)['غير محدد'];
    return (
        <Badge
            variant="secondary"
            className={cn("font-bold px-2 py-0.5 rounded-md", colorClass)}
        >
            {type || 'غير محدد'}
        </Badge>
    );
}

interface SimStatusBadgeProps {
    status: string;
}

export function SimStatusBadge({ status }: SimStatusBadgeProps) {
    const config = (STATUS_MAP as any)[status] || { label: status, color: 'gray' };

    const colorStyles: Record<string, string> = {
        green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        blue: 'bg-blue-100 text-blue-700 border-blue-200',
        red: 'bg-red-100 text-red-700 border-red-200',
        gray: 'bg-slate-100 text-slate-700 border-slate-200',
    };

    return (
        <Badge
            className={cn(
                "font-black px-2.5 py-1 rounded-lg border shadow-sm",
                colorStyles[config.color] || colorStyles.gray
            )}
        >
            {config.label}
        </Badge>
    );
}
