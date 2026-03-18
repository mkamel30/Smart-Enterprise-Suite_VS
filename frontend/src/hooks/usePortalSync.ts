import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';

interface PortalSyncStatus {
    portalConfigured: boolean;
    portalUrl: string | null;
    isConnected: boolean;
    lastSync: string | null;
    lastError: string | null;
    offlineQueueSize: number;
}

export function usePortalSync(refreshInterval = 15000) {
    const [status, setStatus] = useState<PortalSyncStatus>({
        portalConfigured: false,
        portalUrl: null,
        isConnected: false,
        lastSync: null,
        lastError: null,
        offlineQueueSize: 0,
    });
    const [loading, setLoading] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const data = await apiClient.get('/system/sync/status');
            setStatus(data);
        } catch {
            // Silently fail — status bar should not throw errors
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, refreshInterval);
        return () => clearInterval(interval);
    }, [fetchStatus, refreshInterval]);

    const triggerSync = useCallback(async () => {
        setLoading(true);
        await fetchStatus();
    }, [fetchStatus]);

    return { ...status, loading, triggerSync, refetch: fetchStatus };
}
