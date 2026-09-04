import React, { useState } from 'react';
import { 
  Users, CheckCircle2, RotateCw, X, Clock, AlertTriangle, 
  Sparkles, Check, Phone, Eye, ArrowRight, UserCheck, Trash2, Calendar, GitMerge
} from 'lucide-react';

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



  return (
    <div className="stitch-dashboard-container flex flex-col gap-4">


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

        {/* 5. SMART SEATING ASSISTANT */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Sparkles size={18} style={{ color: 'var(--accent-gold)' }} />
            <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.15rem' }}>
              Smart Seating Assistant
            </h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            Finds the best combination of tables for larger parties, minimizing empty seats.
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
                {combining ? 'Finding Best Tables...' : 'Find Best Tables'}
              </button>
            </div>
          </form>
        </div>

      </div>



    </div>
  );
}
