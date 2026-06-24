import { useState, useEffect, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import AuthPage from './AuthPage';
import DriverGPSTracker from './DriverGPSTracker';
import './App.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const socket = io(API);

const PORTAL = {
  key: 'driver',
  label: 'Driver Portal',
  tagline: 'Open jobs near you, one tap to accept, clear steps for every trip.',
  loginWelcome: 'Back On The Road',
  registerWelcome: 'Drive With Us',
  apiBase: API,
};

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

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('ssg_driver_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('ssg_driver_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('ssg_driver_user');
    }
  }, [user]);

  const [isOnline, setIsOnline] = useState(() => {
    const stored = localStorage.getItem('ssg_driver_online');
    return stored !== 'false'; // defaults to true
  });

  useEffect(() => {
    localStorage.setItem('ssg_driver_online', isOnline);
  }, [isOnline]);

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

  if (!user) return <AuthPage portal={PORTAL} onAuthSuccess={setUser} />;

  return (
    <div className="dash">
      <header className="dash-top">
        <div className="dash-brand">
          <span className="dash-brand-bolt" /> SSG LOGISTICS
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
          <span>{user.name}{user.vehicleNumber ? ` · ${user.vehicleNumber}` : ''}</span>
          <button className="ghost-btn" onClick={() => setUser(null)}>Logout</button>
        </div>
      </header>

      <main className="dash-main driver-grid">
        <motion.section className="card earnings-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <h2>Earnings</h2>
          <div className="earnings-amount">₹{earnings.toFixed(0)}</div>
          <p className="card-sub">{completed.length} completed {completed.length === 1 ? 'trip' : 'trips'}</p>
        </motion.section>

        <motion.section className="card active-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <h2>Active Trip</h2>
          <AnimatePresence mode="wait">
            {!activeRide ? (
              <motion.p key="empty" className="card-sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Accept an open job below to get started.
              </motion.p>
            ) : (
              <motion.div key={activeRide._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="route-line">
                  <strong>{activeRide.pickupLocation}</strong>
                  <span className="route-arrow">→</span>
                  <strong>{activeRide.dropoffLocation}</strong>
                </div>
                <div className="fare-row">
                  <div><span className="muted">Vehicle Type</span><strong style={{ textTransform: 'capitalize' }}>{activeRide.vehicleType}</strong></div>
                  <div><span className="muted">Distance</span><strong>{activeRide.distance} km</strong></div>
                  <div><span className="muted">Fare (incl. GST)</span><strong>₹{activeRide.price}</strong></div>
                </div>

                <div className="driver-info-panel" style={{ background: 'rgba(6, 10, 18, 0.4)', border: '1px solid var(--line)', padding: '16px 20px', borderRadius: '12px', marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--ink-400)', letterSpacing: '0.05em', marginTop: 0, marginBottom: '10px', fontWeight: 600 }}>Customer Details</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 15px' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--ink-400)', marginBottom: '2px' }}>Name</span>
                      <strong>{activeRide.customerName}</strong>
                    </div>
                    {activeRide.customerPhone && (
                      <div>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--ink-400)', marginBottom: '2px' }}>Phone</span>
                        <strong><a href={`tel:${activeRide.customerPhone}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{activeRide.customerPhone}</a></strong>
                      </div>
                    )}
                    {activeRide.customerGSTIN && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--ink-400)', marginBottom: '2px' }}>GSTIN</span>
                        <strong style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>{activeRide.customerGSTIN}</strong>
                      </div>
                    )}
                    <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed var(--line)', paddingTop: '10px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ maxWidth: '60%' }}>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--ink-400)', marginBottom: '2px' }}>Pickup Point</span>
                        <strong style={{ fontSize: '12px', lineHeight: '1.3', display: 'block' }}>{activeRide.pickupLocation}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => locateCustomer(activeRide)}
                        style={{
                          background: 'rgba(37, 99, 235, 0.12)',
                          border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
                          color: 'var(--accent)',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.25)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.12)'}
                      >
                        🗺️ Nav Route
                      </button>
                    </div>
                  </div>
                </div>

                <DriverGPSTracker ride={activeRide} onGeofenceBlock={setDeliveryBlocked} />

                <div className="driver-actions" style={{ marginTop: '20px' }}>
                  {NEXT_STATUS[activeRide.status] ? (
                    <div style={{ width: '100%' }}>
                      <div className="swipe-confirm-container" style={{
                        background: 'rgba(6, 10, 18, 0.6)',
                        border: '1px solid var(--line)',
                        borderRadius: '50px',
                        height: '56px',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px',
                        overflow: 'hidden',
                        width: '100%',
                        boxSizing: 'border-box',
                        marginBottom: '16px'
                      }}>
                        <motion.div
                          drag={busyId === activeRide._id || (activeRide.status === 'in-transit' && deliveryBlocked) ? false : "x"}
                          dragConstraints={{ left: 0, right: 200 }}
                          dragElastic={0}
                          dragMomentum={false}
                          onDragEnd={(event, info) => {
                            if (info.offset.x >= 170) {
                              advance(activeRide);
                            }
                          }}
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))',
                            boxShadow: '0 0 12px var(--accent-glow)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: (activeRide.status === 'in-transit' && deliveryBlocked) ? 'not-allowed' : 'grab',
                            zIndex: 10,
                          }}
                          animate={{ x: 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                          whileTap={{ cursor: (activeRide.status === 'in-transit' && deliveryBlocked) ? 'not-allowed' : 'grabbing' }}
                        >
                          <span style={{ fontSize: '18px', color: 'var(--ink-on-accent)', userSelect: 'none', fontWeight: 'bold' }}>→</span>
                        </motion.div>
                        <div style={{
                          position: 'absolute',
                          width: '100%',
                          textAlign: 'center',
                          color: (activeRide.status === 'in-transit' && deliveryBlocked) ? 'var(--danger)' : 'var(--ink-400)',
                          fontSize: '13px',
                          fontWeight: '600',
                          pointerEvents: 'none',
                          userSelect: 'none',
                          zIndex: 1,
                          paddingRight: '48px',
                          boxSizing: 'border-box'
                        }}>
                          {busyId === activeRide._id
                            ? 'Updating status…'
                            : (activeRide.status === 'in-transit' && deliveryBlocked)
                              ? '🔒 Locked: Must enter geofence area'
                              : `Swipe to ${NEXT_LABEL[activeRide.status]}`}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="inline-success" style={{ width: '100%', textAlign: 'center', padding: '12px' }}>Trip complete — nice work!</div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        <motion.section className="card open-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2>Open Jobs Nearby</h2>
          {!isOnline ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '40px' }}>💤</div>
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--ink-200)' }}>You are currently offline</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-400)', maxWidth: '280px', lineHeight: 1.5 }}>
                Toggle your status to online in the top bar to start receiving incoming logistics dispatch orders near you.
              </p>
              <button
                type="button"
                className="primary-btn"
                onClick={() => setIsOnline(true)}
                style={{ width: 'auto', padding: '8px 20px', marginTop: '8px', fontSize: '13.5px' }}
              >
                Go Online
              </button>
            </div>
          ) : (
            <>
              {toast && <div className="inline-error">{toast}</div>}
              {openRides.length === 0 && <p className="card-sub">No open jobs right now — check back shortly.</p>}
              <ul className="job-list">
                {openRides.map((r) => (
                  <li key={r._id} className="job-item">
                    <div>
                      <strong>{r.pickupLocation} → {r.dropoffLocation}</strong>
                      <div className="muted small">{r.vehicleType} · {r.distance} km{r.isRaining ? ' · 🌧️ rain surcharge' : ''}</div>
                    </div>
                    <div className="job-actions">
                      <span className="job-fare">₹{r.price} <em>incl. GST</em></span>
                      <button
                        className="primary-btn small"
                        disabled={!!activeRide || busyId === r._id}
                        onClick={() => acceptRide(r._id)}
                      >
                        {busyId === r._id ? 'Accepting…' : 'Accept'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </motion.section>
      </main>
    </div>
  );
}
