/**
 * Sidebar.jsx — Navigation sidebar, role-aware menu items.
 */
import { NavLink } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import './Sidebar.css';

const ADMIN_LINKS = [
  { to: '/admin/dashboard',   label: 'Dashboard'},
  { to: '/admin/submissions', label: 'Submissions'},
  { to: '/admin/users',       label: 'Users'},
  { to: '/admin/courses',     label: 'Courses'},
];

const FACULTY_LINKS = [
  { to: '/faculty/dashboard', label: 'Dashboard'},
  { to: '/faculty/submit',    label: 'New File'},
];

const Sidebar = ({ role, isOpen = false, onClose }) => {
  const { logout } = useAuth();
  const links = role === 'admin' ? ADMIN_LINKS : FACULTY_LINKS;

  return (
    <>
      <button
        type="button"
        className={`sidebar-backdrop ${isOpen ? 'sidebar-backdrop--show' : ''}`}
        aria-label="Close menu overlay"
        onClick={onClose}
      />
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-brand">
        <span className="sidebar-logo">IU</span>
        <span className="sidebar-brand-name">CFES</span>
      </div>

      {/* Nav links */}
      <nav className="sidebar-nav">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
            }
          >
            <span className="sidebar-icon">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <button
        id="sidebar-logout"
        className="sidebar-logout"
        onClick={() => {
          logout();
          if (onClose) onClose();
        }}
      >
        Logout
      </button>
      </aside>
    </>
  );
};

export default Sidebar;
