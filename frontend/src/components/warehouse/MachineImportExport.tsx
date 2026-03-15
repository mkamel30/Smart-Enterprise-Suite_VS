import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '../ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface MachineImportExportProps {
    onOpenImportModal: () => void;
    onDownloadTemplate: () => void;
    onExport: () => void;
    isCenterManager: boolean;
}

export const MachineImportExport: React.FC<MachineImportExportProps> = ({
    onOpenImportModal,
    onDownloadTemplate,
    onExport,
    isCenterManager
}) => {
    if (isCenterManager) return null;

    return (
        <div className="flex gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="rounded-xl border-slate-200 bg-white/50 backdrop-blur-sm gap-2">
                        <FileSpreadsheet size={18} className="text-emerald-600" />
                        عمليات Excel
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white rounded-xl p-2 shadow-xl border-slate-200 z-[100]">
                    <DropdownMenuItem
                        onClick={onDownloadTemplate}
                        className="rounded-lg gap-2 cursor-pointer py-2 focus:bg-emerald-50"
                    >
                        <Download size={16} />
                        تحميل قالب الاستيراد
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        onClick={onOpenImportModal}
                        className="rounded-lg gap-2 cursor-pointer py-2 focus:bg-blue-50"
                    >
                        <Upload size={16} />
                        استيراد من Excel
                    </DropdownMenuItem>

                    <div className="h-px bg-slate-100 my-1" />

                    <DropdownMenuItem
                        onClick={onExport}
                        className="rounded-lg gap-2 cursor-pointer py-2 focus:bg-emerald-50 text-emerald-700"
                    >
                        <FileSpreadsheet size={16} />
                        تصدير البيانات
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};
