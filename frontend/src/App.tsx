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

// Pages
import Login from './pages/Login';
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
import Approvals from './pages/Approvals';
import MaintenanceBoard from './pages/MaintenanceBoard';
// Service Center Workflow Pages
import TechnicianDashboard from './pages/TechnicianDashboard';
import MaintenanceShipments from './pages/MaintenanceShipments';
import ShipmentDetail from './pages/ShipmentDetail';
import MaintenanceApprovals from './pages/MaintenanceApprovals';
import TrackMachines from './pages/TrackMachines';
import PendingPayments from './pages/PendingPayments';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import ProductionReports from './pages/ProductionReports';

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
        {/* Public Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route path="/*" element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={user?.role === 'SUPER_ADMIN' ? <AdminDashboard /> : <Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/requests" element={<Requests />} />
                <Route path="/technicians" element={<Users />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/warehouse" element={<Warehouse />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/receipts" element={<Receipts />} />
                <Route path="/warehouse-machines" element={<MachineWarehouse />} />
                <Route path="/warehouse-sims" element={<SimWarehouse />} />
                <Route path="/branches" element={<BranchesSettings />} />
                <Route path="/transfer-orders" element={<TransferOrders />} />
                <Route path="/receive-orders" element={<ReceiveOrders />} />
                <Route path="/approvals" element={<Approvals />} />
                {/* <Route path="/maintenance-board" element={<MaintenanceBoard />} /> */}
                {/* Service Center Workflow Routes */}
                {/* <Route path="/assignments" element={<TechnicianDashboard />} /> */}
                <Route path="/maintenance/shipments" element={
                  <ProtectedRoute allowedRoles={['CENTER_MANAGER', 'CENTER_TECH', 'SUPER_ADMIN']}>
                    <MaintenanceShipments />
                  </ProtectedRoute>
                } />
                <Route path="/maintenance/shipments/:id" element={
                  <ProtectedRoute allowedRoles={['CENTER_MANAGER', 'CENTER_TECH', 'SUPER_ADMIN']}>
                    <ShipmentDetail />
                  </ProtectedRoute>
                } />
                <Route path="/maintenance-approvals" element={<MaintenanceApprovals />} />
                <Route path="/track-machines" element={<TrackMachines />} />
                <Route path="/pending-payments" element={<PendingPayments />} />
                <Route path="/executive-dashboard" element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGEMENT']}>
                    <ExecutiveDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/production-reports" element={<ProductionReports />} />
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
            <AppContent />
          </SocketProvider>
        </SettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
