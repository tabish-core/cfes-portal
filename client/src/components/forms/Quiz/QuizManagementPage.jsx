import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import useToast from '../../../hooks/useToast';
import CreateQuizForm from './CreateQuizForm';

const QuizManagementPage = ({ courseId }) => {
  const toast = useToast();
  const [view, setView] = useState('list'); // 'list' | 'create' | 'edit'
  const [editQuizId, setEditQuizId] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState('');

  /* ── Fetch quizzes for this course ─────────────────────── */
  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/quizzes/course/${courseId}`);
      if (data.data && data.data.quizzes) {
        setQuizzes(data.data.quizzes);
      }
    } catch (err) {
      console.error('Failed to fetch quizzes:', err);
      toast.error('Failed to load quizzes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) fetchQuizzes();
  }, [courseId]);

  /* ── Delete quiz ───────────────────────────────────────── */
  const handleDelete = async (quizId) => {
    if (!window.confirm('Are you sure you want to delete this quiz? This cannot be undone.')) return;
    try {
      await api.delete(`/quizzes/${quizId}`);
      toast.success('Quiz deleted successfully.');
      setQuizzes(prev => prev.filter(q => q._id !== quizId));
    } catch (err) {
      console.error('Failed to delete quiz:', err);
      toast.error('Failed to delete quiz.');
    }
  };

  /* ── Navigate back from form ───────────────────────────── */
  const handleBack = () => {
    setView('list');
    setEditQuizId(null);
    fetchQuizzes(); // Refresh list after create/edit
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
    maxWidth: '900px',
    margin: '2rem auto',
    padding: '3rem',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e2e8f0'
  };

  const headerStyle = {
    textAlign: 'center',
    marginBottom: '3rem',
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
            quizzes.map((quiz) => (
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
                </div>

                <div style={actionContainerStyle}>
                  <button type="button" style={editBtnStyle} onClick={() => handleEdit(quiz._id)}>Edit</button>
                  <button type="button" style={generateBtnStyle} onClick={() => handleDownload(quiz)} disabled={isExporting === quiz._id}>
                    {isExporting === quiz._id ? 'Exporting...' : 'Export Word'}
                  </button>
                  <button type="button" style={deleteBtnStyle} onClick={() => handleDelete(quiz._id)}>Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  /* ── Create / Edit View ────────────────────────────────── */
  return (
    <CreateQuizForm
      courseId={courseId}
      quizId={editQuizId}
      onBack={handleBack}
    />
  );
};

export default QuizManagementPage;
