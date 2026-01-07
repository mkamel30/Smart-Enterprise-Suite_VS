import React, { useState } from 'react';
import { Lock, Check } from 'lucide-react';
import { api } from '../../api/client';
import { useApiMutation } from '../../hooks/useApiMutation';

export function SecurityTab() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const changePasswordMutation = useApiMutation({
        mutationFn: (data: any) => api.changePassword(data),
        successMessage: 'تم تغيير كلمة المرور بنجاح',
        errorMessage: 'فشل تغيير كلمة المرور',
        onSuccess: () => {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setMessage('تم تغيير كلمة المرور بنجاح');
            setTimeout(() => setMessage(''), 3000);
        }
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (newPassword !== confirmPassword) {
            setError('كلمة المرور الجديدة غير متطابقة');
            return;
        }

        if (newPassword.length < 6) {
            setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            return;
        }

        changePasswordMutation.mutate({ currentPassword, newPassword });
    };

    return (
        <div className="bg-card rounded-[2.5rem] border border-border shadow-2xl p-10 w-full max-w-xl animate-scale-in">
            <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                    <Lock size={28} />
                </div>
                تأمين الحساب
            </h2>

            {message && (
                <div className="bg-emerald-500/10 text-emerald-500 p-4 rounded-2xl mb-6 text-sm font-bold border border-emerald-500/20 flex items-center gap-2">
                    <Check size={18} />
                    {message}
                </div>
            )}
            {error && (
                <div className="bg-rose-500/10 text-rose-500 p-4 rounded-2xl mb-6 text-sm font-bold border border-rose-500/20">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground mr-1">كلمة المرور الحالية</label>
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full bg-muted/50 border border-border rounded-2xl px-4 py-4 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-mono"
                        required
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground mr-1">الكلمة الجديدة</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-muted/50 border border-border rounded-2xl px-4 py-4 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-mono"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground mr-1">تأكيد الكلمة</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-muted/50 border border-border rounded-2xl px-4 py-4 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-mono"
                            required
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black text-lg hover:shadow-xl hover:shadow-primary/20 transition-all active:scale-[0.98] mt-4"
                >
                    تحديث كلمة المرور
                </button>
            </form>
        </div>
    );
}
