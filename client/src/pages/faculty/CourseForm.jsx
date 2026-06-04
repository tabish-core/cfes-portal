import { useParams, Link } from 'react-router-dom';
import '../dean/Dashboard.css';
import CourseControlReportPage from '../../components/forms/CCR/CourseControlReportPage';
import CourseInformationSheetPage from '../../components/forms/CIS/CourseInformationSheetPage';


const CourseForm = () => {
  const { courseId, formType } = useParams();

  return (
    <div className="dashboard">
      <div className="dashboard-header-container">
        <Link to={`/faculty/course/${courseId}`} className="back-link">
          ← Back to Checklist
        </Link>
        <h1 className="dashboard-heading">Submit {formType}</h1>
        <p className="dashboard-sub">Fill out the details for this course file.</p>
      </div>

      <div className="dashboard-panel">
        {formType === 'CCR' ? (
          <CourseControlReportPage courseId={courseId} />
        ) : formType === 'CIS' ? (
          <CourseInformationSheetPage courseId={courseId} />
        ) : (
          <>
            <p>Multi-step form will be implemented in Phase 2.</p>
            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#3949ab' }}>Development info:</h3>
              <p style={{ fontSize: '0.85rem' }}><strong>Course ID:</strong> {courseId}</p>
              <p style={{ fontSize: '0.85rem' }}><strong>Form Type:</strong> {formType}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CourseForm;
