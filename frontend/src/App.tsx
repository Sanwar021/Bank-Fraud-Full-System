import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { SimulationNotice } from './components/layout/SimulationNotice';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';

// Pages
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((module) => ({ default: module.RegisterPage })));
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard').then((module) => ({ default: module.CustomerDashboard })));
const AccountsPage = lazy(() => import('./pages/AccountsPage').then((module) => ({ default: module.AccountsPage })));
const TransferPage = lazy(() => import('./pages/TransferPage').then((module) => ({ default: module.TransferPage })));
const CardsPage = lazy(() => import('./pages/CardsPage').then((module) => ({ default: module.CardsPage })));
const LoansPage = lazy(() => import('./pages/LoansPage').then((module) => ({ default: module.LoansPage })));
const DepositsPage = lazy(() => import('./pages/DepositsPage').then((module) => ({ default: module.DepositsPage })));
const InvestigationDashboard = lazy(() => import('./pages/InvestigationDashboard').then((module) => ({ default: module.InvestigationDashboard })));
const AlertDetailsPage = lazy(() => import('./pages/AlertDetailsPage').then((module) => ({ default: module.AlertDetailsPage })));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage').then((module) => ({ default: module.AuditLogsPage })));

const PageLoader: React.FC = () => (
  <div className="min-h-[45vh] flex items-center justify-center" role="status" aria-label="Loading page">
    <div className="w-9 h-9 border-[3px] border-zen-200 border-t-zen-600 rounded-full animate-spin" />
  </div>
);

// Protected Route Wrapper
const ProtectedLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
    <div className="reference-page app-shell">
      <div className="reference-app-frame">
        <div className="reference-window-dots" aria-hidden="true"><i/><i/><i/></div>
        <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
        <section className="reference-content-shell">
          <SimulationNotice />
          <Navbar onMenuClick={() => setMobileNavOpen(true)} />
          <main className="reference-main">
          <Suspense fallback={<PageLoader />}><Routes>
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
          </Routes></Suspense>
          </main>
        </section>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;

