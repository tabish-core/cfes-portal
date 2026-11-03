import React, { useState, useEffect, useContext } from 'react';
import api from '../../../api/axios';
import useToast from '../../../hooks/useToast';
import { AuthContext } from '../../../context/authContextDef';
import FormActionBar from '../FormActionBar';
import Icon from '../../common/Icon';
import { syncCRRDocument, getOfferingFiles } from '../../../services/courseFile.service';
import CourseDetailsSection from './CourseDetailsSection';
import AssessmentSummarySection from './AssessmentSummarySection';
import GradeSummarySection from './GradeSummarySection';
import CourseLearningOutcomesSection from './CourseLearningOutcomesSection';
import CourseEnhancementSection from './CourseEnhancementSection';
import SignatureSection from './SignatureSection';
import './CourseReviewReportTheoryPage.css';

const INITIAL_COURSE_DETAILS = {
  teacherName: '',
  department: '',
  courseTitle: '',
  courseCode: '',
  semester: '',
  creditHours: '',
  noOfStudents: '',
};

const INITIAL_ASSESSMENT_SUMMARY = Array.from({ length: 4 }, (_, i) => ({
  clo: `CLO ${i + 1}`,
  cloAttainment: '',
  mappedGAs: '',
  gaAttainment: '',
  assessmentName: ''
}));

const INITIAL_GRADE_SUMMARY = {
  'A+': '',
  'A': '',
  'B+': '',
  'B': '',
  'C+': '',
  'C': '',
  'F': '',
  classAverage: '',
};

const INITIAL_LEARNING_OUTCOMES = {
  outcomesAdequate: '',
  revisionSuggestion: '',
  cloAttainmentStatus: '',
  cloAttainmentReason: '',
  ploAttainmentStatus: '',
  ploAttainmentReason: ''
};

const INITIAL_COURSE_ENHANCEMENT = {
  courseEnhancementComment: '',
  implementationComments: '',
  appropriatenessComments: ''
};

const INITIAL_SIGNATURES = {
  instructorDate: new Date().toISOString().split('T')[0],
  hodDate: ''
};

const CourseReviewReportTheoryPage = ({ courseId, offeringId }) => {
  const toast = useToast();
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState('');
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveFile, setDriveFile] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);

  /* ── Google Drive Sync Handler ───────────────────────────── */
  const handleSyncToDrive = async () => {
    if (!offeringId) {
      toast.error('Google Drive synchronization requires an offering-scoped view.');
      return;
    }
    try {
      setIsSyncingDrive(true);
      const res = await syncCRRDocument(offeringId);
      toast.success(
        res.message || 'Course Review Report (PDF) synchronized to Google Drive successfully!'
      );
      if (res.data) setDriveFile(res.data);
    } catch (err) {
      console.error('Failed to sync CRR to Google Drive:', err);
      toast.error(
        err.response?.data?.message || 'Failed to synchronize Course Review Report with Google Drive.'
      );
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const [courseDetails, setCourseDetails] = useState({
    ...INITIAL_COURSE_DETAILS,
    teacherName: user?.name || ''
  });
  const [assessmentSummary, setAssessmentSummary] = useState(INITIAL_ASSESSMENT_SUMMARY);
  const [gradeSummary, setGradeSummary] = useState(INITIAL_GRADE_SUMMARY);
  const [learningOutcomes, setLearningOutcomes] = useState(INITIAL_LEARNING_OUTCOMES);
  const [courseEnhancement, setCourseEnhancement] = useState(INITIAL_COURSE_ENHANCEMENT);
  const [signatures, setSignatures] = useState(INITIAL_SIGNATURES);

  /* ── Load draft or auto-fill from course ─────────────────── */
  useEffect(() => {
    if (!offeringId && !courseId) return;

    const fetchForm = async () => {
      try {
        setLoading(true);

        // 1. Try loading existing draft
        const url = offeringId
          ? `/forms/course-review/${courseId || 'offering'}?offeringId=${offeringId}`
          : `/forms/course-review/${courseId}`;
        const { data } = await api.get(url);
        if (data.data && data.data.form) {
          const form = data.data.form;
          if (form.courseInfo) setCourseDetails(form.courseInfo);
          if (form.assessmentSummary?.length) setAssessmentSummary(form.assessmentSummary);
          if (form.gradeSummary) setGradeSummary(form.gradeSummary);
          if (form.courseLearningOutcomes) setLearningOutcomes(form.courseLearningOutcomes);
          if (form.courseEnhancement) setCourseEnhancement(form.courseEnhancement);
          if (form.signatureInfo) setSignatures(form.signatureInfo);
          return; // Draft found — all fields populated, done.
        }

        // 2. No draft — auto-fill from offering or course record
        if (offeringId) {
          const { data: offRes } = await api.get(`/offerings/${offeringId}`);
          const off = offRes.data?.offering || offRes.data?.data?.offering;
          if (off) {
            setCourseDetails(prev => ({
              ...prev,
              courseTitle: off.course?.courseName || '',
              courseCode: off.course?.courseCode || '',
              semester: off.semester?.name ? `${off.semester.name} (Sec ${off.section || 'A'})` : prev.semester,
              creditHours: off.course?.creditHours || '',
              department: off.course?.department?.name || prev.department,
              noOfStudents: prev.noOfStudents,
            }));
            return;
          }
        }

        if (courseId) {
          const { data: courseRes } = await api.get(`/courses/${courseId}`);
          if (courseRes.data && courseRes.data.course) {
            const course = courseRes.data.course;
            setCourseDetails(prev => ({
              ...prev,
              courseTitle: course.courseName || '',
              courseCode: course.courseCode || '',
              semester: course.semester?.name || prev.semester,
              creditHours: course.creditHours || '',
              department: course.department?.name || prev.department,
              noOfStudents: prev.noOfStudents,
            }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch Course Review Report:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchForm();

    if (offeringId) {
      getOfferingFiles(offeringId)
        .then((files) => {
          const matched = files.find((f) => f.documentType === 'CRR' && f.status === 'synced');
          if (matched) setDriveFile(matched);
        })
        .catch(() => {});
    }
  }, [courseId, offeringId]);

  const handleCourseDetailsChange = (field, value) => {
    setCourseDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleSectionChange = (section, value) => {
    switch (section) {
      case 'assessmentSummary':
        setAssessmentSummary(value);
        break;
      case 'gradeSummary':
        setGradeSummary(value);
        break;
      case 'learningOutcomes':
        setLearningOutcomes(value);
        break;
      case 'courseEnhancement':
        setCourseEnhancement(value);
        break;
      case 'signatures':
        setSignatures(value);
        break;
      default:
        break;
    }
  };

  /* ── Save Draft ─────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      await api.post('/forms/course-review', {
        courseId,
        offeringId,
        courseInfo: courseDetails,
        assessmentSummary,
        gradeSummary,
        courseLearningOutcomes: learningOutcomes,
        courseEnhancement,
        signatureInfo: signatures
      });
      toast.success('Course Review Report saved successfully!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const serverErrors = err.response?.data?.data?.errors;
      if (serverErrors?.length) {
        setValidationErrors(serverErrors);
        toast.error('Validation failed. Please check the required fields.');
      } else {
        toast.error(err.response?.data?.message || 'Failed to save form.');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const handleClearForm = () => {
    if (!window.confirm('This will clear all current form data and cannot be undone. Continue?')) return;
    setCourseDetails({
      ...INITIAL_COURSE_DETAILS,
      teacherName: user?.name || ''
    });
    setAssessmentSummary(INITIAL_ASSESSMENT_SUMMARY);
    setGradeSummary(INITIAL_GRADE_SUMMARY);
    setLearningOutcomes(INITIAL_LEARNING_OUTCOMES);
    setCourseEnhancement(INITIAL_COURSE_ENHANCEMENT);
    setSignatures(INITIAL_SIGNATURES);
    setValidationErrors([]);
    toast.success('Form cleared successfully.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── Download PDF ───────────────────────────────────────── */
  const handleDownload = async (format) => {
    try {
      setIsExporting(format);

      const exportUrl = offeringId
        ? `/forms/course-review/${courseId || 'offering'}/export?format=${format}&offeringId=${offeringId}`
        : `/forms/course-review/${courseId}/export?format=${format}`;
      const { data } = await api.get(exportUrl, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `CRR_${courseDetails?.courseCode || 'Course'}.${format}`);
      document.body.appendChild(link);
      link.click();

      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`Failed to export ${format}:`, err);
      toast.error(`Failed to export ${format.toUpperCase()}. Please save the form first.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsExporting('');
    }
  };

  return (
    <div className="cfes-crr-container">
      {/* ── Document Header ── */}
      <div className="cfes-crr-header">
        <div className="cfes-crr-header-badge">
          <Icon name="document" size={14} />
          <span>Theory Course Quality Evaluation</span>
        </div>
        <h1 className="cfes-crr-title">Course Review Report (CRR)</h1>
        <p className="cfes-crr-subtitle">
          Comprehensive theory course evaluation covering CLO attainment, grade distribution,
          CQI improvements, and faculty recommendations.
        </p>
      </div>

      {/* ── Validation Error Banner ── */}
      {validationErrors.length > 0 && (
        <div className="cfes-crr-error-banner" role="alert">
          <div className="cfes-crr-error-title">
            <Icon name="alert" size={16} />
            <span>Please address the following validation errors:</span>
          </div>
          <ul className="cfes-crr-error-list">
            {validationErrors.map((e, idx) => (
              <li key={`${e.field}-${idx}`}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Loading Indicator ── */}
      {loading && (
        <div className="cfes-crr-loading-banner">
          <Icon name="spinner" size={16} />
          <span>Processing Course Review Report...</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <CourseDetailsSection data={courseDetails} onChange={handleCourseDetailsChange} />
        <AssessmentSummarySection data={assessmentSummary} onChange={handleSectionChange} />
        <GradeSummarySection data={gradeSummary} onChange={handleSectionChange} />
        <CourseLearningOutcomesSection data={learningOutcomes} onChange={handleSectionChange} />
        <CourseEnhancementSection data={courseEnhancement} onChange={handleSectionChange} />
        <SignatureSection data={signatures} onChange={handleSectionChange} facultyName={courseDetails.teacherName} />

        <FormActionBar
          onClear={handleClearForm}
          clearDisabled={loading || Boolean(isExporting)}
          onExportPdf={() => handleDownload('pdf')}
          isExportingPdf={isExporting === 'pdf'}
          pdfDisabled={isExporting === 'pdf' || loading}
          showSyncDrive={Boolean(offeringId)}
          onSyncDrive={handleSyncToDrive}
          isSyncingDrive={isSyncingDrive}
          syncDriveDisabled={isSyncingDrive || loading || Boolean(isExporting)}
          syncDriveTitle="Save and synchronize Course Review Report to Google Drive"
          driveWebViewLink={driveFile?.googleDriveWebViewLink}
          driveFileVersion={driveFile?.version}
          saveButtonType="submit"
          saveLabel="Save Draft"
          isSaving={loading}
          saveDisabled={loading || Boolean(isExporting)}
        />
      </form>
    </div>
  );
};

export default CourseReviewReportTheoryPage;
