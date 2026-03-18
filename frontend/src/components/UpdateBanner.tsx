import { useState } from 'react';
import { X, Download, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { useUpdateCheck } from '../hooks/useUpdateCheck';
import { useAuth } from '../context/AuthContext';

export default function UpdateBanner() {
    const { user } = useAuth();
    const { update, refetch } = useUpdateCheck({ enabled: !!user });
    const [dismissed, setDismissed] = useState(false);
    const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

    if (!update?.updateAvailable || dismissed || dismissedVersion === update.latestVersion) {
        return null;
    }

    return (
        <div className="bg-blue-600 text-white px-4 py-2 text-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <RefreshCw size={16} className="animate-spin" />
                <span className="font-bold">
                    تحديث جديد متاح!
                </span>
                <span className="opacity-80">
                    الإصدار {update.latestVersion} (الإصدار الحالي: {update.currentVersion})
                </span>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refetch()}
                    className="text-white hover:bg-blue-500 h-7 px-2"
                >
                    <RefreshCw size={14} />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setDismissed(true); setDismissedVersion(update.latestVersion); }}
                    className="text-white hover:bg-blue-500 h-7 px-2"
                >
                    <X size={14} />
                </Button>
            </div>
        </div>
    );
}
