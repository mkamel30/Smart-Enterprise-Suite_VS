import { useState, useEffect } from 'react';
import adminClient from '../api/adminClient';
import { 
  Users, Search, RefreshCw, Building, MapPin, Phone, 
  ChevronRight, Briefcase, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Customers() {
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const res = await adminClient.get('/customers');
            setCustomers(res.data);
        } catch (error) {
            toast.error('فشل في تحميل سجل العملاء');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    const filtered = customers.filter(c => 
        c.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.bkcode?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 pb-10 font-arabic" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="text-right">
                    <h1 className="text-4xl font-black text-brand-primary uppercase tracking-tight flex items-center gap-3">
                        <Users className="text-brand-cyan" size={40} />
                        سجل العملاء <span className="text-brand-cyan">الموحد</span>
                    </h1>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">إدارة علاقات العملاء عبر كافة فروع المجموعة</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto flex-row-reverse">
                    <button onClick={fetchCustomers} className="p-4 bg-white border border-slate-100 text-slate-400 rounded-2xl hover:text-brand-primary transition-all shadow-sm">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div className="relative flex-1 md:w-96">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                        <input 
                            type="text" 
                            placeholder="بحث عن عميل (الاسم أو كود العميل)..." 
                            className="smart-input pr-12 shadow-sm border-slate-100 text-right text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {loading ? (
                    Array(4).fill(0).map((_, i) => <div key={i} className="h-40 bg-white rounded-[2.5rem] animate-pulse"></div>)
                ) : filtered.length === 0 ? (
                    <div className="col-span-full py-20 bg-white rounded-[3rem] border border-slate-100 text-center">
                        <Users className="mx-auto opacity-10 mb-4" size={60} />
                        <p className="text-slate-400 font-black uppercase tracking-widest text-sm">لا يوجد عملاء مسجلين حالياً بالشبكة</p>
                    </div>
                ) : (
                    filtered.map((c) => (
                        <div key={c.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group text-right">
                            <div className="flex justify-between items-start flex-row-reverse">
                                <div className="flex items-start gap-6 flex-row-reverse">
                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-brand-primary group-hover:text-white transition-all shadow-inner ml-0 mr-auto">
                                        <Briefcase size={24} />
                                    </div>
                                    <div className="text-right">
                                        <h3 className="text-xl font-black text-brand-primary group-hover:text-brand-blue transition-colors uppercase">{c.client_name}</h3>
                                        <div className="flex items-center gap-3 mt-1 flex-row-reverse">
                                            <span className="text-[10px] font-black px-2 py-0.5 bg-brand-cyan/10 text-brand-cyan rounded uppercase" dir="ltr">{c.bkcode}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">عميل مؤسسي</span>
                                        </div>
                                    </div>
                                </div>
                                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter flex-row-reverse ${c.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500'}`}>
                                    <div className={`w-1 h-1 rounded-full ${c.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                    {c.status === 'Active' ? 'نشط' : 'خامل'}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 mt-8">
                                <div className="space-y-4 text-right">
                                    <div className="flex items-center gap-3 text-slate-400 flex-row-reverse">
                                        <Building size={16} />
                                        <span className="text-[11px] font-bold uppercase">{c.branch?.name || 'غير محدد'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-400 flex-row-reverse">
                                        <MapPin size={16} />
                                        <span className="text-[11px] font-bold uppercase truncate max-w-[150px]">{c.address || 'لا يوجد عنوان مسجل'}</span>
                                    </div>
                                </div>
                                <div className="space-y-4 text-right">
                                    <div className="flex items-center gap-3 text-slate-400 flex-row-reverse">
                                        <Phone size={16} />
                                        <span className="text-[11px] font-bold uppercase" dir="ltr">{c.telephone_1 || 'بدون هاتف'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-400 flex-row-reverse">
                                        <Activity size={16} />
                                        <span className="text-[11px] font-bold uppercase">{c.machines?.length || 0} أجهزة POS</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-slate-50 flex justify-end gap-4 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 flex-row-reverse">
                                <button className="flex items-center gap-2 px-6 py-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-brand-primary hover:text-white transition-all text-[10px] font-black uppercase tracking-widest">
                                    <ChevronRight size={14} className="transform rotate-180 ml-2" />
                                    عرض التفاصيل الاستثمارية
                                </button>
                                <button className="px-6 py-2 text-[10px] font-black text-slate-400 hover:text-brand-primary uppercase tracking-widest">الإحصائيات</button>
                                <button className="px-6 py-2 text-[10px] font-black text-slate-400 hover:text-brand-primary uppercase tracking-widest">الأرشيف</button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
