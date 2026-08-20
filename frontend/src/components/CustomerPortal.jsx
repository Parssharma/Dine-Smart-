import React, { useState, useEffect } from 'react';
import { 
  Search, Sparkles, Clock, User, Phone, MapPin, Users, CheckCircle, 
  AlertTriangle, LogIn, UserPlus, X, Calendar, Ban
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_BASE = 'http://localhost:5000/api';

export default function CustomerPortal() {
  const { user, isAuthenticated, login, register, getAuthHeaders } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];

  // Tab View within customer portal: 'reserve' | 'my-bookings'
  const [activeCustomerTab, setActiveCustomerTab] = useState('reserve');

  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Booking Form State
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [contact, setContact] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [preference, setPreference] = useState('');
  const [bookingDate, setBookingDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('20:30');
  
  // Search & Results State
  const [searching, setSearching] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Booking Outcomes
  const [bookingSuccess, setBookingSuccess] = useState(null); // { type: 'booking' | 'waitlist', data: ..., position?: number }
  const [errorMsg, setErrorMsg] = useState('');
  const [confirming, setConfirming] = useState(false);

  // My Bookings State
  const [myBookings, setMyBookings] = useState([]);
  const [loadingMyBookings, setLoadingMyBookings] = useState(false);

  // Filter sub-tabs in My Reservations: 'all' | 'upcoming' | 'active' | 'completed' | 'cancelled'
  const [historyTab, setHistoryTab] = useState('all');

  // Timeline Modal State
  const [selectedBookingTimeline, setSelectedBookingTimeline] = useState(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineData, setTimelineData] = useState([]);

  const viewBookingTimeline = async (booking) => {
    setSelectedBookingTimeline(booking);
    setTimelineLoading(true);
    try {
      const res = await fetch(`${API_BASE}/bookings/${booking._id}/history`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      setTimelineData(Array.isArray(data.history) ? data.history : []);
    } catch (err) {
      console.error('Error fetching booking timeline:', err);
    } finally {
      setTimelineLoading(false);
    }
  };

  const filteredBookings = myBookings.filter(b => {
    if (historyTab === 'upcoming') return b.status === 'Confirmed';
    if (historyTab === 'active') return b.status === 'Checked In' || b.status === 'Seated';
    if (historyTab === 'completed') return b.status === 'Completed';
    if (historyTab === 'cancelled') return b.status === 'Cancelled' || b.status === 'No Show';
    return true;
  });

  // Update customerName when user logs in
  useEffect(() => {
    if (user?.name) {
      setCustomerName(user.name);
    }
  }, [user]);

  // Fetch customer's own bookings
  const fetchMyBookings = async () => {
    if (!isAuthenticated) return;
    setLoadingMyBookings(true);
    try {
      const res = await fetch(`${API_BASE}/bookings`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setMyBookings(data);
      }
    } catch (err) {
      console.error('Error fetching my bookings:', err);
    } finally {
      setLoadingMyBookings(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && activeCustomerTab === 'my-bookings') {
      fetchMyBookings();
    }
  }, [isAuthenticated, activeCustomerTab]);

  // Cancel own booking
  const handleCancelOwnBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    try {
      const res = await fetch(`${API_BASE}/bookings/${bookingId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'Cancelled' })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to cancel booking');
      }
      fetchMyBookings();
    } catch (err) {
      alert(err.message);
    }
  };

  // Periodically refresh recommendations in real-time if a search is active
  useEffect(() => {
    if (!hasSearched || recommendations.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/dsa/recommend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            partySize: parseInt(partySize, 10), 
            preference,
            bookingDate,
            startTime,
            endTime
          })
        });
        const data = await res.json();
        if (res.ok) {
          setRecommendations(data);
        }
      } catch (err) {
        console.error('Silent recommendations refresh failed:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [hasSearched, recommendations.length, partySize, preference, bookingDate, startTime, endTime]);

  // Handle Table Search (Recommendations)
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!partySize || parseInt(partySize, 10) <= 0) return;

    if (startTime >= endTime) {
      setErrorMsg('End time must be later than start time.');
      return;
    }
    
    setSearching(true);
    setHasSearched(false);
    setErrorMsg('');
    setBookingSuccess(null);
    setSelectedTable(null);

    try {
      const res = await fetch(`${API_BASE}/dsa/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          partySize: parseInt(partySize, 10), 
          preference,
          bookingDate,
          startTime,
          endTime
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to search tables');
      
      setRecommendations(data);
      setHasSearched(true);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSearching(false);
    }
  };

  // Submit Booking
  const handleBooking = async (e) => {
    e.preventDefault();
    if (confirming) return;
    if (!customerName || !contact || !partySize) {
      setErrorMsg('Please fill in Name, Contact, and Party Size.');
      return;
    }

    if (startTime >= endTime) {
      setErrorMsg('End time must be later than start time.');
      return;
    }

    const cleanContact = contact.replace(/[\s\-()]/g, '');
    if (!/^\d{10}$/.test(cleanContact)) {
      setErrorMsg('Please enter a valid 10-digit phone number.');
      return;
    }

    setErrorMsg('');
    setBookingSuccess(null);
    setConfirming(true);

    try {
      const payload = {
        customerName,
        contact,
        partySize: parseInt(partySize, 10),
        tableId: selectedTable ? selectedTable.id : null,
        bookingDate,
        startTime,
        endTime
      };

      const res = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create booking');
      
      setBookingSuccess({
        type: data.type,
        data: data.data,
        position: data.position
      });

      if (!isAuthenticated) {
        setCustomerName('');
      }
      setContact('');
      setRecommendations([]);
      setSelectedTable(null);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setConfirming(false);
    }
  };

  // Check waitlist position dynamically
  const checkWaitlistPosition = async () => {
    if (!bookingSuccess || bookingSuccess.type !== 'waitlist') return;
    try {
      const res = await fetch(`${API_BASE}/bookings/waitlist/position/${bookingSuccess.data._id}`);
      const data = await res.json();
      if (data.status === 'promoted' && data.booking) {
        setBookingSuccess({
          type: 'booking',
          data: data.booking
        });
      } else {
        setBookingSuccess(prev => ({
          ...prev,
          position: data.position
        }));
      }
    } catch (err) {
      console.error('Error refreshing waitlist position:', err);
    }
  };

  useEffect(() => {
    if (!bookingSuccess || bookingSuccess.type !== 'waitlist') return;
    const interval = setInterval(checkWaitlistPosition, 3000);
    return () => clearInterval(interval);
  }, [bookingSuccess]);

  // Handle Customer Auth Modal Submit
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    try {
      if (authMode === 'register') {
        await register(authName, authEmail, authPassword);
        // Automatically log in after registration
        await login(authEmail, authPassword);
      } else {
        await login(authEmail, authPassword);
      }
      setShowAuthModal(false);
      setAuthPassword('');
    } catch (err) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  return (
    <div>
      {/* Customer Header Sub-Bar with Tabs & Sign In prompt */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn-secondary ${activeCustomerTab === 'reserve' ? 'active' : ''}`}
            onClick={() => setActiveCustomerTab('reserve')}
            style={{ 
              padding: '0.5rem 1rem', 
              backgroundColor: activeCustomerTab === 'reserve' ? 'var(--accent-gold)' : 'var(--bg-card)',
              color: activeCustomerTab === 'reserve' ? '#000' : 'var(--text-primary)',
              fontWeight: 600
            }}
          >
            <Clock size={16} style={{ display: 'inline', marginRight: '0.4rem' }} />
            Reserve Table
          </button>
          
          {isAuthenticated && (
            <button
              className={`btn-secondary ${activeCustomerTab === 'my-bookings' ? 'active' : ''}`}
              onClick={() => setActiveCustomerTab('my-bookings')}
              style={{ 
                padding: '0.5rem 1rem', 
                backgroundColor: activeCustomerTab === 'my-bookings' ? 'var(--accent-gold)' : 'var(--bg-card)',
                color: activeCustomerTab === 'my-bookings' ? '#000' : 'var(--text-primary)',
                fontWeight: 600
              }}
            >
              <Calendar size={16} style={{ display: 'inline', marginRight: '0.4rem' }} />
              My Reservations
            </button>
          )}
        </div>

        {!isAuthenticated && (
          <button
            onClick={() => { setShowAuthModal(true); setAuthError(''); }}
            className="btn-secondary"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <LogIn size={15} />
            <span>Customer Sign In / Register</span>
          </button>
        )}
      </div>

      {/* MY RESERVATIONS VIEW */}
      {activeCustomerTab === 'my-bookings' && isAuthenticated ? (
        <div className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Calendar size={22} className="logo-icon" />
              My Reservations ({filteredBookings.length})
            </h2>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              {[
                { key: 'all', label: 'All' },
                { key: 'upcoming', label: 'Upcoming' },
                { key: 'active', label: 'Active' },
                { key: 'completed', label: 'Completed' },
                { key: 'cancelled', label: 'Cancelled' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setHistoryTab(tab.key)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    backgroundColor: historyTab === tab.key ? 'var(--accent-gold)' : 'transparent',
                    color: historyTab === tab.key ? '#000' : 'var(--text-secondary)',
                    fontWeight: historyTab === tab.key ? 700 : 500,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loadingMyBookings ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading your reservations...</div>
          ) : filteredBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <p>No reservations found in this category.</p>
              <button 
                onClick={() => setActiveCustomerTab('reserve')} 
                className="btn-primary" 
                style={{ marginTop: '1rem', padding: '0.5rem 1.2rem' }}
              >
                Book a Table Now
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {filteredBookings.map((b) => {
                let badgeBg = 'var(--status-free-glow)';
                let badgeColor = 'var(--status-free)';
                if (b.status === 'Checked In') {
                  badgeBg = 'rgba(59, 130, 246, 0.15)';
                  badgeColor = '#3b82f6';
                } else if (b.status === 'Seated') {
                  badgeBg = 'var(--accent-gold-glow)';
                  badgeColor = 'var(--accent-gold)';
                } else if (b.status === 'Completed') {
                  badgeBg = 'rgba(16, 185, 129, 0.15)';
                  badgeColor = '#10b981';
                } else if (b.status === 'Cancelled' || b.status === 'No Show') {
                  badgeBg = 'rgba(239, 68, 68, 0.15)';
                  badgeColor = 'var(--status-occupied)';
                }

                return (
                  <div 
                    key={b._id} 
                    style={{
                      padding: '1.25rem',
                      backgroundColor: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          padding: '0.2rem 0.5rem', 
                          borderRadius: 'var(--radius-sm)', 
                          fontWeight: 700,
                          backgroundColor: badgeBg,
                          color: badgeColor
                        }}>
                          {b.status}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{b.bookingDate}</span>
                      </div>
                      <h4 style={{ fontSize: '1.15rem', marginBottom: '0.35rem' }}>
                        Table {b.tableId?.number ? `T-${b.tableId.number}` : 'Auto-Assigned'}
                      </h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        Time: <strong>{b.startTime} - {b.endTime}</strong> • Party of <strong>{b.partySize}</strong>
                      </p>
                      {b.checkedInAt && (
                        <p style={{ fontSize: '0.75rem', color: '#3b82f6' }}>
                          Checked in at {new Date(b.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {b.seatedAt && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--accent-gold)' }}>
                          Seated at {new Date(b.seatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => viewBookingTimeline(b)}
                        className="btn-secondary"
                        style={{
                          flex: 1,
                          padding: '0.4rem 0.6rem',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <Clock size={14} />
                        View Timeline
                      </button>

                      {(b.status === 'Confirmed' || b.status === 'Checked In') && (
                        <button
                          onClick={() => handleCancelOwnBooking(b._id)}
                          className="btn-secondary"
                          style={{ 
                            padding: '0.4rem 0.75rem', 
                            fontSize: '0.8rem', 
                            color: 'var(--status-occupied)', 
                            borderColor: 'rgba(239,68,68,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <Ban size={14} />
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* STANDARD RESERVATION VIEW */
        <div className="grid-layout">
          {/* Search & Selection Panel */}
          <div className="panel-card">
            <h2 className="panel-title">
              <Search size={22} className="logo-icon" />
              Find & Recommend Table
            </h2>

            <form onSubmit={handleSearch} style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Party Size</label>
                  <select 
                    className="form-select" 
                    value={partySize} 
                    onChange={(e) => setPartySize(e.target.value)}
                  >
                    <option value="1">1 Person</option>
                    <option value="2">2 People</option>
                    <option value="3">3 People</option>
                    <option value="4">4 People</option>
                    <option value="5">5 People</option>
                    <option value="6">6 People</option>
                    <option value="8">8 People</option>
                    <option value="10">10 People</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Preferred Location</label>
                  <select 
                    className="form-select" 
                    value={preference} 
                    onChange={(e) => setPreference(e.target.value)}
                  >
                    <option value="">No Preference</option>
                    <option value="Window">Window Seat</option>
                    <option value="Center">Center Dining</option>
                    <option value="Outdoor">Outdoor Patio</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 0.9fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={bookingDate} 
                    onChange={(e) => setBookingDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input 
                    type="time" 
                    className="form-input" 
                    value={startTime} 
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input 
                    type="time" 
                    className="form-input" 
                    value={endTime} 
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={searching}>
                {searching ? 'Finding Best Options...' : 'Search Available Tables'}
              </button>
            </form>

            {/* Recommendation Results (Priority Queue output) */}
            {recommendations.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <Sparkles size={18} style={{ color: 'var(--accent-gold)' }} />
                    Smart Recommendations
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Powered by Smart Booking Engine</span>
                </div>

                {preference && !recommendations.some(r => r.location === preference) && (
                  <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--status-waitlist)' }}>
                    Your preferred location ({preference}) is fully occupied. Showing the best alternative table options:
                  </div>
                )}

                <div className="rec-list">
                  {recommendations.map((rec, idx) => {
                    const maxPossible = 10.0 + 5.0 + (preference ? 5.0 : 0.0);
                    const matchPercentage = Math.min(100, Math.round((rec.score / maxPossible) * 100));

                    return (
                      <div 
                        key={rec.id} 
                        className={`rec-card ${selectedTable?.id === rec.id ? 'selected' : ''}`}
                        onClick={() => setSelectedTable(selectedTable?.id === rec.id ? null : rec)}
                        style={{ cursor: 'pointer', border: selectedTable?.id === rec.id ? '1px solid var(--accent-gold)' : '1px solid var(--border-color)', position: 'relative' }}
                      >
                        {idx === 0 && (
                          <span style={{ position: 'absolute', top: '-10px', left: '12px', fontSize: '0.7rem', padding: '0.1rem 0.4rem', backgroundColor: 'var(--accent-gold)', borderRadius: 'var(--radius-sm)', fontWeight: 600, letterSpacing: '0.05em' }}>
                            BEST MATCH
                          </span>
                        )}
                        <div className="rec-info">
                          <span className="rec-match-pill" style={{ backgroundColor: matchPercentage > 85 ? 'var(--status-free-glow)' : 'var(--accent-gold-glow)', color: matchPercentage > 85 ? 'var(--status-free)' : 'var(--accent-gold)' }}>
                            Match: {matchPercentage}%
                          </span>
                          <h4 style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>Table T-{rec.number || rec.id.substring(rec.id.length - 4).toUpperCase()}</h4>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Capacity: {rec.capacity} seats • Rating: ★ {rec.rating}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          <MapPin size={16} />
                          <span>{rec.location}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                  * Select a recommended table card above to reserve it directly, or click below without selecting to request the next available table or join the waitlist.
                </p>
              </div>
            )}

            {recommendations.length === 0 && !searching && (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                {hasSearched ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={24} style={{ color: 'var(--status-waitlist)' }} />
                    <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>No matching tables available</span>
                    <span style={{ fontSize: '0.9rem' }}>
                      All tables matching this capacity are occupied.
                      Please use the form on the right to join the waiting list!
                    </span>
                  </div>
                ) : (
                  "Enter party size and search to see the best algorithmic table recommendations."
                )}
              </div>
            )}
          </div>

          {/* Booking Form Panel */}
          <div className="panel-card">
            <h2 className="panel-title">
              <Clock size={22} className="logo-icon" />
              Reserve or Join Waiting List
            </h2>

            {bookingSuccess && (
              <div>
                {bookingSuccess.type === 'booking' ? (
                  <div className="alert-banner">
                    <CheckCircle size={24} />
                    <div>
                      <h4 style={{ fontWeight: 600 }}>Booking Confirmed!</h4>
                      <p style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                        Welcome <strong>{bookingSuccess.data.customerName}</strong>! Your table is confirmed at <strong>Table T-{bookingSuccess.data.tableId?.number || 'Auto-Assigned'}</strong> on <strong>{bookingSuccess.data.bookingDate}</strong> from <strong>{bookingSuccess.data.startTime} to {bookingSuccess.data.endTime}</strong>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="alert-banner warning">
                    <AlertTriangle size={24} />
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontWeight: 600 }}>Tables Full — Added to Waiting List</h4>
                      <p style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                        Position: <strong>#{bookingSuccess.position}</strong> in waiting line for <strong>{bookingSuccess.data.bookingDate} ({bookingSuccess.data.startTime} - {bookingSuccess.data.endTime})</strong>.
                      </p>
                    </div>
                    <button 
                      onClick={checkWaitlistPosition} 
                      className="btn-secondary" 
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
                    >
                      Refresh Position
                    </button>
                  </div>
                )}
              </div>
            )}

            {errorMsg && (
              <div className="alert-banner" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--status-occupied)' }}>
                <AlertTriangle size={20} />
                <div>
                  <h4 style={{ fontWeight: 600 }}>Error</h4>
                  <p style={{ fontSize: '0.9rem' }}>{errorMsg}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleBooking}>
              <div className="form-group">
                <label className="form-label">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <User size={16} /> Customer Name
                  </span>
                </label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Eleanor Vance" 
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Phone size={16} /> Contact Details
                  </span>
                </label>
                <input 
                  type="tel" 
                  className="form-input" 
                  placeholder="e.g. 5550199123" 
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  pattern="^\d{10}$"
                  title="Please enter a valid 10-digit phone number (digits only)"
                  required
                />
              </div>

              <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                  RESERVATION CONFIGURATION
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.95rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Guests: <strong>{partySize}</strong></span>
                    <span>Date: <strong>{bookingDate}</strong></span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Time: <strong>{startTime} – {endTime}</strong></span>
                    <span>Table: <strong>{selectedTable ? `Table T-${selectedTable.number || selectedTable.id.substring(selectedTable.id.length - 4).toUpperCase()}` : 'None (Auto/Waitlist)'}</strong></span>
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                disabled={confirming}
                style={{ marginTop: '1.5rem', backgroundColor: selectedTable ? 'var(--status-free)' : 'var(--accent-gold)', opacity: confirming ? 0.7 : 1 }}
              >
                {confirming ? 'Confirming booking...' : (selectedTable ? 'Confirm Selected Table' : 'Request Table / Join Waitlist')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER AUTH MODAL */}
      {showAuthModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="panel-card" style={{ maxWidth: '420px', width: '100%', padding: '2rem', position: 'relative' }}>
            <button
              onClick={() => setShowAuthModal(false)}
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
      )}

      {/* RESERVATION TIMELINE MODAL */}
      {selectedBookingTimeline && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="panel-card glass-card" style={{ maxWidth: '520px', width: '100%', padding: '1.75rem', position: 'relative', maxHeight: '85vh', overflowY: 'auto' }}>
            <button
              onClick={() => setSelectedBookingTimeline(null)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Reservation Timeline
              </span>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.35rem', marginTop: '0.2rem' }}>
                Table {selectedBookingTimeline.tableId?.number ? `T-${selectedBookingTimeline.tableId.number}` : 'Auto'} • {selectedBookingTimeline.bookingDate}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Party of {selectedBookingTimeline.partySize} ({selectedBookingTimeline.startTime} - {selectedBookingTimeline.endTime})
              </p>
            </div>

            {/* Visual Lifecycle Stepper */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.5rem 0', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '14px', left: '20px', right: '20px', height: '2px', backgroundColor: 'var(--border-color)', zIndex: 0 }} />
              
              {[
                { label: 'Confirmed', done: true },
                { label: 'Checked In', done: Boolean(selectedBookingTimeline.checkedInAt || selectedBookingTimeline.status === 'Checked In' || selectedBookingTimeline.status === 'Seated' || selectedBookingTimeline.status === 'Completed') },
                { label: 'Seated', done: Boolean(selectedBookingTimeline.seatedAt || selectedBookingTimeline.status === 'Seated' || selectedBookingTimeline.status === 'Completed') },
                { label: 'Completed', done: Boolean(selectedBookingTimeline.completedAt || selectedBookingTimeline.status === 'Completed') }
              ].map((step, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: step.done ? 'var(--accent-gold)' : 'var(--bg-tertiary)',
                    color: step.done ? '#000' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    border: '2px solid var(--bg-card)'
                  }}>
                    {idx + 1}
                  </div>
                  <span style={{ fontSize: '0.75rem', marginTop: '0.4rem', color: step.done ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: step.done ? 600 : 400 }}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Reservation History Log */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={15} style={{ color: 'var(--accent-gold)' }} />
                Reservation History
              </h4>

              {timelineLoading ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading timeline events...</div>
              ) : timelineData.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No activity history recorded yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {timelineData.map((ev, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.82rem', padding: '0.5rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)', marginTop: '5px', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {ev.previousStatus ? `${ev.previousStatus} → ${ev.newStatus}` : ev.newStatus}
                          </span>
                          <span style={{ fontSize: '0.75rem' }}>
                            {new Date(ev.timestamp || ev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {ev.reason && <p style={{ color: 'var(--text-muted)', margin: '0.2rem 0 0 0', fontSize: '0.75rem' }}>{ev.reason}</p>}
                        <span style={{ fontSize: '0.7rem', color: 'var(--accent-gold)' }}>Updated By: {ev.changedByName} ({ev.changedByRole})</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
