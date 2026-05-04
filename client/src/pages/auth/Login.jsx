/**
 * Login.jsx — Login page for the Course File Submission System.
 * Iqra University branding, clean form, role-based redirect via AuthContext.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { loginUser } from '../../services/auth.service';
import './Login.css';

const Login = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, bounce to dashboard.
  useEffect(() => {
    if (!user) return;
    navigate(user.role === 'admin' ? '/admin/dashboard' : '/faculty/dashboard', { replace: true });
  }, [user, navigate]);

  const handleChange = (e) => {
    setError('');
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const data = await loginUser(form.email, form.password);
      login(data); // saves token, redirects by role
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left panel — branding */}
      <div className="login-brand">
        <div className="brand-content">
          <div className="brand-logo">IU</div>
          <h1 className="brand-name">Iqra University</h1>
          <br />
          <p className="brand-tagline">Course File Editing &amp; Submission System</p>
          <p className="brand-desc">
            A centralised platform for faculty to prepare, submit, and track
            course documentation.
            <br />
            <br />
            Under Supervision of Dr. Israr Ali (HoD)
            <br />
            Snake Gang 🐍
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="login-form-panel">
        <div className="login-card">
          <h2 className="login-heading">Welcome back</h2>
          <p className="login-sub">Sign in to your account to continue</p>

          <form id="login-form" onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div className="field-group">
              <label htmlFor="login-email" className="field-label">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                name="email"
                className={`field-input ${error ? 'input-error' : ''}`}
                placeholder="you@iqra.edu.pk"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="field-group">
              <label htmlFor="login-password" className="field-label">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                name="password"
                className={`field-input ${error ? 'input-error' : ''}`}
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            {/* Error message */}
            {error && (
              <div id="login-error" className="error-banner" role="alert">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              className="login-btn"
              disabled={loading}
            >
              {loading ? <span className="btn-spinner" /> : 'Sign In'}
            </button>
          </form>

          <p className="login-footer">
            Don&apos;t have an account?{' '}
            <span className="login-footer-note">Contact your administrator.</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
