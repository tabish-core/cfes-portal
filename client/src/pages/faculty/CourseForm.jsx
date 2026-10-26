import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import '../dean/Dashboard.css';
import CourseControlReportPage from '../../components/forms/CCR/CourseControlReportPage';
import CourseInformationSheetPage from '../../components/forms/CIS/CourseInformationSheetPage';
import CourseCompletionCertificatePage from '../../components/forms/CCC/CourseCompletionCertificatePage';
import CourseReviewReportTheoryPage from '../../components/forms/CRR/CourseReviewReportTheoryPage';
import QuizManagementPage from '../../components/forms/Quiz/QuizManagementPage';
import AssignmentManagementPage from '../../components/forms/Assignment/AssignmentManagementPage';
import TimetablePage from '../../components/forms/Timetable/TimetablePage';
import AttendanceRecordPage from '../../components/forms/Attendance/AttendanceRecordPage';
import ClassProjectPage from '../../components/forms/CCP/ClassProjectPage';
import LecturesPage from '../../components/forms/Lectures/LecturesPage';


const CourseForm = () => {
  const { courseId: paramCourseId, offeringId, formType } = useParams();
  const [offering, setOffering] = useState(null);
  const [loadingOffering, setLoadingOffering] = useState(Boolean(offeringId));

  useEffect(() => {
    if (!offeringId) return;
    const loadOffering = async () => {
      try {
        setLoadingOffering(true);
        const { data } = await api.get(`/offerings/${offeringId}`);
        setOffering(data.data?.offering || data.offering);
      } catch (err) {
        console.error('Failed to load offering details:', err);
      } finally {
        setLoadingOffering(false);
      }
    };
    loadOffering();
  }, [offeringId]);

  const activeCourseId = offering?.course?._id || paramCourseId;
  const isAttendance = formType === 'AR';
  const isProject = formType === 'ASSESS_PROJECT';
  const isLectures = formType === 'LECTURES';

  return (
    <div className="dashboard">
      <div className="dashboard-header-container">
        <Link
          to={offeringId ? `/faculty/offering/${offeringId}` : `/faculty/course/${paramCourseId}`}
          className="back-link"
        >
          ← Back to Checklist
        </Link>
        <h1 className="dashboard-heading">
          {isAttendance
            ? 'Attendance Record'
            : isProject
            ? 'CCP / Class Project'
            : isLectures
            ? 'Lectures'
            : `Submit ${formType}`}
        </h1>
        {offering && (
          <p className="dashboard-sub">
            {offering.course?.courseCode} - {offering.course?.courseName} ({offering.semester?.name ? `${offering.semester.name} - ` : ''}Section {offering.section || 'A'})
          </p>
        )}
      </div>

      <div className="dashboard-panel">
        {loadingOffering ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontStyle: 'italic' }}>
            Loading course offering details...
          </div>
        ) : formType === 'CCR' ? (
          <CourseControlReportPage courseId={activeCourseId} offeringId={offeringId} />
        ) : formType === 'CIS' ? (
          <CourseInformationSheetPage courseId={activeCourseId} offeringId={offeringId} />
        ) : formType === 'CCC' ? (
          <CourseCompletionCertificatePage courseId={activeCourseId} offeringId={offeringId} />
        ) : formType === 'CRR' ? (
          <CourseReviewReportTheoryPage courseId={activeCourseId} offeringId={offeringId} />
        ) : formType === 'ASSESS_QUIZ' ? (
          <QuizManagementPage courseId={activeCourseId} offeringId={offeringId} />
        ) : formType === 'ASSESS_ASSIGN' ? (
          <AssignmentManagementPage courseId={activeCourseId} offeringId={offeringId} />
        ) : formType === 'TIMETABLE' ? (
          <TimetablePage courseId={activeCourseId} offeringId={offeringId} />
        ) : formType === 'ASSESS_PROJECT' ? (
          <ClassProjectPage courseId={activeCourseId} offeringId={offeringId} />
        ) : isAttendance ? (
          <AttendanceRecordPage courseId={activeCourseId} offeringId={offeringId} />
        ) : isLectures ? (
          <LecturesPage courseId={activeCourseId} offeringId={offeringId} />
        ) : (
          <>
            <p>Multi-step form will be implemented in Phase 2.</p>
            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#3949ab' }}>Development info:</h3>
              <p style={{ fontSize: '0.85rem' }}><strong>Course ID:</strong> {activeCourseId}</p>
              {offeringId && <p style={{ fontSize: '0.85rem' }}><strong>Offering ID:</strong> {offeringId}</p>}
              <p style={{ fontSize: '0.85rem' }}><strong>Form Type:</strong> {formType}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CourseForm;

