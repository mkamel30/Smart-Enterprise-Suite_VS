import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import adminClient from '../api/adminClient';
import { KeyRound, Lock, User, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await adminClient.post('/auth/forgot-password', { username, recoveryKey });
      setToken(res.data.token);
      setStep(2);
      toast.success('تم التحقق من مفتاح الاسترداد بنجاح');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'بيانات الاسترداد غير صحيحة');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return toast.error('كلمات المرور غير متطابقة');
    }
    
    setLoading(true);
    try {
      await adminClient.post('/auth/reset-password', { token, newPassword });
      toast.success('تم تغيير كلمة المرور بنجاح، يمكنك الدخول الآن');
      navigate('/login');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'فشلت عملية إعادة التعيين');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden font-arabic" dir="rtl">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-brand-primary/10 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-brand-cyan/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-[3rem] p-12 shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-white/20 animate-scale-in">
          
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-brand-primary tracking-tight">
              استعادة <span className="text-brand-cyan">الوصول</span>
            </h1>
            <p className="text-slate-400 font-bold text-xs mt-3">
              {step === 1 ? 'يرجى إدخال مفتاح الاسترداد الخاص بك' : 'قم بتعيين كلمة مرور جديدة قوية'}
            </p>
          </div>

          {step === 1 ? (
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="space-y-2 text-right">
                <label className="text-[10px] font-black text-brand-primary uppercase mr-2 tracking-widest">اسم المستخدم</label>
                <div className="relative">
                  <User className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-primary/30" size={18} />
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl pr-14 pl-6 focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary outline-none transition-all font-bold text-brand-primary text-sm" 
                    placeholder="اسم المستخدم (admin متاح افتراضياً)"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2 text-right">
                <label className="text-[10px] font-black text-brand-primary uppercase mr-2 tracking-widest">مفتاح الاسترداد (Recovery Key)</label>
                <div className="relative">
                  <KeyRound className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-primary/30" size={18} />
                  <input 
                    type="text" 
                    value={recoveryKey}
                    onChange={(e) => setRecoveryKey(e.target.value.toUpperCase())}
                    className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl pr-14 pl-6 focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary outline-none transition-all font-bold text-brand-primary text-center tracking-widest uppercase text-sm" 
                    placeholder="XXXXXXXX"
                    required
                  />
                </div>
                <p className="text-[9px] text-slate-400 mr-2">هذا المفتاح تم إنشاؤه عند تنصيب النظام لأول مرة</p>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full h-16 bg-brand-primary text-white font-black rounded-2xl shadow-xl shadow-brand-primary/20 hover:bg-brand-blue active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 group"
              >
                {loading ? <Loader2 className="animate-spin" /> : (
                  <>
                    <span>التحقق من الهوية</span>
                    <ArrowRight size={18} className="group-hover:-translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-6">
              <div className="space-y-2 text-right">
                <label className="text-[10px] font-black text-brand-primary uppercase mr-2 tracking-widest">كلمة المرور الجديدة</label>
                <div className="relative">
                  <Lock className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-primary/30" size={18} />
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl pr-14 pl-6 focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary outline-none transition-all font-bold text-brand-primary text-sm" 
                    placeholder="••••••••"
                    required
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2 text-right">
                <label className="text-[10px] font-black text-brand-primary uppercase mr-2 tracking-widest">تأكيد كلمة المرور</label>
                <div className="relative">
                  <ShieldCheck className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-primary/30" size={18} />
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl pr-14 pl-6 focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary outline-none transition-all font-bold text-brand-primary text-sm" 
                    placeholder="••••••••"
                    required
                    dir="ltr"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full h-16 bg-brand-cyan text-slate-900 font-black rounded-2xl shadow-xl shadow-brand-cyan/20 hover:bg-opacity-90 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'تحديث كلمة المرور والدخول'}
              </button>
            </form>
          )}

          <div className="mt-8 text-center pt-6 border-t border-slate-100">
            <Link to="/login" className="text-sm font-bold text-slate-400 hover:text-brand-primary transition-colors flex items-center justify-center gap-2">
              <ArrowRight size={14} className="rotate-180" />
              العودة لتسجيل الدخول
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
