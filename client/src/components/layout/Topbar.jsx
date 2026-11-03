/**
 * Topbar.jsx — Institutional top header with user information and mobile menu toggle.
 */
import useAuth from '../../hooks/useAuth';
import Icon from '../common/Icon';
import { getUserRoleLabel, getUserDepartmentLabel } from '../../utils/userIdentity';
import './Topbar.css';

const Topbar = ({ onToggleMenu, isMenuOpen }) => {
  const { user } = useAuth();

  const isDean = user?.designation === 'dean';
  const roleLabel = getUserRoleLabel(user);
  const deptLabel = isDean ? 'University Administration' : getUserDepartmentLabel(user);

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
        {deptLabel && (
          <div
            className={`topbar-dept-pill ${
              isDean
                ? 'topbar-dept-pill--admin'
                : deptLabel === 'Department not assigned'
                ? 'topbar-dept-pill--unassigned'
                : 'topbar-dept-pill--dept'
            }`}
          >
            <Icon name="building" size={13} />
            <span>{deptLabel}</span>
          </div>
        )}

        <div className="topbar-user">
          <div className="topbar-avatar">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="topbar-user-info">
            <span className="topbar-name">{user?.name || roleLabel}</span>
            <span className="topbar-role">{roleLabel}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
