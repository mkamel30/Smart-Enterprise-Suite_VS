import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { X, Upload, CheckCircle, XCircle, AlertCircle, Loader2, FileSpreadsheet, Eye, ChevronLeft, Hash, Info, FileText, BarChart3, ArrowLeft, ArrowRight, Sparkles, Inbox, LayoutDashboard, Database } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Dialog, DialogContent } from '../ui/dialog';
import { cn } from '../../lib/utils';

interface MachineImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const COLUMNS = [
    { key: 'serialNumber', header: 'رقم السيريال' },
    { key: 'model', header: 'الموديل' },
    { key: 'manufacturer', header: 'الشركة' },
    { key: 'status', header: 'الحالة' },
    { key: 'notes', header: 'الملاحظات' }
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

    // ESC key handler
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

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
            setProgress(prev => Math.min(prev + 5, 95));
        }, 300);

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

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="p-0 border-0 flex flex-col max-h-[96vh] h-auto overflow-hidden sm:max-w-4xl rounded-[3rem] shadow-2xl bg-white [&>button]:hidden text-right" dir="rtl">

                {/* Industrial Header Section with Emerald Gradient */}
                <div className="modal-header shrink-0 p-8 pb-6 bg-gradient-to-br from-emerald-600 to-teal-700 relative overflow-hidden text-right">
                    {/* Visual Decor */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-15 pointer-events-none">
                        <div className="absolute -top-1/2 -left-1/4 w-[150%] h-[150%] bg-white rounded-full blur-[120px] rotate-12"></div>
                        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[100%] bg-emerald-300 rounded-full blur-[90px]"></div>
                    </div>

                    <div className="modal-header-content relative z-10 text-right flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-5 justify-end sm:justify-start">
                            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl text-white">
                                <FileSpreadsheet size={28} strokeWidth={3} />
                            </div>
                            <div className="text-right">
                                <h2 className="modal-title font-black text-white leading-tight tracking-tight text-2xl">استيراد دفعات الماكينات</h2>
                                <div className="flex items-center gap-2 mt-1 justify-end">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></div>
                                    <p className="text-emerald-50 font-bold text-[10px] uppercase tracking-widest opacity-90">دليل الاستيراد السريع (Excel)</p>
                                </div>
                            </div>
                        </div>

                        {/* Modern Step Indicator */}
                        <div className="flex items-center gap-4 bg-black/10 backdrop-blur-sm p-4 rounded-3xl border border-white/5 mx-auto sm:mx-0">
                            {[
                                { id: 'select', num: '1', label: 'الملف' },
                                { id: 'preview', num: '2', label: 'المعاينة' },
                                { id: 'result', num: '3', label: 'النتيجة' }
                            ].map((s, idx) => (
                                <React.Fragment key={idx}>
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs transition-all duration-500",
                                            step === s.id || (step === 'importing' && s.id === 'preview') || (step === 'result' && s.id === 'result')
                                                ? "bg-white text-emerald-700 shadow-lg scale-110"
                                                : "bg-white/10 text-white/40"
                                        )}>
                                            {s.num}
                                        </div>
                                        <span className={cn(
                                            "text-[9px] font-black uppercase tracking-widest transition-colors duration-500",
                                            step === s.id ? "text-white" : "text-white/30"
                                        )}>{s.label}</span>
                                    </div>
                                    {idx < 2 && <div className="w-4 h-0.5 bg-white/10 rounded-full"></div>}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    <button type="button" className="modal-close bg-white/10 hover:bg-white/20 text-white transition-all p-2 rounded-xl backdrop-blur-sm" onClick={handleClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30 custom-scroll min-h-[400px]">
                    {step === 'select' && (
                        <div className="text-center py-12 space-y-12 flex flex-col items-center">
                            {/* Upload Zone */}
                            <div
                                className="relative group cursor-pointer w-full max-w-xl"
                                onClick={() => document.getElementById('import-file-input')?.click()}
                            >
                                <div className="absolute -inset-1 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[3.5rem] blur opacity-15 group-hover:opacity-40 transition duration-700 animate-pulse"></div>
                                <div className="relative h-80 bg-white border-2 border-dashed border-emerald-100/50 rounded-[3rem] flex flex-col items-center justify-center group-hover:border-emerald-500 group-hover:scale-[1.01] transition-all duration-500 shadow-xl shadow-slate-200/40">
                                    <div className="w-28 h-28 bg-emerald-50 text-emerald-600 rounded-[2.5rem] flex items-center justify-center mb-6 group-hover:rotate-12 group-hover:scale-110 transition-all duration-700 border-2 border-white shadow-inner">
                                        <Upload size={48} strokeWidth={3} />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-2">رفع ملف الماكينات</h3>
                                    <p className="text-sm font-bold text-slate-400">اسحب الملف هنا أو اضغط لتصفح جهازك</p>
                                    <div className="mt-8 flex items-center gap-3">
                                        <div className="px-4 py-1.5 bg-slate-50 text-slate-500 text-[10px] font-black rounded-lg border border-slate-100 uppercase tracking-widest">Excel Support</div>
                                        <div className="px-4 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg border border-blue-100 uppercase tracking-widest">Auto Map</div>
                                    </div>
                                </div>
                                <input id="import-file-input" type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                            </div>

                            {/* Requirements Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl text-right">
                                <div className="bg-white p-6 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/40 flex gap-5 transition-transform hover:-translate-y-1 duration-300">
                                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"><Database size={24} strokeWidth={2.5} /></div>
                                    <div className="flex flex-col justify-center">
                                        <h4 className="font-black text-slate-900 text-sm">تنسيق ذكي</h4>
                                        <p className="text-[11px] font-bold text-slate-500 mt-1 leading-relaxed">يتعرف النظام تلقائياً على الأعمدة بغض النظر عن الترتيب</p>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/40 flex gap-5 transition-transform hover:-translate-y-1 duration-300">
                                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"><Sparkles size={24} strokeWidth={2.5} /></div>
                                    <div className="flex flex-col justify-center">
                                        <h4 className="font-black text-slate-900 text-sm">حقول البيانات</h4>
                                        <p className="text-[11px] font-bold text-slate-500 mt-1 leading-relaxed">السيريال، الموديل، الشركة، الحالة، ملاحظات</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
                            {/* Detailed File Status Banner */}
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-[2.5rem] blur opacity-15"></div>
                                <div className="relative bg-white border border-slate-100/50 rounded-[2.5rem] p-8 flex items-center justify-between shadow-sm overflow-hidden">
                                    <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50/50 rounded-full blur-3xl -mr-10 -mt-10"></div>
                                    <div className="flex items-center gap-8 relative z-10">
                                        <div className="w-28 h-28 bg-emerald-600 rounded-[2.5rem] flex flex-col items-center justify-center shadow-2xl shadow-emerald-200 relative group-hover:scale-105 transition-all duration-500">
                                            <div className="absolute -top-3 -right-3 w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-emerald-600 border-4 border-emerald-50 shadow-md">
                                                <CheckCircle size={20} strokeWidth={3} />
                                            </div>
                                            <span className="text-white font-black text-4xl leading-none">{allData.length}</span>
                                            <span className="text-white/80 font-black text-[10px] uppercase tracking-widest mt-2">ماكينة POS</span>
                                        </div>
                                        <div className="text-right">
                                            <h3 className="text-2xl font-black text-slate-900 font-mono tracking-tighter truncate max-w-xs">{file?.name}</h3>
                                            <div className="flex items-center gap-4 mt-3">
                                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg border border-emerald-100 uppercase tracking-widest animate-pulse">
                                                    <LayoutDashboard size={12} />
                                                    Data Parsed Successfully
                                                </div>
                                                <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 uppercase tracking-widest">{(file?.size || 0 / 1024).toFixed(1)} KB</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="hidden sm:flex flex-col items-end gap-2 relative z-10">
                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] leading-none">Warehouse Status</span>
                                        <div className="h-10 px-6 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                            <span className="text-xs font-black text-slate-600">جاهز للاستيراد النهائي</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Data Sample Preview */}
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-8 leading-none">
                                    <Eye size={16} className="text-emerald-500" />
                                    عينة من البيانات المكتشفة (Data Preview Flow)
                                </label>
                                <div className="bg-white border-2 border-white rounded-[3rem] overflow-hidden shadow-2xl shadow-slate-200/20">
                                    <table className="w-full text-right border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/80">
                                                {COLUMNS.map(col => (
                                                    <th key={col.key} className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100/50">{col.header}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {preview.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-emerald-50/30 transition-all duration-300 group">
                                                    {COLUMNS.map(col => (
                                                        <td key={col.key} className="px-8 py-6">
                                                            <span className={cn(
                                                                "font-bold text-sm",
                                                                col.key === 'serialNumber' ? "font-mono text-slate-900 text-lg tracking-wider" : "text-slate-500"
                                                            )}>
                                                                {row[col.key] || <span className="text-slate-200 italic font-medium">Auto-fill</span>}
                                                            </span>
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Sticky Preview Actions */}
                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => setStep('select')}
                                    className="smart-btn-secondary h-20 px-12 border-2 border-slate-100 text-slate-500 font-black text-sm flex items-center gap-3 active:scale-95 transition-all"
                                >
                                    <X size={20} />
                                    إلغاء وتغيير الملف
                                </button>
                                <button
                                    onClick={handleConfirmImport}
                                    className="smart-btn-primary flex-1 h-20 bg-emerald-600 border-b-4 border-emerald-700 hover:bg-emerald-700 shadow-2xl shadow-emerald-100 text-white font-black text-xl flex items-center justify-center gap-4 active:scale-[0.98] transition-all"
                                >
                                    <CheckCircle size={28} strokeWidth={3} />
                                    بدء الاستيراد النهائي ({allData.length} سجلاً)
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'importing' && (
                        <div className="text-center py-20 flex flex-col items-center animate-in fade-in duration-700">
                            <div className="relative mb-20 group">
                                <div className="absolute inset-0 bg-emerald-400 rounded-full blur-[80px] opacity-10 animate-pulse scale-[2]"></div>
                                <div className="w-40 h-40 bg-white rounded-[3.5rem] border-8 border-slate-50 flex items-center justify-center relative shadow-2xl overflow-hidden group-hover:scale-110 transition-transform duration-1000">
                                    <Loader2 className="text-emerald-600 animate-[spin_3s_linear_infinite]" size={72} strokeWidth={3} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/10 to-transparent"></div>
                                </div>
                            </div>

                            <h3 className="text-4xl font-black text-slate-900 mb-4 font-mono tracking-tighter">جاري التكامل مع قاعدة البيانات</h3>
                            <p className="text-slate-500 font-bold mb-16 text-lg">يرجى عدم إغلاق النافذة، نقوم بتسجيل {allData.length} وحدة تشغيلية الآن...</p>

                            <div className="w-full max-w-xl bg-white p-4 rounded-[2.5rem] border-2 border-slate-100 shadow-2xl shadow-slate-200/50 relative overflow-hidden">
                                <div className="bg-slate-50 rounded-2xl h-14 overflow-hidden relative border border-slate-100 shadow-inner">
                                    <div
                                        className="bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-700 h-full transition-all duration-1000 rounded-2xl flex items-center justify-end px-6 relative overflow-hidden shadow-lg"
                                        style={{ width: `${progress}%` }}
                                    >
                                        <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:40px_40px] animate-[shimmer_2s_linear_infinite]"></div>
                                        <span className="text-lg font-black text-white shrink-0 relative z-10 font-mono italic">{progress}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'result' && (
                        <div className="animate-in fade-in zoom-in-95 duration-700">
                            {result?.error ? (
                                <div className="text-center py-16 flex flex-col items-center">
                                    <div className="w-36 h-36 bg-red-50 text-red-500 rounded-[3.5rem] flex items-center justify-center border-4 border-red-100 mx-auto mb-10 shadow-3xl shadow-red-100/50 animate-bounce">
                                        <XCircle size={72} strokeWidth={3} />
                                    </div>
                                    <h3 className="text-4xl font-black text-red-600 mb-6 font-mono tracking-tighter">فشل عملية الاستيراد</h3>
                                    <p className="text-slate-600 font-bold max-w-lg mx-auto leading-relaxed text-xl">{result.error}</p>

                                    <button
                                        onClick={() => setStep('preview')}
                                        className="mt-16 smart-btn-primary h-20 bg-slate-900 border-b-4 border-black hover:bg-slate-800 text-white px-20 text-xl font-black shadow-2xl active:scale-95 transition-all"
                                    >
                                        العودة للمعاينة والتصحيح
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-12">
                                    <div className="text-center relative">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-400 rounded-full blur-[100px] opacity-10 pointer-events-none"></div>
                                        <div className="w-40 h-40 bg-emerald-50 text-emerald-500 rounded-[4rem] flex items-center justify-center border-4 border-emerald-100 mx-auto mb-10 shadow-3xl shadow-emerald-100 animate-in zoom-in spin-in-12 duration-1000 relative z-10">
                                            <CheckCircle size={80} strokeWidth={3} />
                                        </div>
                                        <h3 className="text-5xl font-black text-slate-900 tracking-tighter relative z-10">تم الاستيراد بنجاح!</h3>
                                        <p className="text-slate-500 font-bold mt-4 text-xl relative z-10">تمت هيكلة المخزون بجميع البيانات الجديدة بنجاح فائق</p>
                                    </div>

                                    {/* Scoreboard Metrics */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
                                        <div className="relative group">
                                            <div className="absolute -inset-1 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-[3.5rem] blur opacity-15 group-hover:opacity-40 transition duration-700"></div>
                                            <div className="relative bg-white border-2 border-emerald-100/50 p-12 rounded-[3.5rem] text-center shadow-xl shadow-emerald-50 transition-all duration-500 hover:-translate-y-2">
                                                <div className="absolute top-6 right-6 p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shadow-sm"><BarChart3 size={24} strokeWidth={2.5} /></div>
                                                <div className="text-7xl font-black text-emerald-600 mb-3 font-mono tracking-tighter">{result?.success || 0}</div>
                                                <div className="text-[12px] font-black text-emerald-700 uppercase tracking-[0.2em] bg-emerald-100/50 px-6 py-2 rounded-2xl inline-block border border-emerald-200/50">Accepted Units</div>
                                            </div>
                                        </div>

                                        <div className={cn(
                                            "relative group transition-all duration-700",
                                            result?.failed > 0 ? "opacity-100" : "opacity-30 grayscale saturate-0"
                                        )}>
                                            <div className="absolute -inset-1 bg-gradient-to-br from-red-500 to-orange-600 rounded-[3.5rem] blur opacity-15 group-hover:opacity-40 transition duration-700"></div>
                                            <div className={cn(
                                                "relative p-12 rounded-[3.5rem] text-center shadow-xl transition-all duration-500 border-2",
                                                result?.failed > 0 ? "bg-white border-red-100 shadow-red-50" : "bg-slate-50 border-slate-100 shadow-none grayscale"
                                            )}>
                                                <div className={cn("absolute top-6 right-6 p-3 rounded-2xl border shadow-sm", result?.failed > 0 ? "bg-red-50 text-red-600 border-red-100" : "bg-slate-100 text-slate-400 border-slate-200")}><AlertCircle size={24} strokeWidth={2.5} /></div>
                                                <div className={cn("text-7xl font-black mb-3 font-mono tracking-tighter transition-colors", result?.failed > 0 ? "text-red-500" : "text-slate-400")}>{result?.failed || 0}</div>
                                                <div className={cn("text-[12px] font-black uppercase tracking-[0.2em] px-6 py-2 rounded-2xl inline-block border", result?.failed > 0 ? "bg-red-100/50 text-red-700 border-red-200/50" : "bg-slate-200 text-slate-400 border-slate-300")}>Declined Logs</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detailed Conflict Log */}
                                    {result?.errors && result.errors.length > 0 && (
                                        <div className="bg-red-50/20 border-2 border-red-100/30 p-10 rounded-[4rem] group hover:bg-red-50/50 transition-all duration-700 animate-in slide-in-from-bottom-8">
                                            <div className="flex items-center gap-5 mb-10">
                                                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center shadow-xl shadow-red-100 border-4 border-white"><AlertCircle size={32} strokeWidth={3} /></div>
                                                <div className="text-right">
                                                    <h4 className="text-2xl font-black text-red-900 tracking-tight leading-none">سجل التعارض الجوهري</h4>
                                                    <p className="text-red-600/60 font-black text-[10px] uppercase tracking-[0.2em] mt-3">Critical conflicts detected during synchronization</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[360px] overflow-y-auto custom-scroll pr-2 pl-4">
                                                {result.errors.map((err: any, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-5 p-6 bg-white rounded-[2.5rem] border border-red-100 hover:border-red-500 transition-all duration-500 group/item shadow-sm hover:shadow-xl hover:shadow-red-50">
                                                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center font-black text-sm group-hover/item:bg-red-600 group-hover/item:text-white transition-all duration-500 border border-red-100 shadow-inner group-hover/item:scale-110">{idx + 1}</div>
                                                        <div className="flex-1 overflow-hidden text-right">
                                                            <div className="font-mono font-black text-base text-slate-900 tracking-wider truncate mb-1">{err.serial}</div>
                                                            <div className="text-[11px] font-black text-red-500 line-clamp-1 italic">{err.error}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleClose}
                                        className="smart-btn-primary w-full h-22 bg-slate-950 border-b-4 border-black hover:bg-slate-900 text-white font-black text-2xl shadow-3xl transition-all active:scale-[0.98] mt-4 rounded-3xl flex items-center justify-center gap-4"
                                    >
                                        <Inbox size={28} strokeWidth={3} />
                                        إغلاق والعودة للسجلات
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}



