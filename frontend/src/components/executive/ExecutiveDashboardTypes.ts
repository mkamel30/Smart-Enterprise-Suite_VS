export interface ForecastPrediction {
    month: string;
    predicted: number;
    upperBound: number;
    lowerBound: number;
    confidence: number;
}

export interface BranchDrillDown {
    branch: { id: string; name: string; code: string; type: string };
    revenue: {
        currentMonth: number;
        byType: { type: string; amount: number }[];
        trend: { month: string; amount: number }[];
    };
    requests: {
        total: number;
        distribution: Record<string, number>;
        closedCount: number;
        avgResolutionDays: number;
        closureRate: number;
    };
    inventory: {
        total: number;
        lowStockCount: number;
        outOfStockCount: number;
        lowStockItems: { name: string; quantity: number; minLevel: number }[];
        outOfStockItems: { name: string }[];
    };
    team: {
        total: number;
        active: number;
        byRole: { technicians: number; supervisors: number };
        topPerformers: { name: string; closedCount: number; revenue: number }[];
    };
    topCustomers: { id: string; name: string; bkcode: string; machineCount: number }[];
    recentActivity: { id: string; amount: number; type: string; createdAt: string }[];
}

export interface ExecutiveData {
    summary: {
        dateRange: { start: string; end: string };
        totalRevenue: number;
        previousRevenue: number;
        revenueChange: number;
        pendingDebts: number;
        overdueDebts: number;
        closureRate: number;
        avgResolutionTime: number;
        overdueRequests: number;
        inventoryHealth: number;
        machineSales?: {
            cash: { count: number; amount: number };
            installment: { count: number; amount: number };
        };
        freePartsValue: number;
        paidPartsRevenue: number;
    };
    revenueBreakdown: { type: string; amount: number }[];
    inventoryStatus: {
        inStock: number;
        lowStock: number;
        critical: number;
        outOfStock: number;
        total: number;
    };
    branchSummary: {
        id: string;
        name: string;
        code: string;
        revenue: number;
        activeRequests: number;
        closedRequests: number;
        closureRate: number;
    }[];
    monthlyTrend: { name: string; total: number; maintenance: number; sales: number; parts: number }[];
    technicianProductivity: { name: string; closedRequests: number; revenue: number }[];
    alerts: { type: string; severity: string; message: string; count?: number; amount?: number }[];
    pendingActions: { approvals: number; transfers: number };
    quickCounts: {
        totalMachines: number;
        totalCustomers: number;
        pendingApprovals: number;
        pendingTransfers: number;
        totalRequests: number;
        closedRequests: number;
    };
    forecast?: {
        predictions: ForecastPrediction[];
        growthRate: number;
        algorithm: string;
        lastUpdated: string;
    };
}
