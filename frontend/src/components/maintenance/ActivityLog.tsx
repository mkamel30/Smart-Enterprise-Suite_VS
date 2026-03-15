import React from 'react';
import { History, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { MaintenanceDetail } from './MaintenanceTypes';

interface ActivityLogProps {
    logs: MaintenanceDetail['logs'];
}

const ActivityLog: React.FC<ActivityLogProps> = ({ logs }) => {
    if (!logs || logs.length === 0) {
        return (
            <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                    لا توجد سجلات بعد
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <History size={18} />
                    سجل الماكينة
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative border-r-2 border-muted pr-6 space-y-8">
                    {Array.isArray(logs) && logs.map((log) => (
                        <div key={log.id} className="relative">
                            <div className="absolute -right-[33px] mt-1.5 w-4 h-4 rounded-full bg-primary border-4 border-background" />
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-foreground">{log.action}</span>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Calendar size={12} />
                                        {format(new Date(log.performedAt), 'PPP p', { locale: ar })}
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground">بواسطة: {log.performedBy}</p>
                                {log.details && (
                                    <div className="mt-2 p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                                        {log.details}
                                    </div>
                                )}
                                {log.status && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground w-fit">
                                        الحالة: {log.status}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default ActivityLog;
