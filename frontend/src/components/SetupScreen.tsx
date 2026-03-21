import React, { useState } from 'react';
import { validateBranchSetup } from '../api/branchSetupApi';
import { Globe, Lock, User, Building2, Loader2, Wifi, WifiOff, Check, AlertCircle } from 'lucide-react';

interface Props {
    portalUrl: string;
    onSetupComplete: (userData: any, branchData: any) => void;
}

export default function SetupScreen({ portalUrl, onSetupComplete }: Props) {
    const [branchCode, setBranchCode] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState<'idle' | 'connecting' | 'validating' | 'syncing' | 'success' | 'error'>('idle');
    const [error, setError] = useState('');
    const [stepText, setStepText] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!branchCode.trim() || !username.trim() || !password.trim()) return;

        setError('');
        setStatus('connecting');
        setStepText('جاري الاتصال بالخادم...');

        // Step 1: Check portal reachability
        try {
            await fetch(`${portalUrl}/health`, { signal: AbortSignal.timeout(5000) });
        } catch {
            setStatus('error');
            setError('فشل الاتصال بالسيرفر — تحقق من الإنترنت');
            return;
        }

        // Step 2: Validate credentials
        setStatus('validating');
        setStepText('جاري التحقق من البيانات...');

        try {
            const result = await validateBranchSetup(portalUrl, branchCode.trim(), username.trim(), password);
            if (!result.success) {
                throw new Error(result.error || 'فشل التحقق');
            }

            // Step 3: Save locally
            setStatus('syncing');
            setStepText('جاري حفظ البيانات محلياً...');

            // Save user to local SQLite via API
            const localApi = `http://${window.location.hostname}:5002`;
            const userPayload = {
                uid: result.user.uid,
                username: result.user.username,
                email: result.user.email,
                displayName: result.user.displayName,
                role: result.user.role,
                password: result.user.password,
                branchId: result.branch.id,
                isActive: true,
                mustChangePassword: false
            };

            const saveRes = await fetch(`${localApi}/api/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userPayload)
            });

            if (!saveRes.ok) {
                throw new Error('فشل حفظ المستخدم محلياً');
            }

            // Save branch info
            const branchPayload = {
                id: result.branch.id,
                code: result.branch.code,
                name: result.branch.name,
                type: result.branch.type,
                isActive: true
            };

            await fetch(`${localApi}/api/branches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(branchPayload)
            }).catch(() => {});

            // Step 4: Done
            setStatus('success');
            setStepText('تم الإعداد بنجاح!');

            setTimeout(() => {
                onSetupComplete(result.user, result.branch);
            }, 1500);

        } catch (err: any) {
            setStatus('error');
            if (err.message.includes('رمز الفرع')) {
                setError('رمز الفرع غير موجود في النظام — تأكد من صحة الرمز');
            } else if (err.message.includes('اسم المستخدم')) {
                setError('اسم المستخدم غير موجود لهذا الفرع');
            } else if (err.message.includes('كلمة المرور')) {
                setError('اسم المستخدم أو كلمة المرور غير صحيحة');
            } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
                setError('فشل الاتصال بالسيرفر — تحقق من الإنترنت');
            } else {
                setError(err.message || 'حدث خطأ غير متوقع');
            }
        }
    };

    const isLoading = status === 'connecting' || status === 'validating' || status === 'syncing';
    const isSuccess = status === 'success';

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/95 to-primary/90 p-4 sm:p-6 md:p-8" dir="rtl">
            <div className="w-full max-w-sm sm:max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-8 animate-slide-up overflow-y-auto max-h-[95vh]">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
                        <Building2 size={36} className="text-primary" />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-primary tracking-tight">إعداد الفرع</h1>
                    <p className="text-sm text-muted-foreground mt-2 font-medium">
                        هذه أول مرة — أدخل بيانات الاتصال بالخادم
                    </p>
                </div>

                {/* Error Message */}
                {error && !isSuccess && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl mb-6 flex items-center gap-2 text-sm font-bold animate-scale-in">
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                {/* Success Message */}
                {isSuccess && (
                    <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-xl mb-6 flex items-center gap-2 text-sm font-bold animate-scale-in">
                        <Check size={18} />
                        تم الإعداد بنجاح — جاري التحويل...
                    </div>
                )}

                {/* Connection Animation */}
                {isLoading && (
                    <div className="mb-6 flex flex-col items-center gap-3">
                        <div className="relative w-16 h-16">
                            <div className="absolute inset-0 rounded-full bg-primary/10 animate-connection-wave" />
                            <div className="absolute inset-2 rounded-full bg-primary/20 animate-connection-wave" style={{ animationDelay: '0.3s' }} />
                            <div className="absolute inset-4 rounded-full bg-primary/30 animate-connection-wave" style={{ animationDelay: '0.6s' }} />
                            <div className="absolute inset-5 rounded-full bg-primary flex items-center justify-center">
                                <Wifi size={16} className="text-white animate-pulse" />
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground font-bold animate-pulse">{stepText}</p>

                        {/* Progress dots */}
                        <div className="flex gap-2">
                            <div className={`w-2 h-2 rounded-full ${status === 'connecting' ? 'bg-primary animate-pulse-dot' : status === 'validating' || status === 'syncing' ? 'bg-success' : 'bg-muted'}`} />
                            <div className={`w-2 h-2 rounded-full ${status === 'validating' ? 'bg-primary animate-pulse-dot' : status === 'syncing' ? 'bg-success' : 'bg-muted'}`} />
                            <div className={`w-2 h-2 rounded-full ${status === 'syncing' ? 'bg-primary animate-pulse-dot' : 'bg-muted'}`} />
                        </div>
                    </div>
                )}

                {/* Setup Form */}
                {!isSuccess && (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-foreground mb-2">رمز الفرع (Branch Code)</label>
                            <div className="relative">
                                <Building2 className="absolute right-3 top-2.5 text-muted-foreground" size={18} />
                                <input
                                    type="text"
                                    value={branchCode}
                                    onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                                    className="w-full pl-4 pr-10 py-2.5 border border-input rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-bold text-sm font-mono uppercase"
                                    placeholder="BR003"
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1 font-medium">رمز الفرع المسجل في لوحة الإدارة</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-foreground mb-2">اسم المستخدم</label>
                            <div className="relative">
                                <User className="absolute right-3 top-2.5 text-muted-foreground" size={18} />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-4 pr-10 py-2.5 border border-input rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-bold text-sm"
                                    placeholder="admin"
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-foreground mb-2">كلمة المرور</label>
                            <div className="relative">
                                <Lock className="absolute right-3 top-2.5 text-muted-foreground" size={18} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-4 pr-10 py-2.5 border border-input rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-bold text-sm"
                                    placeholder="••••••••"
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        {/* Portal URL display */}
                        <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-2">
                            <Globe size={14} className="text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground font-mono truncate">{portalUrl}</span>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !branchCode.trim() || !username.trim() || !password.trim()}
                            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-black hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20 text-sm"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    {stepText}
                                </>
                            ) : (
                                <>
                                    <Wifi size={18} />
                                    إعداد وتسجيل الدخول
                                </>
                            )}
                        </button>
                    </form>
                )}

                {/* Footer */}
                <div className="mt-6 text-center">
                    <p className="text-[10px] text-muted-foreground/60">
                        Portal: {portalUrl}
                    </p>
                </div>
            </div>
        </div>
    );
}
