import React from 'react';
import { motion } from 'framer-motion';
import { Smartphone, CheckCircle, Send, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StatCardProps {
    label: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    delay: number;
}

const StatCard = ({ label, value, icon, color, delay }: StatCardProps) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[24px] shadow-sm flex items-center gap-4 group transition-all hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-800"
    >
        <div className={cn("p-4 rounded-xl transition-colors", color)}>
            {icon}
        </div>
        <div>
            <p className="text-slate-500 text-sm font-medium">{label}</p>
            <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
        </div>
    </motion.div>
);

interface StatsCardsProps {
    counts: {
        total?: number;
        ACTIVE?: number;
        IN_TRANSIT?: number;
        DEFECTIVE?: number;
    } | undefined;
}

export function SimStatsCards({ counts }: StatsCardsProps) {
    const stats = [
        {
            label: 'إجمالي الشرائح',
            value: counts?.total || 0,
            icon: <Smartphone size={24} />,
            color: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100',
        },
        {
            label: 'شرائح سليمة',
            value: (counts as any)?.ACTIVE || counts?.ACTIVE || (counts as any)?.byStatus?.ACTIVE || 0,
            icon: <CheckCircle size={24} />,
            color: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100',
        },
        {
            label: 'شرائح في الطريق',
            value: (counts as any)?.IN_TRANSIT || counts?.IN_TRANSIT || (counts as any)?.byStatus?.IN_TRANSIT || 0,
            icon: <Send size={24} />,
            color: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
        },
        {
            label: 'شرائح تالفة',
            value: (counts as any)?.DEFECTIVE || (counts as any)?.DAMAGED || counts?.DEFECTIVE || (counts as any)?.byStatus?.DEFECTIVE || 0,
            icon: <AlertTriangle size={24} />,
            color: 'bg-red-50 text-red-600 group-hover:bg-red-100',
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, index) => (
                <StatCard
                    key={stat.label}
                    label={stat.label}
                    value={stat.value}
                    icon={stat.icon}
                    color={stat.color}
                    delay={index * 0.1}
                />
            ))}
        </div>
    );
}
