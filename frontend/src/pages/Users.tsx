import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2, UserPlus, Key, Filter, Building, Pencil } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApiMutation } from '../hooks/useApiMutation';
import { ROLES, BRANCH_TYPES, getRoleDisplayName, getAvailableRoles } from '../lib/permissions';
import ConfirmDialog from '../components/ConfirmDialog';

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
        role: ROLES.TECHNICIAN as string,
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
                role: ROLES.TECHNICIAN,
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
        if (([ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR, ROLES.CS_AGENT] as string[]).includes(newUser.role) && !newUser.branchId) {
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
                <label className="block text-sm font-medium mb-1">{label}</label>
                <select
                    value={newUser.branchId}
                    onChange={(e) => setNewUser({ ...newUser, branchId: e.target.value })}
                    className="w-full p-2 border rounded"
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
                <label className="block text-sm font-medium mb-1">{label}</label>
                <select
                    value={userToEdit.branchId || ''}
                    onChange={(e) => setUserToEdit({ ...userToEdit, branchId: e.target.value })}
                    className="w-full p-2 border rounded"
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

    return (
        <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen" dir="rtl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-black text-[#0A2472]">إدارة المستخدمين</h1>
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                        {users?.length || 0} مستخدم
                    </span>
                </div>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="w-full sm:w-auto bg-gradient-to-r from-[#0A2472] to-[#0A2472]/90 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 font-black shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                >
                    <UserPlus size={20} />
                    إضافة مستخدم
                </button>
            </div>

            {/* Helper Alert */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                <div className="flex items-start">
                    <div className="shrink-0">
                        <Building className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="mr-3">
                        <p className="text-sm text-blue-700">
                            لإضافة مستخدم للشئون الإدارية أو مراكز الصيانة، تأكد أولاً من إنشاء "الفرع" الخاص بهم من صفحة إدارة الفروع بنوع (مركز صيانة / شئون إدارية).
                        </p>
                    </div>
                </div>
            </div>

            {/* Filter */}
            {isAdmin && (
                <div className="bg-white p-4 rounded-2xl shadow-md border-2 border-[#0A2472]/10 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Filter size={20} />
                        <span className="text-sm font-medium sm:hidden">تصفية حسب الفرع:</span>
                    </div>
                    <select
                        value={filterBranchId}
                        onChange={(e) => setFilterBranchId(e.target.value)}
                        className="p-2 border rounded w-full sm:w-64"
                    >
                        <option value="">كل الفروع والمراكز</option>
                        {allBranches?.map((b: any) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-xl border-2 border-[#0A2472]/10 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full whitespace-nowrap">
                        <thead className="bg-gradient-to-r from-[#0A2472] to-[#0A2472]/90 text-white">
                            <tr>
                                <th className="px-6 py-3 text-center font-black">الاسم</th>
                                <th className="px-6 py-3 text-center font-black">البريد الإلكتروني</th>
                                <th className="px-6 py-3 text-center font-black">الدور</th>
                                <th className="px-6 py-3 text-center font-black">الجهة التابعة</th>
                                <th className="px-6 py-3 text-center font-black">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {users?.map((user: any) => (
                                <tr key={user.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium">{user.displayName}</td>
                                    <td className="px-6 py-4 text-slate-500">{user.email}</td>
                                    <td className="px-6 py-4">
                                        <span className="bg-slate-100 px-2 py-1 rounded text-sm">
                                            {getRoleDisplayName(user.role)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">
                                        {user.branch?.name || '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2 justify-center">
                                            <button
                                                onClick={() => setUserToEdit({ ...user })}
                                                className="p-2 text-[#6CE4F0] hover:bg-[#6CE4F0]/10 rounded-lg transition-all"
                                                title="تعديل"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                onClick={() => setResetPasswordState({ userId: user.id, displayName: user.displayName, show: true })}
                                                className="p-2 text-[#E86B3A] hover:bg-[#E86B3A]/10 rounded-lg transition-all"
                                                title="تغيير كلمة المرور"
                                            >
                                                <Key size={18} />
                                            </button>
                                            <button
                                                onClick={() => setUserToDelete(user)}
                                                className="p-2 text-[#C85C8E] hover:bg-[#C85C8E]/10 rounded-lg transition-all"
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-100">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">إضافة مستخدم جديد</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">الاسم</label>
                                <input
                                    type="text"
                                    value={newUser.displayName}
                                    onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                                    className="w-full p-2 border rounded"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
                                <input
                                    type="email"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                    className="w-full p-2 border rounded"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">كلمة المرور</label>
                                <input
                                    type="password"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    className="w-full p-2 border rounded"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">الدور (الصلاحية)</label>
                                <select
                                    value={newUser.role}
                                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value, branchId: '' })}
                                    className="w-full p-2 border rounded"
                                >
                                    {getAvailableRoles().map(role => (
                                        <option key={role.value} value={role.value}>
                                            {role.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {renderEntitySelect()}

                            {([ROLES.CENTER_TECH, ROLES.BRANCH_TECH, ROLES.CS_AGENT, ROLES.CS_SUPERVISOR] as string[]).includes(newUser.role) && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="canDoMaintenance"
                                        checked={newUser.canDoMaintenance}
                                        onChange={(e) => setNewUser({ ...newUser, canDoMaintenance: e.target.checked })}
                                    />
                                    <label htmlFor="canDoMaintenance" className="text-sm">
                                        يمكنه تنفيذ طلبات الصيانة؟
                                    </label>
                                </div>
                            )}

                            <div className="flex gap-2 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                                    disabled={createMutation.isPending}
                                >
                                    {createMutation.isPending ? 'جاري الإضافة...' : 'إضافة'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="flex-1 bg-slate-100 text-slate-700 py-2 rounded hover:bg-slate-200"
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
                                    className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
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
