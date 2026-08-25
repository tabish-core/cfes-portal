import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import useToast from '../../../hooks/useToast';
import CreateAssignmentForm from './CreateAssignmentForm';

const AssignmentManagementPage = ({ courseId }) => {
  const toast = useToast();
  const [view, setView] = useState('list'); // 'list' | 'create' | 'edit'
  const [editAssignmentId, setEditAssignmentId] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState('');

  /* ── Fetch assignments for this course ─────────────────── */
  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/assignments/course/${courseId}`);
      if (data.data && data.data.assignments) {
        setAssignments(data.data.assignments);
      }
    } catch (err) {
      console.error('Failed to fetch assignments:', err);
      toast.error('Failed to load assignments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) fetchAssignments();
  }, [courseId]);

  /* ── Delete assignment ─────────────────────────────────── */
  const handleDelete = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to delete this assignment? This cannot be undone.')) return;
    try {
      await api.delete(`/assignments/${assignmentId}`);
      toast.success('Assignment deleted successfully.');
      setAssignments(prev => prev.filter(a => a._id !== assignmentId));
    } catch (err) {
      console.error('Failed to delete assignment:', err);
      toast.error('Failed to delete assignment.');
    }
  };

  /* ── Navigate back from form ───────────────────────────── */
  const handleBack = () => {
    setView('list');
    setEditAssignmentId(null);
    fetchAssignments(); // Refresh list after create/edit
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
            assignments.map((assignment) => (
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
                </div>

                <div style={actionContainerStyle}>
                  <button type="button" style={editBtnStyle} onClick={() => handleEdit(assignment._id)}>Edit</button>
                  <button type="button" style={generateBtnStyle} onClick={() => handleDownload(assignment)} disabled={isExporting === assignment._id}>
                    {isExporting === assignment._id ? 'Exporting...' : 'Export Word'}
                  </button>
                  <button type="button" style={deleteBtnStyle} onClick={() => handleDelete(assignment._id)}>Delete</button>
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
    <CreateAssignmentForm
      courseId={courseId}
      assignmentId={editAssignmentId}
      onBack={handleBack}
    />
  );
};

export default AssignmentManagementPage;
