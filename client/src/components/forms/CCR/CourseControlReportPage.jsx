import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
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

const INITIAL_WEEKLY_DATA = Array.from({ length: 15 }, (_, i) => ({
  weekNo: i + 1,
  scheduleDate: '',
  timeIn: '',
  timeOut: '',
  topicCovered: '',
  activityType: '',
  hoursCompleted: '',
  signature: '',
  remarks: '',
}));

const INITIAL_ALTERNATE_DATA = Array.from({ length: 4 }, (_, i) => ({
  rowNo: i + 1,
  scheduleDate: '',
  timeIn: '',
  timeOut: '',
  topicCovered: '',
  activityType: '',
  hoursCompleted: '',
  signature: '',
  remarks: '',
}));

const CourseControlReportPage = ({ courseId }) => {
  const [courseInfo, setCourseInfo] = useState(INITIAL_COURSE_INFO);
  const [weeklyData, setWeeklyData] = useState(INITIAL_WEEKLY_DATA);
  const [alternateData, setAlternateData] = useState(INITIAL_ALTERNATE_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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
        setError('Failed to fetch existing course form.');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      setLoading(true);
      await api.post('/forms/ccr', {
        courseId,
        courseInfo,
        weeklyData,
        alternateData
      });
      setSuccess('Course Control Report saved successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save form.');
    } finally {
      setLoading(false);
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

      {error && <div style={{ color: 'red', marginBottom: '1rem', textAlign: 'center', fontWeight: 'bold' }}>{error}</div>}
      {success && <div style={{ color: 'green', marginBottom: '1rem', textAlign: 'center', fontWeight: 'bold' }}>{success}</div>}
      {loading && <div style={{ textAlign: 'center', marginBottom: '1rem', fontStyle: 'italic' }}>Processing...</div>}

      <form onSubmit={handleSubmit}>
        <CourseInfoSection
          data={courseInfo}
          onChange={handleCourseInfoChange}
        />

        <ReportTable
          data={weeklyData}
          onChange={handleWeeklyDataChange}
          title="Section 2: Weekly Report"
          rowLabelPrefix="Week"
          rowLabelField="weekNo"
          showSpecialRows={true}
        />

        <ReportTable
          data={alternateData}
          onChange={handleAlternateDataChange}
          title="Section 3: Alternate Teacher / Makeup Class"
          rowLabelPrefix="Row"
          rowLabelField="rowNo"
          showSpecialRows={false}
        />

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: '#3949ab',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Save Report
          </button>
        </div>
      </form>
    </div>
  );
};

export default CourseControlReportPage;
