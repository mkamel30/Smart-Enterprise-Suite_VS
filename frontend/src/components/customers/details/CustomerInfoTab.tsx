import React from 'react';
import { MapPin, Phone, User, FileText, Monitor, Landmark, Building2, Tag } from 'lucide-react';

interface InfoRowProps {
    icon: React.ReactNode;
    label: string;
    value?: string;
    colorClass?: string;
}

function InfoRow({ icon, label, value, colorClass = "text-slate-400" }: InfoRowProps) {
    return (
        <div className="bg-card/50 border border-border p-6 rounded-[1.5rem] group hover:bg-card transition-all hover:shadow-xl shadow-slate-200/50">
            <div className="flex items-start gap-4">
                <div className={`${colorClass} p-3 bg-muted rounded-2xl group-hover:bg-primary group-hover:text-white transition-all`}>
                    {icon}
                </div>
                <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{label}</div>
                    <div className="font-bold text-lg text-foreground">{value || '-'}</div>
                </div>
            </div>
        </div>
    );
}

export default function CustomerInfoTab({ customer }: { customer: any }) {
    return (
        <div className="space-y-10 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InfoRow icon={<MapPin size={22} />} label="العنوان الجغرافي" value={customer.address} colorClass="text-emerald-500" />
                <InfoRow icon={<Phone size={22} />} label="رقم التواصل الأساسي" value={customer.telephone_1} colorClass="text-blue-500" />
                <InfoRow icon={<Phone size={22} />} label="رقم التواصل البديل" value={customer.telephone_2} colorClass="text-indigo-500" />
                <InfoRow icon={<User size={22} />} label="الشخص المسؤول" value={customer.contact_person} colorClass="text-purple-500" />
                <InfoRow icon={<Landmark size={22} />} label="الرقم القومي / السجل" value={customer.national_id} colorClass="text-rose-500" />
                <InfoRow icon={<Building2 size={22} />} label="مكتب التموين" value={customer.supply_office} colorClass="text-amber-500" />
                <InfoRow icon={<Tag size={22} />} label="نوع النشاط" value={customer.bk_type} colorClass="text-cyan-500" />
                <InfoRow icon={<Monitor size={22} />} label="تصنيف العميل" value={customer.clienttype} colorClass="text-orange-500" />
                <InfoRow icon={<FileText size={22} />} label="القسم التابع له" value={customer.dept} colorClass="text-slate-500" />
            </div>

            {customer.notes && (
                <div className="bg-card border-2 border-primary/10 p-8 rounded-[2rem] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-125 transition-transform">
                        <FileText size={80} />
                    </div>
                    <h4 className="text-xl font-black mb-4 flex items-center gap-3 text-primary">
                        <FileText size={22} />
                        ملاحظات إضافية
                    </h4>
                    <p className="text-foreground font-bold leading-relaxed relative z-10">{customer.notes}</p>
                </div>
            )}
        </div>
    );
}
