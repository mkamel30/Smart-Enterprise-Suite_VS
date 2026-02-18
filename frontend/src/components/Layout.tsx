import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { DashboardStats } from '../lib/types';
import { useState, useMemo } from 'react';
import StatusBar from './StatusBar';
import NotificationBell from './NotificationBell';
import BranchSwitcher from './BranchSwitcher';
import { canAccessRoute } from '../lib/permissions';
import {
    LayoutDashboard,
    Settings,
    Package,
    DollarSign,
    FileText,
    ClipboardList,
    Monitor,
    BarChart3,
    Building,
    LogOut,
    UserCircle,
    ChevronDown,
    Box,
    Wallet,
    Smartphone,
    CheckCircle,
    ZoomIn,
    ZoomOut,
    Wrench,
    Eye,
    Truck,
    TrendingUp,
    Database
} from 'lucide-react';
import { Menu } from 'lucide-react';

interface BaseNavItem {
    label: string;
    icon: React.ElementType;
}

interface NavGroup extends BaseNavItem {
    children: { path: string; label: string; icon: React.ElementType }[];
}

interface SingleNavItem extends BaseNavItem {
    path: string;
}

type NavItem = NavGroup | SingleNavItem;

const allNavItems: NavItem[] = [
    // 1. لوحات التحكم
    {
        label: 'لوحات التحكم',
        icon: LayoutDashboard,
        children: [
            { path: '/', label: 'لوحة التحكم الرئيسية', icon: LayoutDashboard },
            { path: '/executive-dashboard', label: 'لوحة الإدارة العليا', icon: TrendingUp },
        ]
    },
    // 2. الصيانة
    {
        label: 'الصيانة',
        icon: Wrench,
        children: [
            { path: '/requests', label: 'طلبات الصيانة', icon: ClipboardList },
            { path: '/maintenance/shipments', label: 'الشحنات الواردة', icon: Truck },
            { path: '/maintenance-center', label: 'مركز الصيانة', icon: Wrench },
            { path: '/maintenance-approvals', label: 'موافقات الصيانة', icon: CheckCircle },
            { path: '/track-machines', label: 'متابعة الماكينات', icon: Eye },
            { path: '/pending-payments', label: 'المستحقات المعلقة', icon: Wallet },
        ]
    },
    // 3. العملاء والمبيعات
    {
        label: 'العملاء والمبيعات',
        icon: Building,
        children: [
            { path: '/customers', label: 'العملاء', icon: Building },
            { path: '/receipts', label: 'المبيعات والأقساط', icon: FileText },
            { path: '/payments', label: 'المدفوعات', icon: Wallet },
        ]
    },
    // 4. المخازن والنقل
    {
        label: 'المخازن والنقل',
        icon: Package,
        children: [
            { path: '/warehouse', label: 'قطع الغيار', icon: Box },
            { path: '/warehouse-machines', label: 'مخزن الماكينات', icon: Monitor },
            { path: '/warehouse-sims', label: 'مخزن الشرائح', icon: Smartphone },
            { path: '/transfer-orders', label: 'أذونات الصرف', icon: FileText },
            { path: '/receive-orders', label: 'استلام الأذونات', icon: Package },
        ]
    },
    // 5. الشئون الإدارية
    {
        label: 'الشئون الإدارية',
        icon: Building,
        children: [
            { path: '/admin-store', label: 'المخزن الإداري', icon: Package },
            { path: '/admin-store/settings', label: 'الإعدادات الإدارية', icon: Settings },
        ]
    },
    // 6. الإدارة والتقارير
    {
        label: 'الإدارة والتقارير',
        icon: Settings,
        children: [
            { path: '/reports', label: 'التقارير', icon: BarChart3 },
            { path: '/technicians', label: 'المستخدمين', icon: UserCircle },
            { path: '/approvals', label: 'الموافقات', icon: CheckCircle },
            { path: '/admin/backups', label: 'النسخ الاحتياطية', icon: Database },
            { path: '/branches', label: 'الفروع', icon: Building },
            { path: '/settings', label: 'الإعدادات', icon: Settings },
        ]
    }
];

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout, activeBranchId } = useAuth();

    // Zoom state (100 = 100%, min 70%, max 150%)
    const [zoomLevel, setZoomLevel] = useState(100);

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 5, 150));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 5, 70));

    // Filter nav items based on user role
    const navItems = useMemo(() => {
        const userRole = user?.role || null;

        // Initial filtering based on permissions
        let items = allNavItems.map(item => {
            if ('children' in item) {
                const filteredChildren = item.children.filter(child =>
                    canAccessRoute(userRole, child.path)
                );
                if (filteredChildren.length === 0) return null;
                return { ...item, children: [...filteredChildren] };
            }
            if ('path' in item) {
                return canAccessRoute(userRole, (item as SingleNavItem).path) ? item : null;
            }
            return null;
        }).filter((item): item is NavItem => item !== null);

        // Specialized structural regrouping for Administrative Affairs role
        if (userRole === 'ADMIN_AFFAIRS') {
            const adminGroup = items.find(i => i.label === 'مركز الإدارة والمخازن' || i.label === 'الشئون الإدارية') as NavGroup;
            const warehouseGroup = items.find(i => i.label === 'المخازن والنقل') as NavGroup;

            if (adminGroup && warehouseGroup) {
                adminGroup.label = 'مركز الإدارة والمخازن';
                adminGroup.children = [
                    { path: '/', label: 'لوحة التحكم الإدارية', icon: LayoutDashboard },
                    { path: '/admin-store', label: 'المخزن الإداري (الرئيسي)', icon: Package },
                    { path: '/transfer-orders', label: 'أذونات الصرف والتحويل', icon: FileText },
                    { path: '/admin-store/settings', label: 'الإعدادات والتصنيفات', icon: Settings },
                ];
                // Remove the redundant general warehouse group
                return items.filter(i => i.label !== 'المخازن والنقل');
            }
        }

        // Limit sidebar for SUPER_ADMIN as requested
        if (userRole === 'SUPER_ADMIN') {
            return items.filter(i =>
                i.label === 'لوحات التحكم' ||
                i.label === 'الإدارة والتقارير'
            );
        }

        return items;
    }, [user?.role]);

    // State for expanded groups
    const [expandedGroups, setExpandedGroups] = useState<string[]>(['المخازن', 'المالية والمبيعات', 'الإدارة']);

    const toggleGroup = (label: string) => {
        setExpandedGroups(prev =>
            prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]
        );
    };

    // Fetch stats for the sidebar badge
    const { data: stats } = useQuery<DashboardStats>({
        queryKey: ['dashboard-stats', activeBranchId],
        queryFn: () => api.getDashboardStats({ branchId: activeBranchId || undefined }),
        refetchInterval: 30000, // Refresh every 30 seconds
        enabled: !!user // Only fetch if user is logged in
    });

    // Fetch pending transfer orders count for badge
    const { data: pendingOrders } = useQuery({
        queryKey: ['pending-orders'],
        queryFn: () => api.getPendingTransferOrders(),
        refetchInterval: 30000, // Refresh every 30 seconds
        enabled: !!user // Only fetch if user is logged in
    });

    const pendingOrdersCount = pendingOrders?.length || 0;

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    return (
        <div className="flex bg-background text-foreground overflow-hidden h-screen" dir="rtl">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Navigation Drawer (Sidebar) */}
            <aside className={`
                fixed top-0 bottom-0 right-0 z-50 h-full
                transition-all duration-300 ease-in-out
                bg-card border-l border-border shadow-2xl
                group peer
                /* Mobile: Drawer style */
                ${isSidebarOpen ? 'translate-x-0 w-72' : 'translate-x-full w-72'}
                /* Desktop: Fixed Auto-Expanding */
                lg:translate-x-0 lg:w-20 lg:hover:w-72
            `}>
                <div className="h-full flex flex-col overflow-hidden">
                    {/* Brand Molecule */}
                    <div className="p-4 flex flex-col items-center justify-center border-b border-border/50 min-h-[80px]">
                        <img
                            src="/logo.png"
                            alt="Brand Logo"
                            className="h-10 w-auto object-contain transition-transform group-hover:scale-110"
                        />
                        <p className="mt-2 text-[10px] font-black text-primary/60 tracking-[0.2em] uppercase font-inter whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute bottom-2">
                            SMART ENTERPRISE
                        </p>
                    </div>

                    {/* Navigation Items */}
                    <nav className="flex-1 px-2 py-2 space-y-2 overflow-y-auto custom-scroll overflow-x-hidden">
                        {navItems.map((item, index) => {
                            const Icon = item.icon;

                            // Handle M3 Group Item
                            if ('children' in item) {
                                const isExpanded = expandedGroups.includes(item.label);
                                const hasActiveChild = item.children.some(child => location.pathname === child.path);

                                return (
                                    <div key={index} className="space-y-1">
                                        <button
                                            onClick={() => toggleGroup(item.label)}
                                            className={`w-full flex items-center px-3 py-3 rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${hasActiveChild
                                                ? 'bg-primary/5 text-primary'
                                                : 'text-foreground/70 hover:bg-muted font-bold'
                                                }`}
                                        >
                                            <div className="flex items-center justify-center min-w-[24px]">
                                                <Icon size={22} className={hasActiveChild ? 'text-primary' : 'opacity-50 group-hover/btn:opacity-100'} />
                                            </div>

                                            <span className="mr-3 text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex-1 text-right">
                                                {item.label}
                                            </span>

                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2">
                                                {item.label === 'أذونات الصرف' && pendingOrdersCount > 0 && (
                                                    <span className="bg-brand-orange text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg animate-pulse">
                                                        {pendingOrdersCount}
                                                    </span>
                                                )}
                                                <ChevronDown size={14} className={`transition-transform duration-300 opacity-30 ${isExpanded ? 'rotate-180' : ''}`} />
                                            </div>
                                        </button>

                                        {/* Submenu Drawer Items (Only visible when fully expanded) */}
                                        <div className={`
                                            overflow-hidden transition-all duration-300
                                            ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
                                            /* Hide submenu when sidebar is collapsed (desktop) unless hovered */
                                            lg:max-h-0 lg:opacity-0 lg:group-hover:max-h-96 lg:group-hover:opacity-100
                                        `}>
                                            <div className="pr-10 pl-2 space-y-1 mt-1 mb-2 border-r-2 border-primary/10 mr-4">
                                                {item.children.map((child) => {
                                                    const ChildIcon = child.icon;
                                                    const isChildActive = location.pathname === child.path;
                                                    const showChildBadge = child.path === '/receive-orders' && pendingOrdersCount > 0;

                                                    return (
                                                        <Link
                                                            key={child.path}
                                                            to={child.path}
                                                            onClick={() => setIsSidebarOpen(false)}
                                                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${isChildActive
                                                                ? 'bg-primary/10 text-primary'
                                                                : 'text-muted-foreground hover:bg-muted hover:text-primary'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <ChildIcon size={14} className="opacity-50" />
                                                                <span>{child.label}</span>
                                                            </div>
                                                            {showChildBadge && (
                                                                <span className="bg-brand-orange text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                                                    {pendingOrdersCount}
                                                                </span>
                                                            )}
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            // Handle Single Item
                            // Explicitly check for 'path' property to satisfy TypeScript
                            if (!('path' in item)) return null;

                            const isActive = location.pathname === item.path;
                            const activeReqCount = (stats as any)?.requests ? ((stats as any).requests.open + (stats as any).requests.inProgress) : 0;
                            const showBadge = item.path === '/requests' && activeReqCount > 0;

                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setIsSidebarOpen(false)}
                                    className={`flex items-center px-3 py-3 rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${isActive
                                        ? 'bg-primary text-white shadow-lg ring-1 ring-primary/20'
                                        : 'text-foreground/70 hover:bg-muted hover:text-primary'
                                        }`}
                                >
                                    <div className="flex items-center justify-center min-w-[24px]">
                                        <Icon size={22} className={isActive ? 'text-white' : 'opacity-50'} />
                                    </div>

                                    <span className={`mr-3 text-sm ${isActive ? 'font-black' : 'font-bold'} opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex-1`}>
                                        {item.label}
                                    </span>

                                    {showBadge && (
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-lg ${isActive ? 'bg-white/20 text-white' : 'bg-destructive text-destructive-foreground'}`}>
                                                {activeReqCount}
                                            </span>
                                        </div>
                                    )}
                                    {/* Mini Badge for Collapsed State */}
                                    {showBadge && (
                                        <div className="absolute top-2 left-2 w-2 h-2 bg-destructive rounded-full lg:group-hover:hidden animate-pulse ring-2 ring-card" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Footer / User Info (Collapsed vs Expanded) */}
                    <div className="p-4 border-t border-border/50 bg-muted/20">
                        <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
                                <UserCircle size={20} />
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <p className="text-[11px] font-black leading-tight truncate max-w-[140px]">{user?.displayName}</p>
                                <p className="text-[9px] font-bold text-muted-foreground opacity-60 uppercase">{user?.role}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className={`
                flex-1 flex flex-col min-w-0 relative transition-all duration-300
                /* Add right margin to accommodate fixed sidebar */
                lg:mr-20 lg:peer-hover:mr-72 transition-all duration-300
            `}>
                {/* Top App Bar (M3) */}
                <header className="h-16 lg:h-14 flex items-center justify-between px-4 lg:px-8 shrink-0 relative z-30 bg-card border-b">

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 -mr-2 text-foreground/70 hover:bg-muted rounded-lg lg:hidden"
                    >
                        <Menu size={24} />
                    </button>

                    <div className="lg:hidden flex items-center gap-2">
                        <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
                    </div>

                    <div className="flex items-center gap-2 lg:gap-3 ml-auto">
                        <BranchSwitcher />
                        <NotificationBell />

                        {/* User Profile Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center gap-2 p-1 lg:p-1.5 hover:bg-muted rounded-full transition-all border border-transparent hover:border-border"
                            >
                                <ChevronDown size={14} className={`transition-transform duration-300 opacity-30 ${isProfileOpen ? 'rotate-180' : ''}`} />
                                <div className="hidden md:block text-right ml-1">
                                    <p className="text-[11px] font-black leading-tight truncate max-w-30">{user?.displayName || 'مستخدم'}</p>
                                    <p className="text-[9px] font-bold text-muted-foreground opacity-60 uppercase tracking-tighter truncate max-w-25">{user?.role || 'Guest'}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
                                    <UserCircle size={20} />
                                </div>
                            </button>

                            {isProfileOpen && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setIsProfileOpen(false)} />
                                    <div className="absolute left-0 mt-3 w-64 bg-card rounded-xl shadow-2xl border border-border p-2 z-999 animate-slide-up">
                                        <div className="p-4 mb-2 border-b border-border/50 text-right">
                                            <p className="text-sm font-black text-foreground">{user?.displayName}</p>
                                            <p className="text-[10px] text-muted-foreground font-bold uppercase mt-0.5">{user?.role}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <Link
                                                to="/settings"
                                                onClick={() => setIsProfileOpen(false)}
                                                className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-foreground/70 hover:bg-muted rounded-xl transition-all"
                                            >
                                                <Settings size={16} className="opacity-50" />
                                                <span>الإعدادات</span>
                                            </Link>
                                            <button
                                                onClick={() => { logout(); navigate('/login'); }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                                            >
                                                <LogOut size={16} />
                                                <span>تسجيل الخروج</span>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Content Body with Zoom */}
                <main className="flex-1 overflow-y-auto bg-transparent p-4 lg:p-8 lg:pt-4 custom-scroll relative">
                    <div
                        className="max-w-full mx-auto animate-fade-in pb-20 lg:pb-0"
                        style={{ zoom: zoomLevel / 100 }}
                    >
                        {children}
                    </div>

                    {/* Floating Zoom Controls */}
                    <div className="fixed bottom-16 left-4 flex flex-col gap-1 z-40">
                        <button
                            onClick={handleZoomIn}
                            disabled={zoomLevel >= 150}
                            className="p-2 bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                            title={`تكبير (${zoomLevel}%)`}
                        >
                            <ZoomIn size={16} />
                        </button>
                        <button
                            onClick={handleZoomOut}
                            disabled={zoomLevel <= 70}
                            className="p-2 bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                            title={`تصغير (${zoomLevel}%)`}
                        >
                            <ZoomOut size={16} />
                        </button>
                        {zoomLevel !== 100 && (
                            <button
                                onClick={() => setZoomLevel(100)}
                                className="text-[9px] font-bold text-muted-foreground hover:text-foreground text-center py-1"
                                title="إعادة تعيين"
                            >
                                {zoomLevel}%
                            </button>
                        )}
                    </div>
                </main>

                {/* Status Bar */}
                <StatusBar />
            </div>
        </div>
    );
}
