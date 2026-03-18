import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import adminClient from '../api/adminClient';
import { Shield, Lock, User, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await adminClient.post('/auth/login', { username, password });
      login(res.data.token, res.data.admin);
      toast.success('تم تسجيل الدخول بنجاح، مرحباً بك');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'فشل تسجيل الدخول، تأكد من البيانات');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden font-arabic" dir="rtl">
      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-brand-primary/10 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-brand-cyan/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-[3rem] p-12 shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-white/20">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-black text-brand-primary tracking-tight uppercase">
              بوابة المدير <span className="text-brand-cyan">العام</span>
            </h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-3 opacity-80">
              نظام المصادقة المركزية للمجموعة
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 text-right">
              <label className="text-[10px] font-black text-brand-primary uppercase tracking-widest mr-2">هوية الوصول</label>
              <div className="relative">
                <User className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-primary/30" size={18} />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl pr-14 pl-6 focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary outline-none transition-all font-bold text-brand-primary placeholder:text-slate-300 text-right text-sm" 
                  placeholder="أدخل اسم المستخدم"
                  required
                />
              </div>
            </div>

            <div className="space-y-2 text-right">
              <label className="text-[10px] font-black text-brand-primary uppercase tracking-widest mr-2">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-primary/30" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl pr-14 pl-6 focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary outline-none transition-all font-bold text-brand-primary placeholder:text-slate-300 text-left text-sm" 
                  placeholder="••••••••"
                  required
                  dir="ltr"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full h-16 bg-brand-primary text-white font-black rounded-2xl shadow-2xl shadow-brand-primary/30 hover:bg-brand-blue active:scale-95 transition-all flex items-center justify-center gap-3 group disabled:opacity-70 uppercase tracking-widest text-xs"
            >
              {loading ? <Loader2 className="animate-spin" /> : (
                <>
                  <Shield size={18} className="group-hover:rotate-12 transition-transform" />
                  <span>بدء جلسة العمل الآمنة</span>
                </>
              )}
            </button>
            <div className="text-center">
              <Link 
                to="/forgot-password" 
                className="text-xs font-bold text-slate-400 hover:text-brand-primary transition-colors uppercase tracking-widest"
              >
                نسيت كلمة المرور؟ استخدم مفتاح الاسترداد
              </Link>
            </div>
          </form>
        </div>
        
        <div className="mt-10 flex flex-col items-center gap-2">
          <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">
            PROTECTED BY ENTERPRISE SHIELD v2.0
          </p>
          <div className="h-1 w-12 bg-brand-cyan/30 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
