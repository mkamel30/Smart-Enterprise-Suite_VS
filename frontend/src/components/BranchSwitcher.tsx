import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { ChevronDown, Building, Check } from 'lucide-react';
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
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg text-xs font-bold text-muted-foreground border border-transparent">
                    <Building size={14} />
                    <span>{currentBranch.name}</span>
                </div>
            );
        }
        return null;
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-card hover:bg-muted border border-border rounded-lg text-xs font-bold transition-all shadow-sm group"
            >
                <div className="p-1 bg-primary/10 rounded-md text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Building size={14} />
                </div>
                <div className="flex flex-col items-start leading-none">
                    <span className="text-[10px] text-muted-foreground font-medium mb-0.5">الفرع الحالي</span>
                    <span className="text-foreground truncate max-w-[120px]">
                        {currentBranch?.name || 'All Branches'}
                    </span>
                </div>
                <ChevronDown
                    size={14}
                    className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-2 border-b border-border/50 bg-muted/30">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider px-2">
                                تبديل الفرع
                            </p>
                        </div>

                        <div className="max-h-64 overflow-y-auto custom-scroll p-1">
                            {/* Option for All Branches (if user is Admin) */}
                            {['SUPER_ADMIN', 'MANAGEMENT'].includes(user?.role || '') && (
                                <button
                                    onClick={() => {
                                        setActiveBranchId(null);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all mb-1 ${!activeBranchId
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-foreground/80 hover:bg-muted'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${!activeBranchId ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                                        <span>كل الفروع (Admin View)</span>
                                    </div>
                                    {!activeBranchId && <Check size={14} />}
                                </button>
                            )}

                            {branches?.map(branch => (
                                <button
                                    key={branch.id}
                                    onClick={() => {
                                        setActiveBranchId(branch.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeBranchId === branch.id
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-foreground/80 hover:bg-muted'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${activeBranchId === branch.id ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                                        <span>{branch.name}</span>
                                    </div>
                                    {activeBranchId === branch.id && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
