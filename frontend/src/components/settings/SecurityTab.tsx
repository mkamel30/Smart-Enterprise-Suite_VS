import React, { useState, useEffect } from 'react';
import { Lock, Check, Shield, ShieldAlert, QrCode, RefreshCw, X, ShieldCheck } from 'lucide-react';
import { api } from '../../api/client';
import { useApiMutation } from '../../hooks/useApiMutation';

export function SecurityTab() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    // MFA States
    const [mfaStatus, setMfaStatus] = useState<{ enabled: boolean; setupPending: boolean } | null>(null);
    const [mfaSetupData, setMfaSetupData] = useState<{ qrCode: string; manualEntryKey: string } | null>(null);
    const [mfaToken, setMfaToken] = useState('');
    const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
    const [isLoadingMfa, setIsLoadingMfa] = useState(false);

    useEffect(() => {
        fetchMfaStatus();
    }, []);

    const fetchMfaStatus = async () => {
        try {
            const response = await api.getMFAStatus();
            setMfaStatus(response.data);
        } catch (err) {
            console.error('Failed to fetch MFA status', err);
        }
    };

    const handleEnableMfa = async () => {
        setIsLoadingMfa(true);
        setError('');
        try {
            const response = await api.setupMFA();
            setMfaSetupData(response.data);
        } catch (err: any) {
            setError(err.message || 'فشل تهيئة المصادقة الثنائية');
        } finally {
            setIsLoadingMfa(false);
        }
    };

    const handleVerifyMfa = async () => {
        if (!mfaToken) return;
        setIsLoadingMfa(true);
        setError('');
        try {
            const response = await api.verifyMFASetup(mfaToken);
            setMfaStatus({ enabled: true, setupPending: false });
            setMfaSetupData(null);
            setMfaToken('');
            if (response.data.backupCodes) {
                setRecoveryCodes(response.data.backupCodes);
            }
            setMessage('تم تفعيل المصادقة الثنائية بنجاح');
        } catch (err: any) {
            setError(err.message || 'رمز التحقق غير صحيح');
        } finally {
            setIsLoadingMfa(false);
        }
    };

    const handleDisableMfa = async () => {
        if (!mfaToken) {
            setError('يرجى إدخال رمز التحقق لإيقاف الخدمة');
            return;
        }
        setIsLoadingMfa(true);
        setError('');
        try {
            await api.disableMFA(mfaToken);
            setMfaStatus({ enabled: false, setupPending: false });
            setMfaToken('');
            setMessage('تم إيقاف المصادقة الثنائية');
        } catch (err: any) {
            setError(err.message || 'فشل إيقاف المصادقة الثنائية');
        } finally {
            setIsLoadingMfa(false);
        }
    };

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

        if (newPassword.length < 12) {
            setError('كلمة المرور يجب أن تكون 12 أحرف على الأقل (سياسة الأمان الجديدة)');
            return;
        }

        changePasswordMutation.mutate({ currentPassword, newPassword });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full animate-fade-in">
            {/* Password Change Section */}
            <div className="bg-card rounded-[2.5rem] border border-border shadow-2xl p-10 h-fit">
                <h2 className="text-2xl font-black mb-8 flex items-center gap-3 text-foreground">
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                        <Lock size={28} />
                    </div>
                    تغيير كلمة المرور
                </h2>

                {message && (
                    <div className="bg-emerald-500/10 text-emerald-500 p-4 rounded-2xl mb-6 text-sm font-bold border border-emerald-500/20 flex items-center gap-2">
                        <Check size={18} />
                        {message}
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
                    <div className="space-y-3">
                        <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground mr-1">الكلمة الجديدة</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-muted/50 border border-border rounded-2xl px-4 py-4 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-mono"
                            required
                        />

                        {/* Interactive Policy Checklist */}
                        <div className="bg-muted/30 border border-border/50 rounded-2xl p-5 space-y-3">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">متطلبات الأمان:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="flex items-center gap-2">
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${newPassword.length >= 12 ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground/30'}`}>
                                        <Check size={12} strokeWidth={4} />
                                    </div>
                                    <span className={`text-xs font-bold transition-colors ${newPassword.length >= 12 ? 'text-emerald-600' : 'text-muted-foreground'}`}>12 خانة على الأقل</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${/[A-Z]/.test(newPassword) ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground/30'}`}>
                                        <Check size={12} strokeWidth={4} />
                                    </div>
                                    <span className={`text-xs font-bold transition-colors ${/[A-Z]/.test(newPassword) ? 'text-emerald-600' : 'text-muted-foreground'}`}>حرف كبير (A)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${(/[0-9]/.test(newPassword) && /[@$!%*?&#]/.test(newPassword)) ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground/30'}`}>
                                        <Check size={12} strokeWidth={4} />
                                    </div>
                                    <span className={`text-xs font-bold transition-colors ${(/[0-9]/.test(newPassword) && /[@$!%*?&#]/.test(newPassword)) ? 'text-emerald-600' : 'text-muted-foreground'}`}>أرقام ورموز خاصة</span>
                                </div>
                            </div>
                        </div>
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

                    <button
                        type="submit"
                        disabled={changePasswordMutation.isLoading}
                        className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black text-lg hover:shadow-xl hover:shadow-primary/20 transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
                    >
                        {changePasswordMutation.isLoading ? <RefreshCw className="animate-spin" /> : null}
                        تحديث كلمة المرور
                    </button>
                </form>
            </div>

            {/* MFA Section */}
            <div className="bg-card rounded-[2.5rem] border border-border shadow-2xl p-10 h-fit">
                <h2 className="text-2xl font-black mb-8 flex items-center gap-3 text-foreground">
                    <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
                        <Shield size={28} />
                    </div>
                    المصادقة الثنائية (MFA)
                </h2>

                {error && (
                    <div className="bg-rose-500/10 text-rose-500 p-4 rounded-2xl mb-6 text-sm font-bold border border-rose-500/20">
                        {error}
                    </div>
                )}

                {recoveryCodes && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-6 mb-8 animate-bounce-in">
                        <div className="flex items-center gap-2 text-amber-600 font-black mb-4">
                            <ShieldAlert size={20} />
                            أكواد الاسترداد (هام جداً!)
                        </div>
                        <p className="text-xs text-amber-700 mb-4 font-bold">يرجى حفظ هذه الأكواد في مكان آمن. لن تظهر مرة أخرى!</p>
                        <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-white/50 p-4 rounded-xl">
                            {recoveryCodes.map((code, idx) => (
                                <div key={idx} className="bg-white px-3 py-1 rounded border border-amber-200 text-center">{code}</div>
                            ))}
                        </div>
                        <button
                            onClick={() => setRecoveryCodes(null)}
                            className="w-full mt-4 py-2 bg-amber-600 text-white rounded-xl font-bold text-sm"
                        >
                            حفظت الأكواد، أغلق التنبيه
                        </button>
                    </div>
                )}

                {!mfaStatus?.enabled && !mfaSetupData && (
                    <div className="space-y-6 text-center py-8">
                        <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center text-muted-foreground">
                            <ShieldAlert size={48} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black">المصادقة الثنائية غير مفعلة</h3>
                            <p className="text-sm text-muted-foreground px-8">قم بتفعيل المصادقة الثنائية لإضافة طبقة أمان إضافية لحسابك باستخدام تطبيقات مثل Google Authenticator.</p>
                        </div>
                        <button
                            onClick={handleEnableMfa}
                            disabled={isLoadingMfa}
                            className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-indigo-700 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
                        >
                            {isLoadingMfa ? <RefreshCw className="animate-spin" size={18} /> : <QrCode size={18} />}
                            بدء إعداد المصادقة
                        </button>
                    </div>
                )}

                {mfaSetupData && (
                    <div className="space-y-8 animate-scale-in">
                        <div className="text-center space-y-4">
                            <p className="text-sm font-bold text-indigo-600">افتح تطبيق Google Authenticator وقم بمسح الكود التالي:</p>
                            <div className="p-4 bg-white rounded-[2rem] border-4 border-indigo-500/10 inline-block shadow-inner">
                                <img src={mfaSetupData.qrCode} alt="MFA QR Code" className="w-48 h-48" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">أو أدخل الكود يدوياً:</p>
                                <code className="bg-muted px-4 py-1 rounded-lg text-sm font-black text-indigo-600 tabular-nums">{mfaSetupData.manualEntryKey}</code>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground mr-1">رمز التحقق من التطبيق</label>
                                <input
                                    type="text"
                                    maxLength={6}
                                    placeholder="000000"
                                    value={mfaToken}
                                    onChange={(e) => setMfaToken(e.target.value)}
                                    className="w-full bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-4 text-center text-3xl font-black tracking-[0.5em] focus:ring-4 focus:ring-indigo-500/10 outline-none placeholder:text-indigo-200"
                                />
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setMfaSetupData(null)}
                                    className="flex-1 bg-muted text-muted-foreground py-4 rounded-2xl font-black flex items-center justify-center gap-2"
                                >
                                    <X size={18} />
                                    إلغاء
                                </button>
                                <button
                                    onClick={handleVerifyMfa}
                                    disabled={mfaToken.length < 6 || isLoadingMfa}
                                    className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-black hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isLoadingMfa ? <RefreshCw className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                                    تأكيد وتفعيل
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {mfaStatus?.enabled && !recoveryCodes && (
                    <div className="space-y-6 text-center py-8">
                        <div className="mx-auto w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                            <ShieldCheck size={48} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-emerald-600">المصادقة الثنائية مفعلة</h3>
                            <p className="text-sm text-muted-foreground px-8">حسابك محمي بطبقة أمان إضافية. يرجى التأكد من الاحتفاظ بأكواد الاسترداد.</p>
                        </div>

                        <div className="pt-6 border-t border-border mt-8 space-y-4">
                            <h4 className="text-sm font-black text-rose-500 uppercase tracking-widest">منطقة الخطر</h4>
                            <div className="space-y-4 max-w-xs mx-auto">
                                <input
                                    type="text"
                                    maxLength={6}
                                    placeholder="أدخل الرمز للإيقاف"
                                    value={mfaToken}
                                    onChange={(e) => setMfaToken(e.target.value)}
                                    className="w-full bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 text-center text-xl font-black tracking-widest focus:ring-4 focus:ring-rose-500/10 outline-none"
                                />
                                <button
                                    onClick={handleDisableMfa}
                                    disabled={mfaToken.length < 6 || isLoadingMfa}
                                    className="w-full bg-rose-500 text-white px-8 py-3 rounded-xl font-black hover:bg-rose-600 transition-all flex items-center justify-center gap-2 disabled:opacity-20"
                                >
                                    {isLoadingMfa ? <RefreshCw className="animate-spin" size={18} /> : <ShieldAlert size={18} />}
                                    تعطيل المصادقة الثنائية
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
