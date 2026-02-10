import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Plus, Download, Upload, FileSpreadsheet, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApiMutation } from '../hooks/useApiMutation';
import toast from 'react-hot-toast';
import ImportModal from '../components/ImportModal';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import PageHeader from '../components/PageHeader';

// Modular Components
import { SimStatsCards } from '../components/sim/SimStatsCards';
import { SimTypeBreakdown } from '../components/sim/SimTypeBreakdown';
import { SimTabs } from '../components/sim/SimTabs';
import { SimFilters } from '../components/sim/SimFilters';
import { SimTable } from '../components/sim/SimTable';
import { SimFormModal } from '../components/sim/SimFormModal';
import { SimTransferModal } from '../components/sim/SimTransferModal';

interface WarehouseSim {
    id: string;
    serialNumber: string;
    type: string | null;
    status: string;
    notes: string | null;
    importDate: string;
}

export default function SimWarehouse() {
    const { user, activeBranchId } = useAuth();
    const isAdmin = !user?.branchId;
    const isAffairs = user?.role === 'ADMIN_AFFAIRS';
    const queryClient = useQueryClient();

    const [filterBranchId, setFilterBranchId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editingSim, setEditingSim] = useState<WarehouseSim | null>(null);
    const [activeTab, setActiveTab] = useState<'ACTIVE' | 'DEFECTIVE' | 'IN_TRANSIT'>('ACTIVE');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [selectedSims, setSelectedSims] = useState<Set<string>>(new Set());
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferTargetBranch, setTransferTargetBranch] = useState('');
    const [transferNotes, setTransferNotes] = useState('');

    const [formData, setFormData] = useState({
        serialNumber: '',
        type: '',
        status: 'ACTIVE',
        notes: '',
        branchId: ''
    });

    // Queries
    const { data: sims, isLoading } = useQuery<WarehouseSim[]>({
        queryKey: ['warehouse-sims', activeBranchId, filterBranchId],
        queryFn: () => api.getWarehouseSims(activeBranchId || filterBranchId)
    });

    const { data: counts } = useQuery({
        queryKey: ['warehouse-sims-counts', activeBranchId, filterBranchId],
        queryFn: () => api.getWarehouseSimCounts(activeBranchId || filterBranchId)
    });

    const { data: branches } = useQuery({
        queryKey: ['branches'],
        queryFn: () => api.getActiveBranches(),
        enabled: isAdmin || isAffairs,
        staleTime: 1000 * 60 * 60
    });

    // Mutations
    const createMutation = useApiMutation({
        mutationFn: (data: any) => api.createWarehouseSim(data),
        successMessage: 'تم إضافة الشريحة بنجاح',
        errorMessage: 'فشل إضافة الشريحة',
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['warehouse-sims'] });
            await queryClient.invalidateQueries({ queryKey: ['warehouse-sims-counts'] });
            setShowAddModal(false);
            resetForm();
        }
    });

    const updateMutation = useApiMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.updateWarehouseSim(id, data),
        successMessage: 'تم تحديث الشريحة بنجاح',
        errorMessage: 'فشل تحديث الشريحة',
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['warehouse-sims'] });
            await queryClient.invalidateQueries({ queryKey: ['warehouse-sims-counts'] });
            setEditingSim(null);
            setShowAddModal(false);
            resetForm();
        }
    });

    const deleteMutation = useApiMutation({
        mutationFn: (id: string) => api.deleteWarehouseSim(id),
        successMessage: 'تم حذف الشريحة',
        errorMessage: 'فشل حذف الشريحة',
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['warehouse-sims'] });
            await queryClient.invalidateQueries({ queryKey: ['warehouse-sims-counts'] });
        }
    });

    const transferMutation = useApiMutation({
        mutationFn: (data: any) => api.transferWarehouseSims(data),
        successMessage: 'تم إنشاء إذن النقل بنجاح',
        errorMessage: 'فشل إنشاء إذن النقل',
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['warehouse-sims'] });
            await queryClient.invalidateQueries({ queryKey: ['warehouse-sims-counts'] });
            setShowTransferModal(false);
            setSelectedSims(new Set());
            setTransferTargetBranch('');
            setTransferNotes('');
        }
    });

    const resetForm = () => {
        setFormData({
            serialNumber: '',
            type: '',
            status: 'ACTIVE',
            notes: '',
            branchId: ''
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingSim) {
            updateMutation.mutate({ id: editingSim.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleEdit = (sim: WarehouseSim) => {
        setEditingSim(sim);
        setFormData({
            serialNumber: sim.serialNumber,
            type: sim.type || '',
            status: sim.status,
            notes: sim.notes || '',
            branchId: ''
        });
        setShowAddModal(true);
    };

    const handleDownloadTemplate = async () => {
        try {
            const blob = await api.getWarehouseSimTemplate();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'warehouse_sims_import.xlsx';
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast.error('فشل تحميل القالب');
        }
    };

    const handleExport = async () => {
        try {
            const blob = await api.exportWarehouseSims();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sim_warehouse_${new Date().toISOString().slice(0, 10)}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success('تم تصدير البيانات بنجاح');
        } catch (error) {
            toast.error('فشل تصدير البيانات');
        }
    };

    const filteredSims = sims?.filter(sim => {
        const matchesSearch = !searchTerm ||
            sim.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sim.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sim.notes?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTab = sim.status === activeTab;
        const matchesType = !typeFilter || sim.type === typeFilter;
        return matchesSearch && matchesTab && matchesType;
    }) || [];

    const toggleSelectAll = () => {
        if (selectedSims.size === filteredSims.length) {
            setSelectedSims(new Set());
        } else {
            setSelectedSims(new Set(filteredSims.map(s => s.id)));
        }
    };

    const toggleSelectSim = (id: string) => {
        const newSelected = new Set(selectedSims);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedSims(newSelected);
    };

    const actionElements = (
        <div className="flex flex-wrap gap-2">
            {selectedSims.size > 0 && isAffairs ? (
                <button
                    onClick={() => setShowTransferModal(true)}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#6CE4F0] to-[#6CE4F0]/90 text-primary rounded-xl font-black shadow-lg hover:opacity-90 transition-all active:scale-95"
                >
                    <Plus size={18} />
                    <span>إنشاء إذن نقل ({selectedSims.size})</span>
                </button>
            ) : (
                <>
                    <button
                        onClick={() => { resetForm(); setEditingSim(null); setShowAddModal(true); }}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#7E5BAB] to-[#7E5BAB]/90 text-white rounded-xl font-black shadow-lg hover:opacity-90 transition-all active:scale-95"
                    >
                        <Plus size={18} />
                        <span>إضافة شريحة</span>
                    </button>
                    <DropdownMenu>
                        <DropdownMenuTrigger className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all outline-none">
                            <FileSpreadsheet size={18} className="text-emerald-600" />
                            عمليات Excel
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white rounded-xl p-2 shadow-xl border-2 border-slate-100 min-w-[200px] z-[100]">
                            <DropdownMenuItem onClick={handleDownloadTemplate} className="rounded-lg gap-3 cursor-pointer py-2.5 font-medium hover:bg-slate-50 focus:bg-slate-50">
                                <Download size={16} className="text-slate-500" />
                                تحميل القالب
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowImportModal(true)} className="rounded-lg gap-3 cursor-pointer py-2.5 font-medium hover:bg-slate-50 focus:bg-slate-50">
                                <Upload size={16} className="text-blue-500" />
                                استيراد
                            </DropdownMenuItem>
                            <div className="h-px bg-slate-100 my-1" />
                            <DropdownMenuItem onClick={handleExport} className="rounded-lg gap-3 cursor-pointer py-2.5 font-medium hover:bg-slate-50 focus:bg-slate-50 text-emerald-700">
                                <Download size={16} />
                                تصدير
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </>
            )}
        </div>
    );

    return (
        <div className="px-4 lg:px-8 pt-4 pb-8 animate-fade-in bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen" dir="rtl">
            <PageHeader
                title={isAffairs ? 'المخزن الرئيسي للشرائح' : 'مخزن الشرائح'}
                subtitle={isAffairs ? 'إدارة وتوزيع شرائح البيانات للفروع' : 'إدارة المخزون المحلي من شرائح البيانات'}
                actions={actionElements}
            />

            <SimStatsCards counts={counts} />

            <SimTypeBreakdown
                counts={counts}
                typeFilter={typeFilter}
                setTypeFilter={setTypeFilter}
            />

            <SimTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                counts={counts}
            />

            <SimFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                isAdmin={isAdmin}
                filterBranchId={filterBranchId}
                onBranchChange={setFilterBranchId}
                branches={branches as any[]}
            />

            <SimTable
                isLoading={isLoading}
                sims={filteredSims}
                selectedSims={selectedSims}
                toggleSelectAll={toggleSelectAll}
                toggleSelectSim={toggleSelectSim}
                onEdit={handleEdit}
                onDelete={(id) => {
                    if (confirm('هل أنت متأكد من حذف هذه الشريحة؟')) {
                        deleteMutation.mutate(id);
                    }
                }}
            />

            <ImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                title="استيراد شرائح للمخزن"
                onImport={(file) => api.importWarehouseSims(file, filterBranchId)}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['warehouse-sims'] });
                    queryClient.invalidateQueries({ queryKey: ['warehouse-sims-counts'] });
                }}
                columns={[
                    { header: 'مسلسل الشريحة', key: 'serialNumber' },
                    { header: 'نوع الشريحة', key: 'type' },
                    { header: 'الحالة', key: 'status' },
                    { header: 'ملاحظات', key: 'notes' }
                ]}
            />

            <SimFormModal
                isOpen={showAddModal}
                onClose={() => { setShowAddModal(false); setEditingSim(null); resetForm(); }}
                editingSim={editingSim}
                formData={formData}
                setFormData={setFormData}
                handleSubmit={handleSubmit}
                isAdmin={isAdmin}
                branches={branches as any[]}
                isPending={createMutation.isPending || updateMutation.isPending}
            />

            <SimTransferModal
                isOpen={showTransferModal}
                onClose={() => setShowTransferModal(false)}
                selectedCount={selectedSims.size}
                transferTargetBranch={transferTargetBranch}
                setTransferTargetBranch={setTransferTargetBranch}
                transferNotes={transferNotes}
                setTransferNotes={setTransferNotes}
                branches={branches as any[]}
                onTransfer={() => transferMutation.mutate({
                    simIds: Array.from(selectedSims),
                    targetBranchId: transferTargetBranch,
                    notes: transferNotes
                })}
                isPending={transferMutation.isPending}
            />
        </div>
    );
}
