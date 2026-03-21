import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import SetupScreen from '../components/SetupScreen';

const PORTAL_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5005';

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
    const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

    useEffect(() => {
        const checkUsers = async () => {
            try {
                const localApi = `http://${window.location.hostname}:5002`;
                const res = await fetch(`${localApi}/api/users?limit=1`);
                if (!res.ok) {
                    setNeedsSetup(true);
                    return;
                }
                const data = await res.json();
                const hasUsers = Array.isArray(data.data) ? data.data.length > 0 : false;
                setNeedsSetup(!hasUsers);
            } catch {
                setNeedsSetup(true);
            }
        };
        checkUsers();
    }, []);

    const handleSetupComplete = (userData: any, branchData: any) => {
        setNeedsSetup(false);
        if (userData?.username) {
            setEmail(userData.email || userData.username);
        }
    };

    if (needsSetup === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/95 to-primary/90" dir="rtl">
                <Loader2 className="animate-spin text-white" size={32} />
            </div>
        );
    }

    if (needsSetup) {
        return <SetupScreen portalUrl={PORTAL_URL} onSetupComplete={handleSetupComplete} />;
    }

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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/95 to-primary/90 p-4 sm:p-6 md:p-8" dir="rtl">
            <div className="w-full max-w-sm sm:max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-8 animate-slide-up overflow-y-auto max-h-[95vh]">
                <div className="text-center mb-8">
                    <img
                        src="/logo.png"
                        alt="شعار النظام"
                        className="mx-auto h-16 sm:h-20 md:h-24 mb-4 object-contain"
                    />
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-primary font-inter tracking-tight">Smart Enterprise Suite</h1>
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
                        <div className="text-center mt-2">
                            <Link to="/forgot-password" className="text-sm text-primary/60 hover:text-primary font-bold transition-colors">
                                نسيت كلمة المرور؟
                            </Link>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
