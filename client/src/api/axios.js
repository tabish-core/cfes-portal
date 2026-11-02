/**
 * axios.js — Pre-configured Axios instance.
 *
 * - baseURL points to the Express API (proxied in dev via vite.config.js)
 * - Request interceptor: attaches JWT from localStorage to every request
 * - Response interceptor: on 401, clears token and redirects to /login
 */
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

/* ── Request Interceptor ─────────────────────────────────── */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ── Response Interceptor ────────────────────────────────── */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const data = error.response?.data;

    // Distinguish between genuine CFES portal session expiration vs third-party integration errors:
    // 1. Integration routes (e.g. /course-files/google/*) belong to external services, not CFES session auth
    const isIntegrationRoute =
      url.includes('/google/') ||
      url.includes('/course-files/google/');

    // 2. Integration error codes explicitly identify non-portal auth failures
    const isIntegrationErrorCode =
      data?.code === 'GOOGLE_AUTH_REQUIRED' ||
      data?.code === 'INVALID_GRANT';

    // 3. Callers can explicitly opt-out of automatic session redirection
    const isExplicitlyExempt = Boolean(error.config?.skipAuthRedirect);

    const isPortalAuthFailure =
      status === 401 &&
      !isIntegrationRoute &&
      !isIntegrationErrorCode &&
      !isExplicitlyExempt;

    if (isPortalAuthFailure) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
