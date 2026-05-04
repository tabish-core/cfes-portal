/**
 * axios.js — Pre-configured Axios instance.
 *
 * - baseURL points to the Express API (proxied in dev via vite.config.js)
 * - Request interceptor: attaches JWT from localStorage to every request
 * - Response interceptor: on 401, clears token and redirects to /login
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',          // Vite proxy forwards /api → http://localhost:5000/api
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
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
