import { useState, useEffect, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import DriverGPSTracker from './DriverGPSTracker';
import './DriverApp.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const socket = io(API);

const NEXT_STATUS = {
  accepted: 'picked-up',
  'picked-up': 'in-transit',
  'in-transit': 'delivered',
};
const NEXT_LABEL = {
  accepted: 'Confirm Pickup',
  'picked-up': 'Start Trip',
  'in-transit': 'Mark Delivered',
};

const VEHICLE_LABEL = { tempo: 'Tempo', minitruck: 'Mini Truck', trailer: 'Heavy Trailer' };

export default function DriverDashboard({ user, setUser, onBackToHome }) {
  const [isOnline, setIsOnline] = useState(() => {
    const stored = localStorage.getItem('ssg_driver_online');
    return stored !== 'false'; // defaults to true
  });

  useEffect(() => {
    localStorage.setItem('ssg_driver_online', isOnline);
  }, [isOnline]);

  const [showProfile, setShowProfile] = useState(false);
  const [openRides, setOpenRides] = useState([]);
  const prevOpenJobsLength = useRef(0);

  useEffect(() => {
    if (isOnline && openRides.length > prevOpenJobsLength.current) {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const playBeep = (time, freq, duration) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, time);
          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(0.08, time + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
          osc.start(time);
          osc.stop(time + duration);
        };
        const now = audioCtx.currentTime;
        playBeep(now, 587.33, 0.18); // D5 note
        playBeep(now + 0.12, 880, 0.25); // A5 note
      } catch (err) {
        console.error("Audio Context playback failed:", err);
      }
    }
    prevOpenJobsLength.current = openRides.length;
  }, [openRides, isOnline]);

  const [myRides, setMyRides] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState('');
  const [deliveryBlocked, setDeliveryBlocked] = useState(false);

  const locateCustomer = (ride) => {
    if (ride.customerLocation && ride.customerLocation.lat && ride.customerLocation.lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${ride.customerLocation.lat},${ride.customerLocation.lng}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ride.pickupLocation)}`, '_blank');
    }
  };

  const refresh = () => {
    if (!user) return;
    if (isOnline) {
      fetch(`${API}/api/rides?status=searching`).then((r) => r.json()).then(setOpenRides);
    } else {
      setOpenRides([]);
    }
    fetch(`${API}/api/rides?driverId=${user._id}`).then((r) => r.json()).then(setMyRides);
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    const onUpdate = () => refresh();
    socket.on('rideUpdated', onUpdate);
    return () => socket.off('rideUpdated', onUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isOnline]);

  const activeRide = useMemo(
    () => myRides.find((r) => !['delivered', 'cancelled'].includes(r.status)),
    [myRides]
  );
  const completed = useMemo(() => myRides.filter((r) => r.status === 'delivered'), [myRides]);
  const earnings = useMemo(() => completed.reduce((sum, r) => sum + (r.price || 0), 0), [completed]);

  const acceptRide = async (id) => {
    setBusyId(id);
    setToast('');
    try {
      const res = await fetch(`${API}/api/rides/${id}/accept`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: user._id, driverName: user.name, driverVehicleNumber: user.vehicleNumber }),
      });
      const data = await res.json();
      if (!res.ok) { setToast(data.error || 'Could not accept this ride.'); refresh(); }
      else refresh();
    } catch {
      setToast('Could not reach the server.');
    }
    setBusyId(null);
  };

  const advance = async (ride) => {
    const next = NEXT_STATUS[ride.status];
    if (!next) return;
    setBusyId(ride._id);
    await fetch(`${API}/api/rides/${ride._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    setBusyId(null);
  };

  return (
    <div className="theme-driver">
      <div className="dash">
        <header className="dash-top" style={{ position: 'relative' }}>
          <div className="dash-brand" onClick={onBackToHome} style={{ cursor: 'pointer' }}>
            <span className="dash-brand-bolt" /> QUICKLOAD
            <span className="dash-portal-tag">Driver</span>
          </div>
          <div className="dash-user">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '10px' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isOnline ? 'var(--accent)' : '#9ca3af',
                boxShadow: isOnline ? '0 0 8px var(--accent-glow)' : 'none',
                display: 'inline-block',
                transition: 'all 0.2s'
              }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: isOnline ? 'var(--ink-100)' : 'var(--ink-400)' }}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
              <button
                onClick={() => setIsOnline(!isOnline)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px',
                  padding: '4px',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center'
                }}
                title={isOnline ? "Go Offline" : "Go Online"}
              >
                {isOnline ? '🟢' : '⚫'}
              </button>
            </div>
            
            <div 
              onClick={() => setShowProfile(!showProfile)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                cursor: 'pointer', 
                padding: '6px 12px', 
                borderRadius: '8px', 
                background: showProfile ? 'rgba(255,255,255,0.06)' : 'transparent',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => { if(!showProfile) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
              onMouseLeave={(e) => { if(!showProfile) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: '15px' }}>👤</span>
              <span style={{ fontWeight: '500', color: 'var(--ink-100)' }}>{user.name}</span>
              <span style={{ fontSize: '10px', transition: 'transform 0.2s', transform: showProfile ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--ink-400)' }}>▼</span>
            </div>
          </div>

          <AnimatePresence>
            {showProfile && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: '40px',
                  width: '320px',
                  background: 'rgba(13, 23, 38, 0.95)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderTop: 'none',
                  borderRadius: '0 0 16px 16px',
                  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5), 0 0 20px var(--accent-glow)',
                  padding: '24px',
                  zIndex: 99,
                  color: 'var(--ink-100)',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    color: 'var(--ink-on-accent)',
                    fontWeight: 'bold'
                  }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>{user.name}</h3>
                    <span style={{ fontSize: '11px', color: 'var(--accent)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Driver Partner</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', borderTop: '1px solid var(--line)', paddingTop: '14px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ink-400)' }}>Email</span>
                    <span style={{ fontWeight: '500' }}>{user.email}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ink-400)' }}>Phone</span>
                    <span style={{ fontWeight: '500' }}>{user.phone || 'Not provided'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ink-400)' }}>Vehicle Type</span>
                    <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>{user.vehicleType}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ink-400)' }}>License Plate</span>
                    <span style={{ fontWeight: '500', fontFamily: 'var(--font-mono)' }}>{user.vehicleNumber || 'None'}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', borderRadius: '10px', padding: '12px', marginBottom: '18px', textAlign: 'center' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--ink-400)', marginBottom: '4px', textTransform: 'uppercase' }}>Trips Completed</span>
                    <strong style={{ fontSize: '15px', color: 'var(--ink-100)' }}>{completed.length}</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--ink-400)', marginBottom: '4px', textTransform: 'uppercase' }}>Total Earnings</span>
                    <strong style={{ fontSize: '15px', color: 'var(--accent)' }}>₹{earnings.toFixed(0)}</strong>
                  </div>
                </div>

                <button
                  className="ghost-btn"
                  onClick={() => setUser(null)}
                  style={{ width: '100%', borderColor: 'rgba(239, 68, 68, 0.4)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}
                >
                  Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <main className="dash-main">
          {activeRide ? (
            <section className="card active-card">
              <h2>Active Shipment</h2>
              <div className="card-sub">You have accepted this shipment. Advance the status below.</div>

              <div className="route-line">
                <strong>{activeRide.pickupLocation}</strong>
                <span className="route-arrow">→</span>
                <strong>{activeRide.dropoffLocation}</strong>
              </div>

              <div className="fare-row">
                <div><span className="muted">Client</span><strong>{activeRide.customerName}</strong></div>
                <div><span className="muted">Phone</span><strong>{activeRide.customerPhone || 'None'}</strong></div>
                {activeRide.customerGSTIN && (
                  <div><span className="muted">GSTIN</span><strong>{activeRide.customerGSTIN}</strong></div>
                )}
                <div><span className="muted">Earnings</span><strong>₹{activeRide.price}</strong></div>
              </div>

              {/* geofenced driver tracker map component */}
              <DriverGPSTracker
                ride={activeRide}
                onGeofenceBlock={setDeliveryBlocked}
              />

              <div className="driver-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => locateCustomer(activeRide)}
                >
                  🗺️ Navigate
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  disabled={busyId === activeRide._id || (activeRide.status === 'in-transit' && deliveryBlocked)}
                  onClick={() => advance(activeRide)}
                >
                  {busyId === activeRide._id ? 'Updating…' : NEXT_LABEL[activeRide.status]}
                </button>
              </div>

              {activeRide.status === 'in-transit' && deliveryBlocked && (
                <div style={{ marginTop: '12px', fontSize: '12.5px', color: 'var(--warning)', textAlign: 'center' }}>
                  ⚠️ You must be within 300 metres of the drop-off location to mark it delivered.
                </div>
              )}
            </section>
          ) : (
            <>
              <section className="card open-card">
                <h2>Available Load Board</h2>
                <p className="card-sub">Rides matching your vehicle type ({VEHICLE_LABEL[user.vehicleType] || user.vehicleType}). Keep online to hear alerts.</p>

                {toast && <div className="inline-error">{toast}</div>}

                {!isOnline ? (
                  <div className="inline-success" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--line)', color: 'var(--ink-400)' }}>
                    🔴 You are offline. Switch online to see and accept cargo jobs.
                  </div>
                ) : openRides.length === 0 ? (
                  <div className="inline-success" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--line)', color: 'var(--ink-400)' }}>
                    🔍 Looking for loads... Alerts will play when a booking appears.
                  </div>
                ) : (
                  <ul className="job-list">
                    {openRides
                      .filter((r) => r.vehicleType === user.vehicleType)
                      .map((r) => (
                        <li key={r._id} className="job-item">
                          <div>
                            <strong>{r.pickupLocation} → {r.dropoffLocation}</strong>
                            <span className="muted small">Client: {r.customerName} · Distance: {r.distance} km</span>
                          </div>
                          <div className="job-actions">
                            <div className="job-fare">
                              <strong>₹{r.price}</strong>
                              <em>Payout</em>
                            </div>
                            <button
                              type="button"
                              className="primary-btn small"
                              disabled={busyId === r._id}
                              onClick={() => acceptRide(r._id)}
                            >
                              Accept Load
                            </button>
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
              </section>

              <section className="card earnings-card">
                <h2>Total Payout</h2>
                <p className="card-sub">Gross earnings from completed cargo shipments.</p>
                <div className="earnings-amount">₹{earnings.toFixed(0)}</div>
              </section>
            </>
          )}

          <section className="card history-card" style={{ gridColumn: '1 / -1' }}>
            <h2>Completed Trips History</h2>
            {completed.length === 0 && <p className="card-sub">No completed cargo deliveries yet.</p>}
            <ul className="job-list">
              {completed.map((r) => (
                <li key={r._id} className="job-item" style={{ background: 'rgba(255,255,255,0.01)' }}>
                  <div>
                    <strong>{r.pickupLocation} → {r.dropoffLocation}</strong>
                    <span className="muted small">{new Date(r.updatedAt).toLocaleDateString()} · {r.invoiceNumber || 'No invoice'}</span>
                  </div>
                  <div className="job-fare">
                    <strong style={{ color: 'var(--success)' }}>+ ₹{r.price}</strong>
                    <em>Paid</em>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
