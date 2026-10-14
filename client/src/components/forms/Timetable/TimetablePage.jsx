import React, { useState, useEffect, useContext } from 'react';
import api from '../../../api/axios';
import useToast from '../../../hooks/useToast';
import { AuthContext } from '../../../context/AuthContext';
import FacultyInfoSection from './FacultyInfoSection';
import TimeSlotManager from './TimeSlotManager';
import WeeklyScheduleGrid from './WeeklyScheduleGrid';
import DayActivityEditor from './DayActivityEditor';
import './Timetable.css';

const DEFAULT_DAYS = [
  { day: 'Monday', isOffDay: false },
  { day: 'Tuesday', isOffDay: false },
  { day: 'Wednesday', isOffDay: false },
  { day: 'Thursday', isOffDay: false },
  { day: 'Friday', isOffDay: false },
  { day: 'Saturday', isOffDay: true },
  { day: 'Sunday', isOffDay: true }
];

const INITIAL_FACULTY_INFO = {
  facultyName: '',
  designation: '',
  department: 'Department of Computer Science',
  facultySchool: 'Faculty of Engineering Sciences and Technology',
  academicTerm: ''
};

const TimetablePage = ({ courseId }) => {
  const toast = useToast();
  const { user } = useContext(AuthContext);

  /* ── State ───────────────────────────────────────────────── */
  const [facultyInfo, setFacultyInfo] = useState(INITIAL_FACULTY_INFO);
  const [timeSlots, setTimeSlots] = useState([]);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [activities, setActivities] = useState([]);
  const [activeSemester, setActiveSemester] = useState(null);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(''); // 'pdf' | 'docx' | ''
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  // Active day tab in the daily activity editor
  const [activeDayTab, setActiveDayTab] = useState('Monday');

  // Modal activity editor state
  const [modalActivity, setModalActivity] = useState(null);

  /* ── Fetch active semester & saved draft on load ─────────── */
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);

        // 1. Fetch active semester
        let semesterData = null;
        try {
          const semRes = await api.get('/semesters/active');
          if (semRes.data?.data?.semester) {
            semesterData = semRes.data.data.semester;
            if (isMounted) setActiveSemester(semesterData);
          }
        } catch (semErr) {
          console.warn('Could not fetch active semester:', semErr);
        }

        // 2. Fetch timetable draft (courseId parameter preserves route parity)
        const timetableEndpoint = courseId
          ? `/forms/timetable/${courseId}`
          : '/forms/timetable';

        const { data } = await api.get(timetableEndpoint);

        if (isMounted) {
          if (data?.data?.timetable) {
            const draft = data.data.timetable;
            setFacultyInfo({
              ...INITIAL_FACULTY_INFO,
              ...(draft.facultyInfo || {}),
              facultyName: draft.facultyInfo?.facultyName || user?.name || ''
            });
            setTimeSlots(Array.isArray(draft.timeSlots) ? draft.timeSlots : []);
            setDays(draft.days && draft.days.length > 0 ? draft.days : DEFAULT_DAYS);
            setActivities(draft.activities || []);
            if (draft.semester) {
              setActiveSemester(draft.semester);
            }
          } else {
            // Fresh draft state
            setFacultyInfo({
              ...INITIAL_FACULTY_INFO,
              facultyName: user?.name || '',
              department: user?.department?.name || 'Department of Computer Science',
              academicTerm: semesterData?.name || 'Fall 2024'
            });
            setTimeSlots([]);
            setDays(DEFAULT_DAYS);
            setActivities([]);
          }
          setIsDirty(false);
        }
      } catch (err) {
        console.error('Failed to load timetable:', err);
        toast.error(err.response?.data?.message || 'Failed to load timetable draft.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [courseId, user, toast]);

  /* ── Field Change Handlers ───────────────────────────────── */
  const handleFacultyInfoChange = (field, value) => {
    setFacultyInfo((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setValidationErrors((prev) =>
      prev.filter((e) => e.field !== `facultyInfo.${field}` && e.field !== field)
    );
  };

  const handleTimeSlotsChange = (newSlots) => {
    setTimeSlots(newSlots);
    setIsDirty(true);
    setValidationErrors((prev) =>
      prev.filter((e) => !e.field || !e.field.startsWith('timeSlots'))
    );
  };

  const handleRemoveActivitiesBySlotId = (slotId) => {
    setActivities((prev) =>
      prev.filter((a) => a.startSlotId !== slotId && a.endSlotId !== slotId)
    );
    setIsDirty(true);
  };

  const handleDaysChange = (newDays) => {
    setDays(newDays);
    setIsDirty(true);
  };

  const handleActivitiesChange = (newActivities) => {
    setActivities(newActivities);
    setIsDirty(true);
    setValidationErrors((prev) =>
      prev.filter((e) => !e.field || !e.field.startsWith('activities'))
    );
  };

  /* ── Modal Activity Handlers ─────────────────────────────── */
  const handleOpenAddActivity = (targetDay = activeDayTab, prefill = {}) => {
    const defaultStartSlot = timeSlots[0]?.slotId || '';
    const newAct = {
      id: prefill.id || `act_${Date.now()}`,
      day: targetDay,
      startSlotId: prefill.startSlotId || defaultStartSlot,
      endSlotId: prefill.endSlotId || prefill.startSlotId || defaultStartSlot,
      activityType: prefill.activityType || 'Class / Course',
      title: prefill.title || '',
      venue: prefill.venue || '',
      notes: prefill.notes || ''
    };

    setModalActivity({
      ...newAct,
      setField: (field, val) => {
        setModalActivity((curr) => (curr ? { ...curr, [field]: val } : null));
      }
    });
  };

  const handleOpenEditActivity = (act) => {
    setModalActivity({
      ...act,
      setField: (field, val) => {
        setModalActivity((curr) => (curr ? { ...curr, [field]: val } : null));
      }
    });
  };

  const handleCloseActivityModal = () => {
    setModalActivity(null);
  };

  /* ── Client-side Validation ──────────────────────────────── */
  const validateForm = () => {
    const errors = [];

    if (!facultyInfo.facultyName || !facultyInfo.facultyName.trim()) {
      errors.push({ field: 'facultyName', message: 'Faculty member name is required.' });
    }

    if (timeSlots.length === 0 && activities.length > 0) {
      errors.push({ field: 'timeSlots', message: 'Time slots must be configured when activities exist.' });
    }

    return errors;
  };

  /* ── Save Draft ──────────────────────────────────────────── */
  const handleSaveDraft = async () => {
    const clientErrors = validateForm();
    if (clientErrors.length > 0) {
      setValidationErrors(clientErrors);
      toast.error('Please resolve the validation errors before saving.');
      return;
    }

    try {
      setIsSaving(true);
      setValidationErrors([]);

      const payload = {
        semesterId: activeSemester?._id || undefined,
        facultyInfo,
        timeSlots,
        days,
        activities,
        consultingHours: [], // Kept empty as consulting/counseling hours are scheduled in the grid
        status: 'draft'
      };

      const { data } = await api.post('/forms/timetable', payload);

      if (data?.data?.timetable) {
        const saved = data.data.timetable;
        setFacultyInfo({
          ...INITIAL_FACULTY_INFO,
          ...(saved.facultyInfo || {})
        });
        setTimeSlots(saved.timeSlots || []);
        setDays(saved.days && saved.days.length > 0 ? saved.days : DEFAULT_DAYS);
        setActivities(saved.activities || []);
      }

      setIsDirty(false);
      toast.success('Class Schedule and Counseling Hours saved successfully!');
    } catch (err) {
      console.error('Failed to save timetable:', err);
      const serverErrors = err.response?.data?.data?.errors;
      if (serverErrors && Array.isArray(serverErrors)) {
        setValidationErrors(serverErrors);
        toast.error('Validation failed: ' + serverErrors.map((e) => e.message).join(' '));
      } else {
        toast.error(err.response?.data?.message || 'Failed to save timetable draft.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Document Export ─────────────────────────────────────── */
  const handleDownload = async (format) => {
    if (isDirty) {
      toast.warning('You have unsaved changes. The downloaded file will reflect the last saved draft. Please save your draft first if you want recent changes included.');
    }

    try {
      setIsExporting(format);

      const exportEndpoint = courseId
        ? `/forms/timetable/${courseId}/export?format=${format}`
        : `/forms/timetable/export?format=${format}`;

      const { data } = await api.get(exportEndpoint, {
        responseType: 'blob'
      });

      const filename = `Class_Schedule_${facultyInfo.facultyName ? facultyInfo.facultyName.replace(/\s+/g, '_') : 'Faculty'}.${format}`;

      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();

      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`${format.toUpperCase()} schedule exported successfully!`);
    } catch (err) {
      console.error(`Failed to export ${format}:`, err);
      toast.error(`Failed to export ${format.toUpperCase()}. Please save your draft first.`);
    } finally {
      setIsExporting('');
    }
  };

  /* ── Clear Form ──────────────────────────────────────────── */
  const handleClearForm = () => {
    if (!window.confirm('This will clear all current form data and cannot be undone. Continue?')) return;
    setFacultyInfo({
      ...INITIAL_FACULTY_INFO,
      facultyName: user?.name || '',
      department: user?.department?.name || 'Department of Computer Science',
      academicTerm: activeSemester?.name || 'Fall 2024'
    });
    setTimeSlots(DEFAULT_SLOTS);
    setDays(DEFAULT_DAYS);
    setActivities([]);
    setValidationErrors([]);
    setIsDirty(false);
    toast.success('Form cleared successfully.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 2rem', color: '#64748b', fontStyle: 'italic' }}>
        Loading Class Schedule and Counseling Hours...
      </div>
    );
  }

  return (
    <div className="timetable-container">
      {/* Centered Document Title matching CCR & CIS */}
      <h2
        style={{
          textAlign: 'center',
          marginBottom: '2rem',
          marginTop: 0,
          color: '#0f172a',
          fontSize: '1.8rem',
          fontWeight: '700',
          letterSpacing: '-0.025em'
        }}
      >
        Class Schedule and Counseling Hours
      </h2>

      {/* Global Validation Error Banner */}
      {validationErrors.length > 0 && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            marginBottom: '1.75rem',
            color: '#991b1b'
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: '#991b1b', fontSize: '0.95rem' }}>
            Please fix the following errors:
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.88rem', lineHeight: '1.7' }}>
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Section A: Faculty Information */}
      <FacultyInfoSection
        facultyInfo={facultyInfo}
        onChange={handleFacultyInfoChange}
        activeSemesterName={activeSemester?.name || ''}
        validationErrors={validationErrors}
      />

      {/* Section B: Time Slot Manager */}
      <TimeSlotManager
        timeSlots={timeSlots}
        activities={activities}
        onChangeTimeSlots={handleTimeSlotsChange}
        onRemoveActivitiesBySlotId={handleRemoveActivitiesBySlotId}
        validationErrors={validationErrors}
      />

      {/* Section C: Visual Weekly Schedule Matrix */}
      <WeeklyScheduleGrid
        timeSlots={timeSlots}
        days={days}
        activities={activities}
        onEditActivity={handleOpenEditActivity}
        onAddActivityOnSlot={(day, slotId) =>
          handleOpenAddActivity(day, { startSlotId: slotId, endSlotId: slotId })
        }
      />

      {/* Section D: Daily Activity & Off-Day Editor */}
      <DayActivityEditor
        days={days}
        timeSlots={timeSlots}
        activities={activities}
        onChangeDays={handleDaysChange}
        onChangeActivities={handleActivitiesChange}
        activeDayTab={activeDayTab}
        onSelectDayTab={setActiveDayTab}
        modalActivity={modalActivity}
        onCloseActivityModal={handleCloseActivityModal}
        onOpenAddActivity={handleOpenAddActivity}
        onOpenEditActivity={handleOpenEditActivity}
      />

      {/* Bottom Action Bar */}
      <div
        style={{
          marginTop: '2rem',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '1rem',
          flexWrap: 'wrap'
        }}
      >
        <button
          type="button"
          onClick={handleClearForm}
          disabled={loading || isSaving || Boolean(isExporting)}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#f8fafc',
            color: '#334155',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            fontSize: '0.95rem',
            cursor: (loading || isSaving || Boolean(isExporting)) ? 'wait' : 'pointer',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
        >
          Clear Form
        </button>

        <button
          type="button"
          onClick={() => handleDownload('docx')}
          disabled={Boolean(isExporting) || loading || isSaving}
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
          disabled={Boolean(isExporting) || loading || isSaving}
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
          type="button"
          onClick={handleSaveDraft}
          disabled={loading || isSaving || Boolean(isExporting)}
          style={{
            padding: '0.75rem 2rem',
            backgroundColor: isSaving ? '#94a3b8' : '#3949ab',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor: isSaving ? 'wait' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {isSaving ? 'Saving...' : 'Save Class Schedule'}
        </button>
      </div>
    </div>
  );
};

export default TimetablePage;
