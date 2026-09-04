import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Utensils, 
  Search, 
  CalendarCheck, 
  Star, 
  MapPin, 
  Clock, 
  Wine, 
  Globe, 
  Mail, 
  ExternalLink, 
  ChevronRight
} from 'lucide-react';
import './HeroPage.css';

const HeroPage = () => {
  const navigate = useNavigate();
  const observerRef = useRef(null);

  // Intersection Observer to trigger animations on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    const revealElements = document.querySelectorAll('.reveal');
    revealElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="ds-container">
      {/* BACKGROUND BOKEH ELEMENTS */}
      <div className="bokeh-container">
        <div className="bokeh b1"></div>
        <div className="bokeh b2"></div>
        <div className="bokeh b3"></div>
        <div className="bokeh b4"></div>
      </div>

      {/* NAVIGATION */}
      <nav className="ds-nav">
        <div className="nav-content">
          <div className="nav-logo" onClick={() => navigate('/')}>
            <Utensils className="logo-icon" size={28} />
            <span>DineSmart</span>
          </div>
          <div className="nav-links">
            <a href="#experience">Experience</a>
            <a href="#how-it-works">How it Works</a>
            <a href="#reviews">Reviews</a>
          </div>
          <div className="nav-actions">
            <button className="btn-text" onClick={() => navigate('/customer/login')}>Sign In</button>
            <button className="btn-primary btn-sm" onClick={() => navigate('/customer/register')}>
              Book a Table
            </button>
          </div>
        </div>
      </nav>

      {/* SECTION 1: HERO */}
      <header className="ds-hero">
        <div className="hero-content">
          <div className="hero-badge reveal">
            <span className="dot"></span> Curated Dining Excellence
          </div>
          <h1 className="hero-title reveal">
            Every Great Evening Begins With the <span className="text-glow">Perfect</span> Table
          </h1>
          <p className="hero-subtitle reveal">
            Discover and reserve at the finest restaurants. Smart seating, 
            instant confirmation, and unforgettable dining memories.
          </p>
          <div className="hero-btns reveal">
            <button className="btn-primary btn-lg" onClick={() => navigate('/customer/reserve')}>
              Book a Table
            </button>
            <button className="btn-outline btn-lg" onClick={() => navigate('/customer')}>
              Explore Restaurants
            </button>
          </div>
          <div className="hero-trust reveal">
            <div className="trust-item"><span>⭐</span> 4.9 Rating</div>
            <div className="trust-divider"></div>
            <div className="trust-item"><span>🍽️</span> 500+ Restaurants</div>
            <div className="trust-divider"></div>
            <div className="trust-item"><span>📅</span> 10,000+ Bookings</div>
          </div>
        </div>
      </header>

      {/* SECTION 2: WHY DINESMART */}
      <section className="ds-features">
        <div className="features-grid">
          <div className="feature-card glass reveal">
            <Search className="accent-icon" size={32} />
            <h3>Smart Discovery</h3>
            <p>Find your perfect restaurant by cuisine, location, and ambiance.</p>
          </div>
          <div className="feature-card glass reveal">
            <CalendarCheck className="accent-icon" size={32} />
            <h3>Instant Booking</h3>
            <p>Reserve your table in seconds with real-time availability.</p>
          </div>
          <div className="feature-card glass reveal">
            <Star className="accent-icon" size={32} />
            <h3>Curated Experience</h3>
            <p>Hand-picked restaurants with verified reviews and ratings.</p>
          </div>
        </div>
      </section>

      {/* SECTION 3: HOW IT WORKS */}
      <section id="how-it-works" className="ds-steps reveal">
        <div className="section-header">
          <h2 className="serif-title">Your Table Awaits in 3 Simple Steps</h2>
        </div>
        <div className="steps-container">
          <div className="step-item">
            <div className="step-number">1</div>
            <div className="step-visual glass">
              <MapPin size={40} />
            </div>
            <h4>Choose</h4>
            <p>Select your city, cuisine type, and preferred date.</p>
          </div>
          <div className="step-connector"></div>
          <div className="step-item">
            <div className="step-number">2</div>
            <div className="step-visual glass">
              <Clock size={40} />
            </div>
            <h4>Reserve</h4>
            <p>Pick from recommended tables with real-time availability.</p>
          </div>
          <div className="step-connector"></div>
          <div className="step-item">
            <div className="step-number">3</div>
            <div className="step-visual glass">
              <Wine size={40} />
            </div>
            <h4>Enjoy</h4>
            <p>Arrive, check-in, and savor every moment of your meal.</p>
          </div>
        </div>
      </section>

      {/* SECTION 4: THE EXPERIENCE (SHOWCASE) */}
      <section id="experience" className="ds-showcase">
        <div className="showcase-content">
          <div className="showcase-text reveal">
            <h2 className="serif-title">More Than Just a Reservation</h2>
            <div className="experience-list">
              <div className="exp-item">
                <div className="exp-icon-box"><ChevronRight size={20}/></div>
                <div>
                  <h4>Live Table Availability</h4>
                  <p>See which tables are free right now, no guessing involved.</p>
                </div>
              </div>
              <div className="exp-item">
                <div className="exp-icon-box"><ChevronRight size={20}/></div>
                <div>
                  <h4>Smart Seating</h4>
                  <p>We match your party size to the perfect table automatically.</p>
                </div>
              </div>
              <div className="exp-item">
                <div className="exp-icon-box"><ChevronRight size={20}/></div>
                <div>
                  <h4>Special Occasions</h4>
                  <p>Birthday or Anniversary? We'll make it extra special.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="showcase-visual reveal">
            {/* CSS ART: RESERVATION CARD */}
            <div className="res-card-art glass">
              <div className="res-card-header">
                <div className="res-card-logo">L.M.D</div>
                <div className="res-status">Confirmed ✓</div>
              </div>
              <div className="res-card-body">
                <h3>La Maison d'Or</h3>
                <div className="res-detail-grid">
                  <div className="res-detail">
                    <span>Date</span>
                    <p>Tonight, 8:00 PM</p>
                  </div>
                  <div className="res-detail">
                    <span>Guests</span>
                    <p>Party of 4</p>
                  </div>
                  <div className="res-detail">
                    <span>Table</span>
                    <p>Window Seat</p>
                  </div>
                </div>
                <div className="res-qr-mock">
                  <div className="qr-line"></div>
                  <div className="qr-line"></div>
                  <div className="qr-line"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: TESTIMONIALS */}
      <section id="reviews" className="ds-testimonials reveal">
        <h2 className="serif-title centered">Loved by Diners</h2>
        <div className="testimonial-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="test-card glass">
              <div className="test-stars">
                {[...Array(5)].map((_, s) => <Star key={s} size={14} fill="var(--accent-primary)" color="var(--accent-primary)" />)}
              </div>
              <p className="test-quote">
                "The atmosphere was divine, and booking through DineSmart was absolutely effortless. The perfect table was waiting for us."
              </p>
              <div className="test-user">
                <strong>Eleanor Shellstrop</strong>
                <span>Verified Diner</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 6: FINAL CTA */}
      <section className="ds-final-cta reveal">
        <div className="cta-content glass">
          <h2 className="serif-title">Your Perfect Table is Waiting</h2>
          <p>Join thousands of diners who trust DineSmart for their most memorable evenings.</p>
          <button className="btn-primary btn-lg btn-glow" onClick={() => navigate('/customer/reserve')}>
            Reserve Now — It's Free
          </button>
          <span className="cta-subtext">No credit card required • Cancel anytime</span>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="ds-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="nav-logo">
              <Utensils size={24} color="var(--accent-primary)" />
              <span>DineSmart</span>
            </div>
            <p>Crafting memories, one table at a time.</p>
          </div>
          <div className="footer-links">
            <a href="#">About</a>
            <a href="#">Restaurants</a>
            <a href="#">Contact</a>
            <a href="#">Careers</a>
          </div>
          <div className="footer-social">
            <Globe size={20} />
            <Mail size={20} />
            <ExternalLink size={20} />
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2024 DineSmart. Crafted with love for food lovers.</p>
        </div>
      </footer>
    </div>
  );
};

export default HeroPage;
