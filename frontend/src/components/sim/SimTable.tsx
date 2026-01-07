import React from 'react';
import { Edit3, Trash2 } from 'lucide-react';
import { SimTypeBadge, SimStatusBadge } from './SimBadges';

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
    sims,
    selectedSims,
    toggleSelectAll,
    toggleSelectSim,
    onEdit,
    onDelete
}: TableProps) {
    return (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-right text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="p-4 w-10">
                                <input
                                    type="checkbox"
                                    checked={sims.length > 0 && selectedSims.size === sims.length}
                                    onChange={toggleSelectAll}
                                    className="rounded border-slate-300 w-4 h-4 cursor-pointer"
                                />
                            </th>
                            <th className="p-4 font-semibold text-slate-600">مسلسل الشريحة</th>
                            <th className="p-4 font-semibold text-slate-600">نوع الشريحة</th>
                            <th className="p-4 font-semibold text-slate-600">الحالة</th>
                            <th className="p-4 font-semibold text-slate-600">ملاحظات</th>
                            <th className="p-4 font-semibold text-slate-600">تاريخ الإضافة</th>
                            <th className="p-4 font-semibold text-slate-600 w-24"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-500">جاري التحميل...</td></tr>
                        ) : sims.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-500">لا توجد شرائح</td></tr>
                        ) : sims.map(sim => (
                            <tr key={sim.id} className={`hover:bg-slate-50 transition-colors ${selectedSims.has(sim.id) ? 'bg-blue-50/50' : ''}`}>
                                <td className="p-4">
                                    <input
                                        type="checkbox"
                                        checked={selectedSims.has(sim.id)}
                                        onChange={() => toggleSelectSim(sim.id)}
                                        className="rounded border-slate-300 w-4 h-4 cursor-pointer"
                                    />
                                </td>
                                <td className="p-4 font-mono font-medium text-slate-900">{sim.serialNumber}</td>
                                <td className="p-4">
                                    <SimTypeBadge type={sim.type} />
                                </td>
                                <td className="p-4">
                                    <SimStatusBadge status={sim.status} />
                                </td>
                                <td className="p-4 text-slate-500 max-w-xs truncate">{sim.notes || '-'}</td>
                                <td className="p-4 font-mono text-xs text-slate-500">
                                    {new Date(sim.importDate).toLocaleDateString('ar-EG')}
                                </td>
                                <td className="p-4">
                                    <div className="flex gap-1 justify-end">
                                        <button
                                            onClick={() => onEdit(sim)}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="تعديل"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                        <button
                                            onClick={() => onDelete(sim.id)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="حذف"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
