import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { Lock, Mail, Loader2, ArrowRight, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res: any = await api.post('/auth/forgot-password', { identifier });
      setSuccess(res.message || 'تم إرسال كود التحقق');
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'فشلت العملية');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return setError('كلمات المرور غير متطابقة');
    }
    
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setSuccess('تم تغيير كلمة المرور بنجاح');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.message || 'كود التحقق غير صالح');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-smart-gradient p-4 text-right font-arabic" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 animate-slide-up">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="شعار النظام" className="mx-auto h-20 mb-4 object-contain" />
          <h1 className="text-2xl font-black text-primary">استعادة الحساب</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {step === 1 ? 'أدخل بريدك الإلكتروني أو اسم المستخدم لإرسال كود الاستعادة' : 'أدخل الكود المكون من 6 أرقام وكلمة المرور الجديدة'}
          </p>
        </div>

        {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl mb-6 flex items-center gap-2 text-sm font-bold animate-shake">
                <AlertCircle size={18} />
                {error}
            </div>
        )}

        {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2 text-sm font-bold">
                <CheckCircle2 size={18} />
                {success}
            </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleRequestToken} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">البريد الإلكتروني / اسم المستخدم</label>
              <div className="relative">
                <Mail className="absolute right-3 top-2.5 text-muted-foreground" size={20} />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-4 pr-10 py-2 border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-black hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'إرسال كود الاستعادة'}
              <ArrowRight size={18} className="mr-auto rotate-180" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">كود الاستعادة (6 أرقام)</label>
              <div className="relative">
                <KeyRound className="absolute right-3 top-2.5 text-muted-foreground" size={20} />
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none text-center tracking-[0.5em] text-2xl font-mono font-bold"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-foreground mb-2">كلمة المرور الجديدة</label>
              <div className="relative">
                <Lock className="absolute right-3 top-2.5 text-muted-foreground" size={20} />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-4 pr-10 py-2 border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-foreground mb-2">تأكيد كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-2.5 text-muted-foreground" size={20} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-4 pr-10 py-2 border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-black hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'تحديث كلمة المرور والدخول'}
            </button>
          </form>
        )}

        <div className="text-center mt-6">
          <Link to="/login" className="text-sm font-bold text-muted-foreground hover:text-primary flex items-center justify-center gap-1">
            العودة لتسجيل الدخول
            <ArrowRight size={14} className="rotate-180" />
          </Link>
        </div>
      </div>
    </div>
  );
}
