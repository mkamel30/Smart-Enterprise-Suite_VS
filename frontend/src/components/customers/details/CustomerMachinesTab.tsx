import React, { useState } from 'react';
import { Monitor, RefreshCw, Plus, Check, X, Edit2, History, Truck, ArrowLeftRight, Wrench } from 'lucide-react';
import { FaHistory } from 'react-icons/fa';

interface CustomerMachinesTabProps {
    customer: any;
    disabledMachines?: Set<string>;
    onCreateRequest?: (customer: any, machine: any) => void;
    onExchange?: (customer: any, machine: any) => void;
    onReturn?: (customer: any, machine: any) => void;
    onViewHistory?: (serialNumber: string) => void;
    onSimPurchase?: (customer: any) => void;
    onSimExchange?: (customer: any, sim: any) => void;
    onSimHistory?: (customer: any, sim: any) => void;
    onSimUpdate?: (id: string, type: string) => void;
}

export default function CustomerMachinesTab({
    customer,
    disabledMachines,
    onCreateRequest,
    onExchange,
    onReturn,
    onViewHistory,
    onSimPurchase,
    onSimExchange,
    onSimHistory,
    onSimUpdate
}: CustomerMachinesTabProps) {
    const [editingSimId, setEditingSimId] = useState<string | null>(null);
    const [tempSimType, setTempSimType] = useState('');

    return (
        <div className="space-y-6">
            {/* Machines Section */}
            <div>
                <header className="flex flex-row-reverse justify-between items-center mb-3">
                    <h4 className="text-lg font-black flex flex-row-reverse items-center gap-2">
                        <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-500">
                            <Monitor size={18} />
                        </div>
                        <span>الماكينات المسجلة ({customer.posMachines?.length || 0})</span>
                    </h4>
                </header>

                {customer.posMachines?.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" dir="rtl">
                        {customer.posMachines.map((machine: any) => {
                            const hasOpenRequest = disabledMachines?.has(machine.id);
                            const isBorrowed = machine.originalOwnerId && machine.originalOwnerId !== customer.bkcode;
                            return (
                                <div
                                    key={machine.id}
                                    className={`group rounded-xl border p-3 transition-all hover:shadow-xl relative overflow-hidden ${isBorrowed ? 'bg-orange-50/50 border-orange-200 shadow-orange-500/5' : 'bg-card border-border hover:border-primary shadow-lg shadow-slate-200/50'
                                        }`}
                                >
                                    {isBorrowed && (
                                        <div className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-black px-4 py-1 rounded-bl-2xl uppercase tracking-widest">
                                            مؤقتة
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <div className="font-mono text-base font-black tracking-tighter flex items-center gap-2">
                                            {machine.serialNumber}
                                        </div>
                                        <div className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-widest">
                                            {machine.model || 'موديل غير محدد'}
                                            {machine.posId && <span className="mr-2 text-primary">[{machine.posId}]</span>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                                        {machine.isMain && (
                                            <span className="bg-blue-500/10 text-blue-500 text-[10px] font-black px-2 py-1 rounded-full">رئيسية</span>
                                        )}
                                        {hasOpenRequest && (
                                            <span className="bg-yellow-500/10 text-yellow-500 text-[10px] font-black px-2 py-1 rounded-full animate-pulse">تحت الصيانة</span>
                                        )}

                                        <div className="flex gap-2 mr-auto">
                                            {onViewHistory && (
                                                <button
                                                    onClick={() => onViewHistory(machine.serialNumber)}
                                                    className="p-2 bg-muted hover:bg-primary/10 hover:text-primary rounded-lg transition-all active:scale-90"
                                                    title="سجل الحركات"
                                                >
                                                    <FaHistory size={14} />
                                                </button>
                                            )}
                                            {onReturn && (
                                                <button
                                                    onClick={() => onReturn(customer, machine)}
                                                    className="p-2 bg-muted hover:bg-orange-500/10 hover:text-orange-500 rounded-lg transition-all active:scale-90"
                                                    title="سحب الماكينة"
                                                >
                                                    <Truck size={14} />
                                                </button>
                                            )}
                                            {onExchange && (
                                                <button
                                                    onClick={() => onExchange(customer, machine)}
                                                    className="p-2 bg-muted hover:bg-emerald-500/10 hover:text-emerald-500 rounded-lg transition-all active:scale-90"
                                                    title="استبدال"
                                                >
                                                    <ArrowLeftRight size={14} />
                                                </button>
                                            )}
                                            {onCreateRequest && (
                                                <button
                                                    onClick={() => onCreateRequest(customer, machine)}
                                                    disabled={hasOpenRequest}
                                                    className={`p-2 rounded-lg transition-all active:scale-90 ${hasOpenRequest ? 'opacity-20 cursor-not-allowed grayscale' : 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20'
                                                        }`}
                                                    title="طلب صيانة"
                                                >
                                                    <Wrench size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-10 border-2 border-dashed border-border rounded-xl text-center">
                        <Monitor size={30} className="mx-auto text-muted-foreground opacity-20 mb-3" />
                        <p className="text-muted-foreground font-black text-sm">لا توجد ماكينات مسجلة حالياً</p>
                    </div>
                )}
            </div>

            {/* SIM Cards Section */}
            <div className="pt-5 border-t border-border/50">
                <header className="flex flex-row-reverse justify-between items-center mb-3">
                    <h4 className="text-lg font-black flex flex-row-reverse items-center gap-2">
                        <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-500">
                            <RefreshCw size={18} />
                        </div>
                        <span>الشرائح ({customer.simCards?.length || 0})</span>
                    </h4>
                    <button
                        onClick={() => onSimPurchase?.(customer)}
                        className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-xl font-black text-xs shadow-lg shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-95 flex flex-row-reverse items-center gap-2"
                    >
                        <Plus size={16} strokeWidth={3} />
                        إضافة شريحة جديدة
                    </button>
                </header>

                {customer.simCards?.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" dir="rtl">
                        {customer.simCards.map((sim: any) => (
                            <div
                                key={sim.id}
                                className="bg-card border border-border group rounded-xl p-3 transition-all hover:shadow-xl shadow-lg shadow-slate-200/50"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="font-mono text-base font-black tracking-tighter">
                                        {sim.serialNumber}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => onSimHistory?.(customer, sim)}
                                            className="p-2 bg-muted hover:bg-purple-500/10 hover:text-purple-500 rounded-lg transition-all active:scale-90"
                                            title="سجل الحركات"
                                        >
                                            <FaHistory size={14} />
                                        </button>
                                        <button
                                            onClick={() => onSimExchange?.(customer, sim)}
                                            className="p-2 bg-muted hover:bg-orange-500/10 hover:text-orange-500 rounded-lg transition-all active:scale-90"
                                            title="استبدال الشريحة"
                                        >
                                            <RefreshCw size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 flex items-center justify-between">
                                    {editingSimId === sim.id ? (
                                        <div className="flex items-center gap-2 w-full animate-in slide-in-from-left-2">
                                            <select
                                                value={tempSimType}
                                                onChange={(e) => setTempSimType(e.target.value)}
                                                className="bg-muted border-none rounded-xl p-2 text-xs font-black flex-1 outline-none ring-2 ring-primary/20"
                                            >
                                                <option value="">نوع غير محدد</option>
                                                <option value="Vodafone">Vodafone</option>
                                                <option value="Orange">Orange</option>
                                                <option value="Etisalat">Etisalat</option>
                                                <option value="WE">WE</option>
                                            </select>
                                            <button
                                                onClick={() => { onSimUpdate?.(sim.id, tempSimType); setEditingSimId(null); }}
                                                className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 active:scale-90"
                                            >
                                                <Check size={16} strokeWidth={3} />
                                            </button>
                                            <button
                                                onClick={() => setEditingSimId(null)}
                                                className="p-2 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 active:scale-90"
                                            >
                                                <X size={16} strokeWidth={3} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${sim.type === 'Vodafone' ? 'bg-red-500/10 text-red-500' :
                                                    sim.type === 'Orange' ? 'bg-orange-500/10 text-orange-500' :
                                                        sim.type === 'Etisalat' ? 'bg-emerald-500/10 text-emerald-500' :
                                                            sim.type === 'WE' ? 'bg-purple-500/10 text-purple-500' :
                                                                'bg-slate-500/10 text-slate-500'
                                                }`}>
                                                {sim.type || 'غير محدد'}
                                            </span>
                                            <button
                                                onClick={() => { setEditingSimId(sim.id); setTempSimType(sim.type || ''); }}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-primary transition-all rounded-lg"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-12 border-2 border-dashed border-border rounded-xl text-center">
                        <RefreshCw size={36} className="mx-auto text-muted-foreground opacity-20 mb-4" />
                        <p className="text-muted-foreground font-black text-sm">لا توجد شرائح مسجلة حالياً</p>
                    </div>
                )}
            </div>
        </div>
    );
}
