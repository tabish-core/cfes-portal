/**
 * ToastContext.jsx — Global toast notification system.
 *
 * Provides a `useToast()` hook with:
 *  toast.success(message) — green success notification
 *  toast.error(message)   — red error notification
 *  toast.warning(message) — amber warning notification
 *  toast.info(message)    — blue informational notification
 *
 * Toasts auto-dismiss after a configurable duration and can be manually closed.
 */
import { createContext, useState, useCallback, useRef } from 'react';

export const ToastContext = createContext(null);

let nextId = 1;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, [removeToast]);

  const toast = {
    success: (message, duration) => addToast(message, 'success', duration ?? 4000),
    error:   (message, duration) => addToast(message, 'error',   duration ?? 6000),
    warning: (message, duration) => addToast(message, 'warning', duration ?? 5000),
    info:    (message, duration) => addToast(message, 'info',    duration ?? 4000),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Toast container — fixed overlay */}
      {toasts.length > 0 && (
        <div className="toast-container" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast--${t.type}`} role="alert">
              <span className="toast__icon">
                {t.type === 'success' && '✓'}
                {t.type === 'error' && '✕'}
                {t.type === 'warning' && '⚠'}
                {t.type === 'info' && 'ℹ'}
              </span>
              <span className="toast__message">{t.message}</span>
              <button
                className="toast__close"
                onClick={() => removeToast(t.id)}
                aria-label="Close notification"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
};
