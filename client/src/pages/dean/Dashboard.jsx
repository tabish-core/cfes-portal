import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useToast from '../../hooks/useToast';
import { getDeanDashboardStats } from '../../services/dashboard.service';
import Icon from '../../components/common/Icon';
import './Dashboard.css';

const AdminDashboard = () => {
  const toast = useToast();
  
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const res = await getDeanDashboardStats();
        if (isMounted) {
          setStats(res.data);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Failed to load dashboard stats:', error);
          toast.error('Failed to load dashboard statistics.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchStats();
    return () => {
      isMounted = false;
    };
  }, [toast]);

  // Loading skeleton layout
  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-heading">Dean Dashboard</h1>
            <p className="dashboard-sub">Loading institutional metrics...</p>
          </div>
        </div>
        <div className="stats-grid">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="stat-card" style={{ opacity: 0.6 }}>
              <span className="stat-value" style={{ color: '#cbd5e1' }}>—</span>
              <span className="stat-label">Loading metric...</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasActiveSemester = Boolean(stats?.activeSemester);

  const statCards = [
    {
      id: 'stat-departments',
      label: 'Departments',
      value: stats?.totalDepartments ?? 0,
      subtext: 'Institutional departments',
      color: 'blue',
    },
    {
      id: 'stat-faculty',
      label: 'Active Faculty',
      value: stats?.activeFaculty ?? 0,
      subtext: `${stats?.totalHods ?? 0} Head(s) of Dept`,
      color: 'purple',
    },
    {
      id: 'stat-courses',
      label: 'Course Catalog',
      value: stats?.totalCourses ?? 0,
      subtext: 'Registered catalog courses',
      color: 'green',
    },
    {
      id: 'stat-offerings',
      label: 'Active Offerings',
      value: stats?.totalOfferings ?? 0,
      subtext: hasActiveSemester ? (stats?.activeSemester?.name || 'Active Semester') : 'No active semester',
      color: 'blue',
    },
    {
      id: 'stat-unassigned',
      label: 'Unassigned Offerings',
      value: stats?.unassignedOfferings ?? 0,
      subtext: 'Requires faculty allocation',
      color: stats?.unassignedOfferings > 0 ? 'red' : 'green',
    },
    {
      id: 'stat-checklist',
      label: 'Checklist Compliance',
      value: hasActiveSemester ? `${stats?.checklistCompletionPercentage ?? 0}%` : '—',
      subtext: hasActiveSemester ? 'Active semester average' : 'Requires active semester',
      color: (stats?.checklistCompletionPercentage ?? 0) >= 70 ? 'green' : 'yellow',
    },
    {
      id: 'stat-drive-sync',
      label: 'Google Drive Sync',
      value: hasActiveSemester ? `${stats?.driveSync?.syncRate ?? 0}%` : '—',
      subtext: hasActiveSemester
        ? `${stats?.driveSync?.offeringsWithFilesCount ?? 0}/${stats?.totalOfferings ?? 0} offerings (${stats?.driveSync?.totalSyncedFiles ?? 0} files)`
        : 'Requires active semester',
      color: (stats?.driveSync?.syncRate ?? 0) >= 70 ? 'green' : 'yellow',
    },
  ];

  const quickLinks = [
    {
      to: '/dean/users',
      label: 'Faculty Management',
      desc: 'Create, view, and update faculty credentials and designations',
      icon: 'users',
    },
    {
      to: '/dean/courses',
      label: 'Course Allocation',
      desc: 'Configure semesters and assign instructors to course sections',
      icon: 'book',
    },
    {
      to: '/dean/departments',
      label: 'Department Management',
      desc: 'Manage university departments and assign Heads of Department',
      icon: 'building',
    },
    {
      to: '/dean/submissions',
      label: 'Submissions & Audit',
      desc: 'Inspect course file completion, checklist status, and Drive folders',
      icon: 'document',
    },
  ];

  const departments = stats?.departments || [];

  return (
    <div className="dashboard">
      {/* Header Container */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-heading">Dean Dashboard</h1>
          <p className="dashboard-sub">Institutional oversight and active semester course file monitoring.</p>
        </div>

        <div className="dashboard-header-badge-wrap">
          {hasActiveSemester ? (
            <span className="dashboard-semester-badge">
              Active Semester: <strong>{stats.activeSemester.name}</strong>
            </span>
          ) : (
            <span className="dashboard-semester-badge dashboard-semester-badge--inactive">
              No active semester
            </span>
          )}
        </div>
      </div>

      {/* No Active Semester Warning Notice */}
      {!hasActiveSemester && (
        <div className="dashboard-alert dashboard-alert--warning">
          <div className="dashboard-alert-content">
            <span className="dashboard-alert-icon">
              <Icon name="alert" size={18} />
            </span>
            <span>
              <strong>No active academic semester.</strong> Activate or create a semester under Course Allocation to track semester-specific offerings, compliance, and Drive synchronization.
            </span>
          </div>
          <Link to="/dean/courses" className="dashboard-alert-btn">
            Manage Semesters &rarr;
          </Link>
        </div>
      )}

      {/* Primary Key Statistics Grid */}
      <div className="stats-grid">
        {statCards.map((card) => (
          <div key={card.id} className={`stat-card stat-card--${card.color}`}>
            <span className="stat-value">{card.value}</span>
            <span className="stat-label">{card.label}</span>
            <span className="stat-card-subtext">{card.subtext}</span>
          </div>
        ))}
      </div>

      {/* Department Overview Table */}
      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2 className="dashboard-section-title">Department Overview</h2>
            <p className="dashboard-section-sub">
              Breakdown of course offerings, assigned faculty, and checklist completion by department.
            </p>
          </div>
        </div>

        {departments.length === 0 ? (
          <div className="dashboard-empty-panel">
            <p>No active departments registered in the system.</p>
          </div>
        ) : (
          <div className="dashboard-table-container">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>Department</th>
                  <th style={{ width: '20%', textAlign: 'center' }}>Active Offerings</th>
                  <th style={{ width: '20%', textAlign: 'center' }}>Faculty Members</th>
                  <th style={{ width: '25%' }}>Checklist Compliance</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept._id}>
                    <td>
                      <span className="dept-code">{dept.code}</span>
                      <span className="dept-name">{dept.name}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <strong>{dept.offeringsCount}</strong>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {dept.facultyCount}
                    </td>
                    <td>
                      {hasActiveSemester ? (
                        <div className="progress-cell">
                          <div className="progress-track" aria-hidden="true">
                            <div
                              className="progress-fill"
                              style={{ width: `${Math.min(100, Math.max(0, dept.checklistCompletionPct))}%` }}
                            />
                          </div>
                          <span className="progress-text">{dept.checklistCompletionPct}%</span>
                        </div>
                      ) : (
                        <span className="dashboard-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Administrative Quick Links */}
      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2 className="dashboard-section-title">Administrative Quick Links</h2>
            <p className="dashboard-section-sub">
              Direct access to core administrative functions.
            </p>
          </div>
        </div>

        <div className="quick-links-grid">
          {quickLinks.map((link) => (
            <Link key={link.to} to={link.to} className="quick-link-card">
              <div className="quick-link-icon">
                <Icon name={link.icon} size={20} />
              </div>
              <div className="quick-link-body">
                <h3 className="quick-link-title">{link.label}</h3>
                <p className="quick-link-desc">{link.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
