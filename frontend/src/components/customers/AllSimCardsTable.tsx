import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { CreditCard, Search, Download, Upload } from 'lucide-react';
import { api } from '../../api/client';
import ImportModal from '../ImportModal';

interface AllSimCardsTableProps {
    customers: any[];
}

export default function AllSimCardsTable({ customers }: AllSimCardsTableProps) {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [importModalOpen, setImportModalOpen] = useState(false);

    const allSimCards = useMemo(() => {
        if (!customers) return [];
        return customers.flatMap(c => c.simCards?.map((s: any) => ({ ...s, customer: c })) || []);
    }, [customers]);

    const filtered = allSimCards.filter(s =>
        s.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.type && s.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.customer && s.customer.client_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleDownloadTemplate = async () => {
        try {
            const blob = await api.getSimCardTemplate();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'customer_sims_import.xlsx';
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
            const blob = await api.exportSimCards();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `simcards-export-${new Date().toISOString().split('T')[0]}.xlsx`;
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
                title="استيراد شرائح SIM"
                onImport={(file) => api.importSimCards(file)}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['customers'] })}
                columns={[
                    { header: 'SerialNumber', key: 'serialNumber' },
                    { header: 'Type', key: 'type' },
                    { header: 'CustomerId', key: 'customerId' }
                ]}
            />

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                    <CreditCard className="text-purple-600" />
                    جميع شرائح العملاء ({filtered.length})
                </h2>
                <div className="flex items-center gap-4">
                    <div className="relative w-64">
                        <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
                        <input
                            className="w-full border rounded-lg pr-10 pl-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="بحث بالرقم، النوع، العميل..."
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
                            title="تصدير كل الشرائح"
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
                            <th className="p-4 font-bold">الرقم التسلسلي</th>
                            <th className="p-4 font-bold">النوع</th>
                            <th className="p-4 font-bold">العميل</th>
                            <th className="p-4 font-bold">كود العميل</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700">
                        {filtered.slice(0, 100).map(sim => (
                            <tr key={sim.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-mono font-medium">{sim.serialNumber}</td>
                                <td className="p-4">{sim.type || '-'}</td>
                                <td className="p-4 text-blue-600 font-medium whitespace-nowrap">
                                    {sim.customer?.client_name || '-'}
                                </td>
                                <td className="p-4 font-mono text-slate-600">{sim.customer?.bkcode || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && (
                    <div className="text-center py-20 text-slate-400 bg-white">
                        <CreditCard size={48} className="mx-auto mb-4 opacity-20" />
                        <p>لا توجد شرائح مطابقة للبحث</p>
                    </div>
                )}
            </div>
        </div>
    );
}
