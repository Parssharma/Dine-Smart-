import React, { useState } from 'react';
import { 
  Users, CheckCircle2, RotateCw, Trash2, Clock, Sparkles, 
  AlertTriangle, Calendar, Plus, Minus, ArrowRight, GitMerge
} from 'lucide-react';
import NotificationCenter from '../../components/NotificationCenter';

/**
 * WaitlistView (Phase UI-3 — Google Stitch Design Reference)
 * 
 * Implements the Stitch 2-column Bento Layout:
 * 1. Left (8 Cols): Active Waitlist Table (Pos, Guest, Party, Wait Time, Status, Action)
 * 2. Right (4 Cols): Smart Seating Assistant (Party Size Stepper, Recommendation Box, Assign Tables)
 */
export default function WaitlistView({
  operations,
  waitlist,
  tables,
  bookings,
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
  combineResult,
  setCombineResult,
  setCombinedTables,
  openPromoteModal,
  deleteWaitlist,
  setSelectedWaitlistEntry,
  navigateToView,
  currentTime,
  isRefreshing,
  fetchData
}) {
  const waitlistEntries = operations.waitlist?.entries?.length > 0 
    ? operations.waitlist.entries 
    : waitlist;

  const waitlistTotal = operations.waitlist?.total ?? waitlistEntries.length;

  // Numerical party size helpers for stepper
  const currentPartyNum = parseInt(partySize, 10) || 4;

  const handleStepMinus = () => {
    const nextVal = Math.max(1, currentPartyNum - 1);
    setPartySize(nextVal.toString());
    setCombineError('');
  };

  const handleStepPlus = () => {
    const nextVal = currentPartyNum + 1;
    setPartySize(nextVal.toString());
    setCombineError('');
  };

  return (
    <div className="stitch-dashboard-container flex flex-col gap-4">

      {/* 1. TOP APP BAR */}
      <header className="stitch-header-bar">
        <div>
          <h2 className="stitch-header-title">The Gilded Bistro</h2>
          <p className="data-mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Waitlist & Smart Seating • Active Queue
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="stitch-stat-chip">
            <span className="dot res"></span>
            <span>Queue: <strong>{waitlistTotal} Waiting</strong></span>
          </div>

          <NotificationCenter />
          <button 
            onClick={() => fetchData()} 
            disabled={isRefreshing}
            className="btn-secondary" 
            style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.82rem', padding: '0.45rem 0.75rem' }}
            title="Refresh queue and seating recommendations"
          >
            <RotateCw size={14} className={isRefreshing ? 'spin-animation' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </header>

      {/* 2. BENTO GRID: WAITLIST (8 COLS) + SMART SEATING (4 COLS) */}
      <div style={{ padding: '0 0.5rem' }}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

          {/* LEFT: ACTIVE WAITLIST (8 COLS) */}
          <section className="lg:col-span-8 stitch-bento-panel" style={{ minHeight: '560px', display: 'flex', flexDirection: 'column' }}>
            
            {/* Panel Header */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 className="stitch-panel-title" style={{ margin: 0, fontSize: '0.98rem' }}>Active Waitlist</h3>
              </div>
              <span className="data-mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {waitlistTotal} {waitlistTotal === 1 ? 'Guest' : 'Guests'} Waiting
              </span>
            </div>

            {/* Waitlist Data Table */}
            <div style={{ flex: 1, overflowX: 'auto' }}>
              <table className="stitch-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Pos</th>
                    <th>Guest</th>
                    <th style={{ width: '80px' }}>Party</th>
                    <th style={{ width: '100px' }}>Wait Time</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right', width: '170px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlistEntries.map((entry, idx) => {
                    const pos = entry.position || idx + 1;
                    const availableForParty = tables.filter(t => !t.isOccupied && t.capacity >= entry.partySize);
                    const suggestedTable = availableForParty[0];

                    return (
                      <tr key={entry._id}>
                        {/* Pos */}
                        <td className="data-mono" style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>
                          #{pos}
                        </td>

                        {/* Guest */}
                        <td>
                          <div className="stitch-guest-name">{entry.customerName}</div>
                          <div className="stitch-guest-meta">{entry.contact}</div>
                        </td>

                        {/* Party */}
                        <td className="data-mono" style={{ fontWeight: 600 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Users size={12} style={{ color: 'var(--text-muted)' }} />
                            {entry.partySize}
                          </span>
                        </td>

                        {/* Wait Time */}
                        <td className="data-mono" style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>
                          {entry.waitingDurationMinutes ?? 0}m
                        </td>

                        {/* Status */}
                        <td>
                          {suggestedTable ? (
                            <span className="stitch-waitlist-status-ready">
                              ● Table T-{suggestedTable.number} ready
                            </span>
                          ) : availableForParty.length === 0 && tables.length > 0 ? (
                            <span className="stitch-waitlist-status-suggest">
                              Awaiting table
                            </span>
                          ) : (
                            <span className="stitch-waitlist-status-suggest">
                              In Queue
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button
                              onClick={() => openPromoteModal(entry)}
                              className="btn-primary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', backgroundColor: 'var(--status-free)', color: '#FFFFFF', whiteSpace: 'nowrap' }}
                              title="Seat guest at an available table"
                            >
                              Seat Guest
                            </button>
                            <button
                              onClick={() => deleteWaitlist(entry._id)}
                              className="btn-secondary"
                              style={{ padding: '0.35rem 0.55rem', color: 'var(--status-occupied)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                              title="Cancel waitlist entry"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {waitlistEntries.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                        <Clock size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
                        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Waitlist is currently empty
                        </p>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', maxWidth: '420px', margin: '0.35rem auto 1rem auto' }}>
                          Walk-in diners and high-demand party requests will appear here in chronological FIFO order.
                        </span>
                        <button
                          onClick={() => navigateToView('bookings')}
                          className="btn-secondary"
                          style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
                        >
                          View All Reservations →
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* RIGHT: SMART SEATING ASSISTANT (4 COLS) */}
          <section className="lg:col-span-4 stitch-bento-panel" style={{ minHeight: '560px', display: 'flex', flexDirection: 'column' }}>
            
            {/* Panel Header */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-tertiary)' }}>
              <GitMerge size={18} style={{ color: 'var(--accent-gold)' }} />
              <h3 className="stitch-panel-title" style={{ margin: 0, fontSize: '0.98rem' }}>Smart Seating Assistant</h3>
            </div>

            {/* Assistant Body */}
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
              
              <form onSubmit={handleCombine} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Party Size Stepper */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label className="stitch-kpi-label">Input Party Size</label>
                  <div className="stitch-stepper-box">
                    <button
                      type="button"
                      onClick={handleStepMinus}
                      disabled={currentPartyNum <= 1 || combining}
                      className="stitch-stepper-btn"
                      title="Decrease party size"
                    >
                      <Minus size={16} />
                    </button>
                    <div className="stitch-stepper-val">
                      {currentPartyNum}
                    </div>
                    <button
                      type="button"
                      onClick={handleStepPlus}
                      disabled={combining}
                      className="stitch-stepper-btn"
                      title="Increase party size"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Date & Time Settings */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="stitch-kpi-label" style={{ fontSize: '0.68rem' }}>Date</label>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={combineDate} 
                      onChange={(e) => {
                        setCombineDate(e.target.value);
                        setCombineError('');
                      }}
                      required
                      style={{ padding: '0.4rem 0.55rem', fontSize: '0.8rem' }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="stitch-kpi-label" style={{ fontSize: '0.68rem' }}>Start Time</label>
                    <input 
                      type="time" 
                      className="form-input" 
                      value={combineStart} 
                      onChange={(e) => handleCombineStartChange(e.target.value)}
                      required
                      style={{ padding: '0.4rem 0.55rem', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>

                {combineError && (
                  <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', color: '#fca5a5', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertTriangle size={14} style={{ color: '#f87171', flexShrink: 0 }} />
                    <span>{combineError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={combining}
                  className="btn-secondary"
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.82rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Sparkles size={14} className={combining ? 'spin-animation' : ''} />
                  <span>{combining ? 'Analyzing Layout...' : 'Find Recommendation'}</span>
                </button>
              </form>

              {/* Recommendation Card */}
              {combineResult && (
                <div className="stitch-rec-box">
                  <span className="stitch-kpi-label">Recommended Tables</span>
                  
                  <div className="stitch-rec-chips-row">
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {combineResult.tables.map((t, idx) => (
                        <React.Fragment key={t._id || idx}>
                          {idx > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>+</span>}
                          <div className="stitch-rec-table-chip">
                            <span style={{ color: 'var(--accent-gold)' }}>Table T-{t.number}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({t.capacity}s)</span>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Combined Capacity:</span>
                    <span className="data-mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {combineResult.totalCapacity} Seats
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Target Party Size:</span>
                    <span className="data-mono" style={{ fontWeight: 600, color: 'var(--accent-gold)' }}>
                      {combineResult.partySize} Guests
                    </span>
                  </div>
                </div>
              )}

              {/* Bottom Action: Assign Tables */}
              <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
                <button
                  onClick={() => {
                    navigateToView('floor');
                  }}
                  disabled={!combineResult}
                  className="btn-primary"
                  style={{ width: '100%', padding: '0.7rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                >
                  <CheckCircle2 size={16} />
                  <span>Assign Tables</span>
                </button>
              </div>

            </div>
          </section>

        </div>
      </div>

    </div>
  );
}
