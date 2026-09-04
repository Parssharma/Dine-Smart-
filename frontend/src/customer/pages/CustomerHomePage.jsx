import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, Sparkles, Clock, UtensilsCrossed, Calendar, Users, 
  ArrowRight, ShieldCheck, Star, Bell, Compass, Award, CheckCircle2,
  Layers, RefreshCw, UserCheck, History, LogIn, User
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config/api';

/**
 * Image mapper for real restaurant sections in the database
 */
const SECTION_IMAGES = {
  window: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIEw1X9ba1iIdoXl1H0EUFCaSm_WxoiY1JQXuIG_4woQ5nw1_bivKayisL5GNpkOBZ1kB-akMaFxp0In6HtMkS8WwJZkyJQ87uRhK5MiF-aFGX8xLDL36RIPxDvvfiy1zYIJdqm7GJUN6pPyY7Zr6QwXSyeLRcjKrALc67hveLtPy3iNshbcAHLVmVpatWoEzpbWOfEW0-a64_c-4mxN1GEqv8mcEZ48bUEAqNkOjYSMvs-jNcpvxQEg',
  outdoor: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCLg4ehQKUQ6uAMoZ8FJXjhZm54fWNfAGbr4Jy7oVpknbsTIBliJsw54mENgzPdvatYFT3TV0yvLGUJPIaJDqWHA2sLCsfOGdEm2rMkbfk0jkJ6r7Fcr5k2ph642trPGXGbik-qOame7FYWKPd4JvF1npdpBgokkMDSEaIRQ2GKJtbsjRjmrhrBSKBC-n54O55dEhDOTx5WN-cef8KNvvl85M7bDgqVaOVllwkcPbNAJTs66CIF6Vh_2g',
  center: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDEcd0HW_-iaDTbvu5zZkwLv_Z_IS7EeBPeUdQFrpIMi-HIWAbSgM7CJ86iPXZ6UfHPbp2VV7p1TNCkyBndMPOFwwedURNhRho6pP5JFZHTD00cWPqHe2bJaR4IC8Fa0kOGQXPuJHLLbjMXYl7M6CFIa5LBJFU7soO8bmGORiMzfrVVPbZt3DGJ6pv7uGY462A2i1Xn2w-nsqLcvi5pISyB_Rbe-TTAtqupdthBT0kixv7TmX-KyiZIYg',
  bar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBJviWy46riSc6PAp1GwTDUsIc0pPSZ7XsO-8erOKGkYrTAjlj1QAL0NW9BfQZRe5QYpqDD_XDQMU5ZC304ep8AvS7wKuhVnhCTnqhO6cUQ-HdH0IRSsrykWkzC3hedOY0NXgd46mWyyQOfPlzQDUkzeCMkNNtEAFCb3Y6sF-9FAqeJ5QIkR_Ys2VYbJd7wLMNb70JM4TSmJPPhld-SCdxmNiawCJ-NqjjSLpEAPCcFshUwUdNhe18dPA',
  default: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBJviWy46riSc6PAp1GwTDUsIc0pPSZ7XsO-8erOKGkYrTAjlj1QAL0NW9BfQZRe5QYpqDD_XDQMU5ZC304ep8AvS7wKuhVnhCTnqhO6cUQ-HdH0IRSsrykWkzC3hedOY0NXgd46mWyyQOfPlzQDUkzeCMkNNtEAFCb3Y6sF-9FAqeJ5QIkR_Ys2VYbJd7wLMNb70JM4TSmJPPhld-SCdxmNiawCJ-NqjjSLpEAPCcFshUwUdNhe18dPA'
};

/**
 * CustomerHomePage: Ultra-premium 3D-inspired Royal Landing Page for DineSmart.
 * Minimal luxury header, functional FIND TABLE routing, and verified customer portal integration.
 */
export default function CustomerHomePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isCustomer, openAuthModal } = useAuth();

  // Dynamic Date calculation
  const getTodayLocalStr = () => {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  };

  const todayStr = useMemo(() => getTodayLocalStr(), []);

  // Form states initialized dynamically
  const [quickDate, setQuickDate] = useState(todayStr);
  const [quickPartySize, setQuickPartySize] = useState('2');
  const [quickTime, setQuickTime] = useState(() => {
    const now = new Date();
    const currentHour = now.getHours();
    if (currentHour >= 12 && currentHour < 21) {
      const nextHour = String(currentHour + 1).padStart(2, '0');
      return `${nextHour}:00`;
    }
    return '19:00';
  });

  // Dynamic database table state
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(true);

  // Fetch real tables from database
  const fetchLiveTables = async () => {
    try {
      setLoadingTables(true);
      const res = await fetch(`${API_BASE}/tables`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTables(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch dynamic table data:', err);
    } finally {
      setLoadingTables(false);
    }
  };

  useEffect(() => {
    fetchLiveTables();
    // Poll live table state every 10 seconds for real-time floor accuracy
    const interval = setInterval(fetchLiveTables, 10000);
    return () => clearInterval(interval);
  }, []);

  // Compute dynamic live floor statistics from database
  const liveStats = useMemo(() => {
    const total = tables.length;
    const available = tables.filter(t => !t.isOccupied).length;
    const occupied = tables.filter(t => t.isOccupied).length;
    const totalSeats = tables.reduce((acc, t) => acc + (t.capacity || 0), 0);
    const availableSeats = tables.filter(t => !t.isOccupied).reduce((acc, t) => acc + (t.capacity || 0), 0);
    
    // Dynamic available party sizes based on table capacities in DB
    const distinctCapacities = Array.from(new Set(tables.map(t => t.capacity || 2))).sort((a, b) => a - b);

    return {
      total,
      available,
      occupied,
      totalSeats,
      availableSeats,
      distinctCapacities
    };
  }, [tables]);

  // Compute dynamic dining sections from distinct table locations in DB
  const dynamicSections = useMemo(() => {
    if (!tables.length) return [];

    const grouped = {};
    tables.forEach(table => {
      const loc = table.location || 'Main Dining';
      if (!grouped[loc]) {
        grouped[loc] = [];
      }
      grouped[loc].push(table);
    });

    return Object.entries(grouped).map(([locationName, sectionTables]) => {
      const count = sectionTables.length;
      const free = sectionTables.filter(t => !t.isOccupied).length;
      const maxCap = Math.max(...sectionTables.map(t => t.capacity || 2));
      const totalCap = sectionTables.reduce((acc, t) => acc + (t.capacity || 0), 0);
      const avgRating = (
        sectionTables.reduce((acc, t) => acc + (t.rating || 5), 0) / count
      ).toFixed(1);
      const occupancyRate = count > 0 ? Math.round(((count - free) / count) * 100) : 0;

      // Select image based on location name
      const lowerLoc = locationName.toLowerCase();
      let img = SECTION_IMAGES.default;
      if (lowerLoc.includes('window')) img = SECTION_IMAGES.window;
      else if (lowerLoc.includes('outdoor') || lowerLoc.includes('terrace') || lowerLoc.includes('garden')) img = SECTION_IMAGES.outdoor;
      else if (lowerLoc.includes('bar') || lowerLoc.includes('lounge') || lowerLoc.includes('counter')) img = SECTION_IMAGES.bar;
      else if (lowerLoc.includes('center') || lowerLoc.includes('hall') || lowerLoc.includes('main')) img = SECTION_IMAGES.center;

      return {
        name: locationName,
        tablesCount: count,
        availableCount: free,
        maxCapacity: maxCap,
        totalCapacity: totalCap,
        avgRating,
        occupancyRate,
        image: img
      };
    });
  }, [tables]);

  // Dynamic time slots generator (30-min intervals)
  const dynamicTimeSlots = useMemo(() => {
    const slots = [];
    for (let h = 12; h <= 22; h++) {
      const hStr = String(h).padStart(2, '0');
      slots.push(`${hStr}:00`);
      if (h < 22) slots.push(`${hStr}:30`);
    }
    return slots;
  }, []);

  // Handle Quick-Booking form submission: Passes selected Date + Guests + Time into the existing booking flow
  const handleQuickFindTable = (e) => {
    e.preventDefault();
    navigate(`/reserve?partySize=${quickPartySize}&date=${quickDate}&time=${quickTime}`);
  };

  const scrollToExperiences = (e) => {
    e.preventDefault();
    const el = document.getElementById('royal-experiences');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="royal-landing">
      {/* Dynamic Ambient Lighting Canvas */}
      <div className="royal-ambient-backdrop" />
      <div className="royal-noise-layer" />

      {/* =========================================================================
          HERO SECTION WITH LIVE DYNAMIC 3D DEPTH & REAL-TIME STATS
          ========================================================================= */}
      <section className="royal-hero-section">
        <div className="royal-hero-grid">
          
          {/* Left Column: Editorial Content & Dynamic Quick Booking */}
          <div className="royal-hero-content">
            
            {/* Live Synchronized Pill */}
            <div className="royal-brand-pill">
              <span className="royal-brand-pill-dot" />
              <span>
                {loadingTables 
                  ? 'Connecting to Seating System...' 
                  : `Real-Time Floor Active • ${liveStats.available} Tables Free`}
              </span>
            </div>

            <h1 className="royal-hero-title">
              Reserve Your <span>Perfect Table</span>
            </h1>

            <p className="royal-hero-subtitle">
              Intelligent table recommendation and algorithmic dining allocation. 
              Experience seamless reservations tailored dynamically to your party size and preferences.
            </p>

            <div className="royal-hero-actions">
              <Link to="/reserve" className="royal-btn-primary">
                <Search size={18} />
                <span>Reserve Your Table</span>
              </Link>
              
              <button onClick={scrollToExperiences} className="royal-btn-secondary">
                <Compass size={18} />
                <span>Explore Sections ({dynamicSections.length})</span>
              </button>
            </div>

            {/* Dynamic Floating Quick-Booking Bar */}
            <div className="royal-booking-bar-wrapper">
              <form onSubmit={handleQuickFindTable} className="royal-booking-bar">
                
                {/* Dynamic Date Selection */}
                <div className="royal-booking-field">
                  <label className="royal-booking-label">
                    <Calendar size={13} />
                    <span>Date</span>
                  </label>
                  <input
                    type="date"
                    value={quickDate}
                    onChange={(e) => setQuickDate(e.target.value)}
                    className="royal-booking-input"
                    min={todayStr}
                    required
                  />
                </div>

                {/* Dynamic Party Size Selector */}
                <div className="royal-booking-field">
                  <label className="royal-booking-label">
                    <Users size={13} />
                    <span>Guests</span>
                  </label>
                  <select
                    value={quickPartySize}
                    onChange={(e) => setQuickPartySize(e.target.value)}
                    className="royal-booking-input"
                  >
                    <option value="1">1 Guest</option>
                    <option value="2">2 Guests</option>
                    <option value="4">4 Guests</option>
                    <option value="6">6 Guests</option>
                    <option value="8">8 Guests (Combined)</option>
                    <option value="10">10+ Guests (Large Party)</option>
                  </select>
                </div>

                {/* Dynamic Time Slot Selector */}
                <div className="royal-booking-field">
                  <label className="royal-booking-label">
                    <Clock size={13} />
                    <span>Time</span>
                  </label>
                  <select
                    value={quickTime}
                    onChange={(e) => setQuickTime(e.target.value)}
                    className="royal-booking-input"
                  >
                    {dynamicTimeSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dynamic CTA: Submits Date + Guests + Time directly into existing booking flow */}
                <button type="submit" className="royal-btn-primary" style={{ padding: '0.75rem 1.4rem' }}>
                  <Search size={16} />
                  <span>Find Table</span>
                </button>

              </form>
            </div>
          </div>

          {/* Right Column: 3D Centerpiece Showcase with Dynamic Floating Badges */}
          <div className="royal-hero-showcase">
            
            {/* Top Floating Brass Chime Badge: Real Database Seat Capacity */}
            <div className="royal-floating-badge chime">
              <div className="royal-chime-icon-wrap">
                <UtensilsCrossed size={18} />
              </div>
              <div>
                <div className="royal-badge-text-primary">
                  {loadingTables ? 'Seating Assistant' : `${liveStats.totalSeats} Total Seats`}
                </div>
                <div className="royal-badge-text-sub">
                  {loadingTables ? 'Synchronizing...' : `${liveStats.total} Tables in Floor Plan`}
                </div>
              </div>
            </div>

            {/* 3D Elevated Card Canvas */}
            <div className="royal-hero-card-3d">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBJviWy46riSc6PAp1GwTDUsIc0pPSZ7XsO-8erOKGkYrTAjlj1QAL0NW9BfQZRe5QYpqDD_XDQMU5ZC304ep8AvS7wKuhVnhCTnqhO6cUQ-HdH0IRSsrykWkzC3hedOY0NXgd46mWyyQOfPlzQDUkzeCMkNNtEAFCb3Y6sF-9FAqeJ5QIkR_Ys2VYbJd7wLMNb70JM4TSmJPPhld-SCdxmNiawCJ-NqjjSLpEAPCcFshUwUdNhe18dPA"
                alt="Luxury DineSmart Table Setting"
                className="royal-hero-image"
              />
              <div className="royal-hero-image-overlay" />
            </div>

            {/* Bottom Floating Live Status Pill: Real Live Unoccupied Tables */}
            <div className="royal-floating-badge live-status">
              <div 
                className="royal-brand-pill-dot" 
                style={{ 
                  backgroundColor: liveStats.available > 0 ? '#10b981' : '#f59e0b',
                  boxShadow: `0 0 10px ${liveStats.available > 0 ? '#10b981' : '#f59e0b'}` 
                }} 
              />
              <div>
                <div className="royal-badge-text-primary">
                  {loadingTables 
                    ? 'Loading Floor State...' 
                    : liveStats.available > 0 
                      ? `${liveStats.available} Available Tables` 
                      : 'High Occupancy'}
                </div>
                <div className="royal-badge-text-sub">
                  {liveStats.availableSeats > 0 
                    ? `${liveStats.availableSeats} Open Seats Tonight` 
                    : 'Waitlist Queue Enabled'}
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          DYNAMIC RESTAURANT SECTIONS / VENUES SHOWCASE
          ========================================================================= */}
      <section id="royal-experiences" className="royal-experiences-section">
        <div className="royal-section-header">
          <div className="royal-section-tag">Real-Time Floor Layout</div>
          <h2 className="royal-section-title">Dining Sections & Environments</h2>
          <p className="royal-section-subtitle">
            Live dining zones configured in our real-time floor plan. Select your preferred atmosphere to reserve instantly.
          </p>
        </div>

        <div className="royal-experiences-grid">
          {dynamicSections.length > 0 ? (
            dynamicSections.map((sec) => (
              <div key={sec.name} className="royal-experience-card">
                <div className="royal-experience-card-media">
                  <img 
                    src={sec.image} 
                    alt={`${sec.name} Section`} 
                    className="royal-experience-img"
                  />
                  <div className="royal-experience-overlay" />
                  
                  {/* Dynamic Rating / Selection Badge */}
                  <div className="royal-card-badge selection">
                    <Star size={11} style={{ display: 'inline', marginRight: '3px' }} />
                    {sec.avgRating} ★ Rated
                  </div>

                  <div className="royal-card-badge">
                    {sec.tablesCount} {sec.tablesCount === 1 ? 'Table' : 'Tables'}
                  </div>
                </div>

                <div className="royal-experience-body">
                  <div>
                    <h3 className="royal-experience-title">{sec.name} Section</h3>
                    <p className="royal-experience-desc">
                      Max table capacity for up to {sec.maxCapacity} guests. 
                      Total {sec.totalCapacity} seats across {sec.tablesCount} configured tables.
                    </p>
                  </div>

                  <div className="royal-experience-footer">
                    <div className={`royal-capacity-pill ${sec.availableCount > 1 ? 'high' : sec.availableCount === 1 ? 'limited' : 'waitlist'}`}>
                      {sec.availableCount > 1 ? (
                        <>
                          <CheckCircle2 size={14} />
                          <span>{sec.availableCount} Tables Open</span>
                        </>
                      ) : sec.availableCount === 1 ? (
                        <>
                          <Clock size={14} />
                          <span>1 Table Left</span>
                        </>
                      ) : (
                        <>
                          <Clock size={14} />
                          <span>Waitlist Active</span>
                        </>
                      )}
                    </div>

                    <Link 
                      to={`/customer/reserve?preference=${encodeURIComponent(sec.name)}&partySize=${quickPartySize}&date=${quickDate}&time=${quickTime}`}
                      className="royal-experience-link"
                    >
                      <span>Reserve</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--royal-text-secondary)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 1rem' }} />
              <p>Fetching real-time dining sections from database...</p>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          SMART DINING OPERATIONS & TABLE UTILIZATION
          ========================================================================= */}
      <section className="royal-tech-section">
        <div className="royal-section-header" style={{ marginBottom: '3rem' }}>
          <div className="royal-section-tag">SMART DINING OPERATIONS</div>
          <h2 className="royal-section-title">Smarter Reservations. Better Table Utilization.</h2>
          <p className="royal-section-subtitle">
            DineSmart continuously coordinates reservations, table availability, and seating capacity to help restaurants serve guests efficiently while reducing unnecessary table downtime.
          </p>
        </div>

        <div className="royal-tech-grid">
          
          <div className="royal-tech-card">
            <div className="royal-tech-icon">
              <Sparkles size={20} />
            </div>
            <h3 className="royal-tech-title">Smart Table Matching</h3>
            <p className="royal-tech-desc">
              Match guests with the right table based on party size, availability, and seating preferences.
            </p>
          </div>

          <div className="royal-tech-card">
            <div className="royal-tech-icon">
              <Clock size={20} />
            </div>
            <h3 className="royal-tech-title">Live Table Availability</h3>
            <p className="royal-tech-desc">
              Keep table availability synchronized with reservations and in-house seating for accurate, real-time operations.
            </p>
          </div>

          <div className="royal-tech-card">
            <div className="royal-tech-icon">
              <Layers size={20} />
            </div>
            <h3 className="royal-tech-title">Flexible Seating</h3>
            <p className="royal-tech-desc">
              Handle larger parties intelligently by combining suitable tables while maintaining seating preferences.
            </p>
          </div>

        </div>
      </section>

      {/* =========================================================================
          LOWER PORTION: VERIFIED CUSTOMER PORTAL / GUEST ACTIONS
          ========================================================================= */}
      <section className="royal-member-section">
        <div className="royal-member-card">
          
          {isAuthenticated && isCustomer && user ? (
            <>
              {/* Authenticated & Verified Member Info */}
              <div className="royal-member-info">
                <div className="royal-member-badge">
                  <UserCheck size={14} />
                  <span>Verified Member Portal</span>
                </div>
                <h3 className="royal-member-title">
                  Welcome back, <span>{user.name || user.email || 'Valued Customer'}</span>
                </h3>
                <p className="royal-member-desc">
                  Manage your upcoming dining experiences, view reservation history, or reserve a table with priority intelligent allocation.
                </p>
              </div>

              {/* Lower Entry Points: Book a Table & My Booking History */}
              <div className="royal-member-actions">
                <Link to="/customer/reserve" className="royal-btn-primary">
                  <Search size={18} />
                  <span>Book a Table</span>
                </Link>

                <Link to="/customer/reservations" className="royal-btn-secondary">
                  <History size={18} />
                  <span>My Booking History</span>
                </Link>
              </div>
            </>
          ) : (
            <>
              {/* Guest Customer Info */}
              <div className="royal-member-info">
                <div className="royal-member-badge" style={{ backgroundColor: 'rgba(166, 124, 61, 0.1)', borderColor: 'var(--border-gold)', color: 'var(--accent-gold)' }}>
                  <Sparkles size={14} />
                  <span>Guest & Member Experience</span>
                </div>
                <h3 className="royal-member-title">
                  Ready to Experience <span>DineSmart</span>?
                </h3>
                <p className="royal-member-desc">
                  Reserve your table instantly or sign in to track your personal reservations, view dining history, and manage preferences.
                </p>
              </div>

              {/* Guest Entry Points: Book a Table & Sign In */}
              <div className="royal-member-actions">
                <Link to="/customer/reserve" className="royal-btn-primary">
                  <Search size={18} />
                  <span>Book a Table</span>
                </Link>

                <button onClick={() => openAuthModal('login')} className="royal-btn-secondary" style={{ cursor: 'pointer' }}>
                  <LogIn size={18} />
                  <span>Sign In</span>
                </button>
              </div>
            </>
          )}

        </div>
      </section>

      {/* =========================================================================
          ROYAL EDITORIAL FOOTER
          ========================================================================= */}
      <footer className="royal-footer">
        <div className="royal-footer-inner">
          <Link to="/customer" className="royal-footer-brand">
            <UtensilsCrossed size={22} />
            <span>DineSmart</span>
          </Link>

          <div className="royal-footer-links">
            <Link to="/customer/reserve" className="royal-footer-link">Find a Table</Link>
            {isAuthenticated && isCustomer ? (
              <Link to="/customer/reservations" className="royal-footer-link">My Reservations</Link>
            ) : (
              <button onClick={() => openAuthModal('login')} className="royal-footer-link" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>Customer Sign In</button>
            )}
            <a href="#royal-experiences" onClick={scrollToExperiences} className="royal-footer-link">Floor Sections</a>
          </div>

          <div className="royal-footer-copy">
            © {new Date().getFullYear()} DineSmart Hospitality. Live System Connected.
          </div>
        </div>
      </footer>

    </div>
  );
}
