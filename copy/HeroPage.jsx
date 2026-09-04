import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ChefHat, 
  Calendar, 
  LayoutDashboard, 
  Cpu, 
  Users, 
  Map, 
  Clock, 
  ArrowRight, 
  ChevronRight, 
  CheckCircle2,
  Sparkles,
  Layers,
  Zap
} from 'lucide-react';
import './HeroPage.css';

// Custom Hook for Count Up Animation
const useCountUp = (end, duration = 2000, startOnView = false) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const elementRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setHasStarted(true);
      },
      { threshold: 0.1 }
    );

    if (elementRef.current) observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasStarted) return;

    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [hasStarted, end, duration]);

  return { count, elementRef };
};

// Intersection Observer for Fade-In animations
const useScrollReveal = () => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => setIsVisible(entry.isIntersecting));
    });
    observer.observe(domRef.current);
    return () => observer.disconnect();
  }, []);

  return [domRef, isVisible];
};

const HeroPage = () => {
  const navigate = useNavigate();

  // Stats Logic
  const tablesStat = useCountUp(500);
  const reservationsStat = useCountUp(10000);
  const responseStat = useCountUp(50);

  return (
    <div className="ds-page-wrapper">
      {/* SECTION 1: HERO */}
      <section className="ds-hero">
        <div className="ds-hero-bg-elements">
          <div className="ds-floating-circle ds-c1"></div>
          <div className="ds-floating-circle ds-c2"></div>
          <div className="ds-floating-circle ds-c3"></div>
          <div className="ds-grid-pattern"></div>
        </div>

        <nav className="ds-nav">
          <div className="ds-logo">
            <ChefHat size={32} color="var(--accent-gold)" strokeWidth={1.5} />
            <span>DineSmart</span>
          </div>
          <div className="ds-nav-links">
            <a href="#features">Solutions</a>
            <a href="#how-it-works">Technology</a>
            <button className="ds-btn-ghost" onClick={() => navigate('/customer/login')}>Login</button>
            <button className="ds-btn-primary" onClick={() => navigate('/customer/register')}>Get Started</button>
          </div>
        </nav>

        <div className="ds-hero-content">
          <div className="ds-badge-reveal">
            <Sparkles size={14} />
            <span>Powered by C++ DSA Engine</span>
          </div>
          <h1 className="ds-hero-title">
            Where <span className="ds-text-gradient">Intelligence</span> <br /> 
            Meets Dining Excellence
          </h1>
          <p className="ds-hero-subtitle">
            Experience the future of hospitality. Our AI-driven reservation engine optimizes 
            seating, waitlists, and operations with millisecond precision.
          </p>
          <div className="ds-hero-actions">
            <button className="ds-btn-primary ds-btn-lg" onClick={() => navigate('/customer/reserve')}>
              Reserve a Table <ArrowRight size={18} />
            </button>
            <button className="ds-btn-outline ds-btn-lg" onClick={() => navigate('/management')}>
              Explore Dashboard
            </button>
          </div>
        </div>

        <div className="ds-hero-visual">
            <div className="ds-visual-card">
               <div className="ds-card-header">
                  <div className="ds-dot red"></div>
                  <div className="ds-dot amber"></div>
                  <div className="ds-dot green"></div>
               </div>
               <div className="ds-card-body">
                  <div className="ds-skeleton-line short"></div>
                  <div className="ds-skeleton-grid">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className={`ds-table-node ${i === 2 ? 'active' : ''}`}></div>
                    ))}
                  </div>
               </div>
            </div>
        </div>
      </section>

      {/* SECTION 2: STATS BAR */}
      <section className="ds-stats-strip">
        <div className="ds-stats-container">
          <div className="ds-stat-item" ref={tablesStat.elementRef}>
            <span className="ds-stat-value">{tablesStat.count}+</span>
            <span className="ds-stat-label">Tables Managed</span>
          </div>
          <div className="ds-stat-divider"></div>
          <div className="ds-stat-item" ref={reservationsStat.elementRef}>
            <span className="ds-stat-value">{reservationsStat.count.toLocaleString()}+</span>
            <span className="ds-stat-label">Reservations</span>
          </div>
          <div className="ds-stat-divider"></div>
          <div className="ds-stat-item">
            <span className="ds-stat-value">99.9%</span>
            <span className="ds-stat-label">Uptime</span>
          </div>
          <div className="ds-stat-divider"></div>
          <div className="ds-stat-item" ref={responseStat.elementRef}>
            <span className="ds-stat-value">&lt; {responseStat.count}ms</span>
            <span className="ds-stat-label">DSA Response</span>
          </div>
        </div>
      </section>

      {/* SECTION 3: FEATURES */}
      <section className="ds-features" id="features">
        <div className="ds-section-header">
          <h2 className="ds-section-title">Engineered for Perfection</h2>
          <p className="ds-section-desc">Our custom-built algorithms handle the complexity, so you can focus on the cuisine.</p>
        </div>

        <div className="ds-feature-grid">
          <div className="ds-feature-card">
            <div className="ds-icon-box">
              <Cpu className="ds-feature-icon" />
            </div>
            <h3>AI Recommendations</h3>
            <p>Priority Queue scoring matches the right guests with the perfect tables based on history and preference.</p>
            <div className="ds-mini-anim-pq">
                <div className="pq-bar p1"></div>
                <div className="pq-bar p2"></div>
                <div className="pq-bar p3"></div>
            </div>
          </div>

          <div className="ds-feature-card">
            <div className="ds-icon-box">
              <Users className="ds-feature-icon" />
            </div>
            <h3>Backtracking Seating</h3>
            <p>Smart Seating Assistant solves large party seating bottlenecks using advanced recursive optimization.</p>
            <div className="ds-mini-anim-tree">
                <div className="tree-node"></div>
                <div className="tree-line"></div>
                <div className="tree-row">
                    <div className="tree-node"></div>
                    <div className="tree-node"></div>
                </div>
            </div>
          </div>

          <div className="ds-feature-card">
            <div className="ds-icon-box">
              <Map className="ds-feature-icon" />
            </div>
            <h3>Live Floor Plan</h3>
            <p>Real-time interactive map with live table status, guest countdowns, and instant drag-and-drop reassignment.</p>
            <div className="ds-mini-anim-floor">
                <span className="pulse-dot green"></span>
                <span className="pulse-dot red"></span>
                <span className="pulse-dot blue"></span>
            </div>
          </div>

          <div className="ds-feature-card">
            <div className="ds-icon-box">
              <Zap className="ds-feature-icon" />
            </div>
            <h3>Real-Time Waitlist</h3>
            <p>Automated wait-time forecasting using historical throughput data to keep your foyer clear and guests happy.</p>
            <div className="ds-mini-anim-queue">
                <div className="q-item"></div>
                <div className="q-item"></div>
                <div className="q-item"></div>
                <ArrowRight size={14} className="q-arrow" />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: HOW IT WORKS */}
      <section className="ds-timeline-section" id="how-it-works">
        <div className="ds-section-header">
          <h2 className="ds-section-title">The DineSmart Journey</h2>
        </div>
        
        <div className="ds-timeline">
          <div className="ds-timeline-line"></div>
          
          <div className="ds-step">
            <div className="ds-step-number">01</div>
            <div className="ds-step-content">
              <h4>Search & Select</h4>
              <p>Choose party size and preferences. Our UI is designed for speed and elegance.</p>
            </div>
          </div>

          <div className="ds-step">
            <div className="ds-step-number">02</div>
            <div className="ds-step-content">
              <h4>AI Recommendation</h4>
              <p>The DSA engine processes thousands of combinations to find your optimal seating location.</p>
            </div>
          </div>

          <div className="ds-step">
            <div className="ds-step-number">03</div>
            <div className="ds-step-content">
              <h4>Instant Confirmation</h4>
              <p>One-tap booking with automated calendar integration and SMS notifications.</p>
            </div>
          </div>

          <div className="ds-step">
            <div className="ds-step-number">04</div>
            <div className="ds-step-content">
              <h4>Dine & Enjoy</h4>
              <p>Arrival triggers a smart check-in, alerting the staff of your seating status immediately.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: CTA & FOOTER */}
      <section className="ds-cta-section">
        <div className="ds-cta-box">
          <h2>Ready to Dine Smarter?</h2>
          <p>Join over 500+ premium establishments optimizing their floor with DineSmart.</p>
          <button className="ds-btn-primary ds-btn-lg ds-btn-glow" onClick={() => navigate('/customer/register')}>
            Start Your Free Trial
          </button>
        </div>
      </section>

      <footer className="ds-footer">
        <div className="ds-footer-content">
          <div className="ds-logo">
            <ChefHat size={24} color="var(--accent-gold)" />
            <span>DineSmart</span>
          </div>
          <p>&copy; 2024 DineSmart Technologies Inc. All rights reserved.</p>
          <div className="ds-footer-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HeroPage;
