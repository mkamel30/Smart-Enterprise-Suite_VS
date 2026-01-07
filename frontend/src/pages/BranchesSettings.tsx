import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Building2, Plus, Edit2, Trash2, X, Check, MapPin, Hash } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';

export default function BranchesSettings() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<any>(null);
    const [branchToDelete, setBranchToDelete] = useState<any>(null);
    const [formData, setFormData] = useState({ code: '', name: '', address: '', type: 'BRANCH', parentBranchId: '' });

    const { data: branches, isLoading } = useQuery({
        queryKey: ['branches'],
        queryFn: () => api.getBranches()
    });

    const createMutation = useMutation({
        mutationFn: (data: { code: string; name: string; address?: string; type?: string; parentBranchId?: string }) =>
            api.createBranch(data),
        onSuccess: () => {
            toast.success('تم إنشاء الفرع بنجاح');
            queryClient.invalidateQueries({ queryKey: ['branches'] });
            closeModal();
        },
        onError: (error: any) => {
            toast.error(error.message || 'فشل في إنشاء الفرع');
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) =>
            api.updateBranch(id, data),
        onSuccess: () => {
            toast.success('تم تحديث الفرع بنجاح');
            queryClient.invalidateQueries({ queryKey: ['branches'] });
            closeModal();
        },
        onError: (error: any) => {
            toast.error(error.message || 'فشل في تحديث الفرع');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.deleteBranch(id),
        onSuccess: () => {
            toast.success('تم حذف الفرع بنجاح');
            queryClient.invalidateQueries({ queryKey: ['branches'] });
        },
        onError: (error: any) => {
            toast.error(error.message || 'فشل في حذف الفرع');
        }
    });

    const toggleActiveMutation = useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            api.updateBranch(id, { isActive }),
        onSuccess: () => {
            toast.success('تم تحديث حالة الفرع');
            queryClient.invalidateQueries({ queryKey: ['branches'] });
        },
        onError: (error: any) => {
            toast.error(error.message || 'فشل في تحديث الفرع');
        }
    });

    const openModal = (branch?: any) => {
        if (branch) {
            setEditingBranch(branch);
            setFormData({
                code: branch.code,
                name: branch.name,
                address: branch.address || '',
                type: branch.type || 'BRANCH',
                parentBranchId: branch.maintenanceCenterId || branch.parentBranchId || ''
            });
        } else {
            setEditingBranch(null);
            setFormData({ code: '', name: '', address: '', type: 'BRANCH', parentBranchId: '' });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingBranch(null);
        setFormData({ code: '', name: '', address: '', type: 'BRANCH', parentBranchId: '' });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.code || !formData.name) {
            toast.error('الكود والاسم مطلوبان');
            return;
        }

        const payload = {
            ...formData,
            // Map parentBranchId to maintenanceCenterId for backend
            maintenanceCenterId: formData.parentBranchId || null
        };

        if (editingBranch) {
            updateMutation.mutate({ id: editingBranch.id, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleDelete = (branch: any) => {
        setBranchToDelete(branch);
    };

    const handleToggleActive = (branch: any) => {
        toggleActiveMutation.mutate({ id: branch.id, isActive: !branch.isActive });
    };

    return (
        <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen" dir="rtl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 className="text-2xl font-black text-[#0A2472] flex items-center gap-2">
                    <Building2 className="text-blue-600" />
                    إدارة الفروع
                </h1>
                <button
                    onClick={() => openModal()}
                    className="w-full sm:w-auto bg-gradient-to-r from-[#0A2472] to-[#0A2472]/90 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 font-black shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                >
                    <Plus size={18} />
                    إضافة فرع
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-8">جاري التحميل...</div>
            ) : branches?.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-lg">
                    <Building2 size={48} className="mx-auto text-slate-400 mb-4" />
                    <p className="text-slate-600">لا توجد فروع</p>
                    <button
                        onClick={() => openModal()}
                        className="mt-4 text-blue-600 hover:underline"
                    >
                        إضافة فرع جديد
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border-2 border-[#0A2472]/10 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full whitespace-nowrap">
                            <thead className="bg-gradient-to-r from-[#0A2472] to-[#0A2472]/90 text-white">
                                <tr>
                                    <th className="text-center px-4 py-3 font-black">نوع الفرع</th>
                                    <th className="text-center px-4 py-3 font-black">اسم الفرع</th>
                                    <th className="text-center px-4 py-3 font-black">التبعية</th>
                                    <th className="text-center px-4 py-3 font-black">العنوان</th>
                                    <th className="text-center px-4 py-3 font-black">الحالة</th>
                                    <th className="text-center px-4 py-3 font-black">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {branches?.map((branch: any) => (
                                    <tr key={branch.id} className="border-t hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-mono bg-slate-100 px-2 py-1 rounded w-fit text-sm">
                                                    {branch.code}
                                                </span>
                                                <span className={`text-xs px-2 py-0.5 rounded w-fit font-medium ${branch.type === 'MAINTENANCE_CENTER' ? 'bg-purple-100 text-purple-700' :
                                                    branch.type === 'ADMIN_AFFAIRS' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {branch.type === 'MAINTENANCE_CENTER' ? 'مركز صيانة' :
                                                        branch.type === 'ADMIN_AFFAIRS' ? 'شئون إدارية' : 'فرع'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-medium">{branch.name}</td>
                                        <td className="px-4 py-3 text-sm">
                                            {branch.maintenanceCenter ? (
                                                <div className="flex items-center gap-1 text-slate-600">
                                                    <span className="text-xs">تابع لـ:</span>
                                                    <span className="font-medium text-slate-900">{branch.maintenanceCenter.name}</span>
                                                </div>
                                            ) : branch.type === 'MAINTENANCE_CENTER' ? (
                                                <span className="text-xs text-slate-400">مركز رئيسي</span>
                                            ) : (
                                                <span className="text-xs text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {branch.address || '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => handleToggleActive(branch)}
                                                className={`px-3 py-1 rounded-full text-sm transition-colors ${branch.isActive
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                                                    }`}
                                            >
                                                {branch.isActive ? 'نشط' : 'غير نشط'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2 justify-center">
                                                <button
                                                    onClick={() => openModal(branch)}
                                                    className="p-2 text-[#6CE4F0] hover:bg-[#6CE4F0]/10 rounded-lg transition-all"
                                                    title="تعديل"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(branch)}
                                                    className="p-2 text-[#C85C8E] hover:bg-[#C85C8E]/10 rounded-lg transition-all"
                                                    title="حذف"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm sm:max-w-md">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h2 className="text-lg font-bold">
                                {editingBranch ? 'تعديل الفرع' : 'إضافة فرع جديد'}
                            </h2>
                            <button onClick={closeModal} className="text-slate-500 hover:text-slate-700">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    <Hash size={16} className="inline ml-1" />
                                    كود الفرع *
                                </label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2"
                                    placeholder="مثال: BR001"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    <Building2 size={16} className="inline ml-1" />
                                    اسم الفرع *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2"
                                    placeholder="مثال: الفرع الرئيسي"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    <MapPin size={16} className="inline ml-1" />
                                    العنوان
                                </label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2"
                                    placeholder="العنوان (اختياري)"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    نوع الفرع
                                </label>
                                <select
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2"
                                >
                                    <option value="BRANCH">فرع عادي</option>
                                    <option value="MAINTENANCE_CENTER">مركز صيانة</option>
                                    <option value="ADMIN_AFFAIRS">شئون إدارية</option>
                                </select>
                            </div>

                            {formData.type === 'BRANCH' && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        مركز الصيانة التابع له
                                    </label>
                                    <select
                                        value={formData.parentBranchId}
                                        onChange={e => setFormData({ ...formData, parentBranchId: e.target.value })}
                                        className="w-full border rounded-lg px-3 py-2"
                                    >
                                        <option value="">-- اختر مركز صيانة (اختياري) --</option>
                                        {branches?.filter((b: any) => b.type === 'MAINTENANCE_CENTER' && b.id !== editingBranch?.id).map((branch: any) => (
                                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="flex gap-2 pt-4">
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <Check size={18} />
                                    {editingBranch ? 'تحديث' : 'إضافة'}
                                </button>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 border py-2 rounded-lg hover:bg-slate-50"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={!!branchToDelete}
                title="حذف الفرع"
                message={`هل أنت متأكد من حذف فرع "${branchToDelete?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
                confirmText="نعم، حذف"
                cancelText="إلغاء"
                onConfirm={() => {
                    if (branchToDelete) {
                        deleteMutation.mutate(branchToDelete.id);
                        setBranchToDelete(null);
                    }
                }}
                onCancel={() => setBranchToDelete(null)}
                type="danger"
            />
        </div>
    );
}
