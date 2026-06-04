/**
 * DesignationRoute.jsx — Blocks users whose designation is not in allowedDesignations.
 */
import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const DesignationRoute = ({ allowedDesignations = [] }) => {
  const { user } = useAuth();

  if (!user || !allowedDesignations.includes(user.designation)) {
    // Redirect to the user's own dashboard instead of login
    let fallback = '/faculty/dashboard';
    if (user?.designation === 'dean') {
      fallback = '/dean/dashboard';
    } else if (user?.designation === 'hod') {
      fallback = '/hod/dashboard';
    }
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
};

export default DesignationRoute;
