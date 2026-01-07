import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useCustomerData(isAdmin: boolean, initialBranchId?: string) {
    const queryClient = useQueryClient();
    const [filterBranchId, setFilterBranchId] = useState(initialBranchId || '');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCustomerCode, setSelectedCustomerCode] = useState<string | null>(null);

    // Auto-apply machine parameters on page load
    useEffect(() => {
        const applyParameters = async () => {
            try {
                await api.applyMachineParameters();
                queryClient.invalidateQueries({ queryKey: ['customers'] });
            } catch (error) {
                console.error('Failed to apply machine parameters:', error);
            }
        };
        applyParameters();
    }, [queryClient]);

    // Fetch branches if admin
    const { data: branches } = useQuery({
        queryKey: ['branches'],
        queryFn: () => api.getActiveBranches(),
        enabled: isAdmin,
        staleTime: 1000 * 60 * 60
    });

    const { data: customers, isLoading } = useQuery({
        queryKey: ['customers', filterBranchId],
        queryFn: async () => (await api.getCustomers({ branchId: filterBranchId })) as any[]
    });

    const { data: requests } = useQuery({
        queryKey: ['requests'],
        queryFn: async () => (await api.getRequests()) as any[]
    });

    const selectedCustomer = useMemo(() => {
        if (!selectedCustomerCode || !customers) return null;
        return customers.find((c: any) => c.bkcode === selectedCustomerCode) || null;
    }, [customers, selectedCustomerCode]);

    const machinesWithOpenRequests = useMemo(() => {
        if (!requests) return new Set<string>();
        return new Set(
            requests
                .filter((r: any) => r.status !== 'Closed' && r.posMachineId)
                .map((r: any) => r.posMachineId)
        );
    }, [requests]);

    const stats = useMemo(() => {
        if (!customers) return { customers: 0, machines: 0, simCards: 0 };
        let machineCount = 0;
        let simCount = 0;
        customers.forEach((c: any) => {
            machineCount += c.posMachines?.length || 0;
            simCount += c.simCards?.length || 0;
        });
        return {
            customers: customers.length,
            machines: machineCount,
            simCards: simCount
        };
    }, [customers]);

    const searchResults = useMemo(() => {
        if (!searchQuery || searchQuery.length < 2 || !customers) return [];
        const query = searchQuery.toLowerCase();
        const results: any[] = [];

        customers.forEach((customer: any) => {
            const matchesCustomer =
                customer.bkcode?.toLowerCase().includes(query) ||
                customer.client_name?.toLowerCase().includes(query);

            const matchingMachines = customer.posMachines?.filter((m: any) =>
                m.serialNumber?.toLowerCase().includes(query)
            ) || [];

            const matchingSims = customer.simCards?.filter((s: any) =>
                s.serialNumber?.toLowerCase().includes(query)
            ) || [];

            if (matchesCustomer) {
                results.push({
                    type: 'customer',
                    customer,
                    matchText: `${customer.bkcode} - ${customer.client_name}`,
                    icon: 'user'
                });
            }

            matchingMachines.forEach((machine: any) => {
                results.push({
                    type: 'machine',
                    customer,
                    machine,
                    matchText: `ماكينة: ${machine.serialNumber} (${customer.client_name})`,
                    icon: 'monitor'
                });
            });

            matchingSims.forEach((sim: any) => {
                results.push({
                    type: 'sim',
                    customer,
                    sim,
                    matchText: `شريحة: ${sim.serialNumber} (${customer.client_name})`,
                    icon: 'sim'
                });
            });
        });

        return results.slice(0, 15);
    }, [searchQuery, customers]);

    return {
        filterBranchId,
        setFilterBranchId,
        searchQuery,
        setSearchQuery,
        selectedCustomerCode,
        setSelectedCustomerCode,
        branches,
        customers,
        isLoading,
        selectedCustomer,
        machinesWithOpenRequests,
        stats,
        searchResults
    };
}
