import React from 'react';
import { TrendingUp } from 'lucide-react';
import {
    ComposedChart,
    Area,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { COLORS } from './ExecutiveDashboardConstants';
import type { ExecutiveData } from './ExecutiveDashboardTypes';

interface ForecastChartProps {
    monthlyTrend: ExecutiveData['monthlyTrend'];
    forecast?: ExecutiveData['forecast'];
}

const ForecastChart: React.FC<ForecastChartProps> = ({ monthlyTrend, forecast }) => {
    // Don't render if no data
    if (!monthlyTrend || monthlyTrend.length === 0) {
        return (
            <div className="chart-card large">
                <h3 className="chart-title">
                    <TrendingUp size={20} />
                    اتجاه الإيرادات والتوقعات
                </h3>
                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                    لا توجد بيانات لعرضها
                </div>
            </div>
        );
    }

    const chartData = [
        ...monthlyTrend.map(d => ({ ...d, type: 'actual' })),
        ...(forecast?.predictions || []).map(p => ({
            name: p.month,
            total: p.predicted,
            upperBound: p.upperBound,
            lowerBound: p.lowerBound,
            type: 'forecast'
        }))
    ];

    return (
        <div className="chart-card large">
            <h3 className="chart-title">
                <TrendingUp size={20} />
                اتجاه الإيرادات والتوقعات
                {forecast && (
                    <span className="forecast-badge">
                        📈 نمو متوقع: {forecast.growthRate}%
                    </span>
                )}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData}>
                    <defs>
                        <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="name" stroke="#6B7280" fontSize={12} />
                    <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)} ألف`} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                        formatter={(value: number, name: string) => [
                            `${(value / 1000).toFixed(1)}ألف ج.م`,
                            name === 'total' ? 'الإيراد' : name === 'upperBound' ? 'الحد الأعلى' : name === 'lowerBound' ? 'الحد الأدنى' : name
                        ]}
                    />
                    <Legend />
                    <Area
                        type="monotone"
                        dataKey="upperBound"
                        name="الحد الأعلى"
                        stroke="transparent"
                        fill={COLORS.purple}
                        fillOpacity={0.1}
                    />
                    <Area
                        type="monotone"
                        dataKey="lowerBound"
                        name="الحد الأدنى"
                        stroke="transparent"
                        fill="transparent"
                    />
                    <Area
                        type="monotone"
                        dataKey="total"
                        name="الإيراد"
                        stroke={COLORS.primary}
                        fill="url(#totalGradient)"
                        strokeWidth={3}
                        strokeDasharray={(chartData.length > 0 && chartData[chartData.length - 1].type === 'forecast') ? '5 5' : '0'}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

export default ForecastChart;
