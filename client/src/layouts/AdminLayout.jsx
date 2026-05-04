/**
 * AdminLayout.jsx — Shell for all admin pages.
 * Renders Sidebar + Topbar + page content via <Outlet />.
 */
import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Topbar  from '../components/layout/Topbar';
import './Layout.css';

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={`app-shell ${sidebarOpen ? 'app-shell--menu-open' : ''}`}>
      <Sidebar
        role="admin"
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

export default AdminLayout;
