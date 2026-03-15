import React from 'react';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { approvalStatusConfig } from './MaintenanceTypes';

interface ApprovalStatusCardProps {
    approvalRequest: any;
    machineStatus: string;
}

const ApprovalStatusCard: React.FC<ApprovalStatusCardProps> = ({ approvalRequest, machineStatus }) => {
    if (!approvalRequest) {
        return (
            <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>لا يوجد طلب موافقة مسجل لهذه الماكينة</AlertDescription>
            </Alert>
        );
    }

    const config = approvalStatusConfig[approvalRequest.status];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock size={18} />
                    حالة طلب الموافقة
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                        <p className="text-sm text-muted-foreground">حالة الموافقة</p>
                        <Badge variant="outline" className={`${config.color} mt-1`}>
                            {config.icon}
                            {config.label}
                        </Badge>
                    </div>
                    <div className="text-left">
                        <p className="text-sm text-muted-foreground">التكلفة المطلوبة</p>
                        <p className="text-2xl font-bold">{approvalRequest.cost} ج.م</p>
                    </div>
                </div>

                <div>
                    <Label>سبب الطلب</Label>
                    <p className="mt-1 p-3 bg-muted rounded-lg">{approvalRequest.reason}</p>
                </div>

                <div>
                    <Label>تاريخ الطلب</Label>
                    <p className="mt-1">
                        {format(new Date(approvalRequest.requestedAt), 'PPP', { locale: ar })}
                    </p>
                </div>

                {approvalRequest.respondedAt && (
                    <>
                        <div>
                            <Label>تاريخ الرد</Label>
                            <p className="mt-1">
                                {format(new Date(approvalRequest.respondedAt), 'PPP', { locale: ar })}
                            </p>
                        </div>
                        {approvalRequest.responseNotes && (
                            <div>
                                <Label>ملاحظات الرد</Label>
                                <p className="mt-1 p-3 bg-muted rounded-lg">
                                    {approvalRequest.responseNotes}
                                </p>
                            </div>
                        )}
                    </>
                )}

                {approvalRequest.status === 'APPROVED' && machineStatus === 'WAITING_APPROVAL' && (
                    <Alert className="bg-green-50 border-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-700">
                            تمت الموافقة! يمكنك الآن بدء عملية الإصلاح
                        </AlertDescription>
                    </Alert>
                )}

                {approvalRequest.status === 'REJECTED' && (
                    <Alert className="bg-red-50 border-red-200">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-700">
                            تم رفض الطلب. يمكنك إعادة الفحص أو تعليم الماكينة كخسارة كلية
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
};

export default ApprovalStatusCard;
