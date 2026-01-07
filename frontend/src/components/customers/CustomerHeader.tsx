import React from 'react';
import { Upload, Download, Filter } from 'lucide-react';

interface CustomerHeaderProps {
    isAdmin: boolean;
    filterBranchId: string;
    setFilterBranchId: (id: string) => void;
    branches: any[];
    onImport: () => void;
    onDownloadTemplate: () => void;
}

export default function CustomerHeader({
    isAdmin,
    filterBranchId,
    setFilterBranchId,
    branches,
    onImport,
    onDownloadTemplate
}: CustomerHeaderProps) {
    return (
        <div className="flex flex-wrap justify-between items-center mb-10 gap-6">
            <div className="space-y-1">
                <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
                    بوابة العملاء
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                </h1>
                <p className="text-muted-foreground font-bold">إدارة بيانات العملاء، الماكينات والشرائح</p>
            </div>

            <div className="flex gap-4 flex-wrap items-center">
                {isAdmin && (
                    <div className="flex items-center gap-3 bg-card border border-border px-5 py-3 rounded-3xl shadow-lg hover:shadow-xl transition-all focus-within:ring-4 focus-within:ring-primary/10">
                        <Filter size={18} className="text-muted-foreground" />
                        <select
                            value={filterBranchId}
                            onChange={(e) => setFilterBranchId(e.target.value)}
                            className="bg-transparent outline-none text-sm font-black text-foreground min-w-35 appearance-none cursor-pointer"
                        >
                            <option value="">جميع الفروع</option>
                            {(branches as any[])?.map((branch: any) => (
                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <button
                    onClick={onImport}
                    className="flex items-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-3xl font-black shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95"
                >
                    <Upload size={22} strokeWidth={3} />
                    استيراد بيانات
                </button>

                <button
                    onClick={onDownloadTemplate}
                    className="flex items-center gap-3 bg-muted hover:bg-accent text-foreground px-8 py-4 rounded-3xl font-black border border-border transition-all hover:scale-[1.02] active:scale-95"
                >
                    <Download size={22} strokeWidth={3} />
                    قالب الإدخال
                </button>
            </div>
        </div>
    );
}
