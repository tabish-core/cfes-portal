import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import api from '../../api/axios';
import useToast from '../../hooks/useToast';
import OBEStudentImportModal from '../../components/obe/OBEStudentImportModal';
import Icon from '../../components/common/Icon';
import './OBEWorkspace.css';
import './OBEMarksTable.css';

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
  const { offeringId, courseId: paramCourseId } = useParams();
  const location = useLocation();
  const toast = useToast();
  const isMountedRef = useRef(true);

  const [activeStep, setActiveStep] = useState('setup');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [offering, setOffering] = useState(null);
  const [initError, setInitError] = useState(null);

  const [resolvedCourseId, setResolvedCourseId] = useState(() => {
    if (location.state?.courseId && location.state.courseId !== 'undefined' && location.state.courseId !== 'null') {
      return String(location.state.courseId);
    }
    if (paramCourseId && paramCourseId !== 'undefined' && paramCourseId !== 'null') {
      return String(paramCourseId);
    }
    return null;
  });

  const courseId = resolvedCourseId || (paramCourseId && paramCourseId !== 'undefined' && paramCourseId !== 'null' ? String(paramCourseId) : null);

  const backUrl = offeringId && offeringId !== 'undefined' && offeringId !== 'null'
    ? `/faculty/offering/${offeringId}`
    : (courseId && courseId !== 'undefined' && courseId !== 'null'
      ? `/faculty/course/${courseId}`
      : '/faculty/dashboard');

  // Track component mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Resolve offering context or legacy courseId
  useEffect(() => {
    let active = true;

    const resolveContext = async () => {
      const validOfferingId = offeringId && offeringId !== 'undefined' && offeringId !== 'null' ? offeringId : null;
      const validParamCourseId = paramCourseId && paramCourseId !== 'undefined' && paramCourseId !== 'null' ? paramCourseId : null;

      if (!validOfferingId && !validParamCourseId) {
        if (active) {
          setInitError('Invalid or missing course offering identifier.');
          setLoading(false);
        }
        return;
      }

      if (validOfferingId) {
        try {
          if (active) {
            setLoading(true);
            setInitError(null);
          }
          const { data } = await api.get(`/offerings/${validOfferingId}`);
          const off = data.data?.offering || data.offering;
          if (!active) return;

          if (!off) {
            setInitError('Course offering not found.');
            setLoading(false);
            return;
          }

          setOffering(off);
          const c = off.course;
          const cId = c?._id || c;

          if (!cId) {
            setInitError('Associated course not found for this offering.');
            setLoading(false);
            return;
          }

          if (c && typeof c === 'object') {
            setCourseInfo((prev) => ({
              ...prev,
              courseName: c.courseName || prev.courseName,
              courseCode: c.courseCode || prev.courseCode,
              creditHours: c.creditHours || prev.creditHours,
              type: c.type || prev.type,
            }));
          }

          setResolvedCourseId(String(cId));
        } catch (err) {
          if (!active) return;
          console.error('Failed to load offering details for OBE:', err);
          setInitError(err.response?.data?.message || 'Failed to load course offering details.');
          setLoading(false);
        }
      } else if (validParamCourseId) {
        if (active) {
          setResolvedCourseId(validParamCourseId);
        }
      }
    };

    resolveContext();

    return () => {
      active = false;
    };
  }, [offeringId, paramCourseId]);

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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // --- Assessments State ---
  const [assessments, setAssessments] = useState([]);
  const [assessmentForm, setAssessmentForm] = useState({ category: 'quizzes', title: '' });
  const [componentForms, setComponentForms] = useState({});

  // --- Marks Entry State ---
  const [marksData, setMarksData] = useState({}); // Keyed by studentId_componentId
  const [originalMarks, setOriginalMarks] = useState({});
  const marksTableScrollRef = useRef(null);
  const marksTopScrollRef = useRef(null);
  const isSyncingFromTable = useRef(false);
  const isSyncingFromTop = useRef(false);
  const programmaticScrollTimerRef = useRef(null);
  const [topScrollWidth, setTopScrollWidth] = useState(0);

  // --- Results State ---
  const [resultsData, setResultsData] = useState(null);

  useEffect(() => {
    if (!courseId) return;

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
    // eslint-disable-next-line
  }, [courseId, activeStep]);

  // Synchronize top and bottom horizontal scrollbars for marks table
  useEffect(() => {
    if (activeStep !== 'marks') return;

    const tableEl = marksTableScrollRef.current;
    if (!tableEl) return;

    const updateScrollWidth = () => {
      if (marksTableScrollRef.current) {
        setTopScrollWidth(marksTableScrollRef.current.scrollWidth);
      }
    };

    updateScrollWidth();
    const resizeObserver = new ResizeObserver(() => updateScrollWidth());
    resizeObserver.observe(tableEl);

    return () => {
      resizeObserver.disconnect();
      if (programmaticScrollTimerRef.current) {
        clearTimeout(programmaticScrollTimerRef.current);
      }
    };
  }, [activeStep, assessments, students]);

  const handleTableScroll = (e) => {
    if (isSyncingFromTop.current) return;
    if (marksTopScrollRef.current) {
      isSyncingFromTable.current = true;
      marksTopScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingFromTable.current = false;
      });
    }
  };

  const handleTopScroll = (e) => {
    if (isSyncingFromTable.current) return;
    if (marksTableScrollRef.current) {
      isSyncingFromTop.current = true;
      marksTableScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingFromTop.current = false;
      });
    }
  };

  const handleScrollToCategory = (categoryId) => {
    const tableEl = marksTableScrollRef.current;
    if (!tableEl) return;

    const thEl = tableEl.querySelector(`th[data-category-id="${categoryId}"]`);
    if (!thEl) return;

    const stickyOffset = 334;
    const targetScrollLeft = Math.max(0, thEl.offsetLeft - stickyOffset);

    isSyncingFromTable.current = true;
    isSyncingFromTop.current = true;

    tableEl.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    if (marksTopScrollRef.current) {
      marksTopScrollRef.current.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    }

    if (programmaticScrollTimerRef.current) {
      clearTimeout(programmaticScrollTimerRef.current);
    }
    programmaticScrollTimerRef.current = setTimeout(() => {
      isSyncingFromTable.current = false;
      isSyncingFromTop.current = false;
    }, 450);
  };

  // ==========================================
  // CONFIG LOGIC
  // ==========================================
  const fetchConfig = async () => {
    if (!courseId) {
      if (isMountedRef.current) setLoading(false);
      return;
    }
    try {
      if (isMountedRef.current) setLoading(true);
      const { data } = await api.get(`/obe/${courseId}/config`);
      if (!isMountedRef.current) return;
      const config = data.data;

      if (config.course) {
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
    } catch {
      if (isMountedRef.current) toast.error('Failed to load OBE configuration.');
    } finally {
      if (isMountedRef.current) setLoading(false);
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
    if (!courseId) return toast.error('No course identifier available.');
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
  const fetchStudents = async (silent = false) => {
    if (!courseId) {
      if (isMountedRef.current && !silent) setLoading(false);
      return;
    }
    try {
      if (!silent && isMountedRef.current) setLoading(true);
      const { data } = await api.get(`/obe/${courseId}/students`);
      if (!isMountedRef.current) return;
      setStudents(data.data);
    } catch {
      if (isMountedRef.current) toast.error('Failed to load students.');
    } finally {
      if (!silent && isMountedRef.current) setLoading(false);
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
    } catch {
      toast.error('Failed to remove student.');
    }
  };

  // ==========================================
  // ASSESSMENTS LOGIC
  // ==========================================
  const fetchAssessments = async () => {
    if (!courseId) {
      if (isMountedRef.current) setLoading(false);
      return;
    }
    try {
      if (isMountedRef.current) setLoading(true);
      const { data } = await api.get(`/obe/${courseId}/assessments`);
      if (!isMountedRef.current) return;
      setAssessments(data.data);
      const initialForms = {};
      data.data.forEach(a => {
        initialForms[a._id] = { title: '', maxMarks: '', cloNumber: clos.length > 0 ? clos[0].cloNumber : '' };
      });
      setComponentForms(initialForms);
    } catch {
      if (isMountedRef.current) toast.error('Failed to load assessments.');
    } finally {
      if (isMountedRef.current) setLoading(false);
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
    } catch {
      toast.error('Failed to remove component.');
    }
  };

  // ==========================================
  // MARKS ENTRY LOGIC
  // ==========================================
  const fetchMarksData = async () => {
    if (!courseId) {
      if (isMountedRef.current) setLoading(false);
      return;
    }
    try {
      if (isMountedRef.current) setLoading(true);
      const [studentsRes, assessmentsRes, marksRes] = await Promise.all([
        api.get(`/obe/${courseId}/students`),
        api.get(`/obe/${courseId}/assessments`),
        api.get(`/obe/${courseId}/marks`)
      ]);
      if (!isMountedRef.current) return;
      setStudents(studentsRes.data.data);
      setAssessments(assessmentsRes.data.data);

      const loadedMarks = {};
      marksRes.data.data.forEach(m => {
        loadedMarks[`${m.student}_${m.componentId}`] = m.marks.toString();
      });
      setMarksData(loadedMarks);
      setOriginalMarks({ ...loadedMarks });
    } catch {
      if (isMountedRef.current) toast.error('Failed to load marks data.');
    } finally {
      if (isMountedRef.current) setLoading(false);
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
    if (!courseId) {
      if (isMountedRef.current) setLoading(false);
      return;
    }
    try {
      if (isMountedRef.current) setLoading(true);
      // We also need config for column headers
      const configRes = await api.get(`/obe/${courseId}/config`);
      const res = await api.get(`/obe/${courseId}/results`);
      if (!isMountedRef.current) return;

      setClos(configRes.data.data.clos || []);
      setGas(configRes.data.data.gas || []);
      setResultsData(res.data.data);
    } catch {
      if (isMountedRef.current) toast.error('Failed to load OBE results.');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  // ==========================================
  // RENDERERS
  // ==========================================
  const renderCourseSetup = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Course Information Card */}
      <section className="obe-section-card">
        <div className="obe-section-header">
          <div>
            <h2 className="obe-section-title">Course Information &amp; Policies</h2>
            <p className="obe-section-subtitle">Catalog metadata and synchronization with Course Information Sheet</p>
          </div>
          <button
            type="button"
            onClick={handleSyncFromCIS}
            disabled={syncing || saving}
            className="btn-primary"
            style={{
              padding: '0.45rem 0.95rem',
              fontSize: '0.825rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: '#10b981',
              borderColor: '#059669',
              cursor: (syncing || saving) ? 'not-allowed' : 'pointer'
            }}
          >
            <Icon name="refresh" size={13} />
            <span>{syncing ? 'Syncing...' : 'Sync from CIS'}</span>
          </button>
        </div>

        <div className="obe-grid-info">
          <div className="obe-info-item">
            <span className="obe-info-label">Course Code</span>
            <span className="obe-info-value">{courseInfo.courseCode || '—'}</span>
          </div>
          <div className="obe-info-item">
            <span className="obe-info-label">Course Name</span>
            <span className="obe-info-value">{courseInfo.courseName || '—'}</span>
          </div>
          <div className="obe-info-item">
            <span className="obe-info-label">Credit Hours</span>
            <span className="obe-info-value">{courseInfo.creditHours || '—'}</span>
          </div>
          <div className="obe-info-item">
            <span className="obe-info-label">Course Type</span>
            <span className="obe-info-value">{courseInfo.type || 'Theory'}</span>
          </div>
        </div>
      </section>

      {/* CLO Configuration */}
      <section className="obe-section-card">
        <div className="obe-section-header">
          <div>
            <h2 className="obe-section-title">Course Learning Outcomes (CLOs)</h2>
            <p className="obe-section-subtitle">Define CLO codes and descriptions assessed in this course</p>
          </div>
          <button
            type="button"
            onClick={() => setClos([...clos, { cloNumber: `CLO ${clos.length + 1}`, description: '', active: true }])}
            className="btn-primary"
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.825rem' }}
          >
            + Add CLO
          </button>
        </div>

        {clos.length === 0 ? (
          <p style={{ color: 'var(--cfes-slate-500)', fontSize: '0.875rem', fontStyle: 'italic', margin: 0 }}>
            No CLOs defined yet. Click &ldquo;+ Add CLO&rdquo; or &ldquo;Sync from CIS&rdquo; above.
          </p>
        ) : (
          <div className="obe-config-list">
            {clos.map((clo, idx) => (
              <div key={idx} className="obe-config-row">
                <input
                  type="text"
                  value={clo.cloNumber}
                  onChange={(e) => {
                    const n = [...clos];
                    n[idx].cloNumber = e.target.value;
                    setClos(n);
                  }}
                  placeholder="CLO 1"
                  className="obe-input obe-code-input"
                  aria-label={`CLO ${idx + 1} code`}
                />
                <input
                  type="text"
                  value={clo.description}
                  onChange={(e) => {
                    const n = [...clos];
                    n[idx].description = e.target.value;
                    setClos(n);
                  }}
                  placeholder="Enter CLO outcome statement..."
                  className="obe-input obe-desc-input"
                  aria-label={`CLO ${idx + 1} description`}
                />
                <button
                  type="button"
                  onClick={() => setClos(clos.filter((_, i) => i !== idx))}
                  className="obe-delete-btn"
                  title="Remove CLO"
                  aria-label={`Remove ${clo.cloNumber}`}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* GA Configuration */}
      <section className="obe-section-card">
        <div className="obe-section-header">
          <div>
            <h2 className="obe-section-title">Graduate Attributes (GAs)</h2>
            <p className="obe-section-subtitle">Define Graduate Attributes / PLO targets for accreditation</p>
          </div>
          <button
            type="button"
            onClick={() => setGas([...gas, { gaNumber: `GA ${gas.length + 1}`, description: '', active: true }])}
            className="btn-primary"
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.825rem' }}
          >
            + Add GA
          </button>
        </div>

        {gas.length === 0 ? (
          <p style={{ color: 'var(--cfes-slate-500)', fontSize: '0.875rem', fontStyle: 'italic', margin: 0 }}>
            No GAs defined yet. Click &ldquo;+ Add GA&rdquo; above.
          </p>
        ) : (
          <div className="obe-config-list">
            {gas.map((ga, idx) => (
              <div key={idx} className="obe-config-row">
                <input
                  type="text"
                  value={ga.gaNumber}
                  onChange={(e) => {
                    const n = [...gas];
                    n[idx].gaNumber = e.target.value;
                    setGas(n);
                  }}
                  placeholder="GA 1"
                  className="obe-input obe-code-input"
                  aria-label={`GA ${idx + 1} code`}
                />
                <input
                  type="text"
                  value={ga.description}
                  onChange={(e) => {
                    const n = [...gas];
                    n[idx].description = e.target.value;
                    setGas(n);
                  }}
                  placeholder="Enter Graduate Attribute description..."
                  className="obe-input obe-desc-input"
                  aria-label={`GA ${idx + 1} description`}
                />
                <button
                  type="button"
                  onClick={() => setGas(gas.filter((_, i) => i !== idx))}
                  className="obe-delete-btn"
                  title="Remove GA"
                  aria-label={`Remove ${ga.gaNumber}`}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Assessment Weightages */}
      <section className="obe-section-card">
        <div className="obe-section-header">
          <div>
            <h2 className="obe-section-title">Assessment Weightages (%)</h2>
            <p className="obe-section-subtitle">Must sum to exactly 100% across all four assessment categories</p>
          </div>
        </div>
        <div className="obe-grid-4">
          {['quizzes', 'assignments', 'midTerm', 'finalExam'].map(field => (
            <div key={field} className="obe-form-group">
              <label htmlFor={`obe-weight-${field}`} className="obe-label">
                {field.replace(/([A-Z])/g, ' $1').trim()} (%)
              </label>
              <input
                id={`obe-weight-${field}`}
                type="number"
                value={assessmentsConfig[field]}
                onChange={(e) => setAssessmentsConfig({ ...assessmentsConfig, [field]: Number(e.target.value) })}
                className="obe-input"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Grade Boundaries */}
      <section className="obe-section-card">
        <div className="obe-section-header">
          <div>
            <h2 className="obe-section-title">Grade Boundaries</h2>
            <p className="obe-section-subtitle">Minimum percentage cutoffs for institutional letter grades</p>
          </div>
        </div>
        <div className="obe-grid-6">
          {[{ key: 'A', label: 'A (>=)' }, { key: 'BPlus', label: 'B+ (>=)' }, { key: 'B', label: 'B (>=)' }, { key: 'CPlus', label: 'C+ (>=)' }, { key: 'C', label: 'C (>=)' }, { key: 'F', label: 'F (<)' }].map(f => (
            <div key={f.key} className="obe-form-group">
              <label htmlFor={`obe-grade-${f.key}`} className="obe-label">{f.label}</label>
              <input
                id={`obe-grade-${f.key}`}
                type="number"
                value={grades[f.key]}
                onChange={(e) => setGrades({ ...grades, [f.key]: Number(e.target.value) })}
                className="obe-input"
              />
            </div>
          ))}
        </div>
      </section>

      {/* KPI Settings */}
      <section className="obe-section-card">
        <div className="obe-section-header">
          <div>
            <h2 className="obe-section-title">KPI Settings</h2>
            <p className="obe-section-subtitle">Institutional passing threshold percentage for CLO and GA attainments</p>
          </div>
        </div>
        <div className="obe-grid-4">
          <div className="obe-form-group">
            <label htmlFor="obe-kpi-threshold" className="obe-label">Course KPI Threshold (%)</label>
            <input
              id="obe-kpi-threshold"
              type="number"
              min="0"
              max="100"
              value={kpiThreshold}
              onChange={(e) => setKpiThreshold(Number(e.target.value))}
              className="obe-input"
            />
          </div>
        </div>
      </section>

      {/* Save Action */}
      <div className="obe-action-bar">
        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={saving}
          className="btn-primary"
          style={{ padding: '0.65rem 1.75rem', fontSize: '0.9rem' }}
        >
          {saving ? 'Saving Configuration...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );

  const renderMapping = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <section className="obe-section-card">
        <div className="obe-section-header">
          <div>
            <h2 className="obe-section-title">CLO → GA Mapping Matrix</h2>
            <p className="obe-section-subtitle">Map Course Learning Outcomes to target Graduate Attributes</p>
          </div>
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={saving}
            className="btn-primary"
            style={{ padding: '0.55rem 1.4rem', fontSize: '0.85rem' }}
          >
            {saving ? 'Saving...' : 'Save Mapping'}
          </button>
        </div>

        {clos.length === 0 || gas.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', background: 'var(--cfes-slate-50)', borderRadius: 'var(--cfes-radius-md)', border: '1px dashed var(--cfes-slate-300)' }}>
            <p style={{ color: 'var(--cfes-slate-500)', margin: 0, fontSize: '0.9rem' }}>
              Please define at least one CLO and one GA in Course Setup first.
            </p>
          </div>
        ) : (
          <div className="obe-table-wrapper">
            <table className="obe-table" style={{ minWidth: '600px' }}>
              <thead>
                <tr>
                  <th style={{ width: '140px', borderRight: '1px solid var(--cfes-slate-300)' }}>CLO \ GA</th>
                  {gas.map(g => (
                    <th key={g.gaNumber} style={{ textAlign: 'center', borderRight: '1px solid var(--cfes-slate-200)' }}>
                      {g.gaNumber}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clos.map((clo) => {
                  const cloMap = cloGaMapping.find(m => m.cloNumber === clo.cloNumber) || { mappedGAs: [] };
                  return (
                    <tr key={clo.cloNumber}>
                      <td style={{ fontWeight: 700, color: 'var(--cfes-slate-800)', borderRight: '1px solid var(--cfes-slate-200)' }}>
                        {clo.cloNumber}
                      </td>
                      {gas.map(g => (
                        <td key={g.gaNumber} style={{ textAlign: 'center', borderRight: '1px solid var(--cfes-slate-200)' }}>
                          <input
                            type="checkbox"
                            checked={cloMap.mappedGAs.includes(g.gaNumber)}
                            onChange={() => {
                              let mapping = [...cloGaMapping];
                              let cm = mapping.find(m => m.cloNumber === clo.cloNumber);
                              if (!cm) { cm = { cloNumber: clo.cloNumber, mappedGAs: [] }; mapping.push(cm); }
                              if (cm.mappedGAs.includes(g.gaNumber)) cm.mappedGAs = cm.mappedGAs.filter(ga => ga !== g.gaNumber);
                              else cm.mappedGAs.push(g.gaNumber);
                              setCloGaMapping(mapping);
                            }}
                            style={{ cursor: 'pointer', width: '1.1rem', height: '1.1rem', accentColor: 'var(--cfes-navy-800)' }}
                            aria-label={`Map ${clo.cloNumber} to ${g.gaNumber}`}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );

  const renderStudents = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <section className="obe-section-card">
        <div className="obe-section-header">
          <div>
            <h2 className="obe-section-title">Student Roster</h2>
            <p className="obe-section-subtitle">Manage enrolled students for OBE assessment and award lists</p>
          </div>
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 1rem',
              fontSize: '0.85rem'
            }}
          >
            <Icon name="document" size={14} />
            <span>Import from Excel</span>
          </button>
        </div>

        <form onSubmit={handleAddStudent} className="obe-add-student-form">
          <input
            type="text"
            placeholder="Registration No (e.g. 01-134211-001)"
            value={studentForm.registrationNo}
            onChange={e => setStudentForm({ ...studentForm, registrationNo: e.target.value })}
            className="obe-input"
            style={{ flex: 1, minWidth: '180px' }}
            aria-label="Student Registration Number"
          />
          <input
            type="text"
            placeholder="Student Full Name"
            value={studentForm.studentName}
            onChange={e => setStudentForm({ ...studentForm, studentName: e.target.value })}
            className="obe-input"
            style={{ flex: 2, minWidth: '220px' }}
            aria-label="Student Full Name"
          />
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
            style={{ padding: '0.55rem 1.25rem', whiteSpace: 'nowrap' }}
          >
            + Add Student
          </button>
        </form>

        {students.length === 0 ? (
          <p style={{ color: 'var(--cfes-slate-500)', fontSize: '0.875rem', fontStyle: 'italic', margin: '1rem 0 0 0' }}>
            No students enrolled yet. Add students using the form above or import an Excel roster.
          </p>
        ) : (
          <div className="obe-table-wrapper">
            <table className="obe-table">
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}>S/No</th>
                  <th style={{ width: '200px' }}>Registration No</th>
                  <th>Student Name</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => (
                  <tr key={student._id}>
                    <td style={{ textAlign: 'center', color: 'var(--cfes-slate-500)', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600, fontFamily: 'var(--cfes-font-mono)' }}>{student.registrationNo}</td>
                    <td style={{ color: 'var(--cfes-slate-800)' }}>{student.studentName}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ padding: '0.2rem 0.55rem', background: 'var(--cfes-status-success-bg)', color: 'var(--cfes-status-success-text)', border: '1px solid var(--cfes-status-success-border)', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Active
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteStudent(student._id)}
                        className="obe-delete-btn"
                        title="Remove Student"
                        aria-label={`Remove ${student.studentName}`}
                      >
                        <Icon name="close" size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );

  const renderAssessments = () => {
    const categories = [
      { id: 'quizzes', label: 'QUIZZES' },
      { id: 'assignments', label: 'ASSIGNMENTS / CCP' },
      { id: 'midTerm', label: 'MID TERM' },
      { id: 'finalExam', label: 'FINAL EXAM' }
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <section className="obe-section-card">
          <div className="obe-section-header">
            <div>
              <h2 className="obe-section-title">Assessment Structure</h2>
              <p className="obe-section-subtitle">Define assessment titles and constituent question components mapped to CLOs</p>
            </div>
          </div>

          <form onSubmit={handleAddAssessment} className="obe-add-student-form">
            <select
              value={assessmentForm.category}
              onChange={e => setAssessmentForm({ ...assessmentForm, category: e.target.value })}
              className="obe-select"
              style={{ flex: 1, minWidth: '160px' }}
              aria-label="Assessment Category"
            >
              <option value="quizzes">Quizzes</option>
              <option value="assignments">Assignments / CCP</option>
            </select>
            <input
              type="text"
              placeholder="Assessment Title (e.g. Quiz 1, Assignment 1)"
              value={assessmentForm.title}
              onChange={e => setAssessmentForm({ ...assessmentForm, title: e.target.value })}
              className="obe-input"
              style={{ flex: 2, minWidth: '220px' }}
              aria-label="Assessment Title"
            />
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              style={{ padding: '0.55rem 1.25rem', whiteSpace: 'nowrap' }}
            >
              + Add Assessment
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
            {categories.map(cat => {
              const catAssessments = assessments.filter(a => a.category === cat.id).sort((a, b) => a.order - b.order);

              return (
                <div key={cat.id} style={{ border: '1px solid var(--cfes-slate-200)', borderRadius: 'var(--cfes-radius-md)', padding: '1rem', backgroundColor: 'var(--cfes-white)' }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: 'var(--cfes-slate-800)', borderBottom: '2px solid var(--cfes-slate-200)', paddingBottom: '0.4rem', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.04em' }}>
                    {cat.label} ({catAssessments.length})
                  </h3>

                  {catAssessments.length === 0 ? (
                    <p style={{ color: 'var(--cfes-slate-400)', fontSize: '0.85rem', fontStyle: 'italic', margin: 0 }}>
                      No assessments in this category.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {catAssessments.map(a => {
                        const activeComponents = a.components ? a.components.filter(c => c.active) : [];
                        return (
                          <div key={a._id} style={{ border: '1px solid var(--cfes-slate-200)', borderRadius: 'var(--cfes-radius-md)', padding: '0.85rem', backgroundColor: 'var(--cfes-slate-50)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--cfes-slate-900)', fontWeight: 600 }}>
                                {a.title}
                              </h4>
                              {cat.id !== 'midTerm' && cat.id !== 'finalExam' && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAssessment(a._id)}
                                  className="obe-delete-btn"
                                  style={{ color: 'var(--cfes-status-danger-solid)', fontSize: '0.8rem', fontWeight: 600 }}
                                >
                                  Delete Assessment
                                </button>
                              )}
                            </div>

                            <div className="obe-table-wrapper" style={{ marginBottom: '0.75rem' }}>
                              <table className="obe-table">
                                <thead>
                                  <tr>
                                    <th style={{ width: '120px' }}>Component</th>
                                    <th>Title (Optional)</th>
                                    <th style={{ width: '120px', textAlign: 'center' }}>Max Marks</th>
                                    <th style={{ width: '100px', textAlign: 'center' }}>CLO</th>
                                    <th style={{ width: '80px', textAlign: 'right' }}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {activeComponents.length === 0 ? (
                                    <tr>
                                      <td colSpan="5" style={{ padding: '0.85rem', textAlign: 'center', color: 'var(--cfes-slate-400)', fontStyle: 'italic' }}>
                                        No components added yet. Add a question or part below.
                                      </td>
                                    </tr>
                                  ) : (
                                    activeComponents.map(c => (
                                      <tr key={c._id}>
                                        <td style={{ fontWeight: 600 }}>{c.componentNumber}</td>
                                        <td>{c.title || '—'}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{c.maxMarks}</td>
                                        <td style={{ textAlign: 'center', color: 'var(--cfes-navy-700)', fontWeight: 600 }}>{c.cloNumber}</td>
                                        <td style={{ textAlign: 'right' }}>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteComponent(a._id, c._id)}
                                            className="obe-delete-btn"
                                            title="Remove Component"
                                          >
                                            <Icon name="close" size={15} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {componentForms[a._id] && clos.length > 0 && (
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <input
                                  type="text"
                                  placeholder="Component Title (Opt)"
                                  value={componentForms[a._id].title}
                                  onChange={e => handleComponentFormChange(a._id, 'title', e.target.value)}
                                  className="obe-input"
                                  style={{ flex: 1, minWidth: '140px' }}
                                  aria-label="Component Title"
                                />
                                <input
                                  type="number"
                                  placeholder="Max Marks"
                                  value={componentForms[a._id].maxMarks}
                                  onChange={e => handleComponentFormChange(a._id, 'maxMarks', e.target.value)}
                                  className="obe-input"
                                  style={{ width: '100px' }}
                                  aria-label="Max Marks"
                                />
                                <select
                                  value={componentForms[a._id].cloNumber}
                                  onChange={e => handleComponentFormChange(a._id, 'cloNumber', e.target.value)}
                                  className="obe-select"
                                  style={{ width: '110px' }}
                                  aria-label="Select CLO"
                                >
                                  {clos.filter(c => c.active).map(c => <option key={c.cloNumber} value={c.cloNumber}>{c.cloNumber}</option>)}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleAddComponent(a._id)}
                                  disabled={saving}
                                  className="btn-primary"
                                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                                >
                                  + Add Component
                                </button>
                              </div>
                            )}

                            {clos.length === 0 && (
                              <p style={{ color: 'var(--cfes-status-danger-solid)', fontSize: '0.8rem', margin: '0.5rem 0 0 0' }}>
                                Please define CLOs in Course Setup before adding components.
                              </p>
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
        </section>
      </div>
    );
  };

  const renderMarksEntry = () => {
    const categories = [
      { id: 'quizzes', label: 'QUIZZES' },
      { id: 'assignments', label: 'ASSIGNMENTS & CCP' },
      { id: 'midTerm', label: 'MID TERM' },
      { id: 'finalExam', label: 'FINAL EXAM' }
    ];
    const activeComponents = [];
    categories.forEach(cat => {
      assessments
        .filter(a => a.category === cat.id)
        .sort((a, b) => a.order - b.order)
        .forEach(a => {
          if (a.components) {
            a.components
              .filter(c => c.active)
              .forEach(c =>
                activeComponents.push({
                  categoryId: cat.id,
                  categoryLabel: cat.label,
                  componentId: c._id,
                  componentNumber: c.componentNumber,
                  maxMarks: c.maxMarks
                })
              );
          }
        });
    });

    if (activeComponents.length === 0 || students.length === 0) {
      return (
        <div className="obe-section-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--cfes-slate-500)', margin: 0, fontSize: '0.95rem' }}>
            Please define Assessment Components and Students first to begin marks entry.
          </p>
        </div>
      );
    }

    const headers = [];
    let currentCat = null;
    let count = 0;
    activeComponents.forEach((comp, idx) => {
      if (comp.categoryId !== currentCat) {
        if (currentCat !== null) {
          headers.push({
            id: currentCat,
            label: categories.find(c => c.id === currentCat).label,
            span: count
          });
        }
        currentCat = comp.categoryId;
        count = 1;
      } else {
        count++;
      }
      if (idx === activeComponents.length - 1) {
        headers.push({
          id: currentCat,
          label: categories.find(c => c.id === currentCat).label,
          span: count
        });
      }
    });

    return (
      <div className="obe-marks-wrapper">
        <div className="obe-marks-header-row">
          <div>
            <h2 className="obe-section-title" style={{ margin: 0 }}>Marks Entry Table</h2>
            <p className="obe-section-subtitle">Real-time student assessment score entry with auto-synchronized viewports</p>
          </div>
          <button
            type="button"
            onClick={handleSaveMarks}
            disabled={saving}
            className="btn-primary"
            style={{ padding: '0.55rem 1.4rem', fontSize: '0.875rem' }}
          >
            {saving ? 'Saving...' : 'Save Marks'}
          </button>
        </div>

        {/* Navigation & Jump Bar */}
        <div className="obe-marks-nav-bar">
          <div className="obe-marks-jump-group">
            <span className="obe-marks-jump-label">Jump to:</span>
            {headers.map(h => (
              <button
                key={h.id}
                type="button"
                className="obe-jump-pill"
                onClick={() => handleScrollToCategory(h.id)}
                title={`Scroll to ${h.label}`}
              >
                {h.label} ({h.span})
              </button>
            ))}
          </div>
          <div className="obe-marks-counter">
            <span><strong>{students.length}</strong> Students</span>
            <span style={{ margin: '0 0.35rem' }}>&bull;</span>
            <span><strong>{activeComponents.length}</strong> Components</span>
          </div>
        </div>

        {/* Synchronized Top Horizontal Scrollbar */}
        {topScrollWidth > 0 && (
          <div
            ref={marksTopScrollRef}
            onScroll={handleTopScroll}
            className="obe-top-scrollbar-track"
            title="Horizontal scrollbar"
          >
            <div
              className="obe-top-scrollbar-thumb"
              style={{ width: `${topScrollWidth}px` }}
            />
          </div>
        )}

        {/* Table Viewport with Sticky Header & Sticky Student Identity Columns */}
        <div
          ref={marksTableScrollRef}
          onScroll={handleTableScroll}
          className="obe-marks-table-viewport"
        >
          <table className="obe-marks-table">
            <thead>
              <tr>
                <th colSpan="3" className="col-sticky-student-header">Student Information</th>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    data-category-id={h.id}
                    colSpan={h.span}
                    className="obe-category-header"
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="col-sticky-sno">S/No</th>
                <th className="col-sticky-reg">Reg No</th>
                <th className="col-sticky-name">Student Name</th>
                {activeComponents.map((comp, i) => {
                  const isCategoryEnd = i < activeComponents.length - 1 && activeComponents[i + 1].categoryId !== comp.categoryId;
                  return (
                    <th
                      key={comp.componentId}
                      className={`obe-component-header ${isCategoryEnd ? 'category-divider' : ''}`}
                    >
                      <div className="obe-comp-title">{comp.componentNumber}</div>
                      <div className="obe-comp-max">/ {comp.maxMarks}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {students.map((student, sIdx) => (
                <tr
                  key={student._id}
                  className={`obe-marks-row ${sIdx % 2 === 1 ? 'row-alt' : ''}`}
                >
                  <td className="col-sticky-sno">{sIdx + 1}</td>
                  <td className="col-sticky-reg">{student.registrationNo}</td>
                  <td className="col-sticky-name" title={student.studentName}>
                    {student.studentName}
                  </td>
                  {activeComponents.map((comp, i) => {
                    const key = `${student._id}_${comp.componentId}`;
                    const val = marksData[key] !== undefined ? marksData[key] : '';
                    const isError = val !== '' && (isNaN(Number(val)) || Number(val) < 0 || Number(val) > comp.maxMarks);
                    const isCategoryEnd = i < activeComponents.length - 1 && activeComponents[i + 1].categoryId !== comp.categoryId;
                    return (
                      <td
                        key={comp.componentId}
                        className={`obe-mark-cell ${isCategoryEnd ? 'category-divider' : ''}`}
                      >
                        <input
                          type="text"
                          value={val}
                          onChange={e => handleMarkChange(student._id, comp.componentId, e.target.value)}
                          className={`obe-mark-input ${isError ? 'input-error' : ''}`}
                          title={isError ? `Must be between 0 and ${comp.maxMarks}` : undefined}
                          aria-label={`Mark for ${student.studentName} ${comp.componentNumber}`}
                        />
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
    if (resultsData.students.length === 0) {
      return (
        <div className="obe-section-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--cfes-slate-500)', margin: 0 }}>No student marks found for results computation.</p>
        </div>
      );
    }

    const activeClos = clos.filter(c => c.active);
    const activeGas = gas.filter(g => g.active);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <section className="obe-section-card">
          <div className="obe-section-header">
            <div>
              <h2 className="obe-section-title">Student OBE Results Matrix</h2>
              <p className="obe-section-subtitle">Overall percentage, letter grades, CLO attainment percentages, and GA achievement</p>
            </div>
          </div>

          <div
            className="cfes-table-scroll-container"
            tabIndex={0}
            aria-label="Student OBE results matrix table"
            style={{
              overflowX: 'auto',
              width: '100%',
              maxWidth: '100%',
              WebkitOverflowScrolling: 'touch',
              border: '1px solid var(--cfes-slate-200)',
              borderRadius: 'var(--cfes-radius-md)',
            }}
          >
            <table className="obe-table" style={{ minWidth: '1200px' }}>
              <thead>
                <tr style={{ background: 'var(--cfes-slate-100)', borderBottom: '1px solid var(--cfes-slate-300)' }}>
                  <th colSpan="3" style={{ borderRight: '2px solid var(--cfes-slate-300)' }}>Student Information</th>
                  <th colSpan="3" style={{ borderRight: '2px solid var(--cfes-slate-300)', textAlign: 'center' }}>Course Performance</th>
                  {activeClos.length > 0 && <th colSpan={activeClos.length} style={{ borderRight: '2px solid var(--cfes-slate-300)', textAlign: 'center' }}>CLO Attainment (%)</th>}
                  {activeGas.length > 0 && <th colSpan={activeGas.length} style={{ borderRight: '2px solid var(--cfes-slate-300)', textAlign: 'center' }}>GA Attained (Y/N)</th>}
                </tr>
                <tr style={{ background: 'var(--cfes-slate-50)', borderBottom: '2px solid var(--cfes-slate-300)', fontSize: '0.8rem' }}>
                  <th style={{ width: '45px', textAlign: 'center', borderRight: '1px solid var(--cfes-slate-200)' }}>S/No</th>
                  <th style={{ width: '130px', borderRight: '1px solid var(--cfes-slate-200)' }}>Reg No</th>
                  <th style={{ borderRight: '2px solid var(--cfes-slate-300)' }}>Student Name</th>

                  <th style={{ width: '90px', textAlign: 'center', borderRight: '1px solid var(--cfes-slate-200)' }}>Sessionals</th>
                  <th style={{ width: '90px', textAlign: 'center', borderRight: '1px solid var(--cfes-slate-200)' }}>Overall %</th>
                  <th style={{ width: '70px', textAlign: 'center', borderRight: '2px solid var(--cfes-slate-300)' }}>Grade</th>

                  {activeClos.map((c, i) => (
                    <th key={c.cloNumber} style={{ width: '75px', textAlign: 'center', borderRight: i === activeClos.length - 1 ? '2px solid var(--cfes-slate-300)' : '1px solid var(--cfes-slate-200)' }}>
                      {c.cloNumber}
                    </th>
                  ))}

                  {activeGas.map((g, i) => (
                    <th key={g.gaNumber} style={{ width: '75px', textAlign: 'center', borderRight: i === activeGas.length - 1 ? '2px solid var(--cfes-slate-300)' : '1px solid var(--cfes-slate-200)' }}>
                      {g.gaNumber}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultsData.students.map((student, idx) => (
                  <tr key={student.studentId}>
                    <td style={{ textAlign: 'center', borderRight: '1px solid var(--cfes-slate-200)', color: 'var(--cfes-slate-500)', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ borderRight: '1px solid var(--cfes-slate-200)', fontWeight: 600, fontFamily: 'var(--cfes-font-mono)' }}>{student.registrationNo}</td>
                    <td style={{ borderRight: '2px solid var(--cfes-slate-300)', fontWeight: 500 }}>{student.studentName}</td>

                    <td style={{ borderRight: '1px solid var(--cfes-slate-200)', textAlign: 'center', fontWeight: 600 }}>{student.sessionals}</td>
                    <td style={{ borderRight: '1px solid var(--cfes-slate-200)', textAlign: 'center', fontWeight: 600 }}>{student.overallPercentage}%</td>
                    <td style={{ borderRight: '2px solid var(--cfes-slate-300)', textAlign: 'center', fontWeight: 700, color: student.grade === 'F' ? 'var(--cfes-status-danger-solid)' : 'var(--cfes-status-success-solid)' }}>
                      {student.grade}
                    </td>

                    {activeClos.map((c, i) => {
                      const cloRes = student.clos.find(x => x.cloNumber === c.cloNumber);
                      const val = cloRes?.percentage !== null ? `${cloRes.percentage}%` : '—';
                      const color = cloRes?.status === 'complete' ? (cloRes.attained ? 'var(--cfes-status-success-solid)' : 'var(--cfes-status-danger-solid)') : 'var(--cfes-slate-400)';
                      return (
                        <td key={c.cloNumber} style={{ borderRight: i === activeClos.length - 1 ? '2px solid var(--cfes-slate-300)' : '1px solid var(--cfes-slate-200)', textAlign: 'center', color, fontWeight: 600 }}>
                          {val}
                        </td>
                      );
                    })}

                    {activeGas.map((g, i) => {
                      const gaRes = student.gas.find(x => x.gaNumber === g.gaNumber);
                      const val = gaRes?.attained === true ? 'Y' : gaRes?.attained === false ? 'N' : '—';
                      const color = val === 'Y' ? 'var(--cfes-status-success-solid)' : val === 'N' ? 'var(--cfes-status-danger-solid)' : 'var(--cfes-slate-400)';
                      return (
                        <td key={g.gaNumber} style={{ borderRight: i === activeGas.length - 1 ? '2px solid var(--cfes-slate-300)' : '1px solid var(--cfes-slate-200)', textAlign: 'center', color, fontWeight: 700 }}>
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Passing Summary Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          <section className="obe-section-card">
            <h3 className="obe-section-title" style={{ marginBottom: '0.75rem' }}>Percentage of Students Passing CLO</h3>
            <div className="obe-table-wrapper">
              <table className="obe-table">
                <thead>
                  <tr>
                    <th>CLO Number</th>
                    <th style={{ textAlign: 'right' }}>Passing %</th>
                  </tr>
                </thead>
                <tbody>
                  {resultsData.courseCLOPassing.map(c => (
                    <tr key={c.cloNumber}>
                      <td style={{ fontWeight: 600 }}>{c.cloNumber}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: c.percentage >= 50 ? 'var(--cfes-status-success-solid)' : (c.percentage === null ? 'var(--cfes-slate-400)' : 'var(--cfes-status-danger-solid)') }}>
                        {c.percentage !== null ? `${c.percentage}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="obe-section-card">
            <h3 className="obe-section-title" style={{ marginBottom: '0.75rem' }}>Percentage of Students Passing GA</h3>
            <div className="obe-table-wrapper">
              <table className="obe-table">
                <thead>
                  <tr>
                    <th>GA Number</th>
                    <th style={{ textAlign: 'right' }}>Passing %</th>
                  </tr>
                </thead>
                <tbody>
                  {resultsData.courseGAPassing.map(g => (
                    <tr key={g.gaNumber}>
                      <td style={{ fontWeight: 600 }}>{g.gaNumber}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: g.percentage >= 50 ? 'var(--cfes-status-success-solid)' : (g.percentage === null ? 'var(--cfes-slate-400)' : 'var(--cfes-status-danger-solid)') }}>
                        {g.percentage !== null ? `${g.percentage}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    );
  };

  return (
    <div className="obe-workspace-container">
      {/* ── Top Header Bar ── */}
      <div className="obe-header-container">
        <div className="obe-header-left">
          <Link to={backUrl} className="obe-back-link" aria-label="Back to Course Offering">
            <Icon name="chevron-left" size={14} />
            <span>Back to Course</span>
          </Link>
          <div className="obe-title-wrap">
            <h1 className="obe-heading">OBE Workspace</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--cfes-slate-600)', fontWeight: 600 }}>
                {courseInfo.courseCode} — {courseInfo.courseName}
              </span>
              {offering && (
                <span className="obe-context-badge">
                  <Icon name="book" size={12} />
                  <span>
                    {offering.semester?.name ? `${offering.semester.name} • ` : ''}Sec {offering.section || 'A'}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Workspace Layout ── */}
      <div className="obe-workspace-layout">
        <nav className="obe-sidebar-nav" aria-label="OBE Workflow Steps">
          <div className="obe-sidebar-label">Workflow Steps</div>
          {WORKFLOW_STEPS.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStep(step.id)}
              className={`obe-step-btn ${activeStep === step.id ? 'obe-step-btn--active' : ''}`}
            >
              <span>{step.label}</span>
              {activeStep === step.id && <Icon name="chevron-right" size={12} />}
            </button>
          ))}
        </nav>

        <main className={`obe-content-area ${activeStep === 'marks' ? 'obe-content-area--marks' : ''}`}>
          {initError ? (
            <div style={{ backgroundColor: 'var(--cfes-white)', borderRadius: 'var(--cfes-radius-lg)', padding: '3rem', textAlign: 'center', border: '1px solid var(--cfes-status-danger-border)' }}>
              <div style={{ color: 'var(--cfes-status-danger-solid)', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                Failed to load OBE Workspace
              </div>
              <p style={{ color: 'var(--cfes-slate-600)', maxWidth: '450px', margin: '0 auto 1.5rem auto', lineHeight: '1.5', fontSize: '0.9rem' }}>
                {initError}
              </p>
              <Link to={backUrl} className="btn-primary" style={{ display: 'inline-block', padding: '0.6rem 1.5rem', textDecoration: 'none' }}>
                Return to Course Checklist
              </Link>
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--cfes-slate-500)', fontStyle: 'italic' }}>
              Loading OBE data...
            </div>
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
            <section className="obe-section-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
              <h2 className="obe-section-title" style={{ fontSize: '1.3rem', marginBottom: '0.75rem' }}>
                Export OBE Award List Workbook
              </h2>
              <p style={{ color: 'var(--cfes-slate-600)', maxWidth: '520px', margin: '0 auto 2rem auto', lineHeight: '1.6', fontSize: '0.9rem' }}>
                Generate the official OBE Excel Award List containing student marks, course attainment percentages,
                and accredited CLO/GA summaries for accreditation records.
              </p>
              <button
                type="button"
                onClick={async () => {
                  if (!courseId) return toast.error('No course identifier available.');
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
                  } catch {
                    toast.error('Failed to export Excel workbook.');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving || loading}
                className="btn-primary"
                style={{ padding: '0.75rem 2.5rem', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Icon name="document" size={16} />
                <span>{saving ? 'Generating Workbook...' : 'Download OBE Award List (Excel)'}</span>
              </button>
            </section>
          ) : (
            <div style={{ backgroundColor: 'var(--cfes-slate-50)', border: '1px dashed var(--cfes-slate-300)', borderRadius: 'var(--cfes-radius-md)', padding: '3rem', textAlign: 'center' }}>
              <h2 style={{ color: 'var(--cfes-slate-800)', marginBottom: '0.75rem', fontSize: '1.25rem' }}>
                {WORKFLOW_STEPS.find(s => s.id === activeStep)?.label}
              </h2>
              <p style={{ color: 'var(--cfes-slate-500)', maxWidth: '420px', margin: '0 auto', lineHeight: '1.5', fontSize: '0.875rem' }}>
                This section is part of the OBE module foundation. Functionality for this step will be implemented in future iterations.
              </p>
            </div>
          )}
        </main>
      </div>

      <OBEStudentImportModal
        courseId={courseId}
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => fetchStudents(true)}
        currentStudents={students}
      />
    </div>
  );
};

export default OBEWorkspace;
