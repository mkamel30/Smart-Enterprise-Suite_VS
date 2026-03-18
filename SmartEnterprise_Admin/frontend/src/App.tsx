import { 
  LayoutDashboard, Building2, Settings2, Activity, LogOut, 
  Users, Layers, Users as CustomersIcon, RefreshCw 
} from 'lucide-react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Branches from './pages/Branches';
import Settings from './pages/Settings';
import UsersPage from './pages/Users';
import Customers from './pages/Customers';
import Warehouse from './pages/Warehouse';
import Reports from './pages/Reports';
import SyncStatus from './pages/SyncStatus';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsProvider>
          <Router>
            <AuthWrapper />
            <Toaster position="top-right" />
          </Router>
        </SettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthWrapper() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <div className="flex h-screen items-center justify-center font-black">جاري التحقق من الجلسة...</div>;
  
  if (!user) {
    if (location.pathname === '/forgot-password') {
      return <ForgotPassword />;
    }
    return <Login />;
  }

  return <MainLayout />;
}

function MainLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.pathname === '/' ? 'dashboard' : location.pathname.split('/')[1];

  const navigation = [
    { id: 'dashboard', name: 'لوحة التحكم المركزية', href: '/', icon: LayoutDashboard },
    { id: 'branches', name: 'شبكة الفروع', href: '/branches', icon: Building2 },
    { id: 'users', name: 'إدارة الصلاحيات', href: '/users', icon: Users },
    { id: 'customers', name: 'سجل العملاء العام', href: '/customers', icon: CustomersIcon },
    { id: 'warehouse', name: 'مخازن الأجهزة والعهد', href: '/warehouse', icon: Layers },
    { id: 'reports', name: 'التقارير المالية الموحدة', href: '/reports', icon: Activity },
    { id: 'sync-status', name: 'مراقب المزامنة', href: '/sync-status', icon: RefreshCw },
    
    { 
      type: 'header',
      name: 'الإعدادات العامة للنظام'
    },
    { id: 'settings', name: 'الإعدادات والتكوين', href: '/settings', icon: Settings2 },
  ];

  return (
    <div className="flex h-screen bg-background font-arabic" dir="rtl">
      {/* Sidebar */}
      <div className="w-80 bg-gradient-smart-purple text-white flex flex-col shadow-2xl z-20 shrink-0">
        <div className="p-8 border-b border-white/10">
          <div className="flex flex-col items-center gap-4">
            <img src="/logo.png" alt="Smart Enterprise" className="h-16 w-auto drop-shadow-lg" />
            <div className="text-center">
              <h1 className="text-white font-black text-xl tracking-tight uppercase">
                بوابة المدير <span className="text-brand-cyan">العام</span>
              </h1>
              <div className="h-1 w-12 bg-brand-cyan mx-auto mt-2 rounded-full shadow-glow"></div>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-6 space-y-2 mt-4 overflow-y-auto custom-scroll">
          {navigation.map((item: any, idx) => {
            if (item.type === 'header') {
              return (
                <div key={idx} className="pt-6 pb-2 px-6">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{item.name}</p>
                </div>
              );
            }
            const Icon = item.icon;
            return (
              <NavItem 
                key={item.id}
                icon={<Icon size={20} />} 
                label={item.name} 
                active={activeTab === item.id} 
                onClick={() => navigate(item.href)} 
              />
            );
          })}
        </nav>

        <div className="p-6 border-t border-white/10 bg-black/10">
          <button 
            onClick={logout}
            className="flex items-center gap-3 text-white/70 hover:text-white transition-all w-full px-4 py-3 rounded-xl hover:bg-white/5 font-black uppercase tracking-widest text-xs"
          >
            <LogOut size={20} />
            <span>إنهاء الجلسة الآمنة</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-border h-20 flex items-center justify-between px-10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 bg-brand-primary rounded-full"></div>
            <h2 className="font-black text-2xl text-brand-primary tracking-tight uppercase">
              {navigation.find(n => n.id === activeTab)?.name || 'اللوحة الرئيسية'}
            </h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
               <div className="smart-badge smart-badge-success uppercase tracking-widest text-[10px]">
                 <span className="w-2 h-2 rounded-full bg-success animate-pulse mx-1"></span>
                 النظام متصل بالشبكة العامة
               </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center text-white font-black text-sm shadow-lg shadow-brand-primary/20">A</div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-10 bg-slate-50/50">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/branches" element={<Branches />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/warehouse" element={<Warehouse />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/sync-status" element={<SyncStatus />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-black uppercase tracking-widest text-[11px] ${
        active 
          ? 'bg-white text-brand-primary shadow-xl shadow-black/20' 
          : 'text-white/60 hover:text-white hover:bg-white/5'
      }`}
    >
      <span className={active ? 'text-brand-primary' : 'text-brand-cyan'}>{icon}</span>
      <span>{label}</span>
      {active && <div className="mr-auto ml-0 w-1.5 h-1.5 rounded-full bg-brand-primary"></div>}
    </button>
  );
}

export default App;
