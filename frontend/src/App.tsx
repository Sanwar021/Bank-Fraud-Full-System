import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { SimulationNotice } from './components/layout/SimulationNotice';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';

// Pages
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { AccountsPage } from './pages/AccountsPage';
import { TransferPage } from './pages/TransferPage';
import { CardsPage } from './pages/CardsPage';
import { LoansPage } from './pages/LoansPage';
import { DepositsPage } from './pages/DepositsPage';
import { InvestigationDashboard } from './pages/InvestigationDashboard';
import { AlertDetailsPage } from './pages/AlertDetailsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';

// Protected Route Wrapper
const ProtectedLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <SimulationNotice />
      <Navbar />
      <div className="flex flex-1 max-w-7xl w-full mx-auto">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Routes>
            {/* Customer Routes */}
            <Route path="/" element={<CustomerDashboard />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/transfer" element={<TransferPage />} />
            <Route path="/cards" element={<CardsPage />} />
            <Route path="/loans" element={<LoansPage />} />
            <Route path="/deposits" element={<DepositsPage />} />

            {/* Investigation & Admin Routes */}
            <Route path="/investigation" element={<InvestigationDashboard />} />
            <Route path="/investigation/alerts" element={<InvestigationDashboard />} />
            <Route path="/investigation/alerts/:id" element={<AlertDetailsPage />} />
            <Route path="/investigation/live" element={<InvestigationDashboard />} />
            <Route path="/investigation/audit" element={<AuditLogsPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
