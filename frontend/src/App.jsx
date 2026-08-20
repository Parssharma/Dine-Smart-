import React, { useState } from 'react';
import { UtensilsCrossed, Users, Settings, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';
import CustomerPortal from './components/CustomerPortal';
import ManagementPortal from './components/ManagementPortal';
import NotificationCenter from './components/NotificationCenter';
import { AuthProvider, useAuth } from './context/AuthContext';

function NavigationBar({ activeTab, setActiveTab }) {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="logo-container">
        <UtensilsCrossed size={28} className="logo-icon" />
        <span className="logo-text">DineSmart</span>
      </div>

      {/* Tab Selection */}
      <nav className="nav-tabs">
        <button 
          className={`nav-tab ${activeTab === 'customer' ? 'active' : ''}`}
          onClick={() => setActiveTab('customer')}
        >
          <Users size={16} />
          Customer Portal
        </button>
        <button 
          className={`nav-tab ${activeTab === 'management' ? 'active' : ''}`}
          onClick={() => setActiveTab('management')}
        >
          <Settings size={16} />
          Management Portal
        </button>
      </nav>

      {/* Auth Status & User Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {isAuthenticated && user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <NotificationCenter />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
              {user?.role === 'MANAGER' ? (
                <ShieldCheck size={16} style={{ color: 'var(--accent-gold)' }} />
              ) : (
                <UserIcon size={16} style={{ color: 'var(--status-free)' }} />
              )}
              <span style={{ fontWeight: 500 }}>{user?.name || 'User'}</span>
              <span style={{ 
                fontSize: '0.7rem', 
                padding: '0.1rem 0.4rem', 
                borderRadius: 'var(--radius-sm)', 
                backgroundColor: user?.role === 'MANAGER' ? 'var(--accent-gold-glow)' : 'var(--status-free-glow)',
                color: user?.role === 'MANAGER' ? 'var(--accent-gold)' : 'var(--status-free)',
                fontWeight: 600
              }}>
                {user?.role || 'GUEST'}
              </span>
            </div>
            <button 
              onClick={logout}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: 'var(--radius-sm)' }}
              title="Sign Out"
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>Guest Session</span>
          </div>
        )}
      </div>
    </header>
  );
}

function MainApp() {
  const [activeTab, setActiveTab] = useState('customer'); // 'customer' or 'management'

  return (
    <div className="app-container">
      <NavigationBar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        {activeTab === 'customer' ? (
          <CustomerPortal />
        ) : (
          <ManagementPortal />
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
