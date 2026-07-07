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
        setError(data.error || 'Could not calculate price at this time.');
      } else {
        setQuote(data);
      }
    } catch {
      setError('Could not connect to the pricing system. Is the backend server running?');
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
            Check Price
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
            <span className="premium-badge">🚚 Simple &amp; Easy Cargo Booking</span>
          </div>
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Move Your Cargo. <br />
            <span className="gradient-text">Simple, Quick, and Safe.</span>
          </motion.h1>
          <motion.p 
            className="hero-subtitle"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            QuickLoad helps you book delivery trucks online. Customers can book trucks instantly and track deliveries on a live map. Drivers can find local jobs and earn money.
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
                <span className="gate-tag">For Shippers</span>
              </div>
              <h3>Ship Cargo</h3>
              <p>Book a truck in seconds, see your driver move on a live map, and get a receipt automatically when the job is done.</p>
              <button className="gate-btn">Book a Truck →</button>
            </div>

            <div className="gateway-card driver-gate" onClick={() => onSelectPortal('driver')}>
              <div className="gate-glow-border" />
              <div className="gate-header">
                <span className="gate-icon">🟡</span>
                <span className="gate-tag">For Drivers</span>
              </div>
              <h3>Become a Driver</h3>
              <p>Find open cargo jobs near you, see easy map directions, complete the delivery, and track all your payouts.</p>
              <button className="gate-btn">Start Driving →</button>
            </div>
          </motion.div>
        </section>

        {/* Conceptual How it Works Timeline */}
        <section id="concept" className="landing-section concept-section">
          <div className="section-header">
            <h2>How it Works</h2>
            <p>It takes only four simple steps to send goods or start earning money.</p>
          </div>

          <div className="tab-switcher">
            <button 
              className={`tab-btn ${activeTab === 'shipper' ? 'active-shipper' : ''}`}
              onClick={() => setActiveTab('shipper')}
            >
              I want to send cargo
            </button>
            <button 
              className={`tab-btn ${activeTab === 'driver' ? 'active-driver' : ''}`}
              onClick={() => setActiveTab('driver')}
            >
              I want to drive a truck
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
                    <h4>Get a Price</h4>
                    <p>Enter your pickup and drop-off points to see the exact price. Weather and traffic charges are added automatically.</p>
                  </div>
                  <div className="step-card">
                    <span className="step-num">02</span>
                    <h4>Match Driver</h4>
                    <p>A nearby driver accepts your booking and arrives at your location with the right size truck.</p>
                  </div>
                  <div className="step-card">
                    <span className="step-num">03</span>
                    <h4>Track Live</h4>
                    <p>Watch your driver carry the cargo on a live map. See exactly when they will arrive at the drop-off.</p>
                  </div>
                  <div className="step-card">
                    <span className="step-num">04</span>
                    <h4>Get Receipt</h4>
                    <p>Once delivered safely, you can download a clean tax invoice and receipt for your records.</p>
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
                    <p>Turn your status online to see open delivery jobs near you. You will hear an alert sound when a job appears.</p>
                  </div>
                  <div className="step-card">
                    <span className="step-num">02</span>
                    <h4>Accept Job</h4>
                    <p>Review the route locations and your payout rate. Click to accept the job with a single tap.</p>
                  </div>
                  <div className="step-card">
                    <span className="step-num">03</span>
                    <h4>Drive & Deliver</h4>
                    <p>Use the built-in map directions to collect the cargo and carry it safely to the drop-off point.</p>
                  </div>
                  <div className="step-card">
                    <span className="step-num">04</span>
                    <h4>Get Paid</h4>
                    <p>Complete the delivery inside the map zone, get your payout instantly, and track all your earnings.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Dynamic Quote Calculator (Prototype Model) */}
        <section id="prototype" className="landing-section">
          <div className="section-header">
            <h2>Check Prices Instantly</h2>
            <p>See how much your delivery will cost. No login or account needed to check.</p>
          </div>

          <div className="quote-calculator-container">
            <div className="calc-card">
              <h3>Delivery Cost Calculator</h3>
              <form onSubmit={handleGetQuote} className="calc-form">
                <div className="calc-fields">
                  <label className="calc-field">
                    <span>Pickup Location</span>
                    <input 
                      type="text" 
                      value={pickup} 
                      onChange={(e) => setPickup(e.target.value)} 
                      placeholder="Where do we pick up?" 
                      required 
                    />
                  </label>
                  <label className="calc-field">
                    <span>Drop-off Location</span>
                    <input 
                      type="text" 
                      value={dropoff} 
                      onChange={(e) => setDropoff(e.target.value)} 
                      placeholder="Where do we drop off?" 
                      required 
                    />
                  </label>
                </div>

                <div className="calc-row">
                  <label className="calc-field">
                    <span>Truck Size</span>
                    <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                      <option value="tempo">Tempo (Small Load)</option>
                      <option value="minitruck">Mini Truck (Medium Load)</option>
                      <option value="trailer">Heavy Trailer (Large Load)</option>
                    </select>
                  </label>
                  <button type="submit" className="calc-submit-btn" disabled={loading}>
                    {loading ? 'Calculating...' : 'Show Price'}
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
                    <h3>Your Price Receipt</h3>
                    <div className="results-grid">
                      <div className="result-item">
                        <span className="label">Truck Type</span>
                        <strong className="val">{VEHICLE_LABEL[vehicleType]}</strong>
                      </div>
                      <div className="result-item">
                        <span className="label">Distance</span>
                        <strong className="val">{quote.distance} km</strong>
                      </div>
                      <div className="result-item">
                        <span className="label">Base Price</span>
                        <strong className="val">₹{quote.breakdown?.baseFare || quote.baseFare}</strong>
                      </div>
                      <div className="result-item">
                        <span className="label">Distance Price</span>
                        <strong className="val">₹{quote.breakdown?.distanceCharge || quote.distanceCharge}</strong>
                      </div>
                      {quote.isRaining && (
                        <div className="result-item charge-highlight rain-surcharge">
                          <span className="label">🌧️ Rain Charge (+20%)</span>
                          <strong className="val">₹{quote.breakdown?.rainFee || quote.rainFee}</strong>
                        </div>
                      )}
                      {quote.isRushHour && (
                        <div className="result-item charge-highlight rush-surcharge">
                          <span className="label">🚦 Peak Traffic Charge (+15%)</span>
                          <strong className="val">₹{quote.breakdown?.rushHourFee || quote.rushHourFee}</strong>
                        </div>
                      )}
                      <div className="result-total-row">
                        <div className="result-subtotal">
                          <span>Price before tax</span>
                          <strong>₹{quote.breakdown?.subtotal || (quote.price - (quote.breakdown?.gst || 0))}</strong>
                        </div>
                        <div className="result-tax">
                          <span>Tax (IGST 18%)</span>
                          <strong>₹{quote.breakdown?.gst || (quote.price * 0.18).toFixed(0)}</strong>
                        </div>
                        <div className="result-grand-total">
                          <span>Total Price (Tax Included)</span>
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
                    <p>Enter your locations to see a clean, detailed invoice breakdown instantly.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="landing-section">
          <div className="section-header">
            <h2>Our Great Features</h2>
            <p>Simple tools to make your cargo deliveries easy and reliable.</p>
          </div>

          <div className="features-grid">
            <div className="feature-item">
              <span className="feat-icon">🗺️</span>
              <h4>Live Map Tracking</h4>
              <p>Watch your driver move on a map. Get live location updates from pickup to drop-off.</p>
            </div>

            <div className="feature-item">
              <span className="feat-icon">📄</span>
              <h4>Automatic Invoices</h4>
              <p>Get professional receipts and tax invoices automatically sent to you as soon as the delivery is done.</p>
            </div>

            <div className="feature-item">
              <span className="feat-icon">⚡</span>
              <h4>Smart Pricing</h4>
              <p>Get fair prices. The system automatically calculates rates based on weather and route details.</p>
            </div>

            <div className="feature-item">
              <span className="feat-icon">🔒</span>
              <h4>Safe Accounts</h4>
              <p>Your details and passwords are locked safely. Register vehicle plates securely.</p>
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
