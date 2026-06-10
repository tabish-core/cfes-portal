/**
 * Sidebar.jsx — Navigation sidebar, role-aware menu items.
 */
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import './Sidebar.css';

const DEAN_LINKS = [
  { to: '/dean/dashboard',   label: 'Dashboard'},
  { to: '/dean/submissions', label: 'Submissions'},
  { to: '/dean/users',       label: 'Users'},
  { to: '/dean/courses',     label: 'Courses'},
  { to: '/dean/departments', label: 'Departments'},
];

const HOD_LINKS = [
  { to: '/hod/dashboard',    label: 'Dashboard (HoD)'},
  { to: '/hod/submissions',  label: 'Submissions'},
  { to: '/hod/faculty',      label: 'Department Faculty'},
  { to: '/hod/courses',      label: 'Course Allocation'},
  { to: '/faculty/dashboard',label: 'My Faculty View'},
];

const FACULTY_LINKS = [
  { to: '/faculty/dashboard', label: 'Dashboard'},
];

const Sidebar = ({ isOpen = false, onClose }) => {
  const { user, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  let links = FACULTY_LINKS;
  if (user?.designation === 'dean') links = DEAN_LINKS;
  if (user?.designation === 'hod') links = HOD_LINKS;

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
        onClick={() => setShowLogoutModal(true)}
      >
        Logout
      </button>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="logout-modal-overlay">
          <div className="logout-modal">
            <h3 className="logout-modal-title">Confirm Logout</h3>
            <p className="logout-modal-text">Are you sure you want to logout?</p>
            <div className="logout-modal-actions">
              <button 
                className="logout-modal-btn logout-modal-btn--cancel"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button 
                className="logout-modal-btn logout-modal-btn--confirm"
                onClick={() => {
                  setShowLogoutModal(false);
                  logout();
                  if (onClose) onClose();
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
