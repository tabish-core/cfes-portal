import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { getMyCourses } from '../../services/course.service';
import '../admin/Dashboard.css';

const FacultyDashboard = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAssignedCourses = async () => {
      setLoadingCourses(true);
      setError('');

      try {
        const { courses } = await getMyCourses();
        setCourses(courses);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load assigned courses.');
      } finally {
        setLoadingCourses(false);
      }
    };

    loadAssignedCourses();
  }, []);

  return (
    <div className="dashboard">
      <h1 className="dashboard-heading">Welcome, {user?.name}</h1>
      <p className="dashboard-sub">Review the courses currently assigned to you.</p>

      <div className="dashboard-panel">
        <h2 className="dashboard-section-title">Assigned Courses</h2>

        {loadingCourses ? (
          <div className="empty-state">
            <p>Loading assigned courses...</p>
          </div>
        ) : error ? (
          <div className="dashboard-alert dashboard-alert-error">{error}</div>
        ) : courses.length === 0 ? (
          <div className="empty-state">
            <p>No courses assigned.</p>
          </div>
        ) : (
          <div className="course-list">
            {courses.map((course) => (
              <Link
                key={course._id}
                to={`/faculty/course/${course._id}`}
                className="course-list-item"
              >
                <span className="course-list-code">{course.courseCode}</span>
                <span className="course-list-name">{course.courseName}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultyDashboard;
