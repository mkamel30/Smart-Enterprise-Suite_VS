import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { Users, FileText, DollarSign, Calendar, AlertCircle, TrendingUp, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import type { InstallmentStats } from '../lib/types';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: any;
    color: 'blue' | 'indigo' | 'emerald' | 'purple' | 'red';
    subValue?: string;
    onClick?: () => void;
    index: number;
}

const colorMap = {
    blue: {
        bg: 'bg-blue-50/50',
        iconBg: 'bg-blue-600 shadow-blue-200',
        text: 'text-blue-600',
        border: 'border-blue-100/50',
        hoverBorder: 'hover:border-blue-200',
        glow: 'from-blue-600/20 to-transparent'
    },
    indigo: {
        bg: 'bg-primary/10',
        iconBg: 'bg-primary shadow-primary/20',
        text: 'text-primary',
        border: 'border-primary/10',
        hoverBorder: 'hover:border-primary/20',
        glow: 'from-primary/20 to-transparent'
    },
    emerald: {
        bg: 'bg-emerald-50/50',
        iconBg: 'bg-emerald-600 shadow-emerald-200',
        text: 'text-emerald-600',
        border: 'border-emerald-100/50',
        hoverBorder: 'hover:border-emerald-200',
        glow: 'from-emerald-600/20 to-transparent'
    },
    purple: {
        bg: 'bg-purple-50/50',
        iconBg: 'bg-purple-600 shadow-purple-200',
        text: 'text-purple-600',
        border: 'border-purple-100/50',
        hoverBorder: 'hover:border-purple-200',
        glow: 'from-purple-600/20 to-transparent'
    },
    red: {
        bg: 'bg-red-50/50',
        iconBg: 'bg-red-600 shadow-red-200',
        text: 'text-red-600',
        border: 'border-red-100/50',
        hoverBorder: 'hover:border-red-200',
        glow: 'from-red-600/20 to-transparent'
    }
};

const StatCard = ({ title, value, icon: Icon, color, subValue, onClick, index }: StatCardProps) => {
    const theme = colorMap[color];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            onClick={onClick}
            className={cn(
                "relative p-6 rounded-[2rem] border-2 bg-white transition-all overflow-hidden group",
                theme.border,
                theme.hoverBorder,
                onClick ? "cursor-pointer active:scale-95 shadow-lg hover:shadow-2xl" : "shadow-xl shadow-slate-200/50"
            )}
        >
            {/* Background Glow */}
            <div className={cn("absolute -right-20 -bottom-20 w-64 h-64 bg-gradient-to-tl rounded-full blur-[80px] opacity-0 group-hover:opacity-40 transition-opacity duration-700", theme.glow)} />

            <div className="flex items-start justify-between relative z-10">
                <div className="text-right">
                    <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mb-3 leading-none">{title}</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-3xl font-black text-slate-900 font-mono tracking-tighter">{value}</h3>
                        {color === 'emerald' && <span className="text-[10px] font-black text-emerald-600 uppercase">ج.م</span>}
                    </div>
                    {subValue && (
                        <div className="flex items-center gap-2 mt-4 text-slate-500">
                            <div className={cn("w-1.5 h-1.5 rounded-full", color === 'red' ? "bg-red-500 animate-pulse" : "bg-slate-300")} />
                            <p className="text-[11px] font-bold tracking-tight">{subValue}</p>
                        </div>
                    )}
                </div>

                <div className={cn(
                    "p-4 rounded-2xl text-white shadow-xl transition-all duration-500 group-hover:rotate-12 group-hover:scale-110",
                    theme.iconBg
                )}>
                    <Icon size={24} strokeWidth={2.5} />
                </div>
            </div>

            {onClick && (
                <div className="absolute left-6 bottom-6 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
                    <ArrowRight className={cn("rotate-180", theme.text)} size={18} />
                </div>
            )}
        </motion.div>
    );
};

export default function InstallmentsDashboard({ onFilterOverdue }: { onFilterOverdue: () => void }) {
    const { data: stats, isLoading } = useQuery<InstallmentStats>({
        queryKey: ['installment-stats'],
        queryFn: () => api.getInstallmentStats()
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-40 bg-white border-2 border-slate-50 rounded-[2rem] animate-pulse flex items-center justify-center">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl" />
                    </div>
                ))}
            </div>
        );
    }

    if (!stats) return null;

    return (
        <div className="mb-10 animate-in fade-in duration-700">
            <div className="flex items-center justify-between mb-8 px-2">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl">
                        <TrendingUp size={24} />
                    </div>
                    <div className="text-right">
                        <h2 className="text-xl font-black text-slate-900">نظرة عامة على التحصيل</h2>
                        <p className="text-xs font-bold text-slate-400">إحصائيات المبيعات والأقساط الجارية</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <StatCard
                    index={0}
                    title="العملاء (أقساط جارية)"
                    value={stats.customersCount}
                    icon={Users}
                    color="blue"
                    subValue="عميل لديه أقساط نشطة"
                />

                <StatCard
                    index={1}
                    title="الأقساط المتبقية"
                    value={stats.totalInstallments}
                    icon={FileText}
                    color="indigo"
                    subValue="إجمالي عدد الأقساط"
                />

                <StatCard
                    index={2}
                    title="المستحقات القائمة"
                    value={stats.totalValue.toLocaleString('ar-EG')}
                    icon={DollarSign}
                    color="emerald"
                    subValue="القيمة النقدية للمتبقي"
                />

                <StatCard
                    index={3}
                    title="متوسط مدة السداد"
                    value={`${stats.avgMonths} شهر`}
                    icon={Calendar}
                    color="purple"
                    subValue="متوسط فترة التقسيط"
                />

                <StatCard
                    index={4}
                    title="الأقساط المتأخرة"
                    value={stats.overdueCount}
                    subValue={`${stats.overdueCustomersCount} عميل لديهم متأخرات`}
                    icon={AlertCircle}
                    color="red"
                    onClick={onFilterOverdue}
                />
            </div>
        </div>
    );
}
