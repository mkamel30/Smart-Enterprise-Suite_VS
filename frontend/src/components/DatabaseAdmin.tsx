import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Plus, RefreshCw, Database, ChevronDown, HardDrive, Download, Upload, AlertTriangle } from 'lucide-react';
import { api } from '../api/client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Table {
    name: string;
    label: string;
}

interface Backup {
    filename: string;
    size: number;
    createdAt: string;
}

export function DatabaseAdmin() {
    const [tables, setTables] = useState<Table[]>([]);
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newRecord, setNewRecord] = useState<string>('{}');
    const [error, setError] = useState<string>('');

    // Backup state
    const [backups, setBackups] = useState<Backup[]>([]);
    const [backupLoading, setBackupLoading] = useState(false);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState<string | null>(null);

    // Fetch tables list
    useEffect(() => {
        fetch(`${API_URL}/db/tables`)
            .then(res => res.json())
            .then(data => {
                // Ensure data is an array before setting
                if (Array.isArray(data)) {
                    setTables(data);
                } else {
                    console.error('Invalid tables response:', data);
                    setTables([]);
                }
            })
            .catch(err => {
                console.error('Failed to fetch tables:', err);
                setTables([]);
            });

        // Load backups on mount
        loadBackups();
    }, []);

    // Load backups
    const loadBackups = async () => {
        try {
            const data = await api.listBackups();
            setBackups(data);
        } catch (error) {
            console.error('Failed to load backups:', error);
        }
    };

    // Create backup
    const handleCreateBackup = async () => {
        setBackupLoading(true);
        try {
            await api.createBackup();
            toast.success('تم إنشاء النسخة الاحتياطية بنجاح');
            await loadBackups();
        } catch (error: any) {
            toast.error(error.message || 'فشل إنشاء النسخة الاحتياطية');
        } finally {
            setBackupLoading(false);
        }
    };

    // Restore backup
    const handleRestoreBackup = async (filename: string) => {
        try {
            await api.restoreBackup(filename);
            toast.success('تم استرجاع النسخة الاحتياطية. يرجى إعادة تشغيل السيرفر.');
            setShowRestoreConfirm(null);
        } catch (error: any) {
            toast.error(error.message || 'فشل استرجاع النسخة الاحتياطية');
        }
    };

    // Delete backup
    const handleDeleteBackup = async (filename: string) => {
        if (!confirm('هل أنت متأكد من حذف هذه النسخة؟')) return;

        try {
            await api.deleteBackup(filename);
            toast.success('تم حذف النسخة الاحتياطية');
            await loadBackups();
        } catch (error: any) {
            toast.error(error.message || 'فشل حذف النسخة الاحتياطية');
        }
    };

    // Format file size
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    // Format date
    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleString('ar-EG');
    };


    // Fetch records when table changes
    useEffect(() => {
        if (selectedTable) {
            loadRecords();
        }
    }, [selectedTable]);

    const loadRecords = async () => {
        if (!selectedTable) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/db/${selectedTable}`);
            const data = await res.json();
            // Ensure data is an array
            if (Array.isArray(data)) {
                setRecords(data);
            } else {
                console.error('Invalid records response:', data);
                setRecords([]);
                setError(data.error || 'فشل تحميل البيانات');
            }
        } catch (err) {
            setError('فشل تحميل البيانات');
            setRecords([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('هل أنت متأكد من الحذف؟')) return;

        try {
            const res = await fetch(`${API_URL}/db/${selectedTable}/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                loadRecords();
            } else {
                const data = await res.json();
                toast.error(data.error || 'فشل الحذف');
            }
        } catch (err) {
            toast.error('فشل الحذف');
        }
    };

    const handleAdd = async () => {
        try {
            const data = JSON.parse(newRecord);
            const res = await fetch(`${API_URL}/db/${selectedTable}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                setShowAddForm(false);
                setNewRecord('{}');
                loadRecords();
            } else {
                const err = await res.json();
                toast.error(err.error || 'فشل الإضافة');
            }
        } catch (err: any) {
            toast.error('خطأ في صيغة JSON: ' + err.message);
        }
    };

    const getColumns = () => {
        if (records.length === 0) return [];
        return Object.keys(records[0]).slice(0, 8); // Show first 8 columns
    };

    const formatValue = (value: any) => {
        if (value === null || value === undefined) return '-';
        if (typeof value === 'object') return JSON.stringify(value).substring(0, 50) + '...';
        if (typeof value === 'string' && value.length > 50) return value.substring(0, 50) + '...';
        return String(value);
    };

    return (
        <div className="space-y-6">
            {/* Backup Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <HardDrive size={20} className="text-blue-600" />
                        <h3 className="font-bold text-lg">النسخ الاحتياطي</h3>
                    </div>
                    <button
                        onClick={handleCreateBackup}
                        disabled={backupLoading}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
                    >
                        <Download size={16} />
                        {backupLoading ? 'جاري النسخ...' : 'نسخ احتياطي الآن'}
                    </button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                    <p className="text-blue-800">
                        💡 يتم إنشاء نسخة احتياطية يومياً الساعة 2:00 صباحاً تلقائياً. النسخ القديمة أكثر من 30 يوم يتم حذفها تلقائياً.
                    </p>
                </div>

                {/* Backups List */}
                {backups.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                        <div className="bg-slate-100 p-2 text-sm font-medium">
                            النسخ المتاحة ({backups.length})
                        </div>
                        <div className="divide-y">
                            {backups.map(backup => (
                                <div key={backup.filename} className="p-3 hover:bg-slate-50 flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{backup.filename}</div>
                                        <div className="text-xs text-slate-500">
                                            {formatDate(backup.createdAt)} • {formatSize(backup.size)}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowRestoreConfirm(backup.filename)}
                                            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700"
                                        >
                                            <Upload size={14} />
                                            استرجاع
                                        </button>
                                        <button
                                            onClick={() => handleDeleteBackup(backup.filename)}
                                            className="text-red-600 hover:bg-red-50 p-1.5 rounded"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-6 text-slate-500 text-sm">
                        لا توجد نسخ احتياطية متاحة
                    </div>
                )}
            </div>

            {/* Restore Confirmation Dialog */}
            {showRestoreConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <div className="flex items-center gap-2 text-orange-600 mb-4">
                            <AlertTriangle size={24} />
                            <h3 className="font-bold text-lg">تحذير!</h3>
                        </div>
                        <p className="mb-4">
                            استرجاع النسخة الاحتياطية سيستبدل قاعدة البيانات الحالية بالكامل.
                            سيتم إنشاء نسخة احتياطية تلقائية قبل الاسترجاع للحفاظ على البيانات الحالية.
                        </p>
                        <p className="mb-6 font-bold">هل تريد المتابعة؟</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleRestoreBackup(showRestoreConfirm)}
                                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
                            >
                                نعم، استرجع
                            </button>
                            <button
                                onClick={() => setShowRestoreConfirm(null)}
                                className="flex-1 border py-2 rounded-lg hover:bg-slate-50"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Divider */}
            <hr className="border-slate-200" />

            {/* Database Admin Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Database size={20} className="text-slate-600" />
                        <h3 className="font-bold text-lg">إدارة قاعدة البيانات</h3>
                    </div>
                    <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                        ⚠️ استخدم بحذر - للمطورين فقط
                    </div>
                </div>

                {/* Table Selector */}
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">اختر الجدول</label>
                        <div className="relative">
                            <select
                                value={selectedTable}
                                onChange={(e) => setSelectedTable(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 appearance-none"
                            >
                                <option value="">-- اختر جدول --</option>
                                {tables.map(t => (
                                    <option key={t.name} value={t.name}>{t.label} ({t.name})</option>
                                ))}
                            </select>
                            <ChevronDown size={16} className="absolute left-3 top-3 text-slate-400" />
                        </div>
                    </div>

                    {selectedTable && (
                        <>
                            <button
                                onClick={loadRecords}
                                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-slate-50"
                            >
                                <RefreshCw size={16} />
                                تحديث
                            </button>
                            <button
                                onClick={() => setShowAddForm(!showAddForm)}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg"
                            >
                                <Plus size={16} />
                                إضافة
                            </button>
                        </>
                    )}
                </div>

                {/* Add Form */}
                {showAddForm && (
                    <div className="bg-slate-50 border rounded-lg p-4">
                        <label className="block text-sm font-medium mb-1">بيانات السجل (JSON)</label>
                        <textarea
                            value={newRecord}
                            onChange={(e) => setNewRecord(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                            rows={4}
                            placeholder='{"field": "value"}'
                        />
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={handleAdd}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg"
                            >
                                حفظ
                            </button>
                            <button
                                onClick={() => setShowAddForm(false)}
                                className="px-4 py-2 border rounded-lg"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>
                )}

                {/* Records Table */}
                {selectedTable && !loading && records.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                        <div className="bg-slate-100 p-2 text-sm">
                            إجمالي: {records.length} سجل
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        {getColumns().map(col => (
                                            <th key={col} className="text-right p-2 border-b font-medium">{col}</th>
                                        ))}
                                        <th className="p-2 border-b w-16">حذف</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map((record, i) => (
                                        <tr key={record.id || i} className="border-b hover:bg-slate-50">
                                            {getColumns().map(col => (
                                                <td key={col} className="p-2 max-w-xs truncate">
                                                    {formatValue(record[col])}
                                                </td>
                                            ))}
                                            <td className="p-2">
                                                <button
                                                    onClick={() => handleDelete(record.id)}
                                                    className="text-red-600 hover:bg-red-50 p-1 rounded"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="text-center py-8 text-slate-500">جاري التحميل...</div>
                )}

                {/* No Records */}
                {selectedTable && !loading && records.length === 0 && (
                    <div className="text-center py-8 text-slate-500">لا توجد سجلات</div>
                )}
            </div>
        </div>
    );
}
