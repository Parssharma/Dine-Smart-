import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AccessDeniedPage from './pages/AccessDeniedPage';

/**
 * ManagementLayout: Route-level auth guard for all /management/* routes.
 * 
 * - Unauthenticated → redirect to /management/login
 * - Authenticated CUSTOMER → AccessDeniedPage
 * - Authenticated MANAGER → render child routes via <Outlet />
 */
export default function ManagementLayout() {
  const { isAuthenticated, isManager, loading } = useAuth();

  // Auth is still initializing — show nothing (App.jsx handles loading screen)
  if (loading) return null;

  // Not authenticated → redirect to management login
  if (!isAuthenticated) {
    return <Navigate to="/management/login" replace />;
  }

  // Authenticated but not a manager → Access Denied
  if (!isManager) {
    return <AccessDeniedPage />;
  }

  // Authenticated manager → render management routes
  return <Outlet />;
}
