import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, Search, AlertTriangle, Monitor } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { api } from '../../api/client';

interface MachineExchangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    selectedMachine: any; // The machine going OUT from warehouse
    clients: any[];
    isLoading: boolean;
    performedBy: string;
}

export const MachineExchangeModal: React.FC<MachineExchangeModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    selectedMachine,
    clients,
    isLoading,
    performedBy
}) => {
    const [clientSearch, setClientSearch] = useState('');
    const [showClientList, setShowClientList] = useState(false);
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [clientMachines, setClientMachines] = useState<any[]>([]);
    const [isLoadingMachines, setIsLoadingMachines] = useState(false);
    const [exchangeData, setExchangeData] = useState<{
        incomingMachineId: string;
        incomingStatus: 'STANDBY' | 'DEFECTIVE' | 'CLIENT_REPAIR';
        incomingNotes: string;
    }>({
        incomingMachineId: '',
        incomingStatus: 'STANDBY',
        incomingNotes: ''
    });

    const filteredClients = clients?.filter(c =>
        c.client_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.bkcode.includes(clientSearch)
    ) || [];

    const handleSelectClient = async (client: any) => {
        setSelectedClient(client);
        setClientSearch(`${client.client_name} (${client.bkcode})`);
        setShowClientList(false);
        setIsLoadingMachines(true);
        try {
            const machines = await api.getCustomerMachines(client.bkcode);
            setClientMachines(machines as any[]);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingMachines(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClient || !exchangeData.incomingMachineId) return;

        onSubmit({
            outgoingMachineId: selectedMachine.id,
            customerId: selectedClient.bkcode,
            ...exchangeData,
            performedBy
        });
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
                    dir="rtl"
                >
                    <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
                        <div className="flex flex-col">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <RotateCcw className="text-emerald-600" size={24} />
                                استبدال ماكينة
                            </h2>
                            <p className="text-sm text-slate-500 mt-1">
                                صرف: <span className="font-mono font-bold text-blue-600">{selectedMachine?.serialNumber}</span> ({selectedMachine?.model})
                            </p>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scroll">
                            {/* Client Search */}
                            <div className="space-y-2 relative">
                                <Label>البحث عن العميل</Label>
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                                    <Input
                                        placeholder="اسم العميل أو الكود..."
                                        value={clientSearch}
                                        onChange={(e) => {
                                            setClientSearch(e.target.value);
                                            setShowClientList(true);
                                        }}
                                        onFocus={() => setShowClientList(true)}
                                        className="pl-10 rounded-xl"
                                    />
                                </div>

                                <AnimatePresence>
                                    {showClientList && clientSearch.length > 1 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto"
                                        >
                                            {filteredClients.map(c => (
                                                <button
                                                    key={c.bkcode}
                                                    type="button"
                                                    onClick={() => handleSelectClient(c)}
                                                    className="w-full text-right p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                                                >
                                                    <div className="font-bold text-slate-800">{c.client_name}</div>
                                                    <div className="text-xs text-slate-500">{c.bkcode}</div>
                                                </button>
                                            ))}
                                            {filteredClients.length === 0 && (
                                                <div className="p-4 text-center text-slate-400 text-sm">لا توجد نتائج</div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Client Machines Selection */}
                            <AnimatePresence>
                                {selectedClient && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="space-y-4"
                                    >
                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                                            <Label className="flex items-center gap-2">
                                                <Monitor size={16} className="text-blue-600" />
                                                الماكينة المطلوب استلامها من العميل
                                            </Label>

                                            {isLoadingMachines ? (
                                                <div className="h-10 bg-slate-200 animate-pulse rounded-lg" />
                                            ) : clientMachines.length > 0 ? (
                                                <Select
                                                    value={exchangeData.incomingMachineId}
                                                    onValueChange={(val: string) => setExchangeData(prev => ({ ...prev, incomingMachineId: val }))}
                                                    required
                                                >
                                                    <SelectTrigger className="rounded-lg bg-white">
                                                        <SelectValue placeholder="اختر الماكينة من قائمة العميل..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {clientMachines.map(m => (
                                                            <SelectItem key={m.id} value={m.id}>
                                                                {m.serialNumber} - {m.model}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <div className="text-red-500 text-sm font-medium p-2 bg-red-50 rounded-lg border border-red-100 flex items-center gap-2">
                                                    <AlertTriangle size={16} />
                                                    لا توجد ماكينات مسجلة لهذا العميل حالياً.
                                                </div>
                                            )}
                                        </div>

                                        {exchangeData.incomingMachineId && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="space-y-4"
                                            >
                                                <div className="space-y-2">
                                                    <Label>حالة الماكينة المسترجعة</Label>
                                                    <Select
                                                        value={exchangeData.incomingStatus}
                                                        onValueChange={(val: any) => setExchangeData(prev => ({ ...prev, incomingStatus: val }))}
                                                    >
                                                        <SelectTrigger className="rounded-xl">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="STANDBY">سليمة (STANDBY)</SelectItem>
                                                            <SelectItem value="DEFECTIVE">تالفة (DEFECTIVE)</SelectItem>
                                                            <SelectItem value="CLIENT_REPAIR">صيانة (REPAIR)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>ملاحظات الاستلام / وصف العطل</Label>
                                                    <Input
                                                        placeholder="..."
                                                        value={exchangeData.incomingNotes}
                                                        onChange={(e) => setExchangeData(prev => ({ ...prev, incomingNotes: e.target.value }))}
                                                        required={exchangeData.incomingStatus === 'DEFECTIVE'}
                                                        className="rounded-xl"
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="p-6 border-t bg-slate-50/50 shrink-0 flex gap-3">
                            <Button
                                type="submit"
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-6 font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                                disabled={isLoading || !exchangeData.incomingMachineId}
                            >
                                {isLoading ? 'جاري التنفيذ...' : 'تأكيد عملية الاستبدال'}
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
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
