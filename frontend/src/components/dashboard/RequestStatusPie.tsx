import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

interface RequestStatusPieProps {
    data: any[];
    totalActive: number;
    colors: string[];
}

const RequestStatusPie: React.FC<RequestStatusPieProps> = ({ data, totalActive, colors }) => {
    return (
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
            <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                حالة الطلبات
            </h3>
            <div className="h-[200px] w-full relative min-w-0">
                <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={85}
                            paddingAngle={8}
                            dataKey="value"
                            animationBegin={0}
                            animationDuration={1500}
                        >
                            {Array.isArray(data) && data.map((_entry: any, index: number) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={colors[index % colors.length]}
                                    stroke="transparent"
                                    className="hover:opacity-80 transition-opacity outline-none"
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                borderRadius: '16px',
                                border: 'none',
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                padding: '12px'
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none translate-y-1">
                    <span className="text-4xl font-black text-slate-900 leading-none">{totalActive}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">طلب نشط</span>
                </div>
            </div>
            <div className="mt-6 space-y-2.5">
                {Array.isArray(data) && data.map((entry: any, index: number) => (
                    <div key={entry.name} className="flex justify-between items-center p-2 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: colors[index % colors.length] }}></div>
                            <span className="text-slate-600 text-sm font-bold">{entry.name}</span>
                        </div>
                        <span className="font-black text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-100 shadow-sm text-xs">{entry.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RequestStatusPie;
