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
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const data: any = await api.login({
                email,
                password
            });
            login(data.token, data.user);
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'فشل تسجيل الدخول');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4" dir="rtl">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 animate-slide-up">
                <div className="text-center mb-8">
                    <img
                        src="/logo.png"
                        alt="شعار النظام"
                        className="mx-auto h-24 mb-4 object-contain"
                    />
                    <h1 className="text-3xl font-extrabold text-[#0A2472] font-inter tracking-tight">Smart Enterprise Suite</h1>
                    <p className="text-slate-500 mt-2">نظام إدارة ذكي للفروع والصيانة</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 flex items-center gap-2 text-sm">
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">البريد الإلكتروني</label>
                        <div className="relative">
                            <Mail className="absolute right-3 top-2.5 text-slate-400" size={20} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-4 pr-10 py-2 border rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-all"
                                placeholder="name@example.com"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">كلمة المرور</label>
                        <div className="relative">
                            <Lock className="absolute right-3 top-2.5 text-slate-400" size={20} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-4 pr-10 py-2 border rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-all"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-slate-900 text-white py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                جاري التحقق...
                            </>
                        ) : (
                            'دخول'
                        )}
                    </button>

                    <div className="text-center">
                        <button type="button" className="text-sm text-slate-500 hover:text-slate-700">
                            نسيت كلمة المرور؟ يرجى التواصل مع مدير النظام لإعادة تعيينها.
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
