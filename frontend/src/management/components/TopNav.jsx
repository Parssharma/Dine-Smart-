import React, { useState } from 'react';
import { RotateCw, LogOut, Sparkles, Menu, X } from 'lucide-react';
import { NAV_ITEMS } from '../../config/managementNav';
import NotificationCenter from '../../components/NotificationCenter';

/**
 * TopNav — Flat horizontal navigation for the Management Portal.
 * Uses filled buttons instead of underlines.
 * 
 * Props:
 *   currentView   — active view key (e.g. 'dashboard', 'floor', 'bookings')
 *   navigateToView — callback to change view and update URL
 *   fetchData      — manual sync/refresh callback
 *   isRefreshing   — loading state for sync button
 *   user           — authenticated user object
 *   logout         — logout callback
 *   navigate       — react-router navigate function
 */
export default function TopNav({ 
  currentView, 
  navigateToView, 
  fetchData, 
  isRefreshing, 
  user, 
  logout, 
  navigate 
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavClick = (view) => {
    navigateToView(view);
    setMobileOpen(false);
  };

  return (
    <header className="mgmt-topnav">
      {/* Brand */}
      <div className="mgmt-topnav__brand">
        <Sparkles size={18} className="mgmt-topnav__brand-icon" />
        <span className="mgmt-topnav__brand-text">DineSmart</span>
        <span className="mgmt-topnav__brand-badge">MANAGER</span>
      </div>

      {/* Mobile hamburger toggle */}
      <button 
        className="mgmt-topnav__hamburger"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Navigation links */}
      <nav className={`mgmt-topnav__links ${mobileOpen ? 'is-open' : ''}`}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            className={`mgmt-topnav__item ${currentView === item.view ? 'is-active' : ''}`}
            onClick={() => handleNavClick(item.view)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Right-side controls */}
      <div className="mgmt-topnav__right">
        <NotificationCenter />
        <button
          onClick={() => fetchData()}
          disabled={isRefreshing}
          className="mgmt-topnav__sync-btn"
          title="Sync latest operational data"
        >
          <RotateCw size={15} className={isRefreshing ? 'spin-animation' : ''} />
          <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
        </button>
        <div className="mgmt-topnav__profile-group">
          <span className="mgmt-topnav__profile-name">{user?.name || 'Manager'}</span>
          <button
            onClick={() => {
              logout();
              navigate('/management/login');
            }}
            className="mgmt-topnav__logout-btn"
            title="Sign Out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
