import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { COLORS } from './ExecutiveDashboardConstants';

interface KPICardProps {
    title: string;
    value: string | number;
    unit?: string;
    change?: number;
    icon: React.ReactNode;
    trend?: 'up' | 'down' | 'neutral';
    color?: string;
    subtext?: string;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, unit, change, icon, trend, color = COLORS.primary, subtext }) => {
    const isPositive = (change ?? 0) >= 0;

    return (
        <div className="kpi-card" style={{ borderRightColor: color }}>
            <div className="kpi-header">
                <div className="kpi-icon" style={{ backgroundColor: `${color}15`, color }}>
                    {icon}
                </div>
                <span className="kpi-title">{title}</span>
            </div>
            <div className="kpi-value">
                <span className="value">{typeof value === 'number' ? value.toLocaleString('ar-EG') : value}</span>
                {unit && <span className="unit">{unit}</span>}
            </div>
            {change !== undefined && (
                <div className={`kpi-change ${isPositive ? 'positive' : 'negative'}`}>
                    {isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    <span>{Math.abs(change)}%</span>
                    <span className="period">عن الفترة السابقة</span>
                </div>
            )}
            {subtext && <div className="kpi-subtext">{subtext}</div>}
        </div>
    );
};

export default KPICard;
