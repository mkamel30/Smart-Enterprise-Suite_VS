import { useState, useMemo, useEffect } from 'react';
import { Search, X, User, Monitor, Wrench, AlertCircle, CheckCircle2, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from './ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

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
            // Priority 1: Use full objects if provided
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

            // Priority 3: Fallback - Create partial objects from prefilled IDs and names
            // This ensures the form is NOT empty even if the search list hasn't loaded or doesn't contain this customer
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
            // Simple mapping - the backend already filtered these
            results.push({
                type: 'customer',
                customer,
                matchText: `${customer.bkcode} - ${customer.client_name}`
            });

            // Also check if machines match the query (server search matches both but we might want to highlight machines)
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

        // Unique results to avoid duplications if both name and machines match
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCustomer || !problemDescription) return;

        onSubmit({
            customerId: selectedCustomer.bkcode,
            machineId: selectedMachine?.id || null,
            problemDescription
        });
    };

    const clearSelection = () => {
        setSelectedCustomer(null);
        setSelectedMachine(null);
    };

    // Progress indicator
    const getProgress = () => {
        if (!selectedCustomer) return 1;
        if (selectedCustomer && !selectedMachine && selectedCustomer.posMachines?.length > 0) return 2;
        if (selectedCustomer && (selectedMachine || !selectedCustomer.posMachines?.length)) return 3;
        return 1;
    };

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="p-0 border-0 [&>button]:hidden flex flex-col max-h-[90vh] h-auto overflow-hidden sm:max-w-xl"
                dir="rtl"
            >
                {/* Header Sub-Organism */}
                <div className="bg-primary p-6 sm:p-8 text-primary-foreground relative shrink-0">
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 rounded-xl border border-white/10">
                                <Wrench size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-black">طلب صيانة جديد</h2>
                                <p className="text-primary-foreground/70 text-sm mt-1 font-inter">Smart Enterprise Suite - Digital Maintenance System</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                        >
                            <X size={22} />
                        </button>
                    </div>

                    {/* Progress Molecule */}
                    <div className="flex items-center gap-2 mt-6 sm:mt-8 relative z-10">
                        {[1, 2, 3].map((step) => (
                            <div key={step} className="flex items-center gap-2 flex-1">
                                <div className={`
                                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all duration-300
                                    ${getProgress() >= step
                                        ? 'bg-white text-primary'
                                        : 'bg-white/20 text-white/40'}
                                `}>
                                    {getProgress() > step ? <CheckCircle2 size={18} /> : step}
                                </div>
                                {step < 3 && (
                                    <div className={`flex-1 h-1 rounded-full transition-all duration-300 ${getProgress() > step ? 'bg-white' : 'bg-white/20'}`}></div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Body Component - Scrollable Area */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                    <form id="create-request-form" onSubmit={handleSubmit} className="space-y-5">

                        {/* Step 1: Search */}
                        {!selectedCustomer && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="flex items-center gap-2 text-slate-600 mb-2">
                                    <Search size={16} />
                                    <span className="text-sm font-medium">الخطوة 1: ابحث عن العميل</span>
                                </div>

                                <div className="relative">
                                    <div className="relative group">
                                        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="رقم العميل، الاسم، أو سيريال الماكينة..."
                                            value={searchQuery}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value);
                                                setShowResults(true);
                                            }}
                                            onFocus={() => setShowResults(true)}
                                            className="w-full border border-border rounded-lg pr-4 pl-12 py-4 text-base focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all bg-muted/50 placeholder:text-muted-foreground/60"
                                            autoFocus
                                        />
                                        {isSearching && (
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                <Loader2 size={18} className="animate-spin text-primary" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Search Results Dropdown */}
                                    {showResults && searchResults.length > 0 && (
                                        <div className="absolute z-20 w-full mt-2 bg-card border border-border rounded-xl shadow-xl max-h-56 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                            {searchResults.map((result, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => handleSelectResult(result)}
                                                    className="w-full text-right px-4 py-3 hover:bg-muted border-b border-border last:border-0 flex items-center gap-3 transition-colors group"
                                                >
                                                    <div className={`p-2 rounded-lg ${result.type === 'machine' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'} group-hover:scale-105 transition-transform`}>
                                                        {result.type === 'machine' ? <Monitor size={18} /> : <User size={18} />}
                                                    </div>
                                                    <div className="flex-1 text-sm font-black text-foreground">{result.matchText}</div>
                                                    <ChevronRight size={16} className="text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:text-primary transition-all" />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {showResults && searchQuery.length >= 2 && searchResults.length === 0 && (
                                        <div className="absolute z-20 w-full mt-2 bg-white border-2 border-slate-100 rounded-2xl shadow-xl p-6 text-center animate-in fade-in duration-200">
                                            <AlertCircle size={32} className="mx-auto text-slate-300 mb-2" />
                                            <p className="text-slate-500">لا توجد نتائج مطابقة</p>
                                        </div>
                                    )}
                                </div>

                                {/* Quick Tips */}
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                                    <Sparkles size={18} className="text-amber-500 mt-1" />
                                    <div>
                                        <p className="text-xs font-black text-amber-900">نصيحة سريعة</p>
                                        <p className="text-[11px] font-bold text-amber-700 mt-0.5">يمكنك البحث برقم كود العميل أو رقم سيريال الماكينة لسهولة الوصول</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Selected Customer + Machine Selection */}
                        {selectedCustomer && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                {/* Selected Customer Card */}
                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 relative overflow-hidden">
                                    <div className="flex justify-between items-start relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-emerald-500 text-white rounded-lg">
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <div className="font-black text-emerald-900 text-base">{selectedCustomer.client_name}</div>
                                                <div className="text-[11px] font-black text-emerald-600 mt-1 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded inline-block">
                                                    {selectedCustomer.bkcode}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={clearSelection}
                                            className="p-1.5 text-emerald-600 hover:bg-emerald-200/30 rounded-lg transition-colors"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Machine Selection */}
                                {!selectedMachine && selectedCustomer.posMachines?.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Monitor size={16} />
                                            <span className="text-sm font-medium">الخطوة 2: اختر الماكينة</span>
                                        </div>
                                        <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                                            {selectedCustomer.posMachines.map((machine: any) => (
                                                <button
                                                    key={machine.id}
                                                    type="button"
                                                    onClick={() => setSelectedMachine(machine)}
                                                    className="text-right p-4 border border-border rounded-lg hover:border-primary hover:bg-muted flex justify-between items-center transition-all group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-muted text-muted-foreground rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                            <Monitor size={18} />
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-sm text-foreground font-mono">{machine.serialNumber}</div>
                                                            <div className="text-[10px] font-bold text-muted-foreground uppercase">{machine.model || 'POS Terminal'}</div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight size={16} className="text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:text-primary transition-all" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Selected Machine Molecule */}
                                {selectedMachine && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 relative overflow-hidden">
                                        <div className="flex justify-between items-center relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-blue-500 text-white rounded-lg">
                                                    <Monitor size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-black text-blue-900 font-mono text-base">{selectedMachine.serialNumber}</div>
                                                    <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">{selectedMachine.model || 'POS Terminal'}</div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedMachine(null)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-200/40 rounded-lg transition-colors"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* No machines message */}
                                {!selectedCustomer.posMachines?.length && (
                                    <div className="text-center py-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                        <Monitor size={32} className="mx-auto text-slate-300 mb-2" />
                                        <p className="text-slate-500">لا توجد ماكينات مسجلة لهذا العميل</p>
                                    </div>
                                )}

                                {/* Step 3: Problem Description */}
                                {(selectedMachine || !selectedCustomer.posMachines?.length) && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <AlertCircle size={16} />
                                            <span className="text-sm font-medium">الخطوة 3: وصف المشكلة</span>
                                        </div>

                                        <div>
                                            <textarea
                                                value={problemDescription}
                                                onChange={(e) => setProblemDescription(e.target.value)}
                                                className="w-full border border-border rounded-lg px-4 py-4 focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none bg-muted/50 resize-none transition-all placeholder:text-muted-foreground/60 text-sm font-bold"
                                                rows={4}
                                                placeholder="اكتب وصف المشكلة..."
                                                required
                                                autoFocus
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </form>
                </div>

                {/* Footer - Fixed at bottom */}
                {selectedCustomer && (selectedMachine || !selectedCustomer.posMachines?.length) && (
                    <div className="p-6 border-t border-border shrink-0 flex gap-3 bg-white z-20 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-12 border border-border text-muted-foreground rounded-lg font-black hover:bg-muted transition-colors text-xs"
                        >
                            إلغاء
                        </button>
                        <button
                            form="create-request-form"
                            type="submit"
                            disabled={!problemDescription}
                            className="flex-[2] h-12 bg-primary text-primary-foreground rounded-lg font-black hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center gap-2 text-xs"
                        >
                            <Wrench size={18} />
                            حفظ طلب الصيانة
                        </button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
