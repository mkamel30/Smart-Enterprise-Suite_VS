import React from 'react';
import { motion } from 'framer-motion';
import { Monitor, RotateCcw, AlertTriangle, Wrench, CheckCircle } from 'lucide-react';
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

interface MachineWarehouseStatsProps {
    counts: Record<string, number> | undefined;
    isAffairs: boolean;
    isCenterManager: boolean;
}

export const MachineWarehouseStats: React.FC<MachineWarehouseStatsProps> = ({ counts, isAffairs, isCenterManager }) => {
    const stats = [
        {
            id: 'NEW',
            label: 'ماكينات جديدة',
            value: counts?.NEW || 0,
            icon: <Monitor size={24} />,
            color: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
            show: !isCenterManager
        },
        {
            id: 'STANDBY',
            label: 'ماكينات استبدال',
            value: counts?.STANDBY || 0,
            icon: <RotateCcw size={24} />,
            color: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100',
            show: !isCenterManager && !isAffairs
        },
        {
            id: 'DEFECTIVE',
            label: 'ماكينات تالفة',
            value: counts?.DEFECTIVE || 0,
            icon: <AlertTriangle size={24} />,
            color: 'bg-red-50 text-red-600 group-hover:bg-red-100',
            show: true
        },
        {
            id: 'CLIENT_REPAIR',
            label: isCenterManager ? 'وارد الصيانة' : 'صيانة عملاء',
            value: (counts?.CLIENT_REPAIR || 0) + (counts?.AT_CENTER || 0) + (counts?.EXTERNAL_REPAIR || 0),
            icon: <Wrench size={24} />,
            color: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100',
            show: !isAffairs
        },
        {
            id: 'REPAIRED',
            label: 'ماكينات تم صيانتها',
            value: counts?.REPAIRED || 0,
            icon: <CheckCircle size={24} />,
            color: 'bg-teal-50 text-teal-600 group-hover:bg-teal-100',
            show: !isCenterManager && !isAffairs
        },
    ].filter(s => s.show);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {stats.map((stat, index) => (
                <StatCard
                    key={stat.id}
                    label={stat.label}
                    value={stat.value}
                    icon={stat.icon}
                    color={stat.color}
                    delay={index * 0.1}
                />
            ))}
        </div>
    );
};
