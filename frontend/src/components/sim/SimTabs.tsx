import React from 'react';
import { Check, Send, X } from 'lucide-react';

interface TabsProps {
    activeTab: 'ACTIVE' | 'DEFECTIVE' | 'IN_TRANSIT';
    setActiveTab: (tab: 'ACTIVE' | 'DEFECTIVE' | 'IN_TRANSIT') => void;
    counts: {
        ACTIVE?: number;
        IN_TRANSIT?: number;
        DEFECTIVE?: number;
    } | undefined;
}

export function SimTabs({ activeTab, setActiveTab, counts }: TabsProps) {
    return (
        <div className="flex gap-4 mb-6 border-b overflow-x-auto">
            <button
                onClick={() => setActiveTab('ACTIVE')}
                className={`pb-2 px-4 flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'ACTIVE'
                    ? 'font-bold text-green-600 border-b-2 border-green-600'
                    : 'text-slate-500 hover:text-slate-700'}`}
            >
                <Check size={18} />
                شرائح سليمة
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">
                    {counts?.ACTIVE || 0}
                </span>
            </button>
            <button
                onClick={() => setActiveTab('IN_TRANSIT')}
                className={`pb-2 px-4 flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'IN_TRANSIT'
                    ? 'font-bold text-blue-600 border-b-2 border-blue-600'
                    : 'text-slate-500 hover:text-slate-700'}`}
            >
                <Send size={18} />
                في الطريق
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                    {counts?.IN_TRANSIT || 0}
                </span>
            </button>
            <button
                onClick={() => setActiveTab('DEFECTIVE')}
                className={`pb-2 px-4 flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'DEFECTIVE'
                    ? 'font-bold text-red-600 border-b-2 border-red-600'
                    : 'text-slate-500 hover:text-slate-700'}`}
            >
                <X size={18} />
                شرائح تالفة
                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">
                    {counts?.DEFECTIVE || 0}
                </span>
            </button>
        </div>
    );
}
