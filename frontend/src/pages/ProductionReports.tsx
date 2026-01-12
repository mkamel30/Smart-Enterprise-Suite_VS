import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
    Building2,
    Package,
    ShoppingCart,
    Calendar,
    TrendingUp,
    Layers
} from 'lucide-react';

// Import new report components
import { GovernoratePerformance } from '../components/reports/GovernoratePerformance';
import { InventoryMovementReport } from '../components/reports/InventoryMovementReport';
import { PosStockReport } from '../components/reports/PosStockReport';
import { PosSalesReport } from '../components/reports/PosSalesReport';
import { ReportsFilters } from '../components/reports/ReportsFilters';

type ReportTab = 'governorate' | 'inventory' | 'stock' | 'salesMonthly' | 'salesDaily';

const TABS: { id: ReportTab; label: string; icon: React.ReactNode }[] = [
    { id: 'governorate', label: 'أداء المحافظات', icon: <Building2 size={18} /> },
    { id: 'inventory', label: 'حركة المخزون', icon: <Package size={18} /> },
    { id: 'stock', label: 'مخزون الأجهزة', icon: <Layers size={18} /> },
    { id: 'salesMonthly', label: 'المبيعات الشهرية', icon: <Calendar size={18} /> },
    { id: 'salesDaily', label: 'المبيعات اليومية', icon: <TrendingUp size={18} /> },
];

export default function ProductionReports() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<ReportTab>('governorate');

    // Check if user is central
    const isCentral = ['SUPER_ADMIN', 'MANAGEMENT'].includes(user?.role || '');

    // Default dates: year to date
    const defaultDates = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return {
            start: `${year}-01-01`,
            end: `${year}-${month}-${day}`
        };
    }, []);

    const [filters, setFilters] = useState({
        startDate: defaultDates.start,
        endDate: defaultDates.end,
        branchId: isCentral ? '' : (user?.branchId || '')
    });

    // Fetch branches for filter dropdown
    const { data: branches } = useQuery<any[]>({
        queryKey: ['branches'],
        queryFn: () => api.getBranches(),
        enabled: isCentral
    });

    // Query for Governorate Performance
    const { data: governorateData, isLoading: isGovLoading } = useQuery({
        queryKey: ['governorate-performance', filters],
        queryFn: () => api.getGovernoratePerformance({
            from: filters.startDate,
            to: filters.endDate,
            branchId: filters.branchId || undefined
        }),
        enabled: activeTab === 'governorate'
    });

    // Query for Inventory Movement
    const { data: inventoryData, isLoading: isInvLoading } = useQuery({
        queryKey: ['inventory-movement', filters],
        queryFn: () => api.getInventoryMovement({
            from: filters.startDate,
            to: filters.endDate,
            branchId: filters.branchId || undefined
        }),
        enabled: activeTab === 'inventory'
    });

    // Query for POS Stock
    const { data: stockData, isLoading: isStockLoading } = useQuery({
        queryKey: ['pos-stock', filters.branchId],
        queryFn: () => api.getPosStock({
            branchId: filters.branchId || undefined
        }),
        enabled: activeTab === 'stock'
    });

    // Query for POS Sales Monthly
    const { data: salesMonthlyData, isLoading: isSalesMonthlyLoading } = useQuery({
        queryKey: ['pos-sales-monthly', filters],
        queryFn: () => api.getPosSalesMonthly({
            from: filters.startDate,
            to: filters.endDate,
            branchId: filters.branchId || undefined
        }),
        enabled: activeTab === 'salesMonthly'
    });

    // Query for POS Sales Daily
    const { data: salesDailyData, isLoading: isSalesDailyLoading } = useQuery({
        queryKey: ['pos-sales-daily', filters],
        queryFn: () => api.getPosSalesDaily({
            from: filters.startDate,
            to: filters.endDate,
            branchId: filters.branchId || undefined
        }),
        enabled: activeTab === 'salesDaily'
    });

    const isLoading =
        (activeTab === 'governorate' && isGovLoading) ||
        (activeTab === 'inventory' && isInvLoading) ||
        (activeTab === 'stock' && isStockLoading) ||
        (activeTab === 'salesMonthly' && isSalesMonthlyLoading) ||
        (activeTab === 'salesDaily' && isSalesDailyLoading);

    const resetFilters = () => {
        setFilters({
            startDate: defaultDates.start,
            endDate: defaultDates.end,
            branchId: isCentral ? '' : (user?.branchId || '')
        });
    };

    return (
        <div className="page-container space-y-8 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-foreground mb-2 flex items-center gap-4">
                        <ShoppingCart className="text-primary hidden sm:block" size={40} />
                        تقارير الإنتاج
                    </h1>
                    <p className="text-muted-foreground font-medium">
                        تقارير تفصيلية عن أداء المحافظات والمخزون والمبيعات
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 bg-muted/50 p-2 rounded-2xl">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all ${activeTab === tab.id
                                ? 'bg-primary text-primary-foreground shadow-lg'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Filter Bar */}
            <ReportsFilters
                filters={filters}
                setFilters={setFilters}
                isCentral={isCentral}
                branches={branches}
                onReset={resetFilters}
            />

            {/* Loading State */}
            {isLoading && (
                <div className="flex h-[50vh] items-center justify-center">
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
                        <p className="text-muted-foreground font-black animate-pulse">جاري تحميل التقرير...</p>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            {!isLoading && (
                <div className="grid grid-cols-1 gap-8">
                    {activeTab === 'governorate' && <GovernoratePerformance data={governorateData} />}
                    {activeTab === 'inventory' && <InventoryMovementReport data={inventoryData} />}
                    {activeTab === 'stock' && <PosStockReport data={stockData} />}
                    {activeTab === 'salesMonthly' && <PosSalesReport data={salesMonthlyData} granularity="monthly" />}
                    {activeTab === 'salesDaily' && <PosSalesReport data={salesDailyData} granularity="daily" />}
                </div>
            )}
        </div>
    );
}
