/**
 * RoleRoute.jsx — Blocks users whose role is not in allowedRoles.
 *
 * Usage (in App.jsx, nested inside ProtectedRoute):
 *   <Route element={<RoleRoute allowedRoles={['admin']} />}>
 *     <Route path="/admin/dashboard" element={<Dashboard />} />
 *   </Route>
 */
import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const RoleRoute = ({ allowedRoles = [] }) => {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    // Redirect to the user's own dashboard instead of login
    const fallback = user?.role === 'admin' ? '/admin/dashboard' : '/faculty/dashboard';
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
};

export default RoleRoute;
