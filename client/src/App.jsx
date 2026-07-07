import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';
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
import AdminPage from './pages/AdminPage';

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
  const { user } = useAuth();

  return (
    <>
      <NavBar onMenuToggle={() => setSidebarOpen(o => !o)} sidebarOpen={sidebarOpen} />
      {user && <Sidebar open={sidebarOpen} />}
      <motion.main
        className="min-h-screen"
        style={{ paddingTop: '80px' }}
        animate={{ marginLeft: user && sidebarOpen ? '260px' : 0 }}
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
        <Route path="/report" element={
          <FullWidthShell>
            <PageWrapper><SubmitReportPage /></PageWrapper>
          </FullWidthShell>
        } />
        <Route path="/track" element={
          <FullWidthShell>
            <PageWrapper><TrackCasePage /></PageWrapper>
          </FullWidthShell>
        } />
        <Route path="/login" element={
          <PageWrapper><StaffLoginPage /></PageWrapper>
        } />

        {/* Staff-protected routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <AppShell>
              <PageWrapper><DashboardPage /></PageWrapper>
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/cases" element={
          <ProtectedRoute roles={['Investigator', 'Compliance_Officer', 'CEO', 'System_Admin']}>
            <AppShell>
              <PageWrapper><CaseListPage /></PageWrapper>
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/cases/:id" element={
          <ProtectedRoute>
            <AppShell>
              <PageWrapper><CaseDetailPage /></PageWrapper>
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/executive" element={
          <ProtectedRoute roles={['CEO', 'Compliance_Officer', 'System_Admin']}>
            <AppShell>
              <PageWrapper><ExecutiveDashboard /></PageWrapper>
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
