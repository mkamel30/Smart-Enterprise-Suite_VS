import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Activity, Database, Wifi, AlertCircle } from 'lucide-react';

interface ServerStatus {
    backend: 'online' | 'offline' | 'checking';
    database: 'online' | 'offline' | 'checking';
    lastCheck: Date | null;
}

export default function StatusBar() {
    const [status, setStatus] = useState<ServerStatus>({
        backend: 'checking',
        database: 'checking',
        lastCheck: null
    });
    const [isExpanded, setIsExpanded] = useState(false);
    const [previousStatus, setPreviousStatus] = useState<ServerStatus | null>(null);

    const checkHealth = async () => {
        try {
            // Use lightweight /health to avoid rate-limit bucket with /api
            const response = await fetch('http://localhost:5000/health', {
                signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
                const data = await response.json();
                const statusValue = String(data.status || data.database || '').toLowerCase();
                const isHealthy = ['ok', 'healthy', 'up', 'connected'].includes(statusValue);
                const newStatus: ServerStatus = {
                    backend: 'online',
                    database: isHealthy ? 'online' : 'offline',
                    lastCheck: new Date()
                };

                // Check if status changed
                if (previousStatus) {
                    if (previousStatus.backend === 'online' && newStatus.backend === 'offline') {
                        toast.error('خطأ في الاتصال: السيرفر متوقف!');
                    }
                    if (previousStatus.database === 'online' && newStatus.database === 'offline') {
                        toast.error('خطأ في الاتصال: قاعدة البيانات متوقفة!');
                    }
                }

                setPreviousStatus(newStatus);
                setStatus(newStatus);
            } else {
                throw new Error('Server error');
            }
        } catch (error) {
            const newStatus: ServerStatus = {
                backend: 'offline',
                database: 'offline',
                lastCheck: new Date()
            };

            // Notify user
            if (previousStatus?.backend === 'online') {
                toast.error('خطأ في الاتصال: تعذر الاتصال بالسيرفر');
            }

            setPreviousStatus(newStatus);
            setStatus(newStatus);
        }
    };

    useEffect(() => {
        // Initial check
        checkHealth();

        // Check every 30 seconds
        const interval = setInterval(checkHealth, 30000);

        return () => clearInterval(interval);
    }, [previousStatus]);

    const getStatusColor = (state: 'online' | 'offline' | 'checking') => {
        switch (state) {
            case 'online': return 'bg-green-500';
            case 'offline': return 'bg-red-500';
            case 'checking': return 'bg-yellow-500';
        }
    };

    const getStatusText = (state: 'online' | 'offline' | 'checking') => {
        switch (state) {
            case 'online': return 'متصل';
            case 'offline': return 'غير متصل';
            case 'checking': return 'جاري الفحص...';
        }
    };

    const allOnline = status.backend === 'online' && status.database === 'online';
    const hasIssue = status.backend === 'offline' || status.database === 'offline';

    return (
        <div
            className={`fixed bottom-0 left-0 right-0 z-10 transition-all duration-300 ${hasIssue ? 'bg-red-500 border-t-2 border-red-600 shadow-2xl shadow-red-500/20' : 'bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] dark:shadow-none'}`}
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >
            <div className="container mx-auto px-4 py-2">
                <div className="flex items-center justify-between text-[10px] md:text-xs">
                    {/* Status Indicators */}
                    <div className="flex items-center gap-4">
                        {/* Backend Status */}
                        <div className="flex items-center gap-2">
                            <Activity size={12} className={status.backend === 'online' ? 'text-green-500' : 'text-red-500'} />
                            <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(status.backend)} animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]`} />
                            <span className="font-bold opacity-60">الخادم:</span>
                            <span className={`font-black ${status.backend === 'online' ? 'text-green-500' : 'text-red-500'}`}>
                                {getStatusText(status.backend)}
                            </span>
                        </div>

                        {/* Database Status */}
                        <div className="flex items-center gap-2">
                            <Database size={12} className={status.database === 'online' ? 'text-green-500' : 'text-red-500'} />
                            <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(status.database)} animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]`} />
                            <span className="font-bold opacity-60">قاعدة البيانات:</span>
                            <span className={`font-black ${status.database === 'online' ? 'text-green-500' : 'text-red-500'}`}>
                                {getStatusText(status.database)}
                            </span>
                        </div>
                    </div>

                    {/* Connection Status */}
                    <div className="flex items-center gap-2 text-muted-foreground">
                        {allOnline ? (
                            <>
                                <Wifi size={14} className="text-green-500" />
                                <span className="font-bold">آمن ومتصل</span>
                            </>
                        ) : (
                            <>
                                <AlertCircle size={14} className="text-red-500" />
                                <span className="text-red-500 font-bold uppercase tracking-tighter">انتبه: انقطاع في الشبكة</span>
                            </>
                        )}
                        {status.lastCheck && (
                            <span className="text-[10px] opacity-40 font-mono hidden md:inline ml-2">
                                SYNC: {status.lastCheck.toLocaleTimeString('ar-EG')}
                            </span>
                        )}
                    </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-border/50 text-[10px] text-muted-foreground animate-slide-up">
                        <div className="flex items-center justify-center gap-6">
                            <span className="flex items-center gap-1">🔄 فحص تلقائي <b className="text-primary">30s</b></span>
                            <button
                                onClick={checkHealth}
                                className="text-primary hover:text-primary/80 underline font-black uppercase"
                            >
                                تحديث الآن
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
