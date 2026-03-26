import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    setError('');
    if (!trimmedEmail) { setError('Please enter your email address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { setError('Please enter a valid email address.'); return; }
    if (!password) { setError('Please enter your password.'); return; }
    setLoading(true);
    try {
      await login(trimmedEmail, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left panel */}
      <div className="login-left">
        <div className="login-left-bg" />
        <div className="login-left-content">
          <div className="login-left-badge">
            <span>🔧</span>
            Smart Garage v1.0
          </div>
          <h2 className="login-left-heading">
            Run your garage<br /><span>smarter, faster.</span>
          </h2>
          <p className="login-left-desc">
            Complete garage management — job cards, estimates, billing,
            customers, and inventory in one unified platform.
          </p>
          <div className="login-left-features">
            {['Create and track job cards in real time','Generate GST-ready estimates & invoices','Manage customers and their vehicles','Parts inventory and stock control'].map(f => (
              <div key={f} className="login-left-feature">
                <div className="login-left-feature-dot" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="login-right">
        <div className="login-card">
          <div className="login-header">
            <div className="login-brand">
              <div className="login-brand-icon">🔧</div>
              <span className="login-brand-name">Smart Garage</span>
            </div>
            <h1 className="login-title">Welcome back</h1>
            <p className="login-subtitle">Sign in to your workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                className="form-control"
                placeholder="you@garage.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
                autoFocus
              />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
              />
            </div>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
