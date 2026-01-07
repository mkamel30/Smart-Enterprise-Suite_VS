import React from 'react';
import { Search, Users, Monitor, CreditCard } from 'lucide-react';

interface CustomerSearchProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    searchResults: any[];
    onSelectResult: (result: any) => void;
}

export default function CustomerSearch({
    searchQuery,
    setSearchQuery,
    searchResults,
    onSelectResult
}: CustomerSearchProps) {
    return (
        <div className="mb-8 relative z-50">
            <div className="relative group">
                <Search className="absolute right-5 top-1/2 transform -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={22} />
                <input
                    type="text"
                    placeholder="ابحث بكود العميل، الاسم، أو رقم تسلسل الماكينة..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pr-14 pl-6 py-5 bg-card border border-border rounded-[2.5rem] shadow-xl focus:outline-none focus:ring-8 focus:ring-primary/5 focus:border-primary transition-all font-bold text-lg text-right"
                />
            </div>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
                <div className="absolute z-[100] w-full mt-4 bg-card/80 backdrop-blur-2xl border border-border rounded-[2.5rem] shadow-2xl max-h-[500px] overflow-hidden animate-scale-in">
                    <div className="p-4 border-b border-border/50 bg-muted/30">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-4">نتائج البحث ({searchResults.length})</span>
                    </div>
                    <div className="overflow-y-auto max-h-[400px] custom-scroll p-2">
                        {searchResults.map((result: any, idx: number) => (
                            <button
                                key={idx}
                                onClick={() => onSelectResult(result)}
                                className="w-full text-right px-6 py-4 hover:bg-primary/5 rounded-2xl transition-all flex items-center gap-4 group"
                            >
                                <div className={`p-3 rounded-xl transition-colors ${result.icon === 'user' ? 'bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white' :
                                    result.icon === 'monitor' ? 'bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white' :
                                        'bg-purple-500/10 text-purple-500 group-hover:bg-purple-500 group-hover:text-white'
                                    }`}>
                                    {result.icon === 'user' && <Users size={20} />}
                                    {result.icon === 'monitor' && <Monitor size={20} />}
                                    {result.icon === 'sim' && <CreditCard size={20} />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-black text-foreground group-hover:translate-x-[-4px] transition-transform">{result.matchText}</span>
                                    {result.type === 'machine' && <span className="text-[10px] font-bold text-muted-foreground">رقم تسلسلي للماكينة</span>}
                                    {result.type === 'sim' && <span className="text-[10px] font-bold text-muted-foreground">رقم تسلسلي للشريحة</span>}
                                    {result.type === 'customer' && <span className="text-[10px] font-bold text-muted-foreground">بيانات عميل</span>}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
