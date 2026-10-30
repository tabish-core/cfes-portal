import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import useToast from '../../../hooks/useToast';
import CreateAssignmentForm from './CreateAssignmentForm';
import { syncAssignmentDocument, getOfferingFiles } from '../../../services/courseFile.service';

const AssignmentManagementPage = ({ courseId, offeringId }) => {
  const toast = useToast();
  const [view, setView] = useState('list'); // 'list' | 'create' | 'edit'
  const [editAssignmentId, setEditAssignmentId] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState('');
  const [courseFiles, setCourseFiles] = useState([]);
  const [syncingAssignmentId, setSyncingAssignmentId] = useState(null);

  /* ── Fetch assignments for this course / offering ───────── */
  const fetchAssignments = async () => {
    try {
      setLoading(true);
      let res;
      if (offeringId) {
        res = await api.get(`/assignments/offering/${offeringId}`);
      } else if (courseId && courseId !== 'undefined') {
        res = await api.get(`/assignments/course/${courseId}`);
      } else {
        return;
      }
      if (res.data?.data?.assignments) {
        setAssignments(res.data.data.assignments);
      }
    } catch (err) {
      console.error('Failed to fetch assignments:', err);
      toast.error('Failed to load assignments.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Fetch synchronized course files for offering ──────── */
  const fetchCourseFiles = async () => {
    if (!offeringId) return;
    try {
      const files = await getOfferingFiles(offeringId, 'ASSESS_ASSIGN');
      setCourseFiles(files || []);
    } catch (err) {
      console.warn('Could not load course files for assignments:', err);
    }
  };

  useEffect(() => {
    if (offeringId || (courseId && courseId !== 'undefined')) {
      fetchAssignments();
    }
    if (offeringId) {
      fetchCourseFiles();
    }
  }, [courseId, offeringId]);


  /* ── Delete assignment ─────────────────────────────────── */
  const handleDelete = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to delete this assignment? This cannot be undone.')) return;
    try {
      await api.delete(`/assignments/${assignmentId}`);
      toast.success('Assignment deleted successfully.');
      setAssignments(prev => prev.filter(a => a._id !== assignmentId));
      setCourseFiles(prev => prev.filter(f => f.instanceName !== assignmentId.toString()));
    } catch (err) {
      console.error('Failed to delete assignment:', err);
      toast.error(err.response?.data?.message || 'Failed to delete assignment.');
    }
  };

  /* ── Synchronize Assignment to Google Drive ────────────── */
  const handleSyncToDrive = async (assignmentId) => {
    if (!offeringId) {
      toast.error('Google Drive synchronization requires an offering-scoped view.');
      return;
    }
    try {
      setSyncingAssignmentId(assignmentId);
      const res = await syncAssignmentDocument(offeringId, assignmentId);
      toast.success(res.message || 'Assignment document synchronized to Google Drive successfully!');
      if (res.data) {
        setCourseFiles((prev) => {
          const filtered = prev.filter(
            (f) => f.instanceName !== assignmentId.toString()
          );
          return [...filtered, res.data];
        });
      }
    } catch (err) {
      console.error('Failed to sync assignment to Google Drive:', err);
      toast.error(
        err.response?.data?.message || err.message || 'Failed to synchronize assignment with Google Drive.'
      );
    } finally {
      setSyncingAssignmentId(null);
    }
  };

  /* ── Navigate back from form ───────────────────────────── */
  const handleBack = () => {
    setView('list');
    setEditAssignmentId(null);
    fetchAssignments(); // Refresh list after create/edit
    if (offeringId) {
      fetchCourseFiles();
    }
  };

  /* ── Edit assignment ───────────────────────────────────── */
  const handleEdit = (assignmentId) => {
    setEditAssignmentId(assignmentId);
    setView('edit');
  };

  /* ── Download Word ─────────────────────────────────────── */
  const handleDownload = async (assignment) => {
    try {
      setIsExporting(assignment._id);
      const { data } = await api.get(`/assignments/${assignment._id}/export`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      
      const safeCourse = (assignment.courseInfo?.courseTitle || 'Course').replace(/[^a-z0-9]/gi, '_');
      const safeAssignNum = (assignment.assignmentInfo?.assignmentNumber || 'Assignment').replace(/[^a-z0-9]/gi, '_');
      link.setAttribute('download', `${safeCourse}_${safeAssignNum}.docx`);
      
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Assignment downloaded successfully!');
    } catch (err) {
      console.error('Failed to export assignment:', err);
      toast.error('Failed to export assignment document.');
    } finally {
      setIsExporting('');
    }
  };

  // ── Styles ──────────────────────────────────────────────
  const containerStyle = {
    width: '100%',
    boxSizing: 'border-box'
  };

  const headerStyle = {
    textAlign: 'center',
    marginBottom: '2rem',
    marginTop: 0,
    color: '#0f172a',
    fontSize: '1.8rem',
    fontWeight: '700',
    letterSpacing: '-0.025em'
  };

  const sectionHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    borderBottom: '2px solid #e2e8f0',
    paddingBottom: '0.75rem'
  };

  const titleStyle = {
    color: '#1e293b',
    fontSize: '1.2rem',
    fontWeight: '600',
    margin: 0
  };

  const createBtnStyle = {
    padding: '0.6rem 1.2rem',
    backgroundColor: '#3949ab',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  };

  const cardStyle = {
    backgroundColor: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const cardInfoStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '2rem',
    flex: 1
  };

  const labelStyle = {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.25rem'
  };

  const valueStyle = {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#1e293b'
  };

  const actionContainerStyle = {
    display: 'flex',
    gap: '0.5rem',
    marginLeft: '2rem'
  };

  const btnBaseStyle = {
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '1px solid transparent'
  };

  const editBtnStyle = {
    ...btnBaseStyle,
    backgroundColor: '#ffffff',
    color: '#3949ab',
    borderColor: '#cbd5e1'
  };

  const generateBtnStyle = {
    ...btnBaseStyle,
    backgroundColor: '#f0fdf4',
    color: '#166534',
    borderColor: '#bbf7d0'
  };

  const deleteBtnStyle = {
    ...btnBaseStyle,
    backgroundColor: '#ffffff',
    color: '#dc2626',
    borderColor: '#cbd5e1'
  };

  const syncBtnStyle = {
    ...btnBaseStyle,
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    borderColor: '#bfdbfe',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem'
  };

  const emptyStateStyle = {
    textAlign: 'center',
    padding: '3rem 1rem',
    color: '#64748b',
    fontSize: '1rem',
    fontStyle: 'italic',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px dashed #cbd5e1'
  };

  /* ── List View ─────────────────────────────────────────── */
  if (view === 'list') {
    return (
      <div className="assignment-management" style={containerStyle}>
        <h2 style={headerStyle}>Assignment Management</h2>

        <div style={sectionHeaderStyle}>
          <h3 style={titleStyle}>Existing Assignments</h3>
          <button type="button" style={createBtnStyle} onClick={() => setView('create')}>
            <span>+</span> Create New Assignment
          </button>
        </div>

        {loading && <div style={{ textAlign: 'center', marginBottom: '1rem', fontStyle: 'italic', color: '#64748b' }}>Loading assignments...</div>}

        <div style={{ marginTop: '2rem' }}>
          {!loading && assignments.length === 0 ? (
            <div style={emptyStateStyle}>
              No assignments created yet
            </div>
          ) : (
            assignments.map((assignment) => {
              const assignFile = courseFiles.find(
                (cf) =>
                  (cf.instanceName === assignment._id?.toString() || cf.instanceName === assignment._id) &&
                  cf.fileFormat === 'pdf'
              );
              const isSynced = assignFile?.status === 'synced';

              return (
                <div key={assignment._id} style={cardStyle}>
                  <div style={cardInfoStyle}>
                    <div>
                      <div style={labelStyle}>Assignment Number</div>
                      <div style={valueStyle}>{assignment.assignmentInfo?.assignmentNumber || '—'}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Announcement Date</div>
                      <div style={valueStyle}>{assignment.assignmentInfo?.announcementDate || '—'}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Due Date</div>
                      <div style={valueStyle}>{assignment.assignmentInfo?.dueDate || '—'}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Max Marks</div>
                      <div style={valueStyle}>{assignment.assignmentInfo?.maxMarks || '—'}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Google Drive PDF</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                        {isSynced ? (
                          <>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                backgroundColor: '#ecfdf5',
                                color: '#047857',
                                border: '1px solid #a7f3d0',
                              }}
                            >
                              ● PDF Synced{assignFile.version > 1 ? ` v${assignFile.version}` : ''}
                            </span>
                            {assignFile.googleDriveWebViewLink && (
                              <a
                                href={assignFile.googleDriveWebViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: '0.75rem',
                                  color: '#2563eb',
                                  textDecoration: 'none',
                                  fontWeight: '600',
                                }}
                                onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                                onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
                                title="Open PDF in Google Drive"
                              >
                                View PDF in Drive ↗
                              </a>
                            )}
                          </>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              backgroundColor: '#f1f5f9',
                              color: '#64748b',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            PDF Not Synced
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ ...actionContainerStyle, flexWrap: 'wrap' }}>
                    <button type="button" style={editBtnStyle} onClick={() => handleEdit(assignment._id)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      style={generateBtnStyle}
                      onClick={() => handleDownload(assignment)}
                      disabled={isExporting === assignment._id}
                    >
                      {isExporting === assignment._id ? 'Exporting...' : 'Export Word'}
                    </button>
                    <button
                      type="button"
                      style={{
                        ...syncBtnStyle,
                        cursor: syncingAssignmentId ? 'wait' : (!offeringId ? 'not-allowed' : 'pointer'),
                        opacity: (syncingAssignmentId || !offeringId) ? 0.7 : 1,
                      }}
                      onClick={() => handleSyncToDrive(assignment._id)}
                      disabled={Boolean(syncingAssignmentId) || !offeringId}
                      title={
                        !offeringId
                          ? 'Google Drive synchronization requires an offering-scoped view'
                          : isSynced
                          ? 'Update existing PDF in Google Drive'
                          : 'Synchronize PDF to Google Drive'
                      }
                    >
                      {syncingAssignmentId === assignment._id
                        ? 'Syncing...'
                        : isSynced
                        ? 'Re-sync PDF'
                        : 'Sync PDF'}
                    </button>
                    <button type="button" style={deleteBtnStyle} onClick={() => handleDelete(assignment._id)}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  /* ── Create / Edit View ────────────────────────────────── */
  return (
    <CreateAssignmentForm
      courseId={courseId}
      offeringId={offeringId}
      assignmentId={editAssignmentId}
      onBack={handleBack}
    />
  );
};

export default AssignmentManagementPage;

