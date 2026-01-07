import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { DashboardStats } from '../lib/types';
import { useState, useMemo } from 'react';
import StatusBar from './StatusBar';
import NotificationBell from './NotificationBell';
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
    TrendingUp
} from 'lucide-react';
import { Menu } from 'lucide-react';

const allNavItems = [
    { path: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
    { path: '/executive-dashboard', label: 'لوحة الإدارة العليا', icon: TrendingUp }, // Management only
    // { path: '/maintenance-board', label: 'لوحة الصيانة', icon: LayoutDashboard }, // Deprecated
    { path: '/requests', label: 'طلبات الصيانة', icon: ClipboardList },
    { path: '/maintenance/shipments', label: 'الشحنات الواردة', icon: Truck }, // مركز الصيانة
    { path: '/maintenance-approvals', label: 'موافقات الصيانة', icon: CheckCircle }, // الفرع
    { path: '/track-machines', label: 'متابعة الماكينات', icon: Eye }, // الفرع
    { path: '/pending-payments', label: 'المستحقات المعلقة', icon: Wallet }, // المركز والفرع
    { path: '/customers', label: 'العملاء', icon: Building },
    {
        label: 'المخازن',
        icon: Package,
        children: [
            { path: '/warehouse', label: 'قطع الغيار', icon: Box },
            { path: '/warehouse-machines', label: 'مخزن الماكينات', icon: Monitor },
            { path: '/warehouse-sims', label: 'مخزن الشرائح', icon: Smartphone },
        ]
    },
    {
        label: 'أذونات الصرف',
        icon: FileText,
        children: [
            { path: '/transfer-orders', label: 'عرض وإنشاء الأذونات', icon: FileText },
            { path: '/receive-orders', label: 'استلام الأذونات', icon: Package },
        ]
    },
    {
        label: 'المالية والمبيعات',
        icon: DollarSign,
        children: [
            { path: '/receipts', label: 'المبيعات والأقساط', icon: FileText },
            { path: '/payments', label: 'المدفوعات', icon: Wallet },
        ]
    },
    { path: '/reports', label: 'التقارير', icon: BarChart3 },
    {
        label: 'الإدارة',
        icon: Settings,
        children: [
            { path: '/technicians', label: 'المستخدمين', icon: UserCircle },
            { path: '/approvals', label: 'الموافقات', icon: CheckCircle },
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
    const { user, logout } = useAuth();

    // Zoom state (100 = 100%, min 70%, max 150%)
    const [zoomLevel, setZoomLevel] = useState(100);

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 5, 150));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 5, 70));

    // Filter nav items based on user role
    const navItems = useMemo(() => {
        const userRole = user?.role;
        return allNavItems.map(item => {
            if ('children' in item && item.children) {
                const filteredChildren = item.children.filter(child =>
                    canAccessRoute(userRole, child.path)
                );
                if (filteredChildren.length === 0) return null;
                return { ...item, children: filteredChildren };
            }
            if ('path' in item) {
                return canAccessRoute(userRole, item.path) ? item : null;
            }
            return null;
        }).filter((item): item is NonNullable<typeof item> => item !== null);
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
        queryKey: ['dashboard-stats'],
        queryFn: () => api.getDashboardStats(),
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
        <div className="flex h-screen bg-background text-foreground overflow-hidden pb-12" dir="rtl">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Navigation Drawer (Sidebar) */}
            <aside className={`
                fixed top-0 bottom-12 right-0 z-50 w-72 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:bottom-0 lg:h-full lg:z-auto p-4
                ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
            `}>
                <div className="h-full bg-card rounded-xl shadow-md flex flex-col overflow-hidden border border-border">
                    {/* Brand Molecule */}
                    <div className="p-8 pb-4 flex flex-col items-center">
                        <img
                            src="/logo.png"
                            alt="Brand Logo"
                            className="h-12 w-auto object-contain transition-transform hover:scale-105"
                        />
                        <p className="mt-3 text-[10px] font-black text-primary/60 tracking-[0.2em] uppercase font-inter">SMART ENTERPRISE SUITE</p>
                    </div>

                    {/* Navigation Items */}
                    <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto custom-scroll min-h-0">
                        {navItems.map((item, index) => {
                            const Icon = item.icon;

                            // Handle M3 Group Item
                            if (item.children) {
                                const isExpanded = expandedGroups.includes(item.label);
                                const hasActiveChild = item.children.some(child => location.pathname === child.path);

                                return (
                                    <div key={index} className="space-y-1">
                                        <button
                                            onClick={() => toggleGroup(item.label)}
                                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${hasActiveChild
                                                ? 'bg-primary/5 text-primary'
                                                : 'text-foreground/70 hover:bg-muted font-bold'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Icon size={20} className={hasActiveChild ? 'text-primary' : 'opacity-50 group-hover:opacity-100'} />
                                                <span className="text-sm font-bold">{item.label}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {item.label === 'أذونات الصرف' && pendingOrdersCount > 0 && (
                                                    <span className="bg-brand-orange text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-brand-orange/20 animate-pulse">
                                                        {pendingOrdersCount}
                                                    </span>
                                                )}
                                                <ChevronDown size={14} className={`transition-transform duration-300 opacity-30 ${isExpanded ? 'rotate-180' : ''}`} />
                                            </div>
                                        </button>

                                        {/* Submenu Drawer Items */}
                                        <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                                            <div className="pr-4 space-y-1 mt-1 mb-2">
                                                {item.children.map((child) => {
                                                    const ChildIcon = child.icon;
                                                    const isChildActive = location.pathname === child.path;
                                                    const showChildBadge = child.path === '/receive-orders' && pendingOrdersCount > 0;

                                                    return (
                                                        <Link
                                                            key={child.path}
                                                            to={child.path}
                                                            onClick={() => setIsSidebarOpen(false)}
                                                            className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${isChildActive
                                                                ? 'bg-primary/10 text-primary'
                                                                : 'text-muted-foreground hover:bg-muted hover:text-primary'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <ChildIcon size={14} className="opacity-50" />
                                                                <span>{child.label}</span>
                                                            </div>
                                                            {showChildBadge && (
                                                                <span className="bg-brand-orange text-white text-[10px] font-black px-2 py-0.5 rounded-full">
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
                            const isActive = location.pathname === item.path;
                            const activeReqCount = (stats as any)?.requests ? ((stats as any).requests.open + (stats as any).requests.inProgress) : 0;
                            const showBadge = item.path === '/requests' && activeReqCount > 0;

                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setIsSidebarOpen(false)}
                                    className={`flex items-center justify-between px-4 py-3.5 rounded-xl transition-all group ${isActive
                                        ? 'bg-primary text-white shadow-lg ring-1 ring-primary/20'
                                        : 'text-foreground/70 hover:bg-muted hover:text-primary'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon size={20} className={isActive ? 'text-white' : 'opacity-50 group-hover:opacity-100'} />
                                        <span className={`text-sm ${isActive ? 'font-black' : 'font-bold'}`}>{item.label}</span>
                                    </div>
                                    {showBadge && (
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-rose-500 text-white'}`}>
                                            {activeReqCount}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 relative transition-all duration-300">
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

                    <div className="flex items-center gap-2 lg:gap-3">
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
                                    <div className="absolute left-0 mt-3 w-64 bg-card rounded-2xl shadow-2xl border border-border p-2 z-999 animate-slide-up">
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
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
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
                        className="max-w-400 mx-auto animate-fade-in pb-20 lg:pb-0"
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
