import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Users, User, Trash2, CheckCircle2, RotateCw, GitMerge, Layout, 
  AlertCircle, BarChart3, Settings, Compass, Calendar, ListTodo, LogOut, 
  Clock, Sparkles, Check, X, ShieldCheck, Lock, Mail, AlertTriangle,
  Timer, ChevronRight, Phone, ArrowRight, UserCheck, Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AnalyticsDashboard from './AnalyticsDashboard';

const API_BASE = 'http://localhost:5000/api';

export default function ManagementPortal() {
  const { user, isAuthenticated, isManager, login, logout, getAuthHeaders } = useAuth();

  // Manager Login Form State
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Lists & Operational State
  const [tables, setTables] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [operations, setOperations] = useState({
    tables: { total: 0, available: 0, occupied: 0, reserved: 0, list: [] },
    waitlist: { total: 0, entries: [] },
    currentSeated: [],
    upcomingReservations: [],
    turnover: { averageDiningDurationMinutes: null, completedCount: 0 },
    alerts: [],
    lastUpdated: null
  });

  // Navigation state
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard | floor | bookings | waitlist | tables | analytics

  // Time ticker state
  const [currentTime, setCurrentTime] = useState(new Date());

  // New Table Form
  const [number, setNumber] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [location, setLocation] = useState('Center');
  const [rating, setRating] = useState('5');

  // Table Combiner / Smart Seating State
  const [partySize, setPartySize] = useState('');
  const [combinedTables, setCombinedTables] = useState([]);
  const [combineCapacity, setCombineCapacity] = useState(0);
  const todayStr = new Date().toISOString().split('T')[0];
  const [combineDate, setCombineDate] = useState(todayStr);
  const [combineStart, setCombineStart] = useState('19:00');
  const [combineEnd, setCombineEnd] = useState('20:30');
  const [combineResult, setCombineResult] = useState(null);
  const [combineError, setCombineError] = useState('');

  // Drawer / Table Detail State
  const [activeTableDetail, setActiveTableDetail] = useState(null);

  // States & Refs
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedWaitlistEntry, setSelectedWaitlistEntry] = useState(null);
  const [submittingTable, setSubmittingTable] = useState(false);
  const [combining, setCombining] = useState(false);

  // Phase 15: Lifecycle, Audit & Promotion Dialog State
  const [selectedAuditBooking, setSelectedAuditBooking] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditHistory, setAuditHistory] = useState([]);
  const [promotionCandidate, setPromotionCandidate] = useState(null);
  const [selectedPromoteTableIds, setSelectedPromoteTableIds] = useState([]);
  const [modalCombineLoading, setModalCombineLoading] = useState(false);
  const [modalCombineMsg, setModalCombineMsg] = useState('');

  // History Tab Filters
  const [historyFilterDate, setHistoryFilterDate] = useState('');
  const [historyFilterStatus, setHistoryFilterStatus] = useState('');
  const [historyFilterSearch, setHistoryFilterSearch] = useState('');

  const isFetchingRef = useRef(false);

  // Sync clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleManagerLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const loggedUser = await login(managerEmail, managerPassword);
      if (loggedUser.role !== 'MANAGER') {
        setLoginError('Access denied. This account does not possess Manager privileges.');
      }
    } catch (err) {
      setLoginError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoggingIn(false);
    }
  };

  // Fetch all operations & portal data
  const fetchData = async (silent = false) => {
    if (!isManager) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (!silent) {
      setLoading(true);
      setIsRefreshing(true);
    }
    setErrorMsg('');

    try {
      const headers = getAuthHeaders();

      // Fetch unified Operations Summary
      const opRes = await fetch(`${API_BASE}/operations/summary`, { headers });
      if (opRes.ok) {
        const opData = await opRes.json();
        setOperations(opData);
        if (opData.tables?.list) {
          setTables(opData.tables.list);
        }
      }

      // Also fetch legacy endpoints for full compatibility with specific tabs
      const [tRes, wRes, bRes] = await Promise.all([
        fetch(`${API_BASE}/tables`, { headers }),
        fetch(`${API_BASE}/bookings/waitlist/all`, { headers }),
        fetch(`${API_BASE}/bookings`, { headers })
      ]);

      if (tRes.ok) {
        const tData = await tRes.json();
        if (Array.isArray(tData)) setTables(tData);
      }
      if (wRes.ok) {
        const wData = await wRes.json();
        if (Array.isArray(wData)) setWaitlist(wData);
      }
      if (bRes.ok) {
        const bData = await bRes.json();
        if (Array.isArray(bData)) setBookings(bData);
      }

      // Keep active table details drawer synchronized with fresh table DB state
      setActiveTableDetail(prev => {
        if (!prev) return null;
        const fresh = tables.find(t => t._id === prev._id);
        return fresh || prev;
      });
    } catch (err) {
      if (!silent) setErrorMsg('Failed to load operational data. Please verify server status.');
    } finally {
      isFetchingRef.current = false;
      if (!silent) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  // Polling interval with clean unmount cleanup
  useEffect(() => {
    if (isManager) {
      fetchData();
      const interval = setInterval(() => {
        fetchData(true);
      }, 10000); // Poll operations every 10 seconds

      return () => {
        clearInterval(interval);
      };
    }
  }, [isManager]);

  const getTableReservations = (tableId) => {
    return bookings.filter(b => 
      (b.tableId?._id === tableId || b.tableId === tableId) && 
      (b.status === 'Confirmed' || b.status === 'Seated')
    ).sort((a, b) => {
      if (a.bookingDate !== b.bookingDate) {
        return a.bookingDate.localeCompare(b.bookingDate);
      }
      return a.startTime.localeCompare(b.startTime);
    });
  };

  const getCurrentBooking = (tableId) => {
    const tableBookings = getTableReservations(tableId);
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localNow = new Date(now.getTime() - (offset * 60 * 1000));
    const currentTodayStr = localNow.toISOString().split('T')[0];
    
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;

    return tableBookings.find(b => 
      b.bookingDate === currentTodayStr && 
      currentTimeStr >= b.startTime && 
      currentTimeStr < b.endTime
    );
  };

  // Add a Table
  const handleAddTable = async (e) => {
    e.preventDefault();
    if (submittingTable) return;
    if (!number || !capacity) return;

    setSubmittingTable(true);
    try {
      const res = await fetch(`${API_BASE}/tables`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          number,
          capacity: parseInt(capacity, 10),
          location,
          rating: parseFloat(rating)
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to add table');
      }
      
      setNumber('');
      fetchData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingTable(false);
    }
  };

  // Delete a Table
  const handleDeleteTable = async (id) => {
    if (!window.confirm('Are you sure you want to delete this table?')) return;
    try {
      await fetch(`${API_BASE}/tables/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (activeTableDetail?._id === id) {
        setActiveTableDetail(null);
      }
      fetchData();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // Toggle Table Occupied Status
  const toggleOccupied = async (table) => {
    try {
      const res = await fetch(`${API_BASE}/tables/${table._id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isOccupied: !table.isOccupied })
      });
      if (res.ok) {
        fetchData();
        setCombinedTables([]);
        setCombineCapacity(0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Auto adjust End Time when Start Time changes (+90 min slot)
  const handleCombineStartChange = (newStart) => {
    setCombineStart(newStart);
    setCombineError('');
    if (newStart && newStart.includes(':')) {
      const [hh, mm] = newStart.split(':').map(Number);
      if (!isNaN(hh) && !isNaN(mm)) {
        const totalMins = hh * 60 + mm + 90;
        const endH = Math.floor(totalMins / 60) % 24;
        const endM = totalMins % 60;
        setCombineEnd(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
      }
    }
  };

  // Run Table Combination Solver (C++ Backtracking)
  const handleCombine = async (e) => {
    e.preventDefault();
    if (combining) return;
    setCombineError('');

    const pSize = parseInt(partySize, 10);
    if (!partySize || isNaN(pSize) || pSize <= 0) {
      setCombineError('Please enter a valid party size greater than 0.');
      return;
    }

    if (!combineStart || !combineEnd) {
      setCombineError('Please specify both start time and end time.');
      return;
    }

    if (combineStart >= combineEnd) {
      const [hh, mm] = combineStart.split(':').map(Number);
      const totalMins = (!isNaN(hh) ? hh : 19) * 60 + (!isNaN(mm) ? mm : 0) + 90;
      const endH = Math.floor(totalMins / 60) % 24;
      const endM = totalMins % 60;
      const suggestedEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      setCombineError(`End time (${combineEnd}) must be later than start time (${combineStart}). Did you mean ${suggestedEnd}?`);
      return;
    }

    setCombinedTables([]);
    setCombineCapacity(0);
    setCombineResult(null);
    setCombining(true);

    try {
      const res = await fetch(`${API_BASE}/dsa/combine`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          partySize: pSize,
          bookingDate: combineDate,
          startTime: combineStart,
          endTime: combineEnd
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Backtracking solver error');

      if (data.combination && data.combination.length > 0) {
        setCombinedTables(data.combination.map(t => t._id));
        setCombineCapacity(data.totalCapacity);
        const unused = data.totalCapacity - pSize;
        setCombineResult({
          partySize: pSize,
          totalCapacity: data.totalCapacity,
          unusedCapacity: unused,
          tables: data.combination,
          count: data.combination.length
        });
        setCombineError('');
      } else {
        setCombineError(`No combination of available tables can accommodate ${pSize} guests for ${combineDate} (${combineStart} - ${combineEnd}). Try adjusting time or floor layout.`);
      }
    } catch (err) {
      setCombineError(err.message || 'Error executing combination engine');
    } finally {
      setCombining(false);
    }
  };

  // Open Waitlist Seating Modal with Smart Default Table / AI Multi-table Split
  const openPromoteModal = async (entry) => {
    setPromotionCandidate(entry);
    setModalCombineMsg('');
    const pSize = entry?.partySize || 1;
    
    // Check if there's a single unoccupied table with enough capacity
    const singleFit = entry?.suggestedTable?._id || 
      tables.find(t => !t.isOccupied && t.capacity >= pSize)?._id;
    
    if (singleFit) {
      setSelectedPromoteTableIds([singleFit]);
    } else {
      // Party size exceeds individual tables (e.g. 8 guests) -> Run Smart Seating AI Combination
      try {
        setModalCombineLoading(true);
        const res = await fetch(`${API_BASE}/dsa/combine`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ 
            partySize: pSize,
            bookingDate: entry?.bookingDate || todayStr,
            startTime: entry?.startTime || '19:00',
            endTime: entry?.endTime || '20:30'
          })
        });
        const data = await res.json();
        if (res.ok && data.combination && data.combination.length > 0) {
          setSelectedPromoteTableIds(data.combination.map(t => t._id));
          setModalCombineMsg(`✨ Smart Assistant auto-selected optimal combination: ${data.combination.map(t => `Table T-${t.number} (${t.capacity}s)`).join(' + ')} (${data.totalCapacity} total seats for ${pSize} guests).`);
        } else {
          // Select available tables as default
          const avail = tables.filter(t => !t.isOccupied);
          setSelectedPromoteTableIds(avail.map(t => t._id));
        }
      } catch (err) {
        const avail = tables.filter(t => !t.isOccupied);
        setSelectedPromoteTableIds(avail.map(t => t._id));
      } finally {
        setModalCombineLoading(false);
      }
    }
  };

  // Run Smart Seating Assistant directly from within the Seating Modal
  const runModalSmartAssistant = async () => {
    if (!promotionCandidate) return;
    setModalCombineLoading(true);
    setModalCombineMsg('');
    const pSize = promotionCandidate.partySize || 1;
    try {
      const res = await fetch(`${API_BASE}/dsa/combine`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          partySize: pSize,
          bookingDate: promotionCandidate.bookingDate || todayStr,
          startTime: promotionCandidate.startTime || '19:00',
          endTime: promotionCandidate.endTime || '20:30'
        })
      });
      const data = await res.json();
      if (res.ok && data.combination && data.combination.length > 0) {
        setSelectedPromoteTableIds(data.combination.map(t => t._id));
        setModalCombineMsg(`✨ Smart Assistant selected ${data.combination.length} tables: ${data.combination.map(t => `Table T-${t.number} (${t.capacity}s)`).join(' + ')} (${data.totalCapacity} seats for ${pSize} guests).`);
      } else {
        setModalCombineMsg(`⚠️ No exact table combination found to fit ${pSize} guests. You can manually check and assign multiple available tables below.`);
      }
    } catch (err) {
      setModalCombineMsg(`⚠️ Error connecting to Smart Seating Assistant: ${err.message}`);
    } finally {
      setModalCombineLoading(false);
    }
  };

  // Toggle Table in Multi-Table Selection
  const togglePromoteTable = (tableId) => {
    setSelectedPromoteTableIds(prev => 
      prev.includes(tableId) ? prev.filter(id => id !== tableId) : [...prev, tableId]
    );
  };

  // Promote Waitlist Entry to selected Table(s)
  const promoteWaitlistEntry = async (tablesInput = null, waitlistId = null) => {
    const targetWaitlistId = waitlistId || selectedWaitlistEntry?._id || promotionCandidate?._id;
    const targetTableIds = Array.isArray(tablesInput) && tablesInput.length > 0 
      ? tablesInput 
      : typeof tablesInput === 'string' && tablesInput
        ? [tablesInput]
        : selectedPromoteTableIds;

    if (!targetWaitlistId) return;
    if (!targetTableIds || targetTableIds.length === 0) {
      alert('Please select at least one table to seat the guest.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/bookings/waitlist/promote/${targetWaitlistId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          tableIds: targetTableIds,
          tableId: targetTableIds[0]
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Promotion failed');
      }

      setSelectedWaitlistEntry(null);
      setPromotionCandidate(null);
      setSelectedPromoteTableIds([]);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Cancel/Delete Waitlist Entry
  const deleteWaitlist = async (id) => {
    if (!window.confirm('Are you sure you want to cancel and remove this customer from the waiting list?')) return;
    try {
      const res = await fetch(`${API_BASE}/bookings/waitlist/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to remove from waitlist');
      }
      if (selectedWaitlistEntry?._id === id) {
        setSelectedWaitlistEntry(null);
      }
      if (promotionCandidate?._id === id) {
        setPromotionCandidate(null);
      }
      fetchData();
    } catch (err) {
      setErrorMsg(err.message);
      alert(err.message);
    }
  };

  // Complete a Booking (Free the table & record completion)
  const completeBooking = async (bookingId) => {
    try {
      await fetch(`${API_BASE}/bookings/${bookingId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'Completed' })
      });
      fetchData();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // Seat a Confirmed or Checked-In Booking
  const seatBooking = async (bookingId) => {
    try {
      await fetch(`${API_BASE}/bookings/${bookingId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'Seated' })
      });
      fetchData();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // Dedicated Check In Guest Handler
  const checkInBooking = async (bookingId) => {
    try {
      const res = await fetch(`${API_BASE}/bookings/${bookingId}/check-in`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Check-in failed');
      }
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Dedicated Mark No-Show Handler
  const markNoShow = async (bookingId) => {
    if (!window.confirm('Mark this reservation as No-Show?')) return;
    try {
      const res = await fetch(`${API_BASE}/bookings/${bookingId}/no-show`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Failed to mark No Show');
      }
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // View Audit Trail for any Booking
  const viewAuditTrail = async (booking) => {
    setSelectedAuditBooking(booking);
    setAuditLoading(true);
    try {
      const bId = booking._id || booking.bookingId;
      const res = await fetch(`${API_BASE}/bookings/${bId}/history`, {
        headers: getAuthHeaders()
      });
      const d = await res.json();
      setAuditHistory(Array.isArray(d.history) ? d.history : []);
    } catch (err) {
      console.error('Failed to load audit history:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  // ==========================================
  // AUTHENTICATION GUARDS
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: '440px', margin: '4rem auto', padding: '0 1rem' }}>
        <div className="panel-card" style={{ padding: '2.5rem 2rem' }}>
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

  if (isAuthenticated && !isManager) {
    return (
      <div style={{ maxWidth: '500px', margin: '4rem auto', padding: '0 1rem' }}>
        <div className="panel-card" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
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
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button 
              onClick={logout} 
              className="btn-primary"
              style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}
            >
              Log Out & Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Derive Table operational lists
  const displayTables = operations.tables?.list?.length > 0 ? operations.tables.list : tables.map(t => ({
    ...t,
    operationalStatus: t.isOccupied ? 'OCCUPIED' : 'AVAILABLE'
  }));

  const totalTableCount = operations.tables?.total ?? tables.length;
  const availableTableCount = operations.tables?.available ?? tables.filter(t => !t.isOccupied).length;
  const occupiedTableCount = operations.tables?.occupied ?? tables.filter(t => t.isOccupied).length;
  const reservedTableCount = operations.tables?.reserved ?? bookings.filter(b => b.status === 'Confirmed').length;
  const waitingCount = operations.waitlist?.total ?? waitlist.length;
  const upcomingList = operations.upcomingReservations ?? [];
  const seatedList = operations.currentSeated ?? [];
  const alertsList = operations.alerts ?? [];
  const avgTurnover = operations.turnover?.averageDiningDurationMinutes;

  return (
    <div className="dashboard-container">
      
      {/* ==========================================
         SIDEBAR NAVIGATION
         ========================================== */}
      <aside className="dashboard-sidebar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="logo-container" style={{ padding: '0 0.5rem' }}>
            <Sparkles size={24} style={{ color: 'var(--accent-gold)' }} />
            <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.05em' }}>DineSmart</span>
          </div>

          <nav className="sidebar-nav">
            <button 
              className={`sidebar-btn ${currentView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentView('dashboard')}
            >
              <Layout size={18} />
              Operations Dashboard
            </button>
            <button 
              className={`sidebar-btn ${currentView === 'floor' ? 'active' : ''}`}
              onClick={() => setCurrentView('floor')}
            >
              <Compass size={18} />
              Floor Plan
            </button>
            <button 
              className={`sidebar-btn ${currentView === 'bookings' ? 'active' : ''}`}
              onClick={() => setCurrentView('bookings')}
            >
              <Calendar size={18} />
              All Bookings
            </button>
            <button 
              className={`sidebar-btn ${currentView === 'history' ? 'active' : ''}`}
              onClick={() => setCurrentView('history')}
            >
              <Clock size={18} />
              Reservation History
            </button>
            <button 
              className={`sidebar-btn ${currentView === 'waitlist' ? 'active' : ''}`}
              onClick={() => setCurrentView('waitlist')}
            >
              <Users size={18} />
              Waitlist
            </button>
            <button 
              className={`sidebar-btn ${currentView === 'tables' ? 'active' : ''}`}
              onClick={() => setCurrentView('tables')}
            >
              <ListTodo size={18} />
              Tables
            </button>
            <button 
              className={`sidebar-btn ${currentView === 'analytics' ? 'active' : ''}`}
              onClick={() => setCurrentView('analytics')}
            >
              <BarChart3 size={18} />
              Analytics
            </button>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-profile">
            <div className="profile-avatar">
              <User size={18} />
            </div>
            <div className="profile-info">
              <h5>{user?.name || 'Manager'}</h5>
              <span>Host Console</span>
            </div>
          </div>
          <div className="status-indicator">
            <span className="status-dot active"></span>
            <span>Live Operations: <strong>Active</strong></span>
          </div>
        </div>
      </aside>

      {/* ==========================================
         MAIN CONTENT AREA
         ========================================== */}
      <main className="dashboard-content">
        
        {/* Header Bar */}
        <header className="dashboard-header">
          <div>
            <h2 style={{ fontSize: '1.6rem', textTransform: 'capitalize' }}>
              {currentView === 'dashboard' ? 'Restaurant Operations Hub' : currentView === 'floor' ? 'Interactive Floor Plan' : `${currentView} Panel`}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {currentTime.toLocaleTimeString()} • {currentTime.toLocaleDateString()}
              </span>
              <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--status-free-glow)', color: 'var(--status-free)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span className="status-dot active" style={{ width: '6px', height: '6px' }}></span> Real-Time Polling
              </span>
            </div>
          </div>

          <div className="header-meta">
            <button 
              onClick={() => fetchData()} 
              disabled={isRefreshing}
              className="btn-secondary" 
              style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: 600 }}
              title="Manually sync latest operational data"
            >
              <RotateCw size={16} className={isRefreshing ? 'spin-animation' : ''} />
              <span>{isRefreshing ? 'Syncing...' : 'Refresh Operations'}</span>
            </button>
          </div>
        </header>

        {errorMsg && (
          <div className="alert-banner" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--status-occupied)', marginBottom: '1.5rem' }}>
            <AlertCircle size={20} />
            <div>
              <h4 style={{ fontWeight: 600 }}>System Notice</h4>
              <p style={{ fontSize: '0.9rem' }}>{errorMsg}</p>
            </div>
          </div>
        )}

        {/* ==========================================
           VIEW: DASHBOARD (PHASE 14 ENHANCED)
           ========================================== */}
        {currentView === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* 1. Live Operational KPI Cards */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)', color: 'var(--accent-gold)' }}>
                  <ListTodo size={20} />
                </div>
                <div className="kpi-details">
                  <h4>{totalTableCount}</h4>
                  <span>Total Tables</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-free)' }}>
                  <Check size={20} />
                </div>
                <div className="kpi-details">
                  <h4>{availableTableCount}</h4>
                  <span>Available</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-occupied)' }}>
                  <Users size={20} />
                </div>
                <div className="kpi-details">
                  <h4>{occupiedTableCount}</h4>
                  <span>Occupied</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa' }}>
                  <Calendar size={20} />
                </div>
                <div className="kpi-details">
                  <h4>{reservedTableCount}</h4>
                  <span>Reserved</span>
                </div>
              </div>

              <div 
                className="kpi-card" 
                onClick={() => setCurrentView('waitlist')}
                style={{ cursor: 'pointer' }}
                title="Click to view and manage waiting list"
              >
                <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--status-waitlist)' }}>
                  <Clock size={20} />
                </div>
                <div className="kpi-details">
                  <h4>{waitingCount}</h4>
                  <span>Waiting (Click)</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa' }}>
                  <Timer size={20} />
                </div>
                <div className="kpi-details">
                  <h4 style={{ fontSize: avgTurnover ? '1.5rem' : '1.1rem' }}>
                    {avgTurnover ? `${avgTurnover} min` : 'No data'}
                  </h4>
                  <span>Avg Dining Time</span>
                </div>
              </div>
            </div>

            {/* 2. Top Split Grid: Live Floor Plan (Left) + Operational Alerts (Right) */}
            <div className="grid-layout" style={{ gridTemplateColumns: '1.25fr 0.75fr', gap: '1.5rem' }}>
              
              {/* Left: Live Floor Plan */}
              <div className="panel-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h3 className="panel-title" style={{ margin: 0 }}>Live Floor Plan</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Click any table card to inspect details and perform host actions.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem' }}>
                    <span className="status-badge available">● Available</span>
                    <span className="status-badge occupied">● Occupied</span>
                    <span className="status-badge reserved">● Reserved</span>
                  </div>
                </div>

                <div className="floor-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                  {displayTables.map(table => {
                    const isCombined = combinedTables.includes(table._id);
                    const status = table.operationalStatus || (table.isOccupied ? 'OCCUPIED' : 'AVAILABLE');
                    const hasTurnoverWarning = status === 'OCCUPIED' && table.nextReservation && table.nextReservation.startsInMinutes <= 45;

                    return (
                      <div 
                        key={table._id}
                        className={`table-node ${status === 'OCCUPIED' ? 'occupied' : status === 'RESERVED' ? 'reserved' : 'free'} ${isCombined ? 'combined' : ''}`}
                        onClick={() => setActiveTableDetail(table)}
                        style={{
                          height: 'auto',
                          minHeight: '140px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          padding: '1rem',
                          position: 'relative',
                          border: isCombined ? '2px solid var(--accent-gold)' : undefined
                        }}
                      >
                        <div>
                          <div className="table-header" style={{ marginBottom: '0.4rem' }}>
                            <span className="table-number" style={{ fontSize: '1.15rem' }}>Table T-{table.number}</span>
                            <span className={`status-badge ${status.toLowerCase()}`}>
                              ● {status}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem', marginBottom: '0.6rem' }}>
                            <span><Users size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {table.capacity} Seats</span>
                            <span>{table.location}</span>
                          </div>

                          {/* Seated Guest Info if Occupied */}
                          {status === 'OCCUPIED' && table.currentGuest && (
                            <div style={{ fontSize: '0.78rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '0.35rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '0.4rem' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{table.currentGuest.customerName}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                Party: {table.currentGuest.partySize} • Since {table.currentGuest.startTime}
                              </div>
                            </div>
                          )}

                          {/* Next Reservation if Reserved / Upcoming */}
                          {table.nextReservation && (
                            <div style={{ fontSize: '0.78rem', backgroundColor: 'rgba(59, 130, 246, 0.08)', padding: '0.35rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                              <div style={{ fontWeight: 600, color: '#93c5fd' }}>Next: {table.nextReservation.customerName}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                Party: {table.nextReservation.partySize} • {table.nextReservation.startTime} (in {table.nextReservation.startsInMinutes}m)
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Turnover Warning Badge */}
                        {hasTurnoverWarning && (
                          <div className="warning-chip" style={{ marginTop: '0.5rem' }}>
                            <AlertTriangle size={11} /> Next reservation in {table.nextReservation.startsInMinutes}m
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {displayTables.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                      No tables currently configured in the floor plan.
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Operational Alerts */}
              <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={20} style={{ color: 'var(--accent-gold)' }} />
                  <h3 className="panel-title" style={{ margin: 0 }}>Operational Alerts</h3>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Live alerts derived directly from current reservations and floor state.
                </span>

                <div className="operational-alerts-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto' }}>
                  {alertsList.map((alert, idx) => {
                    const isWaitlistAlert = alert.type === 'WAITLIST' || alert.message?.toLowerCase().includes('waitlist') || alert.message?.toLowerCase().includes('waiting');
                    return (
                      <div key={idx} className={`operational-alert-card ${alert.severity || 'info'}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                          {alert.severity === 'warning' ? (
                            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#fbbf24' }} />
                          ) : alert.severity === 'success' ? (
                            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--status-free)' }} />
                          ) : (
                            <Info size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#60a5fa' }} />
                          )}
                          <div style={{ flex: 1, fontWeight: 500 }}>{alert.message}</div>
                        </div>
                        {isWaitlistAlert && (
                          <div style={{ display: 'flex', gap: '0.5rem', paddingLeft: '1.6rem', marginTop: '0.2rem' }}>
                            <button 
                              onClick={() => {
                                const entry = (operations.waitlist?.entries?.[0] || waitlist[0]);
                                if (entry) {
                                  openPromoteModal(entry);
                                } else {
                                  setCurrentView('waitlist');
                                }
                              }}
                              className="btn-primary" 
                              style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', backgroundColor: 'var(--status-free)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <CheckCircle2 size={13} />
                              Seat Waiting Guest
                            </button>
                            <button 
                              onClick={() => setCurrentView('waitlist')}
                              className="btn-secondary" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              Open Waitlist →
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {alertsList.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <CheckCircle2 size={28} style={{ color: 'var(--status-free)', margin: '0 auto 0.5rem auto' }} />
                      All operations normal. No critical alerts requiring host attention.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Full Width Section: Upcoming Reservations Timeline */}
            <div className="panel-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={20} style={{ color: 'var(--accent-gold)' }} />
                  <h3 className="panel-title" style={{ margin: 0 }}>Upcoming Reservations Timeline</h3>
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Chronologically ordered by arrival time
                </span>
              </div>

              <div className="timeline-list">
                {upcomingList.map(res => (
                  <div key={res._id} className="timeline-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: '90px' }}>
                        <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
                          {res.startTime}
                        </span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{res.bookingDate}</div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{res.customerName}</h4>
                          <span style={{ 
                            fontSize: '0.7rem', 
                            padding: '0.1rem 0.45rem', 
                            borderRadius: 'var(--radius-sm)', 
                            fontWeight: 700,
                            backgroundColor: res.status === 'Checked In' ? 'rgba(59,130,246,0.15)' : 'var(--status-free-glow)',
                            color: res.status === 'Checked In' ? '#3b82f6' : 'var(--status-free)'
                          }}>
                            {res.status || 'Confirmed'}
                          </span>
                          {res.isEligibleForNoShow && (
                            <span style={{ 
                              fontSize: '0.7rem', 
                              padding: '0.1rem 0.45rem', 
                              borderRadius: 'var(--radius-sm)', 
                              fontWeight: 700,
                              backgroundColor: 'rgba(245,158,11,0.15)',
                              color: '#fbbf24',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}>
                              <AlertTriangle size={11} /> Eligible for No Show
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '1.25rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                          <span>Party of <strong>{res.partySize}</strong></span>
                          <span>Table: <strong style={{ color: 'var(--text-primary)' }}>{res.table?.number ? `T-${res.table.number}` : 'Unassigned'}</strong></span>
                          <span><Phone size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {res.contact}</span>
                          {res.checkedInAt && (
                            <span style={{ color: '#3b82f6' }}>Checked In: {new Date(res.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {res.status === 'Confirmed' && (
                        <button 
                          onClick={() => checkInBooking(res._id)} 
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', color: '#3b82f6', borderColor: 'rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <UserCheck size={14} /> Check In
                        </button>
                      )}

                      <button 
                        onClick={() => seatBooking(res._id)} 
                        className="btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: 'var(--status-free)', borderColor: 'rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <UserCheck size={14} /> Seat Guest
                      </button>

                      {res.isEligibleForNoShow && (
                        <button 
                          onClick={() => markNoShow(res._id)} 
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', color: 'var(--status-occupied)', borderColor: 'rgba(239,68,68,0.3)' }}
                        >
                          Mark No Show
                        </button>
                      )}

                      <button 
                        onClick={() => viewAuditTrail(res)} 
                        className="btn-secondary"
                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}
                        title="View Reservation History"
                      >
                        <Clock size={13} />
                      </button>
                    </div>
                  </div>
                ))}

                {upcomingList.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No upcoming reservations scheduled for today.
                  </div>
                )}
              </div>
            </div>

            {/* 4. Full Width Section: Currently Seated Guests */}
            <div className="panel-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={20} style={{ color: 'var(--status-occupied)' }} />
                  <h3 className="panel-title" style={{ margin: 0 }}>Currently Seated Guests</h3>
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Real-time active dining table monitoring
                </span>
              </div>

              <div className="seated-grid">
                {seatedList.map(seated => {
                  const isLongDining = seated.isLongDining || (seated.durationMinutes && seated.durationMinutes > 90);

                  return (
                    <div key={seated._id} className="seated-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase' }}>
                            Table T-{seated.table?.number || '??'} ({seated.table?.location || 'Dining'})
                          </span>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '0.2rem' }}>
                            {seated.customerName}
                          </h4>
                        </div>
                        <span className="duration-pill" style={{ backgroundColor: isLongDining ? 'rgba(239,68,68,0.2)' : undefined, color: isLongDining ? 'var(--status-occupied)' : undefined }}>
                          <Timer size={12} /> {seated.durationMinutes} min
                        </span>
                      </div>

                      {isLongDining && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--status-occupied)', backgroundColor: 'rgba(239,68,68,0.08)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <AlertTriangle size={11} /> Table occupied for &gt;90 minutes
                        </div>
                      )}

                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div>Party: <strong>{seated.partySize} guests</strong></div>
                        <div>Seated since: <strong>{seated.startTime}</strong></div>
                        <div>Contact: {seated.contact}</div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <button 
                          onClick={() => completeBooking(seated._id)} 
                          className="btn-primary"
                          style={{ flex: 1, padding: '0.45rem', fontSize: '0.82rem', backgroundColor: 'var(--status-free)' }}
                        >
                          <CheckCircle2 size={14} style={{ marginRight: '4px' }} /> Free Table / Complete
                        </button>
                        <button 
                          onClick={() => viewAuditTrail(seated)} 
                          className="btn-secondary"
                          style={{ padding: '0.45rem', fontSize: '0.82rem' }}
                          title="View Reservation History"
                        >
                          <Clock size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {seatedList.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No guests currently seated.
                  </div>
                )}
              </div>
            </div>

            {/* 5. Split Section: Waitlist Intelligence (Left) + Smart Seating Assistant (Right) */}
            <div className="grid-layout" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              
              {/* Waitlist Intelligence */}
              <div className="panel-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={18} style={{ color: 'var(--status-waitlist)' }} />
                    <h3 className="panel-title" style={{ margin: 0 }}>Waiting List</h3>
                  </div>
                  <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--status-waitlist-glow)', color: 'var(--status-waitlist)', fontWeight: 600 }}>
                    {operations.waitlist?.total ?? waitlist.length} Waiting
                  </span>
                </div>

                <div className="timeline-list">
                  {(operations.waitlist?.entries?.length > 0 ? operations.waitlist.entries : waitlist).map((entry, idx) => (
                    <div key={entry._id} className="timeline-card" style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ color: 'var(--accent-gold)', fontWeight: 700, fontSize: '0.95rem' }}>
                            #{entry.position || idx + 1}
                          </span>
                          <span style={{ fontWeight: 600 }}>{entry.customerName}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            • Party of {entry.partySize}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          Waiting: <strong>{entry.waitingDurationMinutes ?? 0} min</strong> • Contact: {entry.contact}
                        </div>
                        {entry.suggestedTable && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--status-free)', marginTop: '0.2rem' }}>
                            Suggested: <strong>Table T-{entry.suggestedTable.number}</strong> ({entry.suggestedTable.capacity} seats)
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button 
                          onClick={() => openPromoteModal(entry)} 
                          className="btn-primary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', backgroundColor: 'var(--status-free)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                          title="Confirm and seat guest at an available table"
                        >
                          <CheckCircle2 size={14} />
                          Confirm & Seat
                        </button>
                        <button 
                          onClick={() => deleteWaitlist(entry._id)} 
                          className="btn-secondary" 
                          style={{ padding: '0.35rem 0.6rem', color: 'var(--status-occupied)', borderColor: 'rgba(239, 68, 68, 0.3)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                          title="Cancel and remove from waitlist"
                        >
                          <Trash2 size={13} />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}

                  {(operations.waitlist?.entries?.length === 0 || (!operations.waitlist?.entries && waitlist.length === 0)) && (
                    <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Waitlist is currently empty.
                    </div>
                  )}
                </div>
              </div>

              {/* Smart Seating Assistant */}
              <div className="panel-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <GitMerge size={18} style={{ color: 'var(--accent-gold)' }} />
                  <h3 className="panel-title" style={{ margin: 0 }}>Smart Seating Assistant</h3>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '1rem' }}>
                  Smart seating assistant for optimal large-party table combinations with minimal capacity waste.
                </span>

                <form onSubmit={handleCombine} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Party Size</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        placeholder="e.g. 6" 
                        value={partySize} 
                        onChange={(e) => {
                          setPartySize(e.target.value);
                          setCombineError('');
                        }}
                        min="1"
                        required
                        style={{ padding: '0.45rem 0.65rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Date</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={combineDate} 
                        onChange={(e) => {
                          setCombineDate(e.target.value);
                          setCombineError('');
                        }}
                        required
                        style={{ padding: '0.45rem 0.65rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Start Time</label>
                      <input 
                        type="time" 
                        className="form-input" 
                        value={combineStart} 
                        onChange={(e) => handleCombineStartChange(e.target.value)}
                        required
                        style={{ padding: '0.45rem 0.65rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>End Time</label>
                      <input 
                        type="time" 
                        className="form-input" 
                        value={combineEnd} 
                        onChange={(e) => {
                          setCombineEnd(e.target.value);
                          setCombineError('');
                        }}
                        required
                        style={{ padding: '0.45rem 0.65rem' }}
                      />
                    </div>
                  </div>

                  {combineError && (
                    <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', color: '#fca5a5', fontSize: '0.8rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.25rem', lineHeight: '1.4' }}>
                      <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px', color: '#f87171' }} />
                      <span>{combineError}</span>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn-primary" 
                    disabled={combining}
                    style={{ padding: '0.55rem', fontSize: '0.85rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Sparkles size={14} className={combining ? 'spin-animation' : ''} />
                    {combining ? 'Finding Best Combination...' : 'Find Smart Seating Combination'}
                  </button>
                </form>

                {combineResult && (
                  <div style={{ border: '1px solid var(--accent-gold)', backgroundColor: 'rgba(217, 119, 6, 0.08)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span className="match-badge-best">★ Best Match</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 600 }}>
                        {combineResult.count} Tables Combined
                      </span>
                    </div>

                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                      {combineResult.tables.map(t => `Table T-${t.number} (${t.capacity}s)`).join(' + ')}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      Total Combined Capacity: <strong style={{ color: 'var(--accent-gold)' }}>{combineResult.totalCapacity} seats</strong> (Party of {combineResult.partySize})
                      <br />
                      Unused Capacity: <strong>{combineResult.unusedCapacity} seats</strong> (Optimal Backtracking Solution)
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button 
                        onClick={() => {
                          setCurrentView('floor');
                        }}
                        className="btn-primary"
                        style={{ flex: 1, fontSize: '0.78rem', padding: '0.4rem', backgroundColor: 'var(--accent-gold)' }}
                      >
                        Highlight on Floor Plan →
                      </button>
                      <button 
                        onClick={() => {
                          setCombinedTables([]);
                          setCombineResult(null);
                          setCombineError('');
                        }}
                        className="btn-secondary"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem' }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ==========================================
           VIEW: FLOOR PLAN (ORIGINAL + ENHANCED)
           ========================================== */}
        {currentView === 'floor' && (
          <div className="grid-layout" style={{ gridTemplateColumns: '1.2fr 0.8fr' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Table Floor Grid */}
              <div className="panel-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 className="panel-title" style={{ margin: 0 }}>Floor Plan</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem' }}>
                    <span className="status-badge available">● Free</span>
                    <span className="status-badge occupied">● Occupied</span>
                    <span className="status-badge reserved">● Reserved</span>
                  </div>
                </div>

                {combinedTables.length > 0 && combineResult && (
                  <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(217, 119, 6, 0.12)', border: '1px solid var(--accent-gold)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Sparkles size={16} style={{ color: 'var(--accent-gold)' }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        Combination Highlighted: <strong>{combineResult.tables.map(t => `T-${t.number}`).join(' + ')}</strong> (Capacity: {combineResult.totalCapacity} for {combineResult.partySize} guests)
                      </span>
                    </div>
                    <button 
                      onClick={() => {
                        setCombinedTables([]);
                        setCombineResult(null);
                      }}
                      className="btn-secondary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      Clear Highlight
                    </button>
                  </div>
                )}

                {selectedWaitlistEntry && (
                  <div style={{ border: '1px solid var(--border-gold)', backgroundColor: 'rgba(217,119,6,0.05)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem' }}>
                      Select an unoccupied table to seat <strong>{selectedWaitlistEntry.customerName}</strong> (Party size: {selectedWaitlistEntry.partySize})
                    </span>
                    <button onClick={() => setSelectedWaitlistEntry(null)} className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                      Cancel
                    </button>
                  </div>
                )}

                <div className="floor-grid">
                  {displayTables.map(table => {
                    const isCombined = combinedTables.includes(table._id);
                    const status = table.operationalStatus || (table.isOccupied ? 'OCCUPIED' : 'AVAILABLE');

                    return (
                      <div 
                        key={table._id}
                        className={`table-node ${status === 'OCCUPIED' ? 'occupied' : status === 'RESERVED' ? 'reserved' : 'free'} ${isCombined ? 'combined' : ''}`}
                        onClick={async () => {
                          if (selectedWaitlistEntry) {
                            if (table.isOccupied) {
                              const activeBooking = bookings.find(b => 
                                (b.tableId?._id === table._id || b.tableId === table._id) && 
                                (b.status === 'Confirmed' || b.status === 'Seated')
                              );
                              const customerLabel = activeBooking ? `occupied by ${activeBooking.customerName}` : 'occupied';
                              if (window.confirm(`Table T-${table.number} is currently ${customerLabel}. Would you like to complete their booking and seat ${selectedWaitlistEntry.customerName} here?`)) {
                                if (activeBooking) {
                                  await fetch(`${API_BASE}/bookings/${activeBooking._id}`, {
                                    method: 'PUT',
                                    headers: getAuthHeaders(),
                                    body: JSON.stringify({ status: 'Completed' })
                                  });
                                }
                                promoteWaitlistEntry(table._id);
                              }
                            } else if (table.capacity < selectedWaitlistEntry.partySize) {
                              if (window.confirm(`Warning: This table capacity (${table.capacity}) is smaller than waitlisted party size (${selectedWaitlistEntry.partySize}). Do you still want to seat them here?`)) {
                                promoteWaitlistEntry(table._id);
                              }
                            } else {
                              promoteWaitlistEntry(table._id);
                            }
                          } else {
                            setActiveTableDetail(table);
                          }
                        }}
                      >
                        <div className="table-header">
                          <span className="table-number">T-{table.number}</span>
                          <span className="table-status-dot"></span>
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                          <span className="table-capacity">
                            <Users size={12} /> Cap: {table.capacity}
                          </span>
                          <span className="table-location">{table.location}</span>
                        </div>
                        <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', fontWeight: 600 }}>
                          <span className={`status-badge ${status.toLowerCase()}`}>
                            {status}
                          </span>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTable(table._id);
                          }}
                          style={{ position: 'absolute', right: '8px', bottom: '8px', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                          title="Delete Table"
                        >
                          <Trash2 size={12} className="hover-red" />
                        </button>
                      </div>
                    );
                  })}
                  {displayTables.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                      No tables added. Add tables from the Tables tab.
                    </div>
                  )}
                </div>
              </div>

              {/* Table Combiner Solver */}
              <div className="panel-card">
                <h3 className="panel-title">
                  <GitMerge size={20} className="logo-icon" />
                  Smart Seating Assistant
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '1.25rem' }}>
                  Finds the minimum combination of free tables required to seat a large party, minimizing wasted space.
                </span>

                <form onSubmit={handleCombine} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.9fr 0.9fr', gap: '1rem', marginBottom: '1.25rem', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Large Party Size</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        placeholder="e.g. 8" 
                        value={partySize} 
                        onChange={(e) => setPartySize(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Date</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={combineDate} 
                        onChange={(e) => setCombineDate(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Start Time</label>
                      <input 
                        type="time" 
                        className="form-input" 
                        value={combineStart} 
                        onChange={(e) => setCombineStart(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">End Time</label>
                      <input 
                        type="time" 
                        className="form-input" 
                        value={combineEnd} 
                        onChange={(e) => setCombineEnd(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    {combinedTables.length > 0 && (
                      <button 
                        type="button" 
                        className="btn-secondary" 
                        onClick={() => {
                          setCombinedTables([]);
                          setCombineCapacity(0);
                          setPartySize('');
                          setCombineResult(null);
                        }}
                        style={{ width: 'auto' }}
                      >
                        Clear Highlights
                      </button>
                    )}
                    <button type="submit" className="btn-primary" style={{ width: 'auto' }} disabled={combining}>
                       {combining ? 'Finding table combinations...' : 'Run Solver'}
                    </button>
                  </div>
                </form>

                {combinedTables.length > 0 && (
                  <div style={{ border: '1px solid rgba(245, 158, 11, 0.4)', backgroundColor: 'rgba(245,158,11,0.05)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ color: 'var(--status-waitlist)', fontWeight: 600 }}>Optimal Combination Found</h4>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Combine the highlighted tables. Total capacity: <strong>{combineCapacity} seats</strong>.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Table Details / Seating Drawer Panel */}
              {activeTableDetail ? (() => {
                const currentBooking = getCurrentBooking(activeTableDetail._id);
                const allRes = getTableReservations(activeTableDetail._id);
                const upcomingRes = allRes.filter(b => b._id !== currentBooking?._id);
                const tableStatus = activeTableDetail.operationalStatus || (activeTableDetail.isOccupied ? 'OCCUPIED' : 'AVAILABLE');

                return (
                  <div className="panel-card" style={{ border: '1px solid var(--border-gold)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h3 className="panel-title" style={{ margin: 0 }}>
                        Table T-{activeTableDetail.number} Details
                      </h3>
                      <button onClick={() => setActiveTableDetail(null)} className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>
                        Close
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                      <div>Capacity: <strong>{activeTableDetail.capacity} seats</strong></div>
                      <div>Seating Zone: <strong>{activeTableDetail.location}</strong></div>
                      <div>Table Rating: <strong>★ {activeTableDetail.rating}</strong></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Operational State: <span className={`status-badge ${tableStatus.toLowerCase()}`}>
                          ● {tableStatus}
                        </span>
                      </div>
                    </div>

                    {/* Current Seating status */}
                    <div style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                        CURRENT STATUS
                      </span>
                      {currentBooking ? (
                        <div>
                          <h4 style={{ color: 'var(--accent-gold)', margin: 0, fontSize: '0.95rem' }}>SEATED RESERVATION</h4>
                          <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', lineHeight: '1.4' }}>
                            Guest: <strong>{currentBooking.customerName}</strong> ({currentBooking.partySize} guests)
                            <br />
                            Contact: {currentBooking.contact}
                            <br />
                            Time: <strong>{currentBooking.startTime} – {currentBooking.endTime}</strong>
                          </div>
                          <button 
                            onClick={() => completeBooking(currentBooking._id)} 
                            className="btn-primary" 
                            style={{ marginTop: '0.75rem', width: '100%', backgroundColor: 'var(--status-free)' }}
                          >
                            Complete Seating
                          </button>
                        </div>
                      ) : (
                        <div>
                          <h4 style={{ color: 'var(--status-free)', margin: 0, fontSize: '0.95rem' }}>AVAILABLE NOW</h4>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0.75rem 0' }}>
                            No active booking covers the current time slot.
                          </p>
                          <button 
                            onClick={() => toggleOccupied(activeTableDetail)} 
                            className="btn-secondary" 
                            style={{ width: '100%' }}
                          >
                            {activeTableDetail.isOccupied ? 'Mark Physically Vacant' : 'Mark Physically Occupied (Walk-in)'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Upcoming Reservations */}
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                        UPCOMING RESERVATIONS
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {upcomingRes.map(res => (
                          <div key={res._id} style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                              <span>{res.customerName}</span>
                              <span style={{ color: 'var(--accent-gold)' }}>{res.startTime}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                              <span>Guests: {res.partySize}</span>
                              <span>Date: {res.bookingDate}</span>
                            </div>
                          </div>
                        ))}
                        {upcomingRes.length === 0 && (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            No upcoming reservations today.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Promote waitlist action */}
                    {selectedWaitlistEntry && (
                      <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(217,119,6,0.05)', border: '1px solid var(--border-gold)', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.75rem' }}>
                          Seat waitlisted guest <strong>{selectedWaitlistEntry.customerName}</strong> (Party size: {selectedWaitlistEntry.partySize}) at this table?
                        </span>
                        <button 
                          onClick={() => promoteWaitlistEntry(activeTableDetail._id)} 
                          className="btn-primary" 
                          style={{ width: '100%', backgroundColor: 'var(--accent-gold)' }}
                        >
                          Seat Guest
                        </button>
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="panel-card">
                  <h3 className="panel-title">Seating Selections</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Click any table on the interactive floor plan to view details, toggle physical walk-in status, or review upcoming bookings.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
           VIEW: BOOKINGS (ALL BOOKINGS AUDIT)
           ========================================== */}
        {currentView === 'bookings' && (
          <div className="panel-card" style={{ maxWidth: '900px' }}>
            <h3 className="panel-title">All Reservations Registry</h3>
            <div className="bookings-list" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {bookings.map(booking => (
                <div key={booking._id} className="booking-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <div className="booking-details" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{booking.customerName}</h4>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                      <span>Table: <strong>{booking.tableId ? `T-${booking.tableId.number}` : 'Unassigned'}</strong></span>
                      <span>Guests: <strong>{booking.partySize}</strong></span>
                      <span>Date: <strong>{booking.bookingDate}</strong></span>
                      <span>Time: <strong>{booking.startTime} – {booking.endTime}</strong></span>
                      <span>Status: <strong style={{ 
                        color: booking.status === 'Seated' ? 'var(--accent-gold)' : 
                               booking.status === 'Checked In' ? '#3b82f6' :
                               booking.status === 'Confirmed' ? 'var(--status-free)' : 
                               booking.status === 'Completed' ? '#10b981' : 'var(--status-occupied)' 
                      }}>{booking.status}</strong></span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {booking.status === 'Confirmed' && (
                      <button 
                        onClick={() => checkInBooking(booking._id)} 
                        className="btn-secondary" 
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: '#3b82f6', borderColor: 'rgba(59,130,246,0.3)' }}
                      >
                        Check In
                      </button>
                    )}
                    {(booking.status === 'Confirmed' || booking.status === 'Checked In') && (
                      <button 
                        onClick={() => seatBooking(booking._id)} 
                        className="btn-secondary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: 'var(--accent-gold)', borderColor: 'var(--accent-gold)' }}
                      >
                        Seat Guest
                      </button>
                    )}
                    {booking.status === 'Seated' && (
                      <button 
                        onClick={() => completeBooking(booking._id)} 
                        className="btn-secondary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: 'var(--status-free)', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                      >
                        <CheckCircle2 size={14} style={{ marginRight: '4px' }} />
                        Complete
                      </button>
                    )}
                    <button 
                      onClick={() => viewAuditTrail(booking)} 
                      className="btn-secondary" 
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                      title="View Reservation History"
                    >
                      <Clock size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {bookings.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                  No reservations found in database.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
           VIEW: BOOKING HISTORY & AUDIT TRAIL
           ========================================== */}
        {currentView === 'history' && (() => {
          const filteredHistory = bookings.filter(b => {
            if (historyFilterDate && b.bookingDate !== historyFilterDate) return false;
            if (historyFilterStatus && b.status !== historyFilterStatus) return false;
            if (historyFilterSearch) {
              const query = historyFilterSearch.toLowerCase();
              const nameMatch = b.customerName?.toLowerCase().includes(query);
              const contactMatch = b.contact?.includes(query);
              const tableMatch = b.tableId?.number?.toString().toLowerCase().includes(query);
              if (!nameMatch && !contactMatch && !tableMatch) return false;
            }
            return true;
          });

          return (
            <div className="panel-card" style={{ maxWidth: '1050px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <Clock size={22} className="logo-icon" />
                    Reservation History
                  </h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Complete activity and reservation history of all confirmed, completed, cancelled, and no-show bookings.
                  </span>
                </div>
              </div>

              {/* Filters Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Search Guest / Table</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Search by customer name, phone, or table..." 
                    value={historyFilterSearch} 
                    onChange={(e) => setHistoryFilterSearch(e.target.value)}
                    style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Filter by Status</label>
                  <select 
                    className="form-select" 
                    value={historyFilterStatus} 
                    onChange={(e) => setHistoryFilterStatus(e.target.value)}
                    style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                  >
                    <option value="">All Statuses</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Checked In">Checked In</option>
                    <option value="Seated">Seated</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="No Show">No Show</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Filter by Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={historyFilterDate} 
                    onChange={(e) => setHistoryFilterDate(e.target.value)}
                    style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                  />
                </div>

                <button 
                  onClick={() => { setHistoryFilterSearch(''); setHistoryFilterStatus(''); setHistoryFilterDate(''); }}
                  className="btn-secondary"
                  style={{ alignSelf: 'flex-end', padding: '0.45rem 0.75rem', fontSize: '0.8rem', height: '36px' }}
                >
                  Reset
                </button>
              </div>

              {/* History Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Customer</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Table</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Date & Time</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Party</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Reservation Timeline</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>History</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map(b => {
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
                        <tr key={b._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <div style={{ fontWeight: 600 }}>{b.customerName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.contact}</div>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            {b.tableId?.number ? `Table T-${b.tableId.number}` : 'Unassigned'}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <div>{b.bookingDate}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.startTime} - {b.endTime}</div>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{b.partySize} guests</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <span style={{ 
                              fontSize: '0.75rem', 
                              padding: '0.15rem 0.5rem', 
                              borderRadius: 'var(--radius-sm)', 
                              fontWeight: 700,
                              backgroundColor: badgeBg,
                              color: badgeColor
                            }}>
                              {b.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {b.checkedInAt && <div>Checked in: {new Date(b.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                            {b.seatedAt && <div>Seated: {new Date(b.seatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                            {b.completedAt && <div>Completed: {new Date(b.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                            {b.noShowAt && <div style={{ color: 'var(--status-occupied)' }}>No Show: {new Date(b.noShowAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                            {b.cancelledAt && <div style={{ color: 'var(--status-occupied)' }}>Cancelled: {new Date(b.cancelledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                            <button 
                              onClick={() => viewAuditTrail(b)} 
                              className="btn-secondary" 
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <Clock size={13} />
                              History
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredHistory.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                    No bookings found matching filter criteria.
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ==========================================
           VIEW: WAITLIST
           ========================================== */}
        {currentView === 'waitlist' && (
          <div className="panel-card" style={{ maxWidth: '920px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 className="panel-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={20} style={{ color: 'var(--status-waitlist)' }} />
                  Live Waiting List Management
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  Confirm seating for waiting guests at available tables, or cancel entries.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--status-waitlist-glow)', color: 'var(--status-waitlist)', fontWeight: 600 }}>
                  {operations.waitlist?.total ?? waitlist.length} in Queue
                </span>
                <button 
                  onClick={fetchData}
                  className="btn-secondary"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <RotateCw size={13} className={isRefreshing ? 'spin-animation' : ''} />
                  Refresh
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(operations.waitlist?.entries?.length > 0 ? operations.waitlist.entries : waitlist).map((entry, idx) => {
                const availableForParty = tables.filter(t => !t.isOccupied && t.capacity >= entry.partySize);
                return (
                  <div 
                    key={entry._id} 
                    className="panel-card"
                    style={{ 
                      backgroundColor: 'var(--bg-tertiary)', 
                      border: '1px solid var(--border-color)',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ 
                          width: '38px', 
                          height: '38px', 
                          borderRadius: 'var(--radius-full)', 
                          backgroundColor: 'var(--accent-gold-glow)', 
                          color: 'var(--accent-gold)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          fontWeight: 700,
                          fontSize: '1.05rem',
                          flexShrink: 0
                        }}>
                          #{entry.position || idx + 1}
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{entry.customerName}</h4>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                            <span>Party of <strong style={{ color: 'var(--text-primary)' }}>{entry.partySize} guests</strong></span>
                            <span>Phone: <strong style={{ color: 'var(--text-primary)' }}>{entry.contact}</strong></span>
                            <span>Waiting: <strong style={{ color: 'var(--status-waitlist)' }}>{entry.waitingDurationMinutes ?? 0} min</strong></span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <button 
                          onClick={() => openPromoteModal(entry)} 
                          className="btn-primary"
                          style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', backgroundColor: 'var(--status-free)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                        >
                          <CheckCircle2 size={16} />
                          Confirm & Seat Guest
                        </button>
                        <button 
                          onClick={() => deleteWaitlist(entry._id)} 
                          className="btn-secondary" 
                          style={{ padding: '0.45rem 0.85rem', color: 'var(--status-occupied)', borderColor: 'rgba(239, 68, 68, 0.3)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                          title="Cancel and remove from waitlist"
                        >
                          <Trash2 size={15} />
                          Cancel
                        </button>
                      </div>
                    </div>

                    {/* Quick table availability hint */}
                    <div style={{ fontSize: '0.78rem', padding: '0.5rem 0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span>
                        {availableForParty.length > 0 ? (
                          <span style={{ color: 'var(--status-free)' }}>
                            ● {availableForParty.length} table(s) available for {entry.partySize} guests ({availableForParty.map(t => `T-${t.number}`).join(', ')})
                          </span>
                        ) : (
                          <span style={{ color: 'var(--status-waitlist)' }}>
                            ● No immediate empty tables with capacity ≥ {entry.partySize}. You can seat at any available table or wait for active diners to complete.
                          </span>
                        )}
                      </span>
                      <button 
                        onClick={() => {
                          setSelectedWaitlistEntry(entry);
                          setCurrentView('floor');
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'underline' }}
                      >
                        View Interactive Floor Plan →
                      </button>
                    </div>
                  </div>
                );
              })}

              {(operations.waitlist?.entries?.length === 0 || (!operations.waitlist?.entries && waitlist.length === 0)) && (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                  <Clock size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 0.75rem auto' }} />
                  <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>Waiting list is currently empty.</p>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>All guests have been seated or no walk-ins are queued.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
           VIEW: TABLES (TABLE INVENTORY & FORM)
           ========================================== */}
        {currentView === 'tables' && (
          <div className="grid-layout" style={{ gridTemplateColumns: '1.2fr 0.8fr' }}>
            <div className="panel-card">
              <h3 className="panel-title">Table Layout Inventory</h3>
              <div className="floor-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1.25rem', marginTop: '1.5rem' }}>
                {tables.map(table => (
                  <div key={table._id} className="table-node" style={{ pointerEvents: 'none', height: '110px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span className="table-number" style={{ fontSize: '1.1rem' }}>T-{table.number}</span>
                      <span style={{ fontSize: '0.8rem', color: table.isOccupied ? 'var(--status-occupied)' : 'var(--status-free)' }}>
                        ●
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span>Seats: {table.capacity}</span>
                      <br />
                      <span>{table.location}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel-card">
              <h3 className="panel-title">
                <Plus size={20} className="logo-icon" />
                Add Table
              </h3>

              <form onSubmit={handleAddTable}>
                <div className="form-group">
                  <label className="form-label">Table ID / Number</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. 1A" 
                    value={number} 
                    onChange={(e) => setNumber(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Seats</label>
                    <select className="form-select" value={capacity} onChange={(e) => setCapacity(e.target.value)}>
                      <option value="2">2</option>
                      <option value="4">4</option>
                      <option value="6">6</option>
                      <option value="8">8</option>
                      <option value="10">10</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <select className="form-select" value={location} onChange={(e) => setLocation(e.target.value)}>
                      <option value="Center">Center</option>
                      <option value="Window">Window</option>
                      <option value="Outdoor">Outdoor</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Table Rating</label>
                  <select className="form-select" value={rating} onChange={(e) => setRating(e.target.value)}>
                    <option value="5">★★★★★ (5.0)</option>
                    <option value="4.5">★★★★☆ (4.5)</option>
                    <option value="4">★★★★☆ (4.0)</option>
                    <option value="3.5">★★★☆☆ (3.5)</option>
                  </select>
                </div>

                <button type="submit" className="btn-primary" disabled={submittingTable}>
                  {submittingTable ? 'Adding...' : 'Add to Layout'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ==========================================
           VIEW: ANALYTICS & BUSINESS INTELLIGENCE
           ========================================== */}
        {currentView === 'analytics' && (
          <AnalyticsDashboard />
        )}

      </main>

      {/* ==========================================
         DRAWER / MODAL FOR TABLE DETAILS
         ========================================== */}
      {activeTableDetail && (
        <div className="drawer-overlay" onClick={() => setActiveTableDetail(null)}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--accent-gold-glow)', color: 'var(--accent-gold)' }}>
                  <ListTodo size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.3rem', margin: 0 }}>Table T-{activeTableDetail.number}</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Zone: {activeTableDetail.location} • {activeTableDetail.capacity} Seats
                  </span>
                </div>
              </div>
              <button onClick={() => setActiveTableDetail(null)} className="btn-secondary" style={{ padding: '0.35rem', border: 'none' }}>
                <X size={18} />
              </button>
            </div>

            {/* Table Operational State Badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Current Status:</span>
              <span className={`status-badge ${(activeTableDetail.operationalStatus || (activeTableDetail.isOccupied ? 'OCCUPIED' : 'AVAILABLE')).toLowerCase()}`}>
                ● {activeTableDetail.operationalStatus || (activeTableDetail.isOccupied ? 'OCCUPIED' : 'AVAILABLE')}
              </span>
            </div>

            {/* Current Guest Details if Occupied */}
            {activeTableDetail.currentGuest ? (
              <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--status-occupied)', textTransform: 'uppercase' }}>
                    Currently Seated Guest
                  </span>
                  <span className="duration-pill">
                    <Timer size={11} /> {activeTableDetail.currentGuest.durationMinutes} min elapsed
                  </span>
                </div>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {activeTableDetail.currentGuest.customerName}
                </h4>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem', lineHeight: '1.4' }}>
                  <div>Party Size: <strong>{activeTableDetail.currentGuest.partySize} guests</strong></div>
                  <div>Contact: {activeTableDetail.currentGuest.contact}</div>
                  <div>Seated: <strong>{activeTableDetail.currentGuest.startTime} – {activeTableDetail.currentGuest.endTime}</strong></div>
                </div>
                <button 
                  onClick={() => {
                    completeBooking(activeTableDetail.currentGuest.bookingId);
                    setActiveTableDetail(null);
                  }}
                  className="btn-primary"
                  style={{ width: '100%', backgroundColor: 'var(--status-free)', marginTop: '0.85rem' }}
                >
                  <CheckCircle2 size={16} style={{ marginRight: '4px' }} /> Free Table / Complete Dining
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--status-free)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
                    Table Available
                  </span>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0.75rem 0' }}>
                    No active seated party at this table. Capacity: {activeTableDetail.capacity} seats.
                  </p>
                  <button 
                    onClick={() => toggleOccupied(activeTableDetail)}
                    className="btn-secondary"
                    style={{ width: '100%' }}
                  >
                    {activeTableDetail.isOccupied ? 'Mark Physically Vacant' : 'Mark Physically Occupied (Walk-in)'}
                  </button>
                </div>

                {/* Seat Waiting Guest direct prompt */}
                {(operations.waitlist?.entries?.length > 0 || waitlist.length > 0) && (
                  <div style={{ padding: '1rem', backgroundColor: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                      <Clock size={16} style={{ color: 'var(--status-waitlist)' }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--status-waitlist)', textTransform: 'uppercase' }}>
                        Seat Waiting Guest Here
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                      {(operations.waitlist?.entries?.length > 0 ? operations.waitlist.entries : waitlist).map(wEntry => (
                        <div key={wEntry._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{wEntry.customerName}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Party of {wEntry.partySize} • {wEntry.contact}</div>
                          </div>
                          <button 
                            onClick={() => {
                              const tId = activeTableDetail._id;
                              setActiveTableDetail(null);
                              promoteWaitlistEntry(tId, wEntry._id);
                            }}
                            className="btn-primary"
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', backgroundColor: 'var(--status-free)', whiteSpace: 'nowrap' }}
                          >
                            Seat Here
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Upcoming Reservation details */}
            {activeTableDetail.nextReservation && (
              <div style={{ padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
                  Next Reservation Today
                </span>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{activeTableDetail.nextReservation.customerName}</h4>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: '1.4' }}>
                  <div>Time: <strong>{activeTableDetail.nextReservation.startTime} (starts in {activeTableDetail.nextReservation.startsInMinutes}m)</strong></div>
                  <div>Party: <strong>{activeTableDetail.nextReservation.partySize} guests</strong></div>
                  <div>Contact: {activeTableDetail.nextReservation.contact}</div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
              <button 
                onClick={() => handleDeleteTable(activeTableDetail._id)} 
                className="btn-secondary" 
                style={{ color: 'var(--status-occupied)', borderColor: 'rgba(239,68,68,0.3)', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                <Trash2 size={14} style={{ marginRight: '4px' }} /> Delete Table
              </button>
              <button 
                onClick={() => setActiveTableDetail(null)} 
                className="btn-secondary" 
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
         WAITLIST PROMOTION & SEATING DIALOG
         ========================================== */}
      {promotionCandidate && (
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
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div className="panel-card glass-card" style={{ maxWidth: '520px', width: '100%', padding: '1.75rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button
              onClick={() => setPromotionCandidate(null)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.6rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--status-free-glow)', color: 'var(--status-free)' }}>
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.35rem', margin: 0 }}>
                  Confirm & Seat Waiting Guest
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Assign an available table to complete seating or cancel waitlist.
                </span>
              </div>
            </div>

            {/* Guest Summary Card */}
            <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', border: '1px solid var(--border-color)', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Guest Name:</span>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{promotionCandidate.customerName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Party Size:</span>
                <strong>{promotionCandidate.partySize} guests</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Waiting Duration:</span>
                <strong style={{ color: 'var(--status-waitlist)' }}>{promotionCandidate.waitingDurationMinutes ?? 0} minutes</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Contact Phone:</span>
                <span>{promotionCandidate.contact}</span>
              </div>
            </div>

            {/* Smart Seating AI Assistant Action Banner */}
            <div style={{ backgroundColor: 'rgba(217, 119, 6, 0.08)', border: '1px solid var(--accent-gold)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.88rem', color: 'var(--accent-gold)' }}>
                  <GitMerge size={16} />
                  <span>Smart Seating AI Assistant</span>
                </div>
                <button
                  type="button"
                  onClick={runModalSmartAssistant}
                  disabled={modalCombineLoading}
                  className="btn-primary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', backgroundColor: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Sparkles size={13} className={modalCombineLoading ? 'spin-animation' : ''} />
                  {modalCombineLoading ? 'Solving...' : 'Auto-Fit Best Tables'}
                </button>
              </div>

              {modalCombineMsg ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: '1.4', backgroundColor: 'var(--bg-secondary)', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  {modalCombineMsg}
                </div>
              ) : (
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Assign remaining guests across multiple tables with 0 wasted capacity using backtracking optimization.
                </span>
              )}
            </div>

            {/* Live Capacity Meter & Multi-Table Allocation */}
            {(() => {
              const selectedTablesList = tables.filter(t => selectedPromoteTableIds.includes(t._id));
              const currentTotalCap = selectedTablesList.reduce((s, t) => s + t.capacity, 0);
              const isFullFit = currentTotalCap >= promotionCandidate.partySize;
              const remainingNeeded = Math.max(0, promotionCandidate.partySize - currentTotalCap);

              return (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                      Select Tables for Seating ({selectedPromoteTableIds.length} Selected):
                    </label>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isFullFit ? 'var(--status-free-glow)' : 'rgba(245, 158, 11, 0.15)',
                      color: isFullFit ? 'var(--status-free)' : '#fbbf24'
                    }}>
                      {isFullFit ? `✅ Capacity Met (${currentTotalCap}/${promotionCandidate.partySize} seats)` : `⚠️ ${currentTotalCap}/${promotionCandidate.partySize} seats (${remainingNeeded} more needed)`}
                    </span>
                  </div>

                  {/* Table Selection Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto' }}>
                    {tables.map(t => {
                      const isOccupied = t.isOccupied;
                      const isSelected = selectedPromoteTableIds.includes(t._id);
                      const isRecommended = promotionCandidate.suggestedTable?._id === t._id;

                      return (
                        <div 
                          key={t._id}
                          onClick={() => togglePromoteTable(t._id)}
                          style={{
                            padding: '0.7rem 0.9rem',
                            borderRadius: 'var(--radius-sm)',
                            border: isSelected ? '2px solid var(--accent-gold)' : '1px solid var(--border-color)',
                            backgroundColor: isSelected ? 'rgba(217, 119, 6, 0.12)' : 'var(--bg-secondary)',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <input 
                              type="checkbox" 
                              checked={isSelected} 
                              onChange={() => {}} // handled by row click
                              style={{ width: '16px', height: '16px', accentColor: 'var(--accent-gold)', cursor: 'pointer' }}
                            />
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: isSelected ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
                                  Table T-{t.number}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  ({t.capacity} seats • {t.location})
                                </span>
                                {isRecommended && (
                                  <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', backgroundColor: 'var(--accent-gold-glow)', color: 'var(--accent-gold)', borderRadius: 'var(--radius-sm)', fontWeight: 700 }}>
                                    Recommended
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                                {isSelected ? `Assigned for party seating` : `Click to include in party seating`}
                              </div>
                            </div>
                          </div>

                          <div>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: isOccupied ? 'rgba(239, 68, 68, 0.15)' : 'var(--status-free-glow)',
                              color: isOccupied ? 'var(--status-occupied)' : 'var(--status-free)'
                            }}>
                              {isOccupied ? 'Occupied' : 'Available'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Seating Allocation Breakdown Preview */}
                  {selectedTablesList.length > 0 && (
                    <div style={{ marginTop: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.85rem', border: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                        Seating Distribution Preview:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {(() => {
                          let left = promotionCandidate.partySize;
                          return selectedTablesList.map((t, idx) => {
                            const alloc = idx === selectedTablesList.length - 1 ? left : Math.min(t.capacity, left);
                            left = Math.max(0, left - alloc);
                            return (
                              <span key={t._id} style={{ padding: '0.2rem 0.5rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-gold)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>
                                <strong>Table T-{t.number}</strong>: {alloc} guests ({t.capacity} cap)
                              </span>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {(() => {
                const selectedTablesList = tables.filter(t => selectedPromoteTableIds.includes(t._id));
                const currentTotalCap = selectedTablesList.reduce((s, t) => s + t.capacity, 0);
                const tableNames = selectedTablesList.map(t => `T-${t.number}`).join(' + ');

                return (
                  <button
                    onClick={() => {
                      if (selectedPromoteTableIds.length === 0) {
                        alert('Please select at least one available table.');
                        return;
                      }
                      if (currentTotalCap < promotionCandidate.partySize) {
                        if (!window.confirm(`Warning: Selected tables have total capacity of ${currentTotalCap} seats for a party of ${promotionCandidate.partySize} guests (${promotionCandidate.partySize - currentTotalCap} guests unassigned). Do you still want to proceed?`)) {
                          return;
                        }
                      }
                      promoteWaitlistEntry(selectedPromoteTableIds, promotionCandidate._id);
                    }}
                    disabled={selectedPromoteTableIds.length === 0}
                    className="btn-primary"
                    style={{ width: '100%', padding: '0.75rem', fontSize: '0.92rem', backgroundColor: 'var(--status-free)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                  >
                    <CheckCircle2 size={18} />
                    {selectedPromoteTableIds.length === 0 
                      ? 'Select Tables to Seat Guest' 
                      : `Confirm & Seat ${promotionCandidate.partySize} Guests across ${selectedPromoteTableIds.length} Table(s) (${tableNames})`}
                  </button>
                );
              })()}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => deleteWaitlist(promotionCandidate._id)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '0.55rem', fontSize: '0.85rem', color: 'var(--status-occupied)', borderColor: 'rgba(239, 68, 68, 0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Trash2 size={14} />
                  Cancel Waitlist
                </button>
                <button
                  onClick={() => {
                    setPromotionCandidate(null);
                    setSelectedPromoteTableIds([]);
                  }}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '0.55rem', fontSize: '0.85rem' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
         MANAGER AUDIT TRAIL MODAL
         ========================================== */}
      {selectedAuditBooking && (
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
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div className="panel-card glass-card" style={{ maxWidth: '560px', width: '100%', padding: '1.75rem', position: 'relative', maxHeight: '85vh', overflowY: 'auto' }}>
            <button
              onClick={() => setSelectedAuditBooking(null)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                RESERVATION HISTORY
              </span>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.35rem', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                {selectedAuditBooking.customerName} • Table T-{selectedAuditBooking.tableId?.number || selectedAuditBooking.table?.number || 'Auto'}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Party of {selectedAuditBooking.partySize} • {selectedAuditBooking.bookingDate} ({selectedAuditBooking.startTime} - {selectedAuditBooking.endTime})
              </p>
            </div>

            {/* Lifecycle Events Log */}
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              {auditLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading history events...</div>
              ) : auditHistory.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No activity history records found for this reservation.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {auditHistory.map((ev, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem', padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)', marginTop: '6px', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {ev.previousStatus ? `${ev.previousStatus} → ${ev.newStatus}` : ev.newStatus}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(ev.timestamp || ev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ({new Date(ev.timestamp || ev.createdAt).toLocaleDateString()})
                          </span>
                        </div>
                        {ev.reason && (
                          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', fontSize: '0.8rem' }}>
                            Reason: {ev.reason}
                          </p>
                        )}
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', marginTop: '0.3rem' }}>
                          Updated By: <strong>{ev.changedByName}</strong> ({ev.changedByRole})
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button
                onClick={() => setSelectedAuditBooking(null)}
                className="btn-secondary"
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem' }}
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
