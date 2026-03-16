import { useState, useEffect } from 'react';
import adminClient from '../api/adminClient';
import { RefreshCw, Settings, Edit3, X, Check, Info } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Parameters() {
  const [params, setParams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedParam, setSelectedParam] = useState<any>(null);
  const [newValue, setNewValue] = useState('');

  const fetchParams = async () => {
    try {
      setLoading(true);
      const res = await adminClient.get('/parameters');
      setParams(res.data);
    } catch (error) {
      toast.error('Failed to fetch parameters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParams();
  }, []);

  const handleEdit = (param: any) => {
    setSelectedParam(param);
    setNewValue(param.value);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminClient.put(`/parameters/${selectedParam.id}`, { value: newValue });
      toast.success('Parameter updated successfully');
      setIsModalOpen(false);
      fetchParams();
    } catch (error) {
      toast.error('Failed to update parameter');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">Global Parameters</h1>
          <p className="text-slate-500 font-medium italic">Configure global settings pushed to all enterprise branches.</p>
        </div>
        <button 
          onClick={fetchParams} 
          className="p-4 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm active:scale-90"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Setting Key</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Data Type</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Category</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {params.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                       <Info size={40} className="text-slate-200" />
                       <p className="text-slate-400 font-bold italic">No parameters found in the registry.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                params.map((param: any) => (
                  <tr key={param.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="font-black text-slate-900 text-lg tracking-tight uppercase group-hover:text-blue-600 transition-colors">{param.key}</div>
                      <div className="text-xs text-slate-400 font-bold font-mono mt-1 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded inline-block">Value: {param.value}</div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="bg-blue-600 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-sm shadow-blue-600/20">{param.type}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-lg">{param.group || 'GENERAL'}</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => handleEdit(param)}
                        className="flex items-center gap-2 ml-auto p-3 text-slate-400 hover:text-blue-600 hover:bg-white rounded-2xl shadow-sm border border-transparent hover:border-blue-100 transition-all active:scale-95"
                      >
                        <Edit3 size={18} />
                        <span className="text-xs font-black uppercase tracking-widest hidden md:inline">Edit</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PARAMETER EDIT MODAL */}
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
                  <Settings size={32} className="text-blue-600" />
                </div>
                <h3 className="font-black text-3xl text-slate-900 tracking-tighter italic uppercase">
                  Edit Parameter
                </h3>
                <p className="text-slate-500 font-medium italic mt-1">Updating <span className="text-blue-600 font-black">{selectedParam?.key}</span></p>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Current Value</label>
                  <input 
                    type="text" 
                    required
                    autoFocus
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    className="w-full h-16 bg-slate-100 border-none rounded-3xl px-8 font-black text-slate-900 text-xl placeholder:text-slate-400 focus:ring-4 focus:ring-blue-500/10 transition-all text-center"
                    placeholder="Enter new value..."
                  />
                  <div className="flex items-center justify-center gap-2 mt-4 px-4 py-2 bg-amber-50 rounded-2xl border border-amber-100">
                    <Info size={14} className="text-amber-600" />
                    <p className="text-[10px] font-bold text-amber-700 italic">This will update all branches on their next sync.</p>
                  </div>
                </div>

                <div className="pt-6 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 h-16 flex items-center justify-center font-black text-slate-500 rounded-3xl hover:bg-slate-100 transition-colors uppercase tracking-widest text-xs"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 h-16 bg-slate-900 text-white flex items-center justify-center gap-2 font-black rounded-3xl shadow-xl shadow-slate-900/10 hover:bg-black transition-all hover:scale-[1.02] active:scale-95 uppercase tracking-widest text-xs"
                  >
                    <Check size={20} />
                    Push Change
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
