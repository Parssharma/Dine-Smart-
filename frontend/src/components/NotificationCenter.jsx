import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Calendar, 
  X, 
  Sparkles, 
  Flame, 
  RefreshCw 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_BASE = 'http://localhost:5000/api';

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getNotificationIcon(type) {
  switch (type) {
    case 'BOOKING_CONFIRMED':
      return <CheckCircle2 size={16} style={{ color: 'var(--status-free)' }} />;
    case 'BOOKING_CHECKED_IN':
      return <CheckCircle2 size={16} style={{ color: '#3b82f6' }} />;
    case 'BOOKING_SEATED':
      return <Sparkles size={16} style={{ color: 'var(--accent-gold)' }} />;
    case 'BOOKING_COMPLETED':
      return <CheckCheck size={16} style={{ color: 'var(--status-free)' }} />;
    case 'BOOKING_CANCELLED':
    case 'BOOKING_NO_SHOW':
      return <AlertCircle size={16} style={{ color: 'var(--status-occupied)' }} />;
    case 'WAITLIST_PROMOTED':
      return <Sparkles size={16} style={{ color: 'var(--accent-gold)' }} />;
    case 'RESERVATION_REMINDER':
      return <Clock size={16} style={{ color: '#f59e0b' }} />;
    case 'LONG_DINING':
    case 'TURNOVER_REQUIRED':
      return <Flame size={16} style={{ color: '#f97316' }} />;
    case 'NO_SHOW_ELIGIBLE':
      return <AlertCircle size={16} style={{ color: '#ef4444' }} />;
    default:
      return <Bell size={16} style={{ color: 'var(--accent-gold)' }} />;
  }
}

export default function NotificationCenter({ onSelectBooking }) {
  const { token, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchUnreadCount = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  const fetchNotifications = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchUnreadCount();
      const interval = setInterval(() => {
        fetchUnreadCount();
      }, 20000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error marking all read:', err);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="notification-center-container" ref={dropdownRef} style={{ position: 'relative' }}>
      <button 
        className="btn-secondary notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        style={{
          position: 'relative',
          padding: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-full)',
          backgroundColor: isOpen ? 'var(--bg-tertiary)' : 'transparent',
          border: '1px solid var(--border-color)',
          cursor: 'pointer'
        }}
      >
        <Bell size={18} style={{ color: unreadCount > 0 ? 'var(--accent-gold)' : 'var(--text-secondary)' }} />
        {unreadCount > 0 && (
          <span 
            className="notification-badge"
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: 'var(--accent-gold)',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              minWidth: '18px',
              height: '18px',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              boxShadow: '0 0 8px var(--accent-gold-glow)'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div 
          className="notification-dropdown glass-card animate-scale-up"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '360px',
            maxHeight: '480px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.85rem 1rem',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-tertiary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={16} style={{ color: 'var(--accent-gold)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Notifications</span>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--accent-gold-glow)',
                  color: 'var(--accent-gold)',
                  fontWeight: 600
                }}>
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-gold)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontWeight: 500
                }}
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div style={{ overflowY: 'auto', maxHeight: '400px' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <RefreshCw size={18} className="spin" style={{ marginBottom: '0.5rem' }} />
                <p>Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <Bell size={24} style={{ color: 'var(--text-muted)', opacity: 0.4, marginBottom: '0.5rem' }} />
                <p style={{ fontWeight: 500 }}>No notifications yet</p>
                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Updates on your reservations will appear here.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div 
                  key={item._id}
                  onClick={() => {
                    if (!item.read) handleMarkAsRead(item._id);
                    if (item.relatedBookingId && onSelectBooking) {
                      onSelectBooking(item.relatedBookingId._id || item.relatedBookingId);
                    }
                  }}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: item.read ? 'transparent' : 'rgba(217, 119, 6, 0.05)',
                    display: 'flex',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    position: 'relative'
                  }}
                  className="notification-item"
                >
                  <div style={{
                    marginTop: '2px',
                    width: '28px',
                    height: '28px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {getNotificationIcon(item.type)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ 
                        fontWeight: item.read ? 500 : 700, 
                        fontSize: '0.85rem',
                        color: item.read ? 'var(--text-primary)' : '#fff'
                      }}>
                        {item.title}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                    <p style={{ 
                      fontSize: '0.78rem', 
                      color: item.read ? 'var(--text-secondary)' : 'var(--text-primary)', 
                      margin: '0.2rem 0 0 0',
                      lineHeight: '1.3'
                    }}>
                      {item.message}
                    </p>
                  </div>

                  {!item.read && (
                    <button 
                      onClick={(e) => handleMarkAsRead(item._id, e)}
                      title="Mark as read"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px',
                        alignSelf: 'center',
                        opacity: 0.6
                      }}
                    >
                      <CheckCheck size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
