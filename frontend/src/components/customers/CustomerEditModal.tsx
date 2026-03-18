import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { api } from '../../api/client';
import { toast } from 'react-hot-toast';
import { User, Phone, Tag, Monitor, Loader2, Save, X } from 'lucide-react';
import SmartConfirm from '../SmartConfirm';

interface CustomerEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: any;
    onUpdate: (updatedCustomer: any) => void;
    fieldToFocus?: string;
}

interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

export default function CustomerEditModal({ isOpen, onClose, customer, onUpdate, fieldToFocus }: CustomerEditModalProps) {
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [formData, setFormData] = useState({
        telephone_1: customer.telephone_1 || '',
        telephone_2: customer.telephone_2 || '',
        contact_person: customer.contact_person || '',
        clienttype: customer.clienttype || '',
        bk_type: customer.bk_type || ''
    });

    // Input Refs for focusing
    const refs: any = {
        telephone_1: useRef<HTMLInputElement>(null),
        telephone_2: useRef<HTMLInputElement>(null),
        contact_person: useRef<HTMLInputElement>(null),
        clienttype: useRef<HTMLInputElement>(null),
        bk_type: useRef<HTMLInputElement>(null)
    };

    useEffect(() => {
        if (isOpen && fieldToFocus && refs[fieldToFocus]?.current) {
            setTimeout(() => {
                refs[fieldToFocus].current.focus();
                refs[fieldToFocus].current.select();
            }, 100);
        }
    }, [isOpen, fieldToFocus, refs]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setShowConfirm(true);
    };

    const handleConfirmSave = async () => {
        setShowConfirm(false);
        setLoading(true);
        try {
            const result = await api.updateCustomer(customer.id, formData) as unknown as ApiResponse<any>;
            if (result.success) {
                toast.success(result.message || 'تم تحديث بيانات العميل');
                onUpdate(result.data);
                onClose();
            } else {
                toast.error(result.message || 'فشل تحديث البيانات');
            }
        } catch (error: any) {
            toast.error(error.message || 'حدث خطأ أثناء التحديث');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <SmartConfirm
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleConfirmSave}
                variant="primary"
                title="تأكيد حفظ التعديلات"
                description="هل أنت متأكد من حفظ التعديلات الجديدة؟ سيتم تسجيل سجل التغييرات في النظام."
                confirmText="حفظ التعديلات"
            />

            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="sm:max-w-[500px]" dir="rtl">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                <User size={24} />
                            </div>
                            <DialogTitle className="text-xl font-black">تعديل بيانات العميل</DialogTitle>
                        </div>
                        <p className="text-sm text-slate-500 font-bold">
                            تعديل البيانات الأساسية لـ: <span className="text-primary">{customer.client_name}</span>
                        </p>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-6 py-4">
                        <div className="grid grid-cols-1 gap-5">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2 text-slate-700 font-bold mb-1">
                                    <User size={16} className="text-primary" />
                                    الشخص المسؤول
                                </Label>
                                <Input
                                    ref={refs.contact_person}
                                    value={formData.contact_person}
                                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                    className="h-11 rounded-xl font-bold border-slate-200 focus:border-primary"
                                    placeholder="اسم الشخص المسؤول..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2 text-slate-700 font-bold mb-1">
                                        <Phone size={16} className="text-blue-500" />
                                        الهاتف 1
                                    </Label>
                                    <Input
                                        ref={refs.telephone_1}
                                        value={formData.telephone_1}
                                        onChange={(e) => setFormData({ ...formData, telephone_1: e.target.value })}
                                        className="h-11 rounded-xl font-bold border-slate-200 focus:border-primary"
                                        placeholder="01xxxxxxxxx"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2 text-slate-700 font-bold mb-1">
                                        <Phone size={16} className="text-primary/70" />
                                        الهاتف 2
                                    </Label>
                                    <Input
                                        ref={refs.telephone_2}
                                        value={formData.telephone_2}
                                        onChange={(e) => setFormData({ ...formData, telephone_2: e.target.value })}
                                        className="h-11 rounded-xl font-bold border-slate-200 focus:border-primary"
                                        placeholder="01xxxxxxxxx"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2 text-slate-700 font-bold mb-1">
                                        <Monitor size={16} className="text-orange-500" />
                                        تصنيف العميل
                                    </Label>
                                    <Input
                                        ref={refs.clienttype}
                                        value={formData.clienttype}
                                        onChange={(e) => setFormData({ ...formData, clienttype: e.target.value })}
                                        className="h-11 rounded-xl font-bold border-slate-200 focus:border-primary"
                                        placeholder="تصنيف العميل..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2 text-slate-700 font-bold mb-1">
                                        <Tag size={16} className="text-cyan-500" />
                                        نوع النشاط
                                    </Label>
                                    <Input
                                        ref={refs.bk_type}
                                        value={formData.bk_type}
                                        onChange={(e) => setFormData({ ...formData, bk_type: e.target.value })}
                                        className="h-11 rounded-xl font-bold border-slate-200 focus:border-primary"
                                        placeholder="نوع النشاط..."
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="flex gap-3 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                className="flex-1 h-12 rounded-xl border-slate-200 font-black hover:bg-slate-50 gap-2"
                            >
                                <X size={18} />
                                إلغاء
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="flex-[2] h-12 rounded-xl font-black bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 gap-2"
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                حفظ التعديلات
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
