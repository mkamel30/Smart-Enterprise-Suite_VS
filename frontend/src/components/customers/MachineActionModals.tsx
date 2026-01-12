import { ArrowLeftRight, Truck } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

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
                        <select
                            value={selectedReplacement}
                            onChange={(e) => setSelectedReplacement(e.target.value)}
                            className="w-full border rounded-lg p-2.5 bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                        >
                            <option value="">اختر ماكينة</option>
                            {warehouseMachines
                                ?.sort((a: any, b: any) => {
                                    const aIsOriginal = a.originalOwnerId === targetCustomer?.bkcode;
                                    const bIsOriginal = b.originalOwnerId === targetCustomer?.bkcode;
                                    if (aIsOriginal && !bIsOriginal) return -1;
                                    if (!aIsOriginal && bIsOriginal) return 1;
                                    return 0;
                                })
                                .map((m: any) => {
                                    const isOriginal = m.originalOwnerId === targetCustomer?.bkcode;
                                    return (
                                        <option
                                            key={m.id}
                                            value={m.id}
                                            style={isOriginal ? {
                                                backgroundColor: '#dcfce7',
                                                fontWeight: 'bold',
                                                color: '#166534'
                                            } : {}}
                                        >
                                            {isOriginal ? '✅ ' : ''}{m.serialNumber} - {m.model}{isOriginal ? ' (ماكينة العميل)' : ''}
                                        </option>
                                    );
                                })
                            }
                        </select>
                        {warehouseMachines?.some((m: any) => m.originalOwnerId === targetCustomer?.bkcode) && (
                            <p className="text-xs text-green-700 mt-2 flex items-center gap-1 bg-green-50 p-2 rounded-lg">
                                <span className="font-bold">✅</span>
                                الماكينات المعلمة بالأخضر هي ماكينات العميل الأصلية الجاهزة للإرجاع
                            </p>
                        )}
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
