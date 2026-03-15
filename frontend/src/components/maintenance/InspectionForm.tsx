import React from 'react';
import { ClipboardCheck, Package, XCircle, CheckCircle, Play, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';

interface InspectionFormProps {
    form: any;
    setForm: (form: any) => void;
    inventoryParts: any[];
    onPartSelect: (partId: string) => void;
    onUpdatePartQuantity: (partId: string, quantity: number) => void;
    onTogglePartPaid: (partId: string) => void;
    onStartRepair: (type: 'FREE' | 'PAID') => void;
    onRequestApproval: () => void;
    onMarkTotalLoss: () => void;
    totalPartsCost: number;
    isPending: boolean;
}

const InspectionForm: React.FC<InspectionFormProps> = ({
    form,
    setForm,
    inventoryParts,
    onPartSelect,
    onUpdatePartQuantity,
    onTogglePartPaid,
    onStartRepair,
    onRequestApproval,
    onMarkTotalLoss,
    totalPartsCost,
    isPending
}) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck size={18} />
                    نموذج الفحص والتقييم
                </CardTitle>
                <CardDescription>
                    قم بتوثيق نتائج الفحص وتقدير التكلفة.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label>وصف المشكلة التفصيلي</Label>
                    <Textarea
                        value={form.problemDescription}
                        onChange={(e) => setForm((prev: any) => ({ ...prev, problemDescription: e.target.value }))}
                        placeholder="وصف تفصيلي للمشكلة المكتشفة..."
                        className="mt-1"
                        rows={3}
                    />
                </div>

                <div>
                    <Label>التكلفة المقدرة (ج.م)</Label>
                    <Input
                        type="number"
                        value={form.estimatedCost}
                        onChange={(e) => setForm((prev: any) => ({ ...prev, estimatedCost: e.target.value }))}
                        placeholder="0.00"
                        className="mt-1"
                    />
                </div>

                <div>
                    <Label>قطع الغيار المطلوبة</Label>
                    <div className="mt-2 border rounded-lg p-4 space-y-2">
                        <Select onValueChange={onPartSelect}>
                            <SelectTrigger>
                                <SelectValue placeholder="اختر قطع الغيار..." />
                            </SelectTrigger>
                            <SelectContent>
                                {inventoryParts?.map((part: any) => (
                                    <SelectItem key={part.partId} value={part.partId}>
                                        {part.part?.name || part.name} (متوفر: {part.quantity})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {form.selectedParts.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {form.selectedParts.map((part: any) => (
                                    <div key={part.partId} className="flex items-center justify-between bg-muted p-2 rounded gap-2">
                                        <div className="flex flex-col flex-1">
                                            <span className="font-bold text-sm">{part.partName}</span>
                                            <span className="text-[10px] text-muted-foreground">{part.cost} ج.م للوحدة</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-xl border border-border shadow-sm group/paid transition-all hover:border-primary/30">
                                                <Checkbox
                                                    id={`paid-${part.partId}`}
                                                    checked={part.isPaid}
                                                    onCheckedChange={() => onTogglePartPaid(part.partId)}
                                                    className="h-5 w-5 rounded-md"
                                                />
                                                <label htmlFor={`paid-${part.partId}`} className="text-[11px] font-black cursor-pointer select-none text-slate-600 group-hover/paid:text-primary transition-colors">بمقابل</label>
                                            </div>
                                            <Input
                                                type="number"
                                                value={part.quantity}
                                                onChange={(e) => onUpdatePartQuantity(part.partId, parseInt(e.target.value))}
                                                className="w-16 h-8 text-center text-xs font-bold"
                                                min={1}
                                            />
                                            <Button variant="ghost" size="sm" onClick={() => onPartSelect(part.partId)} className="h-8 w-8 p-0">
                                                <XCircle size={16} className="text-red-500" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                <div className="pt-2 border-t text-left flex justify-between items-center px-1">
                                    <span className="text-xs text-muted-foreground">التكلفة الإجمالية (للقطع المدفوعة فقط):</span>
                                    <p className="font-black text-primary">{totalPartsCost.toLocaleString()} ج.م</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <Label>ملاحظات إضافية</Label>
                    <Textarea
                        value={form.notes}
                        onChange={(e) => setForm((prev: any) => ({ ...prev, notes: e.target.value }))}
                        placeholder="أي ملاحظات إضافية..."
                        className="mt-1"
                        rows={2}
                    />
                </div>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
                <Button onClick={() => onStartRepair('FREE')} disabled={isPending} variant="outline">
                    <CheckCircle size={16} className="ml-2" />
                    إصلاح مجاني
                </Button>
                <Button onClick={() => onStartRepair('PAID')} disabled={isPending}>
                    <Play size={16} className="ml-2" />
                    بدء إصلاح مدفوع
                </Button>
                <Button onClick={onRequestApproval} disabled={isPending} className="bg-orange-600 hover:bg-orange-700">
                    <Clock size={16} className="ml-2" />
                    إرسال طلب موافقة
                </Button>
                <Button variant="destructive" onClick={onMarkTotalLoss} disabled={isPending}>
                    <XCircle size={16} className="ml-2" />
                    تعليم كخسارة كلية
                </Button>
            </CardFooter>
        </Card>
    );
};

export default InspectionForm;
