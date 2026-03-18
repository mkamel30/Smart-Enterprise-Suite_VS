import React from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StatsProps {
    stats: {
        orders?: {
            pending: number;
            received: number;
            cancelled: number;
            total: number;
        }
    };
}

const StatCard = ({ label, value, icon, color, delay }: { label: string; value: number; icon: React.ReactNode; color: string; delay: number }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="bg-white/50 backdrop-blur-sm border border-slate-200 p-6 rounded-[24px] shadow-sm flex items-center gap-4 group transition-all hover:shadow-md hover:bg-white"
    >
        <div className={cn("p-4 rounded-xl transition-all group-hover:scale-110", color)}>
            {icon}
        </div>
        <div>
            <p className="text-slate-500 text-xs font-black uppercase tracking-wider mb-0.5">{label}</p>
            <h3 className="text-2xl font-black text-slate-800">{value}</h3>
        </div>
    </motion.div>
);

export function TransferOrdersStats({ stats }: StatsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
                label="أذونات معلقة"
                value={stats?.orders?.pending || 0}
                icon={<Clock size={24} />}
                color="bg-amber-100 text-amber-600 shadow-lg shadow-amber-50"
                delay={0.1}
            />
            <StatCard
                label="أذونات مستلمة"
                value={stats?.orders?.received || 0}
                icon={<CheckCircle2 size={24} />}
                color="bg-emerald-100 text-emerald-600 shadow-lg shadow-emerald-50"
                delay={0.2}
            />
            <StatCard
                label="أذونات ملغاة"
                value={stats?.orders?.cancelled || 0}
                icon={<XCircle size={24} />}
                color="bg-red-100 text-red-600 shadow-lg shadow-red-50"
                delay={0.3}
            />
            <StatCard
                label="إجمالي الأذونات"
                value={stats?.orders?.total || 0}
                icon={<BarChart3 size={24} />}
                color="bg-primary/5 text-primary shadow-lg shadow-primary/20"
                delay={0.4}
            />
        </div>
    );
}
