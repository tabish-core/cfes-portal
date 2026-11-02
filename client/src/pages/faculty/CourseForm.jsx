import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import api from '../../api/axios';
import Icon from '../../components/common/Icon';
import './CourseForm.css';

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
import ExamUploadSection from '../../components/forms/Exam/ExamUploadSection';
import { getOfferingFiles } from '../../services/courseFile.service';

import {
  FORM_TITLES,
  resolveFormTitle,
  resolveChecklistUrl,
  resolveTemplatesUrl,
  resolveWpRedirectUrl,
} from '../../services/courseNavigation.service';

const CourseForm = () => {
  const { courseId: paramCourseId, offeringId, formType } = useParams();
  const [offering, setOffering] = useState(null);
  const [loadingOffering, setLoadingOffering] = useState(Boolean(offeringId && offeringId !== 'undefined' && offeringId !== 'null'));
  const [examFiles, setExamFiles] = useState([]);

  const isAttendance = formType === 'AR';
  const isProject = formType === 'ASSESS_PROJECT';
  const isLectures = formType === 'LECTURES';
  const isMidterm = formType === 'ASSESS_MID';
  const isFinal = formType === 'ASSESS_FINAL';

  const validOfferingId = offeringId && offeringId !== 'undefined' && offeringId !== 'null' ? offeringId : null;
  const validParamCourseId = paramCourseId && paramCourseId !== 'undefined' && paramCourseId !== 'null' ? paramCourseId : null;

  const loadExamFiles = useCallback(async () => {
    if (!validOfferingId) return;
    try {
      const files = await getOfferingFiles(validOfferingId);
      setExamFiles(files || []);
    } catch (err) {
      console.warn('Could not load offering files for exam:', err);
    }
  }, [validOfferingId]);

  useEffect(() => {
    if (!validOfferingId) return;
    let isMounted = true;

    const loadOffering = async () => {
      try {
        setLoadingOffering(true);
        const { data } = await api.get(`/offerings/${validOfferingId}`);
        if (isMounted) {
          setOffering(data.data?.offering || data.offering);
        }
      } catch (err) {
        console.error('Failed to load offering details:', err);
      } finally {
        if (isMounted) {
          setLoadingOffering(false);
        }
      }
    };

    loadOffering();
    if (isMidterm || isFinal) {
      loadExamFiles();
    }

    return () => {
      isMounted = false;
    };
  }, [validOfferingId, isMidterm, isFinal, loadExamFiles]);

  const activeCourseId = offering?.course?._id || validParamCourseId;

  // ── Weekly Plan (WP) Route Redirection ───────────────────────────
  // Weekly Plan is canonical data inside the Course Information Sheet (CIS).
  // Redirect to CIS with anchor #weekly-plan to prevent data duplication.
  if (formType === 'WP') {
    const targetUrl = resolveWpRedirectUrl(validOfferingId, activeCourseId);
    return <Navigate to={targetUrl} state={{ focusSection: 'weekly-plan' }} replace />;
  }

  const checklistUrl = resolveChecklistUrl(validOfferingId, validParamCourseId);
  const templatesUrl = resolveTemplatesUrl(validOfferingId, validParamCourseId);
  const currentTitle = resolveFormTitle(formType);

  return (
    <div className="cfes-form-shell">
      {/* ── Compact Top Navigation & Breadcrumbs Bar ── */}
      <div className="cfes-form-nav-bar">
        <div className="cfes-form-nav-left">
          <Link
            to={checklistUrl}
            className="cfes-form-back-btn"
            title="Return to Course File Checklist"
          >
            <Icon name="chevron-left" size={14} />
            <span>Back to Checklist</span>
          </Link>

          <nav aria-label="Breadcrumb" className="cfes-form-breadcrumbs">
            <Link to={checklistUrl} className="cfes-form-crumb-link">
              Course Checklist
            </Link>
            <span className="cfes-form-crumb-sep">
              <Icon name="chevron-right" size={12} />
            </span>
            <Link to={templatesUrl} className="cfes-form-crumb-link">
              Course Forms
            </Link>
            <span className="cfes-form-crumb-sep">
              <Icon name="chevron-right" size={12} />
            </span>
            <span className="cfes-form-crumb-current" aria-current="page">
              {currentTitle}
            </span>
          </nav>
        </div>

        {offering && (
          <div className="cfes-form-context-badge">
            <Icon name="book" size={14} />
            <span className="cfes-form-context-code">{offering.course?.courseCode}</span>
            <span className="cfes-form-context-title">{offering.course?.courseName}</span>
            <span className="cfes-form-context-section">
              ({offering.semester?.name ? `${offering.semester.name} • ` : ''}Sec {offering.section || 'A'})
            </span>
          </div>
        )}
      </div>

      {/* ── Form Content Panel ── */}
      <div className="cfes-form-panel">
        {loadingOffering ? (
          <div className="cfes-form-loading-state">
            <Icon name="spinner" size={24} />
            <span>Loading course offering details...</span>
          </div>
        ) : formType === 'CCR' ? (
          <CourseControlReportPage courseId={activeCourseId} offeringId={validOfferingId} />
        ) : formType === 'CIS' ? (
          <CourseInformationSheetPage courseId={activeCourseId} offeringId={validOfferingId} />
        ) : formType === 'CCC' ? (
          <CourseCompletionCertificatePage courseId={activeCourseId} offeringId={validOfferingId} />
        ) : formType === 'CRR' ? (
          <CourseReviewReportTheoryPage courseId={activeCourseId} offeringId={validOfferingId} />
        ) : formType === 'ASSESS_QUIZ' ? (
          <QuizManagementPage courseId={activeCourseId} offeringId={validOfferingId} />
        ) : formType === 'ASSESS_ASSIGN' ? (
          <AssignmentManagementPage courseId={activeCourseId} offeringId={validOfferingId} />
        ) : formType === 'TIMETABLE' ? (
          <TimetablePage courseId={activeCourseId} offeringId={validOfferingId} />
        ) : isProject ? (
          <ClassProjectPage courseId={activeCourseId} offeringId={validOfferingId} />
        ) : isAttendance ? (
          <>
            <div className="cfes-form-standalone-header">
              <h1 className="cfes-form-standalone-title">Attendance Record</h1>
              <p className="cfes-form-standalone-desc">
                External attendance management and verification link for this course offering.
              </p>
            </div>
            <AttendanceRecordPage courseId={activeCourseId} offeringId={validOfferingId} />
          </>
        ) : isLectures ? (
          <LecturesPage courseId={activeCourseId} offeringId={validOfferingId} />
        ) : isMidterm ? (
          <ExamUploadSection
            examType="MIDTERM"
            offeringId={validOfferingId}
            courseFiles={examFiles}
            onUploadSuccess={loadExamFiles}
            isCard={false}
          />
        ) : isFinal ? (
          <ExamUploadSection
            examType="FINAL"
            offeringId={validOfferingId}
            courseFiles={examFiles}
            onUploadSuccess={loadExamFiles}
            isCard={false}
          />
        ) : (
          <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.5rem' }}>
              Form Not Found
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              The requested form type <code>{formType}</code> is not available for this course offering.
            </p>
            <Link to={templatesUrl} className="cfes-form-back-btn">
              <Icon name="chevron-left" size={14} />
              <span>Return to Course Forms</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseForm;
