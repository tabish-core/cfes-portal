import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import useToast from '../../hooks/useToast';
import {
  getOfferingFiles,
  syncCISDocument,
  syncCCRDocument,
  syncTimetableDocument,
  syncQuizDocument,
  syncAssignmentDocument,
  uploadOfferingDocument,
  verifyGoogleDriveAccess,
} from '../../services/courseFile.service';
import '../dean/Dashboard.css';

/**
 * Checklist data structure.
 * Each item has: id, name, formType (for navigation and backend documentType), and completed state.
 * Separators and group headers are represented with special types.
 */
const INITIAL_CHECKLIST = [
  // Main documents
  { id: 1, type: 'item', name: 'Course Information Sheet & Weekly Plan', formType: 'CIS' },
  { id: 2, type: 'item', name: 'Course Control Report', formType: 'CCR' },
  { id: 3, type: 'item', name: 'Timetable with consulting hours', formType: 'TIMETABLE' },
  { id: 4, type: 'item', name: 'Attendance Record', formType: 'AR' },
  { id: 5, type: 'item', name: 'Lectures', formType: 'LECTURES' },

  // Separator
  { id: 's1', type: 'separator', label: 'Attach Page Separator here' },

  // Assessment Record (grouped)
  { id: 6, type: 'group-header', name: 'Assessment Record' },
  { id: '6a', type: 'sub-item', name: 'Quizzes', formType: 'ASSESS_QUIZ' },
  { id: '6b', type: 'sub-item', name: 'Assignments', formType: 'ASSESS_ASSIGN' },
  { id: '6c', type: 'sub-item', name: 'Midterm', formType: 'ASSESS_MID' },
  { id: '6d', type: 'sub-item', name: 'Final Exam', formType: 'ASSESS_FINAL' },
  { id: '6e', type: 'sub-item', name: 'CCP/Class Project', formType: 'ASSESS_PROJECT' },

  // Separator
  { id: 's2', type: 'separator', label: 'Attach Page Separator here' },

  // Remaining items
  { id: 7, type: 'item', name: 'Course Completion Certificate', formType: 'CCC' },
  { id: 8, type: 'item', name: 'Final Marks and Grade Report', formType: 'FMGR' },
  { id: 9, type: 'item', name: 'Record of CLO assessment', formType: 'CLO' },
  { id: 10, type: 'item', name: 'Record of GA assessment', formType: 'GA' },
  { id: 11, type: 'item', name: 'Course Review Report', formType: 'CRR' },

  // Separator
  { id: 's3', type: 'separator', label: 'Attach Page Separator here' },

  { id: 12, type: 'item', name: 'Detail of technology involved', formType: 'TECH' },
  { id: 13, type: 'item', name: 'Design skills practiced', formType: 'DESIGN' },
  { id: 14, type: 'item', name: 'Course effectiveness analysis', formType: 'CEA' },
];

const CourseFileChecklist = () => {
  const { courseId: paramCourseId, offeringId } = useParams();
  const [offering, setOffering] = useState(null);

  const [courseInfo, setCourseInfo] = useState({
    courseTitle: '',
    courseCode: '',
    batch: '',
  });

  // Build initial completed state from checklist items
  const [checklist, setChecklist] = useState(() =>
    INITIAL_CHECKLIST.map((item) => ({
      ...item,
      completed: false,
    }))
  );

  // Stage 3 Google Drive state
  const [courseFiles, setCourseFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [driveFolder, setDriveFolder] = useState(null);
  const [syncingCIS, setSyncingCIS] = useState(false);
  const [syncingCCR, setSyncingCCR] = useState(false);
  const [syncingTimetable, setSyncingTimetable] = useState(false);
  const [offeringQuizzes, setOfferingQuizzes] = useState([]);
  const [offeringAssignments, setOfferingAssignments] = useState([]);
  const [syncingQuizId, setSyncingQuizId] = useState(null);
  const [syncingAssignmentId, setSyncingAssignmentId] = useState(null);
  const [uploadingDocType, setUploadingDocType] = useState(null);
  const [rowErrors, setRowErrors] = useState({});

  // Upload modal state
  const [uploadModal, setUploadModal] = useState({
    isOpen: false,
    item: null,
    file: null,
    instanceName: '',
    isSubmitting: false,
    error: '',
  });

  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // Group synchronized files by documentType
  const filesByDocType = useMemo(() => {
    const map = {};
    courseFiles.forEach((file) => {
      const type = file.documentType;
      if (!map[type]) map[type] = [];
      map[type].push(file);
    });
    return map;
  }, [courseFiles]);

  // Count total synchronized items
  const totalSyncedCount = useMemo(() => {
    const syncedTypes = new Set();
    courseFiles.forEach((f) => {
      if (f.status === 'synced') syncedTypes.add(f.documentType);
    });
    return syncedTypes.size;
  }, [courseFiles]);

  const totalChecklistItemsCount = useMemo(() => {
    return INITIAL_CHECKLIST.filter((i) => i.type === 'item' || i.type === 'sub-item').length;
  }, []);

  // Refresh offering files and checklist completion state
  const refreshFilesAndChecklist = useCallback(async () => {
    if (!offeringId) return;
    try {
      setLoadingFiles(true);
      const [files, checklistRes, quizRes, assignRes] = await Promise.all([
        getOfferingFiles(offeringId),
        api.get(`/checklist/offering/${offeringId}`),
        api.get(`/quizzes/offering/${offeringId}`).catch(() => ({ data: { data: { quizzes: [] } } })),
        api.get(`/assignments/offering/${offeringId}`).catch(() => ({ data: { data: { assignments: [] } } })),
      ]);
      setCourseFiles(files || []);
      if (quizRes.data?.data?.quizzes) {
        setOfferingQuizzes(quizRes.data.data.quizzes);
      }
      if (assignRes.data?.data?.assignments) {
        setOfferingAssignments(assignRes.data.data.assignments);
      }

      const saved = checklistRes.data?.data?.checklist;
      if (saved?.checklistItems && saved.checklistItems.length > 0) {
        setChecklist((prev) =>
          prev.map((item) => {
            if (item.type === 'separator' || item.type === 'group-header') return item;
            if (item.formType === 'CIS') {
              const cisMatch = saved.checklistItems.find((s) => s.type === 'CIS');
              const wpMatch = saved.checklistItems.find((s) => s.type === 'WP');
              return { ...item, completed: Boolean(cisMatch?.completed || wpMatch?.completed) };
            }
            const match = saved.checklistItems.find((s) => s.type === item.formType);
            return match ? { ...item, completed: match.completed } : item;
          })
        );
      }
    } catch (err) {
      console.warn('Could not refresh course files or checklist:', err?.message || err);
    } finally {
      setLoadingFiles(false);
    }
  }, [offeringId]);

  // Fetch initial checklist, offering details, drive status, and course files on mount
  useEffect(() => {
    if (!offeringId && !paramCourseId) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        let checklistData = null;

        if (offeringId) {
          // Fetch offering details
          const offRes = await api.get(`/offerings/${offeringId}`);
          const currentOffering = offRes.data?.data?.offering || offRes.data?.offering;
          setOffering(currentOffering);

          const defaultBatch = currentOffering?.semester?.name
            ? `${currentOffering.semester.name} - Section ${currentOffering.section || 'A'}`
            : `Section ${currentOffering?.section || 'A'}`;

          setCourseInfo({
            courseTitle: currentOffering?.course?.courseName || '',
            courseCode: currentOffering?.course?.courseCode || '',
            batch: defaultBatch,
          });

          // Fetch offering-scoped checklist and files concurrently
          const [checklistRes, files, folderInfo, quizRes, assignRes] = await Promise.all([
            api.get(`/checklist/offering/${offeringId}`),
            getOfferingFiles(offeringId).catch(() => []),
            verifyGoogleDriveAccess().catch(() => null),
            api.get(`/quizzes/offering/${offeringId}`).catch(() => ({ data: { data: { quizzes: [] } } })),
            api.get(`/assignments/offering/${offeringId}`).catch(() => ({ data: { data: { assignments: [] } } })),
          ]);

          checklistData = checklistRes.data?.data?.checklist;
          setCourseFiles(files || []);
          if (folderInfo) setDriveFolder(folderInfo);
          if (quizRes.data?.data?.quizzes) {
            setOfferingQuizzes(quizRes.data.data.quizzes);
          }
          if (assignRes.data?.data?.assignments) {
            setOfferingAssignments(assignRes.data.data.assignments);
          }
        } else {
          // Legacy route by courseId
          const [checkRes, quizRes, assignRes] = await Promise.all([
            api.get(`/checklist/${paramCourseId}`),
            api.get(`/quizzes/course/${paramCourseId}`).catch(() => ({ data: { data: { quizzes: [] } } })),
            api.get(`/assignments/course/${paramCourseId}`).catch(() => ({ data: { data: { assignments: [] } } })),
          ]);
          checklistData = checkRes.data.data?.checklist;
          if (quizRes.data?.data?.quizzes) {
            setOfferingQuizzes(quizRes.data.data.quizzes);
          }
          if (assignRes.data?.data?.assignments) {
            setOfferingAssignments(assignRes.data.data.assignments);
          }
        }

        if (checklistData) {
          const saved = checklistData;
          if (saved.courseTitle || saved.courseCode || saved.batch) {
            setCourseInfo((prev) => ({
              courseTitle: saved.courseTitle || prev.courseTitle,
              courseCode: saved.courseCode || prev.courseCode,
              batch: saved.batch || prev.batch,
            }));
          }
          if (saved.checklistItems && saved.checklistItems.length > 0) {
            // Merge saved completion states into the UI checklist structure
            setChecklist((prev) =>
              prev.map((item) => {
                if (item.type === 'separator' || item.type === 'group-header') return item;
                if (item.formType === 'CIS') {
                  const cisMatch = saved.checklistItems.find((s) => s.type === 'CIS');
                  const wpMatch = saved.checklistItems.find((s) => s.type === 'WP');
                  return { ...item, completed: Boolean(cisMatch?.completed || wpMatch?.completed) };
                }
                const match = saved.checklistItems.find((s) => s.type === item.formType);
                return match ? { ...item, completed: match.completed } : item;
              })
            );
          }
        }
      } catch (err) {
        console.error('Failed to load checklist:', err);
        toast.error('Failed to load checklist.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [offeringId, paramCourseId, toast]);

  const handleCourseInfoChange = (field, value) => {
    setCourseInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleToggle = (id) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      // Build checklistItems array for the backend (only checkable items)
      const checklistItems = checklist
        .filter((item) => item.type === 'item' || item.type === 'sub-item')
        .map((item) => ({
          name: item.name,
          type: item.formType,
          completed: item.completed,
        }));

      await api.post('/checklist', {
        offeringId,
        courseId: offering?.course?._id || paramCourseId,
        courseTitle: courseInfo.courseTitle,
        courseCode: courseInfo.courseCode,
        batch: courseInfo.batch,
        checklistItems,
      });
      toast.success('Checklist saved successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save checklist.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Stage 3 Google Drive Actions ────────────────────────── */

  // Trigger CIS Generation and Google Drive Synchronization
  const handleSyncCIS = async () => {
    if (!offeringId) {
      toast.error('Google Drive synchronization requires an offering-scoped course view.');
      return;
    }
    try {
      setSyncingCIS(true);
      setRowErrors((prev) => ({ ...prev, CIS: null }));
      const res = await syncCISDocument(offeringId, 'pdf');
      toast.success(
        res.message || 'Course Information Sheet (PDF) synchronized to Google Drive successfully!'
      );
      await refreshFilesAndChecklist();
    } catch (err) {
      console.error('CIS synchronization failed:', err);
      const message =
        err.response?.data?.message ||
        'Failed to synchronize Course Information Sheet with Google Drive.';
      setRowErrors((prev) => ({ ...prev, CIS: message }));
      toast.error(message);
    } finally {
      setSyncingCIS(false);
    }
  };

  // Trigger CCR Generation and Google Drive Synchronization
  const handleSyncCCR = async () => {
    if (!offeringId) {
      toast.error('Google Drive synchronization requires an offering-scoped course view.');
      return;
    }
    try {
      setSyncingCCR(true);
      setRowErrors((prev) => ({ ...prev, CCR: null }));
      const res = await syncCCRDocument(offeringId, 'pdf');
      toast.success(
        res.message || 'Course Control Report (PDF) synchronized to Google Drive successfully!'
      );
      await refreshFilesAndChecklist();
    } catch (err) {
      console.error('CCR synchronization failed:', err);
      const message =
        err.response?.data?.message ||
        'Failed to synchronize Course Control Report with Google Drive.';
      setRowErrors((prev) => ({ ...prev, CCR: message }));
      toast.error(message);
    } finally {
      setSyncingCCR(false);
    }
  };

  // Trigger Timetable Generation and Google Drive Synchronization
  const handleSyncTimetable = async () => {
    if (!offeringId) {
      toast.error('Google Drive synchronization requires an offering-scoped course view.');
      return;
    }
    try {
      setSyncingTimetable(true);
      setRowErrors((prev) => ({ ...prev, TIMETABLE: null }));
      const res = await syncTimetableDocument(offeringId, 'pdf');
      toast.success(
        res.message || 'Timetable and Consulting Hours (PDF) synchronized to Google Drive successfully!'
      );
      await refreshFilesAndChecklist();
    } catch (err) {
      console.error('Timetable synchronization failed:', err);
      const message =
        err.response?.data?.message ||
        'Failed to synchronize Timetable with Google Drive.';
      setRowErrors((prev) => ({ ...prev, TIMETABLE: message }));
      toast.error(message);
    } finally {
      setSyncingTimetable(false);
    }
  };

  // Trigger Quiz Synchronization to Google Drive
  const handleSyncQuiz = async (quizId) => {
    if (!offeringId) {
      toast.error('Google Drive synchronization requires an offering-scoped course view.');
      return;
    }
    try {
      setSyncingQuizId(quizId);
      setRowErrors((prev) => ({ ...prev, ASSESS_QUIZ: null }));
      const res = await syncQuizDocument(offeringId, quizId);
      toast.success(
        res.message || 'Quiz PDF synchronized to Google Drive successfully!'
      );
      await refreshFilesAndChecklist();
    } catch (err) {
      console.error('Quiz synchronization failed:', err);
      const message =
        err.response?.data?.message ||
        err.message ||
        'Failed to synchronize Quiz PDF with Google Drive.';
      setRowErrors((prev) => ({ ...prev, ASSESS_QUIZ: message }));
      toast.error(message);
    } finally {
      setSyncingQuizId(null);
    }
  };

  // Trigger Assignment Synchronization to Google Drive
  const handleSyncAssignment = async (assignmentId) => {
    if (!offeringId) {
      toast.error('Google Drive synchronization requires an offering-scoped course view.');
      return;
    }
    try {
      setSyncingAssignmentId(assignmentId);
      setRowErrors((prev) => ({ ...prev, ASSESS_ASSIGN: null }));
      const res = await syncAssignmentDocument(offeringId, assignmentId);
      toast.success(
        res.message || 'Assignment PDF synchronized to Google Drive successfully!'
      );
      await refreshFilesAndChecklist();
    } catch (err) {
      console.error('Assignment synchronization failed:', err);
      const message =
        err.response?.data?.message ||
        err.message ||
        'Failed to synchronize Assignment PDF with Google Drive.';
      setRowErrors((prev) => ({ ...prev, ASSESS_ASSIGN: message }));
      toast.error(message);
    } finally {
      setSyncingAssignmentId(null);
    }
  };

  // Open the Upload Modal for a document item
  const openUploadModal = (item) => {
    setUploadModal({
      isOpen: true,
      item,
      file: null,
      instanceName: '',
      isSubmitting: false,
      error: '',
    });
  };

  // Close the Upload Modal
  const closeUploadModal = () => {
    if (uploadModal.isSubmitting) return;
    setUploadModal({
      isOpen: false,
      item: null,
      file: null,
      instanceName: '',
      isSubmitting: false,
      error: '',
    });
  };

  // Submit manual document upload to Google Drive
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadModal.file) {
      setUploadModal((prev) => ({ ...prev, error: 'Please choose a file to upload.' }));
      return;
    }

    const { item, file, instanceName } = uploadModal;
    const docType = item.formType;

    // Check 25 MB client limit
    if (file.size > 25 * 1024 * 1024) {
      const errText = 'File size exceeds the 25 MB limit.';
      setUploadModal((prev) => ({ ...prev, error: errText }));
      toast.error(errText);
      return;
    }

    try {
      setUploadModal((prev) => ({ ...prev, isSubmitting: true, error: '' }));
      setUploadingDocType(docType);
      setRowErrors((prev) => ({ ...prev, [docType]: null }));

      const res = await uploadOfferingDocument(offeringId, {
        file,
        documentType: docType,
        instanceName: instanceName.trim(),
      });

      toast.success(res.message || `${item.name} uploaded to Google Drive successfully!`);
      closeUploadModal();
      await refreshFilesAndChecklist();
    } catch (err) {
      console.error('Upload to Google Drive failed:', err);
      const message =
        err.response?.data?.message || `Failed to upload ${item.name} to Google Drive.`;
      setUploadModal((prev) => ({ ...prev, isSubmitting: false, error: message }));
      setRowErrors((prev) => ({ ...prev, [docType]: message }));
      toast.error(message);
    } finally {
      setUploadingDocType(null);
    }
  };

  // Target ID for links
  const activeCourseId = offering?.course?._id || paramCourseId;

  // Serial number counter for display
  let serialNo = 0;

  return (
    <div className="dashboard">
      <div
        className="dashboard-header-container"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <div>
          <Link to="/faculty/dashboard" className="back-link">
            ← Back to Courses
          </Link>
          <h1 className="dashboard-heading">Course File Checklist</h1>
          {offering && (
            <p className="dashboard-sub">
              {offering.course?.courseCode} - {offering.course?.courseName} (
              {offering.semester?.name ? `${offering.semester.name} - ` : ''}
              Section {offering.section || 'A'})
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          {driveFolder?.folderId && (
            <a
              href={`https://drive.google.com/drive/folders/${driveFolder.folderId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '0.6rem 1.1rem',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                border: '1px solid #cbd5e1',
                textDecoration: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '0.9rem',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s',
              }}
              title="Open Destination Google Drive Folder"
            >
              <span>📁 Open Drive Folder</span>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>↗</span>
            </a>
          )}
          <Link
            to={
              offeringId
                ? `/faculty/offering/${offeringId}/obe`
                : `/faculty/course/${activeCourseId}/obe`
            }
            style={{
              padding: '0.6rem 1.2rem',
              backgroundColor: '#4338ca',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '0.95rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              transition: 'all 0.2s',
            }}
          >
            OBE Workspace
          </Link>
        </div>
      </div>

      {loading && (
        <div
          style={{
            textAlign: 'center',
            marginBottom: '1rem',
            fontStyle: 'italic',
            color: '#64748b',
          }}
        >
          Loading course file details...
        </div>
      )}

      {/* Google Drive Status Banner */}
      {offeringId && (
        <div
          className="dashboard-panel"
          style={{
            marginBottom: '1.5rem',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1.25rem 1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
              }}
            >
              ☁️
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1rem',
                    fontWeight: '700',
                    color: '#0f172a',
                  }}
                >
                  Google Drive Synchronization
                </h3>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    backgroundColor: driveFolder ? '#ecfdf5' : '#f1f5f9',
                    color: driveFolder ? '#047857' : '#64748b',
                    border: `1px solid ${driveFolder ? '#a7f3d0' : '#e2e8f0'}`,
                  }}
                >
                  {driveFolder ? '● Connected' : 'Checking status...'}
                </span>
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                {driveFolder ? (
                  <>
                    Destination folder: <strong>{driveFolder.folderName || 'CourseFileFall2026'}</strong>{' '}
                    • {totalSyncedCount} of {totalChecklistItemsCount} documents synchronized
                  </>
                ) : (
                  'Synchronizing course documents with configured institutional Google Drive repository'
                )}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handleSyncCIS}
              disabled={syncingCIS || loadingFiles}
              style={{
                padding: '0.55rem 1.1rem',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.88rem',
                fontWeight: '600',
                cursor: syncingCIS ? 'wait' : 'pointer',
                boxShadow: '0 1px 2px rgba(37,99,235,0.2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s',
                opacity: syncingCIS ? 0.75 : 1,
              }}
            >
              {syncingCIS ? (
                <>
                  <span className="spinner-sm" style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                  <span>Syncing CIS...</span>
                </>
              ) : (
                <>
                  <span>⚡ Sync CIS to Drive</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={refreshFilesAndChecklist}
              disabled={loadingFiles}
              title="Refresh Google Drive files status"
              style={{
                padding: '0.55rem 0.85rem',
                backgroundColor: '#ffffff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: loadingFiles ? 'wait' : 'pointer',
                fontWeight: '600',
              }}
            >
              {loadingFiles ? 'Refreshing...' : '🔄 Refresh'}
            </button>
          </div>
        </div>
      )}

      {/* Course Info Fields */}
      <div className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
        <h2 className="dashboard-section-title">Course Details</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label
              style={{
                marginBottom: '0.35rem',
                fontSize: '0.85rem',
                fontWeight: '600',
                color: '#475569',
              }}
            >
              Course Title
            </label>
            <input
              type="text"
              value={courseInfo.courseTitle}
              onChange={(e) => handleCourseInfoChange('courseTitle', e.target.value)}
              placeholder="Enter Course Title"
              style={{
                padding: '0.6rem 0.8rem',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                borderRadius: '6px',
                fontSize: '0.95rem',
                outline: 'none',
                colorScheme: 'light',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label
              style={{
                marginBottom: '0.35rem',
                fontSize: '0.85rem',
                fontWeight: '600',
                color: '#475569',
              }}
            >
              Course Code
            </label>
            <input
              type="text"
              value={courseInfo.courseCode}
              onChange={(e) => handleCourseInfoChange('courseCode', e.target.value)}
              placeholder="Enter Course Code"
              style={{
                padding: '0.6rem 0.8rem',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                borderRadius: '6px',
                fontSize: '0.95rem',
                outline: 'none',
                colorScheme: 'light',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label
              style={{
                marginBottom: '0.35rem',
                fontSize: '0.85rem',
                fontWeight: '600',
                color: '#475569',
              }}
            >
              Batch
            </label>
            <input
              type="text"
              value={courseInfo.batch}
              onChange={(e) => handleCourseInfoChange('batch', e.target.value)}
              placeholder="e.g., Fall 2024"
              style={{
                padding: '0.6rem 0.8rem',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                borderRadius: '6px',
                fontSize: '0.95rem',
                outline: 'none',
                colorScheme: 'light',
              }}
            />
          </div>
        </div>
      </div>

      {/* Checklist & Document Synchronization Table */}
      <div className="dashboard-panel">
        <h2 className="dashboard-section-title">Document Checklist & Google Drive Synchronization</h2>
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.9rem',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left' }}>
                <th
                  style={{
                    padding: '0.75rem 0.8rem',
                    border: '1px solid #e2e8f0',
                    fontWeight: '700',
                    color: '#0f172a',
                    width: '55px',
                    textAlign: 'center',
                  }}
                >
                  S.No
                </th>
                <th
                  style={{
                    padding: '0.75rem 1rem',
                    border: '1px solid #e2e8f0',
                    fontWeight: '700',
                    color: '#0f172a',
                    minWidth: '220px',
                  }}
                >
                  Document Item
                </th>
                <th
                  style={{
                    padding: '0.75rem 0.75rem',
                    border: '1px solid #e2e8f0',
                    fontWeight: '700',
                    color: '#0f172a',
                    width: '80px',
                    textAlign: 'center',
                  }}
                  title="Checklist completion status"
                >
                  Check
                </th>
                <th
                  style={{
                    padding: '0.75rem 0.85rem',
                    border: '1px solid #e2e8f0',
                    fontWeight: '700',
                    color: '#0f172a',
                    width: '135px',
                    textAlign: 'center',
                  }}
                >
                  Drive Status
                </th>
                <th
                  style={{
                    padding: '0.75rem 1rem',
                    border: '1px solid #e2e8f0',
                    fontWeight: '700',
                    color: '#0f172a',
                    minWidth: '210px',
                  }}
                >
                  Google Drive Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {checklist.map((item) => {
                // Separator row
                if (item.type === 'separator') {
                  return (
                    <tr key={item.id} style={{ backgroundColor: '#F1F5F9' }}>
                      <td
                        colSpan={5}
                        style={{
                          padding: '0.65rem 1rem',
                          border: '1px solid #e2e8f0',
                          textAlign: 'center',
                          fontWeight: '600',
                          color: '#475569',
                          fontStyle: 'italic',
                          fontSize: '0.85rem',
                        }}
                      >
                        {item.label}
                      </td>
                    </tr>
                  );
                }

                // Group header row (e.g., "Assessment Record")
                if (item.type === 'group-header') {
                  serialNo++;
                  return (
                    <tr key={item.id} style={{ backgroundColor: '#f8fafc' }}>
                      <td
                        style={{
                          padding: '0.75rem 0.8rem',
                          border: '1px solid #e2e8f0',
                          textAlign: 'center',
                          fontWeight: '700',
                          color: '#334155',
                        }}
                      >
                        {serialNo}
                      </td>
                      <td
                        colSpan={4}
                        style={{
                          padding: '0.75rem 1rem',
                          border: '1px solid #e2e8f0',
                          fontWeight: '700',
                          color: '#1e293b',
                        }}
                      >
                        {item.name}
                      </td>
                    </tr>
                  );
                }

                // Checkable row (item or sub-item)
                const isSubItem = item.type === 'sub-item';
                if (!isSubItem) serialNo++;

                // Matching synchronized files for this documentType
                const matchingFiles = filesByDocType[item.formType] || [];
                const primaryFile = matchingFiles[0];
                const hasDriveFile = Boolean(primaryFile);

                const isQuizItem = item.formType === 'ASSESS_QUIZ';
                const isAssignItem = item.formType === 'ASSESS_ASSIGN';
                const quizCount = isQuizItem ? offeringQuizzes.length : 0;
                const assignCount = isAssignItem ? offeringAssignments.length : 0;

                const singleQuiz = isQuizItem && quizCount === 1 ? offeringQuizzes[0] : null;
                const singleAssign = isAssignItem && assignCount === 1 ? offeringAssignments[0] : null;

                const singleQuizFile = singleQuiz
                  ? matchingFiles.find((f) => f.instanceName === singleQuiz._id?.toString() && f.fileFormat === 'pdf')
                  : null;
                const singleAssignFile = singleAssign
                  ? matchingFiles.find((f) => f.instanceName === singleAssign._id?.toString() && f.fileFormat === 'pdf')
                  : null;

                const isSingleQuizSynced = singleQuizFile?.status === 'synced';
                const isSingleAssignSynced = singleAssignFile?.status === 'synced';

                const assessmentSyncedCount = isQuizItem
                  ? offeringQuizzes.filter((q) =>
                      matchingFiles.some((f) => f.instanceName === q._id?.toString() && f.fileFormat === 'pdf' && f.status === 'synced')
                    ).length
                  : isAssignItem
                  ? offeringAssignments.filter((a) =>
                      matchingFiles.some((f) => f.instanceName === a._id?.toString() && f.fileFormat === 'pdf' && f.status === 'synced')
                    ).length
                  : 0;

                const primaryPdfFile = matchingFiles.find((f) => f.fileFormat === 'pdf' && f.status === 'synced');

                const isSynced = isQuizItem
                  ? (quizCount === 1 ? isSingleQuizSynced : quizCount > 1 ? assessmentSyncedCount > 0 : Boolean(primaryPdfFile))
                  : isAssignItem
                  ? (assignCount === 1 ? isSingleAssignSynced : assignCount > 1 ? assessmentSyncedCount > 0 : Boolean(primaryPdfFile))
                  : primaryFile?.status === 'synced';

                const hasRowError = Boolean(
                  rowErrors[item.formType] ||
                  (isQuizItem && singleQuizFile?.status === 'failed') ||
                  (isAssignItem && singleAssignFile?.status === 'failed') ||
                  primaryFile?.status === 'failed'
                );
                const rowErrorMessage =
                  rowErrors[item.formType] ||
                  (isQuizItem ? singleQuizFile?.syncError : '') ||
                  (isAssignItem ? singleAssignFile?.syncError : '') ||
                  primaryFile?.syncError ||
                  '';
                const isItemUploading = uploadingDocType === item.formType;
                const isItemSyncing =
                  (item.formType === 'CIS' && syncingCIS) ||
                  (item.formType === 'CCR' && syncingCCR) ||
                  (item.formType === 'TIMETABLE' && syncingTimetable) ||
                  (item.formType === 'ASSESS_QUIZ' && Boolean(syncingQuizId)) ||
                  (item.formType === 'ASSESS_ASSIGN' && Boolean(syncingAssignmentId));

                return (
                  <tr
                    key={item.id}
                    style={{
                      backgroundColor: isSynced ? '#fafdfb' : 'transparent',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    {/* S.No */}
                    <td
                      style={{
                        padding: '0.75rem 0.8rem',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center',
                        color: isSubItem ? '#64748b' : '#334155',
                        fontWeight: isSubItem ? '400' : '600',
                        fontSize: isSubItem ? '0.85rem' : '0.9rem',
                      }}
                    >
                      {isSubItem ? '—' : serialNo}
                    </td>

                    {/* Item Name */}
                    <td
                      style={{
                        padding: '0.75rem 1rem',
                        border: '1px solid #e2e8f0',
                        paddingLeft: isSubItem ? '2.25rem' : '1rem',
                        color: '#334155',
                      }}
                    >
                      <div>
                        <Link
                          to={
                            offeringId
                              ? `/offering/${offeringId}/form/${item.formType}`
                              : `/course/${activeCourseId}/form/${item.formType}`
                          }
                          style={{
                            color: '#3949ab',
                            textDecoration: 'none',
                            fontWeight: '600',
                            fontSize: '0.92rem',
                          }}
                        >
                          {item.name}
                        </Link>
                      </div>

                      {/* Display synchronized file details if available */}
                      {hasDriveFile && (
                        <div
                          style={{
                            marginTop: '0.3rem',
                            fontSize: '0.78rem',
                            color: '#64748b',
                            display: 'flex',
                            gap: '0.5rem',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span>📄 {primaryFile.filename || 'Document'}</span>
                          {primaryFile.sizeBytes ? (
                            <span>• {(primaryFile.sizeBytes / 1024).toFixed(1)} KB</span>
                          ) : null}
                          {primaryFile.version > 1 ? (
                            <span style={{ color: '#047857', fontWeight: '600' }}>
                              v{primaryFile.version}
                            </span>
                          ) : null}
                        </div>
                      )}

                      {/* Display multiple assessment or lecture instances if present */}
                      {matchingFiles.length > 1 && (
                        <div style={{ marginTop: '0.4rem', fontSize: '0.78rem' }}>
                          <span style={{ color: '#64748b' }}>Files ({matchingFiles.length}): </span>
                          {matchingFiles.map((f, idx) => (
                            <span key={f._id || idx} style={{ marginRight: '0.5rem' }}>
                              {f.googleDriveWebViewLink ? (
                                <a
                                  href={f.googleDriveWebViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#2563eb', textDecoration: 'none' }}
                                >
                                  {f.filename || f.instanceName || `File ${idx + 1}`} ↗
                                </a>
                              ) : (
                                <span>{f.filename || f.instanceName || `File ${idx + 1}`}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Row error display */}
                      {hasRowError && rowErrorMessage && (
                        <div
                          style={{
                            marginTop: '0.35rem',
                            fontSize: '0.75rem',
                            color: '#b91c1c',
                            backgroundColor: '#fef2f2',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #fecaca',
                          }}
                        >
                          ⚠️ {rowErrorMessage}
                        </div>
                      )}
                    </td>

                    {/* Manual Checklist Checkbox */}
                    <td
                      style={{
                        padding: '0.75rem 0.75rem',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleToggle(item.id)}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          accentColor: '#3949ab',
                        }}
                        title={`Mark ${item.name} as complete/incomplete`}
                      />
                    </td>

                    {/* Google Drive Status Badge */}
                    <td
                      style={{
                        padding: '0.75rem 0.85rem',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center',
                      }}
                    >
                      {isSynced ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.25rem 0.65rem',
                            borderRadius: '9999px',
                            fontSize: '0.78rem',
                            fontWeight: '600',
                            backgroundColor: '#ecfdf5',
                            color: '#047857',
                            border: '1px solid #a7f3d0',
                          }}
                        >
                          <span>✓</span>
                          <span>
                            {isQuizItem && quizCount > 1
                              ? `PDF Synced (${assessmentSyncedCount}/${quizCount})`
                              : isAssignItem && assignCount > 1
                              ? `PDF Synced (${assessmentSyncedCount}/${assignCount})`
                              : isQuizItem && quizCount === 1
                              ? `PDF Synced${singleQuizFile?.version > 1 ? ` v${singleQuizFile.version}` : ''}`
                              : isAssignItem && assignCount === 1
                              ? `PDF Synced${singleAssignFile?.version > 1 ? ` v${singleAssignFile.version}` : ''}`
                              : (isQuizItem || isAssignItem)
                              ? `PDF Synced${primaryPdfFile?.version > 1 ? ` v${primaryPdfFile.version}` : ''}`
                              : item.formType === 'LECTURES' && matchingFiles.length > 0
                              ? `Synced (${matchingFiles.length} file${matchingFiles.length > 1 ? 's' : ''})`
                              : primaryFile?.version > 1
                              ? `Synced v${primaryFile.version}`
                              : 'Synced'}
                          </span>
                        </span>
                      ) : hasRowError ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.25rem 0.65rem',
                            borderRadius: '9999px',
                            fontSize: '0.78rem',
                            fontWeight: '600',
                            backgroundColor: '#fef2f2',
                            color: '#b91c1c',
                            border: '1px solid #fecaca',
                          }}
                          title={rowErrorMessage}
                        >
                          <span>✗</span>
                          <span>{rowErrors[item.formType] ? 'Sync failed' : 'Upload failed'}</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.25rem 0.65rem',
                            borderRadius: '9999px',
                            fontSize: '0.78rem',
                            fontWeight: '500',
                            backgroundColor: '#f1f5f9',
                            color: '#64748b',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <span>
                            {isQuizItem && quizCount === 0
                              ? 'Not created'
                              : isAssignItem && assignCount === 0
                              ? 'Not created'
                              : isQuizItem || isAssignItem
                              ? 'PDF Not Synced'
                              : 'Not uploaded'}
                          </span>
                        </span>
                      )}
                    </td>

                    {/* Google Drive Actions */}
                    <td
                      style={{
                        padding: '0.75rem 1rem',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* CIS Sync Action */}
                        {item.formType === 'CIS' && (
                          <button
                            type="button"
                            onClick={handleSyncCIS}
                            disabled={isItemSyncing || !offeringId}
                            style={{
                              padding: '0.35rem 0.75rem',
                              backgroundColor: isSynced ? '#eff6ff' : '#2563eb',
                              color: isSynced ? '#1d4ed8' : '#ffffff',
                              border: isSynced ? '1px solid #bfdbfe' : 'none',
                              borderRadius: '6px',
                              fontSize: '0.82rem',
                              fontWeight: '600',
                              cursor: isItemSyncing ? 'wait' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              transition: 'all 0.15s',
                              opacity: isItemSyncing ? 0.75 : 1,
                            }}
                            title="Generate and synchronize CIS document to Google Drive"
                          >
                            {isItemSyncing ? (
                              <span>Syncing...</span>
                            ) : isSynced ? (
                              <span>Re-sync CIS</span>
                            ) : (
                              <span>⚡ Sync to Drive</span>
                            )}
                          </button>
                        )}

                        {/* CCR Sync Action */}
                        {item.formType === 'CCR' && (
                          <button
                            type="button"
                            onClick={handleSyncCCR}
                            disabled={isItemSyncing || !offeringId}
                            style={{
                              padding: '0.35rem 0.75rem',
                              backgroundColor: isSynced ? '#eff6ff' : '#2563eb',
                              color: isSynced ? '#1d4ed8' : '#ffffff',
                              border: isSynced ? '1px solid #bfdbfe' : 'none',
                              borderRadius: '6px',
                              fontSize: '0.82rem',
                              fontWeight: '600',
                              cursor: isItemSyncing ? 'wait' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              transition: 'all 0.15s',
                              opacity: isItemSyncing ? 0.75 : 1,
                            }}
                            title="Generate and synchronize CCR document to Google Drive"
                          >
                            {isItemSyncing ? (
                              <span>Syncing...</span>
                            ) : isSynced ? (
                              <span>Re-sync CCR</span>
                            ) : (
                              <span>⚡ Sync to Drive</span>
                            )}
                          </button>
                        )}

                        {/* Timetable Sync Action */}
                        {item.formType === 'TIMETABLE' && (
                          <button
                            type="button"
                            onClick={handleSyncTimetable}
                            disabled={isItemSyncing || !offeringId}
                            style={{
                              padding: '0.35rem 0.75rem',
                              backgroundColor: isSynced ? '#eff6ff' : '#2563eb',
                              color: isSynced ? '#1d4ed8' : '#ffffff',
                              border: isSynced ? '1px solid #bfdbfe' : 'none',
                              borderRadius: '6px',
                              fontSize: '0.82rem',
                              fontWeight: '600',
                              cursor: isItemSyncing ? 'wait' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              transition: 'all 0.15s',
                              opacity: isItemSyncing ? 0.75 : 1,
                            }}
                            title="Generate and synchronize Timetable document to Google Drive"
                          >
                            {isItemSyncing ? (
                              <span>Syncing...</span>
                            ) : isSynced ? (
                              <span>Re-sync Timetable</span>
                            ) : (
                              <span>⚡ Sync to Drive</span>
                            )}
                          </button>
                        )}


                        {/* Lectures Action: Manage Lectures */}
                        {item.formType === 'LECTURES' && (
                          <Link
                            to={
                              offeringId
                                ? `/offering/${offeringId}/form/LECTURES`
                                : `/course/${activeCourseId}/form/LECTURES`
                            }
                            style={{
                              padding: '0.35rem 0.75rem',
                              backgroundColor: isSynced ? '#eff6ff' : '#2563eb',
                              color: isSynced ? '#1d4ed8' : '#ffffff',
                              border: isSynced ? '1px solid #bfdbfe' : 'none',
                              borderRadius: '6px',
                              fontSize: '0.82rem',
                              fontWeight: '600',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              transition: 'all 0.15s',
                            }}
                            title="Open Lectures File Manager to upload and manage lecture files"
                          >
                            <span>📂 Manage Lectures{matchingFiles.length > 0 ? ` (${matchingFiles.length})` : ''}</span>
                          </Link>
                        )}

                        {/* Quiz Sync / Manage Actions */}
                        {item.formType === 'ASSESS_QUIZ' && (
                          <>
                            {quizCount === 0 ? (
                              <Link
                                to={
                                  offeringId
                                    ? `/offering/${offeringId}/form/ASSESS_QUIZ`
                                    : `/course/${activeCourseId}/form/ASSESS_QUIZ`
                                }
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  backgroundColor: '#f8fafc',
                                  color: '#475569',
                                  border: '1px dashed #cbd5e1',
                                  borderRadius: '6px',
                                  fontSize: '0.82rem',
                                  fontWeight: '600',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  transition: 'all 0.15s',
                                }}
                                title="No quizzes created for this offering. Click to create a quiz."
                              >
                                <span>+ Create Quiz</span>
                              </Link>
                            ) : quizCount === 1 ? (
                              <button
                                type="button"
                                onClick={() => handleSyncQuiz(singleQuiz._id)}
                                disabled={isItemSyncing || !offeringId}
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  backgroundColor: isSingleQuizSynced ? '#eff6ff' : '#2563eb',
                                  color: isSingleQuizSynced ? '#1d4ed8' : '#ffffff',
                                  border: isSingleQuizSynced ? '1px solid #bfdbfe' : 'none',
                                  borderRadius: '6px',
                                  fontSize: '0.82rem',
                                  fontWeight: '600',
                                  cursor: isItemSyncing ? 'wait' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  transition: 'all 0.15s',
                                  opacity: isItemSyncing ? 0.75 : 1,
                                }}
                                title={
                                  isSingleQuizSynced
                                    ? 'Re-synchronize quiz PDF to Google Drive'
                                    : 'Generate and synchronize quiz PDF to Google Drive'
                                }
                              >
                                {isItemSyncing ? (
                                  <span>Syncing...</span>
                                ) : isSingleQuizSynced ? (
                                  <span>Re-sync PDF</span>
                                ) : (
                                  <span>⚡ Sync PDF</span>
                                )}
                              </button>
                            ) : (
                              <Link
                                to={
                                  offeringId
                                    ? `/offering/${offeringId}/form/ASSESS_QUIZ`
                                    : `/course/${activeCourseId}/form/ASSESS_QUIZ`
                                }
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  backgroundColor: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: '6px',
                                  fontSize: '0.82rem',
                                  fontWeight: '600',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  transition: 'all 0.15s',
                                }}
                                title="Open Quiz Management to view and synchronize individual quiz PDFs"
                              >
                                <span>📂 Manage & Sync Quizzes ({quizCount})</span>
                              </Link>
                            )}
                          </>
                        )}

                        {/* Assignment Sync / Manage Actions */}
                        {item.formType === 'ASSESS_ASSIGN' && (
                          <>
                            {assignCount === 0 ? (
                              <Link
                                to={
                                  offeringId
                                    ? `/offering/${offeringId}/form/ASSESS_ASSIGN`
                                    : `/course/${activeCourseId}/form/ASSESS_ASSIGN`
                                }
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  backgroundColor: '#f8fafc',
                                  color: '#475569',
                                  border: '1px dashed #cbd5e1',
                                  borderRadius: '6px',
                                  fontSize: '0.82rem',
                                  fontWeight: '600',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  transition: 'all 0.15s',
                                }}
                                title="No assignments created for this offering. Click to create an assignment."
                              >
                                <span>+ Create Assignment</span>
                              </Link>
                            ) : assignCount === 1 ? (
                              <button
                                type="button"
                                onClick={() => handleSyncAssignment(singleAssign._id)}
                                disabled={isItemSyncing || !offeringId}
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  backgroundColor: isSingleAssignSynced ? '#eff6ff' : '#2563eb',
                                  color: isSingleAssignSynced ? '#1d4ed8' : '#ffffff',
                                  border: isSingleAssignSynced ? '1px solid #bfdbfe' : 'none',
                                  borderRadius: '6px',
                                  fontSize: '0.82rem',
                                  fontWeight: '600',
                                  cursor: isItemSyncing ? 'wait' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  transition: 'all 0.15s',
                                  opacity: isItemSyncing ? 0.75 : 1,
                                }}
                                title={
                                  isSingleAssignSynced
                                    ? 'Re-synchronize assignment PDF to Google Drive'
                                    : 'Generate and synchronize assignment PDF to Google Drive'
                                }
                              >
                                {isItemSyncing ? (
                                  <span>Syncing...</span>
                                ) : isSingleAssignSynced ? (
                                  <span>Re-sync PDF</span>
                                ) : (
                                  <span>⚡ Sync PDF</span>
                                )}
                              </button>
                            ) : (
                              <Link
                                to={
                                  offeringId
                                    ? `/offering/${offeringId}/form/ASSESS_ASSIGN`
                                    : `/course/${activeCourseId}/form/ASSESS_ASSIGN`
                                }
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  backgroundColor: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: '6px',
                                  fontSize: '0.82rem',
                                  fontWeight: '600',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  transition: 'all 0.15s',
                                }}
                                title="Open Assignment Management to view and synchronize individual assignment PDFs"
                              >
                                <span>📂 Manage & Sync Assignments ({assignCount})</span>
                              </Link>
                            )}
                          </>
                        )}

                        {/* View in Google Drive Button */}
                        {(() => {
                          const viewFile =
                            isQuizItem
                              ? singleQuizFile || matchingFiles.find((f) => f.fileFormat === 'pdf' && f.googleDriveWebViewLink)
                              : isAssignItem
                              ? singleAssignFile || matchingFiles.find((f) => f.fileFormat === 'pdf' && f.googleDriveWebViewLink)
                              : primaryFile;
                          if (!viewFile?.googleDriveWebViewLink) return null;
                          return (
                            <a
                              href={viewFile.googleDriveWebViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: '0.35rem 0.75rem',
                                backgroundColor: '#f0fdf4',
                                color: '#166534',
                                border: '1px solid #bbf7d0',
                                borderRadius: '6px',
                                fontSize: '0.82rem',
                                fontWeight: '600',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                transition: 'all 0.15s',
                              }}
                              title={isQuizItem || isAssignItem ? 'Open PDF in Google Drive' : 'Open document in Google Drive'}
                            >
                              <span>{isQuizItem || isAssignItem ? 'View PDF in Drive' : 'View in Drive'}</span>
                              <span style={{ fontSize: '0.75rem' }}>↗</span>
                            </a>
                          );
                        })()}

                        {/* Upload File Action */}
                        {item.formType !== 'LECTURES' && (
                          <button
                            type="button"
                            onClick={() => openUploadModal(item)}
                            disabled={isItemUploading || !offeringId}
                            style={{
                              padding: '0.35rem 0.75rem',
                              backgroundColor: '#ffffff',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '0.82rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              transition: 'all 0.15s',
                            }}
                            title={`Upload ${item.name} to Google Drive`}
                          >
                            <span>{isSynced ? 'Update File' : 'Upload File'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Save Checklist Button */}
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: '#3949ab',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Saving...' : 'Save Checklist'}
          </button>
        </div>
      </div>

      {/* Manual Document Upload Modal */}
      {uploadModal.isOpen && uploadModal.item && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={closeUploadModal}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: '700' }}>
                  Upload to Google Drive
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  {uploadModal.item.name}
                </p>
              </div>
              <button
                type="button"
                onClick={closeUploadModal}
                disabled={uploadModal.isSubmitting}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  color: '#94a3b8',
                  cursor: uploadModal.isSubmitting ? 'not-allowed' : 'pointer',
                  padding: '0.25rem',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit}>
              {/* File input */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '0.4rem' }}>
                  Select File <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.jpg,.jpeg,.png,.zip"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] || null;
                    setUploadModal((prev) => ({ ...prev, file: selected, error: '' }));
                  }}
                  disabled={uploadModal.isSubmitting}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.88rem',
                    color: '#334155',
                    backgroundColor: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                  Supported formats: PDF, Word, Excel, PowerPoint, Images, ZIP (max 25 MB).
                </span>
              </div>

              {/* Optional instance name for repeated assessment documents */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '0.4rem' }}>
                  Instance Name / Label <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  value={uploadModal.instanceName}
                  onChange={(e) => setUploadModal((prev) => ({ ...prev, instanceName: e.target.value }))}
                  placeholder="e.g., Quiz 1, Assignment 2, Midterm Solution"
                  disabled={uploadModal.isSubmitting}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Error display */}
              {uploadModal.error && (
                <div
                  style={{
                    marginBottom: '1.25rem',
                    padding: '0.6rem 0.8rem',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    color: '#b91c1c',
                    fontSize: '0.85rem',
                  }}
                >
                  ⚠️ {uploadModal.error}
                </div>
              )}

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={closeUploadModal}
                  disabled={uploadModal.isSubmitting}
                  style={{
                    padding: '0.6rem 1.1rem',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: uploadModal.isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadModal.isSubmitting || !uploadModal.file}
                  style={{
                    padding: '0.6rem 1.4rem',
                    backgroundColor: uploadModal.isSubmitting || !uploadModal.file ? '#94a3b8' : '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: uploadModal.isSubmitting || !uploadModal.file ? 'not-allowed' : 'pointer',
                  }}
                >
                  {uploadModal.isSubmitting ? 'Uploading to Drive...' : 'Upload to Drive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseFileChecklist;
