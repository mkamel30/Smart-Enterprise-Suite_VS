import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { BarChart3 } from 'lucide-react';
import { canPerformAction } from '../lib/permissions';
import { ReportsTabs } from '../components/reports/ReportsTabs';
import { ReportsFilters } from '../components/reports/ReportsFilters';
import { FinancialOverview } from '../components/reports/FinancialOverview';
import { BranchRankings } from '../components/reports/BranchRankings';
import { InventoryAnalytics } from '../components/reports/InventoryAnalytics';
import { AiStrategicAssistant } from '../components/reports/AiStrategicAssistant';

export default function Reports() {
    const { user } = useAuth();

    // Dynamic Permissions
    const canViewExecutive = canPerformAction(user?.role, 'VIEW_EXECUTIVE_SUMMARY');
    const canViewRankings = canPerformAction(user?.role, 'VIEW_BRANCH_RANKINGS');
    const canViewInventory = canPerformAction(user?.role, 'VIEW_INVENTORY_VALUATION');

    // centralRoles logic replacement for filters
    const isCentral = canPerformAction(user?.role, 'VIEW_ALL_BRANCHES');
    const isCenter = user?.role === 'CENTER_MANAGER' || user?.role === 'CENTER_TECH';

    // Set initial tab based on permissions
    const defaultTab = canViewExecutive ? 'financial' : (canViewInventory ? 'inventory' : 'ai');
    const [activeTab, setActiveTab] = useState<'financial' | 'branches' | 'inventory' | 'ai'>(defaultTab);

    // Default dates: 1st of month to today
    const defaultDates = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return {
            start: `${year}-${month}-01`,
            end: `${year}-${month}-${day}`
        };
    }, []);

    const [filters, setFilters] = useState({
        startDate: defaultDates.start,
        endDate: defaultDates.end,
        branchId: isCentral ? '' : (user?.branchId || '')
    });

    const { data: branches } = useQuery<any[]>({
        queryKey: ['branches'],
        queryFn: () => api.getBranches(),
        enabled: !!isCentral // Only fetch branches list for admins
    });

    const { data: executiveData, isLoading: isExecLoading } = useQuery({
        queryKey: ['executive-report', filters],
        queryFn: () => api.getExecutiveReport(filters),
        refetchInterval: 300000 // 5 minutes
    });

    if (isExecLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
                    <p className="text-muted-foreground font-black animate-pulse">جاري إعداد التقارير التحليلية...</p>
                </div>
            </div>
        );
    }

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
                        <BarChart3 className="text-primary hidden sm:block" size={40} />
                        {isCenter ? 'تقرير أداء المركز' : 'مركز التحليلات الاستراتيجية'}
                    </h1>
                    <p className="text-muted-foreground font-medium">
                        {isCenter ? 'مخطط بياني للأداء المالي وحركة المخزون بمركز الصيانة' : 'نظرة شمولية على مؤشرات الأداء المالي والتشغيلي للمؤسسة'}
                    </p>
                </div>

                <ReportsTabs
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    permissions={{
                        financial: canViewExecutive,
                        branches: canViewRankings,
                        inventory: canViewInventory,
                        ai: true // Always visible or add permission if needed
                    }}
                />
            </div>

            {/* Filter Bar */}
            <ReportsFilters
                filters={filters}
                setFilters={setFilters}
                isCentral={isCentral}
                branches={branches}
                onReset={resetFilters}
            />

            {/* Main Content Area */}
            <div className="grid grid-cols-1 gap-8">
                {activeTab === 'financial' && <FinancialOverview data={executiveData} />}
                {activeTab === 'branches' && <BranchRankings data={executiveData} />}
                {activeTab === 'inventory' && <InventoryAnalytics data={executiveData} filters={filters} />}
                {activeTab === 'ai' && <AiStrategicAssistant />}
            </div>
        </div>
    );
}
