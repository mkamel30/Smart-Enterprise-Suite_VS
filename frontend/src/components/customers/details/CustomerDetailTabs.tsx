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
                className="rounded-xl px-10 py-3 font-black text-sm data-[state=active]:bg-card data-[state=active]:shadow-lg transition-all flex flex-row-reverse gap-2"
            >
                <Monitor size={18} />
                الماكينات والشرائح ({machineCount + simCount})
            </TabsTrigger>
            <TabsTrigger
                value="info"
                className="rounded-xl px-10 py-3 font-black text-sm data-[state=active]:bg-card data-[state=active]:shadow-lg transition-all flex flex-row-reverse gap-2"
            >
                <FileText size={18} />
                بيانات العميل التفصيلية
            </TabsTrigger>
        </TabsList>
    );
}
