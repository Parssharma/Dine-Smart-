import React, { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config/api';

export default function CustomerAuthModal({ isOpen, onClose, initialMode = 'login', onAuthSuccess }) {
  const { login, register } = useAuth();
  const [authMode, setAuthMode] = useState(initialMode);
  
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  
  const [otp, setOtp] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpStatus, setOtpStatus] = useState("idle"); // idle | sending | sent | error
  const [otpError, setOtpError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setAuthMode(initialMode);
      setAuthError('');
      setOtpStatus('idle');
      setOtpError(null);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (authMode === 'register' && authEmail && isOpen) {
      const checkStatus = async () => {
        try {
          const res = await fetch(`${API_BASE}/auth/otp-status?email=${encodeURIComponent(authEmail)}`);
          const data = await res.json();
          if (data.retryAfterSeconds > 0) {
            setOtpCooldown(data.retryAfterSeconds);
          }
        } catch (e) {}
      };
      checkStatus();
    }
  }, [authMode, authEmail, isOpen]);

  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setInterval(() => setOtpCooldown(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [otpCooldown]);

  const formatCooldown = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSendOtp = async () => {
    if (!authEmail) {
      setOtpStatus("error");
      setOtpError('Please enter an email first to receive OTP.');
      return;
    }
    setOtpStatus("sending");
    setOtpError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 429 && data.retryAfterSeconds) {
          setOtpCooldown(data.retryAfterSeconds);
          setOtpError(data.message || 'Please wait before requesting another OTP.');
        } else {
          setOtpError(data.message || "Couldn't send the code. Please try again.");
        }
        setOtpStatus("error");
        return;
      }
      setOtpStatus("sent");
      setOtpCooldown(60); // Base cooldown
    } catch (err) {
      setOtpStatus("error");
      setOtpError("Network error — please check your connection and try again.");
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    try {
      if (authMode === 'register') {
        if (!otp) throw new Error('Please enter the OTP sent to your email.');
        const verifyRes = await fetch(`${API_BASE}/auth/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail, otp })
        });
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok) {
          throw new Error(verifyData.message || 'OTP verification failed');
        }

        await register(authName, authEmail, authPassword);
        await login(authEmail, authPassword, 'CUSTOMER');
      } else {
        await login(authEmail, authPassword, 'CUSTOMER');
      }
      
      setAuthPassword('');
      setOtp('');
      setOtpStatus('idle');
      if (onAuthSuccess) onAuthSuccess();
      onClose();
    } catch (err) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(28, 28, 28, 0.45)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div className="panel-card" style={{ maxWidth: '420px', width: '100%', padding: '2rem', position: 'relative' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', marginBottom: '0.25rem' }}>
            {authMode === 'login' ? 'Customer Sign In' : 'Create Customer Account'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {authMode === 'login' ? 'Sign in to access your personal reservations' : 'Register to manage bookings seamlessly'}
          </p>
        </div>

        {authError && (
          <div className="alert-banner" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--status-occupied)', marginBottom: '1rem', fontSize: '0.85rem' }}>
            <AlertTriangle size={16} />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleAuthSubmit}>
          {authMode === 'register' && (
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Alice Cooper"
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="alice@example.com"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="At least 6 characters"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {authMode === 'register' && (
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Verification Code (OTP)</span>
                <button 
                  type="button" 
                  onClick={handleSendOtp} 
                  disabled={otpStatus === 'sending' || otpCooldown > 0 || !authEmail}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', fontSize: '0.8rem', cursor: (otpStatus === 'sending' || otpCooldown > 0 || !authEmail) ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: (otpStatus === 'sending' || otpCooldown > 0 || !authEmail) ? 0.6 : 1 }}
                >
                  {otpStatus === 'sending' ? 'Sending...' : (otpCooldown > 0 ? `Try again in ${formatCooldown(otpCooldown)}` : (otpStatus === 'sent' ? 'Resend OTP' : 'Send OTP'))}
                </button>
              </label>
              {otpStatus === 'sent' && <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', marginBottom: '0.5rem' }}>Code sent — check your inbox.</div>}
              {otpStatus === 'error' && <div style={{ fontSize: '0.75rem', color: 'var(--status-occupied)', marginBottom: '0.5rem' }}>{otpError}</div>}
              <input
                type="text"
                className="form-input"
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                maxLength={6}
              />
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={authSubmitting}
            style={{ width: '100%', padding: '0.75rem', fontWeight: 600 }}
          >
            {authSubmitting ? 'Processing...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {authMode === 'login' ? (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontWeight: 600 }}
              >
                Register here
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontWeight: 600 }}
              >
                Sign In
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
