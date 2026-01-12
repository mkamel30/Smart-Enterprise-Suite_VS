import { useState } from 'react';
import { Upload, CheckCircle, XCircle, AlertCircle, Loader } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    onImport: (file: File) => Promise<any>;
    onSuccess: () => void;
    columns: { header: string; key: string }[];
}

export default function ImportModal({ isOpen, onClose, title, onImport, onSuccess, columns }: ImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<any[]>([]);
    const [totalRows, setTotalRows] = useState(0);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<any>(null);
    const [step, setStep] = useState<'select' | 'preview' | 'importing' | 'result'>('select');

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);

        // Parse Excel to show preview
        try {
            const ExcelJS = await import('exceljs');
            const workbook = new ExcelJS.Workbook();
            const buffer = await selectedFile.arrayBuffer();
            await workbook.xlsx.load(buffer);

            const worksheet = workbook.worksheets[0];
            const rows: any[] = [];

            // Smart Header Mapping
            const headerMapping: { [key: number]: string } = {};
            const headerRow = worksheet.getRow(1);

            headerRow.eachCell((cell, colNumber) => {
                const cellValue = cell.value ? String(cell.value).trim() : '';
                const match = columns.find(col =>
                    col.key.toLowerCase() === cellValue.toLowerCase() ||
                    col.header === cellValue
                );
                if (match) {
                    headerMapping[colNumber] = match.key;
                } else {
                    headerMapping[colNumber] = cellValue;
                }
            });

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;

                const rowData: any = {};
                row.eachCell((cell, colNumber) => {
                    const key = headerMapping[colNumber];
                    if (key) {
                        let value = cell.value;
                        if (value && typeof value === 'object' && 'result' in value) {
                            value = value.result;
                        }
                        rowData[key] = value;
                    }
                });
                if (Object.keys(rowData).length > 0) {
                    rows.push(rowData);
                }
            });

            // Set total count and preview (first 5 rows only)
            setTotalRows(rows.length);
            setPreview(rows.slice(0, 5));
            setStep('preview');
        } catch (error) {
            console.error('Preview error:', error);
        }
    };

    const handleConfirmImport = async () => {
        if (!file) return;

        setStep('importing');
        setProgress(0);

        const progressInterval = setInterval(() => {
            setProgress(prev => Math.min(prev + 10, 90));
        }, 200);

        try {
            const importResult = await onImport(file);
            clearInterval(progressInterval);
            setProgress(100);
            setResult(importResult);
            setStep('result');
            onSuccess();
        } catch (error: any) {
            clearInterval(progressInterval);
            setResult({
                success: false,
                message: error.message || 'حدث خطأ أثناء الاستيراد',
                errors: [{ error: error.message }]
            });
            setStep('result');
        }
    };

    const handleClose = () => {
        setFile(null);
        setPreview([]);
        setTotalRows(0);
        setProgress(0);
        setResult(null);
        setStep('select');
        onClose();
    };

    const renderFooter = () => {
        if (step === 'preview') {
            return (
                <div className="p-6 border-t bg-slate-50/50 shrink-0 flex gap-3">
                    <Button onClick={handleConfirmImport} className="flex-1">
                        <CheckCircle size={18} className="ml-2" />
                        تأكيد الاستيراد
                    </Button>
                    <Button variant="outline" onClick={handleClose} className="flex-1">
                        إلغاء
                    </Button>
                </div>
            );
        }
        if (step === 'result' && result) {
            return (
                <div className="p-6 border-t bg-slate-50/50 shrink-0">
                    <Button onClick={handleClose} className="w-full">
                        إغلاق
                    </Button>
                </div>
            );
        }
        return null;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="p-0 border-0 flex flex-col max-h-[95vh] sm:max-h-[90vh] h-auto overflow-hidden sm:max-w-xl" dir="rtl">
                <DialogHeader className="bg-slate-50 p-6 pb-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Upload className="text-blue-600" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        استيراد البيانات من ملف Excel
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'select' && (
                        <div className="text-center py-12">
                            <Upload className="mx-auto text-slate-300 mb-4" size={64} />
                            <h3 className="text-lg font-bold mb-2">اختر ملف Excel للاستيراد</h3>
                            <p className="text-slate-500 mb-6">سيتم عرض معاينة للبيانات قبل الاستيراد</p>
                            <label className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 cursor-pointer transition-colors font-bold shadow-sm hover:translate-y-[-1px] active:translate-y-[1px]">
                                <Upload size={20} />
                                اختيار ملف
                                <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div>
                            <div className="flex items-center gap-2 mb-4 text-green-600 bg-green-50 p-3 rounded-xl border border-green-100">
                                <CheckCircle size={20} />
                                <span className="font-bold">تم تحميل الملف: {file?.name}</span>
                            </div>

                            {/* Total count badge */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                                        <span className="text-white font-black text-lg">{totalRows}</span>
                                    </div>
                                    <div>
                                        <div className="font-bold text-blue-800">إجمالي السجلات للاستيراد</div>
                                        <div className="text-sm text-blue-600">سيتم استيراد {totalRows} سجل من الملف</div>
                                    </div>
                                </div>
                            </div>

                            <div className="text-sm text-slate-500 mb-2 font-medium">معاينة أول {preview.length} صفوف:</div>

                            <div className="overflow-x-auto border rounded-xl shadow-sm">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-slate-700">
                                        <tr>
                                            {columns.map(col => (
                                                <th key={col.key} className="p-3 text-right font-bold border-b">{col.header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {preview.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                {columns.map(col => (
                                                    <td key={col.key} className="p-3 max-w-[200px] truncate text-slate-600 font-medium">
                                                        {String(row[col.key] || '-')}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {totalRows > 5 && (
                                <div className="text-center text-sm text-slate-400 mt-2">
                                    ... و {totalRows - 5} صفوف أخرى
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'importing' && (
                        <div className="text-center py-12">
                            <Loader className="mx-auto animate-spin text-blue-600 mb-4" size={48} />
                            <h3 className="text-lg font-bold mb-4">جاري الاستيراد...</h3>
                            <Progress value={progress} className="max-w-md mx-auto h-3" />
                            <p className="text-slate-500 mt-2 font-mono font-bold">{progress}%</p>
                        </div>
                    )}

                    {step === 'result' && result && (
                        <div className="text-center py-4">
                            {result.success !== false ? (
                                <>
                                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <CheckCircle className="text-green-600" size={48} />
                                    </div>
                                    <h3 className="text-xl font-black text-green-800 mb-2">تم الاستيراد بنجاح!</h3>
                                </>
                            ) : (
                                <>
                                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <XCircle className="text-red-600" size={48} />
                                    </div>
                                    <h3 className="text-xl font-black text-red-800 mb-2">حدث خطأ</h3>
                                </>
                            )}

                            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto my-8">
                                {result.created !== undefined && result.created > 0 && (
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center transform hover:scale-105 transition-transform">
                                        <div className="text-3xl font-black text-green-600 mb-1">{result.created}</div>
                                        <div className="text-xs font-bold text-green-700 uppercase tracking-wide">تم الإنشاء</div>
                                    </div>
                                )}
                                {result.updated !== undefined && result.updated > 0 && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center transform hover:scale-105 transition-transform">
                                        <div className="text-3xl font-black text-blue-600 mb-1">{result.updated}</div>
                                        <div className="text-xs font-bold text-blue-700 uppercase tracking-wide">تم التحديث</div>
                                    </div>
                                )}
                                {result.skipped !== undefined && result.skipped > 0 && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center transform hover:scale-105 transition-transform">
                                        <div className="text-3xl font-black text-yellow-600 mb-1">{result.skipped}</div>
                                        <div className="text-xs font-bold text-yellow-700 uppercase tracking-wide">تم التخطي</div>
                                    </div>
                                )}
                            </div>

                            {result.errors && result.errors.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-right max-w-lg mx-auto">
                                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-red-100">
                                        <AlertCircle className="text-red-600" size={20} />
                                        <h4 className="font-bold text-red-800">تفاصيل الأخطاء ({result.errors.length})</h4>
                                    </div>
                                    <div className="max-h-40 overflow-y-auto text-sm text-red-700 custom-scroll pl-2">
                                        {result.errors.slice(0, 50).map((err: any, idx: number) => (
                                            <div key={idx} className="py-1.5 border-b border-red-100/50 last:border-0 flex gap-2">
                                                <span className="text-red-400">•</span>
                                                <span>{err.error}</span>
                                            </div>
                                        ))}
                                        {result.errors.length > 50 && (
                                            <div className="py-2 font-bold text-center text-red-600 bg-white/50 rounded mt-2">
                                                + {result.errors.length - 50} أخطاء أخرى
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {renderFooter()}
            </DialogContent>
        </Dialog>
    );
}
