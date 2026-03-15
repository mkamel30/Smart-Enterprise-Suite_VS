import React from 'react';
import { Truck, CheckCircle, RotateCcw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';

interface ReturnFormUIProps {
    form: any;
    setForm: (form: any) => void;
    onReturn: () => void;
    isPending: boolean;
    branchName?: string;
}

const ReturnFormUI: React.FC<ReturnFormUIProps> = ({
    form,
    setForm,
    onReturn,
    isPending,
    branchName
}) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Truck size={18} />
                    إرجاع الماكينة للفرع
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                        الماكينة جاهزة للإرجاع إلى {branchName || 'فرعها الأصلي'}
                    </AlertDescription>
                </Alert>
                <div>
                    <Label>رقم بوليصة الشحن (اختياري)</Label>
                    <Input
                        value={form.waybillNumber}
                        onChange={(e) => setForm((prev: any) => ({ ...prev, waybillNumber: e.target.value }))}
                        placeholder="رقم البوليصة..."
                        className="mt-1"
                    />
                </div>
                <div>
                    <Label>ملاحظات الإرجاع</Label>
                    <Textarea
                        value={form.returnNotes}
                        onChange={(e) => setForm((prev: any) => ({ ...prev, returnNotes: e.target.value }))}
                        placeholder="ملاحظات حول حالة الماكينة عند الإرجاع..."
                        className="mt-1"
                        rows={3}
                    />
                </div>
            </CardContent>
            <CardFooter>
                <Button
                    onClick={onReturn}
                    disabled={isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    <RotateCcw size={16} className="ml-2" />
                    إرجاع للفرع
                </Button>
            </CardFooter>
        </Card>
    );
};

export default ReturnFormUI;
