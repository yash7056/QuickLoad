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
  const [activeTab, setActiveTab] = useState('shipper'); // 'shipper' | 'driver'

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
        <div className="landing-blob blob-center" />
      </div>
      <div className="landing-grid" />

      {/* Header */}
      <header className="landing-header">
        <div className="landing-brand">
          <span className="landing-brand-bolt" /> QUICKLOAD
        </div>
        <div className="landing-header-actions">
          <button className="nav-link" onClick={() => document.getElementById('concept').scrollIntoView({ behavior: 'smooth' })}>
            How it Works
          </button>
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
          <div className="badge-wrapper">
            <span className="premium-badge">🚚 Double-Sided Freight Marketplace</span>
          </div>
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Instantly Book Freight. <br />
            <span className="gradient-text">Haul Cargo with AI-Driven Rates.</span>
          </motion.h1>
          <motion.p 
            className="hero-subtitle"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            QuickLoad connects shippers and commercial truck drivers in real time. We replace static rates with dynamic, AI-modeled fare quotes adjusted instantly for route distance and weather conditions.
          </motion.p>

          {/* Unified Gateways CTAs */}
          <motion.div 
            className="portal-gateways"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="gateway-card customer-gate" onClick={() => onSelectPortal('customer')}>
              <div className="gate-glow-border" />
              <div className="gate-header">
                <span className="gate-icon">🟢</span>
                <span className="gate-tag">For Cargo Shippers</span>
              </div>
              <h3>Ship Cargo</h3>
              <p>Book utility vehicles instantly, get live GPS delivery maps, and automatically download legal GST-compliant invoices.</p>
              <button className="gate-btn">Enter Customer Portal →</button>
            </div>

            <div className="gateway-card driver-gate" onClick={() => onSelectPortal('driver')}>
              <div className="gate-glow-border" />
              <div className="gate-header">
                <span className="gate-icon">🟡</span>
                <span className="gate-tag">For Truck Drivers</span>
              </div>
              <h3>Become a Driver</h3>
              <p>Match with bookings that fit your vehicle class, follow live turn-by-turn navigation, and view your payout earnings log.</p>
              <button className="gate-btn">Enter Driver Portal →</button>
            </div>
          </motion.div>
        </section>

        {/* Conceptual How it Works Timeline */}
        <section id="concept" className="landing-section concept-section">
          <div className="section-header">
            <h2>Understanding the Concept</h2>
            <p>Here is how our two-sided marketplace coordinates cargo bookings in four steps.</p>
          </div>

          <div className="tab-switcher">
            <button 
              className={`tab-btn ${activeTab === 'shipper' ? 'active-shipper' : ''}`}
              onClick={() => setActiveTab('shipper')}
            >
              For Cargo Shippers
            </button>
            <button 
              className={`tab-btn ${activeTab === 'driver' ? 'active-driver' : ''}`}
              onClick={() => setActiveTab('driver')}
            >
              For Truck Drivers
            </button>
          </div>

          <div className="concept-timeline-wrapper">
            <AnimatePresence mode="wait">
              {activeTab === 'shipper' ? (
                <motion.div 
                  key="shipper-steps"
                  className="steps-grid"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="step-card">
                    <span className="step-num">01</span>
                    <h4>Get AI Quote</h4>
                    <p>Enter details and get guaranteed rates. The AI pricing engine accounts for rain and rush-hour surcharges in real time.</p>
                  </div>
                  <div className="step-card">
                    <span className="step-num">02</span>
                    <h4>GPS Match</h4>
                    <p>Drivers nearby receive the load on their job board. The system pairs you with a driver matched to your selected truck class.</p>
                  </div>
                  <div className="step-card">
                    <span className="step-num">03</span>
                    <h4>Live Tracking</h4>
                    <p>Watch your cargo move on an interactive map. Telemetry updates keep you updated on the driver's progress.</p>
                  </div>
                  <div className="step-card">
                    <span className="step-num">04</span>
                    <h4>GST Tax Close</h4>
                    <p>Once delivered, a legal GST-compliant tax invoice is automatically generated with itemized rates and letterheads.</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="driver-steps"
                  className="steps-grid"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="step-card">
                    <span className="step-num">01</span>
                    <h4>Go Online</h4>
                    <p>Switch your load board status online. Alerts will sound to notify you of cargo requests matching your truck type.</p>
                  </div>
                  <div className="step-card">
                    <span className="step-num">02</span>
                    <h4>Accept Job</h4>
                    <p>Review the payout and route immediately. Claim the load with a single tap before another driver accepts it.</p>
                  </div>
                  <div className="step-card">
                    <span className="step-num">03</span>
                    <h4>Navigate & Haul</h4>
                    <p>Get automatic navigation routes. The built-in Leaflet GPS dashboard coordinates pickup and drop-off coordinates.</p>
                  </div>
                  <div className="step-card">
                    <span className="step-num">04</span>
                    <h4>Secure Payout</h4>
                    <p>Mark delivered when within the geofenced drop-off zone. Payouts are calculated and added to your logs instantly.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Dynamic Quote Calculator (Prototype Model) */}
        <section id="prototype" className="landing-section">
          <div className="section-header">
            <h2>Try the Pricing Engine</h2>
            <p>Test the dynamic calculator to see how weather and route variables affect cargo fares.</p>
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
                        <div className="result-item charge-highlight rain-surcharge">
                          <span className="label">🌧️ Rain Surcharge (+20%)</span>
                          <strong className="val">₹{quote.breakdown?.rainFee || quote.rainFee}</strong>
                        </div>
                      )}
                      {quote.isRushHour && (
                        <div className="result-item charge-highlight rush-surcharge">
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
