/**
 * AuthContext.jsx — Global authentication state.
 *
 * Provides:
 *  user    — the logged-in user object (or null)
 *  token   — JWT string (or null)
 *  loading — true while verifying token on page refresh
 *  login() — persists user + token, updates state
 *  logout()— clears everything, redirects to /login
 */
import { createContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe } from '../services/auth.service';

export const AuthContext = createContext(null);

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(() => getStoredUser());
  const [token,   setToken]   = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  /* ── Rehydrate user on refresh ───────────────────────── */
  useEffect(() => {
    const rehydrate = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { user } = await getMe();
        localStorage.setItem('user', JSON.stringify(user));
        setUser(user);
      } catch {
        // Token invalid / expired — clear everything
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    rehydrate();
  }, [token]);

  /* ── login() ─────────────────────────────────────────── */
  const login = useCallback(({ user, token }) => {
    if (!['dean', 'hod', 'faculty'].includes(user?.designation)) {
      throw new Error('Unsupported user designation.');
    }

    localStorage.setItem('token', token);
    localStorage.setItem('user',  JSON.stringify(user));
    setToken(token);
    setUser(user);

    // Redirect based on designation
    if (user.designation === 'dean') {
      navigate('/dean/dashboard', { replace: true });
    } else if (user.designation === 'hod') {
      navigate('/hod/dashboard', { replace: true });
    } else {
      navigate('/faculty/dashboard', { replace: true });
    }
  }, [navigate]);

  /* ── logout() ────────────────────────────────────────── */
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
