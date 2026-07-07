import { useState, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import AuthPage from './AuthPage';
import { downloadInvoice } from './invoice';
import CustomerLiveMap from './CustomerLiveMap';
import LandingPage from './LandingPage';
import DriverDashboard from './DriverDashboard';
import './App.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const socket = io(API);

const CUSTOMER_PORTAL = {
  key: 'customer',
  label: 'Customer Portal',
  tagline: 'Book a truck in seconds and watch it move, live, all the way to drop-off.',
  loginWelcome: 'Welcome Back',
  registerWelcome: 'Ship With Us',
  apiBase: API,
};

const DRIVER_PORTAL = {
  key: 'driver',
  label: 'Driver Portal',
  tagline: 'Open jobs near you, one tap to accept, clear steps for every trip.',
  loginWelcome: 'Back On The Road',
  registerWelcome: 'Drive With Us',
  apiBase: API,
};

const VEHICLE_LABEL = { tempo: 'Tempo', minitruck: 'Mini Truck', trailer: 'Heavy Trailer' };

const STEPS = ['searching', 'accepted', 'picked-up', 'in-transit', 'delivered'];
const STEP_LABEL = {
  searching: 'Finding a driver',
  accepted: 'Driver assigned',
  'picked-up': 'Cargo picked up',
  'in-transit': 'On the way',
  delivered: 'Delivered',
};

export default function App() {
  const [view, setView] = useState('landing'); // 'landing' | 'customer' | 'driver'

  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('ssg_customer_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [driverUser, setDriverUser] = useState(() => {
    try {
      const stored = localStorage.getItem('ssg_driver_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [company, setCompany] = useState(null);

  useEffect(() => {
    if (user) {
      localStorage.setItem('ssg_customer_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('ssg_customer_user');
    }
  }, [user]);

  useEffect(() => {
    if (driverUser) {
      localStorage.setItem('ssg_driver_user', JSON.stringify(driverUser));
    } else {
      localStorage.removeItem('ssg_driver_user');
    }
  }, [driverUser]);

  // booking form
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [vehicleType, setVehicleType] = useState('tempo');
  const [trackedRideId, setTrackedRideId] = useState(null);
  
  // customer coordinates
  const [customerLocation, setCustomerLocation] = useState(null);
  const [fetchingGps, setFetchingGps] = useState(false);

  const fetchGPSLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setFetchingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setFetchingGps(false);
      },
      (err) => {
        alert(`Failed to get location: ${err.message}`);
        setFetchingGps(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // quote step ("review before you book")
  const [quote, setQuote] = useState(null);     // fare breakdown returned by /api/quote
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');

  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState('');

  const [rides, setRides] = useState([]);
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    fetch(`${API}/api/company`).then((r) => r.json()).then(setCompany).catch(() => {});
  }, []);

  const refreshRides = () => {
    if (!user) return;
    fetch(`${API}/api/rides?customerId=${user._id}`).then((r) => r.json()).then(setRides);
  };

  useEffect(() => {
    if (!user) return;
    refreshRides();
    const onUpdate = (updated) => {
      if (updated.customerId !== user._id) return;
      setRides((prev) => {
        const exists = prev.some((r) => r._id === updated._id);
        return exists ? prev.map((r) => (r._id === updated._id ? updated : r)) : [updated, ...prev];
      });
    };
    socket.on('rideUpdated', onUpdate);
    return () => socket.off('rideUpdated', onUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const activeRides = useMemo(
    () => rides.filter((r) => !['delivered', 'cancelled'].includes(r.status)),
    [rides]
  );

  const activeRide = useMemo(() => {
    if (activeRides.length === 0) return null;
    if (trackedRideId) {
      const found = activeRides.find((r) => r._id === trackedRideId);
      if (found) return found;
    }
    return activeRides[0];
  }, [activeRides, trackedRideId]);

  // Step 1 → 2: price the trip but don't book anything yet.
  const getQuote = async () => {
    setQuoteError(''); setBookError('');
    if (!pickup || !dropoff) { setQuoteError('Enter both a pickup and a drop-off location.'); return; }
    setQuoting(true);
    try {
      const res = await fetch(`${API}/api/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupLocation: pickup, dropoffLocation: dropoff, vehicleType }),
      });
      const data = await res.json();
      if (!res.ok) { setQuoteError(data.error || 'Could not price this trip.'); setQuoting(false); return; }
      setQuote(data);
    } catch {
      setQuoteError('Could not reach the server.');
    }
    setQuoting(false);
  };

  const editTrip = () => { setQuote(null); setQuoteError(''); };

  // Step 2 → 3: customer confirms the quoted fare, this actually creates the ride.
  const confirmBooking = async () => {
    setBookError('');
    setBooking(true);
    try {
      const res = await fetch(`${API}/api/rides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupLocation: pickup,
          dropoffLocation: dropoff,
          vehicleType,
          customerId: user._id,
          customerName: user.name,
          customerPhone: user.phone || '',
          customerGSTIN: user.gstin || '',
          customerLocation,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setBookError(data.error || 'Booking failed.'); setBooking(false); return; }
      setRides((prev) => [data, ...prev]);
      setTrackedRideId(data._id);
      setPickup(''); setDropoff(''); setQuote(null); setCustomerLocation(null);
    } catch {
      setBookError('Could not reach the server.');
    }
    setBooking(false);
  };

  const cancelRide = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    try {
      const res = await fetch(`${API}/api/rides/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (res.ok) {
        const data = await res.json();
        setRides((prev) => prev.map((r) => (r._id === id ? data : r)));
      } else {
        alert("Failed to cancel the booking.");
      }
    } catch {
      alert("Could not reach the server.");
    }
  };

  const rateRide = async (id, rating) => {
    const res = await fetch(`${API}/api/rides/${id}/rate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating }),
    });
    const data = await res.json();
    setRides((prev) => prev.map((r) => (r._id === id ? data : r)));
  };

  const handleInvoice = (ride) => {
    if (!company) return;
    downloadInvoice(ride, company);
  };

  const history = useMemo(
    () => rides.filter((r) => ['delivered', 'cancelled'].includes(r.status)),
    [rides]
  );

  if (view === 'landing') {
    return <LandingPage onSelectPortal={(selectedView) => setView(selectedView)} />;
  }

  if (view === 'driver') {
    if (!driverUser) {
      return (
        <div className="theme-driver" style={{ minHeight: '100vh', background: 'var(--bg-void)' }}>
          <AuthPage 
            portal={DRIVER_PORTAL} 
            onAuthSuccess={setDriverUser} 
            onBackToHome={() => setView('landing')} 
          />
        </div>
      );
    }
    return (
      <DriverDashboard 
        user={driverUser} 
        setUser={setDriverUser} 
        onBackToHome={() => setView('landing')} 
      />
    );
  }

  if (view === 'customer' && !user) {
    return (
      <div className="theme-customer" style={{ minHeight: '100vh', background: 'var(--bg-void)' }}>
        <AuthPage 
          portal={CUSTOMER_PORTAL} 
          onAuthSuccess={setUser} 
          onBackToHome={() => setView('landing')} 
        />
      </div>
    );
  }

  const stepIndex = activeRide ? STEPS.indexOf(activeRide.status) : -1;

  return (
    <div className="dash">
      <header className="dash-top">
        <div className="dash-brand" onClick={() => setView('landing')} style={{ cursor: 'pointer' }}>
          <span className="dash-brand-bolt" /> QUICKLOAD
          <span className="dash-portal-tag">Customer</span>
        </div>
        <div className="dash-user">
          <span>{user.name}</span>
          <button className="ghost-btn" onClick={() => setUser(null)}>Logout</button>
        </div>
      </header>

      <main className="dash-main">
        <motion.section className="card book-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <AnimatePresence mode="wait">
            {!quote ? (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h2>Book a Truck</h2>
                <p className="card-sub">Get an itemised, GST-inclusive fare before you commit — nothing books until you confirm.</p>
 
                <label className="field"><span>Pickup</span>
                  <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="e.g. Latur, Maharashtra" />
                </label>
                <label className="field"><span>Drop-off</span>
                  <input value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="e.g. Pune, Maharashtra" />
                </label>

                <div className="gps-section">
                  <button
                    type="button"
                    className={`gps-btn ${customerLocation ? 'active' : ''}`}
                    onClick={fetchGPSLocation}
                    disabled={fetchingGps}
                  >
                    {fetchingGps ? '🛰️ Pinpointing Location…' : customerLocation ? `📍 GPS Shared (${customerLocation.lat.toFixed(4)}, ${customerLocation.lng.toFixed(4)})` : '📍 Share Precise GPS for Driver'}
                  </button>
                  {customerLocation && (
                    <button type="button" className="gps-clear-btn" onClick={() => setCustomerLocation(null)}>✕ Remove</button>
                  )}
                </div>

                <div className="field">
                  <span>Select Vehicle Type</span>
                  <div className="vehicle-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '8px' }}>
                    {[
                      { type: 'tempo', label: 'Tempo', desc: 'Light Goods', rate: '₹18/km', icon: '🚚' },
                      { type: 'minitruck', label: 'Mini Truck', desc: 'Medium Cargo', rate: '₹26/km', icon: '🚛' },
                      { type: 'trailer', label: 'Heavy Trailer', desc: 'Large Freight', rate: '₹38/km', icon: '🏗️' }
                    ].map((v) => (
                      <div
                        key={v.type}
                        className={`vehicle-card ${vehicleType === v.type ? 'active' : ''}`}
                        onClick={() => setVehicleType(v.type)}
                        style={{
                          background: vehicleType === v.type ? 'rgba(22, 38, 59, 0.5)' : 'rgba(6, 10, 18, 0.4)',
                          border: vehicleType === v.type ? '2px solid var(--accent)' : '1px solid var(--line)',
                          borderRadius: '12px',
                          padding: '14px 10px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: vehicleType === v.type ? '0 0 16px var(--accent-glow)' : 'none',
                        }}
                        onMouseEnter={(e) => {
                          if (vehicleType !== v.type) {
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                            e.currentTarget.style.background = 'rgba(6, 10, 18, 0.6)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (vehicleType !== v.type) {
                            e.currentTarget.style.borderColor = 'var(--line)';
                            e.currentTarget.style.background = 'rgba(6, 10, 18, 0.4)';
                          }
                        }}
                      >
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>{v.icon}</div>
                        <strong style={{ display: 'block', fontSize: '13.5px', color: 'var(--ink-100)', marginBottom: '2px' }}>{v.label}</strong>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--ink-400)', marginBottom: '4px' }}>{v.desc}</span>
                        <span style={{ display: 'inline-block', fontSize: '11.5px', color: 'var(--accent)', fontWeight: '600', background: 'rgba(37, 99, 235, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>{v.rate}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {quoteError && <div className="inline-error">{quoteError}</div>}

                <button className="primary-btn" onClick={getQuote} disabled={quoting}>
                  {quoting ? 'Pricing your trip…' : 'Get Fare Quote'}
                </button>
              </motion.div>
            ) : (
              <motion.div key="quote" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h2>Review &amp; Confirm</h2>
                <p className="card-sub">This fare is locked in for the next few minutes. Confirm to find a driver.</p>

                <div className="route-line" style={{ marginBottom: 16 }}>
                  <strong>{pickup}</strong>
                  <span className="route-arrow">→</span>
                  <strong>{dropoff}</strong>
                </div>

                <ul className="quote-breakdown">
                  <li><span>Base fare</span><span>₹{quote.baseFare.toFixed(2)}</span></li>
                  <li><span>Distance charge ({quote.distance} km)</span><span>₹{quote.distanceFare.toFixed(2)}</span></li>
                  {quote.rainSurcharge > 0 && (
                    <li className="surcharge"><span>🌧️ Rain surcharge</span><span>₹{quote.rainSurcharge.toFixed(2)}</span></li>
                  )}
                  {quote.rushHourSurcharge > 0 && (
                    <li className="surcharge"><span>⏱️ Peak-hour surcharge</span><span>₹{quote.rushHourSurcharge.toFixed(2)}</span></li>
                  )}
                  <li className="subtotal"><span>Subtotal</span><span>₹{quote.subtotal.toFixed(2)}</span></li>
                  <li><span>IGST ({quote.taxRate}%)</span><span>₹{quote.taxAmount.toFixed(2)}</span></li>
                  <li className="grand-total"><span>Total payable</span><span>₹{quote.price.toFixed(2)}</span></li>
                </ul>

                {bookError && <div className="inline-error">{bookError}</div>}

                <div className="quote-actions">
                  <button className="ghost-btn" onClick={editTrip} disabled={booking}>Edit Trip</button>
                  <button className="primary-btn" onClick={confirmBooking} disabled={booking}>
                    {booking ? 'Booking…' : `Confirm & Find Driver · ${VEHICLE_LABEL[vehicleType]}`}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        <motion.section className="card track-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <h2 style={{ margin: 0 }}>Live Tracking</h2>
            {activeRides.length > 1 && (
              <select
                className="active-ride-select"
                value={activeRide?._id || ''}
                onChange={(e) => setTrackedRideId(e.target.value)}
              >
                {activeRides.map((r, i) => (
                  <option key={r._id} value={r._id}>
                    Truck #{i + 1}: {r.pickupLocation.split(',')[0]} → {r.dropoffLocation.split(',')[0]} ({STEP_LABEL[r.status] || r.status})
                  </option>
                ))}
              </select>
            )}
          </div>
          <AnimatePresence mode="wait">
            {!activeRide ? (
              <motion.div key="empty" className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p>No active shipment yet. Book a ride and it'll show up here, live.</p>
              </motion.div>
            ) : (
              <motion.div key={activeRide._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="route-line">
                  <strong>{activeRide.pickupLocation}</strong>
                  <span className="route-arrow">→</span>
                  <strong>{activeRide.dropoffLocation}</strong>
                </div>

                <ol className="timeline">
                  {STEPS.map((step, i) => {
                    const isDone = i < stepIndex;
                    const isActive = i === stepIndex;
                    return (
                      <li key={step} className={`${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                        <span className="dot">
                          {isDone && <span style={{ fontSize: '9px', fontWeight: 'bold', display: 'block', transform: 'translateY(-1px)' }}>✓</span>}
                        </span>
                        {STEP_LABEL[step]}
                      </li>
                    );
                  })}
                </ol>

                {activeRide.driverName && (
                  <div className="assigned-driver-card" style={{ background: 'rgba(22, 38, 59, 0.4)', border: '1px solid var(--line)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--ink-400)', letterSpacing: '0.05em', marginTop: 0, marginBottom: '10px', fontWeight: 600 }}>Assigned Driver & Vehicle</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 15px' }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--ink-400)', marginBottom: '2px' }}>Driver Name</span>
                        <strong>{activeRide.driverName}</strong>
                      </div>
                      {activeRide.driverPhone && (
                        <div>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--ink-400)', marginBottom: '2px' }}>Phone</span>
                          <strong><a href={`tel:${activeRide.driverPhone}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{activeRide.driverPhone}</a></strong>
                        </div>
                      )}
                      <div>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--ink-400)', marginBottom: '2px' }}>Truck Type</span>
                        <strong>{VEHICLE_LABEL[activeRide.vehicleType] || activeRide.vehicleType}</strong>
                      </div>
                      {activeRide.driverVehicleNumber && (
                        <div>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--ink-400)', marginBottom: '2px' }}>Truck Number</span>
                          <strong style={{ fontFamily: 'var(--font-mono)' }}>{activeRide.driverVehicleNumber}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeRide.status === 'searching' && (
                  <button
                    type="button"
                    onClick={() => cancelRide(activeRide._id)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: 'var(--danger)',
                      fontWeight: '600',
                      cursor: 'pointer',
                      marginBottom: '16px',
                      transition: 'all 0.2s ease-in-out'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(239, 68, 68, 0.2)';
                      e.target.style.borderColor = 'var(--danger)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(239, 68, 68, 0.1)';
                      e.target.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                    }}
                  >
                    🚫 Cancel Booking
                  </button>
                )}

                <CustomerLiveMap ride={activeRide} />

                <div className="fare-row">
                  <div><span className="muted">Distance</span><strong>{activeRide.distance} km</strong></div>
                  <div><span className="muted">Total (incl. GST)</span><strong>₹{activeRide.price}</strong></div>
                  {activeRide.isRaining && <div className="rain-badge">🌧️ Rain surcharge applied</div>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        <motion.section className="card history-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2>Ride History</h2>
          {history.length === 0 && <p className="card-sub">Completed rides will appear here.</p>}
          <ul className="history-list">
            {history.map((r) => (
              <li key={r._id} className="history-item">
                <div>
                  <strong>{r.pickupLocation} → {r.dropoffLocation}</strong>
                  <div className="muted small">
                    {new Date(r.createdAt).toLocaleDateString()} · ₹{r.price} (incl. GST) · {VEHICLE_LABEL[r.vehicleType] || r.vehicleType}
                    {r.invoiceNumber && <> · {r.invoiceNumber}</>}
                  </div>
                </div>
                <div className="history-actions">
                  {r.status === 'delivered' && !r.rating && (
                    <div className="stars" onMouseLeave={() => setHoverRating(0)}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span
                          key={n}
                          className={n <= hoverRating ? 'on' : ''}
                          onMouseEnter={() => setHoverRating(n)}
                          onClick={() => rateRide(r._id, n)}
                        >★</span>
                      ))}
                    </div>
                  )}
                  {r.rating && <div className="rated">{'★'.repeat(r.rating)}</div>}
                  {r.status === 'delivered' && (
                    <button className="ghost-btn small" onClick={() => handleInvoice(r)} disabled={!company}>Invoice</button>
                  )}
                  {r.status === 'cancelled' && <span className="cancelled-tag">Cancelled</span>}
                </div>
              </li>
            ))}
          </ul>
        </motion.section>
      </main>
    </div>
  );
}
