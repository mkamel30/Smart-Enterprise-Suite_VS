import { useState, useEffect } from 'react';
import adminClient from '../api/adminClient';
import { 
  Users as UsersIcon, UserPlus, Pencil, Trash2, 
  Search, RefreshCw, Save, Building, ShieldCheck 
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

export default function Users() {
    const [users, setUsers] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isIdenOpen, setIsIdenOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        displayName: '',
        password: '',
        role: 'CS_AGENT',
        branchId: '',
        isActive: true
    });

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await adminClient.get('/users');
            setUsers(res.data);
            
            const bRes = await adminClient.get('/branches');
            setBranches(bRes.data);
        } catch (error) {
            toast.error('فشل في تحميل بيانات المستخدمين');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditMode && selectedUser) {
                await adminClient.put(`/users/${selectedUser.id}`, formData);
                toast.success('تم تحديث بيانات المستخدم');
            } else {
                await adminClient.post('/users', formData);
                toast.success('تم إنشاء حساب المستخدم بنجاح');
            }
            setIsIdenOpen(false);
            fetchUsers();
            resetForm();
        } catch (error) {
            toast.error('فشل في حفظ بيانات المستخدم');
        }
    };

    const resetForm = () => {
        setFormData({
            username: '',
            email: '',
            displayName: '',
            password: '',
            role: 'CS_AGENT',
            branchId: '',
            isActive: true
        });
        setSelectedUser(null);
        setIsEditMode(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
        try {
            await adminClient.delete(`/users/${id}`);
            toast.success('تم حذف المستخدم');
            fetchUsers();
        } catch (error) {
            toast.error('فشل في حذف المستخدم');
        }
    };

    const filteredUsers = users.filter(u => 
        u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const roleMap: any = {
      'SUPER_ADMIN': 'مدير عام النظام',
      'MANAGEMENT': 'إدارة عليا',
      'BRANCH_ADMIN': 'مدير فرع',
      'ACCOUNTANT': 'محاسب',
      'CS_SUPERVISOR': 'مشرف خدمة عملاء',
      'CS_AGENT': 'موظف خدمة عملاء',
      'BRANCH_TECH': 'فني فرع'
    };

    return (
        <div className="space-y-8 pb-10 font-arabic" dir="rtl">
            {/* Header section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="text-right">
                    <h1 className="text-3xl sm:text-4xl font-black text-brand-primary uppercase tracking-tight flex items-center gap-3">
                        <ShieldCheck className="text-brand-cyan shrink-0" size={40} />
                        إدارة المستخدمين <span className="text-brand-cyan">والصلاحيات</span>
                    </h1>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">التحكم المركزي في هويات ووصول موظفي المجموعة</p>
                </div>
                <div className="flex gap-4 w-full lg:w-auto flex-col sm:flex-row-reverse">
                    <div className="flex gap-4 flex-1">
                        <button 
                            onClick={fetchUsers} 
                            className="p-4 bg-white border border-slate-100 text-slate-400 rounded-2xl hover:text-brand-primary transition-all active:scale-90 shadow-sm shrink-0"
                        >
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <div className="relative flex-1">
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input 
                                type="text" 
                                placeholder="بحث شامل..." 
                                className="w-full pr-12 pl-6 py-4 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-brand-primary/5 transition-all font-bold text-sm shadow-sm text-right"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <button 
                        onClick={() => { resetForm(); setIsIdenOpen(true); }}
                        className="flex items-center justify-center gap-3 px-8 py-4 bg-brand-primary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-brand-blue shadow-lg shadow-brand-primary/10 transition-all active:scale-95"
                    >
                        <UserPlus size={18} />
                        <span>إضافة مستخدم</span>
                    </button>
                </div>
            </div>

            {/* Responsive Users Table/Cards */}
            <div className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                <div className="overflow-x-auto custom-scroll">
                    <table className="w-full text-right min-w-[800px]">
                        <thead>
                            <tr className="border-b border-slate-50 bg-slate-50/30">
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">الهوية المؤسسية</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">الدور والصلاحيات</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">الفرع</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">الحالة</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-8 py-8"><div className="h-8 bg-slate-50 rounded-xl w-full"></div></td>
                                    </tr>
                                ))
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <UsersIcon className="mx-auto mb-4 opacity-10" size={60} />
                                        <p className="text-slate-300 font-bold uppercase tracking-widest text-sm">لا توجد هويات مطابقة للبحث</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((u) => (
                                    <tr key={u.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4 flex-row-reverse">
                                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-brand-primary group-hover:text-white transition-all shadow-inner shrink-0 ml-0 mr-auto">
                                                    <UsersIcon size={20} />
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-brand-primary group-hover:text-brand-blue transition-colors uppercase leading-tight">{u.displayName}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1" dir="ltr">{u.username}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className="text-[10px] font-black px-3 py-1 bg-brand-primary/5 text-brand-primary rounded-full uppercase border border-brand-primary/10">
                                                    {roleMap[u.role] || u.role}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[150px] text-left" dir="ltr">{u.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center gap-2 flex-row-reverse">
                                                <Building className="text-slate-300" size={14} />
                                                <span className="text-sm font-black text-slate-600 uppercase italic leading-none">{u.branch?.name || 'الإدارة المركزية'}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter flex-row-reverse ${u.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                                                {u.isActive ? 'نشط' : 'موقف'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-left">
                                            <div className="flex justify-start gap-2">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedUser(u);
                                                        setFormData({
                                                            username: u.username,
                                                            email: u.email || '',
                                                            displayName: u.displayName || '',
                                                            password: '',
                                                            role: u.role,
                                                            branchId: u.branchId || '',
                                                            isActive: u.isActive
                                                        });
                                                        setIsEditMode(true);
                                                        setIsIdenOpen(true);
                                                    }}
                                                    className="w-9 h-9 bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-brand-primary hover:border-brand-primary/30 rounded-xl transition-all shadow-sm shrink-0"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(u.id)}
                                                    className="w-9 h-9 bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 rounded-xl transition-all shadow-sm shrink-0"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* REFACTORED USER MODAL */}
            <Modal
                isOpen={isIdenOpen}
                onClose={() => setIsIdenOpen(false)}
                title={isEditMode ? 'تعديل هوية' : 'إنشاء هوية مستخدم'}
                subtitle="بروتوكول الوصول للمجموعة - العقدة 02"
                icon={<ShieldCheck className="text-brand-primary" size={36} />}
                maxWidth="max-w-2xl"
            >
                <form onSubmit={handleSave} className="space-y-6 sm:space-y-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">اسم المستخدم</label>
                            <input 
                                type="text" required 
                                className="smart-input text-right text-sm h-14"
                                value={formData.username}
                                onChange={(e) => setFormData({...formData, username: e.target.value})}
                                disabled={isEditMode}
                                dir="ltr"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">الاسم الكامل</label>
                            <input 
                                type="text" required 
                                className="smart-input text-right text-sm h-14"
                                value={formData.displayName}
                                onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">البريد الإلكتروني</label>
                            <input 
                                type="email" 
                                className="smart-input text-left text-sm h-14"
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                                dir="ltr"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">الدور الوظيفي</label>
                            <select 
                                className="smart-select bg-slate-50 border-transparent focus:bg-white text-right text-sm h-14"
                                value={formData.role}
                                onChange={(e) => setFormData({...formData, role: e.target.value})}
                            >
                                <option value="SUPER_ADMIN">مدير عام النظام</option>
                                <option value="MANAGEMENT">إدارة عليا</option>
                                <option value="BRANCH_ADMIN">مدير فرع</option>
                                <option value="ACCOUNTANT">محاسب</option>
                                <option value="CS_SUPERVISOR">مشرف خدمة عملاء</option>
                                <option value="CS_AGENT">موظف خدمة عملاء</option>
                                <option value="BRANCH_TECH">فني فرع</option>
                            </select>
                        </div>
                        <div className="space-y-2 col-span-1 sm:col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">التبعية (الفرع)</label>
                            <select 
                                className="smart-select bg-slate-50 border-transparent focus:bg-white text-right text-sm h-14"
                                value={formData.branchId}
                                onChange={(e) => setFormData({...formData, branchId: e.target.value})}
                            >
                                <option value="">الإدارة العامة / المركز الرئيسي</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                        {!isEditMode && (
                            <div className="space-y-2 col-span-1 sm:col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">كلمة المرور</label>
                                <input 
                                    type="password" required 
                                    className="smart-input text-left h-14"
                                    value={formData.password}
                                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                                    dir="ltr"
                                    placeholder="أدخل كلمة مرور قوية"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4 p-5 sm:p-6 bg-slate-50 rounded-[2rem] flex-row-reverse border border-slate-100">
                        <input 
                            type="checkbox" 
                            id="isActive"
                            className="w-6 h-6 rounded-lg text-brand-primary focus:ring-brand-primary accent-brand-primary"
                            checked={formData.isActive}
                            onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                        />
                        <label htmlFor="isActive" className="text-xs sm:text-sm font-black text-slate-600 uppercase italic text-right">تفعيل وصول هذا المستخدم للنظام</label>
                    </div>

                    <div className="flex flex-col sm:flex-row-reverse gap-4 pt-4">
                        <button 
                            type="submit" 
                            className="flex-[2] h-16 bg-brand-primary text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-brand-blue shadow-xl shadow-brand-primary/20 transition-all flex items-center justify-center gap-3 active:scale-95"
                        >
                            <Save size={18} />
                            حفظ واعتماد الهوية
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setIsIdenOpen(false)}
                            className="flex-1 h-16 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-slate-200 transition-all"
                        >
                            إلغاء
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
