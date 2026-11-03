import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import { getHodDashboardStats } from '../../services/dashboard.service';
import Icon from '../../components/common/Icon';
import StatusBadge from '../../components/common/StatusBadge';
import {
  HOD_QUICK_LINKS,
  computeHodDashboardCards,
  formatOfferingProgress,
} from './hodDashboardHelpers';
import '../dean/Dashboard.css';
import './Dashboard.css';

const HodDashboard = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getHodDashboardStats();
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
      const errMsg = err.response?.data?.message || 'Failed to load department dashboard statistics.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Loading skeleton layout
  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-heading">Department Dashboard</h1>
            <p className="dashboard-sub">Loading departmental metrics...</p>
          </div>
        </div>
        <div className="stats-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="stat-card" style={{ opacity: 0.6 }}>
              <span className="stat-value" style={{ color: '#cbd5e1' }}>—</span>
              <span className="stat-label">Loading metric...</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error boundary state when initial stats failed to load
  if (!stats && error) {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-heading">Department Dashboard</h1>
            <p className="dashboard-sub">Departmental overview and course file compliance.</p>
          </div>
        </div>
        <div className="dashboard-empty-panel">
          <p style={{ color: '#dc2626', fontWeight: 600, margin: '0 0 0.5rem' }}>{error}</p>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1rem' }}>
            Please ensure you are assigned to an active department, or try reloading the dashboard.
          </p>
          <button
            type="button"
            onClick={fetchStats}
            className="dashboard-alert-btn"
            style={{ cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const hasActiveSemester = Boolean(stats?.activeSemester);
  const deptObj =
    user?.department && typeof user.department === 'object' && user.department.name
      ? user.department
      : stats?.department && typeof stats.department === 'object' && stats.department.name
      ? stats.department
      : null;

  const headingTitle = deptObj?.name ? `${deptObj.name} Dashboard` : 'Department Dashboard';
  const statCards = computeHodDashboardCards(stats);
  const offerings = Array.isArray(stats?.offerings) ? stats.offerings : [];

  return (
    <div className="dashboard">
      {/* Header Container */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-heading">{headingTitle}</h1>
        </div>

        <div className="dashboard-header-badges">
          {hasActiveSemester ? (
            <span className="dashboard-badge dashboard-badge--semester">
              <span className="dashboard-active-dot" />
              <span>Active: <strong>{stats.activeSemester.name}</strong></span>
            </span>
          ) : (
            <span className="dashboard-badge dashboard-badge--inactive">
              No active semester
            </span>
          )}
        </div>
      </div>

      {/* Dismissible / Actionable Error Alert if background refresh fails */}
      {error && stats && (
        <div className="dashboard-alert dashboard-alert--error" role="alert">
          <div className="dashboard-alert-content">
            <span className="dashboard-alert-icon">
              <Icon name="alert" size={18} />
            </span>
            <span>
              <strong>Notice:</strong> {error}
            </span>
          </div>
          <button type="button" onClick={fetchStats} className="dashboard-alert-btn">
            Retry
          </button>
        </div>
      )}

      {/* No Active Semester Warning Banner */}
      {!hasActiveSemester && (
        <div className="dashboard-alert dashboard-alert--warning" role="alert">
          <div className="dashboard-alert-content">
            <span className="dashboard-alert-icon">
              <Icon name="alert" size={18} />
            </span>
            <span>
              <strong>No active academic semester.</strong> An active semester is required to track active offerings, checklist compliance, and Drive synchronization.
            </span>
          </div>
          <Link to="/hod/courses" className="dashboard-alert-btn">
            View Courses &rarr;
          </Link>
        </div>
      )}

      {/* 1. Six Compact Metric Cards */}
      <div className="stats-grid">
        {statCards.map((card) => (
          <div key={card.id} className={`stat-card stat-card--${card.color}`}>
            <span className="stat-value">{card.value}</span>
            <span className="stat-label">{card.label}</span>
            {card.subtext && <span className="stat-card-subtext">{card.subtext}</span>}
          </div>
        ))}
      </div>

      {/* 2. Department Course Progress Table */}
      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2 className="dashboard-section-title">Department Course Progress</h2>
          </div>
        </div>

        {!hasActiveSemester ? (
          <div className="dashboard-empty-panel">
            <p>No active semester configured. Activate a semester to view departmental offerings.</p>
          </div>
        ) : offerings.length === 0 ? (
          <div className="dashboard-empty-panel">
            <p>No active course offerings found for this semester.</p>
            <Link to="/hod/courses" className="dashboard-link-btn" style={{ marginTop: '0.75rem' }}>
              Allocate Courses &rarr;
            </Link>
          </div>
        ) : (
          <div className="dashboard-table-container">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Course</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Section</th>
                  <th style={{ width: '25%' }}>Assigned Instructor</th>
                  <th style={{ width: '20%' }}>Checklist Progress</th>
                  <th style={{ width: '15%' }}>Drive Sync Status</th>
                </tr>
              </thead>
              <tbody>
                {offerings.map((rawOffering) => {
                  const offering = formatOfferingProgress(rawOffering);
                  return (
                    <tr key={offering.id || Math.random()}>
                      <td>
                        <span className="dept-code">{offering.courseCode}</span>
                        <span className="dept-name">{offering.courseName}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="section-badge">{offering.section}</span>
                      </td>
                      <td>
                        {offering.instructor ? (
                          <div className="instructor-info">
                            <span className="instructor-name">{offering.instructor.name}</span>
                            {offering.instructor.email && (
                              <span className="dashboard-text-muted" style={{ fontSize: '0.78rem' }}>
                                {offering.instructor.email}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="unassigned-badge">Unassigned</span>
                        )}
                      </td>
                      <td>
                        <div className="progress-cell">
                          <div className="progress-track" aria-hidden="true">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${Math.min(100, Math.max(0, offering.completionPercentage))}%`,
                              }}
                            />
                          </div>
                          <span className="progress-text">
                            {offering.completedCount}/{offering.totalCount}
                          </span>
                        </div>
                      </td>
                      <td>
                        <StatusBadge
                          status={offering.driveStatusText}
                          variant={offering.driveVariant}
                          size="sm"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Department Quick Links */}
      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2 className="dashboard-section-title">Department Quick Links</h2>
            <p className="dashboard-section-sub">
              Direct access to departmental management and faculty tools.
            </p>
          </div>
        </div>

        <div className="quick-links-grid">
          {HOD_QUICK_LINKS.map((link) => (
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

export default HodDashboard;
