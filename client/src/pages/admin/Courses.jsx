import { useEffect, useState } from 'react';
import { getFaculties } from '../../services/auth.service';
import { getCourses } from '../../services/course.service';
import { getSemesters, createSemester, toggleSemesterStatus } from '../../services/semester.service';
import { createOffering, removeOffering, getOfferingsBySemester } from '../../services/courseOffering.service';
import './Courses.css';

const Courses = () => {
  const [faculties, setFaculties] = useState([]);
  const [courses, setCourses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [offerings, setOfferings] = useState([]);

  // Assignment form state
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [section, setSection] = useState('A');

  // Semester creation state
  const [newSemesterName, setNewSemesterName] = useState('');
  const [creatingSemester, setCreatingSemester] = useState(false);

  // Offerings table filter
  const [viewSemesterId, setViewSemesterId] = useState('');

  const [loadingList, setLoadingList] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [loadingOfferings, setLoadingOfferings] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /* ── Initial data fetch ───────────────────────────────────────────────── */
  const fetchData = async () => {
    setLoadingList(true);
    try {
      const [facultyRes, courseRes, semesterRes] = await Promise.all([
        getFaculties(),
        getCourses(),
        getSemesters(),
      ]);
      setFaculties(facultyRes.faculties);
      setCourses(courseRes.courses);
      setSemesters(semesterRes.semesters);

      // Auto-select the active semester for both assign form and view
      const active = semesterRes.semesters.find((s) => s.status === 'active');
      if (active) {
        setSelectedSemesterId(active._id);
        setViewSemesterId(active._id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load initial data.');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* ── Load offerings when viewSemesterId changes ───────────────────────── */
  useEffect(() => {
    if (!viewSemesterId) {
      setOfferings([]);
      return;
    }
    const loadOfferings = async () => {
      setLoadingOfferings(true);
      try {
        const { offerings } = await getOfferingsBySemester(viewSemesterId);
        setOfferings(offerings);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load offerings.');
      } finally {
        setLoadingOfferings(false);
      }
    };
    loadOfferings();
  }, [viewSemesterId]);

  /* ── Semester creation ────────────────────────────────────────────────── */
  const handleCreateSemester = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newSemesterName.trim()) {
      setError('Please enter a semester name.');
      return;
    }

    setCreatingSemester(true);
    try {
      const { semester } = await createSemester(newSemesterName.trim());
      setSemesters((prev) => [semester, ...prev]);
      setNewSemesterName('');
      setSuccess(`Semester "${semester.name}" created.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create semester.');
    } finally {
      setCreatingSemester(false);
    }
  };

  /* ── Semester toggle ──────────────────────────────────────────────────── */
  const handleToggleSemester = async (id) => {
    setError('');
    setSuccess('');
    try {
      const { semester } = await toggleSemesterStatus(id);
      // Refresh all semesters (toggle may deactivate others)
      const { semesters: updated } = await getSemesters();
      setSemesters(updated);
      setSuccess(`Semester "${semester.name}" is now ${semester.status}.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to toggle semester.');
    }
  };

  /* ── Course offering assignment ───────────────────────────────────────── */
  const handleAssign = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedCourseId || !selectedFacultyId || !selectedSemesterId) {
      setError('Please select a semester, course, and faculty member.');
      return;
    }

    setAssigning(true);
    try {
      const { offering } = await createOffering(
        selectedFacultyId,
        selectedCourseId,
        selectedSemesterId,
        section || 'A'
      );
      setSuccess(
        `Faculty assigned to ${offering.course.courseCode} (Section ${offering.section}) in ${offering.semester.name}.`
      );

      // Refresh offerings if viewing the same semester
      if (viewSemesterId === selectedSemesterId) {
        const { offerings: updated } = await getOfferingsBySemester(viewSemesterId);
        setOfferings(updated);
      }

      setSelectedCourseId('');
      setSelectedFacultyId('');
      setSection('A');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign course.');
    } finally {
      setAssigning(false);
    }
  };

  /* ── Unassign (remove offering) ───────────────────────────────────────── */
  const handleUnassign = async (offeringId) => {
    setError('');
    setSuccess('');
    try {
      await removeOffering(offeringId);
      setOfferings((prev) => prev.filter((o) => o._id !== offeringId));
      setSuccess('Course offering removed.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to unassign course.');
    }
  };

  return (
    <div className="courses-page">
      <h1 className="courses-heading">Course Allocation</h1>
      <p className="courses-sub">Manage semesters and assign faculty to courses.</p>

      {error && <div className="courses-alert courses-alert-error">{error}</div>}
      {success && <div className="courses-alert courses-alert-success">{success}</div>}

      {/* ── Semester Management ──────────────────────────────────────────── */}
      <div className="courses-card">
        <h2 className="courses-card-title">Manage Semesters</h2>

        <form onSubmit={handleCreateSemester} className="courses-semester-form">
          <input
            type="text"
            className="courses-input"
            placeholder="e.g. Fall 2025"
            value={newSemesterName}
            onChange={(e) => setNewSemesterName(e.target.value)}
            disabled={creatingSemester}
          />
          <button
            type="submit"
            className="courses-submit courses-submit--sm"
            disabled={creatingSemester}
          >
            {creatingSemester ? 'Creating...' : 'Create Semester'}
          </button>
        </form>

        {semesters.length > 0 && (
          <div className="courses-semester-list">
            {semesters.map((sem) => (
              <div key={sem._id} className="courses-semester-chip">
                <span className="courses-semester-name">{sem.name}</span>
                <span className={`courses-semester-badge ${sem.status === 'active' ? 'courses-semester-badge--active' : ''}`}>
                  {sem.status}
                </span>
                <button
                  type="button"
                  className="courses-link-btn"
                  onClick={() => handleToggleSemester(sem._id)}
                >
                  {sem.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Assignment Form ──────────────────────────────────────────────── */}
      <div className="courses-card courses-card-section">
        <h2 className="courses-card-title">Assign Course</h2>
        <form onSubmit={handleAssign} className="courses-form">
          <div className="courses-form-row">
            <div className="courses-form-group">
              <label className="courses-label" htmlFor="semester-select">Semester</label>
              <select
                id="semester-select"
                className="courses-input"
                value={selectedSemesterId}
                onChange={(e) => setSelectedSemesterId(e.target.value)}
                disabled={loadingList || assigning}
              >
                <option value="">-- Choose semester --</option>
                {semesters.map((sem) => (
                  <option key={sem._id} value={sem._id}>
                    {sem.name} {sem.status === 'active' ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="courses-form-group">
              <label className="courses-label" htmlFor="course-select">Course</label>
              <select
                id="course-select"
                className="courses-input"
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                disabled={loadingList || assigning}
              >
                <option value="">-- Choose a course --</option>
                {courses.map((course) => (
                  <option key={course._id} value={course._id}>
                    {course.courseCode} - {course.courseName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="courses-form-row">
            <div className="courses-form-group">
              <label className="courses-label" htmlFor="faculty-select">Faculty</label>
              <select
                id="faculty-select"
                className="courses-input"
                value={selectedFacultyId}
                onChange={(e) => setSelectedFacultyId(e.target.value)}
                disabled={loadingList || assigning}
              >
                <option value="">-- Choose a faculty --</option>
                {faculties.map((faculty) => (
                  <option key={faculty._id} value={faculty._id}>
                    {faculty.name} ({faculty.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="courses-form-group courses-form-group--narrow">
              <label className="courses-label" htmlFor="section-input">Section</label>
              <input
                id="section-input"
                type="text"
                className="courses-input"
                value={section}
                onChange={(e) => setSection(e.target.value.toUpperCase())}
                placeholder="A"
                maxLength={5}
                disabled={assigning}
              />
            </div>
          </div>

          <button type="submit" className="courses-submit" disabled={assigning || loadingList}>
            {assigning ? 'Assigning...' : 'Assign Faculty'}
          </button>
        </form>
      </div>

      {/* ── Offerings Table ──────────────────────────────────────────────── */}
      <div className="courses-card courses-card-section">
        <div className="courses-card-header">
          <h2 className="courses-card-title">Assigned Courses</h2>
          <select
            className="courses-input courses-input--inline"
            value={viewSemesterId}
            onChange={(e) => setViewSemesterId(e.target.value)}
          >
            <option value="">-- Select semester --</option>
            {semesters.map((sem) => (
              <option key={sem._id} value={sem._id}>
                {sem.name} {sem.status === 'active' ? '(Active)' : ''}
              </option>
            ))}
          </select>
        </div>

        {!viewSemesterId ? (
          <p className="courses-muted">Select a semester to view assignments.</p>
        ) : loadingOfferings ? (
          <p className="courses-muted">Loading offerings...</p>
        ) : offerings.length === 0 ? (
          <p className="courses-muted">No courses assigned in this semester.</p>
        ) : (
          <div className="courses-table-wrap">
            <table className="courses-table">
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Course Name</th>
                  <th>Section</th>
                  <th>Assigned Faculty</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {offerings.map((offering) => (
                  <tr key={offering._id}>
                    <td>{offering.course?.courseCode}</td>
                    <td>{offering.course?.courseName}</td>
                    <td>{offering.section}</td>
                    <td>{offering.faculty?.name}</td>
                    <td>
                      <button
                        type="button"
                        className="courses-link-btn courses-link-btn--danger"
                        onClick={() => handleUnassign(offering._id)}
                      >
                        Unassign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Courses;
