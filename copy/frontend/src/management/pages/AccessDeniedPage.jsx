import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Home } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AccessDeniedPage() {
  const { user, logout } = useAuth();

  return (
    <div className="access-denied-page">
      <div className="panel-card" style={{ maxWidth: '500px', padding: '2.5rem 2rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--status-occupied-glow)', color: 'var(--status-occupied)', marginBottom: '1.25rem' }}>
          <AlertCircle size={40} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', marginBottom: '0.75rem' }}>
          Access Denied
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
          Your account is authenticated as <strong>{user?.name}</strong> with the <strong>CUSTOMER</strong> role.
          <br />
          Manager role is required to access table operations, smart seating, and live floor management.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={logout} 
            className="btn-primary"
            style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}
          >
            Log Out & Switch Account
          </button>
          <Link 
            to="/customer" 
            className="btn-secondary"
            style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Home size={16} />
            Customer Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
