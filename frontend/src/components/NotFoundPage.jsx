import React from 'react';
import { Link } from 'react-router-dom';
import { UtensilsCrossed, Home, ShieldCheck } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <div className="not-found-icon">
          <UtensilsCrossed size={48} />
        </div>
        <h1 className="not-found-code">404</h1>
        <h2 className="not-found-title">Page Not Found</h2>
        <p className="not-found-description">
          The page you're looking for doesn't exist or has been moved.
          <br />
          Let's get you back on track.
        </p>
        <div className="not-found-actions">
          <Link to="/" className="btn-primary not-found-btn">
            <Home size={18} />
            Customer Portal
          </Link>
          <Link to="/management" className="btn-secondary not-found-btn">
            <ShieldCheck size={18} />
            Management Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
