import React from 'react';
import { Monitor, CreditCard } from 'lucide-react';

interface CustomerQuickListProps {
    customers: any[];
    onSelectCustomer: (code: string) => void;
}

export default function CustomerQuickList({
    customers,
    onSelectCustomer
}: CustomerQuickListProps) {
    return (
        <div className="bg-card rounded-[2rem] border border-border shadow-xl overflow-hidden animate-fade-in mt-8">
            <div className="p-8 border-b border-border bg-muted/20 text-right">
                <h3 className="text-xl font-black">دليل العملاء</h3>
                <p className="text-sm text-muted-foreground mt-1">اضغط على عميل لعرض التفاصيل الكاملة</p>
            </div>
            <div className="max-h-[600px] overflow-y-auto custom-scroll">
                {customers?.length === 0 ? (
                    <div className="p-20 text-center">
                        <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
                            <Monitor size={30} className="text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground font-bold">لا يوجد عملاء متاحين للفرع المختار</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 divide-y divide-border/50">
                        {customers?.slice(0, 50).map((customer: any) => (
                            <button
                                key={customer.bkcode}
                                onClick={() => onSelectCustomer(customer.bkcode)}
                                className="w-full text-right p-6 hover:bg-primary/5 transition-all flex flex-row-reverse justify-between items-center group"
                            >
                                <div className="space-y-1">
                                    <div className="font-black text-lg group-hover:text-primary transition-colors">{customer.client_name}</div>
                                    <div className="flex items-center gap-2">
                                        <span className="bg-muted px-2 py-0.5 rounded text-[10px] font-black text-muted-foreground">كود: {customer.bkcode}</span>
                                        {customer.branch?.name && (
                                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-black">{customer.branch.name}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-6">
                                    <div className="flex flex-col items-center">
                                        <div className="p-2 bg-blue-500/5 text-blue-500 rounded-lg group-hover:bg-blue-500 group-hover:text-white transition-all">
                                            <Monitor size={18} />
                                        </div>
                                        <span className="text-[10px] font-black mt-1">{customer.posMachines?.length || 0}</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="p-2 bg-purple-500/5 text-purple-500 rounded-lg group-hover:bg-purple-500 group-hover:text-white transition-all">
                                            <CreditCard size={18} />
                                        </div>
                                        <span className="text-[10px] font-black mt-1">{customer.simCards?.length || 0}</span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            {customers?.length > 50 && (
                <div className="p-4 bg-muted/10 text-center border-t border-border">
                    <p className="text-xs text-muted-foreground font-bold">يتم عرض أول 50 عميل فقط. استخدم البحث للعثور على عملاء آخرين.</p>
                </div>
            )}
        </div>
    );
}
