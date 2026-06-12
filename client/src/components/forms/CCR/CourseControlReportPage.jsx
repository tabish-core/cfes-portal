import React, { useState, useEffect, useRef } from 'react';
import api from '../../../api/axios';
import useToast from '../../../hooks/useToast';
import CourseInfoSection from './CourseInfoSection';
import ReportTable from './ReportTable';

const INITIAL_COURSE_INFO = {
  facultyName: '',
  program: '',
  courseTitle: '',
  courseCode: '',
  edpCode: '',
  sessionDay: '',
  timeSlot: '',
  location: '',
};

const createWeekRows = (weekNum) => [
  { weekNo: weekNum.toString(), scheduleDate: '', timeIn: '', timeOut: '', topicCovered: '', activityType: '', duration: '', signature: '', remarks: '', isSpecialRow: false },
  { weekNo: weekNum.toString(), scheduleDate: '', timeIn: '', timeOut: '', topicCovered: '', activityType: '', duration: '', signature: '', remarks: '', isSpecialRow: false },
  { weekNo: weekNum.toString(), scheduleDate: '', timeIn: '', timeOut: '', topicCovered: '', activityType: '', duration: '', signature: '', remarks: '', isSpecialRow: false },
];

const INITIAL_WEEKLY_DATA = (() => {
  const data = [];
  for (let i = 1; i <= 16; i++) {
    if (i === 8) {
      data.push({ weekNo: '8', isSpecialRow: true, specialRowText: 'Midterm', scheduleDate: '', activityType: 'MT' });
    } else if (i === 16) {
      data.push({ weekNo: '16', isSpecialRow: true, specialRowText: 'Final Exams', scheduleDate: '', activityType: 'FE' });
    } else {
      data.push(...createWeekRows(i));
    }
  }
  return data;
})();

const INITIAL_ALTERNATE_DATA = Array.from({ length: 4 }, (_, i) => ({
  rowNo: i + 1,
  scheduleDate: '',
  timeIn: '',
  timeOut: '',
  topicCovered: '',
  activityType: '',
  duration: '',
  signature: '',
  remarks: '',
}));

const CourseControlReportPage = ({ courseId }) => {
  const toast = useToast();
  const [courseInfo, setCourseInfo] = useState(INITIAL_COURSE_INFO);
  const [weeklyData, setWeeklyData] = useState(INITIAL_WEEKLY_DATA);
  const [alternateData, setAlternateData] = useState(INITIAL_ALTERNATE_DATA);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);

  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const fileInputRef = useRef(null);

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    e.target.value = '';

    if (!file.name.endsWith('.docx')) {
      toast.warning('Please select a valid Word (.docx) file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsImporting(true);
      setImportSummary(null);
      
      const { data } = await api.post('/ccr-import/parse-for-form', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { formState, importSummary: summary } = data;

      if (formState.courseInfo) setCourseInfo(formState.courseInfo);
      if (formState.weeklyData?.length) setWeeklyData(formState.weeklyData);
      if (formState.alternateData?.length) setAlternateData(formState.alternateData);

      setImportSummary(summary);
      toast.success('Form populated from Word document successfully!');
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Import failed:', err);
      toast.error(err.response?.data?.message || 'Failed to import document.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearForm = () => {
    if (!window.confirm('This will clear all current form data and cannot be undone. Continue?')) return;
    setCourseInfo(INITIAL_COURSE_INFO);
    setWeeklyData(INITIAL_WEEKLY_DATA);
    setAlternateData(INITIAL_ALTERNATE_DATA);
    setValidationErrors([]);
    setImportSummary(null);
    toast.success('Form cleared successfully.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── Validation ─────────────────────────────────────────── */
  const validateForm = () => {
    const errors = [];
    if (!courseInfo.facultyName?.trim()) errors.push({ field: 'courseInfo.facultyName', message: 'Faculty Name is required.' });
    if (!courseInfo.courseTitle?.trim())  errors.push({ field: 'courseInfo.courseTitle', message: 'Course Title is required.' });
    if (!courseInfo.courseCode?.trim())   errors.push({ field: 'courseInfo.courseCode', message: 'Course Code is required.' });
    return errors;
  };

  useEffect(() => {
    if (!courseId) return;

    const fetchForm = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/forms/ccr/${courseId}`);
        if (data.data && data.data.form) {
          const form = data.data.form;
          if (form.courseInfo) setCourseInfo(form.courseInfo);
          if (form.weeklyData && form.weeklyData.length > 0) setWeeklyData(form.weeklyData);
          if (form.alternateData && form.alternateData.length > 0) setAlternateData(form.alternateData);
        }
      } catch (err) {
        console.error('Failed to fetch CCR:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchForm();
  }, [courseId]);

  const handleCourseInfoChange = (field, value) => {
    setCourseInfo((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear validation error for this field when user types
    setValidationErrors((prev) => prev.filter((e) => e.field !== `courseInfo.${field}`));
  };

  const handleWeeklyDataChange = (index, field, value) => {
    setWeeklyData((prev) => {
      const newData = [...prev];
      newData[index] = {
        ...newData[index],
        [field]: value,
      };
      return newData;
    });
  };

  const handleAddTopicToWeek = (weekNo) => {
    setWeeklyData((prev) => {
      const lastIndex = prev.map(r => r.weekNo).lastIndexOf(weekNo);
      const newRow = { weekNo, scheduleDate: '', timeIn: '', timeOut: '', topicCovered: '', activityType: '', duration: '', signature: '', remarks: '', isSpecialRow: false };
      const updated = [...prev];
      updated.splice(lastIndex + 1, 0, newRow);
      return updated;
    });
  };

  const handleRemoveTopic = (index) => {
    setWeeklyData((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAlternateDataChange = (index, field, value) => {
    setAlternateData((prev) => {
      const newData = [...prev];
      newData[index] = {
        ...newData[index],
        [field]: value,
      };
      return newData;
    });
  };

  const handleAddAlternateRow = () => {
    setAlternateData((prev) => [
      ...prev,
      { rowNo: prev.length + 1, scheduleDate: '', timeIn: '', timeOut: '', topicCovered: '', activityType: '', duration: '', signature: '', remarks: '' }
    ]);
  };

  const handleRemoveAlternateRow = (index) => {
    setAlternateData((prev) => prev.filter((_, i) => i !== index));
  };

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
      await api.post('/forms/ccr', {
        courseId,
        courseInfo,
        weeklyData,
        alternateData
      });
      toast.success('Course Control Report saved successfully!');
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

  const handleDownload = async (format) => {
    try {
      setIsExporting(format);
      
      const { data } = await api.get(`/forms/ccr/${courseId}/export?format=${format}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `CCR_${courseInfo?.courseCode || 'Course'}.${format}`);
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
    <div className="course-control-report" style={{ 
      maxWidth: '1400px', 
      margin: '2rem 0', 
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
        Course Control Report (CCR)
      </h2>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".docx"
        style={{ display: 'none' }}
      />

      {/* Word Import Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#1e293b' }}>
              Auto-populate from Word Document
            </h4>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#64748b' }}>
              Upload a filled CCR template (.docx) to automatically extract and populate the form fields.
            </p>
          </div>
          <button
            type="button"
            onClick={handleImportClick}
            disabled={isImporting}
            style={{
              padding: '0.6rem 1.25rem',
              backgroundColor: isImporting ? '#94a3b8' : '#3949ab',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: isImporting ? 'wait' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {isImporting ? 'Importing...' : 'Import from Word (.docx)'}
          </button>
        </div>

        {/* Import Summary Report */}
        {importSummary && (
          <div style={{
            backgroundColor: '#ffffff',
            borderLeft: '4px solid #10b981',
            padding: '1rem',
            borderRadius: '0 8px 8px 0',
            fontSize: '0.88rem',
            borderTop: '1px solid #e2e8f0',
            borderRight: '1px solid #e2e8f0',
            borderBottom: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong style={{ color: '#065f46', fontSize: '0.95rem' }}>Import Success Report</strong>
              <button
                type="button"
                onClick={() => setImportSummary(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  padding: '0 0.25rem',
                  lineHeight: 1
                }}
                title="Dismiss summary"
              >
                ✕
              </button>
            </div>
            <p style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>
              Successfully extracted <strong>{importSummary.importedCount}</strong> sections/tables.
            </p>
            {importSummary.missingCount > 0 && (
              <p style={{ margin: '0 0 0.5rem 0', color: '#b91c1c' }}>
                Missing/empty in document: <strong>{importSummary.missingCount}</strong> fields (you can fill these in manually below).
              </p>
            )}
            
            <details style={{ cursor: 'pointer', color: '#4b5563', marginTop: '0.75rem' }}>
              <summary style={{ fontSize: '0.85rem', fontWeight: '600', color: '#3949ab', outline: 'none' }}>
                View Detailed Log
              </summary>
              <div style={{
                marginTop: '0.5rem',
                maxHeight: '200px',
                overflowY: 'auto',
                padding: '0.75rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#059669', marginBottom: '0.25rem', fontSize: '0.8rem' }}>Imported Fields:</div>
                  {importSummary.imported.map((item, idx) => (
                    <div key={idx} style={{ color: '#047857', fontFamily: 'monospace', fontSize: '0.75rem', paddingLeft: '0.5rem' }}>• {item}</div>
                  ))}
                </div>
                {importSummary.missing.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#dc2626', marginBottom: '0.25rem', fontSize: '0.8rem' }}>Missing/Empty Fields:</div>
                    {importSummary.missing.map((item, idx) => (
                      <div key={idx} style={{ color: '#b91c1c', fontFamily: 'monospace', fontSize: '0.75rem', paddingLeft: '0.5rem' }}>• {item}</div>
                    ))}
                  </div>
                )}
                {importSummary.unmapped.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#d97706', marginBottom: '0.25rem', fontSize: '0.8rem' }}>Unmapped Fields:</div>
                    {importSummary.unmapped.map((item, idx) => (
                      <div key={idx} style={{ color: '#b45309', fontFamily: 'monospace', fontSize: '0.75rem', paddingLeft: '0.5rem' }}>• {item}</div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          </div>
        )}
      </div>

      {validationErrors.length > 0 && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontWeight: '700', color: '#991b1b', fontSize: '0.95rem' }}>Please fix the following errors:</p>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#b91c1c', fontSize: '0.88rem', lineHeight: '1.7' }}>
            {validationErrors.map((e) => <li key={e.field}>{e.message}</li>)}
          </ul>
        </div>
      )}
      {loading && <div style={{ textAlign: 'center', marginBottom: '1rem', fontStyle: 'italic' }}>Processing...</div>}

      <form onSubmit={handleSubmit}>
        <CourseInfoSection
          data={courseInfo}
          onChange={handleCourseInfoChange}
          validationErrors={validationErrors}
        />

        <ReportTable
          data={weeklyData}
          onChange={handleWeeklyDataChange}
          onAddTopic={handleAddTopicToWeek}
          onRemoveTopic={handleRemoveTopic}
          title="Section 2: Weekly Report"
          rowLabelPrefix="Week"
          rowLabelField="weekNo"
          showSpecialRows={true}
        />

        <ReportTable
          data={alternateData}
          onChange={handleAlternateDataChange}
          onAddTopic={handleAddAlternateRow}
          onRemoveTopic={handleRemoveAlternateRow}
          title="Section 3: Alternate Teacher / Makeup Class"
          rowLabelPrefix="Row"
          rowLabelField="rowNo"
          showSpecialRows={false}
        />

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button
            type="button"
            onClick={handleClearForm}
            disabled={loading || isExporting || isImporting}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#f8fafc',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              fontSize: '0.95rem',
              cursor: (loading || isExporting || isImporting) ? 'wait' : 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            Clear Form
          </button>

          <button
            type="button"
            onClick={() => handleDownload('docx')}
            disabled={isExporting === 'docx' || loading}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#f8fafc',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              fontSize: '0.95rem',
              cursor: isExporting === 'docx' ? 'wait' : 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            {isExporting === 'docx' ? 'Generating...' : 'Download Word (.docx)'}
          </button>

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
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Saving...' : 'Save Report'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CourseControlReportPage;
