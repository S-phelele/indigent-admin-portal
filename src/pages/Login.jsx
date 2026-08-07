import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/ui/Icon';
import { useToast } from '../components/ui/Toast';

const POINTS = [
  'Review and decide indigent support applications',
  'Track service levels against the review target',
  'Every action recorded in an audit trail',
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success('Signed in', `Welcome back, ${user.firstName || user.email}.`);
      navigate('/');
    } catch (err) {
      // "Admin access only" is thrown client-side when an applicant signs in here.
      const msg = err.response?.data?.message || err.message || 'Sign in failed';
      setError(msg === 'Admin access only' ? 'This account does not have administrator access.' : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <aside className="login-brand">
        <div className="brand-lockup" style={{ marginBottom: '1.5rem' }}>
          <span className="sidebar-mark" aria-hidden="true">IR</span>
          <span className="brand-text">
            <span className="brand-name" style={{ color: '#fff' }}>Indigent Register</span>
            <span className="brand-sub" style={{ color: '#94a3b8' }}>Administration</span>
          </span>
        </div>
        <h2>Municipal indigent support administration</h2>
        <p>Sign in to review applications, monitor turnaround times and maintain the register.</p>
        <div className="login-brand-points">
          {POINTS.map((p) => (
            <div className="login-brand-point" key={p}>
              <Icon name="check" size={15} />
              <span>{p}</span>
            </div>
          ))}
        </div>
      </aside>

      <main className="login-form-wrap">
        <div className="login-card">
          <h1>Administrator sign in</h1>
          <p>Use the credentials issued by your municipality.</p>

          {error ? (
            <div className="alert alert-error" role="alert">
              <Icon name="alert-circle" size={16} />
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@municipality.gov.za"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} />
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="login-foot">
            Trouble signing in? Contact your system administrator.
          </p>
        </div>
      </main>
    </div>
  );
}
