import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './LandingPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const VEHICLE_LABEL = { tempo: 'Tempo', minitruck: 'Mini Truck', trailer: 'Heavy Trailer' };

export default function LandingPage({ onSelectPortal }) {
  // Quote Calculator State (Prototype Model)
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [vehicleType, setVehicleType] = useState('tempo');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGetQuote = async (e) => {
    e.preventDefault();
    setError('');
    setQuote(null);

    if (!pickup || !dropoff) {
      setError('Please fill in both pickup and drop-off locations.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupLocation: pickup, dropoffLocation: dropoff, vehicleType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not calculate quote at this time.');
      } else {
        setQuote(data);
      }
    } catch {
      setError('Could not connect to the pricing engine. Is the backend server running?');
    }
    setLoading(false);
  };

  return (
    <div className="landing-stage">
      {/* Decorative Grids and Glow Blobs */}
      <div className="landing-blobs">
        <div className="landing-blob blob-teal" />
        <div className="landing-blob blob-amber" />
      </div>
      <div className="landing-grid" />

      {/* Header */}
      <header className="landing-header">
        <div className="landing-brand">
          <span className="landing-brand-bolt" /> QUICKLOAD
        </div>
        <div className="landing-header-actions">
          <button className="nav-link" onClick={() => document.getElementById('prototype').scrollIntoView({ behavior: 'smooth' })}>
            Try Quote Prototype
          </button>
          <button className="nav-link" onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}>
            Features
          </button>
        </div>
      </header>

      {/* Main Body Container */}
      <main className="landing-main">
        {/* Hero Section */}
        <section className="landing-hero">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Smart Freight. Real-Time Tracking. <span className="gradient-text">Dynamic AI Pricing.</span>
          </motion.h1>
          <motion.p 
            className="hero-subtitle"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            QuickLoad is a premium, double-sided cargo booking platform connecting shippers with freight drivers instantly. Price jobs dynamically using distance and weather variables, and watch cargo move on Leaflet maps.
          </motion.p>

          {/* Unified Gateways CTAs */}
          <motion.div 
            className="portal-gateways"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="gateway-card customer-gate" onClick={() => onSelectPortal('customer')}>
              <div className="gate-icon">🟢</div>
              <h3>Ship Cargo</h3>
              <p>Book trucks, get instant invoices, rate drivers, and track cargo live.</p>
              <button className="gate-btn">Enter Customer Portal →</button>
            </div>

            <div className="gateway-card driver-gate" onClick={() => onSelectPortal('driver')}>
              <div className="gate-icon">🟡</div>
              <h3>Become a Driver</h3>
              <p>Find matches, accept hauling jobs, view live navigation, and track your payouts.</p>
              <button className="gate-btn">Enter Driver Portal →</button>
            </div>
          </motion.div>
        </section>

        {/* Dynamic Quote Calculator (Prototype Model) */}
        <section id="prototype" className="landing-section">
          <div className="section-header">
            <h2>Interactive Prototype Model</h2>
            <p>Try our AI-powered dynamic pricing calculator live without creating an account.</p>
          </div>

          <div className="quote-calculator-container">
            <div className="calc-card">
              <h3>Dynamic Fare Calculator</h3>
              <form onSubmit={handleGetQuote} className="calc-form">
                <div className="calc-fields">
                  <label className="calc-field">
                    <span>Pickup Location</span>
                    <input 
                      type="text" 
                      value={pickup} 
                      onChange={(e) => setPickup(e.target.value)} 
                      placeholder="e.g. Latur, Maharashtra" 
                      required 
                    />
                  </label>
                  <label className="calc-field">
                    <span>Drop-off Location</span>
                    <input 
                      type="text" 
                      value={dropoff} 
                      onChange={(e) => setDropoff(e.target.value)} 
                      placeholder="e.g. Pune, Maharashtra" 
                      required 
                    />
                  </label>
                </div>

                <div className="calc-row">
                  <label className="calc-field">
                    <span>Select Vehicle Type</span>
                    <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                      <option value="tempo">Tempo (Light Utility)</option>
                      <option value="minitruck">Mini Truck (Medium Capacity)</option>
                      <option value="trailer">Heavy Trailer (Max Volume)</option>
                    </select>
                  </label>
                  <button type="submit" className="calc-submit-btn" disabled={loading}>
                    {loading ? 'Quoting...' : 'Get Instant Quote'}
                  </button>
                </div>
              </form>

              {error && <div className="calc-error">{error}</div>}
            </div>

            {/* Quote Results Panel */}
            <div className="calc-results-wrapper">
              <AnimatePresence mode="wait">
                {quote ? (
                  <motion.div 
                    key="results"
                    className="calc-results-card"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <h3>Quoted Fare Breakdown</h3>
                    <div className="results-grid">
                      <div className="result-item">
                        <span className="label">Vehicle Class</span>
                        <strong className="val">{VEHICLE_LABEL[vehicleType]}</strong>
                      </div>
                      <div className="result-item">
                        <span className="label">Calculated Distance</span>
                        <strong className="val">{quote.distance} km</strong>
                      </div>
                      <div className="result-item">
                        <span className="label">Base Fare</span>
                        <strong className="val">₹{quote.breakdown?.baseFare || quote.baseFare}</strong>
                      </div>
                      <div className="result-item">
                        <span className="label">Distance Charge</span>
                        <strong className="val">₹{quote.breakdown?.distanceCharge || quote.distanceCharge}</strong>
                      </div>
                      {quote.isRaining && (
                        <div className="result-item charge-highlight">
                          <span className="label">🌧️ Rain Surcharge (+20%)</span>
                          <strong className="val">₹{quote.breakdown?.rainFee || quote.rainFee}</strong>
                        </div>
                      )}
                      {quote.isRushHour && (
                        <div className="result-item charge-highlight">
                          <span className="label">🚦 Peak Hours Surcharge (+15%)</span>
                          <strong className="val">₹{quote.breakdown?.rushHourFee || quote.rushHourFee}</strong>
                        </div>
                      )}
                      <div className="result-total-row">
                        <div className="result-subtotal">
                          <span>Subtotal (excluding GST)</span>
                          <strong>₹{quote.breakdown?.subtotal || (quote.price - (quote.breakdown?.gst || 0))}</strong>
                        </div>
                        <div className="result-tax">
                          <span>IGST @ 18%</span>
                          <strong>₹{quote.breakdown?.gst || (quote.price * 0.18).toFixed(0)}</strong>
                        </div>
                        <div className="result-grand-total">
                          <span>Grand Total (GST Inclusive)</span>
                          <strong>₹{quote.price}</strong>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="placeholder"
                    className="calc-results-placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <span className="icon">📊</span>
                    <p>Enter pickup and drop-off locations to view an itemized, GST-compliant cargo fare breakdown instantly.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="landing-section">
          <div className="section-header">
            <h2>Robust Logistics Features</h2>
            <p>Our platform handles end-to-end cargo lifecycle booking with maximum reliability.</p>
          </div>

          <div className="features-grid">
            <div className="feature-item">
              <span className="feat-icon">🗺️</span>
              <h4>Live GPS Map Tracking</h4>
              <p>Follow cargo movements live with Leaflet maps. Automatic broadcasts update the customer's portal on every status shift.</p>
            </div>

            <div className="feature-item">
              <span className="feat-icon">📄</span>
              <h4>Automated GST Invoices</h4>
              <p>Generate detailed legal tax invoices dynamically (with letterheads, tax breakdowns, and spelled amounts) immediately upon delivery.</p>
            </div>

            <div className="feature-item">
              <span className="feat-icon">⚡</span>
              <h4>AI Dynamic pricing</h4>
              <p>Avoid static rates. Our FastAPI pricing engine computes real-time pricing using live weather data and peak traffic hours.</p>
            </div>

            <div className="feature-item">
              <span className="feat-icon">🔒</span>
              <h4>Secure Encrypted Auth</h4>
              <p>Passwords are protected on registration using bcryptjs hashing. Enforces strict uniqueness for driver license plate registrations.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p>&copy; {new Date().getFullYear()} QuickLoad Pvt. Ltd. All rights reserved.</p>
      </footer>
    </div>
  );
}
