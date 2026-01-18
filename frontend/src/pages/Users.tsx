import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2, UserPlus, Key, Filter, Building, Pencil } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApiMutation } from '../hooks/useApiMutation';
import { ROLES, BRANCH_TYPES, getRoleDisplayName, getAvailableRoles } from '../lib/permissions';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHeader from '../components/PageHeader';

export default function Users() {
    const { user } = useAuth();
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
        canDoMaintenance: false
    });

    const queryClient = useQueryClient();

    // Fetch users
    const { data: users, isLoading } = useQuery<any[]>({
        queryKey: ['users', filterBranchId],
        queryFn: async () => (await api.getUsers({ branchId: filterBranchId })) as any[],
        enabled: !!user
    });

    // Fetch branches and centers for dropdowns
    const { data: allBranches } = useQuery({
        queryKey: ['branches-all'],
        queryFn: () => api.getBranches(), // This returns all branches including centers
        staleTime: 1000 * 60 * 60,
        enabled: !!user
    });

    // Derived lists for dropdowns
    const branchesOnly = allBranches?.filter((b: any) => b.type === BRANCH_TYPES.BRANCH) || [];
    const maintenanceCenters = allBranches?.filter((b: any) => b.type === BRANCH_TYPES.MAINTENANCE_CENTER) || [];
    const adminAffairs = allBranches?.filter((b: any) => b.type === BRANCH_TYPES.ADMIN_AFFAIRS) || [];

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
                canDoMaintenance: false
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

    // Reset Password State
    const [resetPasswordState, setResetPasswordState] = useState<{ userId: string | null, displayName: string, show: boolean }>({ userId: null, displayName: '', show: false });
    const [newPassword, setNewPassword] = useState('');

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
        const { id, displayName, email, role, branchId, canDoMaintenance } = userToEdit;
        editMutation.mutate({
            id,
            data: { displayName, email, role, branchId, canDoMaintenance }
        });
    };

    // Determine which dropdown to show based on selected role
    const renderEntitySelect = () => {
        const role = newUser.role;

        if (([ROLES.SUPER_ADMIN, ROLES.MANAGEMENT] as string[]).includes(role)) {
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

        if (!role || ([ROLES.SUPER_ADMIN, ROLES.MANAGEMENT] as string[]).includes(role)) {
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
        <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen" dir="rtl">
            <PageHeader
                title="إدارة المستخدمين"
                subtitle="إدارة صلاحيات الموظفين، الفنيين وحسابات النظام"
                filter={filterElement}
                actions={actionElements}
            />

            {/* Helper Alert */}
            <div className="smart-alert smart-alert-info mb-8 shadow-sm">
                <div className="shrink-0 pt-1">
                    <Building size={20} className="text-primary" />
                </div>
                <div>
                    <p className="text-sm">
                        لإضافة مستخدم للجهة التابعة (فرع صيانة / شئون إدارية)، تأكد أولاً من إنشاء "الفرع" الخاص بهم من صفحة إدارة الفروع.
                    </p>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-xl border-2 border-primary/10 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full whitespace-nowrap">
                        <thead className="bg-gradient-to-r from-primary to-primary/90 text-white">
                            <tr>
                                <th className="px-6 py-4 text-right font-black">الاسم</th>
                                <th className="px-6 py-4 text-right font-black">البريد الإلكتروني</th>
                                <th className="px-6 py-4 text-right font-black">الدور</th>
                                <th className="px-6 py-4 text-right font-black">الجهة التابعة</th>
                                <th className="px-6 py-4 text-center font-black">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users?.map((userData: any) => (
                                <tr key={userData.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-black text-primary">{userData.displayName}</td>
                                    <td className="px-6 py-4 text-slate-500 font-bold">{userData.email}</td>
                                    <td className="px-6 py-4">
                                        <span className="smart-badge smart-badge-primary">
                                            {getRoleDisplayName(userData.role)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {userData.branch?.name ? (
                                            <div className="flex items-center gap-2 text-slate-600 font-bold">
                                                <Building size={14} className="text-primary/40" />
                                                {userData.branch.name}
                                            </div>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2 justify-center">
                                            <button
                                                onClick={() => setUserToEdit({ ...userData })}
                                                className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all"
                                                title="تعديل"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                onClick={() => setResetPasswordState({ userId: userData.id, displayName: userData.displayName, show: true })}
                                                className="p-2 text-brand-orange hover:bg-brand-orange/10 rounded-xl transition-all"
                                                title="تغيير كلمة المرور"
                                            >
                                                <Key size={18} />
                                            </button>
                                            <button
                                                onClick={() => setUserToDelete(userData)}
                                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                                title="حذف"
                                            >
                                                <Trash2 size={18} />
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
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
                        <div className="bg-gradient-to-r from-primary to-primary/90 p-8 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                            <h2 className="text-2xl font-black flex items-center gap-3 relative z-10">
                                <UserPlus size={28} />
                                إضافة مستخدم جديد
                            </h2>
                            <p className="text-white/60 text-sm mt-1 font-bold">قم بتعبئة بيانات الموظف الجديد لتفعيل الحساب</p>
                        </div>

                        <form onSubmit={handleCreate} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-xs font-black uppercase tracking-widest text-primary mr-1">الاسم بالكامل</label>
                                    <input
                                        type="text"
                                        placeholder="مثال: محمد صلاح"
                                        value={newUser.displayName}
                                        onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                                        className="smart-input"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs font-black uppercase tracking-widest text-primary mr-1">البريد الإلكتروني</label>
                                    <input
                                        type="email"
                                        placeholder="user@example.com"
                                        value={newUser.email}
                                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                        className="smart-input"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-xs font-black uppercase tracking-widest text-primary mr-1">كلمة المرور</label>
                                    <input
                                        type="password"
                                        placeholder="••••••"
                                        value={newUser.password}
                                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                        className="smart-input"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs font-black uppercase tracking-widest text-primary mr-1">الدور (الصلاحية)</label>
                                    <select
                                        value={newUser.role}
                                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value, branchId: '' })}
                                        className="smart-select"
                                    >
                                        {getAvailableRoles().map(role => (
                                            <option key={role.value} value={role.value}>
                                                {role.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {renderEntitySelect()}

                                {([ROLES.CENTER_TECH, ROLES.BRANCH_TECH, ROLES.CS_AGENT, ROLES.CS_SUPERVISOR] as string[]).includes(newUser.role) && (
                                    <div className="flex items-center gap-3 p-4 bg-muted/20 border-2 border-primary/5 rounded-2xl group hover:border-primary/20 transition-all cursor-pointer">
                                        <input
                                            type="checkbox"
                                            id="canDoMaintenance"
                                            checked={newUser.canDoMaintenance}
                                            onChange={(e) => setNewUser({ ...newUser, canDoMaintenance: e.target.checked })}
                                            className="smart-checkbox w-5 h-5"
                                        />
                                        <label htmlFor="canDoMaintenance" className="text-sm font-black text-primary cursor-pointer select-none">
                                            تفعيل صلاحية فني (تنفيذ طلبات الصيانة)
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="submit"
                                    className="smart-btn-primary flex-1 h-12"
                                    disabled={createMutation.isPending}
                                >
                                    {createMutation.isPending ? 'جاري الإضافة...' : 'إضافة المستخدم'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="smart-btn-secondary flex-1 h-12"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {userToEdit && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-100">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">تعديل بيانات المستخدم</h2>
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">الاسم</label>
                                <input
                                    type="text"
                                    value={userToEdit.displayName}
                                    onChange={(e) => setUserToEdit({ ...userToEdit, displayName: e.target.value })}
                                    className="w-full p-2 border rounded"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
                                <input
                                    type="email"
                                    value={userToEdit.email || ''}
                                    onChange={(e) => setUserToEdit({ ...userToEdit, email: e.target.value })}
                                    className="w-full p-2 border rounded"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">الدور (الصلاحية)</label>
                                <select
                                    value={userToEdit.role}
                                    onChange={(e) => setUserToEdit({ ...userToEdit, role: e.target.value, branchId: '' })}
                                    className="w-full p-2 border rounded"
                                >
                                    {getAvailableRoles().map(role => (
                                        <option key={role.value} value={role.value}>
                                            {role.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {renderEditEntitySelect()}

                            {([ROLES.CENTER_TECH, ROLES.BRANCH_TECH, ROLES.CS_AGENT, ROLES.CS_SUPERVISOR] as string[]).includes(userToEdit.role) && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="edit-canDoMaintenance"
                                        checked={userToEdit.canDoMaintenance}
                                        onChange={(e) => setUserToEdit({ ...userToEdit, canDoMaintenance: e.target.checked })}
                                    />
                                    <label htmlFor="edit-canDoMaintenance" className="text-sm">
                                        يمكنه تنفيذ طلبات الصيانة؟
                                    </label>
                                </div>
                            )}

                            <div className="flex gap-2 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-primary text-white py-2 rounded hover:bg-primary/90"
                                    disabled={editMutation.isPending}
                                >
                                    {editMutation.isPending ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUserToEdit(null)}
                                    className="flex-1 bg-slate-100 text-slate-700 py-2 rounded hover:bg-slate-200"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {resetPasswordState.show && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-100">
                    <div className="bg-white rounded-lg p-6 w-full max-w-sm">
                        <h3 className="font-bold mb-4">تغيير كلمة المرور: {resetPasswordState.displayName}</h3>
                        <input
                            type="password"
                            placeholder="كلمة المرور الجديدة"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full p-2 border rounded mb-4"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => resetPasswordMutation.mutate({ id: resetPasswordState.userId, password: newPassword })}
                                className="flex-1 bg-amber-500 text-white py-2 rounded hover:bg-amber-600"
                                disabled={!newPassword}
                            >
                                حفظ
                            </button>
                            <button
                                onClick={() => setResetPasswordState({ userId: null, displayName: '', show: false })}
                                className="flex-1 bg-slate-100 text-slate-700 py-2 rounded hover:bg-slate-200"
                            >
                                إلغاء
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
