import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Package, PenTool, CheckCircle2, Loader2, Wrench, AlertCircle, Trash2, ClipboardCheck, Settings, Plus, Minus, DollarSign, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { Dialog, DialogContent } from './ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

interface SelectedPart {
    id: string;
    name: string;
    usedQuantity: number;
    cost: number;
}

interface ProcessingModalProps {
    isOpen: boolean;
    onClose: () => void;
    machine: any;
    onSuccess: () => void;
}

type ActionType = 'REPAIR' | 'REQUEST_APPROVAL' | 'SCRAP';

export default function ProcessingModal({ isOpen, onClose, machine, onSuccess }: ProcessingModalProps) {
    const serialNumber = machine?.serialNumber;
    const [notes, setNotes] = useState('');
    const [actionType, setActionType] = useState<ActionType | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);
    const [laborCostInput, setLaborCostInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch Spare Parts (Inventory at Center)
    const { data: spareParts } = useQuery({
        queryKey: ['inventory-parts'],
        queryFn: async () => {
            return await api.getInventory();
        }
    });

    const filteredParts = useMemo(() => {
        const partsList = spareParts?.data || [];
        if (!partsList.length) return [];
        let parts = [...partsList];
        if (searchQuery) {
            parts = parts.filter((p: any) =>
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return parts.slice(0, 50); // Limit results for performance
    }, [spareParts, searchQuery]);

    const laborCost = parseFloat(laborCostInput) || 0;

    const partsTotal = useMemo(() => {
        return selectedParts.reduce((sum, p) => sum + (p.cost * p.usedQuantity), 0);
    }, [selectedParts]);

    const grandTotal = partsTotal + laborCost;

    const togglePart = (part: any) => {
        const existing = selectedParts.find(p => p.id === part.id);
        if (existing) {
            setSelectedParts(selectedParts.filter(p => p.id !== part.id));
        } else {
            setSelectedParts([...selectedParts, {
                id: part.id,
                name: part.name,
                usedQuantity: 1,
                cost: part.defaultCost || 0
            }]);
        }
    };

    const updatePartQuantity = (partId: string, delta: number) => {
        setSelectedParts(prev => prev.map(p => {
            if (p.id === partId) {
                return { ...p, usedQuantity: Math.max(1, p.usedQuantity + delta) };
            }
            return p;
        }));
    };

    const handleSubmit = async () => {
        if (!actionType) return;
        setIsSubmitting(true);

        try {
            const payload = {
                parts: selectedParts.map(p => ({
                    partId: p.id,
                    name: p.name,
                    quantity: p.usedQuantity,
                    cost: p.cost
                })),
                cost: grandTotal,
                notes: notes
            };

            if (actionType === 'REPAIR') {
                await api.transitionMachineState(machine.id, 'READY_FOR_RETURN', notes, {
                    ...payload,
                    resolution: 'REPAIRED'
                });
            } else if (actionType === 'REQUEST_APPROVAL') {
                await api.transitionMachineState(machine.id, 'AWAITING_APPROVAL', notes, payload);
            } else if (actionType === 'SCRAP') {
                await api.transitionMachineState(machine.id, 'READY_FOR_RETURN', notes, {
                    resolution: 'SCRAPPED'
                });
            }
            toast.success('تم تنفيذ الإجراء بنجاح');
            onSuccess();
        } catch (error: any) {
            console.error('Submit error:', error);
            const msg = error?.response?.data?.message || error?.response?.data?.error || 'تعذر تنفيذ الإجراء';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getActionConfig = () => {
        switch (actionType) {
            case 'REPAIR':
                return {
                    title: 'إتمام الصيانة والإصلاح',
                    subtitle: 'سيتم تحويل حالة الماكينة إلى "تم الإصلاح" وجاهزة للتسليم',
                    icon: <CheckCircle2 size={24} strokeWidth={2.5} />,
                    colorClass: 'bg-emerald-50 text-emerald-600 border-emerald-100',
                    headerGradient: 'from-emerald-600 to-teal-700'
                };
            case 'REQUEST_APPROVAL':
                return {
                    title: 'طلب موافقة على التكلفة',
                    subtitle: 'سيتم إرسال تقرير التكلفة وقطع الغيار لفرع المنشأ للموافقة',
                    icon: <ClipboardCheck size={24} strokeWidth={2.5} />,
                    colorClass: 'bg-blue-50 text-blue-600 border-blue-100',
                    headerGradient: 'from-blue-600 to-indigo-700'
                };
            case 'SCRAP':
                return {
                    title: 'تكهين الماكينة (Scrap)',
                    subtitle: 'الماكينة غير قابلة للإصلاح وسيتم نقلها لمخزن الخردة',
                    icon: <Trash2 size={24} strokeWidth={2.5} />,
                    colorClass: 'bg-red-50 text-red-600 border-red-100',
                    headerGradient: 'from-red-600 to-rose-700'
                };
            default:
                return {
                    title: 'معالجة الماكينة تقنياً',
                    subtitle: 'تحديد الإجراء المطلوب تنفيذه على الماكينة حالياً',
                    icon: <Settings size={24} strokeWidth={2.5} />,
                    colorClass: 'bg-slate-50 text-slate-600 border-slate-100',
                    headerGradient: 'from-slate-700 to-slate-900'
                };
        }
    };

    const config = getActionConfig();

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
            <DialogContent
                className="p-0 border-0 flex flex-col max-h-[96vh] h-auto overflow-hidden sm:max-w-3xl rounded-[3rem] shadow-2xl bg-white [&>button]:hidden text-right"
                dir="rtl"
            >
                {/* Premium Header */}
                <div className={cn("modal-header shrink-0 p-8 pb-6 bg-gradient-to-br relative overflow-hidden text-right transition-all duration-700", config.headerGradient)}>
                    <div className="absolute top-0 left-0 w-full h-full opacity-15 pointer-events-none">
                        <div className="absolute -top-1/2 -left-1/4 w-[150%] h-[150%] bg-white rounded-full blur-[120px] rotate-12"></div>
                    </div>

                    <div className="modal-header-content relative z-10 text-right">
                        <div className="flex items-center gap-5 justify-start">
                            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl text-white">
                                {config.icon}
                            </div>
                            <div className="text-right">
                                <h2 className="modal-title font-black text-white leading-tight tracking-tight text-2xl">{config.title}</h2>
                                <div className="flex items-center gap-2 mt-1 justify-end">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                                    <p className="text-white/80 font-bold text-[10px] uppercase tracking-widest opacity-90">{config.subtitle}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button type="button" className="modal-close bg-white/10 hover:bg-white/20 text-white transition-all p-2 rounded-xl backdrop-blur-sm" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/30 custom-scroll">

                    {/* Top Stats/Info Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 flex items-center gap-5 shadow-sm">
                            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                                <Package size={28} />
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">الماكينة المستهدفة</span>
                                <h3 className="text-xl font-black text-slate-900 font-mono tracking-tighter leading-none">{serialNumber}</h3>
                                <span className="text-[10px] font-bold text-slate-500 uppercase">{machine?.model || 'POS Terminal'}</span>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-[2rem] border border-indigo-100 flex items-center justify-between shadow-sm relative overflow-hidden group">
                            <div className="absolute left-[-10px] bottom-[-10px] opacity-10 group-hover:rotate-12 transition-transform duration-700">
                                <DollarSign size={80} />
                            </div>
                            <div className="text-right relative z-10">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">إجمالي التكلفة</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-black text-indigo-900 font-mono tracking-tighter">{grandTotal.toLocaleString('ar-EG')}</span>
                                    <span className="text-xs font-black text-indigo-400">EGP</span>
                                </div>
                            </div>
                            <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100">
                                <Sparkles size={24} />
                            </div>
                        </div>
                    </div>

                    {/* Action Selector if none selected */}
                    {!actionType ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-3 leading-none">اختر الإجراء المطلوب تنفيذه</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <button
                                    onClick={() => setActionType('REPAIR')}
                                    className="p-6 bg-white border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50/50 rounded-[2.5rem] flex flex-col items-center gap-4 transition-all group active:scale-95 shadow-sm hover:shadow-xl hover:shadow-emerald-50"
                                >
                                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500 shadow-sm">
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <div className="text-center">
                                        <span className="font-black text-slate-900 block text-base">إصلاح تام</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Complete Repair</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setActionType('REQUEST_APPROVAL')}
                                    className="p-6 bg-white border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50/50 rounded-[2.5rem] flex flex-col items-center gap-4 transition-all group active:scale-95 shadow-sm hover:shadow-xl hover:shadow-blue-50"
                                >
                                    <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-sm">
                                        <ClipboardCheck size={32} />
                                    </div>
                                    <div className="text-center">
                                        <span className="font-black text-slate-900 block text-base">طلب موافقة</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cost Approval</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setActionType('SCRAP')}
                                    className="p-6 bg-white border-2 border-slate-100 hover:border-red-500 hover:bg-red-50/50 rounded-[2.5rem] flex flex-col items-center gap-4 transition-all group active:scale-95 shadow-sm hover:shadow-xl hover:shadow-red-50"
                                >
                                    <div className="p-4 bg-red-50 text-red-600 rounded-2xl group-hover:bg-red-600 group-hover:text-white transition-all duration-500 shadow-sm">
                                        <Trash2 size={32} />
                                    </div>
                                    <div className="text-center">
                                        <span className="font-black text-slate-900 block text-base">تكهين</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Scrap & Retire</span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-700">

                            {/* Selected Action Status */}
                            <div className={cn("p-6 rounded-[2.5rem] border-2 flex items-center justify-between transition-all", config.colorClass)}>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow-sm">
                                        {config.icon}
                                    </div>
                                    <div className="text-right">
                                        <h4 className="font-black text-lg leading-tight">{config.title}</h4>
                                        <p className="text-[10px] font-bold opacity-70 italic">تم اختيار هذا الإجراء حالياً</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setActionType(null)}
                                    className="text-xs font-black underline opacity-60 hover:opacity-100"
                                >
                                    تغيير النوع
                                </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                <div className="space-y-8">
                                    {/* Action Notes */}
                                    <div className="space-y-4">
                                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-3 leading-none">
                                            <PenTool size={14} className="text-indigo-500" />
                                            تفاصيل العمل الفني / ملاحظات
                                        </label>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            className="smart-input min-h-[140px] p-6 text-sm font-bold bg-white border-2 border-slate-100 focus:border-indigo-500 rounded-[2rem] shadow-sm resize-none transition-all placeholder:text-slate-200"
                                            placeholder="اكتب ما تم فحصه، الأعطال المكتشفة، وتفاصيل الإصلاح..."
                                        />
                                    </div>

                                    {/* Costs / Settings */}
                                    <div className="space-y-4">
                                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-3 leading-none">
                                            <DollarSign size={14} className="text-indigo-500" />
                                            تكلفة المصنعية أو العمل (Labor)
                                        </label>
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={laborCostInput}
                                                onChange={(e) => setLaborCostInput(e.target.value.replace(/[^0-9.]/g, ''))}
                                                className="smart-input h-16 pr-12 pl-12 text-xl font-black bg-white border-2 border-slate-100 focus:border-indigo-500 rounded-2xl shadow-sm font-mono tracking-tighter"
                                                placeholder="0.00"
                                            />
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">EGP</span>
                                            <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    {/* Parts Selection (Only for Repair/Approval) */}
                                    {actionType !== 'SCRAP' && (
                                        <div className="space-y-4">
                                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-3 leading-none">
                                                <Package size={14} className="text-indigo-500" />
                                                قطع الغيار المستهلكة
                                            </label>

                                            <div className="relative group">
                                                <input
                                                    type="text"
                                                    placeholder="ابحث عن قطعة غيار أو SKU..."
                                                    className="smart-input h-14 pr-12 text-sm font-bold bg-white border-2 border-slate-100 focus:border-indigo-500 rounded-2xl shadow-sm transition-all"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                />
                                                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                            </div>

                                            <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 overflow-hidden shadow-sm flex flex-col h-[280px]">
                                                <div className="flex-1 overflow-y-auto custom-scroll divide-y divide-slate-50">
                                                    {filteredParts.length > 0 ? (
                                                        filteredParts.map(part => {
                                                            const isSelected = selectedParts.find(p => p.id === part.id);
                                                            return (
                                                                <div
                                                                    key={part.id}
                                                                    onClick={() => togglePart(part)}
                                                                    className={cn(
                                                                        "p-4 flex items-center justify-between hover:bg-indigo-50 transition-all cursor-pointer group/item",
                                                                        isSelected && "bg-indigo-50/50"
                                                                    )}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={cn(
                                                                            "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                                                                            isSelected ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" : "border-slate-200 bg-white"
                                                                        )}>
                                                                            {isSelected && <CheckCircle2 size={14} strokeWidth={3} />}
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <span className="font-black text-sm text-slate-800 block leading-none mb-1">{part.name}</span>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-[10px] font-bold text-slate-400">{part.defaultCost} EGP</span>
                                                                                {part.quantity <= 5 && <span className="text-[9px] font-black text-red-500 bg-red-50 px-2 rounded-full">مخزون حرج: {part.quantity}</span>}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {isSelected && (
                                                                        <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-indigo-100" onClick={e => e.stopPropagation()}>
                                                                            <button
                                                                                onClick={() => updatePartQuantity(part.id, -1)}
                                                                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-all"
                                                                            >
                                                                                <Minus size={16} strokeWidth={3} />
                                                                            </button>
                                                                            <span className="w-6 text-center text-sm font-black text-indigo-900 font-mono italic">{isSelected.usedQuantity}</span>
                                                                            <button
                                                                                onClick={() => updatePartQuantity(part.id, 1)}
                                                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all"
                                                                            >
                                                                                <Plus size={16} strokeWidth={3} />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="h-full flex flex-col items-center justify-center text-slate-300 p-10 gap-3">
                                                            <Package size={40} strokeWidth={1} />
                                                            <span className="text-xs font-black">لا توجد قطع مطابقة</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Selected parts summary chip */}
                                                {selectedParts.length > 0 && (
                                                    <div className="p-4 bg-indigo-600 text-white flex items-center justify-between shadow-xl">
                                                        <span className="text-xs font-black">إجمالي القطع: {selectedParts.length}</span>
                                                        <span className="font-mono font-black italic">{partsTotal.toLocaleString('ar-EG')} EGP</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {actionType === 'SCRAP' && (
                                        <div className="h-full flex flex-col items-center justify-center bg-red-50/50 rounded-[3rem] border-2 border-dashed border-red-100 p-8 text-center text-red-600 gap-4">
                                            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl shadow-red-100">
                                                <AlertCircle size={40} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-xl mb-1">تأكيد التكهين النهائي</h4>
                                                <p className="text-sm font-bold opacity-70">سيتم استبعاد الماكينة من المخزون النشط نهائياً وتحويلها للسكراب. هذا الإجراء غير قابل للتراجع.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Premium Footer */}
                <div className="modal-footer p-8 bg-white border-t border-slate-100 shrink-0 flex items-center gap-4 justify-between relative overflow-hidden">
                    <button
                        type="button"
                        onClick={onClose}
                        className="smart-btn-secondary h-16 px-10 border-2 border-slate-100 text-slate-500 font-black text-base transition-all hover:bg-slate-50 disabled:opacity-50"
                        disabled={isSubmitting}
                    >
                        إلغاء
                    </button>

                    <button
                        onClick={handleSubmit}
                        disabled={!actionType || isSubmitting}
                        className={cn(
                            "smart-btn-primary flex-1 h-16 shadow-2xl transition-all font-black text-lg flex items-center justify-center gap-4 relative z-10",
                            (actionType && !isSubmitting)
                                ? actionType === 'SCRAP'
                                    ? "bg-red-600 border-b-4 border-red-800 hover:bg-red-700 text-white shadow-red-100"
                                    : "bg-indigo-600 border-b-4 border-indigo-800 hover:bg-indigo-700 text-white shadow-indigo-100"
                                : "bg-slate-100 text-slate-300 cursor-not-allowed border-0 shadow-none grayscale"
                        )}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={24} className="animate-spin" strokeWidth={3} />
                                جاري التنفيذ...
                            </>
                        ) : (
                            <>
                                {actionType === 'REPAIR' ? <Wrench size={24} strokeWidth={3} /> : actionType === 'REQUEST_APPROVAL' ? <ClipboardCheck size={24} strokeWidth={3} /> : <Trash2 size={24} strokeWidth={3} />}
                                {actionType === 'REPAIR' ? 'إتمام الإصلاح وحفظ البيانات' : actionType === 'REQUEST_APPROVAL' ? 'إرسال التقرير للموافقة' : actionType === 'SCRAP' ? 'تأكيد التكهين والاستبعاد' : 'يرجى اختيار الإجراء'}
                            </>
                        )}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
