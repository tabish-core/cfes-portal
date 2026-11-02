/**
 * Topbar.jsx — Institutional top header with user information and mobile menu toggle.
 */
import useAuth from '../../hooks/useAuth';
import Icon from '../common/Icon';
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
          <Icon name={isMenuOpen ? 'close' : 'menu'} size={18} />
        </button>
        <span className="topbar-title">Course File Editing &amp; Submission System</span>
      </div>
      <div className="topbar-right">
        <div className="topbar-user">
          <div className="topbar-avatar">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="topbar-user-info">
            <span className="topbar-name">{user?.name || 'Faculty Member'}</span>
            <span className="topbar-role">{user?.designation || user?.role || 'Faculty'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
