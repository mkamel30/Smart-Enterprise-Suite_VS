import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface UpdateInfo {
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    releaseNotes: string;
    downloadUrl: string;
}

export function useUpdateCheck() {
    const [update, setUpdate] = useState<UpdateInfo | null>(null);
    const [loading, setLoading] = useState(false);

    const checkForUpdates = async () => {
        setLoading(true);
        try {
            const data = await api.getSystemUpdateCheck();
            setUpdate(data);
        } catch {
            setUpdate(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkForUpdates();
    }, []);

    return { update, loading, refetch: checkForUpdates };
}
