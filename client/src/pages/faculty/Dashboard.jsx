import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getSemesters } from '../../services/semester.service';
import { getMyOfferings, getMyDashboardStats } from '../../services/courseOffering.service';
import useToast from '../../hooks/useToast';
import Icon from '../../components/common/Icon';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import './FacultyDashboard.css';

const FacultyDashboard = () => {
  const toast = useToast();

  const [semesters, setSemesters] = useState([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [offerings, setOfferings] = useState([]);

  const [stats, setStats] = useState(null);
  const [loadingSemesters, setLoadingSemesters] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);

  /* ── Load semesters on mount ─────────────────────────────────────────── */
  const loadSemesters = useCallback(async () => {
    setLoadingSemesters(true);
    try {
      const { semesters: fetchedSemesters } = await getSemesters();
      const loaded = fetchedSemesters || [];
      setSemesters(loaded);

      // Auto-select the active semester, or fallback to the first semester
      const active = loaded.find((s) => s.status === 'active');
      if (active) {
        setSelectedSemesterId(active._id);
      } else if (loaded.length > 0) {
        // Fallback to first semester if none is explicitly marked active
        setSelectedSemesterId(loaded[0]._id);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load semesters.');
    } finally {
      setLoadingSemesters(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSemesters();
  }, [loadSemesters]);

  /* ── Load offerings + stats when semester changes ─────────────────────── */
  const loadDashboardData = useCallback(async (semId) => {
    if (!semId) {
      setOfferings([]);
      setStats(null);
      return;
    }

    setLoadingData(true);
    setError(null);
    try {
      const [offeringsRes, statsRes] = await Promise.all([
        getMyOfferings(semId, true),
        getMyDashboardStats(semId),
      ]);
      setOfferings(offeringsRes.offerings || []);
      setStats(statsRes.stats || null);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load dashboard data.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedSemesterId) {
      loadDashboardData(selectedSemesterId);
    }
  }, [selectedSemesterId, loadDashboardData]);

  const selectedSemester = semesters.find((s) => s._id === selectedSemesterId);
  const selectedSemesterName = selectedSemester?.name || '';
  const hasActiveSemesterConfigured = semesters.some((s) => s.status === 'active');

  /* ── 4 Modern Summary Metrics Cards ──────────────────────────────────── */
  const statCards = stats
    ? [
        {
          label: 'Assigned Courses',
          value: stats.assignedCourses ?? stats.totalCourses ?? 0,
          color: 'blue',
          sub: null,
        },
        {
          label: 'Completed Checklists',
          value: stats.completedChecklists ?? 0,
          color: 'green',
          sub: `${
            (stats.assignedCourses ?? stats.totalCourses ?? 0) > 0
              ? Math.round(
                  ((stats.completedChecklists ?? 0) /
                    (stats.assignedCourses ?? stats.totalCourses ?? 1)) *
                    100
                )
              : 0
          }% completed`,
        },
        {
          label: 'Average Progress',
          value: `${stats.averageChecklistProgress ?? 0}%`,
          color: 'purple',
          sub: null,
        },
        {
          label: 'Drive Synced',
          value: stats.fullySyncedCourses ?? 0,
          color: 'indigo',
          sub: `${stats.driveSyncRate ?? 0}% fully synced`,
        },
      ]
    : [];

  return (
    <div className="faculty-dashboard">
      <div className="faculty-header">
        <div>
          <h1 className="faculty-heading">Faculty Dashboard</h1>
        </div>

        {selectedSemesterName && (
          <div className="faculty-header-badges">
            <span className="faculty-header-badge faculty-header-badge--semester">
              <span className="faculty-active-dot" />
              <span>Semester: <strong>{selectedSemesterName}</strong></span>
            </span>
          </div>
        )}
      </div>

      {/* ── Academic Semester Selector Bar ── */}
      <div className="faculty-toolbar-panel">
        <div className="faculty-toolbar-left">
          <label htmlFor="faculty-semester-select" className="faculty-toolbar-label">
            <Icon name="calendar" size={14} />
            <span>Academic Semester:</span>
          </label>
          {loadingSemesters ? (
            <span className="faculty-toolbar-loading">Loading semesters...</span>
          ) : semesters.length === 0 ? (
            <span className="faculty-toolbar-empty">No semesters configured</span>
          ) : (
            <div className="faculty-select-wrapper">
              <select
                id="faculty-semester-select"
                className="faculty-select"
                value={selectedSemesterId}
                onChange={(e) => setSelectedSemesterId(e.target.value)}
                aria-label="Select academic semester"
              >
                <option value="">-- Select semester --</option>
                {semesters.map((sem) => (
                  <option key={sem._id} value={sem._id}>
                    {sem.name} {sem.status === 'active' ? '(Active)' : ''}
                  </option>
                ))}
              </select>
              <span className="faculty-select-icon">
                <Icon name="chevron-down" size={15} />
              </span>
            </div>
          )}
        </div>

        {!hasActiveSemesterConfigured && selectedSemesterId && (
          <div className="faculty-toolbar-note">
            <Icon name="alert" size={14} />
            <span>Archive / Upcoming semester view</span>
          </div>
        )}
      </div>

      {/* ── Modern 4 Summary Cards Grid ──────────────────────────────────── */}
      {selectedSemesterId && (
        <div className="faculty-stats-grid">
          {loadingData ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="faculty-stat-card" style={{ opacity: 0.6 }}>
                <span className="faculty-stat-value" style={{ color: 'var(--cfes-slate-300)' }}>
                  —
                </span>
                <span className="faculty-stat-label">Loading metric...</span>
              </div>
            ))
          ) : stats ? (
            statCards.map((card) => (
              <div
                key={card.label}
                className={`faculty-stat-card faculty-stat-card--${card.color}`}
              >
                <span className="faculty-stat-value">{card.value}</span>
                <span className="faculty-stat-label">{card.label}</span>
                {card.sub && <span className="faculty-stat-sub">{card.sub}</span>}
              </div>
            ))
          ) : null}
        </div>
      )}

      {/* ── Assigned Courses List Panel ───────────────────────────────────── */}
      <div className="faculty-panel">
        <h2 className="faculty-section-title">
          <span>Assigned Courses{selectedSemesterName ? ` — ${selectedSemesterName}` : ''}</span>
        </h2>

        {!selectedSemesterId ? (
          <div className="faculty-empty-state">
            <p>Select an academic semester above to view your courses.</p>
          </div>
        ) : loadingData ? (
          <div className="faculty-empty-state">
            <p>Loading assigned courses and progress...</p>
          </div>
        ) : error ? (
          <div className="faculty-error-state">
            <p className="faculty-error-text">{error}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadDashboardData(selectedSemesterId)}
            >
              Retry
            </Button>
          </div>
        ) : offerings.length === 0 ? (
          <div className="faculty-empty-state">
            <p>No courses assigned to you for this semester.</p>
          </div>
        ) : (
          <div className="faculty-course-list">
            {offerings.map((offering) => {
              const checklistStatus = offering.progress?.status || 'Not Started';
              const driveStatus = offering.drive?.status || 'Not Synced';
              const completedCount = offering.progress?.completedCount ?? 0;
              const totalCount = offering.progress?.totalCount ?? 19;
              const completionPct = offering.progress?.completionPercentage ?? 0;
              const driveFolderUrl = offering.drive?.folderUrl;

              return (
                <div key={offering._id} className="faculty-course-item">
                  <Link
                    to={`/faculty/offering/${offering._id}`}
                    className="faculty-course-main"
                    title={`View checklist for ${offering.course?.courseCode || 'Course'}`}
                  >
                    <div className="faculty-course-content">
                      <div className="faculty-course-header-row">
                        <span className="faculty-course-code">
                          {offering.course?.courseCode || 'COURSE'}
                        </span>
                        <span className="faculty-course-section-badge">
                          Section {offering.section || 'A'}
                        </span>
                        <StatusBadge
                          status={
                            checklistStatus === 'Complete'
                              ? 'active'
                              : checklistStatus === 'In Progress'
                              ? 'in-progress'
                              : 'neutral'
                          }
                          label={checklistStatus}
                          size="sm"
                        />
                        <StatusBadge
                          status={
                            driveStatus === 'Synced'
                              ? 'active'
                              : driveStatus === 'Partially Synced'
                              ? 'in-progress'
                              : 'neutral'
                          }
                          label={driveStatus}
                          size="sm"
                        />
                      </div>

                      <span className="faculty-course-name">
                        {offering.course?.courseName || 'Untitled Course'}
                      </span>

                      <div className="faculty-course-progress-row">
                        <span className="faculty-progress-text">
                          Checklist: <strong>{completedCount} / {totalCount}</strong> ({completionPct}%)
                        </span>
                        <div className="faculty-progress-track">
                          <div
                            className={`faculty-progress-fill ${
                              checklistStatus === 'Complete'
                                ? 'faculty-progress-fill--complete'
                                : ''
                            }`}
                            style={{ width: `${Math.min(100, completionPct)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div className="faculty-course-actions">
                    {driveFolderUrl && (
                      <a
                        href={driveFolderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="faculty-drive-btn"
                        title="Open Google Drive Course Folder"
                      >
                        <Icon name="folder" size={14} />
                        <span>Open Drive</span>
                        <Icon name="external" size={12} />
                      </a>
                    )}
                    <Link
                      to={`/faculty/offering/${offering._id}`}
                      className="faculty-course-arrow"
                      title="Open Course Checklist"
                      aria-label={`Open checklist for ${offering.course?.courseCode}`}
                    >
                      <Icon name="chevron-right" size={20} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultyDashboard;
