import React from 'react';
import { Monitor, FileText } from 'lucide-react';
import { TabsList, TabsTrigger } from '../../ui/tabs';

interface CustomerDetailTabsProps {
    machineCount: number;
    simCount: number;
}

export default function CustomerDetailTabs({
    machineCount,
    simCount
}: CustomerDetailTabsProps) {
    return (
        <TabsList className="bg-muted/50 p-1 rounded-2xl border border-border/50 w-full flex flex-row-reverse justify-start">
            <TabsTrigger
                value="machines"
                className="rounded-xl px-6 py-2.5 font-black text-xs data-[state=active]:bg-card data-[state=active]:shadow-lg transition-all flex flex-row-reverse gap-2"
            >
                <Monitor size={16} />
                الماكينات والشرائح ({machineCount + simCount})
            </TabsTrigger>
            <TabsTrigger
                value="info"
                className="rounded-xl px-6 py-2.5 font-black text-xs data-[state=active]:bg-card data-[state=active]:shadow-lg transition-all flex flex-row-reverse gap-2"
            >
                <FileText size={16} />
                بيانات العميل التفصيلية
            </TabsTrigger>
        </TabsList>
    );
}
