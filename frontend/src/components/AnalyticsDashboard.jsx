import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Calendar, Clock, Download, RefreshCw, Users, CheckCircle2, 
  AlertTriangle, XCircle, Utensils, Sparkles, TrendingUp, Filter,
  Layers, ArrowUpRight, ShieldCheck, Flame, GitMerge, Search
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_BASE = 'http://localhost:5000/api';

export default function AnalyticsDashboard() {
  const { getAuthHeaders } = useAuth();

  // Preset Filters: 'today' | '7days' | '30days' | 'thisMonth' | 'custom'
  const [preset, setPreset] = useState('30days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [overview, setOverview] = useState(null);
  const [bookingTrends, setBookingTrends] = useState(null);
  const [tablePerformance, setTablePerformance] = useState(null);
  const [peakHours, setPeakHours] = useState(null);
  const [waitlistData, setWaitlistData] = useState(null);
  const [dsaData, setDsaData] = useState(null);

  // Table Search & Sort in Table Performance
  const [tableSearch, setTableSearch] = useState('');

  // Initialize dates based on preset
  const toLocalDateString = (d) => {
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  };

  const applyPreset = (selectedPreset) => {
    setPreset(selectedPreset);
    const today = new Date();
    const todayStr = toLocalDateString(today);

    if (selectedPreset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (selectedPreset === '7days') {
      const past7 = new Date(today);
      past7.setDate(today.getDate() - 7);
      setStartDate(toLocalDateString(past7));
      setEndDate(todayStr);
    } else if (selectedPreset === '30days') {
      const past30 = new Date(today);
      past30.setDate(today.getDate() - 30);
      setStartDate(toLocalDateString(past30));
      setEndDate(todayStr);
    } else if (selectedPreset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(toLocalDateString(firstDay));
      setEndDate(todayStr);
    }
  };

  useEffect(() => {
    applyPreset('30days');
  }, []);

  // Fetch Analytics Data
  const fetchAnalytics = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMsg('');

    try {
      let query = '';
      if (startDate && endDate) {
        query = `?startDate=${startDate}&endDate=${endDate}`;
      } else if (startDate) {
        query = `?startDate=${startDate}`;
      } else if (endDate) {
        query = `?endDate=${endDate}`;
      }

      const headers = getAuthHeaders();

      const [ovRes, bkRes, tbRes, pkRes, wlRes, dsRes] = await Promise.all([
        fetch(`${API_BASE}/analytics/overview${query}`, { headers }),
        fetch(`${API_BASE}/analytics/bookings${query}`, { headers }),
        fetch(`${API_BASE}/analytics/tables${query}`, { headers }),
        fetch(`${API_BASE}/analytics/peak-hours${query}`, { headers }),
        fetch(`${API_BASE}/analytics/waitlist${query}`, { headers }),
        fetch(`${API_BASE}/analytics/dsa${query}`, { headers })
      ]);

      if (!ovRes.ok || !bkRes.ok || !tbRes.ok || !pkRes.ok || !wlRes.ok || !dsRes.ok) {
        throw new Error('Failed to load complete analytics dataset.');
      }

      const ovData = await ovRes.json();
      const bkData = await bkRes.json();
      const tbData = await tbRes.json();
      const pkData = await pkRes.json();
      const wlData = await wlRes.json();
      const dsData = await dsRes.json();

      setOverview(ovData.data);
      setBookingTrends(bkData.data);
      setTablePerformance(tbData.data);
      setPeakHours(pkData.data);
      setWaitlistData(wlData.data);
      setDsaData(dsData.data);
    } catch (err) {
      setErrorMsg(err.message || 'Unable to load analytics. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchAnalytics();
    }
  }, [startDate, endDate]);

  // Export CSV Report
  const handleExportCSV = () => {
    let query = '';
    if (startDate && endDate) {
      query = `?startDate=${startDate}&endDate=${endDate}`;
    }
    const token = localStorage.getItem('dinesmart_token') || localStorage.getItem('token');
    
    fetch(`${API_BASE}/analytics/export/csv${query}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Export failed');
        return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dinesmart-analytics-${startDate || 'all'}-to-${endDate || 'present'}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(err => alert(err.message));
  };

  const filteredTables = (tablePerformance?.tables || []).filter(t => {
    if (!tableSearch) return true;
    const q = tableSearch.toLowerCase();
    return (
      t.number.toString().toLowerCase().includes(q) ||
      t.location.toLowerCase().includes(q)
    );
  });

  return (
    <div className="analytics-view" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Banner & Date Filter Bar */}
      <div className="panel-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <BarChart3 size={22} style={{ color: 'var(--accent-gold)' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, fontFamily: 'Geist, sans-serif' }}>
              Analytics & Performance Telemetry
            </h3>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
            Real-time operational insights and metrics derived from live service bookings.
          </span>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          
          {/* Preset Buttons */}
          <div className="stitch-filter-group">
            {[
              { key: 'today', label: 'Today' },
              { key: '7days', label: '7 Days' },
              { key: '30days', label: '30 Days' },
              { key: 'thisMonth', label: 'This Month' },
              { key: 'custom', label: 'Custom' }
            ].map(p => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={`stitch-filter-btn ${preset === p.key ? 'active' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers if custom selected */}
          {preset === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', width: '135px' }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', width: '135px' }}
              />
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing || loading}
            className="stitch-action-btn secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
            title="Refresh Analytics Dataset"
          >
            <RefreshCw size={13} className={refreshing ? 'spinning' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* CSV Export Button */}
          <button
            onClick={handleExportCSV}
            className="stitch-action-btn primary"
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
            title="Export CSV Report"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="alert-banner" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--status-occupied)' }}>
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="spinning" style={{ color: 'var(--accent-gold)', margin: '0 auto 1rem auto' }} />
          <p style={{ fontSize: '1rem', fontWeight: 500 }}>Aggregating restaurant intelligence & telemetry...</p>
        </div>
      ) : overview ? (
        <>
          {/* ==========================================
             1. CORE KPI CARDS GRID (STITCH BENTO KPI)
             ========================================== */}
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            
            {/* Total Bookings */}
            <div className="stitch-kpi-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stitch-kpi-label" style={{ textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em' }}>Total Bookings</span>
                <Calendar size={16} style={{ color: 'var(--accent-gold)' }} />
              </div>
              <div style={{ fontFamily: 'Geist, monospace', fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                {overview.totalBookings}
              </div>
            </div>

            {/* Completed Rate */}
            <div className="stitch-kpi-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stitch-kpi-label" style={{ textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em' }}>Completion Rate</span>
                <CheckCircle2 size={16} style={{ color: 'var(--status-free)' }} />
              </div>
              <div style={{ fontFamily: 'Geist, monospace', fontSize: '2rem', fontWeight: 700, color: 'var(--status-free)', lineHeight: 1 }}>
                {overview.completionRate}%
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{overview.completedBookings} Completed</span>
            </div>

            {/* Cancellation Rate */}
            <div className="stitch-kpi-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stitch-kpi-label" style={{ textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em' }}>Cancellation Rate</span>
                <XCircle size={16} style={{ color: 'var(--status-occupied)' }} />
              </div>
              <div style={{ fontFamily: 'Geist, monospace', fontSize: '2rem', fontWeight: 700, color: 'var(--status-occupied)', lineHeight: 1 }}>
                {overview.cancellationRate}%
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{overview.cancelledBookings} Cancelled</span>
            </div>

            {/* No-Show Rate */}
            <div className="stitch-kpi-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stitch-kpi-label" style={{ textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em' }}>No-Show Rate</span>
                <AlertTriangle size={16} style={{ color: 'var(--status-waitlist)' }} />
              </div>
              <div style={{ fontFamily: 'Geist, monospace', fontSize: '2rem', fontWeight: 700, color: 'var(--status-waitlist)', lineHeight: 1 }}>
                {overview.noShowRate}%
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{overview.noShowBookings} No-Shows</span>
            </div>

            {/* Average Dining Duration */}
            <div className="stitch-kpi-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stitch-kpi-label" style={{ textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em' }}>Avg Dining Time</span>
                <Clock size={16} style={{ color: '#a78bfa' }} />
              </div>
              <div style={{ fontFamily: 'Geist, monospace', fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                {overview.averageDiningDurationMinutes !== null ? `${overview.averageDiningDurationMinutes}m` : 'N/A'}
              </div>
            </div>

            {/* Average Party Size */}
            <div className="stitch-kpi-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stitch-kpi-label" style={{ textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em' }}>Avg Party Size</span>
                <Users size={16} style={{ color: '#60a5fa' }} />
              </div>
              <div style={{ fontFamily: 'Geist, monospace', fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                {overview.averagePartySize}
              </div>
            </div>

            {/* Table Utilization */}
            <div className="stitch-kpi-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stitch-kpi-label" style={{ textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em' }}>Table Utilization</span>
                <Utensils size={16} style={{ color: 'var(--status-free)' }} />
              </div>
              <div style={{ fontFamily: 'Geist, monospace', fontSize: '2rem', fontWeight: 700, color: 'var(--status-free)', lineHeight: 1 }}>
                {overview.tableUtilization}%
              </div>
            </div>

            {/* Waitlist Conversion */}
            <div className="stitch-kpi-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stitch-kpi-label" style={{ textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em' }}>Waitlist Seating</span>
                <TrendingUp size={16} style={{ color: 'var(--accent-gold)' }} />
              </div>
              <div style={{ fontFamily: 'Geist, monospace', fontSize: '2rem', fontWeight: 700, color: 'var(--accent-gold)', lineHeight: 1 }}>
                {overview.waitlist?.conversionRate}%
              </div>
            </div>
          </div>

          {/* ==========================================
             2. BOOKING TRENDS & STATUS BREAKDOWN
             ========================================== */}
          <div className="grid-layout" style={{ gridTemplateColumns: '1.4fr 0.9fr', gap: '1.5rem' }}>
            
            {/* Booking Trends Chart */}
            <div className="panel-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrendingUp size={20} style={{ color: 'var(--accent-gold)' }} />
                  <h3 className="panel-title" style={{ margin: 0 }}>Daily Booking Volume</h3>
                </div>
                {overview.busiestDay && (
                  <span style={{ fontSize: '0.78rem', backgroundColor: 'var(--accent-gold-glow)', color: 'var(--accent-gold)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                    Peak Day: {overview.busiestDay.date} ({overview.busiestDay.count} bookings)
                  </span>
                )}
              </div>

              {bookingTrends && Object.keys(bookingTrends.trends).length > 0 ? (() => {
                const trendEntries = Object.entries(bookingTrends.trends);
                const maxCount = Math.max(...trendEntries.map(([, c]) => c), 1);

                return (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '180px', paddingTop: '1.5rem', paddingBottom: '0.5rem', overflowX: 'auto' }}>
                    {trendEntries.map(([dStr, count]) => {
                      const barHeight = Math.max(12, Math.round((count / maxCount) * 130));
                      const label = dStr.substring(5); // MM-DD

                      return (
                        <div key={dStr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '32px' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', fontWeight: 700, marginBottom: '4px' }}>
                            {count}
                          </span>
                          <div 
                            style={{ 
                              width: '100%', 
                              height: `${barHeight}px`, 
                              backgroundColor: 'var(--accent-gold)', 
                              borderRadius: '4px 4px 0 0',
                              opacity: count === maxCount ? 1 : 0.75,
                              transition: 'height 0.3s ease'
                            }} 
                            title={`${dStr}: ${count} reservations`}
                          />
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px', whiteSpace: 'nowrap' }}>
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })() : (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                  No booking volume records in selected range.
                </div>
              )}
            </div>

            {/* Status Distribution */}
            <div className="panel-card">
              <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Layers size={20} style={{ color: 'var(--accent-gold)' }} />
                Status Distribution
              </h3>

              {bookingTrends && bookingTrends.statusDistribution ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {bookingTrends.statusDistribution.map(st => {
                    let color = 'var(--status-free)';
                    if (st.status === 'Checked In') color = '#3b82f6';
                    else if (st.status === 'Seated') color = 'var(--accent-gold)';
                    else if (st.status === 'Cancelled') color = 'var(--status-occupied)';
                    else if (st.status === 'No Show') color = 'var(--status-waitlist)';
                    else if (st.status === 'Confirmed') color = '#93c5fd';

                    return (
                      <div key={st.status}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 600 }}>{st.status}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{st.count} ({st.percentage}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '7px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                          <div style={{ width: `${st.percentage}%`, height: '100%', backgroundColor: color, borderRadius: 'var(--radius-full)', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          {/* ==========================================
             3. PEAK HOURS & WAITLIST CONVERSION
             ========================================== */}
          <div className="grid-layout" style={{ gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem' }}>
            
            {/* Peak Hours Demand Chart */}
            <div className="panel-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Flame size={20} style={{ color: '#ef4444' }} />
                  <h3 className="panel-title" style={{ margin: 0 }}>Peak Dining Hours</h3>
                </div>
                {peakHours?.peakHour && (
                  <span style={{ fontSize: '0.78rem', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                    Rush: {peakHours.peakHour.label} ({peakHours.peakHour.count} parties)
                  </span>
                )}
              </div>

              {peakHours && peakHours.hourlyDistribution ? (() => {
                // Focus on operating hours: 11 AM to 11 PM (hours 11 to 23)
                const operatingHours = peakHours.hourlyDistribution.filter(h => h.hour >= 11 && h.hour <= 23);
                const maxHCount = Math.max(...operatingHours.map(h => h.count), 1);

                return (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', height: '160px', paddingTop: '1.5rem', paddingBottom: '0.5rem', overflowX: 'auto' }}>
                    {operatingHours.map(h => {
                      const barH = Math.max(8, Math.round((h.count / maxHCount) * 110));
                      const isPeak = peakHours.peakHour && peakHours.peakHour.hour === h.hour && h.count > 0;

                      return (
                        <div key={h.hour} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '28px' }}>
                          <span style={{ fontSize: '0.7rem', color: isPeak ? '#ef4444' : 'var(--text-secondary)', fontWeight: isPeak ? 700 : 500, marginBottom: '4px' }}>
                            {h.count}
                          </span>
                          <div 
                            style={{ 
                              width: '100%', 
                              height: `${barH}px`, 
                              backgroundColor: isPeak ? '#ef4444' : '#3b82f6', 
                              borderRadius: '3px 3px 0 0',
                              opacity: h.count > 0 ? 0.9 : 0.2
                            }} 
                            title={`${h.label}: ${h.count} guests`}
                          />
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '6px', whiteSpace: 'nowrap' }}>
                            {h.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })() : null}
            </div>

            {/* Waitlist Intelligence Card */}
            <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Clock size={20} style={{ color: 'var(--status-waitlist)' }} />
                  <h3 className="panel-title" style={{ margin: 0 }}>Waiting List Metrics</h3>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Real-time waiting list conversion tracking
                </span>

                <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Current Active Queue:</span>
                    <strong>{waitlistData?.currentQueueCount ?? 0} parties</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Promoted to Tables:</span>
                    <strong style={{ color: 'var(--status-free)' }}>{waitlistData?.promotedCount ?? 0} parties</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Average Wait Duration:</span>
                    <strong>{waitlistData?.averageWaitDurationMinutes ?? 0} min</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Conversion Success Rate:</span>
                    <strong style={{ color: 'var(--accent-gold)' }}>{waitlistData?.conversionRate ?? 0}%</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ==========================================
             4. SMART BOOKING ENGINE INTELLIGENCE PANEL
             ========================================== */}
          <div className="panel-card" style={{ border: '1px solid var(--border-gold)', backgroundColor: 'rgba(217,119,6,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Sparkles size={22} style={{ color: 'var(--accent-gold)' }} />
                <div>
                  <h3 className="panel-title" style={{ margin: 0 }}>
                    Smart Booking System Telemetry
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Live performance telemetry for Smart Table Recommendations, Smart Seating Assistant, and Table Search.
                  </span>
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--status-free-glow)', color: 'var(--status-free)', fontWeight: 600 }}>
                ● Booking Optimization Active
              </span>
            </div>

            {dsaData ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                
                {/* Priority Queue Module */}
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Table Recommendations
                  </div>
                  <h4 style={{ fontSize: '1.4rem', margin: '0.35rem 0 0.2rem 0' }}>
                    {dsaData.recommendations?.totalRequests ?? 0}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Smart Table Recommendations • {dsaData.recommendations?.successRate ?? 100}% Success
                  </span>
                </div>

                {/* Backtracking Combiner Module */}
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Smart Seating Assistant
                  </div>
                  <h4 style={{ fontSize: '1.4rem', margin: '0.35rem 0 0.2rem 0' }}>
                    {dsaData.combinations?.totalRequests ?? 0}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Smart Seating Combinations • {dsaData.combinations?.successRate ?? 100}% Success (Avg {dsaData.combinations?.averageTablesUsed ?? 0} tables)
                  </span>
                </div>

                {/* HashMap Lookup Module */}
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Table Search
                  </div>
                  <h4 style={{ fontSize: '1.4rem', margin: '0.35rem 0 0.2rem 0' }}>
                    {dsaData.lookups?.totalRequests ?? 0}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Instant Table Searches executed
                  </span>
                </div>

                {/* Total Operations */}
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Optimization Operations
                  </div>
                  <h4 style={{ fontSize: '1.4rem', margin: '0.35rem 0 0.2rem 0' }}>
                    {dsaData.totalOperations ?? 0}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Total smart operations executed
                  </span>
                </div>

              </div>
            ) : null}
          </div>

          {/* ==========================================
             5. TABLE PERFORMANCE & UTILIZATION MATRIX
             ========================================== */}
          <div className="panel-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <Utensils size={20} className="logo-icon" />
                  Table Performance & Utilization Matrix
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Per-table booking frequency, completion rate, and capacity efficiency.
                </span>
              </div>

              {/* Search Filter */}
              <div style={{ width: '220px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Filter by table or location..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem' }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Table</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Seats</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Zone</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Rating</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Total Bookings</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Completed</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Cancelled</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Relative Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTables.map(t => (
                    <tr key={t.tableId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>
                        Table T-{t.number}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{t.capacity} seats</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{t.location}</td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--accent-gold)' }}>★ {t.rating}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700 }}>{t.totalBookings}</td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--status-free)' }}>{t.completedCount}</td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--status-occupied)' }}>{t.cancelledCount}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{t.utilizationPercentage}%</span>
                          <div style={{ width: '60px', height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                            <div style={{ width: `${t.utilizationPercentage}%`, height: '100%', backgroundColor: 'var(--accent-gold)' }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredTables.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                  No table performance records found.
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          No analytics data available for the selected period.
        </div>
      )}

    </div>
  );
}
