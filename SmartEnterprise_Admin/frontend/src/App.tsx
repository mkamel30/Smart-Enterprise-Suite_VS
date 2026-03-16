import { LayoutDashboard, Building2, Settings, Shield, Activity, LogOut } from 'lucide-react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Branches from './pages/Branches';
import Parameters from './pages/Parameters';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <AuthProvider>
      <Router>
        <AuthWrapper />
        <Toaster position="top-right" />
      </Router>
    </AuthProvider>
  );
}

function AuthWrapper() {
  const { admin, loading } = useAuth();

  if (loading) return null;
  if (!admin) return <Login />;

  return <MainLayout />;
}

function MainLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.pathname === '/' ? 'dashboard' : location.pathname.split('/')[1];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-slate-300 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-white font-black text-xl flex items-center gap-2">
            <Shield className="text-blue-500" />
            <span>Admin Portal</span>
          </h1>
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mt-1">Smart Enterprise Suite</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => navigate('/')} 
          />
          <NavItem 
            icon={<Building2 size={20} />} 
            label="Branches" 
            active={activeTab === 'branches'} 
            onClick={() => navigate('/branches')} 
          />
          <NavItem 
            icon={<Settings size={20} />} 
            label="Parameters" 
            active={activeTab === 'parameters'} 
            onClick={() => navigate('/parameters')} 
          />
          <NavItem 
            icon={<Activity size={20} />} 
            label="System Health" 
            active={activeTab === 'health'} 
            onClick={() => {}} 
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={logout}
            className="flex items-center gap-2 hover:text-white transition-colors w-full px-4 py-2"
          >
            <LogOut size={20} />
            <span className="font-bold">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-black text-slate-800 capitalize">{activeTab}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter border border-green-200">Portal Online</div>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-xs">A</div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/branches" element={<Branches />} />
              <Route path="/parameters" element={<Parameters />} />
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
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold ${
        active 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
          : 'hover:bg-slate-800 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default App;
