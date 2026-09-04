import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';

// Landing Page (NEW)
import HeroPage from './components/HeroPage';

// Customer Application
import CustomerLayout from './customer/CustomerLayout';
import CustomerHomePage from './customer/pages/CustomerHomePage';
import FindTablePage from './customer/pages/FindTablePage';
import MyReservationsPage from './customer/pages/MyReservationsPage';
import CustomerLoginPage from './customer/pages/CustomerLoginPage';
import CustomerRegisterPage from './customer/pages/CustomerRegisterPage';

// Management Application
import ManagementLayout from './management/ManagementLayout';
import ManagementLoginPage from './management/pages/ManagementLoginPage';
import ManagementPortal from './components/ManagementPortal';

// Shared
import NotFoundPage from './components/NotFoundPage';

// Valid management sub-views
const VALID_VIEWS = new Set(['dashboard', 'floor', 'seating', 'bookings', 'history', 'waitlist', 'tables', 'analytics']);

/**
 * ProtectedRoute: Enforces role-based authorization for protected routes.
 * Redirects unauthenticated or wrong-role users to their portal login.
 */
function ProtectedRoute({ role, children }) {
  const { user, token, loading } = useAuth();
  if (loading) return null;
  if (!token || !user) {
    return <Navigate to={role === 'MANAGER' ? '/management/login' : '/customer/login'} replace />;
  }
  if (user?.role !== role) {
    return <Navigate to={role === 'MANAGER' ? '/management/login' : '/customer/login'} replace />;
  }
  return children;
}

/**
 * ManagementView: Derives the management view from the current URL path
 * and passes it to ManagementPortal as initialView.
 * Uses a single ManagementPortal instance to preserve component state
 * (tables, bookings, etc.) across internal navigation.
 */
function ManagementView() {
  const location = useLocation();
  // Extract the sub-path after /management/ or /management
  const rawPath = location.pathname.replace(/^\/management\/?/, '').toLowerCase();
  const mappedView = rawPath === 'seating' ? 'floor' : rawPath;
  const view = VALID_VIEWS.has(mappedView) ? mappedView : 'dashboard';
  return <ManagementPortal initialView={view} />;
}

/**
 * AuthLoadingScreen: Displayed while authentication state is being initialized.
 * Prevents UI flickering (e.g., briefly showing customer portal then redirecting).
 */
function AuthLoadingScreen() {
  return (
    <div className="auth-loading-screen">
      <div className="auth-loading-content">
        <UtensilsCrossed size={40} className="logo-icon auth-loading-icon" />
        <span className="logo-text" style={{ fontSize: '1.8rem' }}>DineSmart</span>
        <div className="auth-loading-spinner" />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
          Initializing session...
        </p>
      </div>
    </div>
  );
}

/**
 * AppRoutes: Defines all application routes.
 * Wrapped inside AuthProvider so useAuth() is available.
 * 
 * CHANGE: Root "/" now shows HeroPage (landing page) instead of redirecting to /customer.
 */
function AppRoutes() {
  const { loading } = useAuth();

  // Show loading screen while auth state initializes (prevents flicker)
  if (loading) {
    return <AuthLoadingScreen />;
  }

  return (
    <Routes>
      {/* ========================================
          NEW: Landing / Hero Page at root "/"
          ======================================== */}
      <Route path="/" element={<HeroPage />} />

      {/* ========================================
          CUSTOMER PORTAL (/customer/*)
          ======================================== */}
      <Route path="customer/login" element={<CustomerLoginPage />} />
      <Route path="customer/register" element={<CustomerRegisterPage />} />
      <Route path="customer" element={<CustomerLayout />}>
        <Route index element={<CustomerHomePage />} />
        <Route path="reserve" element={<FindTablePage />} />
        <Route 
          path="reservations" 
          element={
            <ProtectedRoute role="CUSTOMER">
              <MyReservationsPage />
            </ProtectedRoute>
          } 
        />
      </Route>

      {/* ========================================
          MANAGEMENT PORTAL (/management/*)
          ======================================== */}
      <Route path="management/login" element={<ManagementLoginPage />} />
      <Route path="management" element={<ManagementLayout />}>
        <Route path="*" element={<ManagementView />} />
        <Route index element={<ManagementView />} />
      </Route>

      {/* Legacy Redirect Shortcuts */}
      <Route path="login" element={<Navigate to="/customer/login" replace />} />
      <Route path="register" element={<Navigate to="/customer/register" replace />} />
      <Route path="reserve" element={<Navigate to="/customer/reserve" replace />} />
      <Route path="reservations" element={<Navigate to="/customer/reservations" replace />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
