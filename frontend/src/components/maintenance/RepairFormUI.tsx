import React from 'react';
import { Wrench, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';

interface RepairFormUIProps {
    form: any;
    setForm: (form: any) => void;
    onMarkRepaired: () => void;
    isPending: boolean;
    estimatedCost?: number;
}

const RepairFormUI: React.FC<RepairFormUIProps> = ({
    form,
    setForm,
    onMarkRepaired,
    isPending,
    estimatedCost
}) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Wrench size={18} />
                    إكمال الإصلاح
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label>التكلفة النهائية (ج.م)</Label>
                    <Input
                        type="number"
                        value={form.finalCost}
                        onChange={(e) => setForm((prev: any) => ({ ...prev, finalCost: e.target.value }))}
                        placeholder={estimatedCost?.toString() || '0.00'}
                        className="mt-1"
                    />
                </div>
                <div>
                    <Label>رقم إيصال الإصلاح</Label>
                    <Input
                        value={form.voucherNumber}
                        onChange={(e) => setForm((prev: any) => ({ ...prev, voucherNumber: e.target.value }))}
                        placeholder="رقم الإيصال..."
                        className="mt-1"
                    />
                </div>
                <div>
                    <Label>ملاحظات</Label>
                    <Textarea
                        value={form.notes}
                        onChange={(e) => setForm((prev: any) => ({ ...prev, notes: e.target.value }))}
                        placeholder="ملاحظات عن عملية الإصلاح..."
                        className="mt-1"
                        rows={3}
                    />
                </div>
            </CardContent>
            <CardFooter>
                <Button
                    onClick={onMarkRepaired}
                    disabled={isPending}
                    className="bg-green-600 hover:bg-green-700"
                >
                    <CheckCircle size={16} className="ml-2" />
                    إكمال الإصلاح
                </Button>
            </CardFooter>
        </Card>
    );
};

export default RepairFormUI;
