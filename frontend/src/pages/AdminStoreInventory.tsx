import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    Package, Search, Filter, Plus, Box, Upload, X,
    ArrowRightLeft, History, MoreHorizontal,
    Hash, Download, ExternalLink, ChevronRight, ChevronDown,
    MapPin, CornerUpLeft, Info, Settings as SettingsIcon,
    Monitor, Smartphone, Layers, Database, Calculator, Check, List, LayoutGrid
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "../components/ui/dropdown-menu";
import toast from 'react-hot-toast';

import CreateCartonModal from '../components/admin-store/CreateCartonModal';
import AddAssetManualModal from '../components/admin-store/AddAssetManualModal';
import AdminAssetImportModal from '../components/admin-store/AdminAssetImportModal';
import AdminAssetTransferModal from '../components/admin-store/AdminAssetTransferModal';
import AdminAssetHistoryModal from '../components/admin-store/AdminAssetHistoryModal';
import AdminStockTransferModal from '../components/admin-store/AdminStockTransferModal';

export default function AdminStoreInventory() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Tabs: 'ASSETS' | 'STOCKS'
    const [activeTab, setActiveTab] = useState<'ASSETS' | 'STOCKS'>('ASSETS');

    const [filters, setFilters] = useState({
        itemTypeCode: '',
        status: 'IN_ADMIN_STORE',
        branchId: '',
        search: ''
    });

    const [showAddManual, setShowAddManual] = useState(false);
    const [showCreateCarton, setShowCreateCarton] = useState(false);
    const [showImport, setShowImport] = useState(false);

    const [transferTarget, setTransferTarget] = useState<{ asset?: any, cartonCode?: string, assets?: any[], cartons?: string[] } | null>(null);
    const [stockTransferTarget, setStockTransferTarget] = useState<any>(null); // For Stock
    const [historyTarget, setHistoryTarget] = useState<any>(null);

    // View & Selection State
    const [viewMode, setViewMode] = useState<'SERIAL' | 'CARTON'>('SERIAL');
    const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
    const [selectedCartonCodes, setSelectedCartonCodes] = useState<string[]>([]);
    const [expandedCartons, setExpandedCartons] = useState<string[]>([]);

    // Fetch Assets (Serialized)
    const { data: inventory, isLoading: isLoadingAssets } = useQuery({
        queryKey: ['admin-inventory', filters],
        queryFn: () => api.getAdminInventory(filters),
        enabled: activeTab === 'ASSETS'
    });

    // Fetch Stocks (Quantity)
    const { data: stocks, isLoading: isLoadingStocks } = useQuery({
        queryKey: ['admin-stocks', filters.branchId], // Stocks filter mainly by branch
        queryFn: () => api.getAdminStocks(filters.branchId),
        enabled: true // Always fetch or lazy? Let's fetch to show stats if needed, or just when tab active. Let's keep it simple.
    });

    // Fetch Item Types
    const { data: itemTypes } = useQuery({
        queryKey: ['admin-item-types'],
        queryFn: () => api.getAdminItemTypes()
    });

    // Fetch Branches
    const { data: branches } = useQuery({
        queryKey: ['branches-lookup'],
        queryFn: () => api.getAuthorizedBranches()
    });

    // Stats
    const stats = {
        assetsTotal: inventory?.length || 0,
        assetsInStore: inventory?.filter((a: any) => a.status === 'IN_ADMIN_STORE').length || 0,
        stocksTotal: stocks?.reduce((acc: number, s: any) => acc + s.quantity, 0) || 0,
    };

    // Grouping Logic for assets
    const groupedInventory = React.useMemo(() => {
        if (!inventory) return [];
        if (viewMode === 'SERIAL') return inventory;

        const groupsArray: any[] = [];
        const groupsMap: Record<string, { id: string, cartonCode: string, assets: any[], itemType: any, status: string, isCarton: boolean }> = {};
        const standalone: any[] = [];

        inventory.forEach((asset: any) => {
            if (asset.cartonCode) {
                if (!groupsMap[asset.cartonCode]) {
                    groupsMap[asset.cartonCode] = {
                        id: `carton-${asset.cartonCode}`,
                        cartonCode: asset.cartonCode,
                        assets: [],
                        itemType: asset.itemType,
                        status: asset.status,
                        isCarton: true
                    };
                    groupsArray.push(groupsMap[asset.cartonCode]);
                }
                groupsMap[asset.cartonCode].assets.push(asset);
            } else {
                standalone.push({ ...asset, isCarton: false });
            }
        });

        return [...groupsArray, ...standalone];
    }, [inventory, viewMode]);

    // Filter Stocks based on ItemType/Search locally (since API only filters by BranchId for now)
    const filteredStocks = stocks?.filter((s: any) => {
        if (filters.itemTypeCode && s.itemTypeCode !== filters.itemTypeCode) return false;
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            return s.itemType?.name.toLowerCase().includes(searchLower) ||
                s.itemTypeCode.toLowerCase().includes(searchLower);
        }
        return true;
    });

    // Selection Handlers
    const handleSelectAll = () => {
        const currentlySelectable = groupedInventory.filter(item => {
            // Only selectable if in store
            const status = item.isCarton ? item.status : item.status;
            return status === 'IN_ADMIN_STORE';
        });

        if (selectedAssetIds.length + selectedCartonCodes.length === currentlySelectable.length) {
            setSelectedAssetIds([]);
            setSelectedCartonCodes([]);
        } else {
            const assetIds: string[] = [];
            const cartonCodes: string[] = [];
            currentlySelectable.forEach((item: any) => {
                if (item.isCarton) cartonCodes.push(item.cartonCode);
                else assetIds.push(item.id);
            });
            setSelectedAssetIds(assetIds);
            setSelectedCartonCodes(cartonCodes);
        }
    };

    const toggleAssetSelection = (id: string) => {
        setSelectedAssetIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleCartonSelection = (code: string) => {
        setSelectedCartonCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
    };

    const toggleCartonExpanded = (code: string) => {
        setExpandedCartons(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
    };

    const handleBulkTransfer = () => {
        if (selectedAssetIds.length === 0 && selectedCartonCodes.length === 0) return;
        setTransferTarget({
            assets: inventory?.filter((a: any) => selectedAssetIds.includes(a.id)),
            cartons: selectedCartonCodes
        });
    };

    return (
        <div className="px-4 sm:px-8 pt-2 pb-6 space-y-6 animate-fade-in" dir="rtl">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
                        <Package className="text-primary" size={32} />
                        مخزن الشئون الإدارية
                    </h1>
                    <p className="text-muted-foreground font-bold mt-1">متابعة الأصول، العهد، والرصيد المخزني</p>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                    {(user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGEMENT') && (
                        <button
                            onClick={() => navigate('/admin-store/settings')}
                            className="flex items-center gap-2 bg-muted hover:bg-accent text-foreground px-5 py-3 rounded-2xl font-black transition-all active:scale-95 border border-border"
                        >
                            <SettingsIcon size={20} />
                            إعدادات الأصناف
                        </button>
                    )}
                    <button
                        onClick={() => setShowImport(true)}
                        className="flex items-center gap-2 bg-emerald-500/10 text-emerald-600 px-5 py-3 rounded-2xl font-black transition-all hover:bg-emerald-500/20 active:scale-95 border border-emerald-500/20"
                    >
                        <Upload size={20} />
                        استيراد Excel
                    </button>
                    <button
                        onClick={() => setShowCreateCarton(true)}
                        className="flex items-center gap-2 bg-blue-500/10 text-blue-600 px-5 py-3 rounded-2xl font-black transition-all hover:bg-blue-500/20 active:scale-95 border border-blue-500/20"
                    >
                        <Box size={20} />
                        إنشاء كرتونة
                    </button>
                    <button
                        onClick={() => setShowAddManual(true)}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-black transition-all hover:shadow-lg active:scale-95 shadow-md shadow-primary/20"
                    >
                        <Plus size={20} strokeWidth={3} />
                        إضافة جديد
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard
                    label="إجمالي الأصول (سيريال)"
                    value={stats.assetsInStore} // Showing In Store count
                    subValue={`من ${stats.assetsTotal}`}
                    icon={<Layers size={24} />}
                    color="bg-primary"
                    onClick={() => setActiveTab('ASSETS')}
                    active={activeTab === 'ASSETS'}
                />
                <StatCard
                    label="الرصيد المخزني (كميات)"
                    value={stats.stocksTotal}
                    icon={<Database size={24} />}
                    color="bg-purple-600"
                    onClick={() => setActiveTab('STOCKS')}
                    active={activeTab === 'STOCKS'}
                />
                <StatCard
                    label="تحويلات الأصول"
                    value={inventory?.filter((a: any) => a.status === 'TRANSFERRED').length || 0}
                    icon={<ArrowRightLeft size={24} />}
                    color="bg-blue-500"
                />
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Tabs */}
                <div className="flex p-1 bg-muted/30 rounded-2xl w-fit border border-border/50">
                    <button
                        onClick={() => setActiveTab('ASSETS')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black transition-all ${activeTab === 'ASSETS'
                            ? 'bg-card shadow-lg text-primary scale-105'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <Layers size={20} />
                        الأصول (سيريال)
                    </button>
                    <button
                        onClick={() => setActiveTab('STOCKS')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black transition-all ${activeTab === 'STOCKS'
                            ? 'bg-card shadow-lg text-purple-600 scale-105'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <Database size={20} />
                        المخزون (كميات)
                    </button>
                </div>

                {/* View Mode Toggle (Only for Assets) */}
                {activeTab === 'ASSETS' && (
                    <div className="flex p-1 bg-muted/30 rounded-2xl w-fit border border-border/50">
                        <button
                            onClick={() => {
                                setViewMode('SERIAL');
                                setSelectedAssetIds([]);
                                setSelectedCartonCodes([]);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black transition-all text-sm ${viewMode === 'SERIAL'
                                ? 'bg-primary text-primary-foreground shadow-lg'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <List size={16} />
                            عرض تسلسلي
                        </button>
                        <button
                            onClick={() => {
                                setViewMode('CARTON');
                                setSelectedAssetIds([]);
                                setSelectedCartonCodes([]);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black transition-all text-sm ${viewMode === 'CARTON'
                                ? 'bg-primary text-primary-foreground shadow-lg'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <LayoutGrid size={16} />
                            عرض كراتين
                        </button>
                    </div>
                )}
            </div>

            {/* Filters Bar */}
            <div className="bg-card rounded-[2rem] border border-border shadow-xl p-4 flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                    <input
                        placeholder={activeTab === 'ASSETS' ? "بحث بالسيريال، الكرتونة..." : "بحث باسم الصنف..."}
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        className="w-full bg-muted/50 border border-border rounded-2xl pr-12 pl-4 py-3 focus:ring-4 focus:ring-primary/10 transition-all outline-none font-bold text-sm"
                    />
                </div>

                <select
                    value={filters.itemTypeCode}
                    onChange={(e) => setFilters(prev => ({ ...prev, itemTypeCode: e.target.value }))}
                    className="bg-muted/50 border border-border rounded-2xl px-4 py-3 outline-none font-bold text-sm focus:ring-4 focus:ring-primary/10"
                >
                    <option value="">كل الأصناف</option>
                    {itemTypes?.map((t: any) => (
                        <option key={t.id} value={t.code}>{t.name}</option>
                    ))}
                </select>

                {activeTab === 'ASSETS' && (
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                        className="bg-muted/50 border border-border rounded-2xl px-4 py-3 outline-none font-bold text-sm focus:ring-4 focus:ring-primary/10"
                    >
                        <option value="">كل الحالات</option>
                        <option value="IN_ADMIN_STORE">في المخزن</option>
                        <option value="TRANSFERRED">محول لفرع</option>
                        <option value="DISPOSED">كهنة/تالف</option>
                    </select>
                )}

                <select
                    value={filters.branchId}
                    onChange={(e) => setFilters(prev => ({ ...prev, branchId: e.target.value }))}
                    className="bg-muted/50 border border-border rounded-2xl px-4 py-3 outline-none font-bold text-sm focus:ring-4 focus:ring-primary/10"
                >
                    <option value="">{activeTab === 'STOCKS' ? 'كل المخازن (Admin Store)' : 'كل المواقع'}</option>
                    {branches?.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>

                <button
                    onClick={() => setFilters({ itemTypeCode: '', status: 'IN_ADMIN_STORE', branchId: '', search: '' })}
                    className="p-3 bg-muted hover:bg-accent rounded-xl text-muted-foreground transition-all"
                    title="إعادة ضبط"
                >
                    <History size={20} />
                </button>
            </div>

            {/* Content Area */}
            <div className="bg-card rounded-[2.5rem] border border-border shadow-2xl overflow-hidden min-h-[400px]">
                {activeTab === 'ASSETS' ? (
                    // --- ASSETS TABLE ---
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-muted/50 border-b-2 border-border/50">
                                <tr>
                                    {filters.status === 'IN_ADMIN_STORE' && (
                                        <th className="p-3 sm:p-5 w-10">
                                            <button onClick={handleSelectAll} className="p-2 transition-all active:scale-95 group">
                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${(selectedAssetIds.length + selectedCartonCodes.length > 0)
                                                    ? 'bg-primary border-primary text-white'
                                                    : 'border-muted-foreground/30'
                                                    }`}>
                                                    {(selectedAssetIds.length + selectedCartonCodes.length > 0) && <Check size={14} strokeWidth={4} />}
                                                </div>
                                            </button>
                                        </th>
                                    )}
                                    <th className="p-3 sm:p-5 text-right text-xs font-black text-muted-foreground uppercase tracking-wider">
                                        {viewMode === 'SERIAL' ? 'السيريال' : 'الكرتونة / السيريال'}
                                    </th>
                                    <th className="p-3 sm:p-5 text-right text-xs font-black text-muted-foreground uppercase tracking-wider">نوع الصنف</th>
                                    <th className="p-3 sm:p-5 text-right text-xs font-black text-muted-foreground uppercase tracking-wider hidden sm:table-cell">تفاصيل</th>
                                    <th className="p-3 sm:p-5 text-right text-xs font-black text-muted-foreground uppercase tracking-wider hidden sm:table-cell">الحالة</th>
                                    <th className="p-3 sm:p-5 text-center text-xs font-black text-muted-foreground uppercase tracking-wider">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {groupedInventory?.map((item: any) => {
                                    const isSelected = item.isCarton
                                        ? selectedCartonCodes.includes(item.cartonCode)
                                        : selectedAssetIds.includes(item.id);

                                    const isExpanded = item.isCarton && expandedCartons.includes(item.cartonCode);

                                    return (
                                        <React.Fragment key={item.id}>
                                            <tr className={`hover:bg-muted/30 transition-colors group ${isSelected ? 'bg-primary/5' : ''}`}>
                                                {filters.status === 'IN_ADMIN_STORE' && (
                                                    <td className="p-3 sm:p-5">
                                                        <button
                                                            onClick={() => item.isCarton ? toggleCartonSelection(item.cartonCode) : toggleAssetSelection(item.id)}
                                                            className="p-2 transition-all active:scale-95"
                                                        >
                                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary text-white' : 'border-muted-foreground/30'
                                                                }`}>
                                                                {isSelected && <Check size={14} strokeWidth={4} />}
                                                            </div>
                                                        </button>
                                                    </td>
                                                )}
                                                <td className="p-3 sm:p-5">
                                                    <div className="flex items-center gap-2 sm:gap-3">
                                                        <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl group-hover:bg-primary group-hover:text-white transition-colors ${item.isCarton ? 'bg-blue-500/10 text-blue-600' : 'bg-primary/5 text-primary'
                                                            }`}>
                                                            {item.isCarton ? <Box size={14} className="sm:w-4 sm:h-4" /> : <Hash size={14} className="sm:w-4 sm:h-4" />}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-xs sm:text-base text-foreground tabular-nums">
                                                                {item.isCarton ? item.cartonCode : item.serialNumber}
                                                            </span>
                                                            {item.isCarton && (
                                                                <span className="text-[10px] font-bold text-muted-foreground">يحتوي على {item.assets.length} صنف</span>
                                                            )}
                                                        </div>
                                                        {item.isCarton && (
                                                            <button
                                                                onClick={() => toggleCartonExpanded(item.cartonCode)}
                                                                className="p-1 hover:bg-muted rounded-lg transition-colors"
                                                            >
                                                                <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 sm:p-5">
                                                    <span className="font-bold text-xs sm:text-base text-muted-foreground">{item.itemType?.name}</span>
                                                </td>
                                                <td className="p-3 sm:p-5 hidden sm:table-cell">
                                                    {item.isCarton ? (
                                                        <span className="text-muted-foreground/40 font-bold">-</span>
                                                    ) : (
                                                        item.simProvider ? (
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-xs sm:text-sm text-foreground">{item.simProvider}</span>
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.simNetworkType}</span>
                                                            </div>
                                                        ) : item.model ? (
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-xs sm:text-sm text-foreground">{item.model}</span>
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.manufacturer}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground/40 font-bold">-</span>
                                                        )
                                                    )}
                                                </td>
                                                <td className="p-3 sm:p-5 text-center hidden sm:table-cell">
                                                    <StatusBadge status={item.status} />
                                                </td>
                                                <td className="p-3 sm:p-5 text-center">
                                                    <DropdownMenu dir="rtl">
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-[200px] rounded-2xl p-2 bg-card border border-border shadow-2xl z-[110]">
                                                            {item.isCarton ? (
                                                                <>
                                                                    <DropdownMenuItem
                                                                        className="rounded-xl font-bold py-3 cursor-pointer text-indigo-600 focus:text-indigo-600"
                                                                        onClick={() => setTransferTarget({ cartonCode: item.cartonCode })}
                                                                    >
                                                                        <Box className="ml-2 h-4 w-4" /> تحويل الكرتونة بالكامل
                                                                    </DropdownMenuItem>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <DropdownMenuItem
                                                                        className="rounded-xl font-bold py-3 cursor-pointer"
                                                                        onClick={() => setHistoryTarget(item)}
                                                                    >
                                                                        <Info className="ml-2 h-4 w-4" /> التفاصيل والسجل
                                                                    </DropdownMenuItem>
                                                                    {item.status === 'IN_ADMIN_STORE' && (
                                                                        <DropdownMenuItem
                                                                            className="rounded-xl font-bold py-3 cursor-pointer text-blue-600 focus:text-blue-600"
                                                                            onClick={() => setTransferTarget({ asset: item })}
                                                                        >
                                                                            <CornerUpLeft className="ml-2 h-4 w-4" /> تحويل الصنف لفرع
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuItem className="rounded-xl font-bold py-3 cursor-pointer text-rose-500 focus:text-rose-500">
                                                                        <X className="ml-2 h-4 w-4" /> تكهين الصنف
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>

                                            {/* Expanded content for Cartons */}
                                            {isExpanded && item.assets.map((asset: any) => (
                                                <tr key={asset.id} className="bg-muted/10 border-r-4 border-blue-500/30">
                                                    {filters.status === 'IN_ADMIN_STORE' && <td></td>}
                                                    <td className="p-3 sm:p-4 pr-10">
                                                        <div className="flex items-center gap-2">
                                                            <Hash size={12} className="text-muted-foreground" />
                                                            <span className="font-bold text-xs sm:text-sm text-foreground tabular-nums">{asset.serialNumber}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 sm:p-4">
                                                        <span className="text-xs font-bold text-muted-foreground">{asset.itemType?.name}</span>
                                                    </td>
                                                    <td className="p-3 sm:p-4 hidden sm:table-cell" colSpan={3}>
                                                        {asset.simProvider ? (
                                                            <span className="text-xs font-bold text-primary">{asset.simProvider} ({asset.simNetworkType})</span>
                                                        ) : asset.model ? (
                                                            <span className="text-xs font-bold text-primary">{asset.model}</span>
                                                        ) : null}
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                                {inventory?.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-20 text-center">
                                            <div className="flex flex-col items-center gap-4 text-muted-foreground">
                                                <Search size={48} className="opacity-20" />
                                                <div className="font-black text-xl">لا يوجد نتائج تطابق بحثك</div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    // --- STOCKS TABLE ---
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-muted/50 border-b-2 border-border/50">
                                <tr>
                                    <th className="p-3 sm:p-5 text-right text-xs font-black text-muted-foreground uppercase tracking-wider">نوع الصنف</th>
                                    <th className="p-3 sm:p-5 text-right text-xs font-black text-muted-foreground uppercase tracking-wider">الكود</th>
                                    <th className="p-3 sm:p-5 text-right text-xs font-black text-muted-foreground uppercase tracking-wider">الوحدة</th>
                                    <th className="p-3 sm:p-5 text-right text-xs font-black text-muted-foreground uppercase tracking-wider">الرصيد الحالي</th>
                                    <th className="p-3 sm:p-5 text-right text-xs font-black text-muted-foreground uppercase tracking-wider">الموقع</th>
                                    <th className="p-3 sm:p-5 text-center text-xs font-black text-muted-foreground uppercase tracking-wider">أخر تحديث</th>
                                    <th className="p-3 sm:p-5 text-center text-xs font-black text-muted-foreground uppercase tracking-wider">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {filteredStocks?.map((stock: any) => (
                                    <tr key={stock.id} className="hover:bg-muted/30 transition-colors group">
                                        <td className="p-3 sm:p-5">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-purple-500/10 text-purple-600 rounded-xl">
                                                    <Package size={16} />
                                                </div>
                                                <span className="font-black text-sm sm:text-base text-foreground">{stock.itemType?.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 sm:p-5">
                                            <span className="font-mono font-bold text-xs text-muted-foreground bg-muted px-2 py-1 rounded-lg">{stock.itemTypeCode}</span>
                                        </td>
                                        <td className="p-3 sm:p-5">
                                            <span className="font-bold text-sm text-muted-foreground">{stock.itemType?.defaultUnit}</span>
                                        </td>
                                        <td className="p-3 sm:p-5">
                                            <div className="flex items-center gap-2">
                                                <Calculator size={14} className="text-muted-foreground" />
                                                <span className="font-black text-lg text-primary tabular-nums">{stock.quantity}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 sm:p-5">
                                            <div className="flex items-center gap-2 text-foreground/70">
                                                <MapPin size={14} />
                                                <span className="font-bold text-sm">{stock.branch ? stock.branch.name : 'المخزن الإداري'}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 sm:p-5 text-center">
                                            <span className="text-xs font-bold text-muted-foreground" dir="ltr">
                                                {new Date(stock.updatedAt).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td className="p-3 sm:p-5 text-center">
                                            {!stock.branchId && stock.quantity > 0 && (
                                                <Button
                                                    size="sm"
                                                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-600/20 active:scale-95 transition-all"
                                                    onClick={() => setStockTransferTarget(stock)}
                                                >
                                                    <ArrowRightLeft size={16} className="mr-2" />
                                                    تحويل
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredStocks?.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-20 text-center">
                                            <div className="flex flex-col items-center gap-4 text-muted-foreground">
                                                <Database size={48} className="opacity-20" />
                                                <div className="font-black text-xl">لا يوجد أرصدة متاحة</div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modals */}
            {
                showAddManual && (
                    <AddAssetManualModal
                        onClose={() => setShowAddManual(false)}
                        itemTypes={itemTypes || []}
                    />
                )
            }

            {
                showCreateCarton && (
                    <CreateCartonModal
                        onClose={() => setShowCreateCarton(false)}
                        itemTypes={itemTypes || []}
                    />
                )
            }

            {
                showImport && (
                    <AdminAssetImportModal
                        onClose={() => setShowImport(false)}
                        itemTypes={itemTypes || []}
                    />
                )
            }

            {
                transferTarget && (
                    <AdminAssetTransferModal
                        onClose={() => {
                            setTransferTarget(null);
                            setSelectedAssetIds([]);
                            setSelectedCartonCodes([]);
                        }}
                        asset={transferTarget.asset}
                        cartonCode={transferTarget.cartonCode}
                        assets={transferTarget.assets}
                        cartons={transferTarget.cartons}
                    />
                )
            }

            {
                stockTransferTarget && (
                    <AdminStockTransferModal
                        onClose={() => setStockTransferTarget(null)}
                        stock={stockTransferTarget}
                    />
                )
            }

            {
                historyTarget && (
                    <AdminAssetHistoryModal
                        onClose={() => setHistoryTarget(null)}
                        asset={historyTarget}
                    />
                )
            }
        </div >
    );
}

function StatCard({ label, value, subValue, icon, color, onClick, active }: any) {
    return (
        <div
            onClick={onClick}
            className={`bg-card rounded-[2rem] border transition-all p-6 relative overflow-hidden group 
            ${active ? `border-${color.split('-')[1]} ring-2 ring-${color.split('-')[1]}/50 shadow-2xl` : 'border-border shadow-xl'}
            ${onClick ? 'cursor-pointer hover:shadow-2xl active:scale-95' : ''}`}
        >
            <div className={`absolute top-0 right-0 w-32 h-32 ${color} opacity-[0.03] rounded-bl-full group-hover:scale-110 transition-transform`}></div>
            <div className="flex items-center gap-4 relative z-10">
                <div className={`p-4 ${color} text-white rounded-[1.5rem] shadow-lg shadow-${color.split('-')[1]}/20`}>
                    {icon}
                </div>
                <div>
                    <div className="text-sm font-black text-muted-foreground">{label}</div>
                    <div className="text-3xl font-black mt-1">{value}</div>
                    {subValue && <div className="text-xs font-bold text-muted-foreground mt-1">{subValue}</div>}
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config: any = {
        'IN_ADMIN_STORE': { label: 'في المخزن', color: 'bg-emerald-500/10 text-emerald-600' },
        'TRANSFERRED': { label: 'محول لفرع', color: 'bg-blue-500/10 text-blue-600' },
        'DISPOSED': { label: 'كهنة', color: 'bg-rose-500/10 text-rose-600' }
    };

    const { label, color } = config[status] || { label: status, color: 'bg-muted text-muted-foreground' };

    return (
        <span className={`inline-flex px-4 py-1.5 rounded-full text-xs font-black ${color}`}>
            {label}
        </span>
    );
}
