import React, { useState } from 'react';
import { api } from '../api/client';
import { Lock, Palette, Database, Users, Shield } from 'lucide-react';
import { DatabaseAdmin } from '../components/DatabaseAdmin';
import { ROLES } from '../lib/permissions';
import { useAuth } from '../context/AuthContext';

// Import extracted tabs
import { SecurityTab } from '../components/settings/SecurityTab';
import { AppearanceTab } from '../components/settings/AppearanceTab';
import { MachineParametersTab } from '../components/settings/MachineParametersTab';
import { SparePartsTab } from '../components/settings/SparePartsTab';
import { ClientTypesTab } from '../components/settings/ClientTypesTab';
import { PermissionsTab } from '../components/settings/PermissionsTab';

export default function Settings() {
    const { user } = useAuth();
    const isAdmin = user?.role === ROLES.SUPER_ADMIN || user?.role === ROLES.MANAGEMENT;
    const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;

    const [activeTab, setActiveTab] = useState<'machines' | 'parts' | 'database' | 'appearance' | 'security' | 'client-types' | 'permissions'>(
        isAdmin ? 'machines' : 'appearance'
    );

    return (
        <div className="px-4 sm:px-8 pt-2 pb-6 space-y-6 animate-fade-in" dir="rtl">
            <h1 className="text-3xl font-black text-foreground mb-4">الإعدادات النظامية</h1>

            <div className="flex gap-3 mb-8 flex-wrap">
                <TabButton
                    active={activeTab === 'security'}
                    onClick={() => setActiveTab('security')}
                    icon={<Lock size={16} />}
                    label="الأمان"
                />
                <TabButton
                    active={activeTab === 'appearance'}
                    onClick={() => setActiveTab('appearance')}
                    icon={<Palette size={16} />}
                    label="المظهر والخطوط"
                />

                {isAdmin && (
                    <>
                        <TabButton
                            active={activeTab === 'machines'}
                            onClick={() => setActiveTab('machines')}
                            label="بارامترات الماكينات"
                        />
                        <TabButton
                            active={activeTab === 'parts'}
                            onClick={() => setActiveTab('parts')}
                            label="قانون قطع الغيار"
                        />
                        <TabButton
                            active={activeTab === 'client-types'}
                            onClick={() => setActiveTab('client-types')}
                            icon={<Users size={16} />}
                            label="تصنيفات العملاء"
                        />
                        <TabButton
                            active={activeTab === 'permissions'}
                            onClick={() => setActiveTab('permissions')}
                            icon={<Shield size={16} />}
                            label="الصلاحيات"
                            color="purple"
                        />
                    </>
                )}

                {isSuperAdmin && (
                    <TabButton
                        active={activeTab === 'database'}
                        onClick={() => setActiveTab('database')}
                        icon={<Database size={16} />}
                        label="قاعدة البيانات"
                        color="red"
                    />
                )}
            </div>

            <div className="space-y-6">
                {activeTab === 'machines' && <MachineParametersTab />}
                {activeTab === 'parts' && <SparePartsTab />}
                {activeTab === 'client-types' && <ClientTypesTab />}
                {activeTab === 'appearance' && <AppearanceTab />}
                {activeTab === 'security' && <SecurityTab />}
                {activeTab === 'permissions' && isAdmin && <PermissionsTab />}
                {activeTab === 'database' && isSuperAdmin && (
                    <div className="bg-card rounded-[2rem] border border-border shadow-2xl p-8">
                        <DatabaseAdmin />
                    </div>
                )}
            </div>
        </div>
    );
}

function TabButton({ active, onClick, label, icon, color }: any) {
    const baseClasses = "flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all active:scale-[0.98]";
    const colors: any = {
        default: active ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted hover:bg-accent text-muted-foreground',
        purple: active ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20',
        red: active ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-red-500/10 text-red-600 hover:bg-red-500/20',
    };

    return (
        <button onClick={onClick} className={`${baseClasses} ${colors[color || 'default']}`}>
            {icon}
            {label}
        </button>
    );
}


// End of Settings Page

