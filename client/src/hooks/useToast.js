import { useContext } from 'react';
import { ToastContext } from '../context/ToastContext';

/**
 * useToast() — Access the global toast notification system.
 *
 * Returns:
 *  toast.success(message)
 *  toast.error(message)
 *  toast.warning(message)
 *  toast.info(message)
 */
const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default useToast;
