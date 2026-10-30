import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import useToast from '../../../hooks/useToast';
import CreateQuizForm from './CreateQuizForm';
import { syncQuizDocument, getOfferingFiles } from '../../../services/courseFile.service';

const QuizManagementPage = ({ courseId, offeringId }) => {
  const toast = useToast();
  const [view, setView] = useState('list'); // 'list' | 'create' | 'edit'
  const [editQuizId, setEditQuizId] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState('');
  const [courseFiles, setCourseFiles] = useState([]);
  const [syncingQuizId, setSyncingQuizId] = useState(null);

  /* ── Fetch quizzes for this course / offering ───────────── */
  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      let res;
      if (offeringId) {
        res = await api.get(`/quizzes/offering/${offeringId}`);
      } else if (courseId && courseId !== 'undefined') {
        res = await api.get(`/quizzes/course/${courseId}`);
      } else {
        return;
      }
      if (res.data?.data?.quizzes) {
        setQuizzes(res.data.data.quizzes);
      }
    } catch (err) {
      console.error('Failed to fetch quizzes:', err);
      toast.error('Failed to load quizzes.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Fetch synchronized course files for offering ──────── */
  const fetchCourseFiles = async () => {
    if (!offeringId) return;
    try {
      const files = await getOfferingFiles(offeringId, 'ASSESS_QUIZ');
      setCourseFiles(files || []);
    } catch (err) {
      console.warn('Could not load course files for quizzes:', err);
    }
  };

  useEffect(() => {
    if (offeringId || (courseId && courseId !== 'undefined')) {
      fetchQuizzes();
    }
    if (offeringId) {
      fetchCourseFiles();
    }
  }, [courseId, offeringId]);


  /* ── Delete quiz ───────────────────────────────────────── */
  const handleDelete = async (quizId) => {
    if (!window.confirm('Are you sure you want to delete this quiz? This cannot be undone.')) return;
    try {
      await api.delete(`/quizzes/${quizId}`);
      toast.success('Quiz deleted successfully.');
      setQuizzes(prev => prev.filter(q => q._id !== quizId));
      setCourseFiles(prev => prev.filter(f => f.instanceName !== quizId.toString()));
    } catch (err) {
      console.error('Failed to delete quiz:', err);
      toast.error(err.response?.data?.message || 'Failed to delete quiz.');
    }
  };

  /* ── Synchronize Quiz to Google Drive ──────────────────── */
  const handleSyncToDrive = async (quizId) => {
    if (!offeringId) {
      toast.error('Google Drive synchronization requires an offering-scoped view.');
      return;
    }
    try {
      setSyncingQuizId(quizId);
      const res = await syncQuizDocument(offeringId, quizId);
      toast.success(res.message || 'Quiz document synchronized to Google Drive successfully!');
      if (res.data) {
        setCourseFiles((prev) => {
          const filtered = prev.filter(
            (f) => f.instanceName !== quizId.toString()
          );
          return [...filtered, res.data];
        });
      }
    } catch (err) {
      console.error('Failed to sync quiz to Google Drive:', err);
      toast.error(
        err.response?.data?.message || err.message || 'Failed to synchronize quiz with Google Drive.'
      );
    } finally {
      setSyncingQuizId(null);
    }
  };

  /* ── Navigate back from form ───────────────────────────── */
  const handleBack = () => {
    setView('list');
    setEditQuizId(null);
    fetchQuizzes(); // Refresh list after create/edit
    if (offeringId) {
      fetchCourseFiles();
    }
  };

  /* ── Edit quiz ─────────────────────────────────────────── */
  const handleEdit = (quizId) => {
    setEditQuizId(quizId);
    setView('edit');
  };

  /* ── Download Word ─────────────────────────────────────── */
  const handleDownload = async (quiz) => {
    try {
      setIsExporting(quiz._id);
      const { data } = await api.get(`/quizzes/${quiz._id}/export`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      
      const safeCourse = (quiz.courseInfo?.courseTitle || 'Course').replace(/[^a-z0-9]/gi, '_');
      const safeQuizNum = (quiz.quizInfo?.quizNumber || 'Quiz').replace(/[^a-z0-9]/gi, '_');
      link.setAttribute('download', `${safeCourse}_${safeQuizNum}.docx`);
      
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Quiz downloaded successfully!');
    } catch (err) {
      console.error('Failed to export quiz:', err);
      toast.error('Failed to export quiz document.');
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
      <div className="quiz-management" style={containerStyle}>
        <h2 style={headerStyle}>Quiz Management</h2>

        <div style={sectionHeaderStyle}>
          <h3 style={titleStyle}>Existing Quizzes</h3>
          <button type="button" style={createBtnStyle} onClick={() => setView('create')}>
            <span>+</span> Create New Quiz
          </button>
        </div>

        {loading && <div style={{ textAlign: 'center', marginBottom: '1rem', fontStyle: 'italic', color: '#64748b' }}>Loading quizzes...</div>}

        <div style={{ marginTop: '2rem' }}>
          {!loading && quizzes.length === 0 ? (
            <div style={emptyStateStyle}>
              No quizzes created yet
            </div>
          ) : (
            quizzes.map((quiz) => {
              const quizFile = courseFiles.find(
                (cf) =>
                  (cf.instanceName === quiz._id?.toString() || cf.instanceName === quiz._id) &&
                  cf.fileFormat === 'pdf'
              );
              const isSynced = quizFile?.status === 'synced';

              return (
                <div key={quiz._id} style={cardStyle}>
                  <div style={cardInfoStyle}>
                    <div>
                      <div style={labelStyle}>Quiz Number</div>
                      <div style={valueStyle}>{quiz.quizInfo?.quizNumber || '—'}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Date</div>
                      <div style={valueStyle}>{quiz.quizInfo?.date || '—'}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Duration</div>
                      <div style={valueStyle}>{quiz.quizInfo?.duration || '—'}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Max Marks</div>
                      <div style={valueStyle}>{quiz.quizInfo?.maxMarks || '—'}</div>
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
                              ● PDF Synced{quizFile.version > 1 ? ` v${quizFile.version}` : ''}
                            </span>
                            {quizFile.googleDriveWebViewLink && (
                              <a
                                href={quizFile.googleDriveWebViewLink}
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
                    <button type="button" style={editBtnStyle} onClick={() => handleEdit(quiz._id)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      style={generateBtnStyle}
                      onClick={() => handleDownload(quiz)}
                      disabled={isExporting === quiz._id}
                    >
                      {isExporting === quiz._id ? 'Exporting...' : 'Export Word'}
                    </button>
                    <button
                      type="button"
                      style={{
                        ...syncBtnStyle,
                        cursor: syncingQuizId ? 'wait' : (!offeringId ? 'not-allowed' : 'pointer'),
                        opacity: (syncingQuizId || !offeringId) ? 0.7 : 1,
                      }}
                      onClick={() => handleSyncToDrive(quiz._id)}
                      disabled={Boolean(syncingQuizId) || !offeringId}
                      title={
                        !offeringId
                          ? 'Google Drive synchronization requires an offering-scoped view'
                          : isSynced
                          ? 'Update existing PDF in Google Drive'
                          : 'Synchronize PDF to Google Drive'
                      }
                    >
                      {syncingQuizId === quiz._id
                        ? 'Syncing...'
                        : isSynced
                        ? 'Re-sync PDF'
                        : 'Sync PDF'}
                    </button>
                    <button type="button" style={deleteBtnStyle} onClick={() => handleDelete(quiz._id)}>
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
    <CreateQuizForm
      courseId={courseId}
      offeringId={offeringId}
      quizId={editQuizId}
      onBack={handleBack}
    />
  );
};

export default QuizManagementPage;

