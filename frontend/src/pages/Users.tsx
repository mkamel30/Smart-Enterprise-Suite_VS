import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Trash2, UserPlus, Key, Filter, Building, Pencil, Check, X, Mail, Lock, Shield, Briefcase } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApiMutation } from '../hooks/useApiMutation';
import { ROLES, BRANCH_TYPES, getRoleDisplayName, getAvailableRoles } from '../lib/permissions';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHeader from '../components/PageHeader';


export default function Users() {
    const { user, activeBranchId } = useAuth();
    const isAdmin = !user?.branchId; // Super Admin or Management
    const [filterBranchId, setFilterBranchId] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [userToDelete, setUserToDelete] = useState<any>(null);
    const [userToEdit, setUserToEdit] = useState<any>(null);

    // New User State
    const [newUser, setNewUser] = useState({
        displayName: '',
        email: '',
        password: '',
        role: ROLES.CS_AGENT as string,
        branchId: '',
        canDoMaintenance: false,
        isActive: true
    });

    const queryClient = useQueryClient();

    // Fetch users
    const { data: usersData, isLoading } = useQuery<any>({
        queryKey: ['users', activeBranchId, filterBranchId],
        queryFn: async () => api.getUsers({ branchId: activeBranchId || filterBranchId }),
        enabled: !!user
    });

    const users = Array.isArray(usersData) ? usersData : ((usersData as any)?.data || []);

    // Fetch branches and centers for dropdowns
    const { data: branchesData } = useQuery({
        queryKey: ['branches-all'],
        queryFn: () => api.getBranches(), // This returns all branches including centers
        staleTime: 1000 * 60 * 60,
        enabled: !!user
    });

    const allBranches = Array.isArray(branchesData) ? branchesData : ((branchesData as any)?.data || []);

    // Derived lists for dropdowns
    const branchesOnly = allBranches.filter((b: any) => b.type === BRANCH_TYPES.BRANCH);
    const maintenanceCenters = allBranches.filter((b: any) => b.type === BRANCH_TYPES.MAINTENANCE_CENTER);
    const adminAffairs = allBranches.filter((b: any) => b.type === BRANCH_TYPES.ADMIN_AFFAIRS);

    // Reset Password State
    const [resetPasswordState, setResetPasswordState] = useState<{ userId: string | null, displayName: string, show: boolean }>({ userId: null, displayName: '', show: false });
    const [newPassword, setNewPassword] = useState('');

    // ESC key handler for modals
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showAddForm) setShowAddForm(false);
                if (userToEdit) setUserToEdit(null);
                if (resetPasswordState.show) setResetPasswordState({ userId: null, displayName: '', show: false });
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [showAddForm, userToEdit, resetPasswordState.show]);

    const createMutation = useApiMutation({
        mutationFn: (data: any) => api.createUser(data),
        successMessage: 'تم إضافة المستخدم بنجاح',
        errorMessage: 'فشل إضافة المستخدم',
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['users'] });
            setShowAddForm(false);
            setNewUser({
                displayName: '',
                email: '',
                password: '',
                role: ROLES.CS_AGENT,
                branchId: '',
                canDoMaintenance: false,
                isActive: true
            });
        }
    });

    const deleteMutation = useApiMutation({
        mutationFn: (id: string) => api.deleteUser(id),
        successMessage: 'تم حذف المستخدم',
        errorMessage: 'فشل حذف المستخدم',
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['users'] });
        }
    });

    const editMutation = useApiMutation({
        mutationFn: ({ id, data }: any) => api.updateUser(id, data),
        successMessage: 'تم تحديث بيانات المستخدم بنجاح',
        errorMessage: 'فشل تحديث بيانات المستخدم',
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['users'] });
            setUserToEdit(null);
        }
    });


    const resetPasswordMutation = useApiMutation({
        mutationFn: ({ id, password }: any) => api.updateUser(id, { password }),
        successMessage: 'تم تغيير كلمة المرور بنجاح',
        errorMessage: 'فشل تغيير كلمة المرور',
        onSuccess: () => {
            setResetPasswordState({ userId: null, displayName: '', show: false });
            setNewPassword('');
        }
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate based on role
        if (([ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR, ROLES.CS_AGENT, ROLES.BRANCH_TECH] as string[]).includes(newUser.role) && !newUser.branchId) {
            toast.error('يرجى اختيار الفرع');
            return;
        }
        if (([ROLES.CENTER_MANAGER, ROLES.CENTER_TECH] as string[]).includes(newUser.role) && !newUser.branchId) {
            toast.error('يرجى اختيار مركز الصيانة');
            return;
        }
        if (newUser.role === ROLES.ADMIN_AFFAIRS && !newUser.branchId) {
            toast.error('يرجى اختيار فرع الشئون الإدارية');
            return;
        }

        createMutation.mutate(newUser);
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const { id, displayName, email, role, branchId, canDoMaintenance, isActive } = userToEdit;
        editMutation.mutate({
            id,
            data: { displayName, email, role, branchId, canDoMaintenance, isActive }
        });
    };

    // Determine which dropdown to show based on selected role
    const renderEntitySelect = () => {
        const role = newUser.role;

        if (([ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ROLES.BRANCH_ADMIN, ROLES.ACCOUNTANT] as string[]).includes(role)) {
            return null; // Global roles don't need branch
        }

        let options: any[] = [];
        let label = '';
        let placeholder = '';

        if (([ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR, ROLES.CS_AGENT, ROLES.BRANCH_TECH] as string[]).includes(role)) {
            options = branchesOnly;
            label = 'الفرع';
            placeholder = 'اختر الفرع';
        } else if (([ROLES.CENTER_MANAGER, ROLES.CENTER_TECH] as string[]).includes(role)) {
            options = maintenanceCenters;
            label = 'مركز الصيانة';
            placeholder = 'اختر المركز';
        } else if (role === ROLES.ADMIN_AFFAIRS) {
            options = adminAffairs;
            label = 'مكتب الشئون الإدارية';
            placeholder = 'اختر المكتب';
        }

        return (
            <div>
                <label className="block text-xs font-black uppercase tracking-widest text-primary mb-2 mr-1">{label}</label>
                <select
                    value={newUser.branchId}
                    onChange={(e) => setNewUser({ ...newUser, branchId: e.target.value })}
                    className="smart-select"
                    required
                >
                    <option value="">{placeholder}</option>
                    {options.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
            </div>
        );
    };

    const renderEditEntitySelect = () => {
        const role = userToEdit?.role;

        if (!role || ([ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ROLES.BRANCH_ADMIN, ROLES.ACCOUNTANT] as string[]).includes(role)) {
            return null;
        }

        let options: any[] = [];
        let label = '';
        let placeholder = '';

        if (([ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR, ROLES.CS_AGENT, ROLES.BRANCH_TECH] as string[]).includes(role)) {
            options = branchesOnly;
            label = 'الفرع';
            placeholder = 'اختر الفرع';
        } else if (([ROLES.CENTER_MANAGER, ROLES.CENTER_TECH] as string[]).includes(role)) {
            options = maintenanceCenters;
            label = 'مركز الصيانة';
            placeholder = 'اختر المركز';
        } else if (role === ROLES.ADMIN_AFFAIRS) {
            options = adminAffairs;
            label = 'مكتب الشئون الإدارية';
            placeholder = 'اختر المكتب';
        }

        return (
            <div>
                <label className="block text-xs font-black uppercase tracking-widest text-primary mb-2 mr-1">{label}</label>
                <select
                    value={userToEdit.branchId || ''}
                    onChange={(e) => setUserToEdit({ ...userToEdit, branchId: e.target.value })}
                    className="smart-select"
                    required
                >
                    <option value="">{placeholder}</option>
                    {options.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
            </div>
        );
    };

    const filterElement = isAdmin ? (
        <div className="flex items-center gap-3 bg-white border-2 border-primary/10 px-5 py-3 rounded-2xl shadow-sm hover:shadow-md transition-all focus-within:ring-4 focus-within:ring-primary/5">
            <Filter size={18} className="text-primary/40" />
            <select
                value={filterBranchId}
                onChange={(e) => setFilterBranchId(e.target.value)}
                className="bg-transparent outline-none text-sm font-black text-primary min-w-48 appearance-none cursor-pointer"
            >
                <option value="">كل الفروع والمراكز</option>
                {allBranches?.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                ))}
            </select>
        </div>
    ) : null;

    const actionElements = (
        <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-black border border-blue-200">
                {users?.length || 0} مستخدم
            </span>
            <button
                onClick={() => setShowAddForm(true)}
                className="smart-btn-primary flex items-center gap-2"
            >
                <UserPlus size={20} />
                إضافة مستخدم
            </button>
        </div>
    );

    return (
        <div className="px-8 pt-6 pb-20 bg-slate-50/50 min-h-screen" dir="rtl">
            <PageHeader
                title="إدارة شؤون المستخدمين"
                subtitle="إدارة الحسابات، الصلاحيات، والوصول لموارد النظام"
                filter={filterElement}
                actions={actionElements}
                icon={<Shield size={28} className="text-blue-600" />}
            />

            {/* Premium Info Alert */}
            <div className="bg-blue-50/50 border-2 border-blue-100 rounded-[2rem] p-6 mb-10 flex items-start gap-5 shadow-xl shadow-blue-500/5 transition-all hover:bg-blue-50">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-inner">
                    <Building size={24} strokeWidth={2.5} />
                </div>
                <div className="space-y-1">
                    <h4 className="text-sm font-black text-blue-900 uppercase tracking-widest leading-none">تنبيه إداري</h4>
                    <p className="text-xs font-bold text-blue-700 leading-relaxed">
                        لإضافة مستخدم لجهة تابعة (فرع صيانة / مكتب إداري)، يرجى التأكد من تعريف الجهة أولاً في قسم إدارة المكاتب لربط الموظف بمقر عمله الصحيح.
                    </p>
                </div>
            </div>

            {/* Premium Users Table */}
            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto custom-scroll">
                    <table className="w-full text-right border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">الموظف</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">هوية الوصول</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">الدور الوظيفي</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">جهة التبعية</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {Array.isArray(users) && users.map((userData: any) => (
                                <tr key={userData.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="p-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-inner">
                                                <Briefcase size={20} strokeWidth={2.5} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-900 tracking-tight">{userData.displayName}</span>
                                                {userData.isActive ? (
                                                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-0.5">موظف مفعل</span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-0.5">موظف موقوف</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-600">{userData.email || 'حساب داخلي (بدون إيميل)'}</span>
                                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] mt-1">Direct Login</span>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <span className="px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-100 shadow-sm">
                                            {getRoleDisplayName(userData.role)}
                                        </span>
                                    </td>
                                    <td className="p-6">
                                        {/* Super Admin always gets the golden global identity */}
                                        {userData.role === ROLES.SUPER_ADMIN ? (
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-200 ring-2 ring-amber-100 italic font-black text-xs">SA</div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-amber-600 uppercase">مدير النظام</span>
                                                    <span className="text-[9px] font-black text-amber-400 tracking-widest uppercase leading-none mt-1">Full System Authority</span>
                                                </div>
                                            </div>
                                        ) : userData.branch?.name ? (
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${userData.branch.type === 'ADMIN_AFFAIRS' ? 'bg-purple-50 text-purple-600' :
                                                    userData.branch.type === 'MAINTENANCE_CENTER' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-400'
                                                    }`}>
                                                    {userData.branch.type === 'ADMIN_AFFAIRS' ? <Shield size={16} /> : <Building size={16} />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-700">{userData.branch.name}</span>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">
                                                        {userData.branch.type === 'ADMIN_AFFAIRS' ? 'HQ Admin' :
                                                            userData.branch.type === 'MAINTENANCE_CENTER' ? 'Main Center' : 'Sales Branch'}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg"><Shield size={16} /></div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-900 uppercase">الإدارة العامة</span>
                                                    <span className="text-[9px] font-black text-blue-600 tracking-widest uppercase leading-none mt-1">Global Context</span>
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-6">
                                        <div className="flex gap-2 justify-center">
                                            <button
                                                onClick={() => setUserToEdit({ ...userData })}
                                                className="w-10 h-10 bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-xl transition-all flex items-center justify-center shadow-sm"
                                                title="تعديل"
                                            >
                                                <Pencil size={18} strokeWidth={2.5} />
                                            </button>
                                            <button
                                                onClick={() => setResetPasswordState({ userId: userData.id, displayName: userData.displayName, show: true })}
                                                className="w-10 h-10 bg-white border border-slate-100 text-slate-400 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 rounded-xl transition-all flex items-center justify-center shadow-sm"
                                                title="كلمة المرور"
                                            >
                                                <Key size={18} strokeWidth={2.5} />
                                            </button>
                                            <button
                                                onClick={() => setUserToDelete(userData)}
                                                className="w-10 h-10 bg-white border border-slate-100 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-xl transition-all flex items-center justify-center shadow-sm"
                                                title="حذف"
                                            >
                                                <Trash2 size={18} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add User Modal */}
            {showAddForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm transition-all animate-in fade-in duration-200">
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-primary to-blue-900 p-6 flex items-center justify-between shrink-0 relative overflow-hidden">
                            <div className="absolute inset-0 bg-white/5 opacity-50 pattern-grid-lg"></div>
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md shadow-inner border border-white/10">
                                    <UserPlus className="text-white" size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white tracking-wide">إضافة مستخدم جديد</h2>
                                    <p className="text-blue-100 text-sm font-medium mt-1">أدخل بيانات المستخدم الجديد وصلاحياته</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-xl transition-all relative z-10"
                                onClick={() => setShowAddForm(false)}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Body */}
                        <form onSubmit={handleCreate} className="flex flex-col flex-1 overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">
                                {/* Personal Info Section */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 pb-2 border-b-2 border-slate-100">
                                        <div className="bg-blue-50 p-2 rounded-lg text-primary">
                                            <UserPlus size={20} />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800">البيانات الشخصية</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700">الاسم بالكامل <span className="text-red-500">*</span></label>
                                            <div className="relative group">
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                                    <UserPlus size={18} />
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="مثال: محمد صلاح"
                                                    value={newUser.displayName}
                                                    onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                                                    className="w-full pr-10 pl-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {newUser.role !== ROLES.BRANCH_TECH && (
                                            <div className="space-y-2">
                                                <label className="text-sm font-bold text-slate-700">البريد الإلكتروني <span className="text-red-500">*</span></label>
                                                <div className="relative group">
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                                        <Mail size={18} />
                                                    </div>
                                                    <input
                                                        type="email"
                                                        placeholder="admin@smart.com"
                                                        value={newUser.email}
                                                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                                        className="w-full pr-10 pl-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Security Section */}
                                {newUser.role !== ROLES.BRANCH_TECH && (
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 pb-2 border-b-2 border-slate-100">
                                            <div className="bg-amber-50 p-2 rounded-lg text-amber-600">
                                                <Lock size={20} />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-800">الأمان وكلمة المرور</h3>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-bold text-slate-700">كلمة المرور <span className="text-red-500">*</span></label>
                                                <div className="relative group">
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors">
                                                        <Key size={18} />
                                                    </div>
                                                    <input
                                                        type="password"
                                                        placeholder="••••••••••••"
                                                        value={newUser.password}
                                                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                                        className="w-full pr-10 pl-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 outline-none transition-all font-mono tracking-widest"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                                <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">متطلبات كلمة المرور:</p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className={`p-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${newUser.password.length >= 12 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${newUser.password.length >= 12 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                        12 خانة على الأقل
                                                    </div>
                                                    <div className={`p-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${/[A-Z]/.test(newUser.password) ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${/[A-Z]/.test(newUser.password) ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                        حرف كبير (A)
                                                    </div>
                                                    <div className={`p-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${/[a-z]/.test(newUser.password) ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${/[a-z]/.test(newUser.password) ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                        حرف صغير (a)
                                                    </div>
                                                    <div className={`p-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${/[0-9]/.test(newUser.password) ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${/[0-9]/.test(newUser.password) ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                        أرقام (123)
                                                    </div>
                                                    <div className={`p-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${/[@$!%*?&#]/.test(newUser.password) ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${/[@$!%*?&#]/.test(newUser.password) ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                        رموز (@#$)
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Role & Permissions Section */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 pb-2 border-b-2 border-slate-100">
                                        <div className="bg-purple-50 p-2 rounded-lg text-purple-600">
                                            <Shield size={20} />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800">الصلاحيات والدور الوظيفي</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700">الدور الوظيفي <span className="text-red-500">*</span></label>
                                            <div className="relative group">
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors">
                                                    <Briefcase size={18} />
                                                </div>
                                                <select
                                                    value={newUser.role}
                                                    onChange={(e) => {
                                                        const newRole = e.target.value;
                                                        const isTech = newRole === ROLES.BRANCH_TECH;
                                                        setNewUser({
                                                            ...newUser,
                                                            role: newRole,
                                                            branchId: '',
                                                            canDoMaintenance: isTech ? true : newUser.canDoMaintenance,
                                                            email: isTech ? '' : newUser.email,
                                                            password: isTech ? '' : newUser.password
                                                        });
                                                    }}
                                                    className="w-full pr-10 pl-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-purple-600 focus:bg-white focus:ring-4 focus:ring-purple-600/10 outline-none transition-all appearance-none font-medium cursor-pointer"
                                                    required
                                                >
                                                    {getAvailableRoles().map(role => (
                                                        <option key={role.value} value={role.value}>
                                                            {role.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="[&>div>label]:text-sm [&>div>label]:font-bold [&>div>label]:text-slate-700 [&>div>label]:mb-2 [&>div>label]:block [&>div>select]:w-full [&>div>select]:pr-10 [&>div>select]:pl-4 [&>div>select]:py-3 [&>div>select]:bg-slate-50 [&>div>select]:border-2 [&>div>select]:border-slate-200 [&>div>select]:rounded-xl [&>div>select]:focus:border-primary [&>div>select]:focus:bg-white [&>div>select]:focus:ring-4 [&>div>select]:focus:ring-primary/10 [&>div>select]:outline-none [&>div>select]:appearance-none [&>div>select]:font-medium [&>div>select]:cursor-pointer">
                                                {renderEntitySelect()}
                                            </div>
                                        </div>
                                    </div>

                                    {([ROLES.CENTER_TECH, ROLES.BRANCH_TECH, ROLES.CS_AGENT, ROLES.CS_SUPERVISOR] as string[]).includes(newUser.role) && (
                                        <div
                                            className={`group flex items-center justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer shadow-sm hover:shadow-md ${newUser.canDoMaintenance
                                                ? 'bg-blue-50/50 border-primary/30 ring-4 ring-primary/5'
                                                : 'bg-slate-50 border-slate-100 hover:border-primary/20 hover:bg-white'
                                                }`}
                                            onClick={() => setNewUser({ ...newUser, canDoMaintenance: !newUser.canDoMaintenance })}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 ${newUser.canDoMaintenance ? 'bg-primary text-white shadow-lg rotate-[360deg]' : 'bg-slate-200 text-slate-500'}`}>
                                                    <Briefcase size={22} strokeWidth={2.5} />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <label className="text-base font-black text-slate-800 cursor-pointer">تفعيل صلاحية "فني"</label>
                                                    <p className="text-xs font-bold text-slate-500">يسمح للموظف باستلام وتنفيذ طلبات الصيانة</p>
                                                </div>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={!!newUser.canDoMaintenance}
                                                onChange={(e) => setNewUser({ ...newUser, canDoMaintenance: e.target.checked })}
                                                className="h-6 w-6 rounded-lg cursor-pointer accent-primary"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-3 justify-end shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-all"
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-primary to-blue-700 hover:from-blue-800 hover:to-primary shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 min-w-[160px]"
                                    disabled={createMutation.isPending}
                                >
                                    {createMutation.isPending ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>جاري الإضافة...</span>
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus size={20} />
                                            <span>إضافة المستخدم</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {userToEdit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm transition-all animate-in fade-in duration-200">
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-white p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="bg-primary/5 p-3 rounded-2xl text-primary">
                                    <Pencil size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800">تعديل بيانات المستخدم</h2>
                                    <p className="text-slate-500 text-sm font-medium">تحديث المعلومات والأدوار</p>
                                </div>
                            </div>
                            <button type="button" className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-2 rounded-xl transition-all" onClick={() => setUserToEdit(null)}>
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">الاسم <span className="text-red-500">*</span></label>
                                        <div className="relative group">
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                                <UserPlus size={18} />
                                            </div>
                                            <input
                                                type="text"
                                                value={userToEdit.displayName}
                                                onChange={(e) => setUserToEdit({ ...userToEdit, displayName: e.target.value })}
                                                className="w-full pr-10 pl-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">البريد الإلكتروني</label>
                                        <div className="relative group">
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                                <Mail size={18} />
                                            </div>
                                            <input
                                                type="email"
                                                value={userToEdit.email || ''}
                                                onChange={(e) => setUserToEdit({ ...userToEdit, email: e.target.value })}
                                                className="w-full pr-10 pl-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">الدور (الصلاحية) <span className="text-red-500">*</span></label>
                                        <div className="relative group">
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors">
                                                <Shield size={18} />
                                            </div>
                                            <select
                                                value={userToEdit.role}
                                                onChange={(e) => setUserToEdit({ ...userToEdit, role: e.target.value, branchId: '' })}
                                                className="w-full pr-10 pl-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-purple-600 focus:bg-white focus:ring-4 focus:ring-purple-600/10 outline-none transition-all appearance-none font-medium cursor-pointer"
                                                required
                                            >
                                                {getAvailableRoles().map(role => (
                                                    <option key={role.value} value={role.value}>
                                                        {role.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="[&>div>label]:text-sm [&>div>label]:font-bold [&>div>label]:text-slate-700 [&>div>label]:mb-2 [&>div>label]:block [&>div>select]:w-full [&>div>select]:pr-10 [&>div>select]:pl-4 [&>div>select]:py-3 [&>div>select]:bg-slate-50 [&>div>select]:border-2 [&>div>select]:border-slate-200 [&>div>select]:rounded-xl [&>div>select]:focus:border-primary [&>div>select]:focus:bg-white [&>div>select]:focus:ring-4 [&>div>select]:focus:ring-primary/10 [&>div>select]:outline-none [&>div>select]:appearance-none [&>div>select]:font-medium [&>div>select]:cursor-pointer">
                                            {renderEditEntitySelect()}
                                        </div>
                                    </div>

                                    {([ROLES.CENTER_TECH, ROLES.BRANCH_TECH, ROLES.CS_AGENT, ROLES.CS_SUPERVISOR] as string[]).includes(userToEdit.role) && (
                                        <div
                                            className={`group flex items-center justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer shadow-sm hover:shadow-md ${userToEdit.canDoMaintenance
                                                ? 'bg-blue-50/50 border-primary/30 ring-4 ring-primary/5'
                                                : 'bg-slate-50 border-slate-100 hover:border-primary/20 hover:bg-white'
                                                }`}
                                            onClick={() => setUserToEdit({ ...userToEdit, canDoMaintenance: !userToEdit.canDoMaintenance })}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 ${userToEdit.canDoMaintenance ? 'bg-primary text-white shadow-lg rotate-[360deg]' : 'bg-slate-200 text-slate-500'}`}>
                                                    <Briefcase size={22} strokeWidth={2.5} />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <label className="text-base font-black text-slate-800 cursor-pointer">يمكنه تنفيذ طلبات الصيانة؟</label>
                                                    <p className="text-xs font-bold text-slate-500">تمكين الوصول لمهام الفنيين</p>
                                                </div>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={!!userToEdit.canDoMaintenance}
                                                onChange={(e) => setUserToEdit({ ...userToEdit, canDoMaintenance: e.target.checked })}
                                                className="h-6 w-6 rounded-lg cursor-pointer accent-primary"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    )}

                                    {userToEdit.role !== ROLES.SUPER_ADMIN && (
                                        <div
                                            className={`group flex items-center justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer shadow-sm hover:shadow-md ${userToEdit.isActive
                                                ? 'bg-emerald-50/50 border-emerald-500/30 ring-4 ring-emerald-500/5'
                                                : 'bg-red-50/50 border-red-500/30 ring-4 ring-red-500/5 hover:border-red-500/50'
                                                }`}
                                            onClick={() => setUserToEdit({ ...userToEdit, isActive: !userToEdit.isActive })}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 ${userToEdit.isActive ? 'bg-emerald-500 text-white shadow-lg' : 'bg-red-500 text-white shadow-lg'}`}>
                                                    <Shield size={22} strokeWidth={2.5} />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <label className="text-base font-black text-slate-800 cursor-pointer">حالة الحساب</label>
                                                    <p className={`text-xs font-bold ${userToEdit.isActive ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {userToEdit.isActive ? "فعّال - يمكنه تسجيل الدخول" : "موقوف - لن يتمكن من تسجيل الدخول"}
                                                    </p>
                                                </div>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={!!userToEdit.isActive}
                                                onChange={(e) => setUserToEdit({ ...userToEdit, isActive: e.target.checked })}
                                                className="h-6 w-6 rounded-lg cursor-pointer accent-primary"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    )}

                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-3 justify-end shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setUserToEdit(null)}
                                    className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-all"
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-primary to-blue-700 hover:from-blue-800 hover:to-primary shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 min-w-[160px]"
                                    disabled={editMutation.isPending}
                                >
                                    {editMutation.isPending ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {resetPasswordState.show && (
                <div className="modal-overlay" onClick={() => setResetPasswordState({ userId: null, displayName: '', show: false })}>
                    <div className="modal-container modal-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-header-content">
                                <Key className="modal-icon" size={24} />
                                <h2 className="modal-title">تغيير كلمة المرور</h2>
                            </div>
                            <button type="button" className="modal-close" onClick={() => setResetPasswordState({ userId: null, displayName: '', show: false })}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="text-sm font-semibold text-slate-700 mb-4">المستخدم: {resetPasswordState.displayName}</p>
                            <input
                                type="password"
                                placeholder="••••••••••••"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="smart-input font-mono mb-4"
                            />
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                <p className="text-xs font-semibold text-slate-600 mb-3">متطلبات كلمة المرور:</p>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[11px] font-bold ${newPassword.length >= 12 ? 'text-emerald-600' : 'text-slate-500'}`}>12 خانة على الأقل</span>
                                        <Check size={14} className={newPassword.length >= 12 ? 'text-emerald-500' : 'text-slate-200'} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[11px] font-bold ${(/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) ? 'text-emerald-600' : 'text-slate-500'}`}>حروف كبيرة وصغيرة (A/a)</span>
                                        <Check size={14} className={(/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) ? 'text-emerald-500' : 'text-slate-200'} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[11px] font-bold ${(/[0-9]/.test(newPassword) && /[@$!%*?&#]/.test(newPassword)) ? 'text-emerald-600' : 'text-slate-500'}`}>أرقام ورموز خاصة (@#1)</span>
                                        <Check size={14} className={(/[0-9]/.test(newPassword) && /[@$!%*?&#]/.test(newPassword)) ? 'text-emerald-500' : 'text-slate-200'} />
                                    </div>
                                    <hr className="border-slate-100" />
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[11px] font-bold ${(!/([a-zA-Z0-9])\1{3,}/.test(newPassword) && !/(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(newPassword)) ? 'text-emerald-600' : 'text-slate-500'}`}>بدون تكرار أو تسلسل (123/aaa)</span>
                                        <Check size={14} className={(!/([a-zA-Z0-9])\1{3,}/.test(newPassword) && !/(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(newPassword)) ? 'text-emerald-500' : 'text-slate-200'} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                type="button"
                                onClick={() => setResetPasswordState({ userId: null, displayName: '', show: false })}
                                className="smart-btn-secondary"
                            >
                                إلغاء
                            </button>
                            <button
                                type="button"
                                onClick={() => resetPasswordMutation.mutate({ id: resetPasswordState.userId, password: newPassword })}
                                className="smart-btn-primary bg-amber-500 hover:bg-amber-600"
                                disabled={
                                    newPassword.length < 12 ||
                                    !/[A-Z]/.test(newPassword) ||
                                    !/[a-z]/.test(newPassword) ||
                                    !/[0-9]/.test(newPassword) ||
                                    !/[@$!%*?&#]/.test(newPassword) ||
                                    /([a-zA-Z0-9])\1{3,}/.test(newPassword) ||
                                    /(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(newPassword) ||
                                    resetPasswordMutation.isPending
                                }
                            >
                                {resetPasswordMutation.isPending ? 'جاري الحفظ...' : 'تغيير كلمة المرور'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={!!userToDelete}
                title="حذف المستخدم"
                message={`هل أنت متأكد من حذف المستخدم "${userToDelete?.displayName}"؟ لا يمكن التراجع عن هذا الإجراء.`}
                confirmText="نعم، حذف"
                cancelText="إلغاء"
                onConfirm={() => {
                    if (userToDelete) {
                        deleteMutation.mutate(userToDelete.id);
                        setUserToDelete(null);
                    }
                }}
                onCancel={() => setUserToDelete(null)}
                type="danger"
            />
        </div>
    );
}
