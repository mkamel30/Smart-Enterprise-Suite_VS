import React from 'react';
import { Smartphone, CheckCircle, Send, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

interface TabsProps {
    activeTab: 'ALL' | 'ACTIVE' | 'DEFECTIVE' | 'IN_TRANSIT';
    setActiveTab: (tab: any) => void;
    counts: {
        total?: number;
        ACTIVE?: number;
        IN_TRANSIT?: number;
        DEFECTIVE?: number;
    } | undefined;
}

export function SimTabs({ activeTab, setActiveTab, counts }: TabsProps) {
    const tabs = [
        { id: 'ALL', label: 'كل الشرائح', icon: <Smartphone size={18} />, color: 'text-primary', border: 'bg-primary', badge: 'bg-primary/5 text-primary' },
        { id: 'ACTIVE', label: 'شرائح سليمة', icon: <CheckCircle size={18} />, color: 'text-emerald-600', border: 'bg-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
        { id: 'IN_TRANSIT', label: 'في الطريق', icon: <Send size={18} />, color: 'text-blue-600', border: 'bg-blue-600', badge: 'bg-blue-100 text-blue-700' },
        { id: 'DEFECTIVE', label: 'شرائح تالفة', icon: <AlertTriangle size={18} />, color: 'text-red-600', border: 'bg-red-600', badge: 'bg-red-100 text-red-700' },
    ];

    return (
        <div className="flex gap-2 overflow-x-auto pb-px mb-8 border-b border-slate-100">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                        "px-6 py-4 relative transition-all flex items-center gap-2 font-bold whitespace-nowrap group",
                        activeTab === tab.id ? tab.color : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    <span className={cn("transition-transform group-hover:scale-110", activeTab === tab.id && "scale-110")}>
                        {tab.icon}
                    </span>
                    {tab.label}
                    {counts && (counts as any)[tab.id === 'ALL' ? 'total' : tab.id] > 0 && (
                        <Badge className={cn("mr-1 rounded-full px-2 py-0.5", tab.badge)}>
                            {(counts as any)[tab.id === 'ALL' ? 'total' : tab.id]}
                        </Badge>
                    )}
                    {activeTab === tab.id && (
                        <div className={cn("absolute bottom-0 left-0 w-full h-1 rounded-t-full", tab.border)} />
                    )}
                </button>
            ))}
        </div>
    );
}
