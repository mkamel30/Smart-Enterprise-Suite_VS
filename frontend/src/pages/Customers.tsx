import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { RefreshCw, Users, Monitor, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCustomerData } from '../hooks/useCustomerData';
import { useApiMutation } from '../hooks/useApiMutation';
import { api } from '../api/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

// Sub-components
import CustomerHeader from '../components/customers/CustomerHeader';
import CustomerStats from '../components/customers/CustomerStats';
import CustomerSearch from '../components/customers/CustomerSearch';
import CustomerQuickList from '../components/customers/CustomerQuickList';
import CustomerDetailCard from '../components/customers/CustomerDetailCard';
import AllMachinesTable from '../components/customers/AllMachinesTable';
import AllSimCardsTable from '../components/customers/AllSimCardsTable';
import CustomerModals from '../components/customers/CustomerModals';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { openReplacementReport } from '../utils/reports/ReplacementReport';

export default function Customers() {
    const { user } = useAuth();
    const isAdmin = !user?.branchId;
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const {
        filterBranchId, setFilterBranchId,
        searchQuery, setSearchQuery,
        selectedCustomerCode, setSelectedCustomerCode,
        branches, customers, isLoading,
        selectedCustomer, machinesWithOpenRequests,
        stats, searchResults
    } = useCustomerData(isAdmin, user?.branchId);

    const [viewTab, setViewTab] = useState<'CUSTOMERS' | 'MACHINES' | 'SIMCARDS'>('CUSTOMERS');

    // Mutations
    const updateSimMutation = useApiMutation({
        mutationFn: (data: { id: string, type: string }) => api.updateSimCard(data.id, { type: data.type }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
        successMessage: 'تم تحديث نوع الشريحة بنجاح'
    });

    // Modal States
    const [modals, setModals] = useState({
        exchange: false,
        returnMachine: false,
        history: false,
        simExchange: false,
        simPurchase: false,
        simHistory: false,
        import: false
    });

    const [modalData, setModalData] = useState({
        targetCustomer: null,
        selectedActionMachine: null,
        selectedReplacement: '',
        incomingStatus: 'DEFECTIVE',
        actionNotes: '',
        complaint: '',
        selectedMachineHistory: '',
        selectedSim: null
    });

    // Modal Handlers
    const handleExchange = (customer: any, machine: any) => {
        setModalData({ ...modalData, targetCustomer: customer, selectedActionMachine: machine, incomingStatus: 'DEFECTIVE', actionNotes: '', complaint: '', selectedReplacement: '' });
        setModals({ ...modals, exchange: true });
    };

    const handleReturn = (customer: any, machine: any) => {
        setModalData({ ...modalData, targetCustomer: customer, selectedActionMachine: machine, incomingStatus: 'CLIENT_REPAIR', actionNotes: '', complaint: '' });
        setModals({ ...modals, returnMachine: true });
    };

    const handleViewHistory = (serialNumber: string) => {
        setModalData({ ...modalData, selectedMachineHistory: serialNumber });
        setModals({ ...modals, history: true });
    };

    const handleCreateRequest = (customer: any, machine: any) => {
        navigate('/requests', {
            state: {
                createRequest: true,
                customerId: customer.bkcode,
                machineId: machine.id,
                customerName: customer.client_name,
                machineSerial: machine.serialNumber,
                customer: customer,
                machine: machine
            }
        });
    };

    // Fetch available warehouse machines for exchange
    const { data: warehouseMachines } = useQuery({
        queryKey: ['available-warehouse-machines', user?.branchId],
        queryFn: () => api.getAvailableWarehouseMachines(user?.branchId),
        enabled: !!user,
        staleTime: 5 * 60 * 1000 // 5 minutes
    });

    // Mutations for modals
    const exchangeMutation = useApiMutation({
        mutationFn: (data: any) => api.exchangeWarehouseMachine(data),
        successMessage: 'تم استبدال الماكينة بنجاح',
        onSuccess: (data, variables) => {
            const outgoingMachine = warehouseMachines?.find((m: any) => m.id === variables.outgoingMachineId);

            if (outgoingMachine && modalData.selectedActionMachine) {
                try {
                    openReplacementReport({
                        customer: modalData.targetCustomer,
                        incomingMachine: modalData.selectedActionMachine,
                        outgoingMachine: outgoingMachine,
                        notes: variables.incomingNotes,
                        status: variables.incomingStatus
                    });
                } catch (e) {
                    console.error('Failed to open report', e);
                    toast.error('فشل فتح التقرير');
                }
            }

            queryClient.invalidateQueries({ queryKey: ['customers'] });
            queryClient.invalidateQueries({ queryKey: ['warehouse-machines'] });
            setModals({ ...modals, exchange: false });
        }
    });

    const returnMutation = useApiMutation({
        mutationFn: (data: any) => api.returnMachineToWarehouse(data),
        successMessage: 'تم استرجاع الماكينة بنجاح',
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            queryClient.invalidateQueries({ queryKey: ['warehouse-machines'] });
            setModals({ ...modals, returnMachine: false });
        }
    });



    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50/50 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="animate-spin text-primary" size={40} />
                    <span className="font-black text-slate-500">جاري تحميل البيانات...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen page-container bg-slate-50/50" dir="rtl">
            <CustomerHeader
                isAdmin={isAdmin}
                filterBranchId={filterBranchId}
                setFilterBranchId={setFilterBranchId}
                branches={branches || []}
                onImport={() => setModals({ ...modals, import: true })}
                onDownloadTemplate={async () => { try { await api.getCustomerTemplate(); } catch (e: any) { toast.error(e.message); } }}
            />

            <Tabs value={viewTab} onValueChange={(v: any) => setViewTab(v)} className="space-y-8">
                <TabsList className="bg-muted/50 p-1 rounded-2xl border border-border/50 w-full flex flex-row-reverse justify-start">
                    <TabsTrigger value="CUSTOMERS" className="rounded-xl px-8 py-2 font-black text-sm flex flex-row-reverse gap-2">
                        <Users size={18} /> دليل العملاء
                    </TabsTrigger>
                    <TabsTrigger value="MACHINES" className="rounded-xl px-8 py-2 font-black text-sm flex flex-row-reverse gap-2">
                        <Monitor size={18} /> جميع الماكينات
                    </TabsTrigger>
                    <TabsTrigger value="SIMCARDS" className="rounded-xl px-8 py-2 font-black text-sm flex flex-row-reverse gap-2">
                        <CreditCard size={18} /> جميع الشرائح
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="CUSTOMERS" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <CustomerStats stats={stats} />
                    <CustomerSearch
                        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                        searchResults={searchResults} onSelectResult={(r) => { setSelectedCustomerCode(r.customer.bkcode); setSearchQuery(''); }}
                    />
                    {selectedCustomer ? (
                        <CustomerDetailCard
                            customer={selectedCustomer}
                            onClose={() => setSelectedCustomerCode(null)}
                            onCreateRequest={handleCreateRequest}
                            onExchange={handleExchange}
                            onReturn={handleReturn}
                            onViewHistory={handleViewHistory}
                            disabledMachines={machinesWithOpenRequests}
                            onSimPurchase={(c) => { setModalData({ ...modalData, targetCustomer: c }); setModals({ ...modals, simPurchase: true }); }}
                            onSimExchange={(c, s) => { setModalData({ ...modalData, targetCustomer: c, selectedSim: s }); setModals({ ...modals, simExchange: true }); }}
                            onSimHistory={(c, s) => { setModalData({ ...modalData, targetCustomer: c, selectedSim: s }); setModals({ ...modals, simHistory: true }); }}
                            onSimUpdate={(id, type) => updateSimMutation.mutate({ id, type })}
                        />
                    ) : (
                        <CustomerQuickList customers={customers || []} onSelectCustomer={setSelectedCustomerCode} />
                    )}
                </TabsContent>

                <TabsContent value="MACHINES" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-card rounded-4xl border border-border shadow-2xl overflow-hidden">
                        <AllMachinesTable customers={customers || []} onCreateRequest={handleCreateRequest} onExchange={handleExchange} onReturn={handleReturn} />
                    </div>
                </TabsContent>

                <TabsContent value="SIMCARDS" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-card rounded-[2rem] border border-border shadow-2xl overflow-hidden">
                        <AllSimCardsTable customers={customers || []} />
                    </div>
                </TabsContent>
            </Tabs>

            <CustomerModals
                modals={modals}
                handlers={{
                    closeExchange: () => setModals({ ...modals, exchange: false }),
                    closeReturn: () => setModals({ ...modals, returnMachine: false }),
                    closeHistory: () => setModals({ ...modals, history: false }),
                    closeSimExchange: () => setModals({ ...modals, simExchange: false }),
                    closeSimPurchase: () => setModals({ ...modals, simPurchase: false }),
                    closeSimHistory: () => setModals({ ...modals, simHistory: false }),
                    closeImport: () => setModals({ ...modals, import: false })
                }}
                data={{
                    ...modalData,
                    warehouseMachines: warehouseMachines || [], // Should match what the modal needs
                    setSelectedReplacement: (id) => setModalData({ ...modalData, selectedReplacement: id }),
                    setActionNotes: (notes) => setModalData({ ...modalData, actionNotes: notes }),
                    setIncomingStatus: (status) => setModalData({ ...modalData, incomingStatus: status }),
                    setComplaint: (complaint) => setModalData({ ...modalData, complaint })
                }}
                mutations={{
                    exchange: exchangeMutation,
                    return: returnMutation,
                    onImportSuccess: () => { setModals({ ...modals, import: false }); queryClient.invalidateQueries({ queryKey: ['customers'] }); },
                    invalidateCustomers: () => queryClient.invalidateQueries({ queryKey: ['customers'] })
                }}
            />
        </div>
    );
}
