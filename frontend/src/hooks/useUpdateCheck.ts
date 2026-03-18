import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface UpdateInfo {
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    releaseNotes: string;
    downloadUrl: string;
}

interface UseUpdateCheckOptions {
    enabled?: boolean;
}

export function useUpdateCheck(options: UseUpdateCheckOptions = {}) {
    const { enabled = true } = options;
    const [update, setUpdate] = useState<UpdateInfo | null>(null);
    const [loading, setLoading] = useState(false);

    const checkForUpdates = async () => {
        if (!enabled) return;
        setLoading(true);
        try {
            const data = await api.getSystemUpdateCheck() as UpdateInfo;
            setUpdate(data);
        } catch {
            setUpdate(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkForUpdates();
    }, [enabled]);

    return { update, loading, refetch: checkForUpdates };
}
