import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Monitor, Search, Download, Upload, Truck, ArrowLeftRight, Wrench } from 'lucide-react';
import { api } from '../../api/client';
import ImportModal from '../ImportModal';

interface AllMachinesTableProps {
    customers: any[];
    onCreateRequest: (c: any, m: any) => void;
    onExchange?: (c: any, m: any) => void;
    onReturn?: (c: any, m: any) => void;
}

export default function AllMachinesTable({ customers, onCreateRequest, onExchange, onReturn }: AllMachinesTableProps) {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [importModalOpen, setImportModalOpen] = useState(false);

    const allMachines = useMemo(() => {
        if (!customers) return [];
        return customers.flatMap(c => c.posMachines?.map((m: any) => ({ ...m, customer: c })) || []);
    }, [customers]);

    const filtered = allMachines.filter(m =>
        m.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.model && m.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.customer && m.customer.client_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleDownloadTemplate = async () => {
        try {
            const blob = await api.getMachineTemplate();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'customer_machines_import.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            toast.error('فشل تنزيل القالب');
        }
    };

    const handleExport = async () => {
        try {
            const blob = await api.exportMachines();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `machines-export-${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            toast.error('فشل التصدير');
        }
    };

    return (
        <div className="bg-white rounded-lg border shadow-sm p-6">
            <ImportModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                title="استيراد الماكينات"
                onImport={(file) => api.importMachines(file)}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['customers'] })}
                columns={[
                    { header: 'SerialNumber', key: 'serialNumber' },
                    { header: 'CustomerId', key: 'customerId' }
                ]}
            />

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                    <Monitor className="text-green-600" />
                    جميع ماكينات العملاء ({filtered.length})
                </h2>
                <div className="flex items-center gap-4">
                    <div className="relative w-64">
                        <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
                        <input
                            className="w-full border rounded-lg pr-10 pl-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="بحث بالرقم، الموديل، العميل..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleDownloadTemplate}
                            className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 flex items-center gap-2 transition-colors"
                            title="تنزيل قالب Excel"
                        >
                            <Download size={18} />
                            قالب
                        </button>
                        <button
                            onClick={() => setImportModalOpen(true)}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors shadow-sm"
                        >
                            <Upload size={18} />
                            استيراد
                        </button>
                        <button
                            onClick={handleExport}
                            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2 transition-colors shadow-sm"
                            title="تصدير كل الماكينات"
                        >
                            <Download size={18} />
                            تصدير
                        </button>
                    </div>
                </div>
            </div>

            <div className="table-container">
                <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 border-b text-slate-600">
                        <tr>
                            <th className="p-4 font-bold">السيريال</th>
                            <th className="p-4 font-bold">الموديل</th>
                            <th className="p-4 font-bold">الشركة</th>
                            <th className="p-4 font-bold">العميل</th>
                            <th className="p-4 font-bold">كود العميل</th>
                            <th className="p-4 font-bold">POS ID</th>
                            <th className="p-4 font-bold">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700">
                        {filtered.slice(0, 100).map(machine => (
                            <tr key={machine.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-mono font-medium">{machine.serialNumber}</td>
                                <td className="p-4">{machine.model || '-'}</td>
                                <td className="p-4">{machine.manufacturer || '-'}</td>
                                <td className="p-4 text-blue-600 font-medium whitespace-nowrap">
                                    {machine.customer?.client_name || '-'}
                                </td>
                                <td className="p-4 font-mono text-slate-600">{machine.customer?.bkcode || '-'}</td>
                                <td className="p-4 font-mono">{machine.posId || '-'}</td>
                                <td className="p-4">
                                    <div className="flex gap-2 justify-end">
                                        {onReturn && (
                                            <button
                                                onClick={() => onReturn(machine.customer, machine)}
                                                className="bg-orange-50 text-orange-600 p-1.5 rounded hover:bg-orange-100 transition-colors"
                                                title="سحب الماكينة لإرسالها لاحقاً لمركز الصيانة"
                                            >
                                                <Truck size={14} />
                                            </button>
                                        )}
                                        {onExchange && (
                                            <button
                                                onClick={() => onExchange(machine.customer, machine)}
                                                className="bg-green-50 text-green-600 p-1.5 rounded hover:bg-green-100 transition-colors"
                                                title="استبدال"
                                            >
                                                <ArrowLeftRight size={14} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onCreateRequest(machine.customer, machine)}
                                            className="bg-blue-50 text-blue-600 p-1.5 rounded hover:bg-blue-100 transition-colors"
                                            title="طلب صيانة"
                                        >
                                            <Wrench size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && (
                    <div className="text-center py-20 text-slate-400 bg-white">
                        <Monitor size={48} className="mx-auto mb-4 opacity-20" />
                        <p>لا توجد ماكينات مطابقة للبحث</p>
                    </div>
                )}
            </div>
        </div>
    );
}
