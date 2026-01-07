import { useState, useMemo } from 'react';
import { Search } from 'lucide-react'; // Assuming lucide-react is used, or heroicons
import { api } from '../api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog'; // Helper components
import { Button } from './ui/button';
import { useQuery } from '@tanstack/react-query';

// Interface for Parts (Mocked or from API)
interface Part {
    id: string;
    name: string;
    defaultCost: number;
    quantity: number; // Stock quantity at Center
    allowsMultiple: boolean;
}

interface SelectedPart {
    partId: string;
    name: string;
    quantity: number;
    cost: number;
}

interface ProcessingModalProps {
    isOpen: boolean;
    onClose: () => void;
    serialNumber: string;
    onSuccess: () => void;
}

export default function ProcessingModal({ isOpen, onClose, serialNumber, onSuccess }: ProcessingModalProps) {
    const [notes, setNotes] = useState('');
    const [actionType, setActionType] = useState<'REPAIR' | 'REQUEST_APPROVAL' | 'SCRAP' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);
    const [customCost, setCustomCost] = useState<number>(0); // For additional labor or override

    // Fetch Spare Parts (Inventory at Center)
    const { data: spareParts } = useQuery({
        queryKey: ['inventory-parts'],
        queryFn: async () => {
            // Fetch inventory for current branch (Center)
            // Mocking or using real endpoint
            const res = await api.get('/inventory?limit=1000');
            return res as any[];
        }
    });

    const filteredParts = useMemo(() => {
        if (!spareParts) return [];
        let parts = spareParts;
        if (searchQuery) {
            parts = parts.filter((p: any) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return parts;
    }, [spareParts, searchQuery]);

    const totalCost = useMemo(() => {
        const partsCost = selectedParts.reduce((sum, p) => sum + (p.cost * p.quantity), 0);
        return partsCost + customCost;
    }, [selectedParts, customCost]);

    const togglePart = (part: any) => {
        const exists = selectedParts.find(p => p.partId === part.id);
        if (exists) {
            setSelectedParts(selectedParts.filter(p => p.partId !== part.id));
        } else {
            setSelectedParts([...selectedParts, {
                partId: part.partId || part.id, // Handle differences in API response structure
                name: part.name || part.part?.name,
                quantity: 1,
                cost: part.defaultCost || part.part?.defaultCost || 0
            }]);
        }
    };

    const updatePartQuantity = (partId: string, delta: number) => {
        setSelectedParts(prev => prev.map(p => {
            if (p.partId === partId) {
                return { ...p, quantity: Math.max(1, p.quantity + delta) };
            }
            return p;
        }));
    };

    const handleSubmit = async () => {
        if (!actionType) return;

        try {
            await api.post(`/maintenance/machine/${serialNumber}/transition`, {
                action: actionType,
                data: {
                    notes,
                    parts: selectedParts,
                    cost: totalCost
                }
            });
            onSuccess();
        } catch (error) {
            console.error(error);
            alert('حدث خطأ أثناء تنفيذ العملية');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 flex flex-col max-h-[90vh] h-auto overflow-hidden sm:max-w-2xl" dir="rtl">
                <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-gray-50">
                    <DialogTitle className="text-xl font-bold text-gray-800">
                        معالجة الماكينة: {serialNumber}
                    </DialogTitle>
                    <DialogDescription>
                        اختيار نوع الإجراء وإدخال التفاصيل
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

                    {/* Action Selection */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">نوع الإجراء</label>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => setActionType('REQUEST_APPROVAL')}
                                className={`p-4 rounded-xl border-2 transition-all text-center ${actionType === 'REQUEST_APPROVAL' ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold' : 'border-gray-200 text-gray-600 hover:border-blue-200'}`}
                            >
                                <div className="text-lg mb-1">📋</div>
                                طلب موافقة (تسعير)
                            </button>
                            <button
                                onClick={() => setActionType('REPAIR')}
                                className={`p-4 rounded-xl border-2 transition-all text-center ${actionType === 'REPAIR' ? 'border-green-500 bg-green-50 text-green-700 font-bold' : 'border-gray-200 text-gray-600 hover:border-green-200'}`}
                            >
                                <div className="text-lg mb-1">🛠️</div>
                                إصلاح مباشر (خصم مخزون)
                            </button>
                            <button
                                onClick={() => setActionType('SCRAP')}
                                className={`p-4 rounded-xl border-2 transition-all text-center ${actionType === 'SCRAP' ? 'border-red-500 bg-red-50 text-red-700 font-bold' : 'border-gray-200 text-gray-600 hover:border-red-200'}`}
                            >
                                <div className="text-lg mb-1">🗑️</div>
                                تكهين / إهلاك
                            </button>
                        </div>
                    </div>

                    {actionType && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    {actionType === 'REQUEST_APPROVAL' ? 'ملاحظات الفحص / سبب طلب الموافقة' :
                                        actionType === 'REPAIR' ? 'تقرير الإصلاح' : 'سبب التكهين'}
                                </label>
                                <textarea
                                    className="w-full border rounded-lg p-3 h-24 focus:ring-2 focus:ring-blue-100 outline-none"
                                    placeholder="اكتب التفاصيل هنا..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>

                            {/* Parts Selection (Only for Repair or Approval) */}
                            {actionType !== 'SCRAP' && (
                                <div className="space-y-3">
                                    <label className="block text-sm font-bold text-gray-700">قطع الغيار {actionType === 'REQUEST_APPROVAL' ? 'المقترحة' : 'المستخدمة'}</label>

                                    {/* Search */}
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="بحث عن قطعة..."
                                            className="w-full border rounded-lg pr-3 pl-10 py-2"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                                    </div>

                                    {/* List */}
                                    <div className="border rounded-xl max-h-48 overflow-y-auto bg-gray-50">
                                        {filteredParts.length > 0 ? filteredParts.map((part: any) => {
                                            const selected = selectedParts.find(p => p.partId === (part.id || part.partId));
                                            return (
                                                <div key={part.id || part.partId} className={`p-3 border-b flex justify-between items-center hover:bg-white cursor-pointer ${selected ? 'bg-blue-50' : ''}`} onClick={() => togglePart(part)}>
                                                    <div>
                                                        <div className="font-bold text-sm">{part.name || part.part?.name}</div>
                                                        <div className="text-xs text-gray-500">المتوفر: {part.quantity}</div>
                                                    </div>
                                                    {selected && (
                                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                            <button className="w-6 h-6 bg-gray-200 rounded text-sm" onClick={() => updatePartQuantity(selected.partId, -1)}>-</button>
                                                            <span className="font-bold w-6 text-center">{selected.quantity}</span>
                                                            <button className="w-6 h-6 bg-blue-600 text-white rounded text-sm" onClick={() => updatePartQuantity(selected.partId, 1)}>+</button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }) : (
                                            <div className="p-4 text-center text-gray-500 text-sm">لا توجد قطع مطابقة</div>
                                        )}
                                    </div>

                                    {/* Summary */}
                                    {selectedParts.length > 0 && (
                                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-2">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm font-bold text-blue-800">إجمالي تكلفة القطع:</span>
                                                <span className="font-bold text-blue-900">{selectedParts.reduce((s, p) => s + (p.cost * p.quantity), 0)} ج.م</span>
                                            </div>
                                            {actionType === 'REQUEST_APPROVAL' && (
                                                <div className="text-xs text-blue-600">
                                                    * هذا تكلفة تقديرية سيتم عرضها على الفرع للموافقة
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Manual Cost Adjustment */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">مصنعية / تكاليف إضافية</label>
                                        <input
                                            type="number"
                                            className="w-full border rounded-lg p-2"
                                            value={customCost}
                                            onChange={(e) => setCustomCost(Number(e.target.value))}
                                        />
                                    </div>

                                    <div className="pt-2 border-t mt-2 flex justify-between items-center">
                                        <span className="text-lg font-bold">الإجمالي الكلي:</span>
                                        <span className="text-xl font-black text-green-700">{totalCost} ج.م</span>
                                    </div>
                                </div>
                            )}

                        </div>
                    )}

                </div>

                <div className="p-6 border-t bg-gray-50 flex gap-3">
                    <Button variant="outline" onClick={onClose} className="flex-1">إلغاء</Button>
                    <Button
                        onClick={handleSubmit}
                        className="flex-1"
                        disabled={!actionType}
                        variant={actionType === 'SCRAP' ? 'destructive' : 'default'}
                    >
                        تأكيد {actionType === 'REQUEST_APPROVAL' ? 'وإرسال للموافقة' : actionType === 'REPAIR' ? 'وإتمام الإصلاح' : 'والتكهين'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
