import React, { useState, useEffect, useContext } from 'react';
import api from '../../../api/axios';
import useToast from '../../../hooks/useToast';
import { AuthContext } from '../../../context/AuthContext';

const INITIAL_CCC_DATA = {
  sessionsHeld: '',
  totalRequiredSessions: '',
  date: new Date().toISOString().split('T')[0],
  endTermReviewFilled: 'Yes',
};

const CourseCompletionCertificatePage = ({ courseId }) => {
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
  const [validationErrors, setValidationErrors] = useState([]);

  /* ── Load draft or auto-fill from course ─────────────────── */
  useEffect(() => {
    if (!courseId) return;

    const fetchForm = async () => {
      try {
        setLoading(true);

        // 1. Try loading existing draft
        const { data } = await api.get(`/forms/ccc/${courseId}`);
        if (data.data && data.data.form) {
          const form = data.data.form;
          if (form.courseInfo) setCourseInfo(form.courseInfo);
          if (form.certificateData) setCertificateData(form.certificateData);
          return; // Draft found — all fields populated, done.
        }

        // 2. No draft — auto-fill read-only fields from the course record
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
      } catch (err) {
        console.error('Failed to fetch CCC:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchForm();
  }, [courseId]);

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

  /* ── Save Draft (same pattern as CCR) ───────────────────── */
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

  /* ── Download PDF (same pattern as CCR) ─────────────────── */
  const handleDownload = async (format) => {
    try {
      setIsExporting(format);

      const { data } = await api.get(`/forms/ccc/${courseId}/export?format=${format}`, {
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
    <div className="course-completion-certificate" style={{
      maxWidth: '900px',
      margin: '2rem auto',
      padding: '3rem',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e2e8f0'
    }}>
      <h2 style={{
        textAlign: 'center',
        marginBottom: '3rem',
        color: '#0f172a',
        fontSize: '1.8rem',
        fontWeight: '700',
        letterSpacing: '-0.025em'
      }}>
        Course Completion Certificate (CCC)
      </h2>

      {validationErrors.length > 0 && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontWeight: '700', color: '#991b1b', fontSize: '0.95rem' }}>Please fix the following errors:</p>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#b91c1c', fontSize: '0.88rem', lineHeight: '1.7' }}>
            {validationErrors.map((e) => <li key={e.field}>{e.message}</li>)}
          </ul>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', marginBottom: '1rem', fontStyle: 'italic', color: '#64748b' }}>Processing...</div>}

      <form onSubmit={handleSubmit}>

        {/* Read-Only Auto-Filled Section */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h3 style={{
            marginBottom: '1.5rem',
            color: '#1e293b',
            fontSize: '1.2rem',
            fontWeight: '600',
            borderBottom: '2px solid #e2e8f0',
            paddingBottom: '0.75rem'
          }}>
            Course Information
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>
                Semester
              </label>
              <input
                type="text"
                value={courseInfo.semesterName}
                onChange={(e) => handleCourseInfoChange('semesterName', e.target.value)}
                style={{
                  padding: '0.6rem 0.8rem',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>
                Course Title
              </label>
              <input
                type="text"
                value={courseInfo.courseTitle}
                onChange={(e) => handleCourseInfoChange('courseTitle', e.target.value)}
                style={{
                  padding: '0.6rem 0.8rem',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>
                Course Code
              </label>
              <input
                type="text"
                value={courseInfo.courseCode}
                onChange={(e) => handleCourseInfoChange('courseCode', e.target.value)}
                style={{
                  padding: '0.6rem 0.8rem',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>



          </div>
        </div>

        {/* Editable Completion Details */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h3 style={{
            marginBottom: '1.5rem',
            color: '#1e293b',
            fontSize: '1.2rem',
            fontWeight: '600',
            borderBottom: '2px solid #e2e8f0',
            paddingBottom: '0.75rem'
          }}>
            Completion Details
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: '600', color: hasError('sessionsHeld') ? '#b91c1c' : '#475569' }}>
                Sessions Held <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                min="0"
                value={certificateData.sessionsHeld}
                onChange={(e) => handleChange('sessionsHeld', e.target.value)}
                placeholder="e.g. 32"
                style={{
                  padding: '0.6rem 0.8rem',
                  border: `1px solid ${hasError('sessionsHeld') ? '#ef4444' : '#cbd5e1'}`,
                  backgroundColor: hasError('sessionsHeld') ? '#fef2f2' : '#ffffff',
                  color: '#1e293b',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: '600', color: hasError('totalRequiredSessions') ? '#b91c1c' : '#475569' }}>
                Total Required Sessions <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                min="1"
                value={certificateData.totalRequiredSessions}
                onChange={(e) => handleChange('totalRequiredSessions', e.target.value)}
                placeholder="e.g. 32"
                style={{
                  padding: '0.6rem 0.8rem',
                  border: `1px solid ${hasError('totalRequiredSessions') ? '#ef4444' : '#cbd5e1'}`,
                  backgroundColor: hasError('totalRequiredSessions') ? '#fef2f2' : '#ffffff',
                  color: '#1e293b',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>
                End Term Review Filled?
              </label>
              <select
                value={certificateData.endTermReviewFilled}
                onChange={(e) => handleChange('endTermReviewFilled', e.target.value)}
                style={{
                  padding: '0.6rem 0.8rem',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: '600', color: hasError('date') ? '#b91c1c' : '#475569' }}>
                Date <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="date"
                value={certificateData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                style={{
                  padding: '0.6rem 0.8rem',
                  border: `1px solid ${hasError('date') ? '#ef4444' : '#cbd5e1'}`,
                  backgroundColor: hasError('date') ? '#fef2f2' : '#ffffff',
                  color: '#1e293b',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>

          </div>
        </div>

        {/* Signature Placeholder */}
        <div style={{
          marginTop: '3rem',
          display: 'flex',
          justifyContent: 'flex-start'
        }}>
          <div style={{ textAlign: 'center', width: '250px' }}>
            <div style={{
              height: '80px',
              borderBottom: '2px solid #cbd5e1',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              color: '#94a3b8',
              fontStyle: 'italic',
              fontSize: '0.9rem'
            }}>
              Signature
            </div>
            <div style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', marginTop: '0.5rem', textTransform: 'uppercase' }}>
              {courseInfo.facultyName}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '2rem' }}>

          <button
            type="button"
            onClick={() => handleDownload('pdf')}
            disabled={isExporting === 'pdf' || loading}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              borderRadius: '4px',
              fontSize: '0.95rem',
              cursor: isExporting === 'pdf' ? 'wait' : 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            {isExporting === 'pdf' ? 'Generating...' : 'Download PDF'}
          </button>

          <button
            type="submit"
            disabled={loading || isExporting}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: loading ? '#94a3b8' : '#3949ab',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: loading ? 'wait' : 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
          >
            {loading ? 'Saving...' : 'Save Draft'}
          </button>
        </div>

      </form>
    </div>
  );
};

export default CourseCompletionCertificatePage;
