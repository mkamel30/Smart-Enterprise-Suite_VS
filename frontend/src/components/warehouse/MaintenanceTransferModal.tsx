import { useState, useEffect } from 'react';
import { X, Wrench, Send } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'react-hot-toast';
import { api } from '../../api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';

interface MaintenanceTransferModalProps {
    selectedMachines: string[];
    onClose: () => void;
    performedBy: string;
}

export function MaintenanceTransferModal({ selectedMachines, onClose, performedBy }: MaintenanceTransferModalProps) {
    const { user } = useAuth();
    const [targetBranchId, setTargetBranchId] = useState('');
    const [waybillNumber, setWaybillNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const queryClient = useQueryClient();

    // Fetch Maintenance Centers
    const { data: maintenanceCenters } = useQuery({
        queryKey: ['maintenance-centers'],
        queryFn: () => api.getBranchesByType('MAINTENANCE_CENTER')
    });

    // Fetch Current User's Branch Info to auto-select the maintenance center
    useQuery({
        queryKey: ['my-branch', user?.branchId],
        queryFn: () => user?.branchId ? api.getBranch(user.branchId) : Promise.resolve(null),
        enabled: !!user?.branchId,
    });

    // Effect to auto-select maintenance center
    useEffect(() => {
        // We can fetch the branch details directly or if we had them in context/user object
        // Since we don't have the parent/maintenanceCenterId in the simple user object, 
        // we can optimistically try to find it or let the user choose.

        // If the user is in a branch that has a designated maintenance center, 
        // we should try to pre-select it.
        const fetchBranchDetails = async () => {
            if (user?.branchId && !targetBranchId) {
                try {
                    const branch = await api.getBranch(user.branchId);
                    if (branch?.maintenanceCenterId) {
                        setTargetBranchId(branch.maintenanceCenterId);
                    }
                } catch (e) {
                    // Ignore error
                }
            }
        };
        fetchBranchDetails();
    }, [user?.branchId, targetBranchId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetBranchId) {
            toast.error('يرجى اختيار مركز الصيانة');
            return;
        }

        setIsLoading(true);
        try {
            await api.bulkTransferMachines({
                serialNumbers: selectedMachines,
                toBranchId: targetBranchId,
                waybillNumber,
                notes,
                performedBy
            });

            toast.success(`تم تحويل ${selectedMachines.length} ماكينة بنجاح`);
            queryClient.invalidateQueries({ queryKey: ['warehouse-machines'] });
            queryClient.invalidateQueries({ queryKey: ['transfer-orders'] });
            onClose();
        } catch (error: any) {
            toast.error(error.message || 'فشل عملية التحويل');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4" dir="rtl">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-hidden">
                <div className="flex justify-between items-center p-8 pb-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-50 rounded-2xl">
                            <Wrench className="text-amber-600" size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900">تحويل للصيانة الخارجية</h2>
                            <p className="text-slate-500 text-sm">تحويل {selectedMachines.length} ماكينة لمركز صيانة</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-8 py-4 space-y-6 custom-scroll">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">مركز الصيانة</label>
                            <select
                                value={targetBranchId}
                                onChange={(e) => setTargetBranchId(e.target.value)}
                                className="w-full border border-slate-200 rounded-2xl px-4 py-3 bg-slate-50/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                                required
                            >
                                <option value="">اختر المركز...</option>
                                {maintenanceCenters?.map((center: any) => (
                                    <option key={center.id} value={center.id}>{center.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">رقم البوليصة / الشحنة (إن وجد)</label>
                            <input
                                type="text"
                                value={waybillNumber}
                                onChange={(e) => setWaybillNumber(e.target.value)}
                                placeholder="مثال: AWB-123456"
                                className="w-full border border-slate-200 rounded-2xl px-4 py-3 bg-slate-50/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">ملاحظات التحويل</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="أي تفاصيل إضافية عن الشحنة..."
                                className="w-full border border-slate-200 rounded-2xl px-4 py-3 bg-slate-50/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all min-h-[100px]"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 p-8 pt-4 shrink-0 bg-slate-50/50 border-t">
                        <Button
                            type="submit"
                            disabled={isLoading || !targetBranchId}
                            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl py-6 font-bold shadow-lg shadow-amber-200 transition-all gap-2"
                        >
                            <Send size={18} />
                            {isLoading ? 'جاري التحويل...' : 'تأكيد التحويل'}
                        </Button>
                        <Button
                            type="button"
                            onClick={onClose}
                            variant="outline"
                            className="flex-1 border-slate-200 rounded-2xl py-6 font-bold text-slate-600 hover:bg-slate-50"
                        >
                            إلغاء
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
