import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, AlertCircle, Mail, Lock, Home } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ManagementLoginPage() {
  const { isAuthenticated, isManager, login } = useAuth();
  const navigate = useNavigate();

  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // If already authenticated as manager, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated && isManager) {
      navigate('/management', { replace: true });
    }
  }, [isAuthenticated, isManager, navigate]);

  const handleManagerLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      // Explicitly enforce MANAGER role
      await login(managerEmail, managerPassword, 'MANAGER');
      navigate('/management', { replace: true });
    } catch (err) {
      setLoginError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div className="management-login-page">
      <div className="management-login-card panel-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--accent-gold-glow)', color: 'var(--accent-gold)', marginBottom: '1rem' }}>
            <ShieldCheck size={36} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', marginBottom: '0.5rem' }}>
            Manager Portal
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Restricted Area. Please sign in with your DineSmart Manager credentials.
          </p>
        </div>

        {loginError && (
          <div className="alert-banner" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--status-occupied)', marginBottom: '1.5rem' }}>
            <AlertCircle size={18} />
            <div style={{ fontSize: '0.85rem' }}>{loginError}</div>
          </div>
        )}

        <form onSubmit={handleManagerLogin}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={16} /> Manager Email
              </span>
            </label>
            <input
              type="email"
              className="form-input"
              placeholder="manager@dinesmart.com"
              value={managerEmail}
              onChange={(e) => setManagerEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={16} /> Password
              </span>
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••••••"
              value={managerPassword}
              onChange={(e) => setManagerPassword(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loggingIn}
            style={{ width: '100%', padding: '0.8rem', fontWeight: 600, fontSize: '0.95rem' }}
          >
            {loggingIn ? 'Authenticating Manager...' : 'Sign In as Manager'}
          </button>
        </form>
      </div>
    </div>
  );
}
