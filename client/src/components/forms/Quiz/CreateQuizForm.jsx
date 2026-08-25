import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import useToast from '../../../hooks/useToast';

const CreateQuizForm = ({ courseId, quizId, onBack }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const isEditMode = !!quizId;

  const [quizInfo, setQuizInfo] = useState({
    quizNumber: '',
    date: '',
    duration: '',
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

  const [questions, setQuestions] = useState([
    { id: Date.now(), text: '', marks: '' }
  ]);

  /* ── Load existing quiz (edit mode) or auto-fill course info ── */
  useEffect(() => {
    if (!courseId) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // Edit mode — load full quiz
        if (quizId) {
          const { data } = await api.get(`/quizzes/${quizId}`);
          if (data.data && data.data.quiz) {
            const quiz = data.data.quiz;
            if (quiz.quizInfo) setQuizInfo(quiz.quizInfo);
            if (quiz.courseInfo) setCourseInfo(quiz.courseInfo);
            if (quiz.cloMappings?.length) {
              setCloMappings(quiz.cloMappings.map((m, i) => ({ ...m, id: Date.now() + i })));
            }
            if (quiz.questions?.length) {
              setQuestions(quiz.questions.map((q, i) => ({
                id: Date.now() + i,
                text: q.questionText || '',
                marks: q.marks || ''
              })));
            }
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
        console.error('Failed to load quiz data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [courseId, quizId]);

  /* ── Save (Create or Update) ───────────────────────────── */
  const handleSaveDraft = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      const payload = {
        courseId,
        quizInfo,
        courseInfo,
        cloMappings: cloMappings.map(({ mappedCLO, mappedGA, mappedLearningLevel, sdg }) => ({
          mappedCLO, mappedGA, mappedLearningLevel, sdg
        })),
        questions: questions.map(q => ({
          questionText: q.text,
          marks: q.marks
        }))
      };

      if (isEditMode) {
        await api.put(`/quizzes/${quizId}`, payload);
        toast.success('Quiz updated successfully!');
      } else {
        await api.post('/quizzes', payload);
        toast.success('Quiz created successfully!');
      }

      onBack();
    } catch (err) {
      console.error('Failed to save quiz:', err);
      toast.error(err.response?.data?.message || 'Failed to save quiz.');
    } finally {
      setLoading(false);
    }
  };

  // ── Styles (reused from CCC/CRR) ───────────────────────
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

  return (
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem', color: '#0f172a', fontSize: '1.8rem', fontWeight: '700' }}>
        {isEditMode ? 'Edit Quiz' : 'Create Quiz'}
      </h2>

      {loading && <div style={{ textAlign: 'center', marginBottom: '1rem', fontStyle: 'italic', color: '#64748b' }}>Processing...</div>}

      <form onSubmit={handleSaveDraft}>
        {/* Quiz Information */}
        <h3 style={{ ...sectionHeaderStyle, marginTop: '0' }}>Quiz Information</h3>
        <div style={gridStyle}>
          <div>
            <label style={labelStyle}>Quiz Number</label>
            <input type="text" style={inputStyle} value={quizInfo.quizNumber} onChange={e => setQuizInfo({...quizInfo, quizNumber: e.target.value})} placeholder="e.g. Quiz 1" />
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" style={inputStyle} value={quizInfo.date} onChange={e => setQuizInfo({...quizInfo, date: e.target.value})} />
          </div>
          <div>
            <label style={labelStyle}>Duration</label>
            <input type="text" style={inputStyle} value={quizInfo.duration} onChange={e => setQuizInfo({...quizInfo, duration: e.target.value})} placeholder="e.g. 30 mins" />
          </div>
          <div>
            <label style={labelStyle}>Maximum Marks</label>
            <input type="number" style={inputStyle} value={quizInfo.maxMarks} onChange={e => setQuizInfo({...quizInfo, maxMarks: e.target.value})} placeholder="e.g. 10" />
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
        <h3 style={sectionHeaderStyle}>CLO Mapping Section</h3>
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

        {/* Questions Section */}
        <h3 style={sectionHeaderStyle}>Questions Section</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {questions.map((q, index) => (
            <div key={q.id} style={{ padding: '1.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontWeight: '700', color: '#1e293b' }}>Question {index + 1}</span>
                <button type="button" style={dangerBtnStyle} onClick={() => {
                  if (questions.length > 1) {
                    setQuestions(questions.filter(question => question.id !== q.id));
                  }
                }} disabled={questions.length === 1}>
                  Delete Question
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Question Text</label>
                  <textarea 
                    style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} 
                    value={q.text} 
                    onChange={e => {
                      const newQuestions = [...questions];
                      newQuestions[index].text = e.target.value;
                      setQuestions(newQuestions);
                    }}
                  />
                </div>
                <div style={{ width: '150px' }}>
                  <label style={labelStyle}>Marks</label>
                  <input 
                    type="number" 
                    style={inputStyle} 
                    value={q.marks} 
                    onChange={e => {
                      const newQuestions = [...questions];
                      newQuestions[index].marks = e.target.value;
                      setQuestions(newQuestions);
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" style={actionBtnStyle} onClick={() => setQuestions([...questions, { id: Date.now(), text: '', marks: '' }])}>
          + Add Question
        </button>

        {/* Actions */}
        <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '2rem' }}>
          <button type="button" style={backBtnStyle} onClick={onBack} disabled={loading}>
            Back to Quiz List
          </button>
          <button type="submit" style={saveBtnStyle} disabled={loading}>
            {loading ? 'Saving...' : (isEditMode ? 'Update Quiz' : 'Save Draft')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateQuizForm;
