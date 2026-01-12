import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';
import { X, Upload, CheckCircle, XCircle, AlertCircle, Loader, FileSpreadsheet } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface MachineImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const COLUMNS = [
    { key: 'serialNumber', header: 'Serial Number' },
    { key: 'model', header: 'Model' },
    { key: 'manufacturer', header: 'Manufacturer' },
    { key: 'status', header: 'Status' },
    { key: 'notes', header: 'Notes' }
];

// Valid status values
const VALID_STATUSES = ['NEW', 'STANDBY', 'SOLD', 'CLIENT_REPAIR', 'AT_CENTER', 'EXTERNAL_REPAIR', 'SCRAPPED', 'IN_TRANSIT'];

export function MachineImportModal({ isOpen, onClose, onSuccess }: MachineImportModalProps) {
    const { user } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<any[]>([]);
    const [allData, setAllData] = useState<any[]>([]);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<any>(null);
    const [step, setStep] = useState<'select' | 'preview' | 'importing' | 'result'>('select');

    // Admin Affairs imports to their own warehouse - no branch selection
    const targetBranchId = user?.branchId || '';

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);

        try {
            const ExcelJS = await import('exceljs');
            const workbook = new ExcelJS.Workbook();
            const buffer = await selectedFile.arrayBuffer();
            await workbook.xlsx.load(buffer);

            const worksheet = workbook.worksheets[0];
            const rows: any[] = [];

            const headerMapping: { [key: number]: string } = {};
            const headerRow = worksheet.getRow(1);

            headerRow.eachCell((cell, colNumber) => {
                const cellValue = cell.value ? String(cell.value).trim() : '';
                const match = COLUMNS.find(col =>
                    col.key.toLowerCase() === cellValue.toLowerCase() ||
                    col.header.toLowerCase() === cellValue.toLowerCase()
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
                        if (value && typeof value === 'object') {
                            if ('richText' in value) {
                                value = (value as any).richText.map((t: any) => t.text).join('');
                            } else if ('text' in value) {
                                value = (value as any).text;
                            }
                        }
                        // CRITICAL: Ensure serialNumber is always a string
                        if (key === 'serialNumber') {
                            value = String(value);
                        }
                        rowData[key] = value;
                    }
                });

                if (rowData.serialNumber) {
                    rowData.serialNumber = String(rowData.serialNumber);
                    // Validate and normalize status
                    if (rowData.status) {
                        const upperStatus = String(rowData.status).toUpperCase().trim();
                        rowData.status = VALID_STATUSES.includes(upperStatus) ? upperStatus : 'NEW';
                    } else {
                        rowData.status = 'NEW';
                    }
                    rows.push(rowData);
                }
            });

            setAllData(rows);
            setPreview(rows.slice(0, 5));
            setStep('preview');
        } catch (error) {
            toast.error('فشل قراءة الملف');
        }
    };

    const handleConfirmImport = async () => {
        if (!file || allData.length === 0) return;
        if (!targetBranchId) {
            toast.error('خطأ: لم يتم تحديد الفرع. يرجى تسجيل الدخول مرة أخرى.');
            return;
        }

        setStep('importing');
        setProgress(0);

        const progressInterval = setInterval(() => {
            setProgress(prev => Math.min(prev + 10, 90));
        }, 200);

        try {
            const performedBy = user?.displayName || user?.email || 'System';
            const importResult = await api.importWarehouseMachines(allData, targetBranchId, performedBy);
            clearInterval(progressInterval);
            setProgress(100);
            setResult(importResult);
            setStep('result');

            setTimeout(() => {
                onSuccess();
            }, 100);
        } catch (error: any) {
            clearInterval(progressInterval);
            setResult({ error: error.message || 'فشل الاستيراد' });
            setStep('result');
        }
    };

    const handleClose = () => {
        setFile(null);
        setPreview([]);
        setAllData([]);
        setProgress(0);
        setResult(null);
        setStep('select');
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" dir="rtl">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <FileSpreadsheet className="text-emerald-600" />
                        استيراد ماكينات من Excel
                    </h2>
                    <button onClick={handleClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'select' && (
                        <div className="text-center py-12">
                            <Upload className="mx-auto text-slate-300 mb-4" size={64} />
                            <h3 className="text-lg font-bold mb-2">اختر ملف Excel للاستيراد</h3>
                            <p className="text-slate-500 mb-6">سيتم استيراد الماكينات إلى مخزنك مباشرة</p>

                            <label className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 cursor-pointer transition-colors shadow-lg active:scale-95">
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
                            <div className="mb-4">
                                <h3 className="font-bold text-lg mb-1">معاينة البيانات</h3>
                                <p className="text-sm text-slate-500">
                                    عرض أول 5 سجلات من {file?.name}
                                </p>
                            </div>

                            {/* Total count badge */}
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center">
                                        <span className="text-white font-black text-lg">{allData.length}</span>
                                    </div>
                                    <div>
                                        <div className="font-bold text-emerald-800">إجمالي الماكينات للاستيراد</div>
                                        <div className="text-sm text-emerald-600">سيتم استيراد {allData.length} ماكينة إلى مخزنك</div>
                                    </div>
                                </div>
                            </div>

                            <div className="text-sm text-slate-500 mb-2 font-medium">معاينة أول {preview.length} صفوف:</div>

                            <div className="border rounded-xl overflow-hidden mb-4 overflow-x-auto">
                                <table className="w-full text-sm text-right whitespace-nowrap">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            {COLUMNS.map(col => (
                                                <th key={col.key} className="p-3 font-bold">{col.header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {preview.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                {COLUMNS.map(col => (
                                                    <td key={col.key} className="p-3">{row[col.key] || '-'}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {allData.length > 5 && (
                                <div className="text-center text-sm text-slate-400 mb-4">
                                    ... و {allData.length - 5} ماكينة أخرى
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={handleConfirmImport}
                                    className="flex-1 bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 font-bold transition-colors shadow-lg"
                                >
                                    تأكيد الاستيراد ({allData.length} ماكينة)
                                </button>
                                <button
                                    onClick={() => setStep('select')}
                                    className="flex-1 bg-slate-200 text-slate-800 py-3 rounded-xl hover:bg-slate-300 transition-colors"
                                >
                                    اختيار ملف آخر
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'importing' && (
                        <div className="text-center py-12">
                            <Loader className="mx-auto text-emerald-600 mb-4 animate-spin" size={64} />
                            <h3 className="text-lg font-bold mb-4">جاري الاستيراد...</h3>

                            <div className="w-full bg-slate-200 rounded-full h-4 mb-2 overflow-hidden">
                                <div
                                    className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-sm text-slate-500">{progress}%</p>
                        </div>
                    )}

                    {step === 'result' && (
                        <div>
                            {result?.error ? (
                                <div className="text-center py-12">
                                    <XCircle className="mx-auto text-red-500 mb-4" size={64} />
                                    <h3 className="text-lg font-bold mb-2 text-red-600">فشل الاستيراد</h3>
                                    <p className="text-slate-600">{result.error}</p>
                                </div>
                            ) : (
                                <div>
                                    <div className="text-center mb-6">
                                        <CheckCircle className="mx-auto text-emerald-500 mb-4" size={64} />
                                        <h3 className="text-lg font-bold mb-2 text-emerald-600">تم الاستيراد بنجاح!</h3>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                        {result?.success !== undefined && (
                                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                                                <div className="text-3xl font-bold text-emerald-600">{result.success}</div>
                                                <div className="text-sm text-emerald-700 mt-1">تم الإضافة بنجاح</div>
                                            </div>
                                        )}

                                        {result?.failed > 0 && (
                                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                                                <div className="text-3xl font-bold text-red-600">{result.failed}</div>
                                                <div className="text-sm text-red-700 mt-1">فشل الإضافة</div>
                                            </div>
                                        )}
                                    </div>

                                    {result?.errors && result.errors.length > 0 && (
                                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <AlertCircle className="text-red-600" size={20} />
                                                <h4 className="font-bold text-red-800">أخطاء ({result.errors.length})</h4>
                                            </div>
                                            <div className="max-h-32 overflow-y-auto text-sm text-red-700">
                                                {result.errors.slice(0, 5).map((err: any, idx: number) => (
                                                    <div key={idx} className="py-1">
                                                        • {err.serial}: {err.error}
                                                    </div>
                                                ))}
                                                {result.errors.length > 5 && (
                                                    <div className="py-1 font-bold">
                                                        + {result.errors.length - 5} أخطاء أخرى
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleClose}
                                        className="w-full bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 font-bold transition-colors"
                                    >
                                        إغلاق
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
