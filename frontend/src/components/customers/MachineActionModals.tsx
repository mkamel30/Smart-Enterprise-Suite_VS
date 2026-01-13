import { ArrowLeftRight, Truck, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useState } from 'react';

interface MachineExchangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetCustomer: any;
    selectedActionMachine: any;
    warehouseMachines: any[];
    selectedReplacement: string;
    setSelectedReplacement: (id: string) => void;
    actionNotes: string;
    setActionNotes: (notes: string) => void;
    onConfirm: () => void;
    isPending: boolean;
}

export function MachineExchangeModal({
    isOpen,
    onClose,
    targetCustomer,
    selectedActionMachine,
    warehouseMachines,
    selectedReplacement,
    setSelectedReplacement,
    actionNotes,
    setActionNotes,
    onConfirm,
    isPending
}: MachineExchangeModalProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredMachines = warehouseMachines?.filter((m: any) =>
        m.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.model && m.model.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a: any, b: any) => {
        const aIsOriginal = a.originalOwnerId === targetCustomer?.bkcode;
        const bIsOriginal = b.originalOwnerId === targetCustomer?.bkcode;
        if (aIsOriginal && !bIsOriginal) return -1;
        if (!aIsOriginal && bIsOriginal) return 1;
        return 0;
    });
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 [&>button]:hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] h-auto overflow-hidden sm:max-w-lg" dir="rtl">
                <DialogHeader className="p-6 pb-2 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <ArrowLeftRight className="text-green-600" />
                        استبدال ماكينة
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl text-sm border border-slate-100">
                        <p className="mb-1"><strong>العميل:</strong> {targetCustomer?.client_name}</p>
                        <p><strong>الماكينة المرتجعة:</strong> {selectedActionMachine?.serialNumber}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5">الماكينة البديلة (من المخزن)</label>
                        <div className="relative">
                            <div className="relative mb-2">
                                <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="بحث بالسيريال..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full border rounded-lg pr-10 pl-3 py-2.5 bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>

                            <div className="border rounded-lg max-h-[200px] overflow-y-auto bg-white">
                                {filteredMachines?.length === 0 ? (
                                    <div className="p-4 text-center text-slate-500 text-sm">لا توجد ماكينات مطابقة</div>
                                ) : (
                                    filteredMachines?.map((m: any) => {
                                        const isOriginal = m.originalOwnerId === targetCustomer?.bkcode;
                                        const isSelected = selectedReplacement === m.id;
                                        return (
                                            <div
                                                key={m.id}
                                                onClick={() => setSelectedReplacement(m.id)}
                                                className={`p-3 text-sm cursor-pointer border-b last:border-0 transition-colors flex justify-between items-center ${isSelected ? 'bg-blue-50 border-blue-100' : 'hover:bg-slate-50'
                                                    } ${isOriginal ? 'bg-green-50/50' : ''}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className={`font-medium ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                                        {m.serialNumber}
                                                    </span>
                                                    <span className="text-xs text-slate-500">{m.model} - {m.manufacturer}</span>
                                                </div>
                                                {isOriginal && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">ماكينة العميل</span>}
                                                {isSelected && <div className="w-2 h-2 rounded-full bg-blue-600"></div>}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5">ملاحظات العطل / سبب الاسترجاع</label>
                        <textarea
                            value={actionNotes}
                            onChange={(e) => setActionNotes(e.target.value)}
                            className="w-full border rounded-lg p-3 bg-background focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                            rows={3}
                            placeholder="وصف العطل..."
                        />
                    </div>
                </div>

                <div className="p-6 border-t bg-slate-50/50 shrink-0 flex gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 h-11"
                    >
                        إلغاء
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={isPending || !selectedReplacement}
                        className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white gap-2"
                    >
                        <ArrowLeftRight size={18} />
                        تأكيد الاستبدال
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface MachineReturnModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetCustomer: any;
    selectedActionMachine: any;
    actionNotes: string;
    setActionNotes: (notes: string) => void;
    setIncomingStatus: (status: string) => void;
    onConfirm: () => void;
    isPending: boolean;
}

export function MachineReturnModal({
    isOpen,
    onClose,
    targetCustomer,
    selectedActionMachine,
    actionNotes,
    setActionNotes,
    setIncomingStatus,
    onConfirm,
    isPending
}: MachineReturnModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 [&>button]:hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] h-auto overflow-hidden sm:max-w-md" dir="rtl">
                <DialogHeader className="p-6 pb-2 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Truck className="text-orange-600" />
                        سحب الماكينة للمخزن
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl text-sm border border-slate-100">
                        <p className="mb-1"><strong>العميل:</strong> {targetCustomer?.client_name}</p>
                        <p><strong>الماكينة:</strong> {selectedActionMachine?.serialNumber}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5">سبب السحب</label>
                        <select
                            className="w-full border rounded-lg p-2.5 bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                            onChange={(e) => {
                                const val = e.target.value;
                                if (!actionNotes) setActionNotes(val);
                                if (val === 'إرجاع لمخزن الفرع (إحتياطي)') {
                                    setIncomingStatus('STANDBY');
                                } else {
                                    setIncomingStatus('CLIENT_REPAIR');
                                }
                            }}
                        >
                            <option value="">اختر السبب...</option>
                            <option value="سحب للإرسال لمركز الصيانة">سحب للإرسال لمركز الصيانة</option>
                            <option value="صيانة بالمخزن">صيانة بالمخزن</option>
                            <option value="إنهاء تعاقد">إنهاء تعاقد</option>
                            <option value="تغيير نشاط">تغيير نشاط</option>
                            <option value="إرجاع لمخزن الفرع (إحتياطي)">إرجاع لمخزن الفرع (إحتياطي)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5">ملاحظات / تفاصيل العطل</label>
                        <textarea
                            value={actionNotes}
                            onChange={(e) => setActionNotes(e.target.value)}
                            className="w-full border rounded-lg p-3 bg-background focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                            rows={3}
                            placeholder="ملاحظات..."
                        />
                    </div>
                </div>

                <div className="p-6 border-t bg-slate-50/50 shrink-0 flex gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 h-11"
                    >
                        إلغاء
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={isPending}
                        className="flex-1 h-11 bg-orange-600 hover:bg-orange-700 text-white gap-2"
                    >
                        <Truck size={18} />
                        تأكيد السحب
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
