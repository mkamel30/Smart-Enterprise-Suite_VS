import React, { useState } from 'react';
import AuditLogModal from '../AuditLogModal';
import { Tabs, TabsContent } from '../ui/tabs';

// Sub-components
import CustomerDetailHeader from './details/CustomerDetailHeader';
import CustomerDetailTabs from './details/CustomerDetailTabs';
import CustomerMachinesTab from './details/CustomerMachinesTab';
import CustomerInfoTab from './details/CustomerInfoTab';

interface CustomerDetailCardProps {
    customer: any;
    onClose: () => void;
    onCreateRequest?: (customer: any, machine: any) => void;
    onExchange?: (customer: any, machine: any) => void;
    onReturn?: (customer: any, machine: any) => void;
    onViewHistory?: (serialNumber: string) => void;
    disabledMachines?: Set<string>;
    onSimPurchase?: (customer: any) => void;
    onSimExchange?: (customer: any, sim: any) => void;
    onSimHistory?: (customer: any, sim: any) => void;
    onSimUpdate?: (id: string, type: string) => void;
}

export default function CustomerDetailCard({
    customer,
    onClose,
    onCreateRequest,
    onExchange,
    onReturn,
    onViewHistory,
    disabledMachines,
    onSimPurchase,
    onSimExchange,
    onSimHistory,
    onSimUpdate
}: CustomerDetailCardProps) {
    const [showHistory, setShowHistory] = useState(false);

    return (
        <div className="bg-card rounded-[2rem] border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 max-w-5xl mx-auto">
            {/* History Modal */}
            <AuditLogModal
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
                entityType="CUSTOMER"
                entityId={customer.bkcode}
                title={customer.client_name}
            />

            <CustomerDetailHeader
                customer={customer}
                onClose={onClose}
                onShowHistory={() => setShowHistory(true)}
            />

            <div className="p-5">
                <Tabs defaultValue="machines" className="space-y-4">
                    <CustomerDetailTabs
                        machineCount={customer.posMachines?.length || 0}
                        simCount={customer.simCards?.length || 0}
                    />

                    <TabsContent value="machines" className="animate-in fade-in slide-in-from-bottom-4 duration-500 focus-visible:outline-none">
                        <CustomerMachinesTab
                            customer={customer}
                            disabledMachines={disabledMachines}
                            onCreateRequest={onCreateRequest}
                            onExchange={onExchange}
                            onReturn={onReturn}
                            onViewHistory={onViewHistory}
                            onSimPurchase={onSimPurchase}
                            onSimExchange={onSimExchange}
                            onSimHistory={onSimHistory}
                            onSimUpdate={onSimUpdate}
                        />
                    </TabsContent>

                    <TabsContent value="info" className="animate-in fade-in slide-in-from-bottom-4 duration-500 focus-visible:outline-none">
                        <CustomerInfoTab customer={customer} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
