import React, { useState, useEffect } from 'react';
import axios from 'axios';
import useToast from '../../../hooks/useToast';
import UniversityHeader from './UniversityHeader';
import CourseSummarySection from './CourseSummarySection';
import BasicInfoSection from './BasicInfoSection';
import CourseObjectivesSection from './CourseObjectivesSection';
import CourseContentsSection from './CourseContentsSection';
import CLOTable, { EMPTY_ROW as EMPTY_CLO_ROW } from './CLOTable';
import TextbooksTable, { EMPTY_ROW as EMPTY_TEXTBOOK_ROW } from './TextbooksTable';
import OBATable, { EMPTY_ROW as EMPTY_OBA_ROW } from './OBATable';
import WeeklyPlanTable, { EMPTY_ROW as EMPTY_WEEKLY_ROW } from './WeeklyPlanTable';
import GradingPolicySection from './GradingPolicySection';

/* ── Initial State Defaults ──────────────────────────────── */

const INITIAL_COURSE_SUMMARY = {
  courseCode: '',
  courseName: '',
  creditHours: '',
};

const INITIAL_BASIC_INFO = {
  instructor: '',
  designation: '',
  prerequisites: '',
  semester: '',
  email: '',
  phone: '',
  consultingHours: '',
  officeLocation: '',
};



const INITIAL_CLO_DATA = [
  { cloNumber: 'CLO-1', cloStatement: '', btLevel: '', gaMapping: '', acmKaMapping: '', sgdMapping: '', weightPercentage: '' },
  { cloNumber: 'CLO-2', cloStatement: '', btLevel: '', gaMapping: '', acmKaMapping: '', sgdMapping: '', weightPercentage: '' },
  { cloNumber: 'CLO-3', cloStatement: '', btLevel: '', gaMapping: '', acmKaMapping: '', sgdMapping: '', weightPercentage: '' },
];

const INITIAL_TEXTBOOKS = [
  { serialNo: '1', bookTitle: '', authors: '', editionPublicationPublisher: '' },
  { serialNo: '2', bookTitle: '', authors: '', editionPublicationPublisher: '' },
];

const INITIAL_OBA_DATA = [
  { category: '', assessmentTool: '', cloMapped: '', cloMarks: '', weightPercentage: '', totalMarks: '', assessmentDate: '' },
  { category: '', assessmentTool: '', cloMapped: '', cloMarks: '', weightPercentage: '', totalMarks: '', assessmentDate: '' },
  { category: '', assessmentTool: '', cloMapped: '', cloMarks: '', weightPercentage: '', totalMarks: '', assessmentDate: '' },
];

const INITIAL_WEEKLY_PLAN = Array.from({ length: 17 }, (_, i) => {
  const weekNum = i + 1;
  if (weekNum === 8) {
    return { week: '8', isSpecialRow: true, specialRowText: 'Midterm Exam', lectureNo: '', topicCovered: '', clo: '', assessmentTool: '' };
  }
  if (weekNum === 17) {
    return { week: '17', isSpecialRow: true, specialRowText: 'Final Exam', lectureNo: '', topicCovered: '', clo: '', assessmentTool: '' };
  }
  return {
    week: `${weekNum}`,
    lectureNo: '',
    topicCovered: '',
    clo: '',
    assessmentTool: '',
    isSpecialRow: false,
    specialRowText: ''
  };
});

const INITIAL_GRADING = {
  quizzes: '',
  assignments: '',
  project: '',
  midterm: '',
  finalExam: '',
  instructorGradingPolicy: '',
};

/* ── Main CIS Page Component ─────────────────────────────── */

const CourseInformationSheetPage = ({ courseId }) => {
  const [courseSummary, setCourseSummary] = useState(INITIAL_COURSE_SUMMARY);
  const [basicInfo, setBasicInfo] = useState(INITIAL_BASIC_INFO);
  const [courseObjectives, setCourseObjectives] = useState('');
  const [courseContents, setCourseContents] = useState('');
  const [cloData, setCloData] = useState(INITIAL_CLO_DATA);
  const [textbooks, setTextbooks] = useState(INITIAL_TEXTBOOKS);
  const [obaData, setObaData] = useState(INITIAL_OBA_DATA);
  const [weeklyPlan, setWeeklyPlan] = useState(INITIAL_WEEKLY_PLAN);
  const [grading, setGrading] = useState(INITIAL_GRADING);

  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(''); // 'pdf', 'docx', or ''
  const [validationErrors, setValidationErrors] = useState([]);

  /* ── Validation ─────────────────────────────────────────── */
  const validateForm = () => {
    const errors = [];
    if (!courseSummary.courseCode?.trim()) errors.push({ field: 'courseSummary.courseCode', message: 'Course Code is required.' });
    if (!courseSummary.courseName?.trim()) errors.push({ field: 'courseSummary.courseName', message: 'Course Name is required.' });
    if (!basicInfo.instructor?.trim())    errors.push({ field: 'basicInfo.instructor', message: 'Instructor name is required.' });
    if (!courseObjectives?.trim())         errors.push({ field: 'objectives', message: 'Course Objectives are required.' });
    return errors;
  };

  useEffect(() => {
    const fetchCIS = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        const res = await axios.get(`/api/forms/cis/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.data.data && res.data.data.form) {
          const f = res.data.data.form;
          if (f.courseSummary) setCourseSummary(f.courseSummary);
          if (f.basicInfo) setBasicInfo(f.basicInfo);
          if (f.courseObjectives) setCourseObjectives(f.courseObjectives);
          if (f.courseContents) setCourseContents(f.courseContents);
          if (f.cloTable?.length) setCloData(f.cloTable);
          if (f.textbooks?.length) setTextbooks(f.textbooks);
          if (f.obaTable?.length) setObaData(f.obaTable);
          if (f.weeklyPlan?.length) setWeeklyPlan(f.weeklyPlan);
          if (f.gradingPolicy) setGrading(f.gradingPolicy);
        }
      } catch (err) {
        console.error('Failed to fetch CIS:', err);
        toast.error('Failed to load CIS data.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchCIS();
  }, [courseId]);

  /* ── Change Handlers ─────────────────────────────────────── */

  const handleSectionChange = (setter, sectionName) => (field, value) => {
    setter((prev) => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    setValidationErrors((prev) => prev.filter((e) => e.field !== `${sectionName}.${field}`));
  };

  const handleTableChange = (setter) => (index, field, value) => {
    setter((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddCloRow = () => {
    setCloData((prev) => [
      ...prev,
      { ...EMPTY_CLO_ROW, cloNumber: `CLO-${prev.length + 1}` }
    ]);
  };

  const handleRemoveCloRow = (index) => {
    setCloData((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddTextbookRow = () => {
    setTextbooks((prev) => [
      ...prev,
      { ...EMPTY_TEXTBOOK_ROW, serialNo: `${prev.length + 1}` }
    ]);
  };

  const handleRemoveTextbookRow = (index) => {
    setTextbooks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddObaRow = () => {
    setObaData((prev) => [...prev, { ...EMPTY_OBA_ROW }]);
  };

  const handleRemoveObaRow = (index) => {
    setObaData((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddWeeklyRow = (type = 'lecture', insertIndex = -1) => {
    setWeeklyPlan((prev) => {
      const isAppend = insertIndex === -1;
      const targetIndex = isAppend ? prev.length - 1 : insertIndex;
      const targetRow = prev[targetIndex];

      let newWeek = '1';
      let newLectureNo = '1';
      let isSpecialRow = false;
      let specialRowText = '';

      if (targetRow) {
        if (type === 'next-week') {
          const lastWeekNum = parseInt(targetRow.week) || 0;
          const nextWeekNum = lastWeekNum + 1;
          newWeek = `${nextWeekNum}`;
          
          if (nextWeekNum === 8) {
            isSpecialRow = true;
            specialRowText = 'Midterm Exam';
            newLectureNo = '';
          } else if (nextWeekNum === 17) {
            isSpecialRow = true;
            specialRowText = 'Final Exam';
            newLectureNo = '';
          } else {
            // Find the last lecture number across all weeks just to increment
            const lastLecRow = [...prev].reverse().find(r => !r.isSpecialRow);
            const lastLecNum = parseInt(lastLecRow?.lectureNo?.replace(/\D/g, '') || '0') || 0;
            newLectureNo = `${lastLecNum + 1}`;
          }
        } else {
          // Add lecture to current week
          newWeek = targetRow.week;
          // Find the last lecture number globally to increment it
          const lastLecRow = [...prev].reverse().find(r => !r.isSpecialRow);
          const lastLecNum = parseInt(lastLecRow?.lectureNo?.replace(/\D/g, '') || '0') || 0;
          newLectureNo = `${lastLecNum + 1}`;
        }
      }

      const newRow = { 
        ...EMPTY_WEEKLY_ROW, 
        week: newWeek, 
        lectureNo: newLectureNo,
        isSpecialRow,
        specialRowText
      };

      if (isAppend) {
        return [...prev, newRow];
      } else {
        const updated = [...prev];
        updated.splice(insertIndex + 1, 0, newRow);
        return updated;
      }
    });
  };

  const handleRemoveWeeklyRow = (index) => {
    setWeeklyPlan((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    // Frontend validation
    const errors = validateForm();
    setValidationErrors(errors);
    if (errors.length > 0) {
      setIsSaving(false);
      toast.warning('Please fix the validation errors before saving.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const formData = {
      courseId,
      courseSummary,
      basicInfo,
      objectives: courseObjectives,
      contents: courseContents,
      cloTable: cloData,
      textbooks,
      obaTable: obaData,
      weeklyPlan,
      gradingPolicy: grading,
    };

    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/forms/cis', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Course Information Sheet saved successfully!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Failed to save CIS:', err);
      const serverErrors = err.response?.data?.data?.errors;
      if (serverErrors?.length) {
        setValidationErrors(serverErrors);
        toast.error('Validation failed. Please check the required fields.');
      } else {
        toast.error(err.response?.data?.message || 'Failed to save CIS form.');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async (format) => {
    try {
      setIsExporting(format);
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/forms/cis/${courseId}/export?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob', // Important for handling binary data
      });

      // Create a URL for the blob
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `CIS_${courseSummary?.courseCode || 'Course'}.${format}`);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
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

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
        Loading Course Information Sheet...
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1400px',
      margin: '2rem 0',
      padding: '3rem',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
      border: '1px solid #e2e8f0'
    }}>
      <UniversityHeader />

      {validationErrors.length > 0 && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontWeight: '700', color: '#991b1b', fontSize: '0.95rem' }}>Please fix the following errors:</p>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#b91c1c', fontSize: '0.88rem', lineHeight: '1.7' }}>
            {validationErrors.map((e) => <li key={e.field}>{e.message}</li>)}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <CourseSummarySection
          data={courseSummary}
          onChange={handleSectionChange(setCourseSummary, 'courseSummary')}
          validationErrors={validationErrors}
        />

        <BasicInfoSection
          data={basicInfo}
          onChange={handleSectionChange(setBasicInfo, 'basicInfo')}
          validationErrors={validationErrors}
        />

        <CourseObjectivesSection
          value={courseObjectives}
          onChange={(val) => {
            setCourseObjectives(val);
            setValidationErrors((prev) => prev.filter((e) => e.field !== 'objectives'));
          }}
          hasError={validationErrors.some((e) => e.field === 'objectives')}
          errorMessage={validationErrors.find((e) => e.field === 'objectives')?.message}
        />

        <CourseContentsSection
          value={courseContents}
          onChange={setCourseContents}
        />

        <CLOTable
          data={cloData}
          onChange={handleTableChange(setCloData)}
          onAddRow={handleAddCloRow}
          onRemoveRow={handleRemoveCloRow}
        />

        <TextbooksTable
          data={textbooks}
          onChange={handleTableChange(setTextbooks)}
          onAddRow={handleAddTextbookRow}
          onRemoveRow={handleRemoveTextbookRow}
        />

        <OBATable
          data={obaData}
          onChange={handleTableChange(setObaData)}
          onAddRow={handleAddObaRow}
          onRemoveRow={handleRemoveObaRow}
        />

        <WeeklyPlanTable
          data={weeklyPlan}
          onChange={handleTableChange(setWeeklyPlan)}
          onAddRow={handleAddWeeklyRow}
          onRemoveRow={handleRemoveWeeklyRow}
        />

        <GradingPolicySection
          data={grading}
          onChange={handleSectionChange(setGrading, 'gradingPolicy')}
        />

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button
            type="button"
            onClick={() => handleDownload('docx')}
            disabled={isExporting === 'docx' || isSaving}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#f8fafc',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.95rem',
              cursor: isExporting === 'docx' ? 'wait' : 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { if (isExporting !== 'docx') e.currentTarget.style.backgroundColor = '#e2e8f0'; }}
            onMouseOut={(e) => { if (isExporting !== 'docx') e.currentTarget.style.backgroundColor = '#f8fafc'; }}
          >
            {isExporting === 'docx' ? 'Generating...' : 'Download Word (.docx)'}
          </button>

          <button
            type="button"
            onClick={() => handleDownload('pdf')}
            disabled={isExporting === 'pdf' || isSaving}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              fontSize: '0.95rem',
              cursor: isExporting === 'pdf' ? 'wait' : 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { if (isExporting !== 'pdf') e.currentTarget.style.backgroundColor = '#fee2e2'; }}
            onMouseOut={(e) => { if (isExporting !== 'pdf') e.currentTarget.style.backgroundColor = '#fef2f2'; }}
          >
            {isExporting === 'pdf' ? 'Generating...' : 'Download PDF'}
          </button>

          <button
            type="submit"
            disabled={isSaving || isExporting}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: isSaving ? '#94a3b8' : '#3949ab',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              cursor: isSaving ? 'wait' : 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { if (!isSaving) e.currentTarget.style.backgroundColor = '#303f9f'; }}
            onMouseOut={(e) => { if (!isSaving) e.currentTarget.style.backgroundColor = '#3949ab'; }}
          >
            {isSaving ? 'Saving...' : 'Save Course Information Sheet'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CourseInformationSheetPage;
