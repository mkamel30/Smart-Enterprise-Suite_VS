import React from 'react';
import toast from 'react-hot-toast';
import { api } from '../../api/client';
import ImportModal from '../ImportModal';
import MachineHistoryModal from '../MachineHistoryModal';
import { SimExchangeModal, SimPurchaseModal, SimHistoryModal } from '../SimModals';
import { MachineExchangeModal, MachineReturnModal } from './MachineActionModals';

interface CustomerModalsProps {
    modals: {
        exchange: boolean;
        returnMachine: boolean;
        history: boolean;
        simExchange: boolean;
        simPurchase: boolean;
        simHistory: boolean;
        import: boolean;
    };
    handlers: {
        closeExchange: () => void;
        closeReturn: () => void;
        closeHistory: () => void;
        closeSimExchange: () => void;
        closeSimPurchase: () => void;
        closeSimHistory: () => void;
        closeImport: () => void;
    };
    data: {
        targetCustomer: any;
        selectedActionMachine: any;
        warehouseMachines: any[];
        selectedReplacement: string;
        setSelectedReplacement: (id: string) => void;
        actionNotes: string;
        setActionNotes: (notes: string) => void;
        incomingStatus: string;
        setIncomingStatus: (status: string) => void;
        selectedMachineHistory: string;
        selectedSim: any;
        complaint: string;
        setComplaint: (complaint: string) => void;
    };
    mutations: {
        exchange: any;
        return: any;
        onImportSuccess: () => void;
        invalidateCustomers: () => void;
    };
}

export default function CustomerModals({
    modals,
    handlers,
    data,
    mutations
}: CustomerModalsProps) {
    return (
        <>
            {/* Exchange Modal */}
            <MachineExchangeModal
                isOpen={modals.exchange}
                onClose={handlers.closeExchange}
                targetCustomer={data.targetCustomer}
                selectedActionMachine={data.selectedActionMachine}
                warehouseMachines={data.warehouseMachines}
                selectedReplacement={data.selectedReplacement}
                setSelectedReplacement={data.setSelectedReplacement}
                actionNotes={data.actionNotes}
                setActionNotes={data.setActionNotes}
                isPending={mutations.exchange.isPending}
                onConfirm={() => {
                    if (!data.selectedReplacement) return toast.error('اختر الماكينة البديلة');
                    mutations.exchange.mutate({
                        outgoingMachineId: data.selectedReplacement,
                        customerId: data.targetCustomer.bkcode,
                        incomingMachineId: data.selectedActionMachine.id,
                        incomingStatus: data.incomingStatus,
                        incomingNotes: data.actionNotes
                    });
                }}
            />

            {/* Return Modal */}
            <MachineReturnModal
                isOpen={modals.returnMachine}
                onClose={handlers.closeReturn}
                targetCustomer={data.targetCustomer}
                selectedActionMachine={data.selectedActionMachine}
                actionNotes={data.actionNotes}
                setActionNotes={data.setActionNotes}
                complaint={data.complaint}
                setComplaint={data.setComplaint}
                setIncomingStatus={data.setIncomingStatus}
                isPending={mutations.return.isPending}
                onConfirm={() => {
                    mutations.return.mutate({
                        machineId: data.selectedActionMachine.id,
                        customerId: data.targetCustomer.bkcode,
                        reason: 'Return',
                        notes: data.actionNotes,
                        complaint: data.complaint,
                        status: data.incomingStatus
                    });
                }}
            />

            {/* Machine History Modal */}
            {modals.history && (
                <MachineHistoryModal
                    serialNumber={data.selectedMachineHistory}
                    onClose={handlers.closeHistory}
                />
            )}

            {/* SIM Exchange Modal */}
            <SimExchangeModal
                isOpen={modals.simExchange}
                onClose={handlers.closeSimExchange}
                customer={data.targetCustomer}
                currentSim={data.selectedSim}
                onSuccess={mutations.invalidateCustomers}
            />

            {/* SIM Purchase Modal */}
            <SimPurchaseModal
                isOpen={modals.simPurchase}
                onClose={handlers.closeSimPurchase}
                customer={data.targetCustomer}
                onSuccess={mutations.invalidateCustomers}
            />

            {/* SIM History Modal */}
            <SimHistoryModal
                isOpen={modals.simHistory}
                onClose={handlers.closeSimHistory}
                customer={data.targetCustomer}
                sim={data.selectedSim}
            />

            {/* Import Modal */}
            <ImportModal
                isOpen={modals.import}
                onClose={handlers.closeImport}
                onImport={async (file) => await api.importCustomers(file)}
                onSuccess={mutations.onImportSuccess}
                title="استيراد العملاء"
                columns={[
                    { header: 'رقم العميل', key: 'رقم العميل' },
                    { header: 'اسم العميل', key: 'اسم العميل' },
                    { header: 'العنوان', key: 'العنوان' },
                    { header: 'رقم الهاتف 1', key: 'رقم الهاتف 1' },
                    { header: 'نوع العميل', key: 'نوع العميل' },
                    { header: 'الشخص المسؤول', key: 'الشخص المسؤول' },
                    { header: 'ملاحظات', key: 'ملاحظات' }
                ]}
            />
        </>
    );
}
