import React, { useState, useRef, useEffect } from 'react';
import { Plus, Download, Upload, Check, Trash2, Search, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ORDER_TYPES } from './constants';
import toast from 'react-hot-toast';

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

    // Filter Items Logic (Hide filtered types for Admin Affairs)
    const isAdminAffairs = user?.role === 'ADMIN_AFFAIRS';
    const visibleTypes = isAdminAffairs
        ? ORDER_TYPES.filter(t => t.value === 'MACHINE' || t.value === 'SIM')
        : ORDER_TYPES;

    // Handle clicking outside suggestions
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
        !items.some(added => added.serialNumber === item.serialNumber) // Exclude already added
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
        if (!newItem.serialNumber.trim()) {
            toast.error('السيريال مطلوب');
            return;
        }

        if (items.some(i => i.serialNumber === newItem.serialNumber.trim())) {
            toast.error('السيريال موجود بالفعل');
            return;
        }

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

        if (!selectedBranch) return toast.error('اختر الفرع أولاً');
        if (!selectedType) return toast.error('اختر نوع الأصناف أولاً');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('branchId', selectedBranch);
        formData.append('type', selectedType);
        formData.append('notes', notes);
        formData.append('createdBy', user?.id || '');
        formData.append('createdByName', user?.displayName || '');

        onImport(formData);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const downloadTemplate = () => {
        if (!selectedType) return toast.error('اختر نوع الأصناف أولاً');
        window.open(`http://localhost:5000/api/transfer-orders/template/${selectedType}`, '_blank');
    };

    return (
        <div className="bg-white rounded-lg border p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Form */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">الفرع *</label>
                        <select
                            value={selectedBranch}
                            onChange={e => setSelectedBranch(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2"
                            required
                        >
                            <option value="">-- اختر الفرع --</option>
                            {branches?.map((b: any) => (
                                <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">نوع الأصناف *</label>
                        <div className="flex gap-2">
                            {visibleTypes.map(type => {
                                const Icon = type.icon;
                                return (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => {
                                            setSelectedType(type.value);
                                            setItems([]); // Clear items on type change
                                            setNewItem({ serialNumber: '', type: '', manufacturer: '' });
                                            setSearchTerm('');
                                        }}
                                        className={`flex-1 p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${selectedType === type.value
                                            ? `border-${type.color}-500 bg-${type.color}-50`
                                            : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        <Icon size={24} className={selectedType === type.value ? `text-${type.color}-600` : 'text-slate-400'} />
                                        <span className="text-sm font-medium">{type.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg relative">
                        <label className="block text-sm font-medium mb-2">إضافة صنف</label>

                        {/* Searchable Inventory Input */}
                        <div className="flex gap-2 mb-2 relative" ref={searchRef}>
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    placeholder="ابدأ بكتابة السيريال..."
                                    value={searchTerm}
                                    onChange={e => {
                                        setSearchTerm(e.target.value);
                                        setNewItem({ ...newItem, serialNumber: e.target.value });
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    className="w-full border rounded-lg px-3 py-2 pl-8"
                                    disabled={!selectedType}
                                    onKeyDown={e => e.key === 'Enter' && addItem()}
                                />
                                <Search size={16} className="absolute left-2 top-3 text-slate-400" />

                                {/* Suggestions Dropdown */}
                                {showSuggestions && (selectedType === 'MACHINE' || selectedType === 'SIM') && (
                                    <div className="absolute z-10 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                                        {filteredInventory.length > 0 ? (
                                            filteredInventory.map((item: any) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => handleSelectItem(item)}
                                                    className="w-full text-right px-3 py-2 hover:bg-slate-50 border-b last:border-0 flex justify-between items-center"
                                                >
                                                    <span className="font-mono font-medium">{item.serialNumber}</span>
                                                    <span className="text-xs text-slate-500">
                                                        {selectedType === 'MACHINE' ? item.model : item.type}
                                                    </span>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-2 text-center text-sm text-slate-500">
                                                {availableInventory && availableInventory.length > 0 ? 'لا توجد نتائج مطابقة' : 'لا توجد أصناف متاحة في المخزن'}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={addItem}
                                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90"
                            >
                                <Plus size={18} />
                            </button>
                        </div>

                        {/* Auto-filled details */}
                        {newItem.serialNumber && (
                            <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                                <div className="bg-white p-2 rounded border">
                                    <span className="text-slate-500 text-xs block">النوع/الموديل</span>
                                    <span className="font-medium">{newItem.type || '-'}</span>
                                </div>
                                {selectedType === 'MACHINE' && (
                                    <div className="bg-white p-2 rounded border">
                                        <span className="text-slate-500 text-xs block">المصنّع</span>
                                        <span className="font-medium">{newItem.manufacturer || '-'}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                            <Package size={12} />
                            {selectedType === 'MACHINE' || selectedType === 'SIM'
                                ? `متاح في المخزن: ${filteredInventory.length} صنف`
                                : 'اختر نوع الأصناف للبحث في المخزن'}
                        </p>
                    </div>

                    <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">رفع من Excel</p>
                                <p className="text-sm text-slate-500 text-xs">ملف Excel يحتوي على الأصناف</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={downloadTemplate}
                                    className="flex items-center gap-1 text-blue-600 hover:underline text-sm"
                                >
                                    <Download size={16} />
                                    القالب
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={!selectedBranch || !selectedType}
                                    className="flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                                >
                                    <Upload size={16} />
                                    رفع
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">ملاحظات</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2"
                            rows={3}
                            placeholder="ملاحظات إضافية..."
                        />
                    </div>
                </div>

                {/* Right Column - Items List */}
                <div className="flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium">
                            الأصناف المضافة ({items.length})
                        </label>
                        {items.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setItems([])}
                                className="text-red-600 text-sm hover:underline"
                            >
                                مسح الكل
                            </button>
                        )}
                    </div>
                    <div className="border rounded-lg flex-1 min-h-[200px] max-h-[400px] overflow-auto">
                        {items.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">
                                لم تتم إضافة أصناف بعد
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="text-center px-3 py-2 text-sm">#</th>
                                        <th className="text-center px-3 py-2 text-sm">السيريال</th>
                                        <th className="text-center px-3 py-2 text-sm">النوع</th>
                                        <th className="px-3 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, index) => (
                                        <tr key={index} className="border-t">
                                            <td className="px-3 py-2 text-sm text-slate-500">{index + 1}</td>
                                            <td className="px-3 py-2 font-mono text-sm">{item.serialNumber}</td>
                                            <td className="px-3 py-2 text-sm text-slate-600">{item.type || '-'}</td>
                                            <td className="px-3 py-2">
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(index)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isPending || !selectedBranch || !selectedType || items.length === 0}
                            className="w-full bg-primary text-white py-3 rounded-xl font-black hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transform active:scale-95 transition-all"
                        >
                            <Check size={20} />
                            {isPending ? 'جاري الإنشاء...' : 'إرسال الإذن'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
