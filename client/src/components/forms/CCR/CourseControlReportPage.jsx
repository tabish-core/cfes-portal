import React, { useState, useEffect } from 'react';
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
