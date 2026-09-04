import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, Users, User, Trash2, CheckCircle2, RotateCw, GitMerge, Layout, 
  AlertCircle, BarChart3, Settings, Compass, Calendar, ListTodo, LogOut, 
  Clock, Sparkles, Check, X, ShieldCheck, Lock, Mail, AlertTriangle,
  Timer, ChevronRight, Phone, ArrowRight, UserCheck, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationCenter from './NotificationCenter';
import AnalyticsDashboard from './AnalyticsDashboard';
import DashboardView from '../management/components/DashboardView';
import FloorPlanView from '../management/components/FloorPlanView';
import WaitlistView from '../management/components/WaitlistView';
import TopNav from '../management/components/TopNav';
import { classifyTableReservations } from '../utils/reservationClassification';
import { API_BASE } from '../config/api';

// Map internal view names to management routes
const VIEW_ROUTE_MAP = {
  dashboard: '/management',
  floor: '/management/floor',
  seating: '/management/floor',
  bookings: '/management/bookings',
  history: '/management/history',
  waitlist: '/management/waitlist',
  tables: '/management/tables',
  analytics: '/management/analytics'
};

export default function ManagementPortal({ initialView = 'dashboard' }) {
  const { user, isAuthenticated, isManager, login, logout, getAuthHeaders } = useAuth();
  const navigate = useNavigate();

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

  // Navigation state — initialized from route via initialView prop
  const [currentView, setCurrentView] = useState(initialView);

  // Sync currentView when route changes (initialView prop changes)
  useEffect(() => {
    setCurrentView(initialView);
  }, [initialView]);

  // Navigate to a management view — updates both internal state and URL
  const navigateToView = useCallback((view) => {
    setCurrentView(view);
    const route = VIEW_ROUTE_MAP[view] || '/management';
    navigate(route);
  }, [navigate]);

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
  const getLocalTodayStr = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localNow = new Date(now.getTime() - (offset * 60 * 1000));
    return localNow.toISOString().split('T')[0];
  };
  const todayStr = getLocalTodayStr();
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

  // Manager login is now handled by ManagementLoginPage

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
      let opData = null;
      if (opRes.ok) {
        opData = await opRes.json();
        if (opData && opData.success !== false) {
          setOperations(opData);
        } else {
          console.warn('[ManagementPortal] Operations API returned error:', opData?.message);
        }
      } else {
        const errText = await opRes.text().catch(() => opRes.statusText);
        console.error('[ManagementPortal] Operations API failed:', opRes.status, errText);
        if (!silent) setErrorMsg(`Operations API error (${opRes.status}): ${opRes.statusText}`);
      }

      // Also fetch legacy endpoints for full compatibility with specific tabs
      const [tRes, wRes, bRes] = await Promise.all([
        fetch(`${API_BASE}/tables`, { headers }),
        fetch(`${API_BASE}/bookings/waitlist/all`, { headers }),
        fetch(`${API_BASE}/bookings`, { headers })
      ]);

      let freshTables = [];
      if (opData?.tables?.list?.length > 0) {
        freshTables = opData.tables.list;
        setTables(opData.tables.list);
      } else if (tRes.ok) {
        const tData = await tRes.json();
        if (Array.isArray(tData)) {
          freshTables = tData;
          setTables(tData);
        }
      }

      if (opData?.waitlist?.entries) {
        setWaitlist(opData.waitlist.entries);
      } else if (wRes.ok) {
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
        const fresh = freshTables.find(t => t._id === prev._id);
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

  // Polling interval with clean unmount cleanup and immediate sync on view change
  useEffect(() => {
    if (isManager) {
      fetchData(false); // immediate non-silent refresh on mount/view change
      const interval = setInterval(() => {
        fetchData(true);
      }, 4000); // Poll operations every 4 seconds for faster updates

      // Force refresh when tab becomes visible again (switching from Customer Portal)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          isFetchingRef.current = false; // reset lock in case it got stuck
          fetchData(true);
        }
      };
      const handleFocus = () => {
        isFetchingRef.current = false; // reset lock in case it got stuck
        fetchData(true);
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);

      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, [isManager, currentView]);

  const getTableReservations = (tableId) => {
    const { upcomingReservations } = classifyTableReservations(tableId, bookings, null, currentTime);
    return upcomingReservations;
  };

  const getCurrentBooking = (tableId) => {
    const { currentSeating } = classifyTableReservations(tableId, bookings, null, currentTime);
    return currentSeating;
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

  // Cancel a Booking (Release table & record cancellation)
  const cancelBooking = async (bookingId, reason = 'Cancelled by manager') => {
    if (!window.confirm('Are you sure you want to cancel this reservation and release the table?')) return;
    try {
      const res = await fetch(`${API_BASE}/bookings/${bookingId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'Cancelled', reason })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Failed to cancel reservation');
      }
      fetchData();
    } catch (err) {
      alert(err.message);
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

  // Authentication guards are now handled by ManagementLayout (route-level)

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
         TOP NAVIGATION BAR
         ========================================== */}
      <TopNav
        currentView={currentView}
        navigateToView={navigateToView}
        fetchData={fetchData}
        isRefreshing={isRefreshing}
        user={user}
        logout={logout}
        navigate={navigate}
      />

      {/* ==========================================
         MAIN CONTENT AREA
         ========================================== */}
      <main className="dashboard-content">

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
           VIEW: DASHBOARD (PHASE UI-1 STITCH MIGRATION)
           ========================================== */}
        {currentView === 'dashboard' && (
          <DashboardView
            operations={operations}
            tables={tables}
            bookings={bookings}
            waitlist={waitlist}
            currentTime={currentTime}
            isRefreshing={isRefreshing}
            fetchData={fetchData}
            completeBooking={completeBooking}
            checkInBooking={checkInBooking}
            seatBooking={seatBooking}
            markNoShow={markNoShow}
            cancelBooking={cancelBooking}
            viewAuditTrail={viewAuditTrail}
            openPromoteModal={openPromoteModal}
            navigateToView={navigateToView}
            setActiveTableDetail={setActiveTableDetail}
          />
        )}

        {/* ==========================================
           VIEW: FLOOR PLAN (PHASE UI-2 STITCH MIGRATION)
           ========================================== */}
        {currentView === 'floor' && (
          <FloorPlanView
            displayTables={displayTables}
            tables={tables}
            bookings={bookings}
            operations={operations}
            combinedTables={combinedTables}
            combineResult={combineResult}
            combineCapacity={combineCapacity}
            partySize={partySize}
            setPartySize={setPartySize}
            combineDate={combineDate}
            setCombineDate={setCombineDate}
            combineStart={combineStart}
            setCombineStart={setCombineStart}
            combineEnd={combineEnd}
            setCombineEnd={setCombineEnd}
            handleCombineStartChange={handleCombineStartChange}
            handleCombine={handleCombine}
            combining={combining}
            combineError={combineError}
            setCombineError={setCombineError}
            setCombinedTables={setCombinedTables}
            setCombineResult={setCombineResult}
            setCombineCapacity={setCombineCapacity}
            selectedWaitlistEntry={selectedWaitlistEntry}
            setSelectedWaitlistEntry={setSelectedWaitlistEntry}
            promoteWaitlistEntry={promoteWaitlistEntry}
            activeTableDetail={activeTableDetail}
            setActiveTableDetail={setActiveTableDetail}
            handleDeleteTable={handleDeleteTable}
            toggleOccupied={toggleOccupied}
            completeBooking={completeBooking}
            checkInBooking={checkInBooking}
            seatBooking={seatBooking}
            cancelBooking={cancelBooking}
            viewAuditTrail={viewAuditTrail}
            getCurrentBooking={getCurrentBooking}
            getTableReservations={getTableReservations}
            currentTime={currentTime}
            isRefreshing={isRefreshing}
            fetchData={fetchData}
            API_BASE={API_BASE}
            getAuthHeaders={getAuthHeaders}
          />
        )}

        {/* ==========================================
           VIEW: BOOKINGS (STITCH UNIFIED RESERVATIONS)
           ========================================== */}
        {currentView === 'bookings' && (
          <div className="panel-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, fontFamily: 'Geist, sans-serif' }}>
                  Upcoming Reservations
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Confirmed guest bookings and active table assignments for today's service.
                </span>
              </div>
              <span style={{ fontFamily: 'Geist, monospace', fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {bookings.length} Total
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="stitch-table">
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>Guest</th>
                    <th style={{ width: '18%' }}>Time & Date</th>
                    <th style={{ width: '10%' }}>Party</th>
                    <th style={{ width: '14%' }}>Table</th>
                    <th style={{ width: '14%' }}>Status</th>
                    <th style={{ width: '22%', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(booking => {
                    const statusClass = booking.status.toLowerCase().replace(/\s+/g, '-');
                    return (
                      <tr key={booking._id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{booking.customerName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{booking.contact}</div>
                        </td>
                        <td>
                          <div style={{ fontFamily: 'Geist, monospace', fontSize: '0.85rem', fontWeight: 600 }}>
                            {booking.startTime} – {booking.endTime}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{booking.bookingDate}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'Geist, monospace', fontWeight: 600 }}>
                            <Users size={13} style={{ color: 'var(--text-muted)' }} />
                            <span>{booking.partySize}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'Geist, monospace', fontSize: '0.85rem', fontWeight: 600 }}>
                            {booking.tableId ? `Table T-${booking.tableId.number}` : 'Unassigned'}
                          </span>
                        </td>
                        <td>
                          <span className={`stitch-badge ${statusClass}`} style={{ textTransform: 'uppercase', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                            {booking.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                            {booking.status === 'Confirmed' && (
                              <button 
                                onClick={() => checkInBooking(booking._id)} 
                                className="stitch-action-btn primary"
                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                              >
                                Check In
                              </button>
                            )}
                            {(booking.status === 'Confirmed' || booking.status === 'Checked In') && (
                              <button 
                                onClick={() => seatBooking(booking._id)} 
                                className="stitch-action-btn primary"
                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                              >
                                Seat
                              </button>
                            )}
                            {booking.status === 'Seated' && (
                              <button 
                                onClick={() => completeBooking(booking._id)} 
                                className="stitch-action-btn primary"
                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', backgroundColor: 'var(--status-free)', borderColor: 'var(--status-free)', color: '#FFFFFF' }}
                              >
                                Complete
                              </button>
                            )}
                            {(booking.status === 'Confirmed' || booking.status === 'Checked In') && (
                              <button 
                                onClick={() => markNoShow(booking._id)} 
                                className="stitch-action-btn secondary"
                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', color: 'var(--status-occupied)' }}
                                title="Mark reservation as no-show"
                              >
                                No Show
                              </button>
                            )}
                            {['Confirmed', 'Checked In', 'Seated'].includes(booking.status) && (
                              <button 
                                onClick={() => cancelBooking(booking._id)} 
                                className="stitch-action-btn secondary"
                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', color: 'var(--status-occupied)' }}
                                title="Cancel reservation and free up table slot"
                              >
                                Cancel
                              </button>
                            )}
                            <button 
                              onClick={() => viewAuditTrail(booking)} 
                              className="stitch-action-btn secondary"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                              title="View Audit Trail"
                            >
                              <Clock size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {bookings.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                  No reservations on file.
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
            <div className="panel-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, fontFamily: 'Geist, sans-serif' }}>
                    Master Reservation History & Audit Trail
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Chronological activity log of all confirmed, completed, cancelled, and no-show reservations.
                  </span>
                </div>
                <span style={{ fontFamily: 'Geist, monospace', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {filteredHistory.length} Records
                </span>
              </div>

              {/* Filters Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: '0.85rem', marginBottom: '1.25rem', alignItems: 'center' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Search Guest / Table</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Search by name, contact, or table..." 
                    value={historyFilterSearch} 
                    onChange={(e) => setHistoryFilterSearch(e.target.value)}
                    style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Filter by Status</label>
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
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Filter by Date</label>
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
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th style={{ width: '22%' }}>Customer</th>
                      <th style={{ width: '14%' }}>Table</th>
                      <th style={{ width: '18%' }}>Date & Time</th>
                      <th style={{ width: '10%' }}>Party</th>
                      <th style={{ width: '14%' }}>Status</th>
                      <th style={{ width: '14%' }}>Timeline</th>
                      <th style={{ width: '8%', textAlign: 'right' }}>Audit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map(b => {
                      const statusClass = b.status.toLowerCase().replace(/\s+/g, '-');
                      return (
                        <tr key={b._id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{b.customerName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.contact}</div>
                          </td>
                          <td>
                            <span style={{ fontFamily: 'Geist, monospace', fontSize: '0.85rem', fontWeight: 600 }}>
                              {b.tableId?.number ? `Table T-${b.tableId.number}` : 'Unassigned'}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontFamily: 'Geist, monospace', fontSize: '0.85rem' }}>{b.bookingDate}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Geist, monospace' }}>{b.startTime} - {b.endTime}</div>
                          </td>
                          <td>
                            <span style={{ fontFamily: 'Geist, monospace', fontWeight: 600 }}>{b.partySize}</span>
                          </td>
                          <td>
                            <span className={`stitch-badge ${statusClass}`} style={{ textTransform: 'uppercase', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                              {b.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {b.checkedInAt && <div>Checked in: {new Date(b.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                            {b.seatedAt && <div>Seated: {new Date(b.seatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                            {b.completedAt && <div>Completed: {new Date(b.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                            {b.noShowAt && <div style={{ color: 'var(--status-occupied)' }}>No Show: {new Date(b.noShowAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                            {b.cancelledAt && <div style={{ color: 'var(--status-occupied)' }}>Cancelled: {new Date(b.cancelledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button 
                              onClick={() => viewAuditTrail(b)} 
                              className="stitch-action-btn secondary"
                              style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                              title="View full audit trail"
                            >
                              <Clock size={13} />
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
           VIEW: WAITLIST & SMART SEATING (PHASE UI-3 STITCH MIGRATION)
           ========================================== */}
        {(currentView === 'waitlist' || currentView === 'seating') && (
          <WaitlistView
            operations={operations}
            waitlist={waitlist}
            tables={tables}
            bookings={bookings}
            partySize={partySize}
            setPartySize={setPartySize}
            combineDate={combineDate}
            setCombineDate={setCombineDate}
            combineStart={combineStart}
            setCombineStart={setCombineStart}
            combineEnd={combineEnd}
            setCombineEnd={setCombineEnd}
            handleCombineStartChange={handleCombineStartChange}
            handleCombine={handleCombine}
            combining={combining}
            combineError={combineError}
            setCombineError={setCombineError}
            combineResult={combineResult}
            setCombineResult={setCombineResult}
            setCombinedTables={setCombinedTables}
            openPromoteModal={openPromoteModal}
            deleteWaitlist={deleteWaitlist}
            setSelectedWaitlistEntry={setSelectedWaitlistEntry}
            navigateToView={navigateToView}
            currentTime={currentTime}
            isRefreshing={isRefreshing}
            fetchData={fetchData}
          />
        )}

        {/* ==========================================
           VIEW: TABLES (TABLE INVENTORY & CONFIGURATION)
           ========================================== */}
        {currentView === 'tables' && (
          <div className="grid-layout" style={{ gridTemplateColumns: '1.3fr 0.7fr', gap: '1.25rem' }}>
            <div className="panel-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, fontFamily: 'Geist, sans-serif' }}>
                    Table Layout Inventory
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Physical dining tables registered in the restaurant system.
                  </span>
                </div>
                <span style={{ fontFamily: 'Geist, monospace', fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {tables.length} Total Tables
                </span>
              </div>

              <div className="floor-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                {tables.map(table => (
                  <div key={table._id} className="stitch-table-box" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '110px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <span className="stitch-table-id" style={{ fontSize: '1.05rem', fontWeight: 700 }}>T-{table.number}</span>
                      <span style={{ fontSize: '0.75rem', color: table.isOccupied ? 'var(--status-occupied)' : 'var(--status-free)', fontWeight: 700 }}>
                        ● {table.isOccupied ? 'OCC' : 'AVAIL'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <div>Seats: <strong style={{ color: 'var(--text-primary)' }}>{table.capacity}</strong></div>
                      <div>Zone: <strong>{table.location}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, marginBottom: '1.25rem', fontFamily: 'Geist, sans-serif', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={18} className="logo-icon" />
                Add Dining Table
              </h3>

              <form onSubmit={handleAddTable}>
                <div className="form-group">
                  <label className="form-label">Table ID / Number</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. 1A or 12" 
                    value={number} 
                    onChange={(e) => setNumber(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Seats</label>
                    <select className="form-select" value={capacity} onChange={(e) => setCapacity(e.target.value)}>
                      <option value="2">2 Guests</option>
                      <option value="4">4 Guests</option>
                      <option value="6">6 Guests</option>
                      <option value="8">8 Guests</option>
                      <option value="10">10 Guests</option>
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

                <button type="submit" className="stitch-action-btn primary" style={{ width: '100%', padding: '0.65rem', justifyContent: 'center' }} disabled={submittingTable}>
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
      {activeTableDetail && (() => {
        const {
          currentSeating: currentActive,
          upcomingReservations: upcomingListForTable,
          isPhysicallyOccupied,
          operationalStatus: tableStatus
        } = classifyTableReservations(activeTableDetail._id, bookings, activeTableDetail, currentTime);

        return (
          <div className="drawer-overlay" onClick={() => setActiveTableDetail(null)}>
            <div className="drawer-content" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--accent-gold-glow)', color: 'var(--accent-gold)' }}>
                    <ListTodo size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.3rem', margin: 0 }}>Table T-{activeTableDetail.number}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Zone: {activeTableDetail.location} • {activeTableDetail.capacity} Seats • Rating: ★ {activeTableDetail.rating}
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
                <span className={`status-badge ${tableStatus.toLowerCase()}`}>
                  ● {tableStatus}
                </span>
              </div>

              {/* Current Guest Details if Seated / Occupied */}
              {currentActive ? (
                <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--status-occupied)', textTransform: 'uppercase' }}>
                      CURRENT SEATING
                    </span>
                    {currentActive.durationMinutes !== undefined && (
                      <span className="duration-pill">
                        <Timer size={11} /> {currentActive.durationMinutes} min elapsed
                      </span>
                    )}
                  </div>
                  <h4 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>
                    {currentActive.customerName}
                  </h4>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    <div>Party Size: <strong>{currentActive.partySize} guests</strong></div>
                    <div>Phone: {currentActive.contact}</div>
                    <div>Time: <strong>{currentActive.startTime} – {currentActive.endTime}</strong> ({currentActive.bookingDate || 'Today'})</div>
                    <div style={{ marginTop: '0.25rem' }}>
                      Status: <span className="status-badge seated" style={{ textTransform: 'uppercase', fontSize: '0.72rem', padding: '0.15rem 0.45rem', fontWeight: 700 }}>{currentActive.status}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
                    <button 
                      onClick={async () => {
                        await completeBooking(currentActive._id);
                        setActiveTableDetail(null);
                      }}
                      className="btn-primary"
                      style={{ flex: 1, backgroundColor: 'var(--status-free)' }}
                    >
                      <CheckCircle2 size={16} style={{ marginRight: '4px' }} /> Complete Dining
                    </button>
                    <button 
                      onClick={async () => {
                        await cancelBooking(currentActive._id);
                        setActiveTableDetail(null);
                      }}
                      className="btn-secondary"
                      style={{ color: 'var(--status-occupied)', borderColor: 'rgba(239,68,68,0.3)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ padding: '1rem', backgroundColor: isPhysicallyOccupied ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)', border: isPhysicallyOccupied ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-md)' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isPhysicallyOccupied ? 'var(--status-occupied)' : 'var(--status-free)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
                      Physical Table State: {isPhysicallyOccupied ? 'Occupied' : 'Vacant'}
                    </span>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0.75rem 0' }}>
                      {isPhysicallyOccupied 
                        ? 'Table is currently marked as occupied on the restaurant floor.' 
                        : `No guest is currently seated. Table capacity: ${activeTableDetail.capacity} seats.`}
                    </p>
                    <button 
                      onClick={() => toggleOccupied(activeTableDetail)}
                      className="btn-secondary"
                      style={{ width: '100%', color: isPhysicallyOccupied ? 'var(--status-free)' : 'var(--accent-gold)' }}
                    >
                      {isPhysicallyOccupied ? '✓ Mark Physically Vacant (Free Table)' : '● Mark Physically Occupied (Walk-in)'}
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto' }}>
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

              {/* All Upcoming & Future Reservations for this Table */}
              <div style={{ padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', display: 'block', marginBottom: '0.6rem' }}>
                  Upcoming Reservations ({upcomingListForTable.length})
                </span>
                
                {upcomingListForTable.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '220px', overflowY: 'auto' }}>
                    {upcomingListForTable.map(res => (
                      <div key={res._id} style={{ padding: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{res.customerName}</h4>
                          <span className={`status-badge ${(res.status || 'Confirmed').toLowerCase()}`}>
                            {res.status || 'Confirmed'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem', lineHeight: '1.4' }}>
                          <div>Time: <strong style={{ color: 'var(--accent-gold)' }}>{res.startTime} – {res.endTime}</strong> ({res.bookingDate})</div>
                          <div>Party: <strong>{res.partySize} guests</strong> • Phone: {res.contact}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {res.status === 'Confirmed' && (
                            <button 
                              onClick={() => checkInBooking(res._id)} 
                              className="btn-secondary" 
                              style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', color: '#3b82f6', borderColor: 'rgba(59,130,246,0.3)' }}
                            >
                              Check In
                            </button>
                          )}
                          <button 
                            onClick={() => seatBooking(res._id)} 
                            className="btn-secondary" 
                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', color: 'var(--status-free)', borderColor: 'rgba(16,185,129,0.3)' }}
                          >
                            Seat Guest
                          </button>
                          <button 
                            onClick={() => cancelBooking(res._id)} 
                            className="btn-secondary" 
                            style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', color: 'var(--status-occupied)', borderColor: 'rgba(239,68,68,0.3)' }}
                            title="Cancel reservation and free up table slot"
                          >
                            Cancel / Free Table
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                    No upcoming reservations scheduled for this table.
                  </p>
                )}
              </div>

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
        );
      })()}

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
          backgroundColor: 'rgba(28, 28, 28, 0.45)',
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
                  Assign remaining guests across multiple tables with zero empty seats.
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
          backgroundColor: 'rgba(28, 28, 28, 0.45)',
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
                    <div key={i} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem', padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
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
