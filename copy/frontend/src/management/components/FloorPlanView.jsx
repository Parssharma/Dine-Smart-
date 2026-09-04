import React, { useState } from 'react';
import { 
  Users, CheckCircle2, RotateCw, X, Clock, AlertTriangle, 
  Sparkles, Check, Phone, Eye, ArrowRight, UserCheck, Trash2, Calendar, GitMerge
} from 'lucide-react';
import NotificationCenter from '../../components/NotificationCenter';
import { classifyTableReservations } from '../../utils/reservationClassification';

/**
 * FloorPlanView (Phase UI-2 — Google Stitch Design Reference)
 * 
 * Implements the Stitch technical-minimalist floor plan blueprint:
 * 1. Top Bar with restaurant name and live status summary chips (Avail, Occ, Res)
 * 2. Blueprint grid canvas with responsive table cards showing live statuses
 * 3. Slide-in right-side Table Details drawer with guest bento info & actions
 * 4. Smart Seating Assistant (Backtracking Solver) integration
 */
export default function FloorPlanView({
  displayTables,
  tables,
  bookings,
  operations,
  combinedTables,
  combineResult,
  combineCapacity,
  partySize,
  setPartySize,
  combineDate,
  setCombineDate,
  combineStart,
  setCombineStart,
  combineEnd,
  setCombineEnd,
  handleCombineStartChange,
  handleCombine,
  combining,
  combineError,
  setCombineError,
  setCombinedTables,
  setCombineResult,
  setCombineCapacity,
  selectedWaitlistEntry,
  setSelectedWaitlistEntry,
  promoteWaitlistEntry,
  activeTableDetail,
  setActiveTableDetail,
  handleDeleteTable,
  toggleOccupied,
  completeBooking,
  checkInBooking,
  seatBooking,
  cancelBooking,
  viewAuditTrail,
  getCurrentBooking,
  getTableReservations,
  currentTime,
  isRefreshing,
  fetchData,
  API_BASE,
  getAuthHeaders
}) {
  // Counts
  const availableCount = operations.tables?.available ?? tables.filter(t => !t.isOccupied).length;
  const occupiedCount = operations.tables?.occupied ?? tables.filter(t => t.isOccupied).length;
  const reservedCount = operations.tables?.reserved ?? bookings.filter(b => b.status === 'Confirmed').length;

  // Selected table drawer info helper using centralized reservation classification
  const {
    currentSeating: drawerBooking,
    upcomingReservations: drawerUpcoming,
    isPhysicallyOccupied: drawerOccupied,
    operationalStatus: drawerStatus
  } = activeTableDetail 
    ? classifyTableReservations(activeTableDetail._id, bookings, activeTableDetail, currentTime) 
    : { currentSeating: null, upcomingReservations: [], isPhysicallyOccupied: false, operationalStatus: 'AVAILABLE' };

  // Calculate Turn Time Progress % for occupied / active dining
  let turnProgress = 0;
  if (drawerBooking?.durationMinutes) {
    turnProgress = Math.min(100, Math.round((drawerBooking.durationMinutes / 90) * 100));
  }

  return (
    <div className="stitch-dashboard-container flex flex-col gap-4">

      {/* 1. TOP APP BAR */}
      <header className="stitch-header-bar">
        <div>
          <h2 className="stitch-header-title">The Gilded Bistro</h2>
          <p className="data-mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Main Dining Room • Live Floor Plan
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Status Summary Chips */}
          <div className="stitch-chip-group hidden sm:flex">
            <div className="stitch-stat-chip">
              <span className="dot avail"></span>
              <span>Avail: <strong>{availableCount}</strong></span>
            </div>
            <div className="stitch-stat-chip">
              <span className="dot occ"></span>
              <span>Occ: <strong>{occupiedCount}</strong></span>
            </div>
            <div className="stitch-stat-chip">
              <span className="dot res"></span>
              <span>Res: <strong>{reservedCount}</strong></span>
            </div>
          </div>

          <NotificationCenter />
          <button 
            onClick={() => fetchData()} 
            disabled={isRefreshing}
            className="btn-secondary" 
            style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.82rem', padding: '0.45rem 0.75rem' }}
            title="Refresh operational floor data"
          >
            <RotateCw size={14} className={isRefreshing ? 'spin-animation' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </header>

      <div style={{ padding: '0 0.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* 2. COMBINATION HIGHLIGHT BANNER (C++ Solver Results) */}
        {combinedTables.length > 0 && combineResult && (
          <div style={{ padding: '0.75rem 1.15rem', backgroundColor: 'rgba(217, 119, 6, 0.12)', border: '1px solid var(--accent-gold)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} style={{ color: 'var(--accent-gold)' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                Optimal Combination: <strong>{combineResult.tables.map(t => `T-${t.number}`).join(' + ')}</strong> (Total Capacity: {combineResult.totalCapacity} for {combineResult.partySize} guests)
              </span>
            </div>
            <button 
              onClick={() => {
                setCombinedTables([]);
                setCombineResult(null);
                setCombineCapacity(0);
                setPartySize('');
              }}
              className="btn-secondary"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
            >
              Clear Highlight
            </button>
          </div>
        )}

        {/* 3. WAITLIST SEAT ASSIGNMENT PROMPT */}
        {selectedWaitlistEntry && (
          <div style={{ padding: '0.75rem 1.15rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid #60a5fa', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.88rem' }}>
              Click an unoccupied table to assign and seat <strong>{selectedWaitlistEntry.customerName}</strong> (Party size: {selectedWaitlistEntry.partySize})
            </span>
            <button onClick={() => setSelectedWaitlistEntry(null)} className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
              Cancel
            </button>
          </div>
        )}

        {/* 4. TECHNICAL MINIMALIST FLOOR CANVAS */}
        <div className="stitch-floor-canvas">
          <div className="stitch-floor-tables-grid">
            {displayTables.map(table => {
              const isCombined = combinedTables.includes(table._id);
              const isSelected = activeTableDetail?._id === table._id;
              const status = table.operationalStatus || (table.isOccupied ? 'OCCUPIED' : 'AVAILABLE');
              const seatedInfo = operations.currentSeated?.find(s => (s.tableId?._id === table._id || s.tableId === table._id || s.table?._id === table._id));
              const upcomingInfo = table.nextReservation || bookings.find(b => (b.tableId?._id === table._id || b.tableId === table._id || b.table?._id === table._id) && b.status === 'Confirmed');

              return (
                <div 
                  key={table._id}
                  className={`stitch-table-box ${isSelected ? 'selected' : ''} ${isCombined ? 'combined-active' : ''}`}
                  onClick={async () => {
                    if (selectedWaitlistEntry) {
                      if (table.isOccupied) {
                        const activeB = bookings.find(b => 
                          (b.tableId?._id === table._id || b.tableId === table._id) && 
                          (b.status === 'Confirmed' || b.status === 'Seated')
                        );
                        const customerLabel = activeB ? `occupied by ${activeB.customerName}` : 'occupied';
                        if (window.confirm(`Table T-${table.number} is currently ${customerLabel}. Complete their booking and seat ${selectedWaitlistEntry.customerName} here?`)) {
                          if (activeB) {
                            await fetch(`${API_BASE}/bookings/${activeB._id}`, {
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
                  {/* Top: Table ID & Capacity */}
                  <div className="stitch-table-box-top">
                    <span className="stitch-table-id">T-{table.number}</span>
                    <span className="stitch-table-capacity">
                      <Users size={12} /> {table.capacity}
                    </span>
                  </div>

                  {/* Center Content based on Status */}
                  <div className="stitch-table-center">
                    {status === 'OCCUPIED' && (
                      <div>
                        <div className="stitch-table-time">
                          {seatedInfo?.durationMinutes ? `${seatedInfo.durationMinutes}m` : 'Seated'}
                        </div>
                        <div className="stitch-table-guest-name">
                          {seatedInfo?.customerName || table.currentGuest?.customerName || 'Diner'}
                        </div>
                      </div>
                    )}

                    {status === 'RESERVED' && (
                      <div>
                        <div className="stitch-table-time" style={{ color: '#93c5fd' }}>
                          {upcomingInfo?.startTime || '19:30'}
                        </div>
                        <div className="stitch-table-guest-name">
                          {upcomingInfo?.customerName || 'Reserved'}
                        </div>
                      </div>
                    )}

                    {status === 'AVAILABLE' && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                        <CheckCircle2 size={18} style={{ color: 'var(--status-free)' }} />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{table.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom: Status Badge */}
                  <div className={`stitch-badge-box ${status.toLowerCase()}`}>
                    {status === 'RESERVED' && upcomingInfo?.startsInMinutes !== undefined ? (
                      <span>Arr {upcomingInfo.startsInMinutes}m</span>
                    ) : (
                      <span>{status}</span>
                    )}
                  </div>
                </div>
              );
            })}

            {displayTables.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                No tables configured in the restaurant layout.
              </div>
            )}
          </div>
        </div>

        {/* 5. SMART SEATING ASSISTANT (C++ BACKTRACKING SOLVER) */}
        <div className="stitch-bento-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <GitMerge size={18} style={{ color: 'var(--accent-gold)' }} />
            <h3 className="stitch-panel-title" style={{ margin: 0, fontSize: '0.9rem' }}>
              Smart Seating Assistant (Backtracking Solver)
            </h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.15rem' }}>
            Calculates the minimal subset of available tables for large parties using C++ Backtracking optimization to minimize unused capacity.
          </p>

          <form onSubmit={handleCombine} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="stitch-drawer-bento-label">Party Size</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="e.g. 8" 
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
                <label className="stitch-drawer-bento-label">Date</label>
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

              <div className="form-group" style={{ margin: 0 }}>
                <label className="stitch-drawer-bento-label">Start Time</label>
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
                <label className="stitch-drawer-bento-label">End Time</label>
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
              <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', color: '#fca5a5', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertTriangle size={14} style={{ color: '#f87171' }} />
                <span>{combineError}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button 
                type="submit" 
                className="btn-primary" 
                disabled={combining}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Sparkles size={14} className={combining ? 'spin-animation' : ''} />
                {combining ? 'Solving Table Combination...' : 'Run C++ Backtracking Solver'}
              </button>
            </div>
          </form>
        </div>

      </div>

      {/* 6. SLIDE-IN TABLE DETAILS DRAWER */}
      {activeTableDetail && (
        <>
          {/* Backdrop overlay */}
          <div className="stitch-drawer-backdrop" onClick={() => setActiveTableDetail(null)} />

          <div className="stitch-drawer">
            {/* Drawer Header */}
            <div className="stitch-drawer-header">
              <div>
                <span className="stitch-kpi-label">Table Details</span>
                <h3 className="geist-font" style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.15rem 0 0 0' }}>
                  Table T-{activeTableDetail.number}
                </h3>
              </div>
              <button 
                onClick={() => setActiveTableDetail(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '0.25rem' }}
                title="Close drawer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="stitch-drawer-content">

              {/* Status Alert Pill Strip */}
              <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'var(--bg-tertiary)', borderLeft: `4px solid ${drawerStatus === 'OCCUPIED' ? 'var(--status-occupied)' : drawerStatus === 'RESERVED' ? '#60a5fa' : 'var(--status-free)'}`, borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  {drawerStatus === 'OCCUPIED' ? `Occupied (${drawerBooking?.durationMinutes ?? 0}m elapsed)` : drawerStatus === 'RESERVED' ? 'Upcoming Reservation' : 'Available for Seating'}
                </span>
                <span className={`stitch-badge ${drawerStatus.toLowerCase()}`}>
                  {drawerStatus}
                </span>
              </div>

              {/* Primary Guest Bento Grid */}
              <div className="stitch-drawer-bento">
                <div className="stitch-drawer-bento-card full-width">
                  <span className="stitch-drawer-bento-label">Primary Guest / Current Seating</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.15rem' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                      {drawerBooking ? drawerBooking.customerName : 'No Active Guest'}
                    </span>
                    {drawerBooking && (
                      <span className="stitch-badge" style={{ backgroundColor: 'rgba(217, 119, 6, 0.15)', color: 'var(--accent-gold)', border: '1px solid var(--accent-gold)', textTransform: 'uppercase' }}>
                        {drawerBooking.status}
                      </span>
                    )}
                  </div>
                </div>

                <div className="stitch-drawer-bento-card">
                  <span className="stitch-drawer-bento-label">
                    <Users size={12} /> Party Size
                  </span>
                  <span className="stitch-drawer-bento-value">
                    {drawerBooking ? `${drawerBooking.partySize} Guests` : `${activeTableDetail.capacity} Seats`}
                  </span>
                </div>

                <div className="stitch-drawer-bento-card">
                  <span className="stitch-drawer-bento-label">
                    <Clock size={12} /> Schedule
                  </span>
                  <span className="stitch-drawer-bento-value" style={{ fontSize: '0.95rem' }}>
                    {drawerBooking ? `${drawerBooking.startTime}–${drawerBooking.endTime}` : (drawerUpcoming[0] ? `@ ${drawerUpcoming[0].startTime}` : 'Now Free')}
                  </span>
                </div>

                <div className="stitch-drawer-bento-card full-width">
                  <span className="stitch-drawer-bento-label">Table Zone & Rating</span>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                    <span>Zone: <strong>{activeTableDetail.location}</strong></span>
                    <span>Rating: <strong>★ {activeTableDetail.rating}</strong></span>
                  </div>
                </div>
              </div>

              {/* Turn Time Timeline (If occupied) */}
              {drawerBooking && (
                <div className="stitch-drawer-bento-card full-width">
                  <span className="stitch-drawer-bento-label">Turn Time Dining Progress</span>
                  <div className="stitch-turn-bar-container">
                    <span className="data-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{drawerBooking.startTime}</span>
                    <div className="stitch-turn-track">
                      <div className="stitch-turn-fill" style={{ width: `${turnProgress}%` }} />
                    </div>
                    <span className="data-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{drawerBooking.endTime}</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {drawerBooking.durationMinutes ?? 0}m elapsed of estimated 90m turnover window
                  </span>
                </div>
              )}

              {/* Upcoming Reservations Queue for Table */}
              <div>
                <span className="stitch-kpi-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Upcoming Schedule ({drawerUpcoming.length})
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {drawerUpcoming.map(res => (
                    <div key={res._id} style={{ padding: '0.65rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                        <span>{res.customerName}</span>
                        <span style={{ color: 'var(--accent-gold)' }}>{res.startTime}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {res.partySize} guests • {res.contact}
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.45rem', justifyContent: 'flex-end' }}>
                        {res.status === 'Confirmed' && (
                          <button
                            onClick={() => checkInBooking(res._id)}
                            className="btn-secondary"
                            style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem', color: '#3b82f6' }}
                          >
                            Check In
                          </button>
                        )}
                        <button
                          onClick={() => seatBooking(res._id)}
                          className="btn-secondary"
                          style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem', color: 'var(--status-free)' }}
                        >
                          Seat Guest
                        </button>
                        <button
                          onClick={() => cancelBooking(res._id)}
                          className="btn-secondary"
                          style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem', color: 'var(--status-occupied)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}

                  {drawerUpcoming.length === 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.75rem 0', textAlign: 'center' }}>
                      No further reservations scheduled for this table.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Drawer Actions */}
            <div className="stitch-drawer-footer">
              {drawerBooking && (
                <button
                  onClick={() => {
                    completeBooking(drawerBooking._id);
                    setActiveTableDetail(null);
                  }}
                  className="btn-primary"
                  style={{ width: '100%', padding: '0.65rem', backgroundColor: 'var(--status-free)', color: '#FFFFFF', fontSize: '0.85rem' }}
                >
                  <CheckCircle2 size={16} style={{ marginRight: '0.4rem' }} /> Free Table & Complete Dining
                </button>
              )}

              {!drawerBooking && (
                <button
                  onClick={() => toggleOccupied(activeTableDetail)}
                  className="btn-primary"
                  style={{ width: '100%', padding: '0.65rem', fontSize: '0.85rem' }}
                >
                  {drawerOccupied ? 'Mark Physically Vacant' : 'Mark Physically Occupied (Walk-In)'}
                </button>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => toggleOccupied(activeTableDetail)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '0.45rem', fontSize: '0.78rem' }}
                >
                  Toggle Occupancy
                </button>
                {drawerBooking && (
                  <button
                    onClick={() => viewAuditTrail(drawerBooking)}
                    className="btn-secondary"
                    style={{ flex: 1, padding: '0.45rem', fontSize: '0.78rem' }}
                  >
                    View History
                  </button>
                )}
              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}
