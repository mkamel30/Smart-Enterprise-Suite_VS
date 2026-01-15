import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Monitor, RotateCcw, AlertTriangle, Wrench, FileClock, Plus, Filter, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { openReplacementReport, openSaleReport, openReturnReport } from '../components/PrintReport';
import { useApiMutation } from '../hooks/useApiMutation';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { DataTable } from '../components/ui/data-table';
import { cn } from '../lib/utils';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { getMachineColumns } from '../components/warehouse/MachineWarehouseColumns';

import MaintenanceKanban from '../components/warehouse/MaintenanceKanban';
import { AddMachineModal } from '../components/warehouse/AddMachineModal';
import { MachineExchangeModal } from '../components/warehouse/MachineExchangeModal';
import { MachineSaleModal } from '../components/warehouse/MachineSaleModal';
import { MachineRepairModal } from '../components/warehouse/MachineRepairModal';
import { MachineReturnToCustomerModal } from '../components/warehouse/MachineReturnToCustomerModal';
import { MachineLogsTable } from '../components/warehouse/MachineLogsTable';
import { MachineImportExport } from '../components/warehouse/MachineImportExport';
import { TransferMachinesModal } from '../components/warehouse/TransferMachinesModal';
import { MaintenanceTransferModal } from '../components/warehouse/MaintenanceTransferModal';
import { MachineWarehouseStats } from '../components/warehouse/MachineWarehouseStats';
import { MachineImportModal } from '../components/warehouse/MachineImportModal';

export default function MachineWarehouse() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Auth & Permissions
    const isAdmin = !user?.branchId;
    const isAffairs = user?.role === 'ADMIN_AFFAIRS';
    const isCenterManager = user?.role === 'CENTER_MANAGER';
    const performedBy = user?.displayName || user?.email || 'System';

    // UI state
    // 'WORKFLOW' added to the type union
    const [activeTab, setActiveTab] = useState<'NEW' | 'STANDBY' | 'DEFECTIVE' | 'CLIENT_REPAIR' | 'LOGS' | 'WORKFLOW'>('NEW');
    const [filterBranchId, setFilterBranchId] = useState('');
    const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
    const [logSearchTerm, setLogSearchTerm] = useState('');

    // Modal visibility handlers
    const [modals, setModals] = useState({
        exchange: false,
        repair: false,
        return: false,
        returnToCustomer: false,
        parameter: false,
        maintenanceTransfer: false,
        add: false,
        sale: false,
        transfer: false,
        unknownModel: false,
        import: false
    });
    const [selectedItem, setSelectedItem] = useState<any>(null);

    const isWorkflowTab = activeTab === 'WORKFLOW';
    const isLogsTab = activeTab === 'LOGS';

    // Queries
    const { data: machines, isLoading: machinesLoading } = useQuery({
        queryKey: ['warehouse-machines', activeTab, filterBranchId],
        queryFn: () => api.getWarehouseMachines(activeTab, filterBranchId),
        enabled: !isLogsTab && !isWorkflowTab
    });

    const { data: logs, isLoading: logsLoading } = useQuery({
        queryKey: ['warehouse-logs', filterBranchId],
        queryFn: () => api.getWarehouseLogs(filterBranchId),
        enabled: isLogsTab
    });

    const { data: counts } = useQuery({
        queryKey: ['warehouse-counts', filterBranchId],
        queryFn: () => api.getWarehouseMachineCounts(filterBranchId),
        refetchInterval: 60000
    });

    const { data: branches } = useQuery({
        queryKey: ['branches-lookup'],
        queryFn: () => api.getBranchesLookup(),
    });

    const { data: parameters } = useQuery({
        queryKey: ['machine-parameters'],
        queryFn: () => api.getMachineParameters()
    });

    // Clients are now loaded on-demand in the modals via live search
    // No need to preload 50 clients
    // const { data: clients } = useQuery<any[]>({
    //     queryKey: ['clients-lite'],
    //     queryFn: () => api.getCustomersLite() as Promise<any[]>
    // });

    const { data: pendingSerials } = useQuery({
        queryKey: ['pending-transfer-serials', user?.branchId],
        queryFn: () => api.getPendingTransferSerials(user?.branchId || undefined, 'MACHINE'),
    });

    // Mutations
    const createMutation = useApiMutation({
        mutationFn: (data: any) => api.addWarehouseMachine(data),
        invalidateKeys: [['warehouse-machines'], ['warehouse-logs'], ['warehouse-counts']],
        onSuccess: () => setModals(prev => ({ ...prev, add: false }))
    });

    const exchangeMutation = useApiMutation({
        mutationFn: (data: any) => api.exchangeWarehouseMachine(data),
        invalidateKeys: [['warehouse-machines'], ['warehouse-logs'], ['warehouse-counts']],
        onSuccess: (res: any) => {
            setModals(prev => ({ ...prev, exchange: false }));
            if (res && res.outgoingMachine && res.incomingMachine) {
                openReplacementReport(res);
            }
        }
    });

    const saleMutation = useApiMutation({
        mutationFn: (data: any) => api.createSale(data),
        invalidateKeys: [['warehouse-machines'], ['warehouse-logs'], ['warehouse-counts']],
        onSuccess: (res: any) => {
            setModals(prev => ({ ...prev, sale: false }));

            // Only open report if response has all required data
            if (res?.customer && res?.serialNumber) {
                openSaleReport({
                    sale: res,
                    installments: res.installments || []
                });
            } else if (res) {
                // Sale succeeded but without full data for report
                // console.log('Sale completed but report data incomplete:', res);
            }
        }
    });

    const transferMutation = useApiMutation({
        mutationFn: (data: any) => api.createTransferOrder(data),
        invalidateKeys: [['warehouse-machines'], ['transfer-orders'], ['pending-transfer-serials'], ['warehouse-counts']],
        onSuccess: () => {
            setModals(prev => ({ ...prev, transfer: false }));
            setSelectedMachines([]);
        }
    });

    // Action Handlers
    const handlers = {
        onSell: (m: any) => { setSelectedItem(m); setModals(prev => ({ ...prev, sale: true })); },
        onExchange: (m: any) => { setSelectedItem(m); setModals(prev => ({ ...prev, exchange: true })); },
        onReturnToCustomer: (m: any) => { setSelectedItem(m); setModals(prev => ({ ...prev, returnToCustomer: true })); },
        onRepair: (m: any) => { setSelectedItem(m); setModals(prev => ({ ...prev, repair: true })); },
        onAddParameter: (m: any) => { setSelectedItem(m); setModals(prev => ({ ...prev, unknownModel: true })); }
    };

    // Excel Template Download
    const downloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([['Serial Number', 'Model', 'Manufacturer', 'Notes']]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "warehouse_machines_import.xlsx");
    };

    // Tab Configuration
    const tabs = [
        { id: 'NEW', label: 'ماكينات جديدة', icon: <Monitor size={18} />, color: 'text-primary', border: 'bg-primary', badge: 'bg-primary/10 text-primary' },
        { id: 'STANDBY', label: 'ماكينات استبدال', icon: <RotateCcw size={18} />, color: 'text-emerald-600', border: 'bg-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
        { id: 'DEFECTIVE', label: 'ماكينات تالفة', icon: <AlertTriangle size={18} />, color: 'text-red-600', border: 'bg-red-600', badge: 'bg-red-100 text-red-700' },
        { id: 'CLIENT_REPAIR', label: 'صيانة عملاء', icon: <Wrench size={18} />, color: 'text-amber-600', border: 'bg-amber-600', badge: 'bg-amber-100 text-amber-700' },
        { id: 'REPAIRED', label: 'ماكينات من الصيانة', icon: <CheckCircle size={18} />, color: 'text-teal-600', border: 'bg-teal-600', badge: 'bg-teal-100 text-teal-700' },
        { id: 'WORKFLOW', label: 'لوحة الصيانة (Kanban)', icon: <Wrench size={18} />, color: 'text-purple-600', border: 'bg-purple-600', badge: 'bg-purple-100 text-purple-700' },
        { id: 'LOGS', label: 'سجل الحركات', icon: <FileClock size={18} />, color: 'text-slate-600', border: 'bg-slate-600', badge: 'bg-slate-100 text-slate-700' },
    ].filter(t => {
        if (isCenterManager && (t.id === 'NEW' || t.id === 'STANDBY' || t.id === 'REPAIRED')) return false;
        if (isAffairs && (t.id === 'STANDBY' || t.id === 'CLIENT_REPAIR' || t.id === 'WORKFLOW' || t.id === 'REPAIRED')) return false;
        if (!isCenterManager && t.id === 'WORKFLOW') return false;
        return true;
    });

    const columns = getMachineColumns(activeTab as any, handlers, isAffairs, isCenterManager, pendingSerials || []);

    return (
        <div className="px-8 pt-4 pb-8 space-y-8 max-w-[1600px] mx-auto bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen" dir="rtl">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-3xl lg:text-4xl font-black text-[#0A2472] tracking-tight">
                        {isAffairs ? 'المخزن الرئيسي' : isCenterManager ? 'إدارة الصيانة' : 'مخزن الماكينات'}
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">إدارة ومراقبة حركة مخزون ماكينات التحصيل</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <MachineImportExport
                        onOpenImportModal={() => setModals(prev => ({ ...prev, import: true }))}
                        onDownloadTemplate={downloadTemplate}
                        isCenterManager={isCenterManager}
                    />

                    {!isCenterManager && (
                        <Button
                            onClick={() => setModals(prev => ({ ...prev, add: true }))}
                            className="flex-1 lg:flex-none bg-gradient-to-r from-[#0A2472] to-[#0A2472]/90 hover:opacity-90 text-white rounded-xl px-6 py-6 font-black shadow-xl transition-all gap-2"
                        >
                            <Plus size={20} />
                            <span className="whitespace-nowrap">إضافة ماكينة</span>
                        </Button>
                    )}



                    {!isCenterManager && !isAffairs && (activeTab === 'CLIENT_REPAIR' || activeTab === 'DEFECTIVE') && selectedMachines.length > 0 && (
                        <Button
                            onClick={() => setModals(prev => ({ ...prev, maintenanceTransfer: true }))}
                            className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-4 py-6 font-bold shadow-xl shadow-amber-200 transition-all gap-2 animate-in slide-in-from-right-4"
                        >
                            <Wrench size={18} />
                            إرسال للصيانة ({selectedMachines.length})
                        </Button>
                    )}
                </div>
            </div>

            <MachineWarehouseStats
                counts={counts}
                isAffairs={isAffairs}
                isCenterManager={isCenterManager}
            />

            <div className="bg-white/40 backdrop-blur-xl border border-slate-200 rounded-3xl p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between mb-8 border-b border-slate-100 gap-4">
                    <div className="flex gap-2 overflow-x-auto pb-px">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id as any);
                                    setSelectedMachines([]);
                                }}
                                className={cn(
                                    "px-6 py-4 relative transition-all flex items-center gap-2 font-bold whitespace-nowrap group",
                                    activeTab === tab.id ? tab.color : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                <span className={cn("transition-transform group-hover:scale-110", activeTab === tab.id && "scale-110")}>
                                    {tab.icon}
                                </span>
                                {tab.label}
                                {counts && (counts as any)[tab.id] > 0 && tab.id !== 'LOGS' && tab.id !== 'WORKFLOW' && (
                                    <Badge className={cn("mr-1 rounded-full px-2 py-0.5", tab.badge)}>
                                        {(counts as any)[tab.id]}
                                    </Badge>
                                )}
                                {activeTab === tab.id && (
                                    <div className={cn("absolute bottom-0 left-0 w-full h-1 rounded-t-full", tab.border)} />
                                )}
                            </button>
                        ))}


                    </div>

                    <div className="flex items-center gap-3 lg:ml-4 mb-2">
                        {isAdmin && !isLogsTab && !isWorkflowTab && (
                            <div className="flex items-center gap-3 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/50">
                                <Filter size={16} className="text-slate-400 mr-2" />
                                <select
                                    value={filterBranchId}
                                    onChange={(e) => setFilterBranchId(e.target.value)}
                                    className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 w-full lg:w-auto"
                                >
                                    <option value="">كل الفروع</option>
                                    {(branches as any[])?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                        )}

                        {isAffairs && (
                            <Button
                                onClick={() => setModals(prev => ({ ...prev, transfer: true }))}
                                disabled={selectedMachines.length === 0}
                                className="bg-primary hover:bg-primary/90 text-white rounded-xl px-4 py-2 font-bold shadow-sm shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed gap-2 whitespace-nowrap h-10"
                            >
                                تحويل {selectedMachines.length > 0 && `(${selectedMachines.length})`}
                            </Button>
                        )}
                    </div>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {isWorkflowTab ? (
                        <MaintenanceKanban />
                    ) : isLogsTab ? (
                        <MachineLogsTable
                            logs={logs || []}
                            isLoading={logsLoading}
                            openReplacementReport={openReplacementReport}
                            openReturnReport={openReturnReport}
                            openSaleReport={openSaleReport}
                            branches={(branches as any) || []}
                            searchTerm={logSearchTerm}
                            onSearchChange={setLogSearchTerm}
                        />
                    ) : (
                        <DataTable
                            columns={columns}
                            data={machines || []}
                            searchKeys={['serialNumber', 'model', 'manufacturer']}
                            isLoading={machinesLoading}
                            onRowSelectionChange={setSelectedMachines}
                        />
                    )}
                </div>
            </div>

            <AddMachineModal
                isOpen={modals.add}
                onClose={() => setModals(prev => ({ ...prev, add: false }))}
                branches={(branches as any) || []}
                isAdmin={isAdmin}
                parameters={(parameters as any) || []}
                isLoading={createMutation.isPending}
                onSubmit={(data) => createMutation.mutate({ ...data, performedBy })}
            />

            <MachineExchangeModal
                isOpen={modals.exchange}
                onClose={() => setModals(prev => ({ ...prev, exchange: false }))}
                selectedMachine={selectedItem}
                isLoading={exchangeMutation.isPending}
                performedBy={performedBy}
                onSubmit={(data) => exchangeMutation.mutate(data)}
            />

            <MachineSaleModal
                isOpen={modals.sale}
                onClose={() => setModals(prev => ({ ...prev, sale: false }))}
                selectedMachine={selectedItem}
                isLoading={saleMutation.isPending}
                performedBy={performedBy}
                userBranchId={user?.branchId || undefined}
                onSubmit={(data) => saleMutation.mutate(data)}
            />

            <MachineRepairModal
                isOpen={modals.repair}
                onClose={() => setModals(prev => ({ ...prev, repair: false }))}
                selectedMachine={selectedItem}
                isLoading={false}
                onSubmit={async (notes) => {
                    try {
                        await api.repairMachineToStandby({ machineId: selectedItem.id, notes, performedBy });
                        queryClient.invalidateQueries({ queryKey: ['warehouse-machines'] });
                        setModals(prev => ({ ...prev, repair: false }));
                        toast.success('تم الإصلاح بنجاح');
                    } catch (err: any) { toast.error(err.message); }
                }}
            />

            <MachineReturnToCustomerModal
                isOpen={modals.returnToCustomer}
                onClose={() => setModals(prev => ({ ...prev, returnToCustomer: false }))}
                selectedMachine={selectedItem}
                isLoading={false}
                onSubmit={async (customerId, notes) => {
                    try {
                        await api.returnMachineToCustomer({ machineId: selectedItem.id, customerId, notes, performedBy });
                        queryClient.invalidateQueries({ queryKey: ['warehouse-machines'] });
                        setModals(prev => ({ ...prev, returnToCustomer: false }));
                        toast.success('تم الإرجاع للعميل');
                    } catch (err: any) { toast.error(err.message); }
                }}
            />

            <TransferMachinesModal
                isOpen={modals.transfer}
                onClose={() => setModals(prev => ({ ...prev, transfer: false }))}
                branches={(branches as any) || []}
                selectedCount={selectedMachines.length}
                isLoading={transferMutation.isPending}
                onSubmit={(branchId, notes) => {
                    const items = machines?.filter((m: any) => selectedMachines.includes(m.id)).map((m: any) => ({
                        serialNumber: m.serialNumber,
                        type: 'MACHINE',
                        manufacturer: m.manufacturer,
                        model: m.model
                    })) || [];

                    transferMutation.mutate({
                        branchId,
                        toBranchId: branchId,
                        fromBranchId: user?.branchId,
                        type: 'MACHINE',
                        notes,
                        createdBy: performedBy,
                        items
                    });
                }}
            />

            {
                modals.maintenanceTransfer && (
                    <MaintenanceTransferModal
                        selectedMachines={machines?.filter((m: any) => selectedMachines.includes(m.id)).map((m: any) => m.serialNumber) || []}
                        onClose={() => {
                            setModals(prev => ({ ...prev, maintenanceTransfer: false }));
                            setSelectedMachines([]);
                        }}
                        performedBy={performedBy}
                    />
                )
            }

            <MachineImportModal
                isOpen={modals.import}
                onClose={() => setModals(prev => ({ ...prev, import: false }))}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['warehouse-machines'] });
                    queryClient.invalidateQueries({ queryKey: ['warehouse-counts'] });
                }}
            />
        </div >
    );
}
