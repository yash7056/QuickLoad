import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './AuthPage.css';

/**
 * Shared diagonal-glow auth screen used by both the Customer and Driver portals.
 * Visual identity (accent color, copy, fields) is driven entirely by props so the
 * same component can power two differently-branded apps.
 *
 * portal: { key: 'customer' | 'driver', label, tagline, loginWelcome, registerWelcome, apiBase }
 */
export default function AuthPage({ portal, onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', gstin: '', vehicleType: 'tempo', vehicleNumber: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [inputOtp, setInputOtp] = useState('');
  const [mockOtpHint, setMockOtpHint] = useState('');

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.email || !form.password || (mode === 'register' && !form.name)) {
      setError('Please fill in the required fields.');
      return;
    }

    if (mode === 'register' && !form.phone) {
      setError('Phone number is required.');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }

    // Password length check
    if (form.password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'register') {
        // Send OTP first
        const res = await fetch(`${portal.apiBase}/api/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, role: portal.key }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Could not send OTP.'); setBusy(false); return; }

        setOtpSent(true);
        setMockOtpHint(data.mockOtp);
        setBusy(false);
      } else {
        // Login directly with password
        const res = await fetch(`${portal.apiBase}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password, role: portal.key }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Something went wrong.'); setBusy(false); return; }
        onAuthSuccess(data.user);
      }
    } catch {
      setError('Could not reach the server. Is the backend running?');
      setBusy(false);
    }
  };

  const confirmRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!inputOtp) {
      setError('Please enter the OTP code.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${portal.apiBase}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role: portal.key, otp: inputOtp }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Verification failed.'); setBusy(false); return; }

      setOtpSent(false);
      setInputOtp('');
      setMockOtpHint('');
      setMode('login');
      setForm((f) => ({ ...f, password: '' }));
      setError('');
      setBusy(false);
      setShowPassword(false);
    } catch {
      setError('Registration failed. Check server connection.');
      setBusy(false);
    }
  };

  const isLogin = mode === 'login';

  return (
    <div className="auth-stage" data-portal={portal.key}>
      {mockOtpHint && (
        <div className="mock-otp-notification" style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'rgba(13, 23, 38, 0.95)',
          border: '1px solid var(--accent)',
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px var(--accent-glow)',
          zIndex: 1000,
          color: 'var(--ink-100)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          maxWidth: '320px',
          textAlign: 'left'
        }}>
          <span style={{ fontSize: '24px' }}>📲</span>
          <div>
            <strong style={{ display: 'block', fontSize: '13px', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '2px', fontWeight: 'bold' }}>[QuickLoad Verification]</strong>
            <span style={{ fontSize: '12.5px', color: 'var(--ink-200)', lineHeight: '1.4' }}>
              Your 6-digit registration OTP is: <strong style={{ fontFamily: 'monospace', fontSize: '14.5px', color: 'var(--ink-100)', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px' }}>{mockOtpHint}</strong>
            </span>
          </div>
        </div>
      )}

      <AnimatePresence>
        {otpSent && (
          <div className="otp-overlay" style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(6, 10, 18, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999
          }}>
            <motion.div
              className="otp-modal"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--line)',
                borderRadius: '18px',
                padding: '32px',
                maxWidth: '380px',
                width: '100%',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px var(--accent-glow)',
                textAlign: 'center',
                boxSizing: 'border-box'
              }}
            >
              <h3 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: '700', color: 'var(--ink-100)' }}>Verification Required</h3>
              <p style={{ margin: '0 0 24px', fontSize: '13.5px', color: 'var(--ink-400)', lineHeight: 1.5 }}>
                We have sent a 6-digit OTP code to verify your credentials. Enter it below to complete your registration.
              </p>

              <form onSubmit={confirmRegister} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <input
                  type="text"
                  value={inputOtp}
                  onChange={(e) => setInputOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-Digit OTP"
                  maxLength={6}
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    background: 'rgba(6, 10, 18, 0.6)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '14px',
                    fontSize: '20px',
                    fontFamily: 'monospace',
                    textAlign: 'center',
                    letterSpacing: '6px',
                    color: 'var(--ink-100)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--line)'}
                />

                {error && <div className="auth-error" style={{ fontSize: '12.5px', padding: '9px 12px' }}>{error}</div>}

                <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => { setOtpSent(false); setInputOtp(''); setMockOtpHint(''); setError(''); }}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px' }}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="auth-submit"
                    style={{ flex: 1, marginTop: 0, padding: '12px', borderRadius: '10px' }}
                    disabled={busy}
                  >
                    {busy ? 'Verifying…' : 'Verify & Sign Up'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="auth-blobs">
        <div className="auth-blob blob-1" />
        <div className="auth-blob blob-2" />
        <div className="auth-blob blob-3" />
      </div>
      <div className="auth-grid" />
      <div className="auth-card">

        <motion.div
          className={`auth-brand-shape ${isLogin ? 'is-right' : 'is-left'}`}
          animate={{ left: isLogin ? '54%' : '0%' }}
          transition={{ type: 'spring', stiffness: 130, damping: 20 }}
        >
          <div className="auth-brand-inner">
            <div className="brand-mark">
              <span className="brand-mark-bolt" />
              SSG&nbsp;LOGISTICS
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
              >
                <h1 className="brand-headline">
                  {isLogin ? portal.loginWelcome : portal.registerWelcome}
                </h1>
                <p className="brand-tagline">{portal.tagline}</p>
              </motion.div>
            </AnimatePresence>
            <div className="brand-eyebrow">{portal.label}</div>
          </div>
        </motion.div>

        <div className={`auth-form-panel ${isLogin ? 'pad-right' : 'pad-left'}`}>
          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              onSubmit={submit}
              initial={{ opacity: 0, x: isLogin ? -16 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isLogin ? 16 : -16 }}
              transition={{ duration: 0.25 }}
              className="auth-form"
            >
              <h2>{isLogin ? 'Sign In' : 'Create Account'}</h2>

              {mode === 'register' && (
                <label className="auth-field">
                  <span>Full Name</span>
                  <input value={form.name} onChange={update('name')} placeholder="e.g. Yash Dargad" autoComplete="name" />
                </label>
              )}

              <label className="auth-field">
                <span>Email</span>
                <input type="email" value={form.email} onChange={update('email')} placeholder="you@example.com" autoComplete="email" />
              </label>

              <label className="auth-field">
                <span>Password</span>
                <div className="password-wrapper" style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={update('password')}
                    placeholder="••••••••"
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    style={{ paddingRight: '42px', width: '100%', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </label>

              {mode === 'register' && portal.key === 'customer' && (
                <div className="auth-field-row">
                  <label className="auth-field">
                    <span>Phone Number</span>
                    <input value={form.phone} onChange={update('phone')} placeholder="+91 98765 43210" required />
                  </label>
                  <label className="auth-field">
                    <span>GSTIN <em>(optional)</em></span>
                    <input value={form.gstin} onChange={update('gstin')} placeholder="For business invoices" />
                  </label>
                </div>
              )}

              {mode === 'register' && portal.key === 'driver' && (
                <>
                  <label className="auth-field">
                    <span>Phone Number</span>
                    <input value={form.phone} onChange={update('phone')} placeholder="+91 98765 43210" required />
                  </label>
                  <div className="auth-field-row">
                    <label className="auth-field">
                      <span>Vehicle Type</span>
                      <select value={form.vehicleType} onChange={update('vehicleType')}>
                        <option value="tempo">Tempo</option>
                        <option value="minitruck">Mini Truck</option>
                        <option value="trailer">Heavy Trailer</option>
                      </select>
                    </label>
                    <label className="auth-field">
                      <span>Vehicle No.</span>
                      <input value={form.vehicleNumber} onChange={update('vehicleNumber')} placeholder="MH12 AB 1234" required />
                    </label>
                  </div>
                </>
              )}

              {error && <div className="auth-error">{error}</div>}

              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? 'Please wait…' : isLogin ? 'Login' : 'Register'}
              </button>

              <p className="auth-switch">
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <button type="button" onClick={() => { setError(''); setShowPassword(false); setMode(isLogin ? 'register' : 'login'); }}>
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </motion.form>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
