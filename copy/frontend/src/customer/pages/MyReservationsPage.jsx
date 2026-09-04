import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import CustomerPortal from '../../components/CustomerPortal';

/**
 * MyReservationsPage: Renders the CustomerPortal in 'my-bookings' mode.
 * Requires authentication — redirects to /reserve if not authenticated.
 * Route: /reservations
 */
export default function MyReservationsPage() {
  const { isAuthenticated, isCustomer, loading } = useAuth();

  if (loading) return null;

  if (!isAuthenticated || !isCustomer) {
    return <Navigate to="/reserve" replace />;
  }

  return <CustomerPortal initialTab="my-bookings" />;
}
