import React, { useState, useEffect, useContext } from 'react';
import api from '../../../api/axios';
import useToast from '../../../hooks/useToast';
import { AuthContext } from '../../../context/AuthContext';
import FormActionBar from '../FormActionBar';
import Icon from '../../common/Icon';
import { syncCCCDocument, getOfferingFiles } from '../../../services/courseFile.service';
import './CourseCompletionCertificatePage.css';

const INITIAL_CCC_DATA = {
  sessionsHeld: '',
  totalRequiredSessions: '',
  date: new Date().toISOString().split('T')[0],
  endTermReviewFilled: 'Yes',
};

const CourseCompletionCertificatePage = ({ courseId, offeringId }) => {
  const toast = useToast();
  const { user } = useContext(AuthContext);

  const [courseInfo, setCourseInfo] = useState({
    facultyName: user?.name || '',
    courseTitle: '',
    courseCode: '',
    semesterName: '',
  });

  const [certificateData, setCertificateData] = useState(INITIAL_CCC_DATA);
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
      const res = await syncCCCDocument(offeringId);
      toast.success(
        res.message || 'Course Completion Certificate (PDF) synchronized to Google Drive successfully!'
      );
      if (res.data) setDriveFile(res.data);
    } catch (err) {
      console.error('Failed to sync CCC to Google Drive:', err);
      toast.error(
        err.response?.data?.message || 'Failed to synchronize Course Completion Certificate with Google Drive.'
      );
    } finally {
      setIsSyncingDrive(false);
    }
  };

  /* ── Load draft or auto-fill from course ─────────────────── */
  useEffect(() => {
    if (!offeringId && !courseId) return;

    const fetchForm = async () => {
      try {
        setLoading(true);

        // 1. Try loading existing draft
        const url = offeringId
          ? `/forms/ccc/${courseId || 'offering'}?offeringId=${offeringId}`
          : `/forms/ccc/${courseId}`;
        const { data } = await api.get(url);
        if (data.data && data.data.form) {
          const form = data.data.form;
          if (form.courseInfo) setCourseInfo(form.courseInfo);
          if (form.certificateData) setCertificateData(form.certificateData);
          return; // Draft found — all fields populated, done.
        }

        // 2. No draft — auto-fill read-only fields from offering or course
        if (offeringId) {
          const { data: offRes } = await api.get(`/offerings/${offeringId}`);
          const off = offRes.data?.offering || offRes.data?.data?.offering;
          if (off) {
            setCourseInfo(prev => ({
              ...prev,
              courseTitle: off.course?.courseName || '',
              courseCode: off.course?.courseCode || '',
              semesterName: off.semester?.name ? `${off.semester.name} (Sec ${off.section || 'A'})` : prev.semesterName,
            }));
            return;
          }
        }

        if (courseId) {
          const { data: courseRes } = await api.get(`/courses/${courseId}`);
          if (courseRes.data && courseRes.data.course) {
            const course = courseRes.data.course;
            setCourseInfo(prev => ({
              ...prev,
              courseTitle: course.courseName || '',
              courseCode: course.courseCode || '',
              semesterName: course.semester?.name || prev.semesterName,
            }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch CCC:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchForm();

    if (offeringId) {
      getOfferingFiles(offeringId)
        .then((files) => {
          const matched = files.find((f) => f.documentType === 'CCC' && f.status === 'synced');
          if (matched) setDriveFile(matched);
        })
        .catch(() => {});
    }
  }, [courseId, offeringId]);

  const handleChange = (field, value) => {
    setCertificateData(prev => ({
      ...prev,
      [field]: value
    }));
    setValidationErrors(prev => prev.filter(e => e.field !== field));
  };

  const handleCourseInfoChange = (field, value) => {
    setCourseInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  /* ── Validation ─────────────────────────────────────────── */
  const validateForm = () => {
    const errors = [];
    if (!certificateData.sessionsHeld) errors.push({ field: 'sessionsHeld', message: 'Sessions Held is required.' });
    if (!certificateData.totalRequiredSessions) errors.push({ field: 'totalRequiredSessions', message: 'Total Required Sessions is required.' });
    if (!certificateData.date) errors.push({ field: 'date', message: 'Date is required.' });

    // Additional logical validation
    if (certificateData.sessionsHeld && certificateData.totalRequiredSessions &&
      Number(certificateData.sessionsHeld) > Number(certificateData.totalRequiredSessions)) {
      errors.push({ field: 'sessionsHeld', message: 'Sessions held cannot exceed total required sessions.' });
    }

    return errors;
  };

  /* ── Save Draft ─────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Frontend validation
    const errors = validateForm();
    setValidationErrors(errors);
    if (errors.length > 0) {
      toast.warning('Please fix the validation errors before saving.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      setLoading(true);
      await api.post('/forms/ccc', {
        courseId,
        offeringId,
        courseInfo,
        certificateData
      });
      toast.success('Course Completion Certificate saved successfully!');
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

  /* ── Download PDF ───────────────────────────────────────── */
  const handleDownload = async (format) => {
    try {
      setIsExporting(format);

      const exportUrl = offeringId
        ? `/forms/ccc/${courseId || 'offering'}/export?format=${format}&offeringId=${offeringId}`
        : `/forms/ccc/${courseId}/export?format=${format}`;
      const { data } = await api.get(exportUrl, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `CCC_${courseInfo?.courseCode || 'Course'}.${format}`);
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

  const hasError = (key) => validationErrors.some(e => e.field === key);

  return (
    <div className="cfes-ccc-container">
      {/* ── Document Header ── */}
      <div className="cfes-ccc-header">
        <div className="cfes-ccc-header-badge">
          <Icon name="document" size={14} />
          <span>Faculty Certification</span>
        </div>
        <h1 className="cfes-ccc-title">Course Completion Certificate (CCC)</h1>
        <p className="cfes-ccc-subtitle">
          End-of-semester certification of syllabus coverage, lecture sessions, and end-term review.
        </p>
      </div>

      {/* ── Validation Error Banner ── */}
      {validationErrors.length > 0 && (
        <div className="cfes-ccc-error-banner" role="alert">
          <div className="cfes-ccc-error-title">
            <Icon name="alert" size={16} />
            <span>Please address the following validation errors:</span>
          </div>
          <ul className="cfes-ccc-error-list">
            {validationErrors.map((e, idx) => (
              <li key={`${e.field}-${idx}`}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Loading Indicator ── */}
      {loading && (
        <div className="cfes-ccc-loading-banner">
          <Icon name="spinner" size={16} />
          <span>Processing certificate data...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* ── Card 1: Course Information ── */}
        <section className="cfes-ccc-card" aria-labelledby="ccc-course-info-heading">
          <div className="cfes-ccc-card-header">
            <h2 id="ccc-course-info-heading" className="cfes-ccc-card-title">
              <Icon name="book" size={18} />
              <span>Course Information</span>
            </h2>
            <span className="cfes-ccc-card-tag">Offering Details</span>
          </div>

          <div className="cfes-ccc-grid-3">
            <div className="cfes-ccc-form-group">
              <label htmlFor="ccc-semester" className="cfes-ccc-label">
                Semester / Section
              </label>
              <input
                id="ccc-semester"
                type="text"
                className="cfes-ccc-input"
                value={courseInfo.semesterName}
                onChange={(e) => handleCourseInfoChange('semesterName', e.target.value)}
                placeholder="e.g. Fall 2024 • Sec A"
              />
            </div>

            <div className="cfes-ccc-form-group">
              <label htmlFor="ccc-course-title" className="cfes-ccc-label">
                Course Title
              </label>
              <input
                id="ccc-course-title"
                type="text"
                className="cfes-ccc-input"
                value={courseInfo.courseTitle}
                onChange={(e) => handleCourseInfoChange('courseTitle', e.target.value)}
                placeholder="e.g. Object Oriented Programming"
              />
            </div>

            <div className="cfes-ccc-form-group">
              <label htmlFor="ccc-course-code" className="cfes-ccc-label">
                Course Code
              </label>
              <input
                id="ccc-course-code"
                type="text"
                className="cfes-ccc-input"
                value={courseInfo.courseCode}
                onChange={(e) => handleCourseInfoChange('courseCode', e.target.value)}
                placeholder="e.g. CS210"
              />
            </div>
          </div>
        </section>

        {/* ── Card 2: Completion Details ── */}
        <section className="cfes-ccc-card" aria-labelledby="ccc-completion-details-heading">
          <div className="cfes-ccc-card-header">
            <h2 id="ccc-completion-details-heading" className="cfes-ccc-card-title">
              <Icon name="check" size={18} />
              <span>Completion Details</span>
            </h2>
            <span className="cfes-ccc-card-tag">Academic Verification</span>
          </div>

          <div className="cfes-ccc-grid-4">
            <div className="cfes-ccc-form-group">
              <label
                htmlFor="ccc-sessions-held"
                className={`cfes-ccc-label ${hasError('sessionsHeld') ? 'cfes-ccc-label--error' : ''}`}
              >
                Sessions Held
                <span className="cfes-ccc-required">*</span>
              </label>
              <input
                id="ccc-sessions-held"
                type="number"
                min="0"
                className={`cfes-ccc-input ${hasError('sessionsHeld') ? 'cfes-ccc-input--error' : ''}`}
                value={certificateData.sessionsHeld}
                onChange={(e) => handleChange('sessionsHeld', e.target.value)}
                placeholder="e.g. 32"
                aria-required="true"
                aria-invalid={hasError('sessionsHeld')}
              />
              <span className="cfes-ccc-helper-text">Total lectures delivered</span>
            </div>

            <div className="cfes-ccc-form-group">
              <label
                htmlFor="ccc-required-sessions"
                className={`cfes-ccc-label ${hasError('totalRequiredSessions') ? 'cfes-ccc-label--error' : ''}`}
              >
                Total Required Sessions
                <span className="cfes-ccc-required">*</span>
              </label>
              <input
                id="ccc-required-sessions"
                type="number"
                min="1"
                className={`cfes-ccc-input ${hasError('totalRequiredSessions') ? 'cfes-ccc-input--error' : ''}`}
                value={certificateData.totalRequiredSessions}
                onChange={(e) => handleChange('totalRequiredSessions', e.target.value)}
                placeholder="e.g. 32"
                aria-required="true"
                aria-invalid={hasError('totalRequiredSessions')}
              />
              <span className="cfes-ccc-helper-text">Accredited syllabus requirement</span>
            </div>

            <div className="cfes-ccc-form-group">
              <label htmlFor="ccc-endterm-review" className="cfes-ccc-label">
                End Term Review Filled?
              </label>
              <select
                id="ccc-endterm-review"
                className="cfes-ccc-select"
                value={certificateData.endTermReviewFilled}
                onChange={(e) => handleChange('endTermReviewFilled', e.target.value)}
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
              <span className="cfes-ccc-helper-text">Course evaluation review</span>
            </div>

            <div className="cfes-ccc-form-group">
              <label
                htmlFor="ccc-cert-date"
                className={`cfes-ccc-label ${hasError('date') ? 'cfes-ccc-label--error' : ''}`}
              >
                Certification Date
                <span className="cfes-ccc-required">*</span>
              </label>
              <input
                id="ccc-cert-date"
                type="date"
                className={`cfes-ccc-input ${hasError('date') ? 'cfes-ccc-input--error' : ''}`}
                value={certificateData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                aria-required="true"
                aria-invalid={hasError('date')}
              />
              <span className="cfes-ccc-helper-text">Submission timestamp</span>
            </div>
          </div>

          <div className="cfes-ccc-declaration">
            &ldquo;I hereby certify that all prescribed course topics have been covered in accordance
            with the approved course outline and the university curriculum standards.&rdquo;
          </div>
        </section>

        {/* ── Card 3: Signature & Authorization Block ── */}
        <section className="cfes-ccc-signature-card" aria-labelledby="ccc-signature-heading">
          <div className="cfes-ccc-card-header">
            <h2 id="ccc-signature-heading" className="cfes-ccc-card-title">
              <Icon name="users" size={18} />
              <span>Instructor Authorization</span>
            </h2>
            <span className="cfes-ccc-card-tag">Endorsement</span>
          </div>

          <div className="cfes-ccc-signature-wrapper">
            <div className="cfes-ccc-signature-box">
              <div className="cfes-ccc-signature-line">
                Digital Endorsement / Signature
              </div>
              <div className="cfes-ccc-signature-name">
                {courseInfo.facultyName || user?.name || 'Course Instructor'}
              </div>
              <div className="cfes-ccc-signature-role">
                Course Instructor • Iqra University
              </div>
            </div>
          </div>
        </section>

        {/* ── Shared FormActionBar ── */}
        <FormActionBar
          onExportPdf={() => handleDownload('pdf')}
          isExportingPdf={isExporting === 'pdf'}
          pdfDisabled={isExporting === 'pdf' || loading}
          showSyncDrive={Boolean(offeringId)}
          onSyncDrive={handleSyncToDrive}
          isSyncingDrive={isSyncingDrive}
          syncDriveDisabled={isSyncingDrive || loading || Boolean(isExporting)}
          syncDriveTitle="Save and synchronize Course Completion Certificate to Google Drive"
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

export default CourseCompletionCertificatePage;
