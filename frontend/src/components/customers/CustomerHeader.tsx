import React from 'react';
import { Upload, Download, Filter, FileSpreadsheet } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";

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

                <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-2 bg-white border border-border px-5 py-3 rounded-3xl font-bold shadow-lg hover:shadow-xl transition-all outline-none">
                        <FileSpreadsheet size={20} className="text-emerald-600" />
                        عمليات Excel
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white rounded-xl p-2 shadow-xl border-2 border-slate-100 min-w-[200px] z-[100]">
                        <DropdownMenuItem onClick={onDownloadTemplate} className="rounded-lg gap-3 cursor-pointer py-2.5 font-medium hover:bg-slate-50 focus:bg-slate-50">
                            <Download size={16} className="text-slate-500" />
                            تحميل قالب الإدخال
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={onImport} className="rounded-lg gap-3 cursor-pointer py-2.5 font-medium hover:bg-slate-50 focus:bg-slate-50">
                            <Upload size={16} className="text-blue-500" />
                            استيراد بيانات
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
