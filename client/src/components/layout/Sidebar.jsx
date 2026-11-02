/**
 * Sidebar.jsx — Navigation sidebar with institutional styling and role-aware menu items.
 */
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import Icon from '../common/Icon';
import Modal from '../common/Modal';
import Button from '../common/Button';
import './Sidebar.css';

const DEAN_LINKS = [
  { to: '/dean/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/dean/submissions', label: 'Submissions', icon: 'document' },
  { to: '/dean/users', label: 'Users', icon: 'users' },
  { to: '/dean/courses', label: 'Courses', icon: 'book' },
  { to: '/dean/departments', label: 'Departments', icon: 'building' },
];

const HOD_LINKS = [
  { to: '/hod/dashboard', label: 'Dashboard (HoD)', icon: 'dashboard' },
  { to: '/hod/submissions', label: 'Submissions', icon: 'document' },
  { to: '/hod/faculty', label: 'Department Faculty', icon: 'users' },
  { to: '/hod/courses', label: 'Course Allocation', icon: 'book' },
  { to: '/faculty/dashboard', label: 'My Faculty View', icon: 'view' },
];

const FACULTY_LINKS = [
  { to: '/faculty/dashboard', label: 'Dashboard', icon: 'dashboard' },
];

const Sidebar = ({ isOpen = false, onClose }) => {
  const { user, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  let links = FACULTY_LINKS;
  if (user?.designation === 'dean') links = DEAN_LINKS;
  if (user?.designation === 'hod') links = HOD_LINKS;

  const handleLogout = () => {
    setShowLogoutModal(false);
    logout();
    if (onClose) onClose();
  };

  return (
    <>
      <button
        type="button"
        className={`sidebar-backdrop ${isOpen ? 'sidebar-backdrop--show' : ''}`}
        aria-label="Close navigation overlay"
        onClick={onClose}
      />
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        {/* Brand / University Header */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">IU</div>
          <div className="sidebar-brand-info">
            <span className="sidebar-brand-name">CFES</span>
            <span className="sidebar-brand-sub">Iqra University</span>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="sidebar-section-label">MAIN NAVIGATION</div>
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
              <span className="sidebar-icon">
                <Icon name={icon} size={18} />
              </span>
              <span className="sidebar-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer / Logout */}
        <div className="sidebar-footer">
          <button
            id="sidebar-logout"
            type="button"
            className="sidebar-logout"
            onClick={() => setShowLogoutModal(true)}
          >
            <span className="sidebar-icon">
              <Icon name="logout" size={18} />
            </span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Confirm Logout"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowLogoutModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleLogout}
            >
              Log Out
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, color: 'var(--cfes-slate-600)', fontSize: 'var(--cfes-font-base)' }}>
          Are you sure you want to log out of your session? Any unsaved form edits may be lost.
        </p>
      </Modal>
    </>
  );
};

export default Sidebar;
