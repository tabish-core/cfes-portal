import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { getSemesters } from '../../services/semester.service';
import { getMyOfferings, getMyDashboardStats } from '../../services/courseOffering.service';
import useToast from '../../hooks/useToast';
import Icon from '../../components/common/Icon';
import './FacultyDashboard.css';

const FacultyDashboard = () => {
  const { user } = useAuth();

  const [semesters, setSemesters] = useState([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [offerings, setOfferings] = useState([]);

  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [loadingSemesters, setLoadingSemesters] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const toast = useToast();

  /* ── Load semesters on mount ─────────────────────────────────────────── */
  useEffect(() => {
    const loadSemesters = async () => {
      setLoadingSemesters(true);
      try {
        const { semesters } = await getSemesters();
        setSemesters(semesters || []);

        // Auto-select the active semester
        const active = (semesters || []).find((s) => s.status === 'active');
        if (active) setSelectedSemesterId(active._id);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load semesters.');
      } finally {
        setLoadingSemesters(false);
      }
    };

    loadSemesters();
  }, [toast]);

  /* ── Load offerings + stats when semester changes ─────────────────────── */
  useEffect(() => {
    if (!selectedSemesterId) {
      setOfferings([]);
      setStats(null);
      return;
    }

    const loadData = async () => {
      setLoadingCourses(true);
      setLoadingStats(true);
      try {
        const [offeringsRes, statsRes] = await Promise.all([
          getMyOfferings(selectedSemesterId),
          getMyDashboardStats(selectedSemesterId),
        ]);
        setOfferings(offeringsRes.offerings || []);
        setStats(statsRes.stats || null);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load dashboard data.');
      } finally {
        setLoadingCourses(false);
        setLoadingStats(false);
      }
    };

    loadData();
  }, [selectedSemesterId, toast]);

  const selectedSemesterName = semesters.find((s) => s._id === selectedSemesterId)?.name || '';

  /* ── Stat card configuration ─────────────────────────────────────────── */
  const statCards = stats
    ? [
      { label: 'Assigned Courses', value: stats.totalCourses ?? 0, color: 'blue' },
      { label: 'Total Forms Available', value: stats.totalForms ?? 0, color: 'purple' },
      { label: 'Draft Forms', value: stats.draftForms ?? 0, color: 'yellow' },
      { label: 'Submitted Forms', value: stats.submittedForms ?? 0, color: 'green' },
      { label: 'Pending Forms', value: stats.pendingForms ?? 0, color: 'red' },
    ]
    : [];

  return (
    <div className="faculty-dashboard">
      <div className="faculty-header">
        <h1 className="faculty-heading">Welcome, {user?.name || 'Faculty Member'}</h1>
        <p className="faculty-sub">Select an academic semester to view your assigned courses and submission progress.</p>
      </div>

      {/* ── Semester Picker ──────────────────────────────────────────────── */}
      <div className="faculty-panel">
        <h2 className="faculty-section-title">Academic Semester</h2>
        {loadingSemesters ? (
          <div className="faculty-empty-state">
            <p>Loading semesters...</p>
          </div>
        ) : semesters.length === 0 ? (
          <div className="faculty-empty-state">
            <p>No semesters available. Please contact administrator.</p>
          </div>
        ) : (
          <div className="faculty-select-wrapper">
            <select
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
              <Icon name="chevron-down" size={16} />
            </span>
          </div>
        )}
      </div>

      {/* ── Stats Cards ──────────────────────────────────────────────────── */}
      {selectedSemesterId && (
        <div className="faculty-stats-grid">
          {loadingStats ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="faculty-stat-card" style={{ opacity: 0.6 }}>
                <span className="faculty-stat-value" style={{ color: 'var(--cfes-slate-300)' }}>—</span>
                <span className="faculty-stat-label">Loading...</span>
              </div>
            ))
          ) : stats ? (
            statCards.map((card) => (
              <div key={card.label} className={`faculty-stat-card faculty-stat-card--${card.color}`}>
                <span className="faculty-stat-value">{card.value}</span>
                <span className="faculty-stat-label">{card.label}</span>
              </div>
            ))
          ) : null}
        </div>
      )}

      {/* ── Course List ──────────────────────────────────────────────────── */}
      <div className="faculty-panel">
        <h2 className="faculty-section-title">
          Assigned Courses{selectedSemesterName ? ` — ${selectedSemesterName}` : ''}
        </h2>

        {!selectedSemesterId ? (
          <div className="faculty-empty-state">
            <p>Select an academic semester above to view your courses.</p>
          </div>
        ) : loadingCourses ? (
          <div className="faculty-empty-state">
            <p>Loading assigned courses...</p>
          </div>
        ) : offerings.length === 0 ? (
          <div className="faculty-empty-state">
            <p>No courses assigned for this semester.</p>
          </div>
        ) : (
          <div className="faculty-course-list">
            {offerings.map((offering) => (
              <Link
                key={offering._id}
                to={`/faculty/offering/${offering._id}`}
                className="faculty-course-item"
              >
                <div className="faculty-course-content">
                  <div className="faculty-course-header-row">
                    <span className="faculty-course-code">
                      {offering.course?.courseCode || 'COURSE'}
                    </span>
                    {offering.section && (
                      <span className="faculty-course-section-badge">
                        Section {offering.section}
                      </span>
                    )}
                  </div>
                  <span className="faculty-course-name">
                    {offering.course?.courseName || 'Untitled Course'}
                  </span>
                </div>
                <span className="faculty-course-arrow">
                  <Icon name="chevron-right" size={20} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultyDashboard;
