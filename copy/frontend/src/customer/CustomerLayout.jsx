import React from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Search, Calendar, Bell, LogOut, User as UserIcon, ShieldCheck, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationCenter from '../components/NotificationCenter';

/**
 * CustomerLayout: Provides the customer application shell with header navigation.
 * 
 * Routes:
 *  /           → Home
 *  /reserve    → Find a Table
 *  /reservations → My Reservations (auth required)
 */
export default function CustomerLayout() {
  const { user, isAuthenticated, isCustomer, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isCustomerAuth = Boolean(isAuthenticated && isCustomer && user);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <Link to="/customer" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'inherit' }}>
            <UtensilsCrossed size={28} className="logo-icon" />
            <span className="logo-text">DineSmart</span>
          </Link>
        </div>

        {/* Center navigation pill removed for a clean, minimal luxury header */}

        {/* Auth Status & Notifications */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isCustomerAuth ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <NotificationCenter />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                <UserIcon size={16} style={{ color: 'var(--status-free)' }} />
                <span style={{ fontWeight: 500 }}>{user?.name || user?.email || 'Customer'}</span>
                <span style={{ 
                  fontSize: '0.7rem', 
                  padding: '0.1rem 0.4rem', 
                  borderRadius: 'var(--radius-sm)', 
                  backgroundColor: 'var(--status-free-glow)',
                  color: 'var(--status-free)',
                  fontWeight: 600
                }}>
                  CUSTOMER
                </span>
              </div>
              <button 
                onClick={handleLogout}
                className="btn-secondary"
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: 'var(--radius-sm)' }}
                title="Sign Out"
              >
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                <UserIcon size={16} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Guest</span>
                <span style={{ 
                  fontSize: '0.7rem', 
                  padding: '0.1rem 0.4rem', 
                  borderRadius: 'var(--radius-sm)', 
                  backgroundColor: 'rgba(28, 28, 28, 0.06)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600
                }}>
                  GUEST
                </span>
              </div>
              <Link 
                to="/customer/login"
                className="btn-primary"
                style={{ padding: '0.35rem 0.85rem', fontSize: '0.82rem', textDecoration: 'none', borderRadius: 'var(--radius-full)' }}
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
