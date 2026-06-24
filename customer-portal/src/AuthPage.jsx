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

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.email || !form.password || (mode === 'register' && !form.name)) {
      setError('Please fill in the required fields.');
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
      const path = mode === 'register' ? 'register' : 'login';
      const payload = mode === 'register'
        ? { ...form, role: portal.key }
        : { email: form.email, password: form.password, role: portal.key };

      const res = await fetch(`${portal.apiBase}/api/auth/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) { setError(data.error || 'Something went wrong.'); setBusy(false); return; }

      if (mode === 'register') {
        setMode('login');
        setForm((f) => ({ ...f, password: '' }));
        setError('');
        setBusy(false);
        setShowPassword(false);
      } else {
        onAuthSuccess(data.user);
      }
    } catch {
      setError('Could not reach the server. Is the backend running?');
      setBusy(false);
    }
  };

  const isLogin = mode === 'login';

  return (
    <div className="auth-stage" data-portal={portal.key}>
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
                    <span>Phone <em>(optional)</em></span>
                    <input value={form.phone} onChange={update('phone')} placeholder="+91 98765 43210" />
                  </label>
                  <label className="auth-field">
                    <span>GSTIN <em>(optional)</em></span>
                    <input value={form.gstin} onChange={update('gstin')} placeholder="For business invoices" />
                  </label>
                </div>
              )}

              {mode === 'register' && portal.key === 'driver' && (
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
                    <input value={form.vehicleNumber} onChange={update('vehicleNumber')} placeholder="MH12 AB 1234" />
                  </label>
                </div>
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
