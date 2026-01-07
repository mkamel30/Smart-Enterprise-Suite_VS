import React from 'react';
import { DollarSign, Building2, Package, Sparkles } from 'lucide-react';
import { TabButton } from './TabButton';

interface ReportsTabsProps {
    activeTab: 'financial' | 'branches' | 'inventory' | 'ai';
    setActiveTab: (tab: 'financial' | 'branches' | 'inventory' | 'ai') => void;
    showBranches?: boolean;
}

export function ReportsTabs({ activeTab, setActiveTab, showBranches = true }: ReportsTabsProps) {
    return (
        <div className="flex flex-wrap gap-2 justify-center bg-card p-1.5 rounded-2xl border border-border shadow-inner w-full md:w-auto">
            <TabButton
                active={activeTab === 'financial'}
                onClick={() => setActiveTab('financial')}
                label="الأداء المالي"
                icon={<DollarSign size={18} />}
            />
            {showBranches && (
                <TabButton
                    active={activeTab === 'branches'}
                    onClick={() => setActiveTab('branches')}
                    label="أداء الفروع"
                    icon={<Building2 size={18} />}
                />
            )}
            <TabButton
                active={activeTab === 'inventory'}
                onClick={() => setActiveTab('inventory')}
                label="المخزون"
                icon={<Package size={18} />}
            />
            <TabButton
                active={activeTab === 'ai'}
                onClick={() => setActiveTab('ai')}
                label="الذكاء الاصطناعي"
                icon={<Sparkles size={18} />}
                color="purple"
            />
        </div>
    );
}
