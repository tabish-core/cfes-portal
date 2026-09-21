import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import useToast from '../../hooks/useToast';
import '../dean/Dashboard.css';

const WORKFLOW_STEPS = [
  { id: 'setup', label: '1. Course Setup' },
  { id: 'students', label: '2. Students' },
  { id: 'assessments', label: '3. Assessments' },
  { id: 'mapping', label: '4. CLO / GA Mapping' },
  { id: 'marks', label: '5. Marks Entry' },
  { id: 'results', label: '6. OBE Results' },
  { id: 'export', label: '7. Export' },
];

const OBEWorkspace = () => {
  const { courseId } = useParams();
  const toast = useToast();
  const [activeStep, setActiveStep] = useState('setup');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // --- Course Setup State ---
  const [courseInfo, setCourseInfo] = useState({ courseName: 'Loading...', courseCode: '...', creditHours: '', type: '' });
  const [clos, setClos] = useState([]);
  const [gas, setGas] = useState([]);
  const [cloGaMapping, setCloGaMapping] = useState([]);
  const [assessmentsConfig, setAssessmentsConfig] = useState({ quizzes: 10, assignments: 25, midTerm: 25, finalExam: 40 });
  const [grades, setGrades] = useState({ A: 88, BPlus: 81, B: 74, CPlus: 67, C: 60, F: 59 });
  const [kpiThreshold, setKpiThreshold] = useState(60);

  // --- Students State ---
  const [students, setStudents] = useState([]);
  const [studentForm, setStudentForm] = useState({ registrationNo: '', studentName: '' });

  // --- Assessments State ---
  const [assessments, setAssessments] = useState([]);
  const [assessmentForm, setAssessmentForm] = useState({ category: 'quizzes', title: '' });
  const [componentForms, setComponentForms] = useState({});

  // --- Marks Entry State ---
  const [marksData, setMarksData] = useState({}); // Keyed by studentId_componentId
  const [originalMarks, setOriginalMarks] = useState({});

  // --- Results State ---
  const [resultsData, setResultsData] = useState(null);

  useEffect(() => {
    if (courseId) {
      if (activeStep === 'setup') fetchConfig();
      if (activeStep === 'students') fetchStudents();
      if (activeStep === 'assessments') {
        fetchConfig().then(() => fetchAssessments());
      }
      if (activeStep === 'marks') {
        fetchMarksData();
      }
      if (activeStep === 'results') {
        fetchResults();
      }
    }
    // eslint-disable-next-line
  }, [courseId, activeStep]);

  // ==========================================
  // CONFIGURATION LOGIC
  // ==========================================
  const fetchConfig = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/obe/${courseId}/config`);
      const config = data.data;

      if (config.course && typeof config.course === 'object') {
        setCourseInfo({
          courseName: config.course.courseName || 'Unknown Course',
          courseCode: config.course.courseCode || 'UNKNOWN',
          creditHours: config.course.creditHours || '',
          type: config.course.type || ''
        });
      }

      setClos(config.clos || []);
      setGas(config.gas || []);
      setCloGaMapping(config.cloGaMapping || []);
      if (config.assessments) setAssessmentsConfig(config.assessments);
      if (config.grades) setGrades(config.grades);
      if (config.kpiThreshold !== undefined) setKpiThreshold(config.kpiThreshold);
    } catch (err) {
      toast.error('Failed to load OBE configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    for (const clo of clos) {
      if (!clo.cloNumber.trim() || !clo.description.trim()) {
        return toast.error('All CLOs must have a valid number and description.');
      }
    }
    for (const ga of gas) {
      if (!ga.gaNumber.trim() || !ga.description.trim()) {
        return toast.error('All GAs must have a valid number and description.');
      }
    }

    const total = Number(assessmentsConfig.quizzes) + Number(assessmentsConfig.assignments) + Number(assessmentsConfig.midTerm) + Number(assessmentsConfig.finalExam);
    if (total !== 100) return toast.error(`Assessment weightages must total exactly 100%. Current: ${total}%`);

    const { A, BPlus, B, CPlus, C, F } = grades;
    if (!(Number(A) > Number(BPlus) && Number(BPlus) > Number(B) && Number(B) > Number(CPlus) && Number(CPlus) > Number(C) && Number(C) > Number(F))) {
      return toast.error('Grade boundaries must be logically ordered and not overlap.');
    }

    try {
      setSaving(true);
      await api.post(`/obe/${courseId}/config`, { clos, gas, cloGaMapping, assessments: assessmentsConfig, grades, kpiThreshold: Number(kpiThreshold) });
      toast.success('Configuration saved successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncFromCIS = async () => {
    try {
      setSyncing(true);
      const { data } = await api.post(`/obe/${courseId}/sync-from-cis`);
      const summary = data.data;
      toast.success(`CIS Synced! CLOs: ${summary.closSynced}, Assessments Created/Updated: ${summary.assessmentsCreated}/${summary.componentsUpdated}`);
      // Refresh config and assessments to reflect the new data
      await fetchConfig();
      await fetchAssessments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to sync from CIS.');
    } finally {
      setSyncing(false);
    }
  };

  // ==========================================
  // STUDENTS LOGIC
  // ==========================================
  const fetchStudents = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/obe/${courseId}/students`);
      setStudents(data.data);
    } catch (err) {
      toast.error('Failed to load students.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!studentForm.registrationNo || !studentForm.studentName) return toast.error('Registration No and Name are required.');
    try {
      setSaving(true);
      const { data } = await api.post(`/obe/${courseId}/students`, studentForm);
      setStudents([...students, data.data].sort((a, b) => a.registrationNo.localeCompare(b.registrationNo)));
      setStudentForm({ registrationNo: '', studentName: '' });
      toast.success('Student added successfully.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add student.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to remove this student?')) return;
    try {
      await api.delete(`/obe/${courseId}/students/${studentId}`);
      setStudents(students.filter(s => s._id !== studentId));
      toast.success('Student removed successfully.');
    } catch (err) {
      toast.error('Failed to remove student.');
    }
  };

  // ==========================================
  // ASSESSMENTS LOGIC
  // ==========================================
  const fetchAssessments = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/obe/${courseId}/assessments`);
      setAssessments(data.data);
      const initialForms = {};
      data.data.forEach(a => {
        initialForms[a._id] = { title: '', maxMarks: '', cloNumber: clos.length > 0 ? clos[0].cloNumber : '' };
      });
      setComponentForms(initialForms);
    } catch (err) {
      toast.error('Failed to load assessments.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAssessment = async (e) => {
    e.preventDefault();
    if (!assessmentForm.title) return toast.error('Title is required.');
    try {
      setSaving(true);
      const { data } = await api.post(`/obe/${courseId}/assessments`, {
        category: assessmentForm.category,
        title: assessmentForm.title,
        order: assessments.filter(a => a.category === assessmentForm.category).length
      });
      setAssessments([...assessments, data.data]);
      setComponentForms({ ...componentForms, [data.data._id]: { title: '', maxMarks: '', cloNumber: clos.length > 0 ? clos[0].cloNumber : '' } });
      setAssessmentForm({ category: assessmentForm.category, title: '' });
      toast.success('Assessment added successfully.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add assessment.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssessment = async (assessmentId) => {
    if (!window.confirm('Are you sure you want to remove this assessment?')) return;
    try {
      await api.delete(`/obe/${courseId}/assessments/${assessmentId}`);
      setAssessments(assessments.filter(a => a._id !== assessmentId));
      toast.success('Assessment removed successfully.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove assessment.');
    }
  };

  const handleComponentFormChange = (assessmentId, field, value) => {
    setComponentForms({
      ...componentForms,
      [assessmentId]: { ...componentForms[assessmentId], [field]: value }
    });
  };

  const handleAddComponent = async (assessmentId) => {
    const form = componentForms[assessmentId];
    if (!form.maxMarks || !form.cloNumber) return toast.error('Max Marks and CLO are required.');
    if (Number(form.maxMarks) <= 0) return toast.error('Max Marks must be greater than 0.');

    try {
      setSaving(true);
      const { data } = await api.post(`/obe/${courseId}/assessments/${assessmentId}/components`, form);
      setAssessments(assessments.map(a => a._id === assessmentId ? data.data : a));
      setComponentForms({ ...componentForms, [assessmentId]: { title: '', maxMarks: '', cloNumber: clos.length > 0 ? clos[0].cloNumber : '' } });
      toast.success('Component added successfully.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add component.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteComponent = async (assessmentId, componentId) => {
    if (!window.confirm('Are you sure you want to remove this component?')) return;
    try {
      const { data } = await api.delete(`/obe/${courseId}/assessments/${assessmentId}/components/${componentId}`);
      setAssessments(assessments.map(a => a._id === assessmentId ? data.data : a));
      toast.success('Component removed successfully.');
    } catch (err) {
      toast.error('Failed to remove component.');
    }
  };

  // ==========================================
  // MARKS ENTRY LOGIC
  // ==========================================
  const fetchMarksData = async () => {
    try {
      setLoading(true);
      const [studentsRes, assessmentsRes, marksRes] = await Promise.all([
        api.get(`/obe/${courseId}/students`),
        api.get(`/obe/${courseId}/assessments`),
        api.get(`/obe/${courseId}/marks`)
      ]);
      setStudents(studentsRes.data.data);
      setAssessments(assessmentsRes.data.data);

      const loadedMarks = {};
      marksRes.data.data.forEach(m => {
        loadedMarks[`${m.student}_${m.componentId}`] = m.marks.toString();
      });
      setMarksData(loadedMarks);
      setOriginalMarks({ ...loadedMarks });
    } catch (err) {
      toast.error('Failed to load marks data.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkChange = (studentId, componentId, value) => {
    setMarksData(prev => ({
      ...prev,
      [`${studentId}_${componentId}`]: value
    }));
  };

  const handleSaveMarks = async () => {
    try {
      setSaving(true);

      const payload = [];
      for (const key in marksData) {
        const val = marksData[key];
        const orig = originalMarks[key];

        if (val !== orig) {
          const [student, componentId] = key.split('_');
          payload.push({ student, componentId, marks: val });
        }
      }

      for (const key in originalMarks) {
        if (!marksData[key] || marksData[key] === '') {
          const [student, componentId] = key.split('_');
          payload.push({ student, componentId, marks: '' });
        }
      }

      if (payload.length === 0) {
        setSaving(false);
        return toast.success('No changes to save.');
      }

      await api.put(`/obe/${courseId}/marks/bulk`, { marks: payload });
      toast.success('Marks saved successfully!');

      setOriginalMarks({ ...marksData });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save marks.');
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // RESULTS LOGIC
  // ==========================================
  const fetchResults = async () => {
    try {
      setLoading(true);
      // We also need config for column headers
      const configRes = await api.get(`/obe/${courseId}/config`);
      const res = await api.get(`/obe/${courseId}/results`);

      setClos(configRes.data.data.clos || []);
      setGas(configRes.data.data.gas || []);
      setResultsData(res.data.data);
    } catch (err) {
      toast.error('Failed to load OBE results.');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // RENDERERS
  // ==========================================
  const renderCourseSetup = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem', backgroundColor: '#fff', borderRadius: '8px' }}>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
        <button
          onClick={handleSyncFromCIS}
          disabled={syncing || saving}
          style={{ padding: '0.6rem 1.5rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: (syncing || saving) ? 'not-allowed' : 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {syncing ? 'Syncing...' : 'Import from CIS'}
        </button>
      </div>

      <section>
        <h3 className="dashboard-section-title">Course Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
          <div><strong>Course Code:</strong> {courseInfo.courseCode}</div>
          <div><strong>Course Name:</strong> {courseInfo.courseName}</div>
          <div><strong>Credit Hours:</strong> {courseInfo.creditHours}</div>
          <div><strong>Type:</strong> {courseInfo.type}</div>
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="dashboard-section-title" style={{ margin: 0 }}>CLO Configuration</h3>
          <button onClick={() => setClos([...clos, { cloNumber: `CLO ${clos.length + 1}`, description: '', active: true }])} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>+ Add CLO</button>
        </div>
        {clos.length === 0 ? <p style={{ color: '#64748b' }}>No CLOs defined.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {clos.map((clo, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="text" value={clo.cloNumber} onChange={(e) => { const n = [...clos]; n[idx].cloNumber = e.target.value; setClos(n); }} placeholder="CLO 1" style={{ width: '100px', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                <input type="text" value={clo.description} onChange={(e) => { const n = [...clos]; n[idx].description = e.target.value; setClos(n); }} placeholder="Description" style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                <button onClick={() => setClos(clos.filter((_, i) => i !== idx))} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="dashboard-section-title" style={{ margin: 0 }}>GA Configuration</h3>
          <button onClick={() => setGas([...gas, { gaNumber: `GA ${gas.length + 1}`, description: '', active: true }])} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>+ Add GA</button>
        </div>
        {gas.length === 0 ? <p style={{ color: '#64748b' }}>No GAs defined.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {gas.map((ga, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="text" value={ga.gaNumber} onChange={(e) => { const n = [...gas]; n[idx].gaNumber = e.target.value; setGas(n); }} placeholder="GA 1" style={{ width: '100px', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                <input type="text" value={ga.description} onChange={(e) => { const n = [...gas]; n[idx].description = e.target.value; setGas(n); }} placeholder="Description" style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                <button onClick={() => setGas(gas.filter((_, i) => i !== idx))} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </section>



      <section>
        <h3 className="dashboard-section-title">Assessment Weightages (%)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {['quizzes', 'assignments', 'midTerm', 'finalExam'].map(field => (
            <div key={field}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: '#475569', textTransform: 'capitalize' }}>
                {field.replace(/([A-Z])/g, ' $1').trim()}
              </label>
              <input type="number" value={assessmentsConfig[field]} onChange={(e) => setAssessmentsConfig({ ...assessmentsConfig, [field]: Number(e.target.value) })} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="dashboard-section-title">Grade Boundaries</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem' }}>
          {[{ key: 'A', label: 'A (>=)' }, { key: 'BPlus', label: 'B+ (>=)' }, { key: 'B', label: 'B (>=)' }, { key: 'CPlus', label: 'C+ (>=)' }, { key: 'C', label: 'C (>=)' }, { key: 'F', label: 'F (<)' }].map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: '#475569' }}>{f.label}</label>
              <input type="number" value={grades[f.key]} onChange={(e) => setGrades({ ...grades, [f.key]: Number(e.target.value) })} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="dashboard-section-title">KPI Settings</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: '#475569' }}>Course KPI Threshold (%)</label>
            <input type="number" min="0" max="100" value={kpiThreshold} onChange={(e) => setKpiThreshold(Number(e.target.value))} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
          </div>
        </div>
      </section>

      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSaveConfig} disabled={saving} className="btn-primary" style={{ padding: '0.75rem 2rem' }}>
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );

  const renderMapping = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem', backgroundColor: '#fff', borderRadius: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="dashboard-section-title" style={{ margin: 0 }}>CLO → GA Mapping</h3>
        <button onClick={handleSaveConfig} disabled={saving} className="btn-primary" style={{ padding: '0.6rem 1.5rem' }}>
          {saving ? 'Saving...' : 'Save Mapping'}
        </button>
      </div>

      {clos.length === 0 || gas.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
          <p style={{ color: '#64748b', margin: 0 }}>Please define at least one CLO and one GA in Course Setup first.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1', borderRight: '1px solid #cbd5e1', textAlign: 'left' }}>CLO \ GA</th>
                {gas.map(g => <th key={g.gaNumber} style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>{g.gaNumber}</th>)}
              </tr>
            </thead>
            <tbody>
              {clos.map((clo, idx) => {
                const cloMap = cloGaMapping.find(m => m.cloNumber === clo.cloNumber) || { mappedGAs: [] };
                return (
                  <tr key={clo.cloNumber} style={{ background: idx % 2 === 0 ? '#fff' : '#fcfcfc', borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.75rem', borderRight: '1px solid #e2e8f0', fontWeight: 'bold', color: '#334155' }}>{clo.cloNumber}</td>
                    {gas.map(g => (
                      <td key={g.gaNumber} style={{ padding: '0.75rem', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>
                        <input type="checkbox" checked={cloMap.mappedGAs.includes(g.gaNumber)} onChange={() => {
                          let mapping = [...cloGaMapping];
                          let cm = mapping.find(m => m.cloNumber === clo.cloNumber);
                          if (!cm) { cm = { cloNumber: clo.cloNumber, mappedGAs: [] }; mapping.push(cm); }
                          if (cm.mappedGAs.includes(g.gaNumber)) cm.mappedGAs = cm.mappedGAs.filter(ga => ga !== g.gaNumber);
                          else cm.mappedGAs.push(g.gaNumber);
                          setCloGaMapping(mapping);
                        }} style={{ cursor: 'pointer', width: '1.2rem', height: '1.2rem', accentColor: '#1d4ed8' }} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderStudents = () => (
    <div style={{ padding: '1rem', backgroundColor: '#fff', borderRadius: '8px' }}>
      <h3 className="dashboard-section-title">Student Roster</h3>

      <form onSubmit={handleAddStudent} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
        <input type="text" placeholder="Registration No" value={studentForm.registrationNo} onChange={e => setStudentForm({ ...studentForm, registrationNo: e.target.value })} style={{ flex: 1, padding: '0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
        <input type="text" placeholder="Student Name" value={studentForm.studentName} onChange={e => setStudentForm({ ...studentForm, studentName: e.target.value })} style={{ flex: 2, padding: '0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
        <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '0.6rem 1.5rem' }}>+ Add Student</button>
      </form>

      {students.length === 0 ? <p style={{ color: '#64748b' }}>No students added yet.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1' }}>S/No</th>
              <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1' }}>Registration No</th>
              <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1' }}>Student Name</th>
              <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1' }}>Status</th>
              <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, idx) => (
              <tr key={student._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.75rem' }}>{idx + 1}</td>
                <td style={{ padding: '0.75rem', fontWeight: '500' }}>{student.registrationNo}</td>
                <td style={{ padding: '0.75rem' }}>{student.studentName}</td>
                <td style={{ padding: '0.75rem' }}><span style={{ padding: '0.25rem 0.5rem', background: '#dcfce7', color: '#166534', borderRadius: '999px', fontSize: '0.8rem' }}>Active</span></td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}><button onClick={() => handleDeleteStudent(student._id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderAssessments = () => {
    const categories = [{ id: 'quizzes', label: 'QUIZZES' }, { id: 'assignments', label: 'ASSIGNMENTS / CCP' }, { id: 'midTerm', label: 'MID TERM' }, { id: 'finalExam', label: 'FINAL EXAM' }];

    return (
      <div style={{ padding: '1rem', backgroundColor: '#fff', borderRadius: '8px' }}>
        <h3 className="dashboard-section-title">Assessment Structure</h3>

        <form onSubmit={handleAddAssessment} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
          <select value={assessmentForm.category} onChange={e => setAssessmentForm({ ...assessmentForm, category: e.target.value })} style={{ flex: 1, padding: '0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
            <option value="quizzes">Quizzes</option>
            <option value="assignments">Assignments / CCP</option>
          </select>
          <input type="text" placeholder="Assessment Title (e.g. Quiz 1)" value={assessmentForm.title} onChange={e => setAssessmentForm({ ...assessmentForm, title: e.target.value })} style={{ flex: 2, padding: '0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
          <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '0.6rem 1.5rem' }}>+ Add Assessment</button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          {categories.map(cat => {
            const catAssessments = assessments.filter(a => a.category === cat.id).sort((a, b) => a.order - b.order);

            return (
              <div key={cat.id}>
                <h4 style={{ margin: '0 0 1.5rem 0', color: '#1e293b', borderBottom: '2px solid #cbd5e1', paddingBottom: '0.5rem', letterSpacing: '1px' }}>{cat.label}</h4>
                {catAssessments.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic' }}>No assessments in this category.</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {catAssessments.map(a => {
                      const activeComponents = a.components ? a.components.filter(c => c.active) : [];
                      return (
                        <div key={a._id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', backgroundColor: '#fafafa' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h5 style={{ margin: 0, fontSize: '1.05rem', color: '#334155' }}>{a.title}</h5>
                            {cat.id !== 'midTerm' && cat.id !== 'finalExam' && (
                              <button onClick={() => handleDeleteAssessment(a._id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>Delete Assessment</button>
                            )}
                          </div>

                          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem', fontSize: '0.95rem' }}>
                            <thead>
                              <tr style={{ background: '#e2e8f0', textAlign: 'left', color: '#475569' }}>
                                <th style={{ padding: '0.5rem' }}>Component</th><th style={{ padding: '0.5rem' }}>Title (Opt)</th><th style={{ padding: '0.5rem' }}>Max Marks</th><th style={{ padding: '0.5rem' }}>CLO</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeComponents.length === 0 ? (
                                <tr><td colSpan="5" style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>No components added yet.</td></tr>
                              ) : (
                                activeComponents.map(c => (
                                  <tr key={c._id} style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                                    <td style={{ padding: '0.5rem', fontWeight: '500' }}>{c.componentNumber}</td>
                                    <td style={{ padding: '0.5rem' }}>{c.title || '-'}</td>
                                    <td style={{ padding: '0.5rem', fontWeight: '600' }}>[ {c.maxMarks} ]</td>
                                    <td style={{ padding: '0.5rem', color: '#2563eb' }}>[ {c.cloNumber} ]</td>
                                    <td style={{ padding: '0.5rem', textAlign: 'right' }}><button onClick={() => handleDeleteComponent(a._id, c._id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button></td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>

                          {componentForms[a._id] && clos.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input type="text" placeholder="Component Title (Opt)" value={componentForms[a._id].title} onChange={e => handleComponentFormChange(a._id, 'title', e.target.value)} style={{ flex: 1, padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                              <input type="number" placeholder="Max Marks" value={componentForms[a._id].maxMarks} onChange={e => handleComponentFormChange(a._id, 'maxMarks', e.target.value)} style={{ width: '100px', padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                              <select value={componentForms[a._id].cloNumber} onChange={e => handleComponentFormChange(a._id, 'cloNumber', e.target.value)} style={{ width: '120px', padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                {clos.filter(c => c.active).map(c => <option key={c.cloNumber} value={c.cloNumber}>{c.cloNumber}</option>)}
                              </select>
                              <button onClick={() => handleAddComponent(a._id)} disabled={saving} style={{ padding: '0.4rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ Add Component</button>
                            </div>
                          )}
                          {clos.length === 0 && (
                            <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>Please define CLOs in Course Setup before adding components.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMarksEntry = () => {
    const categories = [{ id: 'quizzes', label: 'QUIZZES' }, { id: 'assignments', label: 'ASSIGNMENTS & CCP' }, { id: 'midTerm', label: 'MID TERM' }, { id: 'finalExam', label: 'FINAL EXAM' }];
    const activeComponents = [];
    categories.forEach(cat => {
      assessments.filter(a => a.category === cat.id).sort((a, b) => a.order - b.order).forEach(a => {
        if (a.components) a.components.filter(c => c.active).forEach(c => activeComponents.push({ categoryId: cat.id, categoryLabel: cat.label, componentId: c._id, componentNumber: c.componentNumber, maxMarks: c.maxMarks }));
      });
    });

    if (activeComponents.length === 0 || students.length === 0) return (<div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#fff', borderRadius: '8px' }}><p style={{ color: '#64748b' }}>Please define Assessment Components and Students first.</p></div>);

    const headers = [];
    let currentCat = null;
    let count = 0;
    activeComponents.forEach((comp, idx) => {
      if (comp.categoryId !== currentCat) {
        if (currentCat !== null) headers.push({ label: categories.find(c => c.id === currentCat).label, span: count });
        currentCat = comp.categoryId;
        count = 1;
      } else count++;
      if (idx === activeComponents.length - 1) headers.push({ label: categories.find(c => c.id === currentCat).label, span: count });
    });

    return (
      <div style={{ padding: '1rem', backgroundColor: '#fff', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="dashboard-section-title" style={{ margin: 0 }}>Marks Entry</h3>
          <button onClick={handleSaveMarks} disabled={saving} className="btn-primary" style={{ padding: '0.6rem 1.5rem' }}>{saving ? 'Saving...' : 'Save Marks'}</button>
        </div>
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                <th colSpan="3" style={{ padding: '0.5rem', borderRight: '2px solid #cbd5e1' }}>Student Information</th>
                {headers.map((h, i) => <th key={i} colSpan={h.span} style={{ padding: '0.5rem', textAlign: 'center', borderRight: '2px solid #cbd5e1', letterSpacing: '1px', fontSize: '0.85rem', color: '#475569' }}>{h.label}</th>)}
              </tr>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', fontSize: '0.9rem' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>S/No</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Reg No</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderRight: '2px solid #cbd5e1', minWidth: '150px' }}>Name</th>
                {activeComponents.map((comp, i) => (
                  <th key={comp.componentId} style={{ padding: '0.5rem', textAlign: 'center', borderRight: (i < activeComponents.length - 1 && activeComponents[i + 1].categoryId !== comp.categoryId) ? '2px solid #cbd5e1' : '1px solid #e2e8f0', minWidth: '60px' }}>
                    <div>{comp.componentNumber}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>/ {comp.maxMarks}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student, sIdx) => (
                <tr key={student._id} style={{ borderBottom: '1px solid #e2e8f0', background: sIdx % 2 === 0 ? '#fff' : '#fcfcfc' }}>
                  <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', color: '#64748b' }}>{sIdx + 1}</td>
                  <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', fontWeight: '500' }}>{student.registrationNo}</td>
                  <td style={{ padding: '0.5rem', borderRight: '2px solid #cbd5e1' }}>{student.studentName}</td>
                  {activeComponents.map((comp, i) => {
                    const key = `${student._id}_${comp.componentId}`;
                    const val = marksData[key] !== undefined ? marksData[key] : '';
                    const isError = val !== '' && (isNaN(Number(val)) || Number(val) < 0 || Number(val) > comp.maxMarks);
                    return (
                      <td key={comp.componentId} style={{ padding: '0.25rem', borderRight: (i < activeComponents.length - 1 && activeComponents[i + 1].categoryId !== comp.categoryId) ? '2px solid #cbd5e1' : '1px solid #e2e8f0', textAlign: 'center' }}>
                        <input type="text" value={val} onChange={e => handleMarkChange(student._id, comp.componentId, e.target.value)} style={{ width: '45px', padding: '0.25rem', textAlign: 'center', border: isError ? '2px solid #ef4444' : '1px solid #cbd5e1', borderRadius: '4px', background: isError ? '#fef2f2' : '#fff', outline: 'none' }} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (!resultsData) return null;
    if (resultsData.students.length === 0) return (<div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#fff', borderRadius: '8px' }}><p style={{ color: '#64748b' }}>No students found.</p></div>);

    const activeClos = clos.filter(c => c.active);
    const activeGas = gas.filter(g => g.active);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ padding: '1rem', backgroundColor: '#fff', borderRadius: '8px', overflowX: 'auto' }}>
          <h3 className="dashboard-section-title">Student OBE Results</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1200px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                <th colSpan="3" style={{ padding: '0.5rem', borderRight: '2px solid #cbd5e1' }}>Student Information</th>
                <th colSpan="3" style={{ padding: '0.5rem', borderRight: '2px solid #cbd5e1', textAlign: 'center' }}>Course Performance</th>
                {activeClos.length > 0 && <th colSpan={activeClos.length} style={{ padding: '0.5rem', borderRight: '2px solid #cbd5e1', textAlign: 'center' }}>CLO Attainment (%)</th>}
                {activeGas.length > 0 && <th colSpan={activeGas.length} style={{ padding: '0.5rem', borderRight: '2px solid #cbd5e1', textAlign: 'center' }}>GA Attained (Y/N)</th>}
              </tr>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', fontSize: '0.85rem' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>S/No</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Reg No</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderRight: '2px solid #cbd5e1' }}>Name</th>

                <th style={{ padding: '0.75rem', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>Sessionals</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>Overall %</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', borderRight: '2px solid #cbd5e1' }}>Grade</th>

                {activeClos.map((c, i) => (
                  <th key={c.cloNumber} style={{ padding: '0.75rem', textAlign: 'center', borderRight: i === activeClos.length - 1 ? '2px solid #cbd5e1' : '1px solid #e2e8f0' }}>
                    {c.cloNumber}
                  </th>
                ))}

                {activeGas.map((g, i) => (
                  <th key={g.gaNumber} style={{ padding: '0.75rem', textAlign: 'center', borderRight: i === activeGas.length - 1 ? '2px solid #cbd5e1' : '1px solid #e2e8f0' }}>
                    {g.gaNumber}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultsData.students.map((student, idx) => (
                <tr key={student.studentId} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#fff' : '#fcfcfc', fontSize: '0.9rem' }}>
                  <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', color: '#64748b' }}>{idx + 1}</td>
                  <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', fontWeight: '500' }}>{student.registrationNo}</td>
                  <td style={{ padding: '0.5rem', borderRight: '2px solid #cbd5e1' }}>{student.studentName}</td>

                  <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '500' }}>{student.sessionals}</td>
                  <td style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '500' }}>{student.overallPercentage}</td>
                  <td style={{ padding: '0.5rem', borderRight: '2px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold', color: student.grade === 'F' ? '#ef4444' : '#166534' }}>{student.grade}</td>

                  {activeClos.map((c, i) => {
                    const cloRes = student.clos.find(x => x.cloNumber === c.cloNumber);
                    const val = cloRes?.percentage !== null ? `${cloRes.percentage}%` : '-';
                    const color = cloRes?.status === 'complete' ? (cloRes.attained ? '#166534' : '#ef4444') : '#94a3b8';
                    return (
                      <td key={c.cloNumber} style={{ padding: '0.5rem', borderRight: i === activeClos.length - 1 ? '2px solid #cbd5e1' : '1px solid #e2e8f0', textAlign: 'center', color, fontWeight: '500' }}>
                        {val}
                      </td>
                    );
                  })}

                  {activeGas.map((g, i) => {
                    const gaRes = student.gas.find(x => x.gaNumber === g.gaNumber);
                    const val = gaRes?.attained === true ? 'Y' : gaRes?.attained === false ? 'N' : '-';
                    const color = val === 'Y' ? '#166534' : val === 'N' ? '#ef4444' : '#94a3b8';
                    return (
                      <td key={g.gaNumber} style={{ padding: '0.5rem', borderRight: i === activeGas.length - 1 ? '2px solid #cbd5e1' : '1px solid #e2e8f0', textAlign: 'center', color, fontWeight: 'bold' }}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div style={{ padding: '1rem', backgroundColor: '#fff', borderRadius: '8px' }}>
            <h3 className="dashboard-section-title">Percentage of Students Passing CLO</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>CLO</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Passing %</th>
                </tr>
              </thead>
              <tbody>
                {resultsData.courseCLOPassing.map(c => (
                  <tr key={c.cloNumber} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.5rem', fontWeight: '500' }}>{c.cloNumber}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold', color: c.percentage >= 50 ? '#166534' : (c.percentage === null ? '#94a3b8' : '#ef4444') }}>
                      {c.percentage !== null ? `${c.percentage}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '1rem', backgroundColor: '#fff', borderRadius: '8px' }}>
            <h3 className="dashboard-section-title">Percentage of Students Passing GA</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>GA</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Passing %</th>
                </tr>
              </thead>
              <tbody>
                {resultsData.courseGAPassing.map(g => (
                  <tr key={g.gaNumber} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.5rem', fontWeight: '500' }}>{g.gaNumber}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold', color: g.percentage >= 50 ? '#166534' : (g.percentage === null ? '#94a3b8' : '#ef4444') }}>
                      {g.percentage !== null ? `${g.percentage}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header-container">
        <Link to={`/faculty/course/${courseId}`} className="back-link">← Back to Course</Link>
        <h1 className="dashboard-heading">OBE Workspace</h1>
        <p className="dashboard-sub">{courseInfo.courseCode} - {courseInfo.courseName}</p>
      </div>

      <div className="dashboard-panel" style={{ display: 'flex', gap: '2rem', minHeight: '600px' }}>
        <div style={{ width: '250px', borderRight: '1px solid #e2e8f0', paddingRight: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
          <h3 style={{ marginBottom: '1rem', color: '#1e293b', fontSize: '1.1rem' }}>Workflow</h3>
          {WORKFLOW_STEPS.map((step) => (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              style={{
                textAlign: 'left', padding: '0.75rem 1rem', border: 'none', borderRadius: '6px',
                backgroundColor: activeStep === step.id ? '#eff6ff' : 'transparent',
                color: activeStep === step.id ? '#1d4ed8' : '#475569',
                fontWeight: activeStep === step.id ? '600' : '400',
                cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.95rem'
              }}
            >
              {step.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, padding: '0 1rem', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading data...</div>
          ) : activeStep === 'setup' ? (
            renderCourseSetup()
          ) : activeStep === 'students' ? (
            renderStudents()
          ) : activeStep === 'assessments' ? (
            renderAssessments()
          ) : activeStep === 'mapping' ? (
            renderMapping()
          ) : activeStep === 'marks' ? (
            renderMarksEntry()
          ) : activeStep === 'results' ? (
            renderResults()
          ) : activeStep === 'export' ? (
            <div style={{ padding: '2rem', backgroundColor: '#fff', borderRadius: '8px', textAlign: 'center' }}>
              <h2 style={{ color: '#334155', marginBottom: '1.5rem', fontSize: '1.5rem' }}>Export OBE Award List</h2>
              <p style={{ color: '#64748b', maxWidth: '500px', margin: '0 auto 2rem auto', lineHeight: '1.6' }}>
                Click the button below to generate the official OBE Excel Award List containing the student roster, raw marks, analysis charts.
              </p>
              <button
                onClick={async () => {
                  try {
                    setSaving(true);
                    const response = await api.get(`/obe/${courseId}/export/excel`, { responseType: 'blob' });
                    const url = window.URL.createObjectURL(new Blob([response.data]));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', `${courseInfo.courseCode || 'Course'}_OBE_Award_List.xlsx`);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    toast.success('Excel workbook downloaded successfully!');
                  } catch (err) {
                    toast.error('Failed to export Excel workbook.');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving || loading}
                className="btn-primary"
                style={{ padding: '1rem 3rem', fontSize: '1.1rem' }}
              >
                {saving ? 'Generating...' : 'Download Official Excel Workbook'}
              </button>
            </div>
          ) : (
            <div style={{ backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '3rem', textAlign: 'center' }}>
              <h2 style={{ color: '#334155', marginBottom: '1rem', fontSize: '1.5rem' }}>{WORKFLOW_STEPS.find(s => s.id === activeStep)?.label}</h2>
              <p style={{ color: '#64748b', maxWidth: '400px', margin: '0 auto', lineHeight: '1.5' }}>
                This section is part of the OBE module foundation. Functionality for this step will be implemented in future iterations.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OBEWorkspace;
