/**
 * FacultyLayout.jsx — Shell for all faculty pages.
 */
import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Topbar  from '../components/layout/Topbar';
import './Layout.css';

const FacultyLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={`app-shell ${sidebarOpen ? 'app-shell--menu-open' : ''}`}>
      <Sidebar
        role="faculty"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main-area">
        <Topbar
          onToggleMenu={() => setSidebarOpen((prev) => !prev)}
          isMenuOpen={sidebarOpen}
        />
        <main className="page-content" onClick={() => sidebarOpen && setSidebarOpen(false)}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default FacultyLayout;
