import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { getSemesters } from '../../services/semester.service';
import { getMyOfferings } from '../../services/courseOffering.service';
import '../admin/Dashboard.css';

const FacultyDashboard = () => {
  const { user } = useAuth();

  const [semesters, setSemesters] = useState([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [offerings, setOfferings] = useState([]);

  const [loadingSemesters, setLoadingSemesters] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [error, setError] = useState('');

  /* ── Load semesters on mount ─────────────────────────────────────────── */
  useEffect(() => {
    const loadSemesters = async () => {
      setLoadingSemesters(true);
      setError('');
      try {
        const { semesters } = await getSemesters();
        setSemesters(semesters);

        // Auto-select the active semester
        const active = semesters.find((s) => s.status === 'active');
        if (active) setSelectedSemesterId(active._id);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load semesters.');
      } finally {
        setLoadingSemesters(false);
      }
    };

    loadSemesters();
  }, []);

  /* ── Load offerings when semester changes ─────────────────────────────── */
  useEffect(() => {
    if (!selectedSemesterId) {
      setOfferings([]);
      return;
    }

    const loadOfferings = async () => {
      setLoadingCourses(true);
      setError('');
      try {
        const { offerings } = await getMyOfferings(selectedSemesterId);
        setOfferings(offerings);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load assigned courses.');
      } finally {
        setLoadingCourses(false);
      }
    };

    loadOfferings();
  }, [selectedSemesterId]);

  const selectedSemesterName = semesters.find((s) => s._id === selectedSemesterId)?.name || '';

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
        ) : error ? (
          <div className="dashboard-alert dashboard-alert-error">{error}</div>
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
