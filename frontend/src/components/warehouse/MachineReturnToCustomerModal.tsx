import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserCheck, Search, MessageSquare, Monitor, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';


interface MachineReturnToCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (customerId: string, notes: string) => void;
    selectedMachine: any;
    isLoading: boolean;
}

export const MachineReturnToCustomerModal: React.FC<MachineReturnToCustomerModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    selectedMachine,
    isLoading
}) => {
    const [clientSearch, setClientSearch] = useState('');
    const [showClientList, setShowClientList] = useState(false);
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [notes, setNotes] = useState('');

    // Live search for customers using server-side filtering
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(clientSearch);
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [clientSearch]);

    const { data: searchResults, isLoading: isSearching } = useQuery({
        queryKey: ['customer-search', debouncedSearch],
        queryFn: () => api.getCustomersLite(debouncedSearch),
        enabled: debouncedSearch.length > 0 && !selectedClient,
        staleTime: 30000 // Cache for 30 seconds
    });

    const filteredClients = searchResults || [];

    const handleSelectClient = (client: any) => {
        setSelectedClient(client);
        setClientSearch(`${client.client_name} (${client.bkcode})`);
        setShowClientList(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClient) return;
        onSubmit(selectedClient.bkcode, notes);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
                    dir="rtl"
                >
                    <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <UserCheck className="text-emerald-600" size={24} />
                            إرجاع ماكينة للعميل
                        </h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scroll">
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                <div className="flex items-center gap-2 text-slate-400 mb-2">
                                    <Monitor size={16} />
                                    <span className="text-xs font-bold uppercase tracking-wider">الماكينة المستلمة</span>
                                </div>
                                <p className="font-mono font-bold text-lg text-slate-800">{selectedMachine?.serialNumber}</p>
                                <p className="text-sm text-slate-500">{selectedMachine?.model} ({selectedMachine?.status === 'CLIENT_REPAIR' ? 'صيانة عملاء' : 'مخزن'})</p>
                            </div>

                            <div className="space-y-2 relative">
                                <Label>البحث عن العميل (المستلم)</Label>
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                                    <Input
                                        placeholder="اسم العميل أو الكود..."
                                        value={clientSearch}
                                        onChange={(e) => {
                                            setClientSearch(e.target.value);
                                            setSelectedClient(null);
                                            setShowClientList(true);
                                        }}
                                        onFocus={() => setShowClientList(true)}
                                        className="pl-10 rounded-xl"
                                    />
                                </div>
                                <AnimatePresence>
                                    {showClientList && clientSearch.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto"
                                        >
                                            {isSearching ? (
                                                <div className="p-4 text-center text-slate-500 flex items-center justify-center gap-2">
                                                    <Loader2 size={16} className="animate-spin" />
                                                    جاري البحث...
                                                </div>
                                            ) : filteredClients.length === 0 ? (
                                                <div className="p-4 text-center text-slate-500">
                                                    لا توجد نتائج
                                                </div>
                                            ) : (
                                                filteredClients.map(c => (
                                                    <button
                                                        key={c.bkcode}
                                                        type="button"
                                                        onClick={() => handleSelectClient(c)}
                                                        className="w-full text-right p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                                                    >
                                                        <div className="font-bold text-slate-800">{c.client_name}</div>
                                                        <div className="text-xs text-slate-500">{c.bkcode}</div>
                                                    </button>
                                                ))
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <MessageSquare size={16} className="text-slate-400" />
                                    ملاحظات الإصلاح / التسليم
                                </Label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl p-3 h-24 focus:ring-emerald-500/20 outline-none resize-none"
                                    placeholder="..."
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t bg-slate-50/50 shrink-0 flex gap-3">
                            <Button
                                type="submit"
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-6 font-bold shadow-lg shadow-emerald-500/20 transition-all font-bold"
                                disabled={isLoading || !selectedClient}
                            >
                                {isLoading ? 'جاري الحفظ...' : 'تأكيد إرجاع الماكينة'}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                className="rounded-xl py-6 border-slate-200 hover:bg-slate-50"
                            >
                                إلغاء
                            </Button>
                        </div>
                    </form>
                    <div className="hidden">
                        {/* Hidden triggers to keep imports usage if any */}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
