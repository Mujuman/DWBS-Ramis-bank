import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';

import NavBar from './components/NavBar';
import Sidebar from './components/Sidebar';

import LandingPage from './pages/LandingPage';
import SubmitReportPage from './pages/SubmitReportPage';
import TrackCasePage from './pages/TrackCasePage';
import StaffLoginPage from './pages/StaffLoginPage';
import DashboardPage from './pages/DashboardPage';
import CaseListPage from './pages/CaseListPage';
import CaseDetailPage from './pages/CaseDetailPage';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import ComplianceDashboard from './pages/ComplianceDashboard';
import AdminPage from './pages/AdminPage';
import AdminCreateUserPage from './pages/AdminCreateUserPage';
import AdminStaffAccountsPage from './pages/AdminStaffAccountsPage';
import AuditDashboard from './pages/AuditDashboard';

// ── Page transition variants ──────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -10 },
};

const pageTransition = {
  duration: 0.3,
  ease: 'easeOut',
};

// ── Animated page wrapper ─────────────────────────────────────
const PageWrapper = ({ children }) => (
  <motion.div
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={pageTransition}
    style={{ willChange: 'opacity, transform' }}
  >
    {children}
  </motion.div>
);

// ── Protected route wrapper ───────────────────────────────────
const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 rounded-full border-2 border-t-transparent"
          style={{ borderColor: 'rgba(26,58,107,0.2)', borderTopColor: '#1a3a6b' }}
        />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;

  return children;
};

// ── App shell with sidebar/navbar ─────────────────────────────
const AppShell = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const { user } = useAuth();

  useEffect(() => {
    const updateViewport = () => setIsDesktop(window.matchMedia('(min-width: 1024px)').matches);
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  return (
    <>
      <NavBar onMenuToggle={() => setSidebarOpen(o => !o)} sidebarOpen={sidebarOpen} />
      {user && <Sidebar open={sidebarOpen} />}
      <motion.main
        className="min-h-screen"
        style={{ paddingTop: '80px' }}
        animate={{ marginLeft: user && sidebarOpen && isDesktop ? '260px' : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {children}
      </motion.main>
    </>
  );
};

// ── Full-width shell (no sidebar) ─────────────────────────────
const FullWidthShell = ({ children }) => (
  <>
    <NavBar />
    <div style={{ paddingTop: '80px' }}>{children}</div>
  </>
);

// ── Animated routes ───────────────────────────────────────────
function AppRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public routes */}
        <Route path="/" element={
          <FullWidthShell>
            <PageWrapper><LandingPage /></PageWrapper>
          </FullWidthShell>
        } />
        <Route path="/track" element={
          <ProtectedRoute roles={['Employee', 'Branch_Manager']}>
            <AppShell>
              <PageWrapper><TrackCasePage /></PageWrapper>
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/login" element={
          <PageWrapper><StaffLoginPage /></PageWrapper>
        } />
        <Route path="/staff-login" element={
          <PageWrapper><StaffLoginPage /></PageWrapper>
        } />
        <Route path="/report" element={
          <ProtectedRoute roles={['Employee', 'Branch_Manager']}>
            <AppShell>
              <PageWrapper><SubmitReportPage /></PageWrapper>
            </AppShell>
          </ProtectedRoute>
        } />

        {/* Staff-protected routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute roles={['Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer']}>
            <AppShell>
              <PageWrapper><DashboardPage /></PageWrapper>
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/cases" element={
          <ProtectedRoute roles={['Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer']}>
            <AppShell>
              <PageWrapper><CaseListPage /></PageWrapper>
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/cases/:id" element={
          <ProtectedRoute roles={['Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer']}>
            <AppShell>
              <PageWrapper><CaseDetailPage /></PageWrapper>
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/executive" element={
          <ProtectedRoute roles={['CEO']}>
            <AppShell>
              <PageWrapper><ExecutiveDashboard /></PageWrapper>
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/compliance" element={
          <ProtectedRoute roles={['Compliance_Officer']}>
            <AppShell>
              <PageWrapper><ComplianceDashboard /></PageWrapper>
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute roles={['System_Admin']}>
            <AppShell>
              <PageWrapper><AdminPage /></PageWrapper>
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/admin/create" element={
          <ProtectedRoute roles={['System_Admin']}>
            <AppShell>
              <PageWrapper><AdminCreateUserPage /></PageWrapper>
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute roles={['System_Admin']}>
            <AppShell>
              <PageWrapper><AdminStaffAccountsPage /></PageWrapper>
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/audit" element={
          <ProtectedRoute roles={['Auditor', 'Compliance_Officer', 'CEO']}>
            <AppShell>
              <PageWrapper><AuditDashboard /></PageWrapper>
            </AppShell>
          </ProtectedRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: 'var(--font-family-sans)',
              fontSize: '0.875rem',
              borderRadius: '10px',
              boxShadow: '0 8px 32px rgba(10,29,55,0.15)',
            },
            success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
