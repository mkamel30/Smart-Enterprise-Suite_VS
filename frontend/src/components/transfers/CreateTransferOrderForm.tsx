import React, { useState, useRef, useEffect } from 'react';
import { Plus, Download, Upload, Check, Trash2, Search, Package, Landmark, FileText, Smartphone, ClipboardList, Tag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ORDER_TYPES } from './constants';
import { getLegalTargetBranches } from '../../utils/transferValidation';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

interface CreateFormProps {
    branches: any[] | undefined;
    user: any;
    onCreate: (data: any) => void;
    onImport: (formData: FormData) => void;
    isPending: boolean;
}

export function CreateTransferOrderForm({ branches, user, onCreate, onImport, isPending }: CreateFormProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [items, setItems] = useState<Array<{ serialNumber: string; type?: string; manufacturer?: string }>>([]);
    const [newItem, setNewItem] = useState({ serialNumber: '', type: '', manufacturer: '' });
    const [notes, setNotes] = useState('');

    // Inventory Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Fetch Inventory
    const { data: availableMachines } = useQuery({
        queryKey: ['warehouse-machines', 'available', user?.branchId],
        queryFn: () => api.getAvailableWarehouseMachines(user?.branchId),
        enabled: selectedType === 'MACHINE' && !!user?.branchId
    });

    const { data: availableSims } = useQuery({
        queryKey: ['warehouse-sims', 'available', user?.branchId],
        queryFn: () => api.getAvailableWarehouseSims(user?.branchId),
        enabled: selectedType === 'SIM' && !!user?.branchId
    });

    const availableInventory = selectedType === 'MACHINE' ? availableMachines : selectedType === 'SIM' ? availableSims : [];

    const fromBranch = branches?.find((b: any) => b.id === user?.branchId) || branches?.find((b: any) => b.type === 'ADMIN_AFFAIRS');

    const legalBranches = fromBranch && branches
        ? getLegalTargetBranches(fromBranch, branches, selectedType || undefined)
        : branches?.filter((b: any) => b.id !== user?.branchId && (b.type === 'BRANCH' || b.type === 'HQ' || b.type === 'ADMIN_AFFAIRS'));

    const isAdminAffairs = user?.role === 'ADMIN_AFFAIRS';
    const isHQ = user?.role === 'HQ' || user?.role === 'MANAGEMENT' || fromBranch?.type === 'HQ';

    const visibleTypes = (isAdminAffairs || isHQ)
        ? ORDER_TYPES.filter(t => t.value === 'MACHINE' || t.value === 'SIM')
        : ORDER_TYPES;


    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredInventory = availableInventory?.filter(item =>
        item.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !items.some(added => added.serialNumber === item.serialNumber)
    ) || [];

    const handleSelectItem = (item: any) => {
        setNewItem({
            serialNumber: item.serialNumber,
            type: item.model || item.type || '',
            manufacturer: item.manufacturer || ''
        });
        setSearchTerm(item.serialNumber);
        setShowSuggestions(false);
    };

    const addItem = () => {
        if (!newItem.serialNumber.trim()) return toast.error('السيريال مطلوب');
        if (items.some(i => i.serialNumber === newItem.serialNumber.trim())) return toast.error('السيريال موجود بالفعل');

        setItems([...items, {
            serialNumber: newItem.serialNumber.trim(),
            type: newItem.type || undefined,
            manufacturer: newItem.manufacturer || undefined
        }]);
        setNewItem({ serialNumber: '', type: '', manufacturer: '' });
        setSearchTerm('');
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = () => {
        if (!selectedBranch) return toast.error('اختر الفرع');
        if (!selectedType) return toast.error('اختر نوع الأصناف');
        if (items.length === 0) return toast.error('أضف صنف واحد على الأقل');

        onCreate({
            branchId: selectedBranch,
            type: selectedType,
            items,
            notes,
            createdBy: user?.id,
            createdByName: user?.displayName
        });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!selectedBranch || !selectedType) return toast.error('اختر الفرع ونوع الأصناف أولاً');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('branchId', selectedBranch);
        formData.append('type', selectedType);
        formData.append('notes', notes);
        formData.append('createdBy', user?.id || '');
        formData.append('createdByName', user?.displayName || '');

        onImport(formData);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const downloadTemplate = () => {
        if (!selectedType) return toast.error('اختر نوع الأصناف أولاً');
        window.open(`http://${window.location.hostname}:5002/api/transfer-orders/template/${selectedType}`, '_blank');
    };

    return (
        <div className="bg-white/60 backdrop-blur-xl border border-slate-200 rounded-[32px] p-8 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Left Column - Form Config */}
                <div className="lg:col-span-7 space-y-8">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                                <Landmark size={22} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900">إعدادات النقل</h3>
                                <p className="text-xs text-slate-500 font-medium">تحديد الفرع المستلم ونوع الأصول</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider mr-1">
                                    <Landmark size={14} className="text-slate-400" />
                                    الفرع المستلم *
                                </label>
                                <select
                                    value={selectedBranch}
                                    onChange={e => setSelectedBranch(e.target.value)}
                                    className="w-full border-slate-200 rounded-2xl px-5 py-4 bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-slate-700"
                                >
                                    <option value="">-- اختر الفرع المستلم --</option>
                                    {legalBranches?.map((b: any) => (
                                        <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider mr-1">
                                    <FileText size={14} className="text-slate-400" />
                                    نوع الأصول المنقولة *
                                </label>
                                <div className="flex gap-2">
                                    {visibleTypes.map(type => {
                                        const Icon = type.icon;
                                        const isSelected = selectedType === type.value;
                                        return (
                                            <button
                                                key={type.value}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedType(type.value);
                                                    setItems([]);
                                                    setNewItem({ serialNumber: '', type: '', manufacturer: '' });
                                                    setSearchTerm('');
                                                }}
                                                className={cn(
                                                    "flex-1 p-3.5 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all active:scale-95 group",
                                                    isSelected
                                                        ? "border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-100/50 scale-[1.02]"
                                                        : "border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-white"
                                                )}
                                            >
                                                <div className={cn(
                                                    "p-2 rounded-lg transition-colors",
                                                    isSelected ? "bg-indigo-500 text-white" : "bg-slate-200 text-slate-400 group-hover:bg-slate-300"
                                                )}>
                                                    <Icon size={20} />
                                                </div>
                                                <span className={cn(
                                                    "text-xs font-black",
                                                    isSelected ? "text-indigo-600" : "text-slate-500"
                                                )}>{type.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shadow-sm">
                                <Package size={22} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900">إضافة المحتويات</h3>
                                <p className="text-xs text-slate-500 font-medium">إضافة الأرقام التسلسلية يدوياً أو عبر ملف</p>
                            </div>
                        </div>

                        <div className="bg-slate-50/50 border border-slate-200/50 p-6 rounded-[24px]">
                            <div className="relative flex gap-3" ref={searchRef}>
                                <div className="flex-1 relative group">
                                    <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="ابدأ بكتابة السيريال للبحث..."
                                        value={searchTerm}
                                        onChange={e => {
                                            setSearchTerm(e.target.value);
                                            setNewItem({ ...newItem, serialNumber: e.target.value });
                                            setShowSuggestions(true);
                                        }}
                                        onFocus={() => setShowSuggestions(true)}
                                        className="w-full pr-12 pl-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 disabled:opacity-50 disabled:bg-slate-50"
                                        disabled={!selectedType}
                                        onKeyDown={e => e.key === 'Enter' && addItem()}
                                    />

                                    {showSuggestions && (selectedType === 'MACHINE' || selectedType === 'SIM') && (
                                        <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl mt-2 max-h-64 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="p-3 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b">
                                                نتائج البحث في المخزن
                                            </div>
                                            <div className="overflow-y-auto max-h-[220px]">
                                                {filteredInventory.length > 0 ? (
                                                    filteredInventory.map((item: any) => (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            onClick={() => handleSelectItem(item)}
                                                            className="w-full text-right px-5 py-3 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0 flex justify-between items-center group"
                                                        >
                                                            <div className="flex flex-col items-start">
                                                                <span className="font-mono font-black text-slate-900 group-hover:text-indigo-600">{item.serialNumber}</span>
                                                                <span className="text-[10px] text-slate-400 font-bold uppercase">{selectedType === 'MACHINE' ? 'Machine S/N' : 'SIM Card'}</span>
                                                            </div>
                                                            <span className="bg-slate-100 group-hover:bg-indigo-100 text-slate-500 group-hover:text-indigo-600 px-3 py-1 rounded-lg text-xs font-black transition-colors">
                                                                {selectedType === 'MACHINE' ? item.model : item.type}
                                                            </span>
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="p-8 text-center flex flex-col items-center gap-2">
                                                        <Search size={32} className="text-slate-200" />
                                                        <p className="text-sm text-slate-400 font-bold">
                                                            {availableInventory && availableInventory.length > 0 ? 'لا توجد نتائج مطابقة' : 'لا توجد أصناف متاحة في المخزن حالياً'}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={addItem}
                                    disabled={!newItem.serialNumber || !selectedType}
                                    className="bg-indigo-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
                                >
                                    <Plus size={28} />
                                </button>
                            </div>

                            {newItem.serialNumber && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 animate-in slide-in-from-top-2">
                                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                                        <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                                            <Tag size={16} />
                                        </div>
                                        <div>
                                            <span className="text-slate-400 text-[10px] block font-black uppercase">النوع/الموديل</span>
                                            <span className="font-bold text-slate-700">{newItem.type || 'إدخال يدوي'}</span>
                                        </div>
                                    </div>
                                    {selectedType === 'MACHINE' && (
                                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                                            <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                                                <Smartphone size={16} />
                                            </div>
                                            <div>
                                                <span className="text-slate-400 text-[10px] block font-black uppercase">المصنّع</span>
                                                <span className="font-bold text-slate-700">{newItem.manufacturer || 'إدخال يدوي'}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mt-6 pt-6 border-t border-slate-200/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <Package size={16} />
                                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                                        {selectedType ? `متاح في المخزن: ${availableInventory?.length || 0} صنف` : 'اختر نوع الأصناف للبحث'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={downloadTemplate}
                                        className="text-xs font-black text-blue-600 hover:text-blue-700 flex items-center gap-2 underline underline-offset-4"
                                    >
                                        <Download size={14} />
                                        تحميل القالب
                                    </button>
                                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={!selectedBranch || !selectedType || isPending}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 text-sm"
                                    >
                                        <Upload size={16} />
                                        رفع ملف Excel
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider mr-1">
                                <ClipboardList size={14} className="text-slate-400" />
                                ملاحظات إدارية
                            </label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="w-full border-slate-200 rounded-2xl px-5 py-4 bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-none transition-all font-medium text-slate-700 min-h-[120px]"
                                placeholder="اكتب أي تعليمات أو أسباب تخص عملية النقل..."
                                rows={3}
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column - Items Preview */}
                <div className="lg:col-span-5 flex flex-col h-full space-y-6">
                    <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                        <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                            <span className="text-lg font-black">{items.length}</span>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-black text-slate-900">مراجعة الأصناف</h3>
                            <p className="text-xs text-slate-500 font-medium">قائمة العناصر المحددة للنقل</p>
                        </div>
                        {items.length > 0 && (
                            <button onClick={() => setItems([])} className="text-xs font-black text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
                                مسح الكل
                            </button>
                        )}
                    </div>

                    <div className="flex-1 min-h-[400px] lg:max-h-[600px] overflow-hidden bg-slate-50/50 border border-slate-200/50 rounded-[28px] relative flex flex-col">
                        <div className="overflow-y-auto flex-1">
                            {items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 text-center h-full space-y-4">
                                    <div className="w-20 h-20 bg-white rounded-[24px] shadow-sm flex items-center justify-center text-slate-200 border border-slate-100">
                                        <Package size={40} />
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-400">لم تتم إضافة أصناف بعد</p>
                                        <p className="text-xs text-slate-300 font-bold max-w-[200px] mx-auto">ابدأ بالبحث عن السيريال أو ارفع ملف Excel لإضافة العناصر</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {items.map((item, index) => (
                                        <div key={index} className="p-4 bg-white/50 hover:bg-white transition-colors flex items-center gap-4 group">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-black shrink-0">
                                                {String(index + 1).padStart(2, '0')}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-mono font-black text-slate-900 text-sm">{item.serialNumber}</p>
                                                <p className="text-[10px] text-slate-400 font-bold">{item.type || 'صنف جديد'}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeItem(index)}
                                                className="w-10 h-10 rounded-xl flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-white border-t border-slate-100 mt-auto">
                            <Button
                                onClick={handleSubmit}
                                disabled={isPending || !selectedBranch || !selectedType || items.length === 0}
                                className="w-full py-8 text-lg font-black rounded-[20px] transition-all bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100"
                            >
                                {isPending ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                        جاري المعالجة...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Check size={24} />
                                        تأكيد الإرسال
                                    </div>
                                )}
                            </Button>
                            <p className="text-center mt-3 text-[10px] text-slate-400 font-black uppercase tracking-tight">اضغط لتأكيد إنشاء إذن النقل وإرساله للفروع المعنية</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
