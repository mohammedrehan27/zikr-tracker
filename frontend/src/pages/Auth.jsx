import { useState } from 'react';
import { api } from '../api.js';
import { Moon, Sparkles, Shield, CheckCircle } from 'lucide-react';

export default function Auth({ onDone }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r =
        mode === 'login'
          ? await api.login({ email: form.email, password: form.password })
          : await api.signup(form);
      onDone(r.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-brand">
        <div className="auth-icon">☪</div>
        <h1 className="auth-title">Ibadah Tracker</h1>
        <p className="auth-subtitle">Small deeds, done consistently.</p>
      </div>

      <div className="card auth-card">
        <form onSubmit={submit} className="flex flex-col gap-12">
          {mode === 'signup' && (
            <div className="input-group">
              <label className="input-label">Your Name</label>
              <input
                type="text"
                placeholder="e.g. Ali"
                value={form.name}
                onChange={set('name')}
                maxLength={50}
                required
              />
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set('email')}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <input
              type="password"
              placeholder="Min 8 characters"
              value={form.password}
              onChange={set('password')}
              minLength={mode === 'signup' ? 8 : undefined}
              required
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button className="btn btn-primary btn-full" disabled={busy}>
            {busy
              ? 'Please wait...'
              : mode === 'login'
              ? 'Sign In to Your Dashboard'
              : 'Create Free Account'}
          </button>

          <button
            type="button"
            className="btn btn-ghost text-sm"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
            }}
          >
            {mode === 'login'
              ? 'New to Ibadah Tracker? Create an account'
              : 'Already have an account? Sign in'}
          </button>
        </form>
      </div>

      <div className="flex gap-16 text-xs text-muted">
        <span className="flex items-center gap-4">
          <Shield size={12} /> Encrypted Sessions
        </span>
        <span className="flex items-center gap-4">
          <CheckCircle size={12} /> Anti-Cheat Validated
        </span>
      </div>
    </div>
  );
}
