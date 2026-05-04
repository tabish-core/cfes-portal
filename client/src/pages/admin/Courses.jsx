import { useEffect, useState } from 'react';
import { getFaculties } from '../../services/auth.service';
import { getCourses, assignCourseFaculty, unassignCourseFaculty } from '../../services/course.service';
import './Courses.css';

const Courses = () => {
  const [faculties, setFaculties] = useState([]);
  const [courses, setCourses] = useState([]);
  
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  
  const [loadingList, setLoadingList] = useState(true);
  const [assigning, setAssigning] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = async () => {
    setLoadingList(true);
    try {
      const [facultyRes, courseRes] = await Promise.all([
        getFaculties(),
        getCourses(),
      ]);
      setFaculties(facultyRes.faculties);
      setCourses(courseRes.courses);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load initial data.');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssign = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedCourseId || !selectedFacultyId) {
      setError('Please select both a course and a faculty member.');
      return;
    }

    setAssigning(true);
    try {
      const { course } = await assignCourseFaculty(selectedCourseId, selectedFacultyId, true); // Use force in case it's a reassign
      setSuccess(`Faculty successfully assigned to ${course.courseCode}.`);
      
      // Update local state to reflect reassignment
      setCourses((prev) =>
        prev.map((c) => (c._id === course._id ? course : c))
      );
      
      setSelectedCourseId('');
      setSelectedFacultyId('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign course.');
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (courseId) => {
      setError('');
      setSuccess('');
      try {
        const { course } = await unassignCourseFaculty(courseId);
        setSuccess(`Faculty removed from ${course.courseCode}.`);
        setCourses((prev) =>
            prev.map((c) => (c._id === course._id ? course : c))
        );
      } catch (err) {
         setError(err.response?.data?.message || 'Failed to unassign course.');
      }
  }

  return (
    <div className="courses-page">
      <h1 className="courses-heading">Course Allocation</h1>
      <p className="courses-sub">Assign faculty members to specific courses.</p>

      <div className="courses-card">
        <h2 className="courses-card-title">Assign Course</h2>
        <form onSubmit={handleAssign} className="courses-form">
          <div className="courses-form-group">
            <label className="courses-label" htmlFor="course-select">Select Course</label>
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

          <div className="courses-form-group">
            <label className="courses-label" htmlFor="faculty-select">Select Faculty</label>
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

          {error && <div className="courses-alert courses-alert-error">{error}</div>}
          {success && <div className="courses-alert courses-alert-success">{success}</div>}

          <button type="submit" className="courses-submit" disabled={assigning || loadingList}>
            {assigning ? 'Assigning...' : 'Assign Faculty'}
          </button>
        </form>
      </div>

      <div className="courses-card courses-card-section">
        <h2 className="courses-card-title">Assigned Courses</h2>
        {loadingList ? (
          <p className="courses-muted">Loading courses...</p>
        ) : courses.filter((c) => c.assignedFaculty).length === 0 ? (
          <p className="courses-muted">No courses are currently assigned.</p>
        ) : (
          <div className="courses-table-wrap">
            <table className="courses-table">
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Course Name</th>
                  <th>Assigned Faculty</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {courses
                  .filter((c) => c.assignedFaculty)
                  .map((course) => (
                    <tr key={course._id}>
                      <td>{course.courseCode}</td>
                      <td>{course.courseName}</td>
                      <td>{course.assignedFaculty.name}</td>
                      <td>
                        <button
                          type="button"
                          className="courses-link-btn courses-link-btn--danger"
                          onClick={() => handleUnassign(course._id)}
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
