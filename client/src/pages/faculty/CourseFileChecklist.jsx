import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import useToast from '../../hooks/useToast';
import {
  getOfferingFiles,
  syncCISDocument,
  syncCCRDocument,
  syncTimetableDocument,
  syncProjectDocument,
  syncCCCDocument,
  syncCRRDocument,
  syncQuizDocument,
  syncAssignmentDocument,
  uploadOfferingDocument,
  getGoogleDriveStatus,
} from '../../services/courseFile.service';
import ExamUploadSection from '../../components/forms/Exam/ExamUploadSection';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import Icon from '../../components/common/Icon';
import './CourseFileChecklist.css';

const MIDTERM_DOC_TYPES = [
  'MIDTERM_EXAM_PAPER',
  'MIDTERM_BEST_COPY',
  'MIDTERM_AVERAGE_COPY',
  'MIDTERM_WORST_COPY',
];

const FINAL_DOC_TYPES = [
  'FINAL_EXAM_PAPER',
  'FINAL_BEST_COPY',
  'FINAL_AVERAGE_COPY',
  'FINAL_WORST_COPY',
];

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
  const [syncingProject, setSyncingProject] = useState(false);
  const [syncingCCC, setSyncingCCC] = useState(false);
  const [syncingCRR, setSyncingCRR] = useState(false);
  const [offeringQuizzes, setOfferingQuizzes] = useState([]);
  const [offeringAssignments, setOfferingAssignments] = useState([]);
  const [syncingQuizId, setSyncingQuizId] = useState(null);
  const [syncingAssignmentId, setSyncingAssignmentId] = useState(null);
  const [uploadingDocType, setUploadingDocType] = useState(null);
  const [rowErrors, setRowErrors] = useState({});
  const [expandedExams, setExpandedExams] = useState({ MIDTERM: false, FINAL: false });

  const toggleExpandExam = (type) => {
    setExpandedExams((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

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
      if (type === 'CCP') {
        if (!map['ASSESS_PROJECT']) map['ASSESS_PROJECT'] = [];
        map['ASSESS_PROJECT'].push(file);
      }
    });
    return map;
  }, [courseFiles]);

  // Count total synchronized items
  const totalSyncedCount = useMemo(() => {
    const syncedTypes = new Set();
    courseFiles.forEach((f) => {
      if (f.status === 'synced') syncedTypes.add(f.documentType);
    });

    const isMidtermDone = MIDTERM_DOC_TYPES.filter((t) => syncedTypes.has(t)).length === 4;
    if (isMidtermDone) syncedTypes.add('ASSESS_MID');

    const isFinalDone = FINAL_DOC_TYPES.filter((t) => syncedTypes.has(t)).length === 4;
    if (isFinalDone) syncedTypes.add('ASSESS_FINAL');

    const validFormTypes = new Set(
      INITIAL_CHECKLIST.filter((i) => i.formType).map((i) => i.formType)
    );
    let count = 0;
    validFormTypes.forEach((ft) => {
      if (syncedTypes.has(ft)) count++;
    });
    return count;
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
            if (item.formType === 'ASSESS_MID') {
              const mCount = MIDTERM_DOC_TYPES.filter((t) =>
                (files || []).some((f) => f.documentType === t && f.status === 'synced')
              ).length;
              return { ...item, completed: mCount === 4 };
            }
            if (item.formType === 'ASSESS_FINAL') {
              const fCount = FINAL_DOC_TYPES.filter((t) =>
                (files || []).some((f) => f.documentType === t && f.status === 'synced')
              ).length;
              return { ...item, completed: fCount === 4 };
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
        let loadedFiles = [];

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

          // Fetch offering-scoped checklist, files, and Google Drive connection status concurrently
          const [checklistRes, files, statusInfo, quizRes, assignRes] = await Promise.all([
            api.get(`/checklist/offering/${offeringId}`),
            getOfferingFiles(offeringId).catch(() => []),
            getGoogleDriveStatus().catch(() => null),
            api.get(`/quizzes/offering/${offeringId}`).catch(() => ({ data: { data: { quizzes: [] } } })),
            api.get(`/assignments/offering/${offeringId}`).catch(() => ({ data: { data: { assignments: [] } } })),
          ]);

          loadedFiles = files || [];
          checklistData = checklistRes.data?.data?.checklist;
          setCourseFiles(loadedFiles);
          if (statusInfo && statusInfo.isConfigured) {
            setDriveFolder({
              folderId: statusInfo.destinationFolderId,
              folderName: 'Institutional Google Drive',
              isConfigured: true,
              authorizedEmail: statusInfo.authorizedEmail,
            });
          } else {
            setDriveFolder({ isConfigured: false });
          }
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
                if (item.formType === 'ASSESS_MID') {
                  const mCount = MIDTERM_DOC_TYPES.filter((t) =>
                    (loadedFiles || []).some((f) => f.documentType === t && f.status === 'synced')
                  ).length;
                  return { ...item, completed: mCount === 4 };
                }
                if (item.formType === 'ASSESS_FINAL') {
                  const fCount = FINAL_DOC_TYPES.filter((t) =>
                    (loadedFiles || []).some((f) => f.documentType === t && f.status === 'synced')
                  ).length;
                  return { ...item, completed: fCount === 4 };
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

  // Trigger CCP / Class Project Generation and Google Drive Synchronization
  const handleSyncProject = async () => {
    if (!offeringId) {
      toast.error('Google Drive synchronization requires an offering-scoped course view.');
      return;
    }
    try {
      setSyncingProject(true);
      setRowErrors((prev) => ({ ...prev, ASSESS_PROJECT: null }));
      const res = await syncProjectDocument(offeringId);
      toast.success(
        res.message || 'CCP / Class Project (PDF) synchronized to Google Drive successfully!'
      );
      await refreshFilesAndChecklist();
    } catch (err) {
      console.error('Class Project synchronization failed:', err);
      const message =
        err.response?.data?.message ||
        'Failed to synchronize Class Project with Google Drive.';
      setRowErrors((prev) => ({ ...prev, ASSESS_PROJECT: message }));
      toast.error(message);
    } finally {
      setSyncingProject(false);
    }
  };

  // Trigger CCC Generation and Google Drive Synchronization
  const handleSyncCCC = async () => {
    if (!offeringId) {
      toast.error('Google Drive synchronization requires an offering-scoped course view.');
      return;
    }
    try {
      setSyncingCCC(true);
      setRowErrors((prev) => ({ ...prev, CCC: null }));
      const res = await syncCCCDocument(offeringId);
      toast.success(
        res.message || 'Course Completion Certificate (PDF) synchronized to Google Drive successfully!'
      );
      await refreshFilesAndChecklist();
    } catch (err) {
      console.error('CCC synchronization failed:', err);
      const message =
        err.response?.data?.message ||
        'Failed to synchronize Course Completion Certificate with Google Drive.';
      setRowErrors((prev) => ({ ...prev, CCC: message }));
      toast.error(message);
    } finally {
      setSyncingCCC(false);
    }
  };

  // Trigger CRR Generation and Google Drive Synchronization
  const handleSyncCRR = async () => {
    if (!offeringId) {
      toast.error('Google Drive synchronization requires an offering-scoped course view.');
      return;
    }
    try {
      setSyncingCRR(true);
      setRowErrors((prev) => ({ ...prev, CRR: null }));
      const res = await syncCRRDocument(offeringId);
      toast.success(
        res.message || 'Course Review Report (PDF) synchronized to Google Drive successfully!'
      );
      await refreshFilesAndChecklist();
    } catch (err) {
      console.error('CRR synchronization failed:', err);
      const message =
        err.response?.data?.message ||
        'Failed to synchronize Course Review Report with Google Drive.';
      setRowErrors((prev) => ({ ...prev, CRR: message }));
      toast.error(message);
    } finally {
      setSyncingCRR(false);
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
    <div className="checklist-page">
      <div className="checklist-header">
        <div>
          <Link to="/faculty/dashboard" className="checklist-back-link">
            <Icon name="chevron-left" size={14} />
            <span>Back to Courses</span>
          </Link>
          <h1 className="checklist-heading">Course File Checklist</h1>
          {offering && (
            <p className="checklist-sub">
              {offering.course?.courseCode} - {offering.course?.courseName} (
              {offering.semester?.name ? `${offering.semester.name} - ` : ''}
              Section {offering.section || 'A'})
            </p>
          )}
        </div>
        <div className="checklist-header-actions">
          {driveFolder?.isConfigured && driveFolder?.folderId && (
            <a
              href={`https://drive.google.com/drive/folders/${driveFolder.folderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="cfes-btn cfes-btn--secondary cfes-btn--md"
              title="Open Destination Google Drive Folder"
            >
              <Icon name="folder" size={16} />
              <span>Open Drive Folder</span>
              <Icon name="external" size={13} />
            </a>
          )}
          <Link
            to={
              offeringId
                ? `/faculty/offering/${offeringId}/obe`
                : `/faculty/course/${activeCourseId}/obe`
            }
            className="cfes-btn cfes-btn--primary cfes-btn--md"
          >
            <Icon name="dashboard" size={16} />
            <span>OBE Workspace</span>
          </Link>
        </div>
      </div>

      {loading && (
        <div
          style={{
            textAlign: 'center',
            margin: 'var(--cfes-space-4) 0',
            color: 'var(--cfes-slate-500)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--cfes-space-2)',
          }}
        >
          <Icon name="spinner" size={18} className="cfes-spin" />
          <span>Loading course file details...</span>
        </div>
      )}

      {/* Google Drive Status Banner */}
      {offeringId && (
        <div className="checklist-drive-banner">
          <div className="checklist-drive-left">
            <div className="checklist-drive-icon">
              <Icon name="cloud" size={24} />
            </div>
            <div className="checklist-drive-info">
              <div className="checklist-drive-title-row">
                <h3 className="checklist-drive-title">Google Drive Synchronization</h3>
                <StatusBadge
                  variant={driveFolder?.isConfigured ? 'success' : driveFolder ? 'danger' : 'neutral'}
                  label={driveFolder?.isConfigured ? 'Connected' : driveFolder ? 'Disconnected' : 'Checking status...'}
                />
              </div>
              <p className="checklist-drive-desc">
                {driveFolder?.isConfigured ? (
                  <>
                    Destination folder: <strong>{driveFolder.folderName || 'Institutional Google Drive'}</strong>{' '}
                    • {totalSyncedCount} of {totalChecklistItemsCount} documents synchronized
                  </>
                ) : (
                  'Google Drive is currently disconnected. Course files and checklists can still be edited and managed in the portal.'
                )}
              </p>
            </div>
          </div>

          <div className="checklist-drive-actions">
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={syncingCIS ? 'spinner' : 'bolt'}
              loading={syncingCIS}
              disabled={syncingCIS || loadingFiles}
              onClick={handleSyncCIS}
            >
              {syncingCIS ? 'Syncing CIS...' : 'Sync CIS to Drive'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon="refresh"
              loading={loadingFiles}
              disabled={loadingFiles}
              onClick={refreshFilesAndChecklist}
              title="Refresh Google Drive files status"
            >
              {loadingFiles ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>
      )}

      {/* Course Info Fields */}
      <div className="checklist-card">
        <h2 className="checklist-card-title">Course Details</h2>
        <div className="checklist-details-grid">
          <div className="checklist-field">
            <label className="checklist-label">Course Title</label>
            <input
              type="text"
              className="checklist-input"
              value={courseInfo.courseTitle}
              onChange={(e) => handleCourseInfoChange('courseTitle', e.target.value)}
              placeholder="Enter Course Title"
            />
          </div>
          <div className="checklist-field">
            <label className="checklist-label">Course Code</label>
            <input
              type="text"
              className="checklist-input"
              value={courseInfo.courseCode}
              onChange={(e) => handleCourseInfoChange('courseCode', e.target.value)}
              placeholder="Enter Course Code"
            />
          </div>
          <div className="checklist-field">
            <label className="checklist-label">Batch</label>
            <input
              type="text"
              className="checklist-input"
              value={courseInfo.batch}
              onChange={(e) => handleCourseInfoChange('batch', e.target.value)}
              placeholder="e.g., Fall 2024"
            />
          </div>
        </div>
      </div>

      {/* Checklist & Document Synchronization Table */}
      <div className="checklist-table-card">
        <h2 className="checklist-card-title">Document Checklist & Google Drive Synchronization</h2>
        <div className="checklist-table-container">
          <table className="checklist-table">
            <thead>
              <tr>
                <th style={{ width: '55px', textAlign: 'center' }}>S.No</th>
                <th style={{ minWidth: '220px' }}>Document Item</th>
                <th style={{ width: '80px', textAlign: 'center' }} title="Checklist completion status">Check</th>
                <th style={{ width: '150px', textAlign: 'center' }}>Drive Status</th>
                <th style={{ minWidth: '220px' }}>Google Drive Actions</th>
              </tr>
            </thead>
            <tbody>
              {checklist.map((item) => {
                // Separator row
                if (item.type === 'separator') {
                  return (
                    <tr key={item.id} className="checklist-separator-row">
                      <td colSpan={5}>{item.label}</td>
                    </tr>
                  );
                }

                // Group header row (e.g., "Assessment Record")
                if (item.type === 'group-header') {
                  serialNo++;
                  return (
                    <tr key={item.id} className="checklist-group-header-row">
                      <td style={{ textAlign: 'center' }}>{serialNo}</td>
                      <td colSpan={4}>{item.name}</td>
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
                const isMidtermItem = item.formType === 'ASSESS_MID';
                const isFinalItem = item.formType === 'ASSESS_FINAL';

                const midtermUploadedCount = isMidtermItem
                  ? MIDTERM_DOC_TYPES.filter((t) =>
                      courseFiles.some((f) => f.documentType === t && f.status === 'synced')
                    ).length
                  : 0;

                const finalUploadedCount = isFinalItem
                  ? FINAL_DOC_TYPES.filter((t) =>
                      courseFiles.some((f) => f.documentType === t && f.status === 'synced')
                    ).length
                  : 0;

                const isExamItem = isMidtermItem || isFinalItem;
                const examUploadedCount = isMidtermItem ? midtermUploadedCount : finalUploadedCount;
                const isExamPartial = isExamItem && examUploadedCount > 0 && examUploadedCount < 4;

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
                  : isMidtermItem
                  ? midtermUploadedCount === 4
                  : isFinalItem
                  ? finalUploadedCount === 4
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
                  (item.formType === 'ASSESS_PROJECT' && syncingProject) ||
                  (item.formType === 'CCC' && syncingCCC) ||
                  (item.formType === 'CRR' && syncingCRR) ||
                  (item.formType === 'ASSESS_QUIZ' && Boolean(syncingQuizId)) ||
                  (item.formType === 'ASSESS_ASSIGN' && Boolean(syncingAssignmentId));

                return (
                  <React.Fragment key={item.id}>
                  <tr
                    key={item.id}
                    className={`checklist-row ${isSynced ? 'checklist-row--synced' : ''}`}
                  >
                    {/* S.No */}
                    <td
                      style={{
                        textAlign: 'center',
                        color: isSubItem ? 'var(--cfes-slate-500)' : 'var(--cfes-slate-700)',
                        fontWeight: isSubItem ? '400' : '600',
                        fontSize: isSubItem ? 'var(--cfes-font-xs)' : 'var(--cfes-font-sm)',
                      }}
                    >
                      {isSubItem ? '—' : serialNo}
                    </td>

                    {/* Item Name */}
                    <td style={{ paddingLeft: isSubItem ? '2rem' : '0.85rem' }}>
                      <div>
                        <Link
                          to={
                            offeringId
                              ? `/offering/${offeringId}/form/${item.formType}`
                              : `/course/${activeCourseId}/form/${item.formType}`
                          }
                          className="checklist-item-title"
                        >
                          {item.name}
                        </Link>
                        {isExamItem && (
                          <span className="checklist-item-hint">
                            (4 categories: Paper + 3 Student Copies)
                          </span>
                        )}
                      </div>

                      {/* Display synchronized file details if available (non-exam) */}
                      {!isExamItem && hasDriveFile && (
                        <div className="checklist-file-meta">
                          <span className="checklist-file-tag">
                            <Icon name="file" size={12} />
                            <span>{primaryFile.filename || 'Document'}</span>
                          </span>
                          {primaryFile.sizeBytes ? (
                            <span>• {(primaryFile.sizeBytes / 1024).toFixed(1)} KB</span>
                          ) : null}
                          {primaryFile.version > 1 ? (
                            <span style={{ color: 'var(--cfes-status-success-text)', fontWeight: '600' }}>
                              v{primaryFile.version}
                            </span>
                          ) : null}
                        </div>
                      )}

                      {/* Display uploaded exam categories list */}
                      {isExamItem && examUploadedCount > 0 && (
                        <div className="checklist-file-meta">
                          {(isMidtermItem ? MIDTERM_DOC_TYPES : FINAL_DOC_TYPES).map((docType) => {
                            const f = courseFiles.find(
                              (file) => file.documentType === docType && file.status === 'synced'
                            );
                            if (!f) return null;
                            const slotLabel = docType
                              .replace(/^(MIDTERM_|FINAL_)/, '')
                              .replace(/_/g, ' ');
                            return (
                              <span key={docType} className="checklist-file-tag">
                                <Icon name="check" size={11} style={{ color: 'var(--cfes-status-success-text)' }} />
                                <span>{slotLabel}:</span>
                                {f.googleDriveWebViewLink ? (
                                  <a
                                    href={f.googleDriveWebViewLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {f.filename} <Icon name="external" size={10} />
                                  </a>
                                ) : (
                                  <span>{f.filename}</span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Display multiple assessment or lecture instances if present */}
                      {!isExamItem && matchingFiles.length > 1 && (
                        <div className="checklist-file-meta">
                          <span style={{ color: 'var(--cfes-slate-500)' }}>Files ({matchingFiles.length}): </span>
                          {matchingFiles.map((f, idx) => (
                            <span key={f._id || idx} className="checklist-file-tag">
                              {f.googleDriveWebViewLink ? (
                                <a
                                  href={f.googleDriveWebViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {f.filename || f.instanceName || `File ${idx + 1}`} <Icon name="external" size={10} />
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
                        <div className="checklist-row-error">
                          <Icon name="alert" size={12} />
                          <span>{rowErrorMessage}</span>
                        </div>
                      )}
                    </td>

                    {/* Manual Checklist Checkbox */}
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleToggle(item.id)}
                        className="checklist-checkbox"
                        title={`Mark ${item.name} as complete/incomplete`}
                      />
                    </td>

                    {/* Google Drive Status Badge */}
                    <td style={{ textAlign: 'center' }}>
                      {isSynced ? (
                        <StatusBadge
                          variant="success"
                          icon="check"
                          label={
                            isQuizItem && quizCount > 1
                              ? `PDF Synced (${assessmentSyncedCount}/${quizCount})`
                              : isAssignItem && assignCount > 1
                              ? `PDF Synced (${assessmentSyncedCount}/${assignCount})`
                              : isQuizItem && quizCount === 1
                              ? `PDF Synced${singleQuizFile?.version > 1 ? ` v${singleQuizFile.version}` : ''}`
                              : isAssignItem && assignCount === 1
                              ? `PDF Synced${singleAssignFile?.version > 1 ? ` v${singleAssignFile.version}` : ''}`
                              : (isQuizItem || isAssignItem)
                              ? `PDF Synced${primaryPdfFile?.version > 1 ? ` v${primaryPdfFile.version}` : ''}`
                              : isMidtermItem
                              ? 'Completed (4/4)'
                              : isFinalItem
                              ? 'Completed (4/4)'
                              : item.formType === 'LECTURES' && matchingFiles.length > 0
                              ? `Synced (${matchingFiles.length} file${matchingFiles.length > 1 ? 's' : ''})`
                              : primaryFile?.version > 1
                              ? `Synced v${primaryFile.version}`
                              : 'Synced'
                          }
                        />
                      ) : hasRowError ? (
                        <StatusBadge
                          variant="danger"
                          icon="close"
                          label={rowErrors[item.formType] ? 'Sync failed' : 'Upload failed'}
                          title={rowErrorMessage}
                        />
                      ) : isExamPartial ? (
                        <StatusBadge
                          variant="info"
                          label={`In Progress (${examUploadedCount}/4)`}
                        />
                      ) : (
                        <StatusBadge
                          variant="neutral"
                          label={
                            isExamItem
                              ? 'Not Started (0/4)'
                              : isQuizItem && quizCount === 0
                              ? 'Not created'
                              : isAssignItem && assignCount === 0
                              ? 'Not created'
                              : isQuizItem || isAssignItem || item.formType === 'ASSESS_PROJECT' || item.formType === 'CCC' || item.formType === 'CRR'
                              ? 'PDF Not Synced'
                              : 'Not uploaded'
                          }
                        />
                      )}
                    </td>

                    {/* Google Drive Actions */}
                    <td>
                      <div className="checklist-actions-cell">
                        {/* CIS Sync Action */}
                        {item.formType === 'CIS' && (
                          <Button
                            type="button"
                            variant={isSynced ? 'subtle' : 'primary'}
                            size="sm"
                            icon={isItemSyncing ? 'spinner' : 'bolt'}
                            loading={isItemSyncing}
                            disabled={isItemSyncing || !offeringId}
                            onClick={handleSyncCIS}
                            title="Generate and synchronize CIS document to Google Drive"
                          >
                            {isItemSyncing ? 'Syncing...' : isSynced ? 'Re-sync CIS' : 'Sync to Drive'}
                          </Button>
                        )}

                        {/* CCR Sync Action */}
                        {item.formType === 'CCR' && (
                          <Button
                            type="button"
                            variant={isSynced ? 'subtle' : 'primary'}
                            size="sm"
                            icon={isItemSyncing ? 'spinner' : 'bolt'}
                            loading={isItemSyncing}
                            disabled={isItemSyncing || !offeringId}
                            onClick={handleSyncCCR}
                            title="Generate and synchronize CCR document to Google Drive"
                          >
                            {isItemSyncing ? 'Syncing...' : isSynced ? 'Re-sync CCR' : 'Sync to Drive'}
                          </Button>
                        )}

                        {/* Timetable Sync Action */}
                        {item.formType === 'TIMETABLE' && (
                          <Button
                            type="button"
                            variant={isSynced ? 'subtle' : 'primary'}
                            size="sm"
                            icon={isItemSyncing ? 'spinner' : 'bolt'}
                            loading={isItemSyncing}
                            disabled={isItemSyncing || !offeringId}
                            onClick={handleSyncTimetable}
                            title="Generate and synchronize Timetable document to Google Drive"
                          >
                            {isItemSyncing ? 'Syncing...' : isSynced ? 'Re-sync Timetable' : 'Sync to Drive'}
                          </Button>
                        )}

                        {/* Lectures Action: Manage Lectures */}
                        {item.formType === 'LECTURES' && (
                          <Link
                            to={
                              offeringId
                                ? `/offering/${offeringId}/form/LECTURES`
                                : `/course/${activeCourseId}/form/LECTURES`
                            }
                            className="cfes-btn cfes-btn--secondary cfes-btn--sm"
                            title="Open Lectures File Manager to upload and manage lecture files"
                          >
                            <Icon name="folder" size={14} />
                            <span>Manage Lectures{matchingFiles.length > 0 ? ` (${matchingFiles.length})` : ''}</span>
                          </Link>
                        )}

                        {/* Midterm Exam Action */}
                        {isMidtermItem && (
                          <Button
                            type="button"
                            variant={expandedExams.MIDTERM ? 'primary' : isSynced ? 'subtle' : 'secondary'}
                            size="sm"
                            icon="folder"
                            onClick={() => toggleExpandExam('MIDTERM')}
                            title="Expand or collapse Midterm Exam document uploads"
                          >
                            <span>Manage Documents ({midtermUploadedCount}/4)</span>
                            <Icon name={expandedExams.MIDTERM ? 'chevron-up' : 'chevron-down'} size={12} />
                          </Button>
                        )}

                        {/* Final Exam Action */}
                        {isFinalItem && (
                          <Button
                            type="button"
                            variant={expandedExams.FINAL ? 'primary' : isSynced ? 'subtle' : 'secondary'}
                            size="sm"
                            icon="folder"
                            onClick={() => toggleExpandExam('FINAL')}
                            title="Expand or collapse Final Exam document uploads"
                          >
                            <span>Manage Documents ({finalUploadedCount}/4)</span>
                            <Icon name={expandedExams.FINAL ? 'chevron-up' : 'chevron-down'} size={12} />
                          </Button>
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
                                className="cfes-btn cfes-btn--ghost cfes-btn--sm"
                                style={{ borderStyle: 'dashed' }}
                                title="No quizzes created for this offering. Click to create a quiz."
                              >
                                <Icon name="document" size={13} />
                                <span>+ Create Quiz</span>
                              </Link>
                            ) : quizCount === 1 ? (
                              <Button
                                type="button"
                                variant={isSingleQuizSynced ? 'subtle' : 'primary'}
                                size="sm"
                                icon={isItemSyncing ? 'spinner' : 'bolt'}
                                loading={isItemSyncing}
                                disabled={isItemSyncing || !offeringId}
                                onClick={() => handleSyncQuiz(singleQuiz._id)}
                                title={
                                  isSingleQuizSynced
                                    ? 'Re-synchronize quiz PDF to Google Drive'
                                    : 'Generate and synchronize quiz PDF to Google Drive'
                                }
                              >
                                {isItemSyncing ? 'Syncing...' : isSingleQuizSynced ? 'Re-sync PDF' : 'Sync PDF'}
                              </Button>
                            ) : (
                              <Link
                                to={
                                  offeringId
                                    ? `/offering/${offeringId}/form/ASSESS_QUIZ`
                                    : `/course/${activeCourseId}/form/ASSESS_QUIZ`
                                }
                                className="cfes-btn cfes-btn--secondary cfes-btn--sm"
                                title="Open Quiz Management to view and synchronize individual quiz PDFs"
                              >
                                <Icon name="folder" size={14} />
                                <span>Manage & Sync Quizzes ({quizCount})</span>
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
                                className="cfes-btn cfes-btn--ghost cfes-btn--sm"
                                style={{ borderStyle: 'dashed' }}
                                title="No assignments created for this offering. Click to create an assignment."
                              >
                                <Icon name="document" size={13} />
                                <span>+ Create Assignment</span>
                              </Link>
                            ) : assignCount === 1 ? (
                              <Button
                                type="button"
                                variant={isSingleAssignSynced ? 'subtle' : 'primary'}
                                size="sm"
                                icon={isItemSyncing ? 'spinner' : 'bolt'}
                                loading={isItemSyncing}
                                disabled={isItemSyncing || !offeringId}
                                onClick={() => handleSyncAssignment(singleAssign._id)}
                                title={
                                  isSingleAssignSynced
                                    ? 'Re-synchronize assignment PDF to Google Drive'
                                    : 'Generate and synchronize assignment PDF to Google Drive'
                                }
                              >
                                {isItemSyncing ? 'Syncing...' : isSingleAssignSynced ? 'Re-sync PDF' : 'Sync PDF'}
                              </Button>
                            ) : (
                              <Link
                                to={
                                  offeringId
                                    ? `/offering/${offeringId}/form/ASSESS_ASSIGN`
                                    : `/course/${activeCourseId}/form/ASSESS_ASSIGN`
                                }
                                className="cfes-btn cfes-btn--secondary cfes-btn--sm"
                                title="Open Assignment Management to view and synchronize individual assignment PDFs"
                              >
                                <Icon name="folder" size={14} />
                                <span>Manage & Sync Assignments ({assignCount})</span>
                              </Link>
                            )}
                          </>
                        )}

                        {/* CCP / Class Project Sync Action */}
                        {item.formType === 'ASSESS_PROJECT' && (
                          <Button
                            type="button"
                            variant={isSynced ? 'subtle' : 'primary'}
                            size="sm"
                            icon={isItemSyncing ? 'spinner' : 'bolt'}
                            loading={isItemSyncing}
                            disabled={isItemSyncing || !offeringId}
                            onClick={handleSyncProject}
                            title="Generate and synchronize CCP / Class Project document to Google Drive"
                          >
                            {isItemSyncing ? 'Syncing...' : isSynced ? 'Re-sync Project' : 'Sync to Drive'}
                          </Button>
                        )}

                        {/* CCC Sync Action */}
                        {item.formType === 'CCC' && (
                          <Button
                            type="button"
                            variant={isSynced ? 'subtle' : 'primary'}
                            size="sm"
                            icon={isItemSyncing ? 'spinner' : 'bolt'}
                            loading={isItemSyncing}
                            disabled={isItemSyncing || !offeringId}
                            onClick={handleSyncCCC}
                            title="Generate and synchronize Course Completion Certificate to Google Drive"
                          >
                            {isItemSyncing ? 'Syncing...' : isSynced ? 'Re-sync CCC' : 'Sync to Drive'}
                          </Button>
                        )}

                        {/* CRR Sync Action */}
                        {item.formType === 'CRR' && (
                          <Button
                            type="button"
                            variant={isSynced ? 'subtle' : 'primary'}
                            size="sm"
                            icon={isItemSyncing ? 'spinner' : 'bolt'}
                            loading={isItemSyncing}
                            disabled={isItemSyncing || !offeringId}
                            onClick={handleSyncCRR}
                            title="Generate and synchronize Course Review Report to Google Drive"
                          >
                            {isItemSyncing ? 'Syncing...' : isSynced ? 'Re-sync CRR' : 'Sync to Drive'}
                          </Button>
                        )}

                        {/* View in Google Drive Button */}
                        {(() => {
                          const viewFile =
                            isQuizItem
                              ? singleQuizFile || matchingFiles.find((f) => f.fileFormat === 'pdf' && f.googleDriveWebViewLink)
                              : isAssignItem
                              ? singleAssignFile || matchingFiles.find((f) => f.fileFormat === 'pdf' && f.googleDriveWebViewLink)
                              : isMidtermItem
                              ? courseFiles.find((f) => MIDTERM_DOC_TYPES.includes(f.documentType) && f.googleDriveWebViewLink)
                              : isFinalItem
                              ? courseFiles.find((f) => FINAL_DOC_TYPES.includes(f.documentType) && f.googleDriveWebViewLink)
                              : primaryFile;
                          if (!viewFile?.googleDriveWebViewLink) return null;
                          return (
                            <a
                              href={viewFile.googleDriveWebViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cfes-btn cfes-btn--subtle cfes-btn--sm"
                              style={{ color: 'var(--cfes-status-success-text)', borderColor: 'var(--cfes-status-success-border)' }}
                              title={isQuizItem || isAssignItem ? 'Open PDF in Google Drive' : 'Open document in Google Drive'}
                            >
                              <span>{isQuizItem || isAssignItem ? 'View PDF in Drive' : 'View in Drive'}</span>
                              <Icon name="external" size={11} />
                            </a>
                          );
                        })()}

                        {/* Upload File Action (for standard non-exam items) */}
                        {item.formType !== 'LECTURES' && !isExamItem && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon="upload"
                            onClick={() => openUploadModal(item)}
                            disabled={isItemUploading || !offeringId}
                            title={`Upload ${item.name} to Google Drive`}
                          >
                            {isSynced ? 'Update File' : 'Upload File'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expandable Midterm Exam Card */}
                  {isMidtermItem && expandedExams.MIDTERM && (
                    <tr key={`${item.id}-expanded-midterm`}>
                      <td
                        colSpan={5}
                        style={{
                          padding: '0.5rem 1rem 1.25rem',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <ExamUploadSection
                          examType="MIDTERM"
                          offeringId={offeringId}
                          courseFiles={courseFiles}
                          onUploadSuccess={refreshFilesAndChecklist}
                          isCard={true}
                        />
                      </td>
                    </tr>
                  )}

                  {/* Expandable Final Exam Card */}
                  {isFinalItem && expandedExams.FINAL && (
                    <tr key={`${item.id}-expanded-final`}>
                      <td
                        colSpan={5}
                        style={{
                          padding: '0.5rem 1rem 1.25rem',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <ExamUploadSection
                          examType="FINAL"
                          offeringId={offeringId}
                          courseFiles={courseFiles}
                          onUploadSuccess={refreshFilesAndChecklist}
                          isCard={true}
                        />
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Save Checklist Button */}
        <div style={{ marginTop: 'var(--cfes-space-5)', display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={loading}
            disabled={loading}
            onClick={handleSave}
          >
            {loading ? 'Saving...' : 'Save Checklist'}
          </Button>
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
            padding: 'var(--cfes-space-4)',
          }}
          onClick={closeUploadModal}
        >
          <div
            style={{
              backgroundColor: 'var(--cfes-white)',
              borderRadius: 'var(--cfes-radius-xl)',
              maxWidth: '500px',
              width: '100%',
              padding: 'var(--cfes-space-6)',
              boxShadow: 'var(--cfes-shadow-xl)',
              border: '1px solid var(--cfes-slate-200)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--cfes-space-4)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--cfes-font-lg)', color: 'var(--cfes-slate-900)', fontWeight: '700' }}>
                  Upload to Google Drive
                </h3>
                <p style={{ margin: 'var(--cfes-space-1) 0 0', fontSize: 'var(--cfes-font-sm)', color: 'var(--cfes-slate-500)' }}>
                  {uploadModal.item.name}
                </p>
              </div>
              <button
                type="button"
                onClick={closeUploadModal}
                disabled={uploadModal.isSubmitting}
                className="cfes-modal__close-btn"
                aria-label="Close modal"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit}>
              {/* File input */}
              <div style={{ marginBottom: 'var(--cfes-space-4)' }}>
                <label style={{ display: 'block', fontSize: 'var(--cfes-font-sm)', fontWeight: '600', color: 'var(--cfes-slate-700)', marginBottom: 'var(--cfes-space-1)' }}>
                  Select File <span style={{ color: 'var(--cfes-status-danger-text)' }}>*</span>
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
                    fontSize: 'var(--cfes-font-sm)',
                    color: 'var(--cfes-slate-700)',
                    backgroundColor: 'var(--cfes-slate-50)',
                    border: '1px dashed var(--cfes-slate-300)',
                    borderRadius: 'var(--cfes-radius-md)',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ display: 'block', fontSize: 'var(--cfes-font-xs)', color: 'var(--cfes-slate-500)', marginTop: 'var(--cfes-space-1)' }}>
                  Supported formats: PDF, Word, Excel, PowerPoint, Images, ZIP (max 25 MB).
                </span>
              </div>

              {/* Optional instance name for repeated assessment documents */}
              <div style={{ marginBottom: 'var(--cfes-space-4)' }}>
                <label style={{ display: 'block', fontSize: 'var(--cfes-font-sm)', fontWeight: '600', color: 'var(--cfes-slate-700)', marginBottom: 'var(--cfes-space-1)' }}>
                  Instance Name / Label <span style={{ color: 'var(--cfes-slate-400)', fontWeight: 'normal' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  className="checklist-input"
                  value={uploadModal.instanceName}
                  onChange={(e) => setUploadModal((prev) => ({ ...prev, instanceName: e.target.value }))}
                  placeholder="e.g., Quiz 1, Assignment 2, Midterm Solution"
                  disabled={uploadModal.isSubmitting}
                />
              </div>

              {/* Error display */}
              {uploadModal.error && (
                <div
                  style={{
                    marginBottom: 'var(--cfes-space-4)',
                    padding: 'var(--cfes-space-3)',
                    backgroundColor: 'var(--cfes-status-danger-bg)',
                    border: '1px solid var(--cfes-status-danger-border)',
                    borderRadius: 'var(--cfes-radius-md)',
                    color: 'var(--cfes-status-danger-text)',
                    fontSize: 'var(--cfes-font-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--cfes-space-2)',
                  }}
                >
                  <Icon name="alert" size={16} />
                  <span>{uploadModal.error}</span>
                </div>
              )}

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--cfes-space-3)' }}>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={closeUploadModal}
                  disabled={uploadModal.isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  icon={uploadModal.isSubmitting ? 'spinner' : 'upload'}
                  loading={uploadModal.isSubmitting}
                  disabled={uploadModal.isSubmitting || !uploadModal.file}
                >
                  {uploadModal.isSubmitting ? 'Uploading to Drive...' : 'Upload to Drive'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseFileChecklist;
