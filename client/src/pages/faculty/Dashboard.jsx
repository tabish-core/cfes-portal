import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { getSemesters } from '../../services/semester.service';
import { getMyOfferings, getMyDashboardStats } from '../../services/courseOffering.service';
import useToast from '../../hooks/useToast';
import '../dean/Dashboard.css';

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
        setSemesters(semesters);

        // Auto-select the active semester
        const active = semesters.find((s) => s.status === 'active');
        if (active) setSelectedSemesterId(active._id);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load semesters.');
      } finally {
        setLoadingSemesters(false);
      }
    };

    loadSemesters();
  }, []);

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
        setOfferings(offeringsRes.offerings);
        setStats(statsRes.stats);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load dashboard data.');
      } finally {
        setLoadingCourses(false);
        setLoadingStats(false);
      }
    };

    loadData();
  }, [selectedSemesterId]);

  const selectedSemesterName = semesters.find((s) => s._id === selectedSemesterId)?.name || '';

  /* ── Stat card configuration ─────────────────────────────────────────── */
  const statCards = stats
    ? [
        { label: 'Assigned Courses', value: stats.totalCourses, color: 'blue' },
        { label: 'Total Forms Available', value: stats.totalForms, color: 'purple' },
        { label: 'Draft Forms', value: stats.draftForms, color: 'yellow' },
        { label: 'Submitted Forms', value: stats.submittedForms, color: 'green' },
        { label: 'Pending Forms', value: stats.pendingForms, color: 'red' },
      ]
    : [];

  return (
    <div className="dashboard">
      <h1 className="dashboard-heading">Welcome, {user?.name}</h1>
      <p className="dashboard-sub">Select a semester to view your assigned courses.</p>

      {/* ── Semester Picker ──────────────────────────────────────────────── */}
      <div className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
        <h2 className="dashboard-section-title">Semester</h2>
        {loadingSemesters ? (
          <div className="empty-state">
            <p>Loading semesters...</p>
          </div>
        ) : semesters.length === 0 ? (
          <div className="empty-state">
            <p>No semesters available. Please contact admin.</p>
          </div>
        ) : (
          <select
            value={selectedSemesterId}
            onChange={(e) => setSelectedSemesterId(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '320px',
              padding: '0.6rem 0.8rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.95rem',
              color: '#1e293b',
              backgroundColor: '#ffffff',
              outline: 'none',
            }}
          >
            <option value="">-- Select semester --</option>
            {semesters.map((sem) => (
              <option key={sem._id} value={sem._id}>
                {sem.name} {sem.status === 'active' ? '(Active)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── Stats Cards ──────────────────────────────────────────────────── */}
      {selectedSemesterId && (
        <div style={{ marginBottom: '1.5rem' }}>
          {loadingStats ? (
            <div className="stats-grid">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="stat-card" style={{ opacity: 0.5 }}>
                  <span className="stat-value" style={{ color: '#cbd5e1' }}>—</span>
                  <span className="stat-label">Loading...</span>
                </div>
              ))}
            </div>
          ) : stats ? (
            <div className="stats-grid">
              {statCards.map((card) => (
                <div key={card.label} className={`stat-card stat-card--${card.color}`}>
                  <span className="stat-value">{card.value}</span>
                  <span className="stat-label">{card.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* ── Course List ──────────────────────────────────────────────────── */}
      <div className="dashboard-panel">
        <h2 className="dashboard-section-title">
          Assigned Courses{selectedSemesterName ? ` — ${selectedSemesterName}` : ''}
        </h2>

        {!selectedSemesterId ? (
          <div className="empty-state">
            <p>Select a semester above to view courses.</p>
          </div>
        ) : loadingCourses ? (
          <div className="empty-state">
            <p>Loading assigned courses...</p>
          </div>
        ) : offerings.length === 0 ? (
          <div className="empty-state">
            <p>No courses assigned for this semester.</p>
          </div>
        ) : (
          <div className="course-list">
            {offerings.map((offering) => (
              <Link
                key={offering._id}
                to={`/faculty/course/${offering.course._id}`}
                className="course-list-item"
              >
                <span className="course-list-code">{offering.course.courseCode}</span>
                <span className="course-list-name">
                  {offering.course.courseName}
                  {offering.section && offering.section !== 'A' ? ` (Section ${offering.section})` : ''}
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
