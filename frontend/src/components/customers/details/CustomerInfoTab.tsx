import React, { useState } from 'react';
import { MapPin, Phone, User, Landmark, Building2, Tag, Monitor, FileText, Edit3, Check, X, Loader2, ShieldCheck } from 'lucide-react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { api } from '../../../api/client';
import toast from 'react-hot-toast';
import SmartConfirm from '../../SmartConfirm';
import { cn } from '../../../lib/utils';
import { useQuery } from '@tanstack/react-query';

interface InfoRowProps {
    fieldKey?: string;
    icon: React.ReactNode;
    label: string;
    value?: string;
    colorClass?: string;
    isEditing?: boolean;
    editValue?: string;
    onEditChange?: (val: string) => void;
    onEditClick?: () => void;
    onSave?: () => void;
    onCancel?: () => void;
    loading?: boolean;
    options?: { id: string; name: string }[];
}

function InfoRow({
    fieldKey, icon, label, value, colorClass = "text-slate-400",
    isEditing, editValue, onEditChange, onEditClick, onSave, onCancel, loading, options
}: InfoRowProps) {
    const isAddress = fieldKey === 'address';

    return (
        <div className="bg-card/50 border border-border p-6 rounded-[1.5rem] group hover:bg-card transition-all hover:shadow-xl shadow-slate-200/50 relative min-h-[110px] flex flex-col justify-center" dir="rtl">
            {!isEditing && onEditClick && (
                <button
                    onClick={onEditClick}
                    className="absolute bottom-4 left-4 p-2 bg-primary/10 text-primary rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:text-white z-10"
                    title="تعديل هذا الحقل"
                >
                    <Edit3 size={14} />
                </button>
            )}

            <div className="flex items-start gap-4 text-right overflow-hidden">
                <div className={`${colorClass} p-3 bg-muted rounded-2xl group-hover:bg-primary group-hover:text-white transition-all order-1 shrink-0`}>
                    {icon}
                </div>
                <div className="space-y-1 order-2 flex-1 min-w-0">
                    <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{label}</div>

                    {isEditing ? (
                        <div className="flex gap-2 items-center mt-1 animate-in slide-in-from-top-2 duration-200">
                            {options ? (
                                <Select value={editValue} onValueChange={onEditChange}>
                                    <SelectTrigger className="h-9 rounded-lg font-bold border-primary shadow-sm shadow-primary/10 w-full text-right" dir="rtl">
                                        <SelectValue placeholder="اختر..." />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        {options.map(opt => (
                                            <SelectItem key={opt.id} value={opt.name}>{opt.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    autoFocus
                                    value={editValue}
                                    onChange={(e) => onEditChange?.(e.target.value)}
                                    className="h-9 rounded-lg font-bold border-primary shadow-sm shadow-primary/10"
                                />
                            )}
                            <div className="flex gap-1 shrink-0">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                    onClick={onSave}
                                    disabled={loading}
                                >
                                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={16} />}
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-rose-600 hover:bg-rose-50 rounded-lg"
                                    onClick={onCancel}
                                    disabled={loading}
                                >
                                    <X size={16} />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div
                            className={cn(
                                "font-bold text-foreground truncate",
                                isAddress ? "text-[clamp(10px,1.1vw,16px)]" : "text-lg"
                            )}
                            title={value}
                        >
                            {value || '-'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function CustomerInfoTab({ customer: initialCustomer }: { customer: any }) {
    const [customer, setCustomer] = useState(initialCustomer);
    const [editingField, setEditingField] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Fetch Client Types for selects
    const { data: clientTypes } = useQuery({
        queryKey: ['client-types'],
        queryFn: () => api.getClientTypes()
    });

    const startEditing = (field: string, value: string) => {
        setEditingField(field);
        setEditValue(value || "");
    };

    const cancelEditing = () => {
        setEditingField(null);
        setEditValue("");
    };

    const handleSaveRequest = () => {
        setShowConfirm(true);
    };

    const handleActualSave = async () => {
        if (!editingField) return;

        setShowConfirm(false);
        setLoading(true);
        try {
            const updateData = { [editingField]: editValue };
            const result = await api.updateCustomer(customer.id, updateData) as any;

            // Updated check: backend success helper returns raw data if successful,
            // but if it's an error response it would have been caught by the request throw.
            // So if result exists and no error was thrown, it's a success.
            if (result) {
                toast.success('تم التحديث بنجاح');
                setCustomer({ ...customer, ...updateData });
                setEditingField(null);
            } else {
                toast.error('فشل التحديث');
            }
        } catch (error: any) {
            toast.error(error.message || 'حدث خطأ أثناء الاتصال بالسيرفر');
        } finally {
            setLoading(false);
        }
    };

    const rows = [
        { key: 'address', label: 'العنوان الجغرافي', icon: <MapPin size={22} />, color: 'text-emerald-500', editable: true },
        { key: 'telephone_1', label: 'رقم التواصل الأساسي', icon: <Phone size={22} />, color: 'text-blue-500', editable: true },
        { key: 'telephone_2', label: 'رقم التواصل البديل', icon: <Phone size={22} />, color: 'text-primary/70', editable: true },
        { key: 'contact_person', label: 'الشخص المسؤول', icon: <User size={22} />, color: 'text-purple-500', editable: true },
        { key: 'national_id', label: 'الرقم القومي / السجل', icon: <Landmark size={22} />, color: 'text-rose-500', editable: true },
        { key: 'supply_office', label: 'مكتب التموين', icon: <Building2 size={22} />, color: 'text-amber-500', editable: true },
        { key: 'bk_type', label: 'نوع النشاط', icon: <Tag size={22} />, color: 'text-cyan-500', editable: true, isSelect: true },
        { key: 'clienttype', label: 'تصنيف العميل', icon: <Monitor size={22} />, color: 'text-orange-500', editable: true, isSelect: true },
        { key: 'dept', label: 'القسم التابع له', icon: <FileText size={22} />, color: 'text-slate-500', editable: true },
    ];

    return (
        <div className="space-y-8 animate-fade-in py-2" dir="rtl">
            <SmartConfirm
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleActualSave}
                title="تأكيد التعديل"
                description={`هل أنت متأكد من تغيير "${rows.find(r => r.key === editingField)?.label}"؟`}
                variant="primary"
            />

            <div className="flex justify-between items-center mb-2 px-2">
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-black text-slate-800 text-right">البيانات الأساسية</h3>
                    <div className="w-1.5 h-8 bg-primary rounded-full" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-right">
                {rows.map((row) => (
                    <InfoRow
                        key={row.key}
                        fieldKey={row.key}
                        icon={row.icon}
                        label={row.label}
                        value={customer[row.key]}
                        colorClass={row.color}
                        isEditing={editingField === row.key}
                        editValue={editValue}
                        onEditChange={setEditValue}
                        onEditClick={row.editable ? () => startEditing(row.key, customer[row.key]) : undefined}
                        onSave={handleSaveRequest}
                        onCancel={cancelEditing}
                        loading={loading}
                        options={row.isSelect ? clientTypes : undefined}
                    />
                ))}
            </div>

            {customer.notes && (
                <div className="bg-card border-2 border-primary/10 p-8 rounded-[2rem] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-125 transition-transform">
                        <FileText size={80} />
                    </div>
                    <h4 className="text-xl font-black mb-4 flex items-center gap-3 text-primary">
                        <FileText size={22} />
                        ملاحظات إضافية
                    </h4>
                    <p className="text-foreground font-bold leading-relaxed relative z-10">{customer.notes}</p>
                </div>
            )}

            <div className="flex items-center justify-center gap-2 py-4 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <ShieldCheck size={16} className="text-emerald-500" />
                <span className="text-[11px] font-bold">جميع التعديلات يتم تسجيلها وحفظ القيم السابقة في سجل الرقابة التابع للنظام</span>
            </div>
        </div>
    );
}
