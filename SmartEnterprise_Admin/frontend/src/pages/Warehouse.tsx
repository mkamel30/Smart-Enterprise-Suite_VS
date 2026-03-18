import { useState, useEffect } from 'react';
import adminClient from '../api/adminClient';
import { 
  Cpu, Search, RefreshCw, HardDrive, 
  ChevronRight, Activity, Layers, Package
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Warehouse() {
    const [machines, setMachines] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [view, setView] = useState<'warehouse' | 'fleet'>('warehouse');

    const fetchData = async () => {
        try {
            setLoading(true);
            const endpoint = view === 'warehouse' ? '/warehouse/machines' : '/warehouse/fleet';
            const res = await adminClient.get(endpoint);
            setMachines(res.data);
        } catch (error) {
            toast.error('فشل في جلب بيانات العتاد والأجهزة');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [view]);

    const filtered = machines.filter(m => 
        m.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.model?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const statusMap: any = {
      'NEW': 'جديد بالكامل',
      'STANDBY': 'جاهز بالفرع',
      'DEPLOYED': 'عند عميل',
      'REPAIR': 'قيد الصيانة',
      'SCRAP': 'كهنة / تالف'
    };

    return (
        <div className="space-y-8 pb-10 font-arabic" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="text-right">
                    <h1 className="text-4xl font-black text-brand-primary uppercase tracking-tight flex items-center gap-3">
                        <Layers className="text-brand-cyan" size={40} />
                        شبكة العتاد <span className="text-brand-cyan">المركزي</span>
                    </h1>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">تدقيق ومراقبة كافة أجهزة POS والأصول على مستوى المجموعة</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto flex-row-reverse">
                    <button onClick={fetchData} className="p-4 bg-white border border-slate-100 text-slate-400 rounded-2xl hover:text-brand-primary transition-all shadow-sm">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div className="relative flex-1 md:w-96">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                        <input 
                            type="text" 
                            placeholder="بحث في الأصول (سيريال أو موديل)..." 
                            className="smart-input pr-12 shadow-sm border-slate-100 text-right text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* View Switcher */}
            <div className="flex gap-4 p-2 bg-slate-50 rounded-[2.5rem] self-start inline-flex border border-slate-100 shadow-inner flex-row-reverse">
                <button 
                    onClick={() => setView('warehouse')}
                    className={`flex items-center gap-3 px-10 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all flex-row-reverse ${view === 'warehouse' ? 'bg-white text-brand-primary shadow-xl shadow-slate-200 border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Package size={16} />
                    مخزون الفروع
                </button>
                <button 
                    onClick={() => setView('fleet')}
                    className={`flex items-center gap-3 px-10 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all flex-row-reverse ${view === 'fleet' ? 'bg-white text-brand-primary shadow-xl shadow-slate-200 border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Activity size={16} />
                    الأجهزة المشغلة (الأسطول)
                </button>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                <table className="w-full text-right font-arabic">
                    <thead>
                        <tr className="border-b border-slate-50 bg-slate-50/30">
                            <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">معرف الجهاز (S/N)</th>
                            <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">الموديل والنوع</th>
                            <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{view === 'warehouse' ? 'الفرع المستحوذ' : 'تعريف العميل'}</th>
                            <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">حالة التشغيل</th>
                            <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">السجل</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            Array(5).fill(0).map((_, i) => <tr key={i}><td colSpan={5} className="p-10"><div className="h-10 bg-slate-50 rounded-2xl animate-pulse"></div></td></tr>)
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-20 text-center">
                                    <Cpu className="mx-auto opacity-10 mb-4" size={60} />
                                    <p className="text-slate-300 font-bold uppercase tracking-widest text-sm">لا توجد أصول مطابقة في هذا القطاع</p>
                                </td>
                            </tr>
                        ) : (
                            filtered.map((m) => (
                                <tr key={m.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-10 py-8">
                                        <div className="flex items-center gap-5 flex-row-reverse">
                                            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand-primary group-hover:text-white transition-all shadow-inner ml-0 mr-auto">
                                                <HardDrive size={20} />
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-brand-primary group-hover:text-brand-blue transition-colors uppercase italic" dir="ltr">{m.serialNumber}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">أصل استثماري ذكي</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-10 py-8 text-right">
                                        <span className="text-sm font-black text-slate-600 uppercase italic">{m.model || 'موديل غير معرف'}</span>
                                    </td>
                                    <td className="px-10 py-8 text-right">
                                        <div className="flex flex-col items-start">
                                            <span className="text-sm font-black text-slate-700 uppercase italic text-right">
                                                {view === 'warehouse' ? (m.branch?.name || 'المركز الرئيسي') : (m.customer?.client_name || 'غير مخصص')}
                                            </span>
                                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter" dir="ltr">
                                                {view === 'warehouse' ? `C: ${m.branch?.code || 'HO'}` : `UID: ${m.customer?.bkcode || '---'}`}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-8 text-right">
                                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter flex-row-reverse ${
                                            (m.status === 'NEW' || m.status === 'STANDBY') ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                                            m.status === 'REPAIR' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                                            'bg-blue-50 text-brand-primary border border-brand-primary/10'
                                        }`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${m.status === 'NEW' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                            {statusMap[m.status] || m.status}
                                        </span>
                                    </td>
                                    <td className="px-10 py-8 text-left">
                                        <button className="p-3 bg-slate-50 text-slate-400 hover:text-brand-primary hover:bg-white rounded-xl transition-all shadow-sm">
                                            <ChevronRight size={18} className="transform rotate-180" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
