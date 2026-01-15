import React, { useState } from 'react';
import { X, UserPlus, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'react-hot-toast';
import { api } from '../../api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';

interface AssignTechnicianModalProps {
    isOpen: boolean;
    onClose: () => void;
    machineId: string;
    serialNumber: string;
}

export function AssignTechnicianModal({ isOpen, onClose, machineId, serialNumber }: AssignTechnicianModalProps) {
    const { user } = useAuth();
    const [selectedTechId, setSelectedTechId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const queryClient = useQueryClient();

    const { data: technicians } = useQuery({
        queryKey: ['technicians', user?.branchId],
        queryFn: () => api.getTechnicians()
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTechId) {
            toast.error('يرجى اختيار فني للصيانة');
            return;
        }

        const technician = (technicians || []).find((t: any) => t.id === selectedTechId);

        setIsLoading(true);
        try {
            await api.post('/service-assignments', {
                machineId,
                serialNumber,
                technicianId: selectedTechId,
                technicianName: technician?.displayName || 'Unknown',
                branchId: user?.branchId
            });

            toast.success(`تم تعيين الفني بنجاح`);
            queryClient.invalidateQueries({ queryKey: ['service-assignments'] });
            queryClient.invalidateQueries({ queryKey: ['warehouse-machines'] }); // Update Kanban
            onClose();
        } catch (error: any) {
            toast.error(error.message || 'فشل التعيين');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4" dir="rtl">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-6 pb-4 shrink-0 border-b border-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-50 rounded-xl">
                            <UserPlus className="text-primary" size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">تعيين فني صيانة</h2>
                            <p className="text-slate-500 text-sm font-medium">للماكينة: <span className="font-mono text-primary">{serialNumber}</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-700">اختر الفني المسؤول</label>
                        <div className="relative">
                            <select
                                value={selectedTechId}
                                onChange={(e) => setSelectedTechId(e.target.value)}
                                className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full p-3 pr-10 outline-none transition-all font-medium"
                                required
                            >
                                <option value="">اختر من القائمة...</option>
                                {technicians?.map((tech: any) => (
                                    <option key={tech.id} value={tech.id}>{tech.displayName}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                                <Search size={16} />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button
                            type="submit"
                            disabled={isLoading || !selectedTechId}
                            className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl py-6 font-bold shadow-lg shadow-primary/20 transition-all"
                        >
                            {isLoading ? 'جاري التعيين...' : 'تأكيد التعيين'}
                        </Button>
                        <Button
                            type="button"
                            onClick={onClose}
                            variant="outline"
                            className="flex-1 border-slate-200 rounded-xl py-6 font-bold text-slate-600 hover:bg-slate-50"
                        >
                            إلغاء
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
