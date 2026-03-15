import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Plus, Download, Upload, FileSpreadsheet, Smartphone, Filter } from 'lucide-react';
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
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { isGlobalRole } from '../lib/permissions';

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
    networkType: string | null;
    status: string;
    notes: string | null;
    importDate: string;
    branchId?: string;
}

export default function SimWarehouse() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || !user?.branchId;
    const queryClient = useQueryClient();

    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBranchId, setFilterBranchId] = useState('');
    const [activeTab, setActiveTab] = useState('ALL');
    const [typeFilter, setTypeFilter] = useState('');
    const [selectedSims, setSelectedSims] = useState<Set<string>>(new Set());

    // Modals State
    const [showAddModal, setShowAddModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [editingSim, setEditingSim] = useState<WarehouseSim | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        serialNumber: '',
        type: '',
        networkType: '',
        status: 'ACTIVE',
        notes: '',
        branchId: ''
    });

    // Transfer State
    const [transferTargetBranch, setTransferTargetBranch] = useState('');
    const [transferNotes, setTransferNotes] = useState('');

    // Queries
    const { data: branches } = useQuery({
        queryKey: ['branches'],
        queryFn: api.getBranches,
        enabled: isAdmin
    });

    const { data: sims = [], isLoading } = useQuery({
        queryKey: ['warehouse-sims', filterBranchId, activeTab],
        queryFn: () => api.getWarehouseSims(filterBranchId, activeTab)
    });

    const { data: stats } = useQuery({
        queryKey: ['warehouse-sims-stats', filterBranchId],
        queryFn: () => api.getWarehouseSimCounts(filterBranchId)
    });

    // Mutations
    const createMutation = useApiMutation({
        mutationFn: (data: any) => api.createWarehouseSim(data),
        successMessage: 'تم إضافة الشريحة بنجاح',
        invalidateKeys: [['warehouse-sims'], ['warehouse-sims-stats']],
        onSuccess: () => {
            setShowAddModal(false);
            resetForm();
        }
    });

    const updateMutation = useApiMutation({
        mutationFn: (data: any) => api.updateWarehouseSim(editingSim!.id, data),
        successMessage: 'تم تحديث الشريحة بنجاح',
        invalidateKeys: [['warehouse-sims'], ['warehouse-sims-stats']],
        onSuccess: () => {
            setShowAddModal(false);
            setEditingSim(null);
            resetForm();
        }
    });

    const deleteMutation = useApiMutation({
        mutationFn: (id: string) => api.deleteWarehouseSim(id),
        successMessage: 'تم حذف الشريحة بنجاح',
        invalidateKeys: [['warehouse-sims'], ['warehouse-sims-stats']]
    });

    const transferMutation = useApiMutation({
        mutationFn: (data: any) => api.transferWarehouseSims(data),
        successMessage: 'تم نقل الشرائح بنجاح',
        invalidateKeys: [['warehouse-sims'], ['warehouse-sims-stats']],
        onSuccess: () => {
            setShowTransferModal(false);
            setSelectedSims(new Set());
            setTransferTargetBranch('');
            setTransferNotes('');
        }
    });

    // Handlers
    const resetForm = () => {
        setFormData({
            serialNumber: '',
            type: '',
            networkType: '',
            status: 'ACTIVE',
            notes: '',
            branchId: ''
        });
    };

    const handleEdit = (sim: WarehouseSim) => {
        setEditingSim(sim);
        setFormData({
            serialNumber: sim.serialNumber,
            type: sim.type || '',
            networkType: sim.networkType || '',
            status: sim.status,
            notes: sim.notes || '',
            branchId: sim.branchId || ''
        });
        setShowAddModal(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('هل أنت متأكد من حذف هذه الشريحة؟')) {
            deleteMutation.mutate(id);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingSim) {
            updateMutation.mutate(formData);
        } else {
            createMutation.mutate({ ...formData, branchId: filterBranchId || user?.branchId });
        }
    };

    const toggleSelectAll = () => {
        if (selectedSims.size === sims.length) {
            setSelectedSims(new Set());
        } else {
            setSelectedSims(new Set(sims.map((s: any) => s.id)));
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

    const handleExport = async () => {
        try {
            await api.exportWarehouseSims(filterBranchId);
            toast.success('تم تصدير البيانات بنجاح');
        } catch (error) {
            toast.error('فشل تصدير البيانات');
        }
    };

    // Filtered Sims
    const safeSims = Array.isArray(sims) ? sims : [];
    const filteredSims = safeSims.filter((sim: WarehouseSim) =>
        (sim.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (sim.type && sim.type.toLowerCase().includes(searchTerm.toLowerCase()))) &&
        (!typeFilter || sim.type === typeFilter)
    );

    const safeBranches = Array.isArray(branches) ? branches : [];
    const isAdminOrHQ = isAdmin || isGlobalRole(user?.role);

    return (
        <div className="px-8 pt-4 pb-8 space-y-8 max-w-[1600px] mx-auto bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen" dir="rtl">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-3xl lg:text-4xl font-black text-[#0A2472] tracking-tight">
                        مخزن الشرائح
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">إدارة ومراقبة حركة مخزون شرائح الاتصال</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    {selectedSims.size > 0 && (isAdmin || user?.role === 'STOCK_MANAGER') && (
                        <Button
                            onClick={() => setShowTransferModal(true)}
                            className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-4 py-6 font-bold shadow-xl shadow-amber-200 transition-all gap-2 animate-in slide-in-from-right-4"
                        >
                            <Upload size={18} />
                            نقل ({selectedSims.size})
                        </Button>
                    )}

                    <Button
                        onClick={handleExport}
                        variant="outline"
                        className="flex-1 lg:flex-none bg-white border-slate-200 text-slate-700 rounded-xl px-6 py-6 font-bold shadow-sm hover:bg-slate-50 transition-all gap-2"
                    >
                        <Download size={20} />
                        تصدير
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="flex-1 lg:flex-none bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl px-6 py-6 font-black shadow-xl transition-all gap-2">
                                <Plus size={20} />
                                <span className="whitespace-nowrap">إضافة شرائح</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl border-slate-200 shadow-xl p-2 min-w-[200px]">
                            <DropdownMenuItem
                                className="rounded-lg font-medium p-3 cursor-pointer hover:bg-slate-50 gap-2"
                                onClick={() => {
                                    setEditingSim(null);
                                    resetForm();
                                    setShowAddModal(true);
                                }}
                            >
                                <Plus className="h-4 w-4 text-indigo-600" />
                                إضافة يدوية
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="rounded-lg font-medium p-3 cursor-pointer hover:bg-slate-50 gap-2"
                                onClick={() => setShowImportModal(true)}
                            >
                                <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
                                استيراد من Excel
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <SimStatsCards counts={stats} />

            <div className="bg-white/40 backdrop-blur-xl border border-slate-200 rounded-3xl p-6 shadow-sm overflow-hidden">
                <SimTabs
                    activeTab={activeTab as any}
                    setActiveTab={setActiveTab}
                    counts={stats}
                />

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div className="lg:col-span-3 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex flex-wrap items-center gap-4 mb-2">
                            <div className="flex-1 min-w-[300px]">
                                <SimFilters
                                    searchTerm={searchTerm}
                                    onSearchChange={setSearchTerm}
                                    isAdmin={isAdminOrHQ}
                                    filterBranchId={filterBranchId}
                                    onBranchChange={setFilterBranchId}
                                    branches={safeBranches}
                                />
                            </div>
                        </div>

                        <SimTable
                            isLoading={isLoading}
                            sims={filteredSims}
                            selectedSims={selectedSims}
                            toggleSelectAll={toggleSelectAll}
                            toggleSelectSim={toggleSelectSim}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                        />
                    </div>

                    <div className="lg:col-span-1 animate-in fade-in slide-in-from-left-2 duration-500">
                        <SimTypeBreakdown
                            counts={stats}
                            typeFilter={typeFilter}
                            setTypeFilter={setTypeFilter}
                        />
                    </div>
                </div>
            </div>

            <ImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                title="استيراد شرائح للمخزن"
                onImport={(file) => api.importWarehouseSims(file, filterBranchId)}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['warehouse-sims'] });
                    queryClient.invalidateQueries({ queryKey: ['warehouse-sims-stats'] });
                }}
                columns={[
                    { header: 'مسلسل الشريحة', key: 'serialNumber' },
                    { header: 'الشركة (Type)', key: 'type' },
                    { header: 'الشبكة (Network)', key: 'networkType' },
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
                isAdmin={isAdminOrHQ}
                branches={safeBranches}
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
                branches={safeBranches}
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
