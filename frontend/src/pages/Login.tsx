import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mfaCode, setMfaCode] = useState('');
    const [showMfa, setShowMfa] = useState(false);
    const [userIdForMfa, setUserIdForMfa] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const data: any = await api.login({
                email,
                password,
                mfaToken: showMfa ? mfaCode : undefined
            });

            if (data?.mfaRequired) {
                setShowMfa(true);
                setUserIdForMfa(data?.user.id);
                setIsLoading(false);
                return;
            }

            login(data?.token, data?.user);
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'فشل تسجيل الدخول');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-smart-gradient p-4" dir="rtl">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 animate-slide-up">
                <div className="text-center mb-8">
                    <img
                        src="/logo.png"
                        alt="شعار النظام"
                        className="mx-auto h-24 mb-4 object-contain"
                    />
                    <h1 className="text-3xl font-extrabold text-primary font-inter tracking-tight">Smart Enterprise Suite</h1>
                    <p className="text-muted-foreground mt-2">نظام إدارة ذكي للفروع والصيانة</p>
                </div>

                {error && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl mb-6 flex items-center gap-2 text-sm font-bold">
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {!showMfa ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">البريد الإلكتروني</label>
                                <div className="relative">
                                    <Mail className="absolute right-3 top-2.5 text-muted-foreground" size={20} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-4 pr-10 py-2 border border-input rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-bold"
                                        placeholder="name@example.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">كلمة المرور</label>
                                <div className="relative">
                                    <Lock className="absolute right-3 top-2.5 text-muted-foreground" size={20} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-4 pr-10 py-2 border border-input rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-bold"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="animate-scale-in">
                            <label className="block text-sm font-medium text-foreground mb-2">رمز التحقق (MFA Code)</label>
                            <div className="relative">
                                <Lock className="absolute right-3 top-2.5 text-muted-foreground" size={20} />
                                <input
                                    type="text"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value)}
                                    className="w-full pl-4 pr-10 py-3 border border-input rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-center tracking-[0.5em] text-2xl font-mono text-primary font-black"
                                    placeholder="000000"
                                    maxLength={6}
                                    autoFocus
                                    required
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 text-center">أدخل الرمز المكون من 6 أرقام من تطبيق التحقق الخاص بك</p>
                            <button
                                type="button"
                                onClick={() => setShowMfa(false)}
                                className="text-xs text-primary hover:text-primary/80 mt-4 block mx-auto font-bold"
                            >
                                العودة لتسجيل الدخول
                            </button>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-black hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                {showMfa ? 'جاري التحقق من الرمز...' : 'جاري التحقق...'}
                            </>
                        ) : (
                            showMfa ? 'تحقق ودخول' : 'دخول'
                        )}
                    </button>

                    {!showMfa && (
                        <div className="text-center">
                            <button type="button" className="text-sm text-muted-foreground hover:text-foreground">
                                نسيت كلمة المرور؟ يرجى التواصل مع مدير النظام لإعادة تعيينها.
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
