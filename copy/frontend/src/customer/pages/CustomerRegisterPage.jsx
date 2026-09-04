import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, AlertCircle, Mail, Lock, User, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function CustomerRegisterPage() {
  const { isAuthenticated, isCustomer, register, login } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated as customer, redirect to reserve
  useEffect(() => {
    if (isAuthenticated && isCustomer) {
      navigate('/customer/reserve', { replace: true });
    }
  }, [isAuthenticated, isCustomer, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setSubmitting(true);
    try {
      // Register always creates CUSTOMER role on backend
      await register(name, email, password);
      // Auto login as CUSTOMER
      await login(email, password, 'CUSTOMER');
      navigate('/customer/reserve', { replace: true });
    } catch (err) {
      setAuthError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="management-login-page">
      <div className="management-login-card panel-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--accent-gold-glow)', color: 'var(--accent-gold)', marginBottom: '1rem' }}>
            <UserPlus size={36} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', marginBottom: '0.5rem' }}>
            Create Customer Account
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Join DineSmart to book tables with AI recommendations and track your waitlist in real time.
          </p>
        </div>

        {authError && (
          <div className="alert-banner" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--status-occupied)', marginBottom: '1.5rem' }}>
            <AlertCircle size={18} />
            <div style={{ fontSize: '0.85rem' }}>{authError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={16} /> Full Name
              </span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Sarah Connor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={16} /> Email Address
              </span>
            </label>
            <input
              type="email"
              className="form-input"
              placeholder="sarah@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={16} /> Password (min 6 characters)
              </span>
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={submitting}
            style={{ width: '100%', padding: '0.8rem', fontWeight: 600, fontSize: '0.95rem' }}
          >
            {submitting ? 'Creating Account...' : 'Register as Customer'}
          </button>
        </form>

        <div style={{ marginTop: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Already have an account? </span>
            <Link to="/customer/login" style={{ color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
