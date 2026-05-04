import { useParams, Link } from 'react-router-dom';
import '../admin/Dashboard.css';

const formTemplates = [
  { name: 'Course Information Sheet', formType: 'CIS' },
  { name: 'Weekly Plan', formType: 'WP' },
  { name: 'Course Control Report', formType: 'CCR' },
  { name: 'Timetable with consulting hours', formType: 'TIMETABLE' },
  { name: 'Attendance Record', formType: 'AR' },
  { name: 'Lectures', formType: 'LECTURES' }
];

const CourseTemplates = () => {
  const { courseId } = useParams();

  return (
    <div className="dashboard">
      <div className="dashboard-header-container">
        <Link to="/faculty/dashboard" className="back-link">
          ← Back to Courses
        </Link>
        <h1 className="dashboard-heading">Select Form Template</h1>
        <p className="dashboard-sub">Choose a form to fill out for this course.</p>
      </div>

      <div className="dashboard-panel">
        <h2 className="dashboard-section-title">Available Templates</h2>
        <div className="course-list">
          {formTemplates.map((form) => (
            <Link
              key={form.formType}
              to={`/course/${courseId}/form/${form.formType}`}
              className="course-list-item"
            >
              <span className="course-list-code">{form.formType}</span>
              <span className="course-list-name">{form.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CourseTemplates;
