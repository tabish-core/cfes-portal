import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import useToast from '../../../hooks/useToast';

const CreateAssignmentForm = ({ courseId, assignmentId, onBack }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const isEditMode = !!assignmentId;

  const [assignmentInfo, setAssignmentInfo] = useState({
    assignmentNumber: '',
    announcementDate: '',
    dueDate: '',
    maxMarks: ''
  });

  const [courseInfo, setCourseInfo] = useState({
    department: '',
    program: '',
    courseTitle: ''
  });

  const [cloMappings, setCloMappings] = useState([
    { id: Date.now(), mappedCLO: '', mappedGA: '', mappedLearningLevel: '', sdg: '' }
  ]);

  const [assignmentContent, setAssignmentContent] = useState({
    assignmentTitle: '',
    objective: '',
    assignmentDescription: ''
  });

  const [tasks, setTasks] = useState([{ id: Date.now(), text: '' }]);
  const [guidelines, setGuidelines] = useState([{ id: Date.now(), text: '' }]);
  const [criteria, setCriteria] = useState([{ id: Date.now(), text: '' }]);
  const [tips, setTips] = useState([{ id: Date.now(), text: '' }]);

  /* ── Load existing assignment or auto-fill course info ── */
  useEffect(() => {
    if (!courseId) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // Edit mode — load full assignment
        if (assignmentId) {
          const { data } = await api.get(`/assignments/${assignmentId}`);
          if (data.data && data.data.assignment) {
            const assign = data.data.assignment;
            if (assign.assignmentInfo) setAssignmentInfo(assign.assignmentInfo);
            if (assign.courseInfo) setCourseInfo(assign.courseInfo);
            if (assign.cloMappings?.length) {
              setCloMappings(assign.cloMappings.map((m, i) => ({ ...m, id: Date.now() + i })));
            }
            setAssignmentContent({
              assignmentTitle: assign.assignmentTitle || '',
              objective: assign.objective || '',
              assignmentDescription: assign.assignmentDescription || ''
            });
            if (assign.tasks?.length) setTasks(assign.tasks.map((t, i) => ({ id: Date.now() + i, text: t })));
            if (assign.submissionGuidelines?.length) setGuidelines(assign.submissionGuidelines.map((g, i) => ({ id: Date.now() + i, text: g })));
            if (assign.evaluationCriteria?.length) setCriteria(assign.evaluationCriteria.map((c, i) => ({ id: Date.now() + i, text: c })));
            if (assign.tipsForSuccess?.length) setTips(assign.tipsForSuccess.map((t, i) => ({ id: Date.now() + i, text: t })));
          }
          return;
        }

        // Create mode — auto-fill course info
        const { data } = await api.get(`/courses/${courseId}`);
        if (data.data && data.data.course) {
          const course = data.data.course;
          setCourseInfo({
            department: course.department?.name || '',
            program: course.program || '',
            courseTitle: course.courseName || ''
          });
        }
      } catch (err) {
        console.error('Failed to load assignment data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [courseId, assignmentId]);

  // ── Styles (reused from CCC/CRR/Quiz) ───────────────────────
  const sectionHeaderStyle = {
    marginBottom: '1.5rem',
    color: '#1e293b',
    fontSize: '1.2rem',
    fontWeight: '600',
    borderBottom: '2px solid #e2e8f0',
    paddingBottom: '0.75rem',
    marginTop: '2.5rem'
  };

  const labelStyle = {
    marginBottom: '0.35rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#475569',
    display: 'block'
  };

  const inputStyle = {
    padding: '0.6rem 0.8rem',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    borderRadius: '6px',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
    width: '100%',
    boxSizing: 'border-box'
  };

  const textareaStyle = {
    ...inputStyle,
    minHeight: '100px',
    resize: 'vertical'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1.5rem'
  };

  const actionBtnStyle = {
    padding: '0.5rem 1rem',
    backgroundColor: '#f8fafc',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.2s',
    marginTop: '1rem'
  };

  const dangerBtnStyle = {
    ...actionBtnStyle,
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    borderColor: '#fecaca',
    marginTop: 0
  };

  const saveBtnStyle = {
    padding: '0.75rem 2rem',
    backgroundColor: loading ? '#94a3b8' : '#3949ab',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '1rem',
    cursor: loading ? 'wait' : 'pointer',
    fontWeight: '600',
    transition: 'all 0.2s'
  };

  const backBtnStyle = {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#f8fafc',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '0.95rem',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.2s'
  };

  /* ── Save (Create or Update) ───────────────────────────── */
  const handleSaveDraft = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);

      const payload = {
        courseId,
        assignmentInfo,
        courseInfo,
        cloMappings: cloMappings.map(({ mappedCLO, mappedGA, mappedLearningLevel, sdg }) => ({
          mappedCLO, mappedGA, mappedLearningLevel, sdg
        })),
        assignmentTitle: assignmentContent.assignmentTitle,
        objective: assignmentContent.objective,
        assignmentDescription: assignmentContent.assignmentDescription,
        tasks: tasks.map(t => t.text).filter(t => t.trim()),
        submissionGuidelines: guidelines.map(g => g.text).filter(t => t.trim()),
        evaluationCriteria: criteria.map(c => c.text).filter(t => t.trim()),
        tipsForSuccess: tips.map(t => t.text).filter(t => t.trim())
      };

      if (isEditMode) {
        await api.put(`/assignments/${assignmentId}`, payload);
        toast.success('Assignment updated successfully!');
      } else {
        await api.post('/assignments', payload);
        toast.success('Assignment created successfully!');
      }

      onBack();
    } catch (err) {
      console.error('Failed to save assignment:', err);
      toast.error(err.response?.data?.message || 'Failed to save assignment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem', color: '#0f172a', fontSize: '1.8rem', fontWeight: '700' }}>
        {isEditMode ? 'Edit Assignment' : 'Create Assignment'}
      </h2>
      
      {loading && <div style={{ textAlign: 'center', marginBottom: '1rem', fontStyle: 'italic', color: '#64748b' }}>Processing...</div>}

      <form onSubmit={handleSaveDraft}>
        {/* Assignment Information */}
        <h3 style={{ ...sectionHeaderStyle, marginTop: '0' }}>Assignment Information</h3>
        <div style={gridStyle}>
          <div>
            <label style={labelStyle}>Assignment Number</label>
            <input type="text" style={inputStyle} value={assignmentInfo.assignmentNumber} onChange={e => setAssignmentInfo({...assignmentInfo, assignmentNumber: e.target.value})} placeholder="e.g. Assignment 1" />
          </div>
          <div>
            <label style={labelStyle}>Announcement Date</label>
            <input type="date" style={inputStyle} value={assignmentInfo.announcementDate} onChange={e => setAssignmentInfo({...assignmentInfo, announcementDate: e.target.value})} />
          </div>
          <div>
            <label style={labelStyle}>Due Date</label>
            <input type="date" style={inputStyle} value={assignmentInfo.dueDate} onChange={e => setAssignmentInfo({...assignmentInfo, dueDate: e.target.value})} />
          </div>
          <div>
            <label style={labelStyle}>Maximum Marks</label>
            <input type="number" style={inputStyle} value={assignmentInfo.maxMarks} onChange={e => setAssignmentInfo({...assignmentInfo, maxMarks: e.target.value})} placeholder="e.g. 20" />
          </div>
        </div>

        {/* Course Information */}
        <h3 style={sectionHeaderStyle}>Course Information</h3>
        <div style={gridStyle}>
          <div>
            <label style={labelStyle}>Department</label>
            <input type="text" style={inputStyle} value={courseInfo.department} onChange={e => setCourseInfo({...courseInfo, department: e.target.value})} />
          </div>
          <div>
            <label style={labelStyle}>Program</label>
            <input type="text" style={inputStyle} value={courseInfo.program} onChange={e => setCourseInfo({...courseInfo, program: e.target.value})} />
          </div>
          <div>
            <label style={labelStyle}>Course Title</label>
            <input type="text" style={inputStyle} value={courseInfo.courseTitle} onChange={e => setCourseInfo({...courseInfo, courseTitle: e.target.value})} />
          </div>
        </div>

        {/* CLO Mapping Section */}
        <h3 style={sectionHeaderStyle}>CLO Mapping</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '600', fontSize: '0.9rem' }}>Mapped CLO</th>
                <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '600', fontSize: '0.9rem' }}>Mapped GA</th>
                <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '600', fontSize: '0.9rem' }}>Mapped Learning Level</th>
                <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '600', fontSize: '0.9rem' }}>SDG</th>
                <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: '600', fontSize: '0.9rem', width: '80px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {cloMappings.map((row, index) => (
                <tr key={row.id}>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                    <input type="text" style={inputStyle} value={row.mappedCLO} onChange={e => {
                      const newMappings = [...cloMappings];
                      newMappings[index].mappedCLO = e.target.value;
                      setCloMappings(newMappings);
                    }} />
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                    <input type="text" style={inputStyle} value={row.mappedGA} onChange={e => {
                      const newMappings = [...cloMappings];
                      newMappings[index].mappedGA = e.target.value;
                      setCloMappings(newMappings);
                    }} />
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                    <input type="text" style={inputStyle} value={row.mappedLearningLevel} onChange={e => {
                      const newMappings = [...cloMappings];
                      newMappings[index].mappedLearningLevel = e.target.value;
                      setCloMappings(newMappings);
                    }} />
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                    <input type="text" style={inputStyle} value={row.sdg} onChange={e => {
                      const newMappings = [...cloMappings];
                      newMappings[index].sdg = e.target.value;
                      setCloMappings(newMappings);
                    }} />
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <button type="button" style={dangerBtnStyle} onClick={() => {
                      if (cloMappings.length > 1) {
                        setCloMappings(cloMappings.filter(m => m.id !== row.id));
                      }
                    }} disabled={cloMappings.length === 1}>
                      X
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" style={actionBtnStyle} onClick={() => setCloMappings([...cloMappings, { id: Date.now(), mappedCLO: '', mappedGA: '', mappedLearningLevel: '', sdg: '' }])}>
          + Add Row
        </button>

        {/* Assignment Content */}
        <h3 style={sectionHeaderStyle}>Assignment Content</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={labelStyle}>Assignment Title</label>
            <input type="text" style={inputStyle} value={assignmentContent.assignmentTitle} onChange={e => setAssignmentContent({...assignmentContent, assignmentTitle: e.target.value})} placeholder="Enter title" />
          </div>
          <div>
            <label style={labelStyle}>Objective</label>
            <textarea style={textareaStyle} value={assignmentContent.objective} onChange={e => setAssignmentContent({...assignmentContent, objective: e.target.value})} placeholder="Enter objective..." />
          </div>
          <div>
            <label style={labelStyle}>Assignment Description</label>
            <textarea style={{...textareaStyle, minHeight: '150px'}} value={assignmentContent.assignmentDescription} onChange={e => setAssignmentContent({...assignmentContent, assignmentDescription: e.target.value})} placeholder="Enter full description..." />
          </div>
        </div>

        {/* Tasks To Complete */}
        <h3 style={sectionHeaderStyle}>Tasks To Complete</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {tasks.map((task, index) => (
            <div key={task.id} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <textarea 
                  style={{...inputStyle, minHeight: '60px', resize: 'vertical'}} 
                  value={task.text} 
                  onChange={e => {
                    const newArr = [...tasks];
                    newArr[index].text = e.target.value;
                    setTasks(newArr);
                  }}
                  placeholder={`Task ${index + 1}`}
                />
              </div>
              <button type="button" style={dangerBtnStyle} onClick={() => {
                if (tasks.length > 1) setTasks(tasks.filter(t => t.id !== task.id));
              }} disabled={tasks.length === 1}>
                Delete
              </button>
            </div>
          ))}
        </div>
        <button type="button" style={actionBtnStyle} onClick={() => setTasks([...tasks, { id: Date.now(), text: '' }])}>
          + Add Task
        </button>

        {/* Submission Guidelines */}
        <h3 style={sectionHeaderStyle}>Submission Guidelines</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {guidelines.map((g, index) => (
            <div key={g.id} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <input 
                  type="text"
                  style={inputStyle} 
                  value={g.text} 
                  onChange={e => {
                    const newArr = [...guidelines];
                    newArr[index].text = e.target.value;
                    setGuidelines(newArr);
                  }}
                  placeholder={`Guideline ${index + 1}`}
                />
              </div>
              <button type="button" style={dangerBtnStyle} onClick={() => {
                if (guidelines.length > 1) setGuidelines(guidelines.filter(i => i.id !== g.id));
              }} disabled={guidelines.length === 1}>
                Delete
              </button>
            </div>
          ))}
        </div>
        <button type="button" style={actionBtnStyle} onClick={() => setGuidelines([...guidelines, { id: Date.now(), text: '' }])}>
          + Add Guideline
        </button>

        {/* Evaluation Criteria */}
        <h3 style={sectionHeaderStyle}>Evaluation Criteria</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {criteria.map((c, index) => (
            <div key={c.id} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <input 
                  type="text"
                  style={inputStyle} 
                  value={c.text} 
                  onChange={e => {
                    const newArr = [...criteria];
                    newArr[index].text = e.target.value;
                    setCriteria(newArr);
                  }}
                  placeholder={`Criterion ${index + 1}`}
                />
              </div>
              <button type="button" style={dangerBtnStyle} onClick={() => {
                if (criteria.length > 1) setCriteria(criteria.filter(i => i.id !== c.id));
              }} disabled={criteria.length === 1}>
                Delete
              </button>
            </div>
          ))}
        </div>
        <button type="button" style={actionBtnStyle} onClick={() => setCriteria([...criteria, { id: Date.now(), text: '' }])}>
          + Add Criterion
        </button>

        {/* Tips For Success */}
        <h3 style={sectionHeaderStyle}>Tips For Success</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {tips.map((tip, index) => (
            <div key={tip.id} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <input 
                  type="text"
                  style={inputStyle} 
                  value={tip.text} 
                  onChange={e => {
                    const newArr = [...tips];
                    newArr[index].text = e.target.value;
                    setTips(newArr);
                  }}
                  placeholder={`Tip ${index + 1}`}
                />
              </div>
              <button type="button" style={dangerBtnStyle} onClick={() => {
                if (tips.length > 1) setTips(tips.filter(i => i.id !== tip.id));
              }} disabled={tips.length === 1}>
                Delete
              </button>
            </div>
          ))}
        </div>
        <button type="button" style={actionBtnStyle} onClick={() => setTips([...tips, { id: Date.now(), text: '' }])}>
          + Add Tip
        </button>

        {/* Actions */}
        <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '2rem' }}>
          <button type="button" style={backBtnStyle} onClick={onBack} disabled={loading}>
            Back to Assignment List
          </button>
          <button type="submit" style={saveBtnStyle} disabled={loading}>
            {loading ? 'Saving...' : 'Save Draft'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateAssignmentForm;
