import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from localStorage on startup
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem('dinesmart_token') || 
                            localStorage.getItem('dinesmart_customer_token') || 
                            localStorage.getItem('dinesmart_manager_token');
        const storedUser = localStorage.getItem('dinesmart_user');
        if (storedToken && storedUser) {
          // Validate the token is still valid before trusting it
          const verifyRes = await fetch(`${API_BASE}/auth/me`, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${storedToken}`
            }
          });
          if (verifyRes.ok) {
            const verifyData = await verifyRes.json();
            const activeUser = (verifyData && verifyData.user) ? verifyData.user : JSON.parse(storedUser);
            setToken(storedToken);
            setUser(activeUser);
            localStorage.setItem('dinesmart_user', JSON.stringify(activeUser));
            const roleKey = activeUser.role === 'MANAGER' ? 'dinesmart_manager_token' : 'dinesmart_customer_token';
            localStorage.setItem(roleKey, storedToken);
          } else {
            // Token expired or invalid — clear stored credentials
            console.warn('[AuthContext] Stored token is invalid/expired. Clearing session.');
            localStorage.removeItem('dinesmart_token');
            localStorage.removeItem('dinesmart_customer_token');
            localStorage.removeItem('dinesmart_manager_token');
            localStorage.removeItem('dinesmart_user');
          }
        }
      } catch (e) {
        console.error('Error loading stored auth:', e);
        localStorage.removeItem('dinesmart_token');
        localStorage.removeItem('dinesmart_customer_token');
        localStorage.removeItem('dinesmart_manager_token');
        localStorage.removeItem('dinesmart_user');
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  // Logout function
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('dinesmart_token');
    localStorage.removeItem('dinesmart_customer_token');
    localStorage.removeItem('dinesmart_manager_token');
    localStorage.removeItem('dinesmart_user');
  };

  // Login function with role validation
  const login = async (email, password, expectedRole = null) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Invalid email or password.');
    }

    // Role-specific validation
    if (expectedRole) {
      if (expectedRole === 'CUSTOMER' && data.user?.role === 'MANAGER') {
        // Manager tried to log in via Customer portal
        logout();
        throw new Error('This account is registered for management access. Please use the Management Login.');
      }

      if (expectedRole === 'MANAGER' && data.user?.role !== 'MANAGER') {
        // Customer tried to log in via Manager portal
        logout();
        throw new Error('Management access is restricted to manager accounts.');
      }
    }

    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('dinesmart_token', data.token);
    const roleKey = data.user?.role === 'MANAGER' ? 'dinesmart_manager_token' : 'dinesmart_customer_token';
    localStorage.setItem(roleKey, data.token);
    localStorage.setItem('dinesmart_user', JSON.stringify(data.user));
    return data.user;
  };

  // Register function (always registers as CUSTOMER)
  const register = async (name, email, password) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Registration failed');
    }
    return data;
  };


  const getAuthHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const openAuthModal = (mode = 'login') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };
  const closeAuthModal = () => setShowAuthModal(false);

  const value = {
    user,
    token,
    role: user?.role || null,
    isAuthenticated: Boolean(token && user),
    isManager: user?.role === 'MANAGER',
    isCustomer: user?.role === 'CUSTOMER',
    loading,
    login,
    register,
    logout,
    getAuthHeaders,
    showAuthModal,
    authMode,
    openAuthModal,
    closeAuthModal
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
