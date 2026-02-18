import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, User, Monitor, Wrench, AlertCircle, CheckCircle2, ChevronRight, Sparkles, Loader2, Package, PenTool, Plus, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { cn } from '../lib/utils';

interface CreateRequestModalProps {
    onClose: () => void;
    onSubmit: (data: any) => void;
    prefilled?: {
        customerId: string;
        machineId: string;
        customerName?: string;
        machineSerial?: string;
        customer?: any;
        machine?: any;
    } | null;
}

export function CreateRequestModal({ onClose, onSubmit, prefilled }: CreateRequestModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [selectedMachine, setSelectedMachine] = useState<any>(null);
    const [problemDescription, setProblemDescription] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Live backend search
    const { data: customers = [], isLoading: isSearching } = useQuery({
        queryKey: ['customer-search-lite', debouncedSearch],
        queryFn: () => api.getCustomersLite(debouncedSearch),
        enabled: debouncedSearch.length >= 2 && !selectedCustomer,
    });

    // Handle prefilled data from navigation
    useEffect(() => {
        if (prefilled) {
            if (prefilled.customer) {
                setSelectedCustomer(prefilled.customer);
                if (prefilled.machine) {
                    setSelectedMachine(prefilled.machine);
                } else if (prefilled.machineId && prefilled.customer.posMachines) {
                    const machine = prefilled.customer.posMachines.find((m: any) => m.id === prefilled.machineId);
                    if (machine) setSelectedMachine(machine);
                }
                return;
            }

            if (prefilled.customerId) {
                const mockCustomer = {
                    bkcode: prefilled.customerId,
                    client_name: prefilled.customerName || 'عميل غير معروف',
                    posMachines: [] as any[]
                };

                if (prefilled.machineId && prefilled.machineSerial) {
                    const mockMachine = { id: prefilled.machineId, serialNumber: prefilled.machineSerial };
                    mockCustomer.posMachines = [mockMachine];
                    setSelectedMachine(mockMachine);
                }

                setSelectedCustomer(mockCustomer);
            }
        }
    }, [prefilled]);

    // Format search results for display
    const searchResults = useMemo(() => {
        if (!debouncedSearch || debouncedSearch.length < 2) return [];
        const query = debouncedSearch.toLowerCase();
        const results: any[] = [];

        customers?.forEach((customer: any) => {
            results.push({
                type: 'customer',
                customer,
                matchText: `${customer.bkcode} - ${customer.client_name}`
            });

            const matchingMachines = customer.posMachines?.filter((m: any) =>
                m.serialNumber?.toLowerCase().includes(query)
            ) || [];

            matchingMachines.forEach((machine: any) => {
                results.push({
                    type: 'machine',
                    customer,
                    machine,
                    matchText: `ماكينة: ${machine.serialNumber} (${customer.client_name})`
                });
            });
        });

        const seen = new Set();
        return results.filter(r => {
            const key = r.type === 'machine' ? `m-${r.machine.id}` : `c-${r.customer.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, 10);
    }, [debouncedSearch, customers]);

    const handleSelectResult = (result: any) => {
        setSelectedCustomer(result.customer);
        if (result.type === 'machine') {
            setSelectedMachine(result.machine);
        } else {
            setSelectedMachine(null);
        }
        setSearchQuery('');
        setShowResults(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCustomer || !problemDescription) return;

        setIsSubmitting(true);
        try {
            await onSubmit({
                customerId: selectedCustomer.bkcode,
                posMachineId: selectedMachine?.id || null,
                serialNumber: selectedMachine?.serialNumber || '',
                machineModel: selectedMachine?.model || '',
                machineManufacturer: selectedMachine?.manufacturer || '',
                complaint: problemDescription
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getProgress = () => {
        if (!selectedCustomer) return 1;
        if (selectedCustomer && !selectedMachine && selectedCustomer.posMachines?.length > 0) return 2;
        if (selectedCustomer && (selectedMachine || !selectedCustomer.posMachines?.length)) return 3;
        return 1;
    };

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="p-0 border-0 flex flex-col max-h-[90vh] h-auto overflow-hidden sm:max-w-md rounded-xl shadow-2xl bg-white [&>button]:hidden text-right"
                dir="rtl"
            >
                {/* Premium Header */}
                <div className="modal-header shrink-0 p-4 md:p-5 pb-3 bg-smart-gradient relative overflow-hidden text-right text-white">
                    <div className="modal-header-content relative z-10 flex flex-col gap-3">
                        <div className="flex items-center gap-3 justify-start">
                            <div className="p-2 bg-white/10 backdrop-blur-md rounded-lg border border-white/20">
                                <Plus size={16} strokeWidth={3} />
                            </div>
                            <div className="text-right">
                                <DialogTitle className="modal-title font-black leading-tight text-base">فتح أمر صيانة</DialogTitle>
                                <DialogDescription className="text-primary-foreground/80 font-bold text-[9px] mt-0.5">تسجيل بلاغ صيانة جديد</DialogDescription>
                            </div>
                        </div>

                        {/* Step Indicator */}
                        <div className="flex items-center gap-1.5 bg-black/10 backdrop-blur-sm p-1.5 rounded-lg border border-white/5 self-start">
                            {[1, 2, 3].map((step) => (
                                <React.Fragment key={step}>
                                    <div className={cn(
                                        "w-5 h-5 rounded flex items-center justify-center font-black text-[9px] transition-all",
                                        getProgress() >= step ? "bg-white text-primary" : "bg-white/10 text-white/40"
                                    )}>
                                        {getProgress() > step ? <Check size={10} strokeWidth={3} /> : step}
                                    </div>
                                    {step < 3 && <div className={cn("w-2 h-0.5 rounded-full", getProgress() > step ? "bg-white" : "bg-white/10")}></div>}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                    <button type="button" className="modal-close bg-white/10 hover:bg-white/20 text-white transition-all p-1 rounded-lg absolute top-4 left-4" onClick={onClose}>
                        <X size={14} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5 bg-slate-50/30 custom-scroll min-h-[300px]">
                    {/* Step 1: Customer Selection */}
                    {!selectedCustomer ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <label className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-3 leading-none">
                                <Search size={14} className="text-primary" />
                                1. البحث عن العميل المستهدف
                            </label>
                            <div className="relative group">
                                <Input
                                    type="text"
                                    placeholder="اسم العميل أو كود الحساب أو السيريال..."
                                    className="h-10 pr-10 pl-4 text-xs font-bold bg-white focus:ring-primary rounded-xl transition-all text-right"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={() => setShowResults(true)}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    {isSearching ? <Loader2 size={14} className="animate-spin text-primary" /> : <Search size={14} className="text-muted-foreground" />}
                                </div>

                                {showResults && searchResults.length > 0 && (
                                    <div className="absolute z-20 w-full mt-1.5 bg-white border border-slate-100 rounded-xl shadow-xl max-h-48 overflow-y-auto p-1.5 custom-scroll">
                                        {searchResults.map((result, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => handleSelectResult(result)}
                                                className="w-full text-right p-2.5 hover:bg-muted rounded-lg flex items-center gap-3 transition-all group"
                                            >
                                                <div className={cn(
                                                    "p-1.5 rounded transition-all",
                                                    result.type === 'machine' ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                                                )}>
                                                    {result.type === 'machine' ? <Package size={14} /> : <User size={14} />}
                                                </div>
                                                <div className="flex-1 text-[10px] font-bold text-slate-700">{result.matchText}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Selected Customer Card */}
                            <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden group">
                                <div className="flex items-center gap-3 relative z-10">
                                    <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-white">
                                        <User size={18} strokeWidth={2.5} />
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest block mb-0.5">العميل</span>
                                        <h3 className="text-sm font-black text-foreground leading-none mb-1">{selectedCustomer.client_name}</h3>
                                        <span className="text-[9px] font-bold text-primary font-mono tracking-widest">{selectedCustomer.bkcode}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setSelectedCustomer(null); setSelectedMachine(null); }}
                                    className="p-1.5 bg-slate-50 text-slate-400 hover:bg-slate-100 rounded-lg transition-all"
                                >
                                    <X size={14} strokeWidth={3} />
                                </button>
                            </div>

                            {/* Step 2: Machine Selection or Selected Machine */}
                            {!selectedMachine ? (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <label className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-3 leading-none">
                                        <Package size={14} className="text-primary" />
                                        2. تحديد الماكينة المتضررة
                                    </label>
                                    <div className="grid grid-cols-1 gap-3">
                                        {selectedCustomer.posMachines?.length > 0 ? (
                                            selectedCustomer.posMachines.map((m: any) => (
                                                <button
                                                    key={m.id}
                                                    onClick={() => setSelectedMachine(m)}
                                                    className="bg-white p-3 rounded-lg border border-slate-100 flex items-center justify-between hover:border-primary/50 transition-all group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-slate-50 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary rounded transition-colors">
                                                            <Package size={14} />
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="font-mono font-black text-foreground block text-sm leading-tight">{m.serialNumber}</span>
                                                            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter">{m.model || 'POS'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="w-5 h-5 rounded-full bg-slate-50 group-hover:bg-primary flex items-center justify-center text-transparent group-hover:text-white transition-all">
                                                        <Check size={10} strokeWidth={3} />
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <button
                                                onClick={() => setSelectedMachine({ id: null, serialNumber: 'غير معروف' })}
                                                className="p-6 text-center bg-white rounded-xl border border-dashed border-slate-200 hover:border-primary/50 transition-colors"
                                            >
                                                <AlertCircle size={24} className="text-slate-200 mx-auto mb-2" />
                                                <p className="text-muted-foreground font-bold text-[10px] mb-1">لا توجد ماكينات مسجلة</p>
                                                <span className="text-[9px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full">الاستمرار كبلاغ خارجي</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-primary/5 p-3 rounded-xl border border-primary/20 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center text-primary shadow-sm">
                                            <Package size={18} strokeWidth={2.5} />
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest block mb-0.5">الماكينة</span>
                                            <h3 className="text-sm font-black text-foreground font-mono">{selectedMachine.serialNumber}</h3>
                                            <span className="text-[9px] font-bold text-primary/60">{selectedMachine.model || 'POS'}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedMachine(null)}
                                        className="text-[9px] font-black text-primary bg-white px-2.5 py-1 rounded shadow-sm border border-primary/10 hover:bg-primary/5 transition-colors"
                                    >
                                        تغيير
                                    </button>
                                </div>
                            )}

                            {/* Step 3: Complaint Description */}
                            {selectedMachine && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
                                    <label className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-3 leading-none">
                                        <PenTool size={14} className="text-primary" />
                                        3. تفاصيل المشكلة أو العطل
                                    </label>
                                    <textarea
                                        className="smart-input min-h-[80px] p-3 text-xs font-bold bg-white border border-input focus:ring-primary rounded-xl resize-none transition-all placeholder:text-muted-foreground text-right"
                                        placeholder="وصف المشكلة، مثل: لا يطبع، شاشة سوداء..."
                                        value={problemDescription}
                                        onChange={(e) => setProblemDescription(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Premium Footer */}
                <div className="modal-footer p-4 bg-white border-t border-slate-100 shrink-0 flex items-center gap-2 justify-between">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        إلغاء
                    </Button>

                    {selectedCustomer && selectedMachine && (
                        <Button
                            onClick={handleSubmit}
                            disabled={!problemDescription || isSubmitting}
                            className={cn(
                                "flex-1 font-black",
                                (!problemDescription || isSubmitting) && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            {isSubmitting ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <>
                                    <Check size={14} strokeWidth={3} />
                                    حفظ البلاغ
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
