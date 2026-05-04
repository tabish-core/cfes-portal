/**
 * Topbar.jsx — Page header with user info and logout shortcut.
 */
import useAuth from '../../hooks/useAuth';
import './Topbar.css';

const Topbar = ({ onToggleMenu, isMenuOpen }) => {
  const { user } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-menu-btn"
          onClick={onToggleMenu}
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
        >
          <span />
          <span />
          <span />
        </button>
        <span className="topbar-title">Course File Editing & Submission System</span>
      </div>
      <div className="topbar-right">
        <div className="topbar-user">
          <div className="topbar-avatar">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="topbar-user-info">
            <span className="topbar-name">{user?.name}</span>
            <span className="topbar-role">{user?.role}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
