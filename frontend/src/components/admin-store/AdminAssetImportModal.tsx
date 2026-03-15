import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, RefreshCcw, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../../api/client';
import { useApiMutation } from '../../hooks/useApiMutation';
import toast from 'react-hot-toast';

interface AdminAssetImportModalProps {
    onClose: () => void;
    itemTypes: any[];
}

export default function AdminAssetImportModal({ onClose, itemTypes }: AdminAssetImportModalProps) {
    const [fileData, setFileData] = useState<any[]>([]);
    const [fileName, setFileName] = useState('');
    const [importResults, setImportResults] = useState<{ success: number, errors: any[] } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const importMutation = useApiMutation({
        mutationFn: (assets: any[]) => api.importAdminAssets(assets),
        successMessage: 'تمت معالجة ملف الاستيراد',
        errorMessage: 'فشل استيراد الملف',
        invalidateKeys: [['admin-inventory'], ['admin-affairs-summary']],
        onSuccess: (data: any) => {
            setImportResults(data);
        }
    });

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
        let file: File | undefined;
        // Check if it's a drag event by checking for dataTransfer, which implies it's not a ChangeEvent
        if ('dataTransfer' in e) {
            e.preventDefault();
            file = e.dataTransfer?.files?.[0];
        } else {
            file = e.target.files?.[0];
        }

        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                const mappedData = data.map((row: any) => ({
                    serialNumber: row['السيريال'] || row['SerialNumber'] || row['serial'],
                    quantity: row['الكمية'] || row['Quantity'] || row['qty'],
                    cartonCode: row['الكرتونة'] || row['CartonCode'] || row['carton'],
                    itemTypeCode: row['كود الصنف'] || row['ItemType'] || row['itemType'],
                    simProvider: row['مقدم الخدمة'] || row['SimProvider'],
                    simNetworkType: row['نوع الشبكة'] || row['NetworkType'],
                    notes: row['ملاحظات'] || row['Notes'] || row['notes']
                }));

                // Valid if ItemType exists AND (Serial OR Quantity exists)
                const validData = mappedData.filter(d => d.itemTypeCode && (d.serialNumber || d.quantity));
                setFileData(validData);

                if (validData.length === 0) {
                    toast.error('لم يتم العثور على بيانات صالحة. يجب توفر كود الصنف، وبالإضافة لذلك السيريال أو الكمية.');
                } else {
                    toast.success(`تم قراءة ${validData.length} سجل من الملف`);
                }
            } catch (error) {
                console.error('Excel read error:', error);
                toast.error('خطأ في قراءة ملف Excel');
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            {
                'السيريال': 'S90-10001 (للأصول)',
                'الكمية': '1 (للمخزون)',
                'كود الصنف': 'POS_MACHINE',
                'الكرتونة': 'CR-2024-01',
                'مقدم الخدمة': 'Vodafone (للشرائح)',
                'نوع الشبكة': '4G',
                'ملاحظات': 'اختياري'
            }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'admin_assets_template.xlsx');
    };

    const handleImport = () => {
        if (fileData.length === 0) return;
        importMutation.mutate(fileData);
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-start sm:items-center justify-center z-[100] p-2 sm:p-4 overflow-y-auto">
            <div className="bg-card rounded-[2rem] sm:rounded-[3rem] p-5 sm:p-10 w-full max-w-4xl border border-border shadow-2xl animate-scale-in my-4 sm:my-8 relative">
                <div className="flex items-center justify-between mb-6 sm:mb-8 text-right">
                    <h2 className="text-xl sm:text-3xl font-black flex items-center gap-2 sm:gap-3 text-foreground">
                        <Upload className="text-emerald-500 w-6 h-6 sm:w-8 sm:h-8" />
                        استيراد من Excel
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                </div>

                {importResults ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div className="p-4 sm:p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl sm:rounded-[2rem] text-center">
                                <div className="text-2xl sm:text-4xl font-black text-emerald-600">{importResults.success}</div>
                                <div className="text-[10px] sm:text-sm font-black text-emerald-600/70 mt-1">ناجح</div>
                            </div>
                            <div className="p-4 sm:p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl sm:rounded-[2rem] text-center">
                                <div className="text-2xl sm:text-4xl font-black text-rose-600">{importResults.errors.length}</div>
                                <div className="text-[10px] sm:text-sm font-black text-rose-600/70 mt-1">أخطاء</div>
                            </div>
                        </div>

                        {importResults.errors.length > 0 && (
                            <div className="bg-muted/50 rounded-2xl sm:rounded-3xl border border-border overflow-hidden">
                                <div className="p-3 sm:p-4 bg-muted border-b border-border font-black text-rose-600 flex items-center justify-end gap-2 text-xs sm:text-sm">
                                    تقرير الأخطاء
                                    <AlertCircle size={16} />
                                </div>
                                <div className="max-h-[200px] sm:max-h-[300px] overflow-auto px-1 custom-scroll">
                                    <table className="w-full text-right text-[10px] sm:text-xs">
                                        <thead className="sticky top-0 bg-muted z-10">
                                            <tr>
                                                <th className="p-2 sm:p-3 font-black">السبب</th>
                                                <th className="p-2 sm:p-3 font-black">الصف</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/30">
                                            {importResults.errors.map((err, idx) => (
                                                <tr key={idx} className="hover:bg-rose-500/5">
                                                    <td className="p-2 sm:p-3 font-bold text-muted-foreground">{err.error}</td>
                                                    <td className="p-2 sm:p-3 font-black text-rose-600 whitespace-nowrap">صف {err.row}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
                            <button
                                onClick={onClose}
                                className="w-full sm:flex-1 bg-primary text-primary-foreground py-3 sm:py-5 rounded-xl sm:rounded-2xl font-black text-base sm:text-xl shadow-xl shadow-primary/20 transition-all active:scale-95"
                            >
                                العودة للمخزن
                            </button>
                            <button
                                onClick={() => {
                                    setImportResults(null);
                                    setFileData([]);
                                    setFileName('');
                                }}
                                className="w-full sm:flex-1 flex items-center justify-center gap-2 bg-muted hover:bg-accent text-foreground py-3 sm:py-5 rounded-xl sm:rounded-2xl font-black text-base sm:text-xl transition-all active:scale-95"
                            >
                                <RefreshCcw className="w-5 h-5 sm:w-6 sm:h-6" />
                                استيراد جديد
                            </button>
                        </div>
                    </div>
                ) : fileData.length > 0 ? (
                    <div className="space-y-6">
                        <div className="bg-card rounded-2xl sm:rounded-[2rem] border border-border overflow-hidden">
                            <div className="p-4 sm:p-6 bg-muted/50 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 sm:p-3 bg-emerald-500 text-white rounded-xl sm:rounded-2xl">
                                        <CheckCircle2 className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
                                    </div>
                                    <div className="text-right">
                                        <div className="font-black text-sm sm:text-base text-foreground">جاهز للاستيراد</div>
                                        <div className="text-[10px] sm:text-xs text-muted-foreground font-bold">{fileData.length} سجل متاح</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setFileData([]);
                                        setFileName('');
                                    }}
                                    className="text-xs sm:text-sm font-black text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    تغيير الملف
                                </button>
                            </div>
                            <div className="max-h-[300px] sm:max-h-[400px] overflow-auto custom-scroll">
                                <table className="w-full text-right text-xs sm:text-sm">
                                    <thead className="bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
                                        <tr>
                                            <th className="p-3 sm:p-4 font-black">#</th>
                                            <th className="p-3 sm:p-4 font-black">السيريال / الكمية</th>
                                            <th className="p-3 sm:p-4 font-black">كود الصنف</th>
                                            <th className="p-3 sm:p-4 font-black">بيانات إضافية</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {fileData.map((row, i) => (
                                            <tr key={i} className="hover:bg-muted/20">
                                                <td className="p-3 sm:p-4 font-bold text-muted-foreground">{i + 1}</td>
                                                <td className="p-3 sm:p-4 font-black whitespace-nowrap">
                                                    {row.serialNumber || <span className="text-purple-600">كمية: {row.quantity}</span>}
                                                </td>
                                                <td className="p-3 sm:p-4 font-bold whitespace-nowrap">{row.itemTypeCode}</td>
                                                <td className="p-3 sm:p-4 font-bold text-muted-foreground text-[10px]">
                                                    {row.simProvider && <span className="ml-2 text-emerald-600">{row.simProvider}</span>}
                                                    {row.cartonCode && <span className="text-blue-600">{row.cartonCode}</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                            <button
                                onClick={handleImport}
                                disabled={importMutation.isPending}
                                className="w-full sm:flex-1 bg-primary text-primary-foreground py-3 sm:py-5 rounded-xl sm:rounded-2xl font-black text-base sm:text-xl shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 order-1 sm:order-2"
                            >
                                {importMutation.isPending ? '⏳ جاري الحفظ...' : 'تأكيد الحفظ'}
                            </button>
                            <button
                                onClick={onClose}
                                className="w-full sm:flex-1 bg-muted hover:bg-accent text-foreground py-3 sm:py-5 rounded-xl sm:rounded-2xl font-black text-base sm:text-xl transition-all active:scale-95 order-2 sm:order-1"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 sm:space-y-8">
                        <div className="bg-blue-500/5 border-2 border-dashed border-blue-500/20 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] flex items-start justify-end gap-3 sm:gap-4">
                            <div className="text-right">
                                <h3 className="font-black text-blue-900 text-sm sm:text-base mb-1">كيفية الاستيراد</h3>
                                <p className="text-[10px] sm:text-sm text-blue-800/70 font-bold leading-relaxed">
                                    الملف يجب أن يحتوي على (السيريال) و (كود الصنف) كأعمدة أساسية.
                                    يمكنك تحميل النموذج المرفق للتأكد من التنسيق.
                                </p>
                            </div>
                            <Info className="text-blue-500 shrink-0 w-5 h-5 sm:w-6 sm:h-6" />
                        </div>

                        <div
                            onDragOver={e => e.preventDefault()}
                            onDrop={handleFileUpload}
                            onClick={() => fileInputRef.current?.click()}
                            className="border-4 border-dashed border-muted hover:border-primary/30 transition-all rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-16 flex flex-col items-center justify-center gap-4 sm:gap-6 bg-muted/30 group cursor-pointer"
                        >
                            <div className="p-4 sm:p-6 bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-xl group-hover:scale-110 transition-transform">
                                <FileSpreadsheet size={40} className="text-emerald-500 sm:w-16 sm:h-16" />
                            </div>
                            <div className="text-center">
                                <div className="text-lg sm:text-2xl font-black mb-1 text-foreground px-2">اسحب الملف هنا</div>
                                <div className="text-xs sm:text-sm text-muted-foreground font-bold italic">أو اضغط للاختيار من جهازك</div>
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                accept=".xlsx, .xls"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 sm:p-6 bg-muted/30 rounded-2xl sm:rounded-[2rem] border border-border">
                            <button
                                onClick={handleDownloadTemplate}
                                className="bg-white border-2 border-border/50 px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm hover:bg-muted transition-all active:scale-95"
                            >
                                تحميل النموذج
                            </button>
                            <div className="flex items-center gap-3 text-right">
                                <div className="hidden sm:block">
                                    <div className="font-black text-sm sm:text-base text-foreground">نموذج الاستيراد</div>
                                    <div className="text-[10px] sm:text-xs text-muted-foreground font-bold">لضمان دقة البيانات</div>
                                </div>
                                <Download className="text-primary w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full bg-muted hover:bg-accent text-foreground py-3 sm:py-5 rounded-xl sm:rounded-2xl font-black text-base sm:text-xl transition-all active:scale-95"
                        >
                            إلغاء التراجع
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
