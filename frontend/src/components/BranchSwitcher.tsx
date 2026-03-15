import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { ChevronDown, Building, Check, LayoutGrid, Globe } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface Branch {
    id: string;
    name: string;
    code: string;
    type: string;
}

export default function BranchSwitcher() {
    const { user, activeBranchId, setActiveBranchId } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    // Fetch authorized branches
    const { data: branches, isLoading } = useQuery({
        queryKey: ['authorized-branches'],
        queryFn: async () => {
            const res = await api.getAuthorizedBranches();
            return res;
        },
        enabled: !!user
    });

    // Determine current branch name
    const currentBranch = branches?.find(b => b.id === activeBranchId);

    // If user has no hierarchy access or only 1 branch, don't show switcher
    const showSwitcher = branches && branches.length > 1;

    if (isLoading || !showSwitcher) {
        if (currentBranch) {
            return (
                <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50/50 rounded-2xl text-[11px] font-black text-indigo-700 border border-indigo-100 shadow-sm transition-all hover:bg-indigo-50">
                    <Building size={14} strokeWidth={2.5} />
                    <span>{currentBranch.name}</span>
                </div>
            );
        }
        return null;
    }

    return (
        <div className="relative group/switcher" dir="rtl">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-2xl text-[11px] font-black transition-all duration-300 border shadow-sm group ${isOpen
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-200'
                    : 'bg-white text-slate-700 border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30'
                    }`}
            >
                <div className={`p-1.5 rounded-xl transition-all duration-300 ${isOpen ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'
                    }`}>
                    <Building size={15} strokeWidth={2.5} />
                </div>

                <div className="flex flex-col items-start leading-tight min-w-[100px]">
                    <span className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isOpen ? 'text-indigo-100' : 'text-slate-400'}`}>الفرع النشط</span>
                    <span className="font-black truncate max-w-[150px]">
                        {activeBranchId ? currentBranch?.name : 'الإدارة العامة'}
                    </span>
                </div>

                <ChevronDown
                    size={16}
                    strokeWidth={3}
                    className={`transition-transform duration-500 ${isOpen ? 'rotate-180 text-white' : 'text-slate-300 group-hover:text-indigo-400'}`}
                />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[90]" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-[calc(100%+12px)] right-0 w-72 bg-white border border-slate-100 rounded-[2rem] shadow-2xl z-[100] animate-in fade-in slide-in-from-top-4 duration-500 overflow-hidden">

                        {/* Header */}
                        <div className="p-6 pb-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <LayoutGrid size={16} className="text-indigo-600" strokeWidth={2.5} />
                                <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                                    تبديل فرع العمل
                                </p>
                            </div>
                            {branches && (
                                <span className="text-[10px] bg-slate-200 text-slate-600 font-black px-2 py-0.5 rounded-full">
                                    {branches.length} متاح
                                </span>
                            )}
                        </div>

                        {/* Options List */}
                        <div className="max-h-[400px] overflow-y-auto custom-scroll p-4 space-y-1.5 bg-white">

                            {/* Option for All Branches (for Admins) */}
                            {['SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_ADMIN', 'ACCOUNTANT'].includes(user?.role || '') && (
                                <button
                                    onClick={() => {
                                        setActiveBranchId(null);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full group flex items-center justify-between p-4 rounded-3xl text-[11px] font-black transition-all duration-300 ${!activeBranchId
                                        ? 'bg-slate-900 text-white shadow-xl shadow-slate-200'
                                        : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-100'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2.5 rounded-2xl transition-colors ${!activeBranchId ? 'bg-white/10 text-white scale-110 shadow-lg' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white'}`}>
                                            <Globe size={18} strokeWidth={2.5} />
                                        </div>
                                        <div className="text-right">
                                            <div className="mb-0.5 text-xs">الإدارة العامة (HQ)</div>
                                            <div className={`text-[9px] font-bold ${!activeBranchId ? 'text-slate-400' : 'text-slate-400'}`}>نطاق النظام الشامل</div>
                                        </div>
                                    </div>
                                    {!activeBranchId && <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-slate-900 animate-in zoom-in duration-300"><Check size={12} strokeWidth={4} /></div>}
                                </button>
                            )}

                            {/* HQ Entities Group */}
                            {branches?.some(b => ['ADMIN_AFFAIRS', 'MAINTENANCE_CENTER'].includes(b.type)) && (
                                <div className="pt-6 pb-2 px-4">
                                    <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-4 h-[2px] bg-purple-200" />
                                        الكيانات المركزية
                                    </span>
                                </div>
                            )}

                            {branches?.filter(b => ['ADMIN_AFFAIRS', 'MAINTENANCE_CENTER'].includes(b.type)).map(branch => (
                                <button
                                    key={branch.id}
                                    onClick={() => {
                                        setActiveBranchId(branch.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full group flex items-center justify-between p-4 rounded-3xl text-[11px] font-black transition-all duration-300 ${activeBranchId === branch.id
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                                        : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-100'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2.5 rounded-2xl transition-colors ${activeBranchId === branch.id ? 'bg-white/20' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                                            <div className="relative">
                                                <Building size={18} strokeWidth={2.5} />
                                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-400 rounded-full border-2 border-white" />
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="mb-0.5">{branch.name}</div>
                                            <div className={`text-[9px] font-bold ${activeBranchId === branch.id ? 'text-indigo-100/70' : 'text-slate-400'}`}>
                                                {branch.type === 'ADMIN_AFFAIRS' ? 'شئون إدارية المركز' : 'مركز الصيانة العام'}
                                            </div>
                                        </div>
                                    </div>
                                    {activeBranchId === branch.id && (
                                        <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-indigo-600 animate-in zoom-in duration-300">
                                            <Check size={12} strokeWidth={4} />
                                        </div>
                                    )}
                                </button>
                            ))}

                            <div className="pt-6 pb-2 px-4">
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-4 h-[2px] bg-blue-200" />
                                    الفروع التشغيلية
                                </span>
                            </div>

                            {branches?.filter(b => b.type === 'BRANCH').map(branch => (
                                <button
                                    key={branch.id}
                                    onClick={() => {
                                        setActiveBranchId(branch.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full group flex items-center justify-between p-4 rounded-2xl text-[11px] font-black transition-all duration-300 ${activeBranchId === branch.id
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                                        : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-100'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-xl transition-colors ${activeBranchId === branch.id ? 'bg-white/20' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                                            <Building size={18} strokeWidth={2.5} />
                                        </div>
                                        <div className="text-right">
                                            <div className="mb-0.5">{branch.name}</div>
                                            <div className={`text-[9px] font-bold ${activeBranchId === branch.id ? 'text-indigo-100/70' : 'text-slate-400'}`}>كود: {branch.code}</div>
                                        </div>
                                    </div>
                                    {activeBranchId === branch.id && (
                                        <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-indigo-600 animate-in zoom-in duration-300">
                                            <Check size={12} strokeWidth={4} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Footer Info */}
                        <div className="p-4 bg-slate-50 text-center border-t border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                يتم تحميل البيانات والتقارير تلقائياً فور التبديل
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

