import React, { useState, useEffect, useContext } from 'react';
import api from '../../../api/axios';
import useToast from '../../../hooks/useToast';
import { AuthContext } from '../../../context/AuthContext';
import CourseDetailsSection from './CourseDetailsSection';
import AssessmentSummarySection from './AssessmentSummarySection';
import GradeSummarySection from './GradeSummarySection';
import CourseLearningOutcomesSection from './CourseLearningOutcomesSection';
import CourseEnhancementSection from './CourseEnhancementSection';
import SignatureSection from './SignatureSection';

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

const CourseReviewReportTheoryPage = ({ courseId }) => {
  const toast = useToast();
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);

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
    if (!courseId) return;

    const fetchForm = async () => {
      try {
        setLoading(true);

        // 1. Try loading existing draft
        const { data } = await api.get(`/forms/course-review/${courseId}`);
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

        // 2. No draft — auto-fill from the course record
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
      } catch (err) {
        console.error('Failed to fetch Course Review Report:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchForm();
  }, [courseId]);

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

  /* ── Download PDF ──────────────────────────────────────── */
  const handleDownload = async (format) => {
    try {
      setIsExporting(format);

      const { data } = await api.get(`/forms/course-review/${courseId}/export?format=${format}`, {
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
    <div className="course-review-report" style={{
      maxWidth: '1000px',
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
        Course Review Report (Theory Courses)
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
        <CourseDetailsSection data={courseDetails} onChange={handleCourseDetailsChange} />
        <AssessmentSummarySection data={assessmentSummary} onChange={handleSectionChange} />
        <GradeSummarySection data={gradeSummary} onChange={handleSectionChange} />
        <CourseLearningOutcomesSection data={learningOutcomes} onChange={handleSectionChange} />
        <CourseEnhancementSection data={courseEnhancement} onChange={handleSectionChange} />
        <SignatureSection data={signatures} onChange={handleSectionChange} facultyName={courseDetails.teacherName} />

        <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '2rem' }}>
          <button
            type="button"
            onClick={handleClearForm}
            disabled={loading || isExporting}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#f8fafc',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              fontSize: '0.95rem',
              cursor: (loading || isExporting) ? 'wait' : 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            Clear Form
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
              backgroundColor: (loading || isExporting) ? '#94a3b8' : '#3949ab',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: (loading || isExporting) ? 'wait' : 'pointer',
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

export default CourseReviewReportTheoryPage;
