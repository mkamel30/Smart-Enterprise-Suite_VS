import { ArrowLeftRight, Truck, Search, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { useState } from 'react';
import SmartConfirm from '../SmartConfirm';

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
    const [showConfirm, setShowConfirm] = useState(false);

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

    const handleActualConfirm = () => {
        setShowConfirm(false);
        onConfirm();
    };

    return (
        <>
            <SmartConfirm
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleActualConfirm}
                variant="success"
                title="تأكيد عملية الاستبدال"
                description={`هل أنت متأكد من استبدال الماكينة رقم (${selectedActionMachine?.serialNumber}) بالماكينة الجديدة رقم (${warehouseMachines.find(m => m.id === selectedReplacement)?.serialNumber})؟`}
            />

            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="p-0 border-0 [&>button]:hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] h-auto overflow-hidden sm:max-w-lg" dir="rtl">
                    <DialogHeader className="p-6 pb-2 shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <ArrowLeftRight className="text-green-600" />
                            استبدال ماكينة
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 mt-1">
                            تبديل ماكينة العميل بواحدة أخرى من المخزن
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
                        <div className="bg-slate-50 p-4 rounded-xl text-sm border border-slate-100">
                            <p className="mb-1 text-right"><strong>العميل:</strong> {targetCustomer?.client_name}</p>
                            <p className="text-right"><strong>الماكينة المرتجعة:</strong> {selectedActionMachine?.serialNumber}</p>
                        </div>

                        <div>
                            <label className="block text-sm font-black text-slate-700 mb-1.5 text-right">الماكينة البديلة (من المخزن)</label>
                            <div className="relative">
                                <div className="relative mb-2">
                                    <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="بحث بالسيريال..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full border rounded-lg pr-10 pl-3 py-2.5 bg-background focus:ring-2 focus:ring-primary/20 outline-none text-right font-bold"
                                    />
                                </div>

                                <div className="border rounded-lg max-h-[200px] overflow-y-auto bg-white shadow-inner">
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
                                                    className={`p-3 text-sm cursor-pointer border-b last:border-0 transition-colors flex flex-row-reverse justify-between items-center ${isSelected ? 'bg-primary/5 border-primary/20' : 'hover:bg-slate-50'
                                                        } ${isOriginal ? 'bg-emerald-50/50' : ''}`}
                                                >
                                                    <div className="flex flex-col text-right">
                                                        <span className={`font-black ${isSelected ? 'text-primary' : 'text-slate-700'}`}>
                                                            {m.serialNumber}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-bold">{m.model} - {m.manufacturer}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {isOriginal && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black">ماكينة العميل</span>}
                                                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-sm shadow-primary/50"></div>}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-black text-slate-700 mb-1.5 text-right">ملاحظات العطل / سبب الاسترجاع</label>
                            <textarea
                                value={actionNotes}
                                onChange={(e) => setActionNotes(e.target.value)}
                                className="w-full border rounded-lg p-3 bg-background focus:ring-2 focus:ring-primary/20 outline-none resize-none text-right font-medium"
                                rows={3}
                                placeholder="وصف العطل..."
                            />
                        </div>
                    </div>

                    <div className="p-6 border-t bg-slate-50/50 shrink-0 flex gap-3 flex-row-reverse">
                        <Button
                            onClick={() => setShowConfirm(true)}
                            disabled={isPending || !selectedReplacement}
                            className="flex-[2] h-12 rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-lg shadow-emerald-200 active:scale-95"
                        >
                            {isPending ? <Loader2 size={18} className="animate-spin" /> : <ArrowLeftRight size={18} />}
                            استبدال الماكينة
                        </Button>
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="flex-1 h-12 rounded-xl border-slate-200 font-black text-slate-500 hover:bg-slate-100 active:scale-95"
                        >
                            إلغاء
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

interface MachineReturnModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetCustomer: any;
    selectedActionMachine: any;
    actionNotes: string;
    setActionNotes: (notes: string) => void;
    complaint: string;
    setComplaint: (complaint: string) => void;
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
    complaint,
    setComplaint,
    setIncomingStatus,
    onConfirm,
    isPending
}: MachineReturnModalProps) {
    const [showConfirm, setShowConfirm] = useState(false);

    const handleActualConfirm = () => {
        setShowConfirm(false);
        onConfirm();
    };

    return (
        <>
            <SmartConfirm
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleActualConfirm}
                variant="warning"
                title="تأكيد سحب الماكينة"
                description={`هل أنت متأكد من سحب الماكينة رقم (${selectedActionMachine?.serialNumber}) من العميل وإرجاعها للمخزن؟`}
                confirmText="تأكيد السحب"
            />

            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="p-0 border-0 [&>button]:hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] h-auto overflow-hidden sm:max-w-md" dir="rtl">
                    <DialogHeader className="p-6 pb-2 shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Truck className="text-orange-600" />
                            سحب الماكينة للمخزن
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 mt-1">
                            استرجاع الماكينة من العميل إلى المخزن للصيانة أو غيرها
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
                        <div className="bg-slate-50 p-4 rounded-xl text-sm border border-slate-100">
                            <p className="mb-1 text-right"><strong>العميل:</strong> {targetCustomer?.client_name}</p>
                            <p className="text-right"><strong>الماكينة:</strong> {selectedActionMachine?.serialNumber}</p>
                        </div>

                        <div>
                            <label className="block text-sm font-black text-slate-700 mb-1.5 text-right">سبب السحب</label>
                            <select
                                className="w-full border rounded-lg p-2.5 bg-background focus:ring-2 focus:ring-primary/20 outline-none text-right font-bold"
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
                            <label className="block text-sm font-black text-slate-700 mb-1.5 text-right">ملاحظات / تفاصيل العطل</label>
                            <textarea
                                value={actionNotes}
                                onChange={(e) => setActionNotes(e.target.value)}
                                className="w-full border rounded-lg p-3 bg-background focus:ring-2 focus:ring-primary/20 outline-none resize-none text-right font-medium"
                                rows={2}
                                placeholder="ملاحظات..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-black text-orange-700 mb-1.5 text-right">الشكوى/العطل من العميل</label>
                            <textarea
                                value={complaint}
                                onChange={(e) => setComplaint(e.target.value)}
                                className="w-full border border-orange-200 bg-orange-50 rounded-lg p-3 focus:ring-2 focus:ring-orange-500/20 outline-none resize-none text-right font-medium shadow-inner"
                                rows={3}
                                placeholder="اكتب الشكوى أو العطل الذي اشتكى به العميل..."
                            />
                        </div>
                    </div>

                    <div className="p-6 border-t bg-slate-50/50 shrink-0 flex gap-3 flex-row-reverse">
                        <Button
                            onClick={() => setShowConfirm(true)}
                            disabled={isPending}
                            className="flex-[2] h-12 rounded-xl font-black bg-orange-600 hover:bg-orange-700 text-white gap-2 shadow-lg shadow-orange-200 active:scale-95"
                        >
                            {isPending ? <Loader2 size={18} className="animate-spin" /> : <Truck size={18} />}
                            سحب الآن
                        </Button>
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="flex-1 h-12 rounded-xl border-slate-200 font-black text-slate-500 hover:bg-slate-100 active:scale-95"
                        >
                            إلغاء
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

