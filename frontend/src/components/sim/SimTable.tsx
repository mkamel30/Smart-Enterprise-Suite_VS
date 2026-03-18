import React from 'react';
import { Edit3, Trash2 } from 'lucide-react';
import { SimTypeBadge, SimStatusBadge } from './SimBadges';
import { motion } from 'framer-motion';

interface TableProps {
    isLoading: boolean;
    sims: any[];
    selectedSims: Set<string>;
    toggleSelectAll: () => void;
    toggleSelectSim: (id: string) => void;
    onEdit: (sim: any) => void;
    onDelete: (id: string) => void;
}

export function SimTable({
    isLoading,
    sims = [],
    selectedSims,
    toggleSelectAll,
    toggleSelectSim,
    onEdit,
    onDelete
}: TableProps) {
    return (
        <div className="bg-white/50 backdrop-blur-sm rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-right text-sm whitespace-nowrap">
                    <thead className="bg-slate-50/50 border-b border-slate-200">
                        <tr>
                            <th className="p-5 w-10">
                                <div className="flex items-center justify-center">
                                    <input
                                        type="checkbox"
                                        checked={sims.length > 0 && selectedSims.size === sims.length}
                                        onChange={toggleSelectAll}
                                        className="rounded-lg border-slate-300 w-5 h-5 cursor-pointer text-primary focus:ring-primary/20"
                                    />
                                </div>
                            </th>
                            <th className="p-5 font-bold text-slate-500 uppercase tracking-wider text-xs">مسلسل الشريحة</th>
                            <th className="p-5 font-bold text-slate-500 uppercase tracking-wider text-xs">الشركة المشغلة</th>
                            <th className="p-5 font-bold text-slate-500 uppercase tracking-wider text-xs">الشبكة</th>
                            <th className="p-5 font-bold text-slate-500 uppercase tracking-wider text-xs">الحالة</th>
                            <th className="p-5 font-bold text-slate-500 uppercase tracking-wider text-xs">ملاحظات</th>
                            <th className="p-5 font-bold text-slate-500 uppercase tracking-wider text-xs">تاريخ الإضافة</th>
                            <th className="p-5 font-bold text-slate-500 uppercase tracking-wider text-xs w-24"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                            <tr>
                                <td colSpan={8} className="p-12 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                        <span className="text-slate-500 font-medium">جاري تحميل البيانات...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : sims.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="p-12 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <p className="text-slate-400 font-bold text-lg">لا توجد شرائح متاحة</p>
                                        <p className="text-slate-400 text-sm">قم بإضافة شرائح جديدة أو استيرادها</p>
                                    </div>
                                </td>
                            </tr>
                        ) : sims.map((sim, index) => (
                            <motion.tr
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.03 }}
                                key={sim.id}
                                className={`group hover:bg-slate-50/80 transition-all ${selectedSims.has(sim.id) ? 'bg-primary/10' : ''}`}
                            >
                                <td className="p-5">
                                    <div className="flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedSims.has(sim.id)}
                                            onChange={() => toggleSelectSim(sim.id)}
                                            className="rounded-lg border-slate-300 w-5 h-5 cursor-pointer text-primary focus:ring-primary/20 transition-all group-hover:scale-110"
                                        />
                                    </div>
                                </td>
                                <td className="p-5">
                                    <span className="font-mono font-black text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg text-xs">
                                        {sim.serialNumber}
                                    </span>
                                </td>
                                <td className="p-5">
                                    <SimTypeBadge type={sim.type} />
                                </td>
                                <td className="p-5">
                                    <span className="font-bold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-md text-xs shadow-sm">
                                        {sim.networkType || <span className="text-slate-300">N/A</span>}
                                    </span>
                                </td>
                                <td className="p-5">
                                    <SimStatusBadge status={sim.status} />
                                </td>
                                <td className="p-5 text-slate-500 max-w-xs truncate font-medium">{sim.notes || '-'}</td>
                                <td className="p-5 font-mono text-[10px] text-slate-400 font-bold">
                                    {new Date(sim.importDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                                </td>
                                <td className="p-5">
                                    <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => onEdit(sim)}
                                            className="p-2 text-primary hover:bg-primary hover:text-white rounded-xl transition-all hover:shadow-lg shadow-primary/20"
                                            title="تعديل الشريحة"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                        <button
                                            onClick={() => onDelete(sim.id)}
                                            className="p-2 text-red-600 hover:bg-red-600 hover:text-white rounded-xl transition-all hover:shadow-lg shadow-red-100"
                                            title="حذف الشريحة"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
