/**
 * useAuth.js — Custom hook for consuming AuthContext.
 * Throws a clear error if used outside <AuthProvider>.
 */
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
};

export default useAuth;
