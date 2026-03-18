import { useState, useEffect } from 'react';
import adminClient from '../api/adminClient';
import { Plus, RefreshCw, Building2, Key, Edit2, Trash2, Check, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', code: '', authorizedHWID: '', address: '', phone: '' });

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await adminClient.get('/branches');
      setBranches(res.data);
    } catch (error) {
      toast.error('فشل في جلب بيانات الفروع');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleOpenModal = (branch: any = null) => {
    if (branch) {
      setEditingBranch(branch);
      setFormData({ 
        name: branch.name, 
        code: branch.code, 
        authorizedHWID: branch.authorizedHWID || '',
        address: branch.address || '',
        phone: branch.phone || ''
      });
    } else {
      setEditingBranch(null);
      setFormData({ name: '', code: '', authorizedHWID: '', address: '', phone: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBranch) {
        await adminClient.put(`/branches/${editingBranch.id}`, formData);
        toast.success('تم تحديث بيانات الفرع بنجاح');
      } else {
        await adminClient.post('/branches', formData);
        toast.success('تم تسجيل الفرع الجديد بنجاح');
      }
      setIsModalOpen(false);
      fetchBranches();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'فشل في حفظ بيانات الفرع');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الفرع؟ سيتم حذف كافة البيانات المرتبطة به.')) return;
    try {
      await adminClient.delete(`/branches/${id}`);
      toast.success('تم حذف الفرع');
      fetchBranches();
    } catch (error) {
      toast.error('فشل في حذف الفرع');
    }
  };

  const handleRequestSync = async (id: string) => {
    try {
      await adminClient.post(`/sync/request-full-sync/${id}`);
      toast.success('تم إرسال طلب مزامنة كاملة للفرع بنجاح');
    } catch (error) {
      toast.error('فشل في إرسال طلب المزامنة');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('تم نسخ مفتاح API');
  };

  return (
    <div className="space-y-10 font-arabic" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="text-right">
          <h1 className="text-3xl sm:text-4xl font-black text-brand-primary tracking-tight uppercase">سجل الفروع المعتمدة</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">إدارة ومراقبة كافة الفروع المتصلة بالمجموعة.</p>
        </div>
        <div className="flex gap-4 w-full sm:w-auto flex-row-reverse">
          <button onClick={fetchBranches} className="h-14 w-14 flex items-center justify-center bg-white border-2 border-slate-100 rounded-2xl hover:bg-slate-50 transition-all shadow-sm shrink-0">
            <RefreshCw size={22} className={`${loading ? 'animate-spin text-brand-primary' : 'text-slate-400'}`} />
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="flex-1 sm:flex-none h-14 bg-brand-primary text-white flex items-center justify-center gap-3 px-8 rounded-2xl shadow-xl shadow-brand-primary/20 hover:bg-brand-blue active:scale-95 transition-all text-[11px] font-black uppercase tracking-widest"
          >
            <Plus size={20} />
            <span>إضافة فرع جديد</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {branches.length === 0 ? (
          <div className="col-span-full smart-card border-none bg-white p-12 sm:p-20 text-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-full h-1.5 bg-brand-cyan/20"></div>
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 text-brand-primary/20 group-hover:scale-110 transition-transform">
              <Building2 size={48} />
            </div>
            <h3 className="font-black text-brand-primary text-2xl sm:text-3xl tracking-tight mb-4">لا توجد فروع مسجلة</h3>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] max-w-sm mx-auto leading-relaxed">
              قم بربط أول فرع لك للبدء في تلقي البيانات الحية وإدارة المعاملات المركزية.
            </p>
          </div>
        ) : (
          branches.map((branch: any) => (
            <div key={branch.id} className="smart-card group hover-lift border-none overflow-hidden bg-white text-right">
               <div className={`h-2 w-full ${branch.status === 'ONLINE' ? 'bg-success' : 'bg-slate-200'}`}></div>
               <div className="p-6 sm:p-8">
                <div className="flex justify-between items-start mb-8 flex-row-reverse">
                    <div className="bg-slate-50 p-4 sm:p-5 rounded-3xl group-hover:bg-brand-primary/5 transition-colors shrink-0">
                      <Building2 className="text-brand-primary" size={24} />
                    </div>
                    <div className="flex flex-col items-start gap-3">
                      <StatusBadge status={branch.status} />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{branch.code}</span>
                    </div>
                </div>

                <div className="mb-8">
                    <h3 className="font-black text-xl sm:text-2xl text-brand-primary tracking-tight uppercase mb-2 leading-tight">{branch.name}</h3>
                    <div className="relative group/key">
                        <div className="flex items-center gap-3 py-3 px-4 bg-slate-50 rounded-xl border border-slate-100 flex-row-reverse">
                        <Key size={14} className="text-brand-cyan shrink-0" />
                        <code className="text-[10px] font-black text-brand-primary/60 truncate flex-1 text-left" dir="ltr">{branch.apiKey}</code>
                        <button onClick={() => copyToClipboard(branch.apiKey)} className="text-brand-cyan hover:text-brand-primary transition-colors shrink-0">
                            <Copy size={14} />
                        </button>
                        </div>
                    </div>
                </div>

                {branch.authorizedHWID && (
                  <div className="mb-8 p-4 sm:p-5 bg-brand-primary/5 rounded-3xl border-2 border-brand-primary/5">
                      <p className="text-[9px] font-black text-brand-primary/40 uppercase tracking-[0.3em] mb-2 text-right">معرف الجهاز (HWID)</p>
                      <p className="text-[10px] font-black text-brand-primary truncate text-left" dir="ltr">{branch.authorizedHWID}</p>
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-6 sm:pt-8 border-t border-slate-50 flex-row-reverse">
                    <div className="flex flex-col text-right">
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">آخر اتصال</p>
                      <p className="text-[10px] font-black text-slate-500 uppercase">
                        {branch.lastSeen ? new Date(branch.lastSeen).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : 'غير نشط'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleRequestSync(branch.id)}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-success hover:bg-success/5 rounded-xl transition-all border border-slate-50 sm:border-none"
                        title="طلب مزامنة شاملة للبيانات"
                      >
                        <RefreshCw size={18} />
                      </button>
                      <button 
                        onClick={() => handleOpenModal(branch)}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-brand-primary hover:bg-slate-50 rounded-xl transition-all border border-slate-50 sm:border-none"
                        title="تعديل بيانات الفرع"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(branch.id)}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-destructive hover:bg-destructive/5 rounded-xl transition-all border border-slate-50 sm:border-none"
                        title="حذف الفرع نهائياً"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                </div>
               </div>
            </div>
          ))
        )}
      </div>

      {/* REFACTORED BRANCH MODAL */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingBranch ? 'تعديل الفرع' : 'إضافة فرع جديد'}
        subtitle="عقدة بنية تحتية للمجموعة"
        icon={<Building2 size={36} className="text-brand-primary" />}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-brand-primary/60 uppercase tracking-widest mr-4">اسم الفرع</label>
            <input 
              type="text" 
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="smart-input h-14 px-6 text-brand-primary font-black uppercase tracking-tight text-right text-sm"
              placeholder="مثال: الفرع الرئيسي"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-brand-primary/60 uppercase tracking-widest mr-4">كود الفرع</label>
            <input 
              type="text" 
              required
              value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value })}
              className="smart-input h-14 px-6 text-brand-primary font-black uppercase tracking-widest text-right text-sm"
              placeholder="مثال: BR001"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-brand-primary/60 uppercase tracking-widest mr-4 flex justify-between flex-row-reverse">
              <span>HWID المعتمد</span>
              <span className="text-brand-cyan lowercase normal-case opacity-60">أمان إضافي</span>
            </label>
            <input 
              type="text" 
              value={formData.authorizedHWID}
              onChange={e => setFormData({ ...formData, authorizedHWID: e.target.value })}
              className="smart-input h-14 px-6 text-brand-primary font-bold text-left"
              placeholder="Hardware binding string"
              dir="ltr"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-brand-primary/60 uppercase tracking-widest mr-4">العنوان</label>
              <input 
                type="text" 
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="smart-input h-14 px-6 text-brand-primary font-bold text-right text-sm"
                placeholder="المدينة"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-brand-primary/60 uppercase tracking-widest mr-4">الهاتف</label>
              <input 
                type="text" 
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="smart-input h-14 px-6 text-brand-primary font-bold text-right text-sm"
                placeholder="01123456789"
              />
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row-reverse gap-4">
            <button 
              type="submit"
              className="flex-[2] h-14 bg-brand-primary text-white flex items-center justify-center gap-2 font-black rounded-2xl shadow-xl shadow-brand-primary/20 hover:bg-brand-blue active:scale-95 transition-all uppercase tracking-widest text-[10px]"
            >
              <Check size={18} />
              {editingBranch ? 'تحديث البيانات' : 'تسجيل الفرع'}
            </button>
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 h-14 flex items-center justify-center font-black text-slate-400 rounded-2xl hover:bg-slate-50 transition-colors uppercase tracking-widest text-[10px]"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    ONLINE: 'bg-green-100 text-green-700 border-green-200',
    OFFLINE: 'bg-slate-100 text-slate-600 border-slate-200',
    MAINTENANCE: 'bg-amber-100 text-amber-700 border-amber-200',
  };
  const labels = {
    ONLINE: 'متصل',
    OFFLINE: 'أوفلاين',
    MAINTENANCE: 'صيانة قيد التنفيذ',
  };
  return (
    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter border ${styles[status as keyof typeof styles] || styles.OFFLINE}`}>
      {labels[status as keyof typeof labels] || status}
    </span>
  );
}
