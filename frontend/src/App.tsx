import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';

// Context & Components
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { SettingsProvider } from './context/SettingsContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import { Toaster } from 'react-hot-toast';
import UpdateBanner from './components/UpdateBanner';

// Pages
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import Customers from './pages/Customers';
import Requests from './pages/Requests';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Warehouse from './pages/Warehouse';
import Payments from './pages/Payments';
import Reports from './pages/Reports';
import Receipts from './pages/Receipts';
import MachineWarehouse from './pages/MachineWarehouse';
import SimWarehouse from './pages/SimWarehouse';
import BranchesSettings from './pages/BranchesSettings';
import TransferOrders from './pages/TransferOrders';
import ReceiveOrders from './pages/ReceiveOrders';
import PendingPayments from './pages/PendingPayments';
import ProductionReports from './pages/ProductionReports';
import AdminBackups from './pages/AdminBackups';
import AccountantDashboard from './pages/AccountantDashboard';
import MonthlyClosing from './pages/MonthlyClosing';

import { useEffect } from 'react';
import { useAuth } from './context/AuthContext';

const queryClient = new QueryClient();

function AppContent() {
  const { user } = useAuth();

  useEffect(() => {
    // Force clear legacy themes
    document.documentElement.classList.remove('dark', 'midnight');

    // Apply font
    const savedFont = user?.fontFamily || localStorage.getItem('arabic-font') || "'IBM Plex Sans Arabic', sans-serif";
    document.documentElement.style.setProperty('--font-arabic', savedFont);
  }, [user]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Protected Routes */}
        <Route path="/*" element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={
                  ['SUPER_ADMIN', 'BRANCH_ADMIN'].includes(user?.role || '') ? <AdminDashboard /> :
                    user?.role === 'ACCOUNTANT' ? <AccountantDashboard /> :
                      <Dashboard />
                } />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/requests" element={<Requests />} />
                <Route path="/technicians" element={<Users />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/warehouse" element={<Warehouse />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/payments" element={
                  <ProtectedRoute allowedRoles={['ACCOUNTANT', 'SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_MANAGER']}>
                    {user?.role === 'ACCOUNTANT' || user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGEMENT' ? <AccountantDashboard /> : <Payments />}
                  </ProtectedRoute>
                } />
                <Route path="/receipts" element={<Receipts />} />
                <Route path="/warehouse-machines" element={<MachineWarehouse />} />
                <Route path="/warehouse-sims" element={<SimWarehouse />} />
                <Route path="/branches" element={<BranchesSettings />} />
                <Route path="/transfer-orders" element={<TransferOrders />} />
                <Route path="/receive-orders" element={<ReceiveOrders />} />
                <Route path="/pending-payments" element={<PendingPayments />} />
                <Route path="/production-reports" element={<ProductionReports />} />
                <Route path="/monthly-closing" element={<MonthlyClosing />} />
                <Route path="/admin/backups" element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_ADMIN']}>
                    <AdminBackups />
                  </ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsProvider>
          <SocketProvider>
            <Toaster position="top-left" reverseOrder={false} />
            <UpdateBanner />
            <AppContent />
          </SocketProvider>
        </SettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
