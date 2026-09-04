import React, { useState } from 'react';
import { 
  CheckCircle2, AlertTriangle, Info, X, Users, RotateCw, 
  ArrowRight, UserCheck, Clock, Check, Eye
} from 'lucide-react';
import NotificationCenter from '../../components/NotificationCenter';

/**
 * DashboardView (Phase UI-1 — Google Stitch Design Reference)
 * 
 * Implements the Stitch Bento-grid layout with:
 * 1. Top status header with formatted date and open indicator
 * 2. Subtle dismissible operational alert banner
 * 3. 5 Compact KPI cards (Total Tables, Available, Occupied % cap, Upcoming Res, Waitlist)
 * 4. Live Operations Bento layout (Active Tables table + Next Arrivals queue)
 */
export default function DashboardView({
  operations,
  tables,
  bookings,
  waitlist,
  currentTime,
  isRefreshing,
  fetchData,
  completeBooking,
  checkInBooking,
  seatBooking,
  markNoShow,
  cancelBooking,
  viewAuditTrail,
  openPromoteModal,
  navigateToView,
  setActiveTableDetail
}) {
  const [alertDismissed, setAlertDismissed] = useState(false);

  // Derived metrics
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

  // Capacity calculation
  const totalCapacity = tables.reduce((acc, t) => acc + (t.capacity || 0), 0);
  const occupiedCapacity = seatedList.reduce((acc, s) => acc + (s.partySize || 0), 0);
  const capPercent = totalCapacity > 0 ? Math.round((occupiedCapacity / totalCapacity) * 100) : (totalTableCount > 0 ? Math.round((occupiedTableCount / totalTableCount) * 100) : 0);

  // Format active operational banner alert
  const activeAlert = alertsList.length > 0 ? alertsList[0] : null;

  // Format current date matching Stitch reference (e.g. "Oct 24, 2023" or live formatted)
  const formattedDate = currentTime.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="stitch-dashboard-container flex flex-col gap-4">

      {/* 1. STITCH TOP APP BAR */}
      <header className="stitch-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h2 className="stitch-header-title">The Gilded Bistro</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.2rem' }}>
              <span className="stitch-status-pill open">
                <span className="dot"></span> Open
              </span>
              <span className="data-mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {formattedDate} • {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <NotificationCenter />
          <button 
            onClick={() => fetchData()} 
            disabled={isRefreshing}
            className="btn-secondary" 
            style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.82rem', padding: '0.45rem 0.75rem' }}
            title="Refresh operational data"
          >
            <RotateCw size={14} className={isRefreshing ? 'spin-animation' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </header>

      {/* 2. SUBTLE OPERATIONAL NOTIFICATION BANNER */}
      {activeAlert && !alertDismissed && (
        <div className={`stitch-alert-banner ${activeAlert.severity || 'info'}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {activeAlert.severity === 'warning' ? (
              <AlertTriangle size={17} style={{ color: '#f59e0b' }} />
            ) : activeAlert.severity === 'success' ? (
              <CheckCircle2 size={17} style={{ color: 'var(--status-free)' }} />
            ) : (
              <Info size={17} style={{ color: '#60a5fa' }} />
            )}
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
              {activeAlert.message}
            </span>
            {(activeAlert.type === 'WAITLIST' || activeAlert.message?.toLowerCase().includes('waitlist')) && (
              <button
                onClick={() => {
                  const entry = (operations.waitlist?.entries?.[0] || waitlist[0]);
                  if (entry) openPromoteModal(entry);
                  else navigateToView('waitlist');
                }}
                className="btn-primary"
                style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem', marginLeft: '0.5rem', backgroundColor: 'var(--status-free)', color: '#FFFFFF' }}
              >
                Seat Guest
              </button>
            )}
          </div>
          <button 
            onClick={() => setAlertDismissed(true)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Dismiss notice"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div style={{ padding: '0.75rem 0.25rem 2rem 0.25rem' }}>

        {/* 3. 5-CARD KPI GRID */}
        <section className="stitch-kpi-grid">
          {/* Card 1: Total Tables */}
          <div className="stitch-kpi-card">
            <span className="stitch-kpi-label">Total Tables</span>
            <div className="stitch-kpi-value-row">
              <span className="stitch-kpi-value">{totalTableCount}</span>
            </div>
          </div>

          {/* Card 2: Available */}
          <div className="stitch-kpi-card">
            <span className="stitch-kpi-label" style={{ color: 'var(--status-free)' }}>Available</span>
            <div className="stitch-kpi-value-row">
              <span className="stitch-kpi-value" style={{ color: 'var(--status-free)' }}>{availableTableCount}</span>
            </div>
          </div>

          {/* Card 3: Occupied */}
          <div className="stitch-kpi-card">
            <span className="stitch-kpi-label" style={{ color: 'var(--status-occupied)' }}>Occupied</span>
            <div className="stitch-kpi-value-row">
              <span className="stitch-kpi-value">{occupiedTableCount}</span>
              <span className="stitch-kpi-subtext">{capPercent}% cap</span>
            </div>
          </div>

          {/* Card 4: Upcoming Res */}
          <div className="stitch-kpi-card">
            <span className="stitch-kpi-label" style={{ color: '#60a5fa' }}>Upcoming Res</span>
            <div className="stitch-kpi-value-row">
              <span className="stitch-kpi-value">{upcomingList.length}</span>
              <span className="stitch-kpi-subtext" style={{ fontSize: '0.72rem' }}>Next 2h</span>
            </div>
          </div>

          {/* Card 5: Waitlist (Interactive) */}
          <div 
            className="stitch-kpi-card interactive"
            onClick={() => navigateToView('waitlist')}
            title="Click to manage Waitlist"
          >
            <span className="stitch-kpi-label" style={{ color: 'var(--status-waitlist)' }}>Waitlist</span>
            <div className="stitch-kpi-value-row">
              <span className="stitch-kpi-value" style={{ color: 'var(--status-waitlist)' }}>{waitingCount}</span>
              <span className="stitch-kpi-subtext" style={{ fontSize: '0.72rem' }}>
                {waitingCount > 0 ? `~${waitingCount * 10}m` : '0m'}
              </span>
            </div>
          </div>
        </section>

        {/* 4. LIVE OPERATIONS BENTO GRID */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 className="geist-font" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Live Operations
            </h3>
          </div>

          <div className="stitch-bento-grid">

            {/* LEFT BENTO PANEL: ACTIVE TABLES TABLE (Spans 2 cols on wide screens) */}
            <div className="stitch-bento-panel">
              <div className="stitch-panel-header">
                <span className="stitch-panel-title">Active Tables</span>
                <button 
                  onClick={() => navigateToView('floor')}
                  className="stitch-panel-action"
                  title="Open Interactive Floor Plan"
                >
                  <span>View Map</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="stitch-table-wrapper">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Table</th>
                      <th>Status</th>
                      <th>Party</th>
                      <th>Time Sat</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayTables.map(table => {
                      const status = table.operationalStatus || (table.isOccupied ? 'OCCUPIED' : 'AVAILABLE');
                      const seatedMatch = seatedList.find(s => (s.tableId?._id === table._id || s.tableId === table._id || s.table?._id === table._id));
                      const partyText = seatedMatch 
                        ? `${seatedMatch.customerName} (${seatedMatch.partySize})` 
                        : (table.nextReservation ? `${table.nextReservation.customerName} (${table.nextReservation.partySize})` : '-');
                      const durationText = seatedMatch?.durationMinutes ? `${seatedMatch.durationMinutes}m` : (table.nextReservation ? `@ ${table.nextReservation.startTime}` : '-');

                      return (
                        <tr key={table._id} className="group">
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            T-{table.number}
                          </td>
                          <td>
                            <span className={`stitch-badge ${status.toLowerCase()}`}>
                              {status}
                            </span>
                          </td>
                          <td style={{ color: seatedMatch ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {partyText}
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>
                            {durationText}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                              {status === 'OCCUPIED' && seatedMatch && (
                                <button
                                  onClick={() => completeBooking(seatedMatch._id)}
                                  className="btn-secondary"
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', color: 'var(--status-free)' }}
                                  title="Free table & complete dining"
                                >
                                  Complete
                                </button>
                              )}
                              <button
                                onClick={() => setActiveTableDetail(table)}
                                className="btn-secondary"
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.72rem' }}
                                title="Inspect table details"
                              >
                                <Eye size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {displayTables.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                          No tables configured in the restaurant layout.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RIGHT BENTO PANEL: NEXT ARRIVALS QUEUE (1 col) */}
            <div className="stitch-bento-panel">
              <div className="stitch-panel-header">
                <span className="stitch-panel-title">Next Arrivals</span>
                <button 
                  onClick={() => navigateToView('bookings')}
                  className="stitch-panel-action"
                  title="View All Reservations"
                >
                  <span>All Bookings</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="stitch-arrivals-list">
                {upcomingList.slice(0, 6).map(res => (
                  <div key={res._id} className="stitch-arrival-item">
                    <div>
                      <div className="stitch-guest-name">{res.customerName}</div>
                      <div className="stitch-guest-meta">
                        {res.partySize} guests • {res.table?.number ? `T-${res.table.number}` : 'Unassigned'}
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.3rem' }}>
                        {res.status === 'Confirmed' && (
                          <button
                            onClick={() => checkInBooking(res._id)}
                            className="btn-secondary"
                            style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem', color: '#3b82f6', borderColor: 'rgba(59,130,246,0.3)' }}
                          >
                            Check In
                          </button>
                        )}
                        <button
                          onClick={() => seatBooking(res._id)}
                          className="btn-secondary"
                          style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem', color: 'var(--status-free)', borderColor: 'rgba(16,185,129,0.3)' }}
                        >
                          Seat
                        </button>
                        <button
                          onClick={() => viewAuditTrail(res)}
                          className="btn-secondary"
                          style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}
                          title="Audit Trail"
                        >
                          <Clock size={11} />
                        </button>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="stitch-arrival-time">{res.startTime}</div>
                      <div className="stitch-arrival-countdown">
                        {res.startsInMinutes !== undefined ? `In ${res.startsInMinutes}m` : res.bookingDate}
                      </div>
                    </div>
                  </div>
                ))}

                {upcomingList.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <Check size={24} style={{ color: 'var(--status-free)', margin: '0 auto 0.4rem auto' }} />
                    No upcoming reservations scheduled for today.
                  </div>
                )}

                {upcomingList.length > 0 && (
                  <button 
                    onClick={() => navigateToView('bookings')}
                    className="btn-secondary" 
                    style={{ width: '100%', marginTop: 'auto', padding: '0.45rem', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}
                  >
                    View Full List ({upcomingList.length})
                  </button>
                )}
              </div>
            </div>

          </div>
        </section>

      </div>

    </div>
  );
}
