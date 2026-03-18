import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useState, useMemo, useEffect } from 'react';
import type { Customer } from '../lib/types';

/**
 * Safely extracts a Customer[] from any API response shape.
 * Handles: plain array, { data: [] }, { customers: [] }, or undefined/null.
 */
function normalizeCustomersResponse(raw: unknown): Customer[] {
    if (Array.isArray(raw)) {
        return raw;
    }
    if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        if (Array.isArray(obj.data)) return obj.data;
        if (Array.isArray(obj.customers)) return obj.customers;
        if (Array.isArray(obj.items)) return obj.items;
    }
    // Log unexpected shapes for debugging (does not crash UI)
    if (raw !== undefined && raw !== null) {
        console.warn('[useCustomerData] Unexpected customers response shape:', raw);
    }
    return [];
}

/**
 * Safely extracts a MaintenanceRequest[] from any API response shape.
 */
function normalizeRequestsResponse(raw: unknown): any[] {
    if (Array.isArray(raw)) {
        return raw;
    }
    if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        if (Array.isArray(obj.data)) return obj.data;
        if (Array.isArray(obj.requests)) return obj.requests;
    }
    return [];
}

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

    // Fetch customers - normalize response to always be Customer[]
    const { data: rawCustomers, isLoading, error: customersError } = useQuery({
        queryKey: ['customers', filterBranchId],
        queryFn: () => api.getCustomers({ branchId: filterBranchId })
    });

    // Fetch requests - normalize response to always be array
    const { data: rawRequests } = useQuery({
        queryKey: ['requests'],
        queryFn: () => api.getRequests()
    });

    // Normalize to safe arrays (never undefined, never wrong shape)
    const customers: Customer[] = useMemo(
        () => normalizeCustomersResponse(rawCustomers),
        [rawCustomers]
    );

    const requests: any[] = useMemo(
        () => normalizeRequestsResponse(rawRequests),
        [rawRequests]
    );

    const selectedCustomer = useMemo(() => {
        if (!selectedCustomerCode || customers.length === 0) return null;
        return customers.find((c) => c.bkcode === selectedCustomerCode) || null;
    }, [customers, selectedCustomerCode]);

    const machinesWithOpenRequests = useMemo(() => {
        if (requests.length === 0) return new Set<string>();
        return new Set(
            requests
                .filter((r) => r.status !== 'Closed' && r.posMachineId)
                .map((r) => r.posMachineId)
        );
    }, [requests]);

    // Stats calculation - safely iterates over guaranteed array
    const stats = useMemo(() => {
        let machineCount = 0;
        let simCount = 0;
        customers.forEach((c) => {
            machineCount += c.posMachines?.length || 0;
            simCount += c.simCards?.length || 0;
        });
        return {
            customers: customers.length,
            machines: machineCount,
            simCards: simCount
        };
    }, [customers]);

    // Search results - safely iterates over guaranteed array
    const searchResults = useMemo(() => {
        if (!searchQuery || searchQuery.length < 2 || customers.length === 0) return [];
        const query = searchQuery.toLowerCase();
        const results: any[] = [];

        customers.forEach((customer) => {
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
        // Branch filtering
        filterBranchId,
        setFilterBranchId,

        // Search
        searchQuery,
        setSearchQuery,
        searchResults,

        // Selection
        selectedCustomerCode,
        setSelectedCustomerCode,
        selectedCustomer,

        // Data - guaranteed to be typed arrays
        branches,
        customers,  // Always Customer[], never undefined
        isLoading,
        error: customersError,

        // Derived data
        machinesWithOpenRequests,
        stats
    };
}
