import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { api } from '../../api/client';
import { Loader2, UserPlus, Play, Wrench, Search, Clock, CheckCircle, X, Hash, Info, FileText, DollarSign, Package, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent } from '../ui/dialog';
import toast from 'react-hot-toast';
import { RepairModal } from './RepairModal';
import { AssignTechnicianModal } from './AssignTechnicianModal';
import { translateStatus } from '../../lib/translations';
import { cn } from '../../lib/utils';

const COLUMNS = {
    RECEIVED_AT_CENTER: { title: 'تم الاستلام', color: 'bg-blue-50/50', headerColor: 'bg-blue-100', borderColor: 'border-blue-200', icon: <Package size={18} /> },
    ASSIGNED: { title: 'تم التعيين', color: 'bg-indigo-50/50', headerColor: 'bg-indigo-100', borderColor: 'border-indigo-200', icon: <UserPlus size={18} /> },
    UNDER_INSPECTION: { title: 'تحت الفحص', color: 'bg-yellow-50/50', headerColor: 'bg-yellow-100', borderColor: 'border-yellow-200', icon: <Search size={18} /> },
    AWAITING_APPROVAL: { title: 'بانتظار الموافقة', color: 'bg-orange-50/50', headerColor: 'bg-orange-100', borderColor: 'border-orange-200', icon: <Clock size={18} /> },
    IN_PROGRESS: { title: 'جاري الإصلاح', color: 'bg-purple-50/50', headerColor: 'bg-purple-100', borderColor: 'border-purple-200', icon: <Wrench size={18} /> },
    READY_FOR_RETURN: { title: 'جاهز للإرجاع', color: 'bg-green-50/50', headerColor: 'bg-green-100', borderColor: 'border-green-200', icon: <CheckCircle size={18} /> }
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
            setMachines(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to load Kanban:', error);
            toast.error('فشل تحميل البيانات');
        } finally {
            setLoading(false);
        }
    };

    const getColumnMachines = (status: string) => {
        return Array.isArray(machines) ? machines.filter(m => m.status === status) : [];
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
        const originalMachines = [...(Array.isArray(machines) ? machines : [])];
        // Optimistic update
        setMachines(prev => (Array.isArray(prev) ? prev : []).map(m =>
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
        <div className="flex flex-col items-center justify-center p-20 text-slate-400 space-y-6">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <Wrench size={24} className="text-blue-500 animate-pulse" />
                </div>
            </div>
            <div className="flex flex-col items-center space-y-2">
                <span className="font-black text-slate-900 text-lg">جاري تحميل لوحة التحكم الذكية...</span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Optimizing Workflow View</span>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50/30">
            <div className="flex-none p-6 pb-2 flex justify-between items-center group">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-blue-600 transition-transform group-hover:rotate-12 duration-500">
                        <Wrench size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 leading-tight">سير عمل الصيانة (Kanban)</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Monitoring Active</span>
                        </div>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    onClick={fetchBoard}
                    size="sm"
                    className="h-12 px-6 rounded-2xl border-2 border-slate-100 bg-white font-black text-slate-600 hover:bg-slate-50 hover:border-slate-200 transition-all hover:translate-y-[-2px] active:translate-y-0"
                >
                    تحديث البيانات
                </Button>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 custom-scroll">
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="flex h-full gap-8 min-w-max pb-4">
                        {Object.entries(COLUMNS).map(([status, col]: [string, any]) => (
                            <div key={status} className={cn(
                                "flex flex-col w-[340px] rounded-[2.5rem] border-2 transition-all duration-500 max-h-full overflow-hidden shadow-sm",
                                col.borderColor,
                                col.color,
                                "hover:shadow-xl hover:shadow-slate-200/50"
                            )}>
                                {/* Column Header */}
                                <div className={cn(
                                    "p-6 flex justify-between items-center border-b-2 relative overflow-hidden",
                                    col.borderColor,
                                    col.headerColor
                                )}>
                                    <div className="absolute right-0 top-0 opacity-10 scale-150 translate-x-1/4 -translate-y-1/4 pointer-events-none">
                                        {col.icon}
                                    </div>
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className="p-2.5 bg-white/60 backdrop-blur-sm rounded-xl shadow-sm text-slate-700">
                                            {col.icon}
                                        </div>
                                        <h3 className="font-black text-slate-800 text-lg tracking-tight">{col.title}</h3>
                                    </div>
                                    <span className="bg-white px-3 py-1 rounded-full text-xs font-black text-slate-600 shadow-sm border border-slate-100 relative z-10">
                                        {getColumnMachines(status).length}
                                    </span>
                                </div>

                                {/* Droppable Area */}
                                <Droppable droppableId={status}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className={cn(
                                                "flex-1 p-5 overflow-y-auto min-h-[150px] custom-scroll transition-all duration-300",
                                                snapshot.isDraggingOver ? "bg-white/40 scale-[0.98]" : ""
                                            )}
                                        >
                                            {getColumnMachines(status).map((machine, index) => (
                                                <Draggable key={machine.id} draggableId={machine.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={cn(
                                                                "bg-white p-6 mb-5 rounded-[1.8rem] shadow-sm border border-slate-100 transition-all duration-500 group relative overflow-hidden",
                                                                snapshot.isDragging ? "rotate-3 shadow-2xl ring-4 ring-blue-500/20 scale-105 z-[1000] border-blue-200" : "hover:shadow-xl hover:translate-y-[-4px] hover:border-slate-200"
                                                            )}
                                                        >
                                                            <div className="flex justify-between items-start mb-4">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Serial Number</span>
                                                                    <span className="font-mono text-base font-black text-slate-900 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 shadow-inner">
                                                                        {machine.serialNumber}
                                                                    </span>
                                                                </div>
                                                                {machine.resolution && (
                                                                    <span className={cn(
                                                                        "text-[10px] px-3 py-1.5 rounded-xl font-black uppercase tracking-widest border shadow-sm",
                                                                        machine.resolution === 'REPAIRED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                                            machine.resolution === 'SCRAPPED' ? 'bg-red-50 text-red-700 border-red-100' :
                                                                                'bg-slate-50 text-slate-600 border-slate-100'
                                                                    )}>
                                                                        {translateStatus(machine.resolution)}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="mb-4">
                                                                <h4 className="text-sm font-black text-slate-700 leading-tight line-clamp-1">{machine.model || 'Unknown Model'}</h4>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{machine.manufacturer || 'Unbranded'}</span>
                                                            </div>

                                                            {machine.notes && (
                                                                <div className="text-[11px] font-bold text-slate-500 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 line-clamp-2 mb-4 italic leading-relaxed">
                                                                    "{machine.notes}"
                                                                </div>
                                                            )}

                                                            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-50">
                                                                {machine.currentTechnicianName ? (
                                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 overflow-hidden">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                                        <span className="text-[10px] font-black uppercase tracking-tight">{machine.currentTechnicianName}</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Unassigned</div>
                                                                )}
                                                            </div>

                                                            {(machine.status === 'RECEIVED_AT_CENTER') && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="w-full mt-4 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs gap-3 shadow-lg shadow-indigo-100 active:scale-95 transition-all transition-duration-500"
                                                                    onClick={() => {
                                                                        setSelectedMachineForAssign(machine);
                                                                        setModal({ type: 'ASSIGN_TECH', isOpen: true });
                                                                    }}
                                                                >
                                                                    <UserPlus size={16} strokeWidth={3} />
                                                                    تعيين فني مختص
                                                                </Button>
                                                            )}

                                                            {(machine.status === 'ASSIGNED') && (
                                                                <>
                                                                    {machine.currentTechnicianId === user?.id ? (
                                                                        <Button
                                                                            size="sm"
                                                                            className="w-full mt-4 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-3 shadow-lg shadow-emerald-100 active:scale-95 transition-all"
                                                                            onClick={() => {
                                                                                setPropPending({
                                                                                    draggableId: machine.id,
                                                                                    source: { droppableId: 'ASSIGNED' },
                                                                                    destination: { droppableId: 'UNDER_INSPECTION' }
                                                                                });
                                                                                setFormData({ notes: '' });
                                                                                setModal({ type: 'INSPECTION', isOpen: true });
                                                                            }}
                                                                        >
                                                                            <Play size={16} strokeWidth={3} className="fill-current" />
                                                                            بدء عملية الفحص
                                                                        </Button>
                                                                    ) : (
                                                                        (user?.role === 'CENTER_MANAGER' || user?.role === 'SUPER_ADMIN') && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="w-full mt-4 h-12 rounded-2xl bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-100 border border-transparent font-black text-xs gap-3 transition-all"
                                                                                onClick={() => {
                                                                                    setSelectedMachineForAssign(machine);
                                                                                    setModal({ type: 'ASSIGN_TECH', isOpen: true });
                                                                                }}
                                                                            >
                                                                                <UserPlus size={16} strokeWidth={3} />
                                                                                إعادة تعيين فني
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
                <DialogContent className="p-0 border-0 flex flex-col max-h-[90vh] h-auto overflow-hidden sm:max-w-xl rounded-[2.5rem] shadow-2xl bg-white [&>button]:hidden text-right" dir="rtl">
                    <div className="modal-header shrink-0 p-8 pb-6 bg-gradient-to-br from-indigo-600 to-indigo-800 relative overflow-hidden text-right">
                        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                            <div className="absolute top-[-50%] left-[-20%] w-[100%] h-[150%] bg-white rounded-full blur-[80px]"></div>
                        </div>
                        <div className="modal-header-content relative z-10 text-right">
                            <div className="flex items-center gap-4 justify-end sm:justify-start">
                                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl text-white">
                                    <Search size={24} strokeWidth={3} />
                                </div>
                                <div className="text-right">
                                    <h2 className="modal-title font-black text-white leading-tight tracking-tight text-xl">بدء فحص الماكينة</h2>
                                    <p className="text-indigo-100 font-bold text-[10px] uppercase tracking-widest opacity-80 mt-1">Inspection Activation Workflow</p>
                                </div>
                            </div>
                        </div>
                        <button type="button" className="modal-close bg-white/10 hover:bg-white/20 text-white p-2 rounded-xl transition-all" onClick={() => setModal({ ...modal, isOpen: false })}>
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/30 custom-scroll text-right">
                        <div className="space-y-4">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none justify-end">
                                ملاحظات الفحص والتشخيص المبدئي
                                <FileText size={14} className="text-indigo-400" />
                            </label>
                            <Textarea
                                placeholder="اكتب ملاحظات الفحص هنا... (مثال: الشاشة مكسورة، الجهاز لا يعمل بالكهرباء)"
                                value={formData.notes || ''}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="smart-input min-h-[160px] p-6 text-sm font-bold bg-white border-2 border-slate-100 focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 resize-none transition-all duration-500"
                            />
                        </div>

                        <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center gap-4">
                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                                <Info size={16} />
                            </div>
                            <p className="text-[11px] font-bold text-indigo-700 leading-relaxed text-right">سيتم تحويل حالة الماكينة تلقائياً إلى <span className="font-black">تحت الفحص</span> وإخطار مدير المركز ببدء العمل.</p>
                        </div>
                    </div>

                    <div className="modal-footer p-8 bg-white border-t border-slate-100 shrink-0 flex gap-4">
                        <button type="button" onClick={() => setModal({ ...modal, isOpen: false })} className="smart-btn-secondary h-14 px-8 border-2 border-slate-100 text-slate-500 font-black">إلغاء</button>
                        <button
                            onClick={handleModalSubmit}
                            disabled={submitting}
                            className="smart-btn-primary flex-1 h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base flex items-center justify-center gap-3 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                        >
                            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle size={20} strokeWidth={3} />}
                            تأكيد وبدء الفحص الآن
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Approval Modal */}
            <Dialog open={modal.isOpen && modal.type === 'APPROVAL'} onOpenChange={(open) => !open && setModal({ ...modal, isOpen: false })}>
                <DialogContent className="p-0 border-0 flex flex-col max-h-[90vh] h-auto overflow-hidden sm:max-w-xl rounded-[2.5rem] shadow-2xl bg-white [&>button]:hidden text-right" dir="rtl">
                    <div className="modal-header shrink-0 p-8 pb-6 bg-gradient-to-br from-orange-500 to-amber-600 relative overflow-hidden text-right">
                        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                            <div className="absolute top-[-50%] right-[-20%] w-[100%] h-[150%] bg-white rounded-full blur-[80px]"></div>
                        </div>
                        <div className="modal-header-content relative z-10 text-right">
                            <div className="flex items-center gap-4 justify-end sm:justify-start">
                                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl text-white">
                                    <Clock size={24} strokeWidth={3} />
                                </div>
                                <div className="text-right">
                                    <h2 className="modal-title font-black text-white leading-tight tracking-tight text-xl">طلب موافقة للإصلاح</h2>
                                    <p className="text-orange-50 font-bold text-[10px] uppercase tracking-widest opacity-80 mt-1">Pending Approval Request</p>
                                </div>
                            </div>
                        </div>
                        <button type="button" className="modal-close bg-white/10 hover:bg-white/20 text-white p-2 rounded-xl transition-all" onClick={() => setModal({ ...modal, isOpen: false })}>
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/30 custom-scroll text-right">
                        <div className="grid grid-cols-1 gap-8">
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none justify-end">
                                    التكلفة التقديرية (ج.م)
                                    <DollarSign size={14} className="text-orange-500" />
                                </label>
                                <div className="relative group/price">
                                    <div className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-300 text-xs tracking-widest">EGP</div>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={formData.cost || ''}
                                        onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
                                        className="smart-input h-20 pl-16 pr-8 text-2xl font-black bg-white border-2 border-slate-100 focus:border-orange-500 focus:ring-8 focus:ring-orange-500/5 transition-all text-orange-600 font-mono tracking-tighter"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none justify-end">
                                    قطع الغيار المطلوبة
                                    <Package size={14} className="text-orange-500" />
                                </label>
                                <Input
                                    placeholder="مثال: شاشة سامسونج كاشف، بوردة أصلية..."
                                    value={formData.parts || ''}
                                    onChange={(e) => setFormData({ ...formData, parts: e.target.value })}
                                    className="smart-input h-16 px-6 font-bold bg-white border-2 border-slate-100 focus:border-orange-500 transition-all placeholder:text-slate-200"
                                />
                            </div>

                            <div className="space-y-4 text-right">
                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none justify-end">
                                    ملاحظات إضافية للفني أو العميل
                                    <FileText size={14} className="text-slate-300" />
                                </label>
                                <Textarea
                                    placeholder="..."
                                    value={formData.notes || ''}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="smart-input min-h-[120px] p-5 text-sm font-bold bg-white border-2 border-slate-100 focus:border-orange-500 resize-none transition-all duration-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer p-8 bg-white border-t border-slate-100 shrink-0 flex gap-4 overflow-hidden relative">
                        <div className="absolute right-0 bottom-0 w-40 h-40 bg-orange-50 rounded-full blur-[60px] opacity-30 -mr-20 -mb-20"></div>
                        <button type="button" onClick={() => setModal({ ...modal, isOpen: false })} className="smart-btn-secondary h-16 px-10 border-2 border-slate-100 text-slate-500 font-black relative z-10 transition-all hover:bg-slate-50">إلغاء الطلب</button>
                        <button
                            onClick={handleModalSubmit}
                            disabled={submitting}
                            className="smart-btn-primary flex-1 h-16 bg-slate-900 border-b-4 border-black hover:bg-slate-800 text-white font-black text-lg flex items-center justify-center gap-4 relative z-10 shadow-xl shadow-slate-200"
                        >
                            {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles size={24} className="text-orange-400" />}
                            إرسال طلب الموافقة
                        </button>
                    </div>
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
                selectedMachine={Array.isArray(machines) ? machines.find(m => m.id === propPending?.draggableId) : undefined}
                isLoading={submitting}
                onSubmit={handleRepairSubmit}
            />
        </div>
    );
};

export default MaintenanceKanban;
