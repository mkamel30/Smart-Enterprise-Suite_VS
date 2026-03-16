import { useState, useEffect } from 'react';
import adminClient from '../api/adminClient';
import { Plus, RefreshCw, Building2, Key, Edit2, Trash2, X, Check, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', code: '', authorizedHWID: '' });

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await adminClient.get('/branches');
      setBranches(res.data);
    } catch (error) {
      toast.error('Failed to fetch branches');
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
        authorizedHWID: branch.authorizedHWID || '' 
      });
    } else {
      setEditingBranch(null);
      setFormData({ name: '', code: '', authorizedHWID: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBranch) {
        await adminClient.put(`/branches/${editingBranch.id}`, formData);
        toast.success('Branch updated successfully');
      } else {
        await adminClient.post('/branches', formData);
        toast.success('Branch registered successfully');
      }
      setIsModalOpen(false);
      fetchBranches();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save branch');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this branch? All associated data will be lost.')) return;
    try {
      await adminClient.delete(`/branches/${id}`);
      toast.success('Branch deleted');
      fetchBranches();
    } catch (error) {
      toast.error('Failed to delete branch');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('API Key copied to clipboard');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic">BRANCH REGISTRY</h1>
          <p className="text-slate-500 font-medium italic">Manage and monitor all connected enterprise branches.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchBranches} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-95"
          >
            <Plus size={20} />
            <span>ADD BRANCH</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.length === 0 ? (
          <div className="col-span-full bg-white border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
              <Building2 size={40} />
            </div>
            <h3 className="font-black text-slate-900 text-2xl tracking-tight">No branches registered</h3>
            <p className="text-slate-500 max-w-sm mx-auto mt-2 italic">Connect your first branch to start receiving real-time data and managing parameters centrally.</p>
          </div>
        ) : (
          branches.map((branch: any) => (
            <div key={branch.id} className="group bg-white p-7 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300">
               <div className="flex justify-between items-start mb-6">
                  <div className="bg-slate-50 p-4 rounded-2xl group-hover:bg-blue-50 transition-colors">
                    <Building2 className="text-slate-400 group-hover:text-blue-500 transition-colors" size={24} />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={branch.status} />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{branch.code}</span>
                  </div>
               </div>

               <div className="mb-6">
                  <h3 className="font-black text-2xl text-slate-900 tracking-tight leading-none mb-2 capitalize">{branch.name}</h3>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Key size={14} className="shrink-0" />
                    <code className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded truncate max-w-[150px]">{branch.apiKey}</code>
                    <button onClick={() => copyToClipboard(branch.apiKey)} className="text-blue-500 hover:text-blue-700 p-1">
                       <Copy size={12} />
                    </button>
                  </div>
               </div>

               {branch.authorizedHWID && (
                 <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">PC Binding (HWID)</p>
                    <p className="text-xs font-mono font-bold text-slate-700 truncate">{branch.authorizedHWID}</p>
                 </div>
               )}
               
               <div className="flex items-center justify-between pt-6 border-t border-slate-50 mt-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    {branch.lastSeen ? `Last Seen: ${new Date(branch.lastSeen).toLocaleString()}` : 'Never Connected'}
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleOpenModal(branch)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(branch.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
               </div>
            </div>
          ))
        )}
      </div>

      {/* BRANCH MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="relative p-10">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 transition-colors"
              >
                <X size={24} />
              </button>

              <div className="mb-10 text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 size={32} className="text-blue-600" />
                </div>
                <h3 className="font-black text-3xl text-slate-900 tracking-tighter italic">
                  {editingBranch ? 'EDIT BRANCH' : 'NEW BRANCH'}
                </h3>
                <p className="text-slate-500 font-medium italic">Enter the branch details for registration.</p>
              </div>

              <form onSubmit={handleSave} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Branch Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full h-14 bg-slate-100 border-none rounded-2xl px-6 font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="e.g., Cairo Main Branch"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Internal Code</label>
                  <input 
                    type="text" 
                    required
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    className="w-full h-14 bg-slate-100 border-none rounded-2xl px-6 font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="e.g., BR001"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 flex justify-between">
                    <span>Authorized HWID (PC ID)</span>
                    <span className="text-blue-500 lowercase normal-case">Optional</span>
                  </label>
                  <input 
                    type="text" 
                    value={formData.authorizedHWID}
                    onChange={e => setFormData({ ...formData, authorizedHWID: e.target.value })}
                    className="w-full h-14 bg-slate-100 border-none rounded-2xl px-6 font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Hardware Identity String"
                  />
                </div>

                <div className="pt-6 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 h-14 flex items-center justify-center font-black text-slate-500 rounded-2xl hover:bg-slate-100 transition-colors uppercase tracking-widest text-xs"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 h-14 bg-slate-900 text-white flex items-center justify-center gap-2 font-black rounded-2xl shadow-xl shadow-slate-900/10 hover:bg-black transition-all hover:scale-[1.02] active:scale-95 uppercase tracking-widest text-xs"
                  >
                    <Check size={18} />
                    {editingBranch ? 'Update' : 'Register'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    ONLINE: 'bg-green-100 text-green-700 border-green-200',
    OFFLINE: 'bg-slate-100 text-slate-600 border-slate-200',
    MAINTENANCE: 'bg-amber-100 text-amber-700 border-amber-200',
  };
  return (
    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter border ${styles[status as keyof typeof styles] || styles.OFFLINE}`}>
      {status}
    </span>
  );
}
