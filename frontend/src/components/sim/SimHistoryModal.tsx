import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { History, Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';

interface SimHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: any;
    sim?: any;
}

export function SimHistoryModal({ isOpen, onClose, sim }: SimHistoryModalProps) {
    const { data: history, isLoading } = useQuery({
        queryKey: ['sim-history', sim?.serialNumber],
        queryFn: () => api.getSimMovements(sim?.serialNumber),
        enabled: isOpen && !!sim
    });

    if (!isOpen) return null;

    const actionLabels: Record<string, { label: string; color: string }> = {
        'ASSIGN': { label: 'تعيين للعميل', color: 'bg-green-100 text-green-700' },
        'EXCHANGE_IN': { label: 'استبدال (وارد)', color: 'bg-blue-100 text-blue-700' },
        'EXCHANGE_OUT': { label: 'استبدال (صادر)', color: 'bg-orange-100 text-orange-700' },
        'RETURN': { label: 'إرجاع للمخزن', color: 'bg-red-100 text-red-700' },
        'IMPORT': { label: 'استيراد', color: 'bg-slate-100 text-slate-700' }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 [&>button]:hidden flex flex-col max-h-[85vh] h-auto overflow-hidden sm:max-w-lg" dir="rtl">
                <DialogHeader className="bg-blue-50 p-6 pb-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <History className="text-blue-600" />
                        سجل حركة الشريحة
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="bg-slate-50 p-4 rounded-xl mb-6 flex items-center gap-4 border border-slate-100 shadow-sm">
                        <div className="p-3 bg-white rounded-full shadow-sm">
                            <Smartphone className="text-purple-600" size={24} />
                        </div>
                        <div>
                            <div className="font-mono text-xl font-bold tracking-tight text-slate-800">{sim?.serialNumber}</div>
                            {sim?.type && <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full inline-block mt-1">{sim.type}</span>}
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-12 text-slate-400">جاري تحميل السجل...</div>
                    ) : history?.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            لا توجد حركات مسجلة لهذه الشريحة
                        </div>
                    ) : (
                        <div className="relative border-r-2 border-slate-100 pr-4 space-y-6 mr-2">
                            {history?.map((log: any) => {
                                const action = actionLabels[log.action] || { label: log.action, color: 'bg-slate-100 text-slate-700' };
                                let details: any = {};
                                try { details = JSON.parse(log.details || '{}'); } catch { }

                                return (
                                    <div key={log.id} className="relative">
                                        <div className={`absolute -right-[23px] top-0 w-3 h-3 rounded-full border-2 border-white ring-2 ring-slate-100 ${action.color.includes('green') ? 'bg-green-500' : action.color.includes('blue') ? 'bg-blue-500' : action.color.includes('orange') ? 'bg-orange-500' : 'bg-slate-400'}`}></div>

                                        <div className="bg-white rounded-lg border border-slate-100 p-3 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${action.color}`}>
                                                    {action.label}
                                                </span>
                                                <span className="text-[10px] font-mono text-slate-400">
                                                    {new Date(log.createdAt).toLocaleString('ar-EG')}
                                                </span>
                                            </div>

                                            <div className="space-y-1">
                                                {log.customerName && (
                                                    <div className="text-sm font-bold text-slate-700">
                                                        <span className="text-slate-400 font-normal ml-1">العميل:</span> {log.customerName}
                                                    </div>
                                                )}
                                                {log.performedBy && (
                                                    <div className="text-xs text-slate-500">
                                                        <span className="text-slate-400 ml-1">بواسطة:</span> {log.performedBy}
                                                    </div>
                                                )}
                                                {details.notes && (
                                                    <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded mt-2 border border-slate-100">
                                                        {details.notes}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t bg-slate-50/50 shrink-0">
                    <Button variant="outline" onClick={onClose} className="w-full h-11 font-bold">
                        إغلاق
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
