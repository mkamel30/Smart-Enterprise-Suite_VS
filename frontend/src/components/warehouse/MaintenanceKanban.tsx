import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { api } from '../../api/client';
import { Loader2, UserPlus, Play } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import toast from 'react-hot-toast';
import { RepairModal } from './RepairModal';
import { AssignTechnicianModal } from './AssignTechnicianModal';
import { translateStatus } from '../../lib/translations';

const COLUMNS = {
    RECEIVED_AT_CENTER: { title: 'تم الاستلام', color: 'bg-blue-50/50', headerColor: 'bg-blue-100', borderColor: 'border-blue-200' },
    ASSIGNED: { title: 'تم التعيين', color: 'bg-indigo-50/50', headerColor: 'bg-indigo-100', borderColor: 'border-indigo-200' },
    UNDER_INSPECTION: { title: 'تحت الفحص', color: 'bg-yellow-50/50', headerColor: 'bg-yellow-100', borderColor: 'border-yellow-200' },
    AWAITING_APPROVAL: { title: 'بانتظار الموافقة', color: 'bg-orange-50/50', headerColor: 'bg-orange-100', borderColor: 'border-orange-200' },
    IN_PROGRESS: { title: 'جاري الإصلاح', color: 'bg-purple-50/50', headerColor: 'bg-purple-100', borderColor: 'border-purple-200' },
    READY_FOR_RETURN: { title: 'جاهز للإرجاع', color: 'bg-green-50/50', headerColor: 'bg-green-100', borderColor: 'border-green-200' }
};

const MaintenanceKanban: React.FC = () => {
    const { user } = useAuth();
    const [machines, setMachines] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [propPending, setPropPending] = useState<{
        draggableId: string;
        source: any;
        destination: any;
    } | null>(null);

    const [modal, setModal] = useState<{
        type: 'INSPECTION' | 'APPROVAL' | 'COMPLETION' | 'ASSIGN_TECH' | null;
        isOpen: boolean;
    }>({ type: null, isOpen: false });

    const [selectedMachineForAssign, setSelectedMachineForAssign] = useState<any>(null);
    const [formData, setFormData] = useState<any>({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchBoard();
    }, []);

    const fetchBoard = async () => {
        try {
            const data = await api.get<any[]>('/machine-workflow/kanban');
            setMachines(data);
        } catch (error) {
            console.error('Failed to load Kanban:', error);
            toast.error('فشل تحميل البيانات');
        } finally {
            setLoading(false);
        }
    };

    const getColumnMachines = (status: string) => {
        return machines.filter(m => m.status === status);
    };

    const onDragEnd = async (result: any) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const targetStatus = destination.droppableId;

        // Check for modal requirements
        if (targetStatus === 'UNDER_INSPECTION' && source.droppableId !== 'UNDER_INSPECTION') {
            setPropPending({ draggableId, source, destination });
            setFormData({ notes: '' });
            setModal({ type: 'INSPECTION', isOpen: true });
            return;
        }
        if (targetStatus === 'AWAITING_APPROVAL' && source.droppableId !== 'AWAITING_APPROVAL') {
            setPropPending({ draggableId, source, destination });
            setFormData({ cost: 0, parts: '', notes: '' });
            setModal({ type: 'APPROVAL', isOpen: true });
            return;
        }
        if (targetStatus === 'READY_FOR_RETURN' && source.droppableId !== 'READY_FOR_RETURN') {
            setPropPending({ draggableId, source, destination });
            setFormData({ resolution: 'REPAIRED', notes: '' });
            setModal({ type: 'COMPLETION', isOpen: true });
            return;
        }

        // Direct transition
        executeTransition(draggableId, targetStatus);
    };

    const executeTransition = async (draggableId: string, targetStatus: string, payload: any = {}) => {
        const originalMachines = [...machines];
        // Optimistic update
        setMachines(prev => prev.map(m =>
            m.id === draggableId ? { ...m, status: targetStatus, ...payload } : m
        ));

        try {
            setSubmitting(true);
            await api.post(`/machine-workflow/${draggableId}/transition`, {
                targetStatus: targetStatus,
                payload
            });
            toast.success('تم تغيير الحالة بنجاح');
            // Re-fetch to normalize any server-side changes
            // fetchBoard(); 
        } catch (error: any) {
            console.error('Transition failed:', error);
            toast.error(`فشل تغيير الحالة: ${error.message || 'Unknown Error'}`);
            setMachines(originalMachines); // Revert
        } finally {
            setSubmitting(false);
            setModal({ type: null, isOpen: false });
            setPropPending(null);
        }
    };

    const handleRepairSubmit = async (payload: any) => {
        if (!propPending) return;
        executeTransition(propPending.draggableId, propPending.destination.droppableId, payload);
    };

    const handleModalSubmit = () => {
        if (!propPending) return;
        executeTransition(propPending.draggableId, propPending.destination.droppableId, formData);
    };

    if (loading) return (
        <div className="flex items-center justify-center p-12 text-slate-400">
            <Loader2 className="animate-spin mr-2" />
            جاري تحميل اللوحة...
        </div>
    );

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-none p-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">سير عمل الصيانة (Kanban)</h2>
                <Button variant="ghost" onClick={fetchBoard} size="sm">
                    تحديث البيانات
                </Button>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="flex h-full gap-6 min-w-max">
                        {Object.entries(COLUMNS).map(([status, col]: [string, any]) => (
                            <div key={status} className={`flex flex-col w-80 rounded-2xl border ${col.borderColor} ${col.color} shadow-sm max-h-full`}>
                                {/* Column Header */}
                                <div className={`p-4 rounded-t-2xl border-b ${col.borderColor} ${col.headerColor} flex justify-between items-center`}>
                                    <h3 className="font-bold text-slate-700">{col.title}</h3>
                                    <span className="bg-white/80 px-2.5 py-0.5 rounded-full text-xs font-bold text-slate-600 shadow-sm">
                                        {getColumnMachines(status).length}
                                    </span>
                                </div>

                                {/* Droppable Area */}
                                <Droppable droppableId={status}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className={`flex-1 p-3 overflow-y-auto min-h-[150px] custom-scroll transition-colors ${snapshot.isDraggingOver ? 'bg-white/50' : ''}`}
                                        >
                                            {getColumnMachines(status).map((machine, index) => (
                                                <Draggable key={machine.id} draggableId={machine.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={`bg-white p-4 mb-3 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-all group ${snapshot.isDragging ? 'rotate-2 shadow-xl ring-2 ring-blue-500 scale-105 z-50' : ''}`}
                                                        >
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className="font-mono text-sm font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                                                                    {machine.serialNumber}
                                                                </span>
                                                                {machine.resolution && (
                                                                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${machine.resolution === 'REPAIRED' ? 'bg-green-100 text-green-700' :
                                                                        machine.resolution === 'SCRAPPED' ? 'bg-red-100 text-red-700' :
                                                                            'bg-slate-100 text-slate-600'
                                                                        }`}>
                                                                        {translateStatus(machine.resolution)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs font-medium text-slate-600 line-clamp-1 mb-2">
                                                                {machine.model || 'Unknown Model'}
                                                            </p>
                                                            {machine.notes && (
                                                                <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-3 mb-2">
                                                                    {machine.notes}
                                                                </div>
                                                            )}
                                                            {machine.currentTechnicianName && (
                                                                <div className="text-[11px] text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md font-bold mb-2 inline-block">
                                                                    المختص: {machine.currentTechnicianName}
                                                                </div>
                                                            )}

                                                            {(machine.status === 'RECEIVED_AT_CENTER') && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="w-full mt-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 h-8 text-xs font-bold"
                                                                    onClick={() => {
                                                                        setSelectedMachineForAssign(machine);
                                                                        setModal({ type: 'ASSIGN_TECH', isOpen: true });
                                                                    }}
                                                                >
                                                                    <UserPlus size={14} className="ml-2" />
                                                                    تعيين فني
                                                                </Button>
                                                            )}

                                                            {(machine.status === 'ASSIGNED') && (
                                                                <>
                                                                    {/* If current user is the assigned tech -> Show Start Work */}
                                                                    {machine.currentTechnicianId === user?.id ? (
                                                                        <Button
                                                                            size="sm"
                                                                            className="w-full mt-2 bg-primary hover:bg-primary/90 text-white h-8 text-xs font-bold shadow-sm shadow-primary/20"
                                                                            onClick={() => {
                                                                                // Start Work -> Move to UNDER_INSPECTION immediately
                                                                                setPropPending({
                                                                                    draggableId: machine.id,
                                                                                    source: { droppableId: 'ASSIGNED' },
                                                                                    destination: { droppableId: 'UNDER_INSPECTION' }
                                                                                });
                                                                                setFormData({ notes: '' });
                                                                                setModal({ type: 'INSPECTION', isOpen: true });
                                                                            }}
                                                                        >
                                                                            <Play size={14} className="ml-2 fill-current" />
                                                                            بدء العمل
                                                                        </Button>
                                                                    ) : (
                                                                        /* If Manager/Admin -> Allow Re-assign */
                                                                        (user?.role === 'CENTER_MANAGER' || user?.role === 'SUPER_ADMIN') && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="w-full mt-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 h-8 text-xs"
                                                                                onClick={() => {
                                                                                    setSelectedMachineForAssign(machine);
                                                                                    setModal({ type: 'ASSIGN_TECH', isOpen: true });
                                                                                }}
                                                                            >
                                                                                <UserPlus size={14} className="ml-2" />
                                                                                إعادة تعيين
                                                                            </Button>
                                                                        )
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </div>
                        ))}
                    </div>
                </DragDropContext>
            </div>

            {/* Inspection Modal */}
            <Dialog open={modal.isOpen && modal.type === 'INSPECTION'} onOpenChange={(open) => !open && setModal({ ...modal, isOpen: false })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>بدء الفحص</DialogTitle>
                        <DialogDescription>
                            يرجى إضافة أي ملاحظات أولية قبل البدء في الفحص.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Label>ملاحظات الفحص</Label>
                        <Textarea
                            placeholder="اكتب ملاحظات الفحص هنا..."
                            value={formData.notes || ''}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="min-h-[120px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModal({ ...modal, isOpen: false })}>إلغاء</Button>
                        <Button onClick={handleModalSubmit} disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            تأكيد وبدء الفحص
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Approval Modal */}
            <Dialog open={modal.isOpen && modal.type === 'APPROVAL'} onOpenChange={(open) => !open && setModal({ ...modal, isOpen: false })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>طلب موافقة للإصلاح</DialogTitle>
                        <DialogDescription>
                            أدخل التكلفة التقديرية وقطع الغيار المطلوبة.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>التكلفة التقديرية</Label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={formData.cost || ''}
                                    onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>قطع الغيار المطلوبة</Label>
                            <Input
                                placeholder="مثال: شاشة، بطارية..."
                                value={formData.parts || ''}
                                onChange={(e) => setFormData({ ...formData, parts: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>ملاحظات</Label>
                            <Textarea
                                placeholder="..."
                                value={formData.notes || ''}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="min-h-[100px]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModal({ ...modal, isOpen: false })}>إلغاء</Button>
                        <Button onClick={handleModalSubmit} disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            إرسال الطلب
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AssignTechnicianModal
                isOpen={modal.isOpen && modal.type === 'ASSIGN_TECH'}
                onClose={() => {
                    setModal(prev => ({ ...prev, isOpen: false }));
                    fetchBoard();
                }}
                machineId={selectedMachineForAssign?.id}
                serialNumber={selectedMachineForAssign?.serialNumber}
            />

            <RepairModal
                isOpen={modal.isOpen && modal.type === 'COMPLETION'}
                onClose={() => setModal({ ...modal, isOpen: false })}
                selectedMachine={machines.find(m => m.id === propPending?.draggableId)}
                isLoading={submitting}
                onSubmit={handleRepairSubmit}
            />
        </div>
    );
};

export default MaintenanceKanban;
