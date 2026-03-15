import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Building2, Plus, Edit2, Trash2, X, Check, MapPin, Hash, Shield, Briefcase, Filter, Search, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';

export default function BranchesSettings() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<any>(null);
    const [branchToDelete, setBranchToDelete] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        address: '',
        phone: '',
        managerEmail: '',
        type: 'BRANCH',
        maintenanceCenterId: '',
        parentBranchId: ''
    });

    // ESC key handler for modal
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    const { data: branchesData, isLoading } = useQuery<any>({
        queryKey: ['branches'],
        queryFn: () => api.getBranches()
    });

    // Handle both array (legacy) and paginated response
    const branches = Array.isArray(branchesData) ? branchesData : (branchesData?.data || []);

    const createMutation = useMutation({
        mutationFn: (data: any) => api.createBranch(data),
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
            queryClient.invalidateQueries({ queryKey: ['branches'] });
        }
    });

    const resetForm = () => {
        setFormData({
            name: '',
            type: 'BRANCH',
            code: '',
            address: '',
            phone: '',
            managerEmail: '',
            maintenanceCenterId: '',
            parentBranchId: ''
        });
        setEditingBranch(null);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        resetForm();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingBranch) {
            updateMutation.mutate({ id: editingBranch.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleEdit = (branch: any) => {
        setEditingBranch(branch);
        setFormData({
            name: branch.name,
            type: branch.type,
            code: branch.code || '',
            address: branch.address || '',
            phone: branch.phone || '',
            managerEmail: branch.manager?.email || '',
            maintenanceCenterId: branch.maintenanceCenterId || '',
            parentBranchId: branch.parentBranchId || ''
        });
        setIsModalOpen(true);
    };

    const handleDelete = (branch: any) => {
        setBranchToDelete(branch);
    };

    const filteredBranches = branches?.filter((branch: any) =>
        branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'MAIN_STORE': return 'المخزن الرئيسي';
            case 'MAINTENANCE_CENTER': return 'مركز الصيانة المركزية';
            case 'ADMIN_AFFAIRS': return 'الشئون الإدارية (HQ)';
            default: return 'فرع تشغيلي';
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'ADMIN_AFFAIRS': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'MAINTENANCE_CENTER': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'MAIN_STORE': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            default: return 'bg-blue-100 text-blue-700 border-blue-200';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'ADMIN_AFFAIRS': return <Shield size={20} />;
            case 'MAINTENANCE_CENTER': return <Store size={20} />;
            case 'MAIN_STORE': return <Briefcase size={20} />;
            default: return <Building2 size={20} />;
        }
    };

    if (isLoading) return <div className="p-8 text-center text-slate-500">جاري التحميل...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/50 backdrop-blur-xl p-6 rounded-3xl border border-white/20 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-[#0A2472] tracking-tight">إدارة الفروع</h1>
                    <p className="text-slate-500 mt-2 font-medium">إضافة وتعديل بيانات الفروع والمخازن</p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-[#0A2472] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#0A2472]/90 transition-all shadow-lg hover:shadow-[#0A2472]/20 active:scale-95"
                >
                    <Plus size={20} />
                    <span>إضافة فرع</span>
                </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <div className="relative max-w-md">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="بحث باسم الفرع أو الكود..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pr-10 pl-4 py-3 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-all font-medium"
                        />
                    </div>
                </div>

                {/* Groups */}
                <div className="space-y-10 p-6">
                    {/* HQ & Administrative Entities */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-1.5 h-6 bg-purple-600 rounded-full" />
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider">الإدارة العامة والكيانات المركزية (HQ)</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Static/Pseudo HQ representation */}
                            <div className="bg-gradient-to-br from-slate-900 to-[#0A2472] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
                                            <Shield size={24} strokeWidth={2.5} />
                                        </div>
                                        <span className="bg-white/10 text-white/80 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-white/10">System Root</span>
                                    </div>
                                    <h3 className="text-xl font-black mb-1">الإدارة العامة</h3>
                                    <p className="text-blue-200/60 text-xs font-bold mb-4 uppercase tracking-[0.2em]">General Management</p>
                                    <div className="h-px bg-white/10 w-full mb-4" />
                                    <div className="flex items-center gap-2 text-blue-100/60 text-[10px] font-black uppercase tracking-widest">
                                        <Check size={14} className="text-green-400" />
                                        <span>كيان سيادي (إدارة النظام)</span>
                                    </div>
                                </div>
                            </div>

                            {/* Dynamic HQ Entities */}
                            {filteredBranches.filter((b: any) => ['ADMIN_AFFAIRS', 'MAINTENANCE_CENTER'].includes(b.type)).map((branch: any) => (
                                <div key={branch.id} className="bg-white rounded-3xl p-6 border-2 border-slate-100 shadow-sm hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all group">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 ${branch.type === 'ADMIN_AFFAIRS' ? 'bg-purple-50 text-purple-600' : 'bg-amber-50 text-amber-600'
                                            }`}>
                                            {getTypeIcon(branch.type)}
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleEdit(branch)} className="p-2 text-slate-400 hover:text-primary transition-colors"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDelete(branch)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    <h3 className="font-black text-slate-800 text-lg mb-1">{branch.name}</h3>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${getTypeColor(branch.type)}`}>
                                        {getTypeLabel(branch.type)}
                                    </span>
                                    <div className="mt-6 space-y-2">
                                        <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold">
                                            <Hash size={14} />
                                            <span className="font-mono">{branch.code}</span>
                                        </div>
                                        {branch.address && (
                                            <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold truncate">
                                                <MapPin size={14} />
                                                <span>{branch.address}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Operational Branches */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider">الفروع التشغيلية ومنافذ البيع</h2>
                        </div>
                        <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 overflow-hidden shadow-sm">
                            <table className="w-full text-right">
                                <thead className="bg-slate-50/50">
                                    <tr className="border-b border-slate-100">
                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">الفرع</th>
                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">الكود</th>
                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">العنوان</th>
                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">الارتباط</th>
                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredBranches.filter((b: any) => b.type === 'BRANCH').map((branch: any) => (
                                        <tr key={branch.id} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="p-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                                                        <Store size={18} strokeWidth={2.5} />
                                                    </div>
                                                    <span className="text-sm font-black text-slate-700">{branch.name}</span>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <span className="font-mono text-sm font-bold text-slate-500">{branch.code}</span>
                                            </td>
                                            <td className="p-6 text-slate-500 text-xs font-bold max-w-xs truncate">{branch.address || '-'}</td>
                                            <td className="p-6">
                                                {branch.maintenanceCenter && (
                                                    <div className="flex items-center gap-2 text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100 w-fit">
                                                        <Store size={12} />
                                                        {branch.maintenanceCenter.name}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-6">
                                                <div className="flex gap-2 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEdit(branch)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-primary hover:border-primary/30 flex items-center justify-center transition-all shadow-sm"><Edit2 size={16} /></button>
                                                    <button onClick={() => handleDelete(branch)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 flex items-center justify-center transition-all shadow-sm"><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm transition-all animate-in fade-in duration-200">
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-[#0A2472] to-blue-900 p-6 flex items-center justify-between shrink-0 relative overflow-hidden">
                            <div className="relative z-10 flex items-center gap-3 text-white">
                                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md border border-white/10">
                                    {editingBranch ? <Edit2 size={24} /> : <Plus size={24} />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold">{editingBranch ? 'تعديل بيانات الفرع' : 'إضافة فرع جديد'}</h2>
                                    <p className="text-blue-200 text-sm mt-0.5">أدخل البيانات الأساسية للفرع</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="relative z-10 text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-xl transition-all"
                            >
                                <X size={24} />
                            </button>

                            {/* Decorative Background Elements */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
                        </div>

                        {/* Body */}
                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {editingBranch && (
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700">كود الفرع</label>
                                            <div className="relative group">
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                                    <Hash size={18} />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={formData.code}
                                                    readOnly
                                                    className="w-full pr-10 pl-4 py-3 bg-slate-100/50 text-slate-500 border-2 border-slate-200 rounded-xl outline-none font-mono font-bold text-right cursor-not-allowed"
                                                    placeholder="يتم إنشاؤه تلقائياً"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className={`space-y-2 ${!editingBranch ? 'col-span-1 md:col-span-2' : ''}`}>
                                        <label className="text-sm font-bold text-slate-700">اسم الفرع <span className="text-red-500">*</span></label>
                                        <div className="relative group">
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                                <Building2 size={18} />
                                            </div>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full pr-10 pl-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium"
                                                placeholder="مثال: الفرع الرئيسي"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">العنوان</label>
                                    <div className="relative group">
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                            <MapPin size={18} />
                                        </div>
                                        <input
                                            type="text"
                                            value={formData.address}
                                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                                            className="w-full pr-10 pl-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium"
                                            placeholder="العنوان التفصيلي (اختياري)"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">نوع الفرع <span className="text-red-500">*</span></label>
                                    <div className="relative group">
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                            <Filter size={18} />
                                        </div>
                                        <select
                                            value={formData.type}
                                            onChange={e => setFormData({ ...formData, type: e.target.value })}
                                            className="w-full pr-10 pl-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all appearance-none font-medium cursor-pointer"
                                        >
                                            <option value="BRANCH">فرع عادي</option>
                                            <option value="MAINTENANCE_CENTER">مركز صيانة</option>
                                            <option value="ADMIN_AFFAIRS">شئون إدارية</option>
                                        </select>
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                        </div>
                                    </div>
                                </div>

                                {formData.type === 'BRANCH' && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="text-sm font-bold text-slate-700">مركز الصيانة التابع له</label>
                                        <div className="relative group">
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                                <Briefcase size={18} />
                                            </div>
                                            <select
                                                value={formData.maintenanceCenterId}
                                                onChange={e => setFormData({ ...formData, maintenanceCenterId: e.target.value })}
                                                className="w-full pr-10 pl-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all appearance-none font-medium cursor-pointer"
                                            >
                                                <option value="">-- اختر مركز صيانة (اختياري) --</option>
                                                {branches.filter((b: any) => b.type === 'MAINTENANCE_CENTER' && b.id !== editingBranch?.id).map((branch: any) => (
                                                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                                                ))}
                                            </select>
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">الفرع الأب (للهيكلية الإدارية)</label>
                                    <div className="relative group">
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                            <Shield size={18} />
                                        </div>
                                        <select
                                            value={formData.parentBranchId}
                                            onChange={e => setFormData({ ...formData, parentBranchId: e.target.value })}
                                            className="w-full pr-10 pl-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all appearance-none font-medium cursor-pointer"
                                        >
                                            <option value="">-- اختر فرع أب (اختياري) --</option>
                                            {branches.filter((b: any) => b.id !== editingBranch?.id).map((branch: any) => (
                                                <option key={branch.id} value={branch.id}>{branch.name} ({branch.type})</option>
                                            ))}
                                        </select>
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-3 justify-end shrink-0">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-all"
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="px-8 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-primary to-blue-700 hover:from-blue-800 hover:to-primary shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 min-w-[160px]"
                                >
                                    {(createMutation.isPending || updateMutation.isPending) ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>جاري الحفظ...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check size={20} />
                                            <span>{editingBranch ? 'حفظ التعديلات' : 'إضافة الفرع'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div >
            )
            }

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
        </div >
    );
}
