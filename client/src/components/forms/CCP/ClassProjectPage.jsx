import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import useToast from '../../../hooks/useToast';
import AssignmentInfoSection from './AssignmentInfoSection';
import MappingSection from './MappingSection';
import ProblemStatementSection from './ProblemStatementSection';
import DeliverablesSection from './DeliverablesSection';
import WPAttributesTable from './WPAttributesTable';

/* ── Default Initial Constants ────────────────────────────── */

const INITIAL_HEADER_INFO = {
  department: '',
  program: '',
  courseTitle: '',
  courseCode: '',
  announcedDate: '',
  dueDate: '',
  totalMarks: '',
};

const INITIAL_MAPPING_TABLE = {
  mappedClo: '',
  sdg: '',
  knowledgeProfile: '',
  complexProblemSolvingMapped: '',
};

const DEFAULT_DELIVERABLE_ITEMS = [
  { label: 'Introduction', required: true, completed: false },
  { label: 'Literature review (discuss two models)', required: true, completed: false },
  { label: 'Designed model', required: true, completed: false },
  { label: 'Methodology', required: true, completed: false },
  { label: 'Result and Discussion', required: true, completed: false },
  { label: 'References', required: true, completed: false },
];

const DEFAULT_WP_ATTRIBUTES = [
  {
    code: 'WP1',
    title: 'Range of Conflicting Requirements',
    description: 'Involve wide-ranging or conflicting technical, engineering and other issues.',
    isMapped: false,
    justification: '',
  },
  {
    code: 'WP2',
    title: 'Depth of Analysis required',
    description: 'Have no obvious solution and require abstract thinking, originality in analysis to formulate suitable models.',
    isMapped: false,
    justification: '',
  },
  {
    code: 'WP3',
    title: 'Depth of Knowledge required',
    description: 'Requires research-based knowledge much of which is at, or informed by, the forefront of the academic discipline.',
    isMapped: false,
    justification: '',
  },
  {
    code: 'WP4',
    title: 'Familiarity of issues',
    description: 'Involve infrequently encountered issues.',
    isMapped: false,
    justification: '',
  },
  {
    code: 'WP5',
    title: 'Extent of applicable codes',
    description: 'Are outside problems encompassed by standards and codes of practice for professional engineering/computing.',
    isMapped: false,
    justification: '',
  },
  {
    code: 'WP6',
    title: 'Extent of stakeholder involvement and level of conflicting requirements.',
    description: 'Involve diverse groups of stakeholders with widely varying needs.',
    isMapped: false,
    justification: '',
  },
  {
    code: 'WP7',
    title: 'Consequences',
    description: 'Have significant consequences in a range of contexts, characterized by serious problems with respect to health and safety, society, politics, business, etc.',
    isMapped: false,
    justification: '',
  },
  {
    code: 'WP8',
    title: 'Interdependence',
    description: 'Are high level problems including many component parts or sub-problems.',
    isMapped: false,
    justification: '',
  },
];

/* ── Main CCP / Class Project Form Component ──────────────── */

const ClassProjectPage = ({ courseId, offeringId }) => {
  const toast = useToast();

  const [headerInfo, setHeaderInfo] = useState(INITIAL_HEADER_INFO);
  const [mappingTable, setMappingTable] = useState(INITIAL_MAPPING_TABLE);
  const [problemStatement, setProblemStatement] = useState('');
  const [constraintsAssumptions, setConstraintsAssumptions] = useState('');
  const [computationalTools, setComputationalTools] = useState('');
  const [expectedOutcomes, setExpectedOutcomes] = useState('');
  const [deliverables, setDeliverables] = useState({
    heading: 'Report (must include)',
    items: DEFAULT_DELIVERABLE_ITEMS.map((item) => ({ ...item })),
  });
  const [wpAttributes, setWpAttributes] = useState(
    DEFAULT_WP_ATTRIBUTES.map((attr) => ({ ...attr }))
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(''); // '' | 'docx' | 'pdf'
  const [validationErrors, setValidationErrors] = useState([]);

  const handleDownload = async (format) => {
    try {
      setIsExporting(format);
      const exportUrl = offeringId
        ? `/forms/ccp/${courseId || 'offering'}/export?format=${format}&offeringId=${offeringId}`
        : `/forms/ccp/${courseId}/export?format=${format}`;
      const res = await api.get(exportUrl, {
        responseType: 'blob',
      });


      // Extract filename from header or fallback
      let filename = `CCP_Class_Project_${headerInfo?.courseCode || 'Course'}.${format}`;
      const disposition = res.headers && res.headers['content-disposition'];
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();

      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} exported successfully!`);
    } catch (err) {
      console.error(`Failed to export ${format}:`, err);
      toast.error(`Failed to export ${format.toUpperCase()}. Please save the form first.`);
    } finally {
      setIsExporting('');
    }
  };

  /* ── Load Saved Data or Default Course Info ─────────────── */
  useEffect(() => {
    let isCancelled = false;

    const fetchCCP = async () => {
      if (!courseId && !offeringId) return;

      try {
        setIsLoading(true);
        const url = offeringId
          ? `/forms/ccp/${courseId || 'offering'}?offeringId=${offeringId}`
          : `/forms/ccp/${courseId}`;
        const res = await api.get(url);

        if (isCancelled) return;

        if (res.data?.data?.form) {
          const f = res.data.data.form;
          if (f.headerInfo) setHeaderInfo(f.headerInfo);
          if (f.mappingTable) setMappingTable(f.mappingTable);
          if (f.problemStatement !== undefined) setProblemStatement(f.problemStatement);
          if (f.constraintsAssumptions !== undefined) setConstraintsAssumptions(f.constraintsAssumptions);
          if (f.computationalTools !== undefined) setComputationalTools(f.computationalTools);
          if (f.expectedOutcomes !== undefined) setExpectedOutcomes(f.expectedOutcomes);
          if (f.deliverables) {
            setDeliverables({
              heading: f.deliverables.heading || 'Report (must include)',
              items: f.deliverables.items?.length
                ? f.deliverables.items
                : DEFAULT_DELIVERABLE_ITEMS.map((item) => ({ ...item })),
            });
          }
          if (f.wpAttributes && f.wpAttributes.length > 0) {
            setWpAttributes(f.wpAttributes);
          }
        } else {
          // Initialize defaults when no draft exists
          setHeaderInfo(INITIAL_HEADER_INFO);
          setMappingTable(INITIAL_MAPPING_TABLE);
          setProblemStatement('');
          setConstraintsAssumptions('');
          setComputationalTools('');
          setExpectedOutcomes('');
          setDeliverables({
            heading: 'Report (must include)',
            items: DEFAULT_DELIVERABLE_ITEMS.map((item) => ({ ...item })),
          });
          setWpAttributes(DEFAULT_WP_ATTRIBUTES.map((attr) => ({ ...attr })));

          // Pre-populate course title, code, and section from offering or course catalog
          if (offeringId) {
            try {
              const offRes = await api.get(`/offerings/${offeringId}`);
              if (!isCancelled && offRes.data?.data?.offering) {
                const off = offRes.data.data.offering;
                setHeaderInfo((prev) => ({
                  ...prev,
                  courseTitle: off.course?.courseName || prev.courseTitle || '',
                  courseCode: off.course?.courseCode || prev.courseCode || '',
                  section: off.section || prev.section || '',
                  program: off.course?.department?.name || prev.program || '',
                }));
              }
            } catch {
              // Non-critical auto-fill fallback
            }
          } else if (courseId) {
            try {
              const courseRes = await api.get(`/courses/${courseId}`);
              if (!isCancelled && courseRes.data?.data?.course) {
                const c = courseRes.data.data.course;
                setHeaderInfo((prev) => ({
                  ...prev,
                  courseTitle: c.courseName || '',
                  courseCode: c.courseCode || '',
                }));
              }
            } catch {
              // Non-critical auto-fill fallback
            }
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to load CCP form data:', err);
          toast.error(err.response?.data?.message || 'Failed to load CCP form data.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchCCP();

    return () => {
      isCancelled = true;
    };
  }, [courseId, offeringId, toast]);

  /* ── Form Change Handlers ───────────────────────────────── */
  const handleHeaderChange = (field, value) => {
    setHeaderInfo((prev) => ({ ...prev, [field]: value }));
    setValidationErrors((prev) => prev.filter((e) => e.field !== `headerInfo.${field}`));
  };

  const handleMappingChange = (field, value) => {
    setMappingTable((prev) => ({ ...prev, [field]: value }));
    setValidationErrors((prev) => prev.filter((e) => e.field !== `mappingTable.${field}`));
  };

  const handleNarrativeChange = (field, value) => {
    if (field === 'problemStatement') setProblemStatement(value);
    if (field === 'constraintsAssumptions') setConstraintsAssumptions(value);
    if (field === 'computationalTools') setComputationalTools(value);
    if (field === 'expectedOutcomes') setExpectedOutcomes(value);
    setValidationErrors((prev) => prev.filter((e) => e.field !== field));
  };

  /* ── Validation ─────────────────────────────────────────── */
  const validateForm = () => {
    const errors = [];
    if (!headerInfo.courseTitle?.trim()) {
      errors.push({ field: 'headerInfo.courseTitle', message: 'Course Title is required.' });
    }
    if (!problemStatement?.trim()) {
      errors.push({ field: 'problemStatement', message: 'Problem Statement is required.' });
    }
    return errors;
  };

  /* ── Reset / Clear Form ─────────────────────────────────── */
  const handleClearForm = () => {
    if (!window.confirm('This will clear all current CCP form data and reset fields. Continue?')) {
      return;
    }
    setHeaderInfo(INITIAL_HEADER_INFO);
    setMappingTable(INITIAL_MAPPING_TABLE);
    setProblemStatement('');
    setConstraintsAssumptions('');
    setComputationalTools('');
    setExpectedOutcomes('');
    setDeliverables({
      heading: 'Report (must include)',
      items: DEFAULT_DELIVERABLE_ITEMS.map((item) => ({ ...item })),
    });
    setWpAttributes(DEFAULT_WP_ATTRIBUTES.map((attr) => ({ ...attr })));
    setValidationErrors([]);
    toast.success('Form cleared successfully.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── Save / Submit Handler ──────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const errors = validateForm();
    setValidationErrors(errors);
    if (errors.length > 0) {
      setIsSaving(false);
      toast.warning('Please fix the required fields before saving.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const payload = {
      courseId,
      ...(offeringId ? { offeringId } : {}),
      headerInfo,
      mappingTable,
      problemStatement,
      constraintsAssumptions,
      computationalTools,
      expectedOutcomes,
      deliverables,
      wpAttributes,
      status: 'draft',
    };

    try {
      const res = await api.post('/forms/ccp', payload);
      if (res.data?.success) {
        toast.success('CCP / Class Project form saved successfully!');
      } else {
        toast.success('CCP form updated successfully.');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Failed to save CCP form:', err);
      const serverErrors = err.response?.data?.data?.errors;
      if (serverErrors?.length) {
        setValidationErrors(serverErrors);
        toast.error('Validation failed. Please review the highlighted fields.');
      } else {
        toast.error(err.response?.data?.message || 'Failed to save CCP form.');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontStyle: 'italic' }}>
        Loading CCP / Class Project form data...
      </div>
    );
  }

  return (
    <div className="ccp-form-sheet" style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* ── Document Header ───────────────────────────────── */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: '2rem',
          paddingBottom: '1.5rem',
          borderBottom: '2px solid #e2e8f0',
        }}
      >
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.25rem' }}>
          Iqra University
        </h2>
        <p style={{ fontSize: '0.95rem', fontWeight: '600', color: '#334155', marginBottom: '0.2rem' }}>
          Faculty of Engineering Sciences &amp; Technology
        </p>
        <p style={{ fontSize: '1.1rem', fontWeight: '700', color: '#3949ab' }}>
          Complex Computing Problem (CCP) / Complex Engineering Problem (CEP) / Class Project
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Section A: Assignment Information ───────────── */}
        <AssignmentInfoSection
          data={headerInfo}
          onChange={handleHeaderChange}
          validationErrors={validationErrors}
        />

        {/* ── Section B: CLO & Attribute Mapping ─────────── */}
        <MappingSection data={mappingTable} onChange={handleMappingChange} />

        {/* ── Section C: Problem Statement & Specifications ── */}
        <ProblemStatementSection
          problemStatement={problemStatement}
          constraintsAssumptions={constraintsAssumptions}
          computationalTools={computationalTools}
          expectedOutcomes={expectedOutcomes}
          onChange={handleNarrativeChange}
          validationErrors={validationErrors}
        />

        {/* ── Section D: Deliverables & Report Checklist ──── */}
        <DeliverablesSection deliverables={deliverables} onChange={setDeliverables} />

        {/* ── Section E: WP Attributes Mapped Table ──────── */}
        <WPAttributesTable attributes={wpAttributes} onChange={setWpAttributes} />

        {/* ── Action Buttons ──────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '1rem',
            paddingTop: '1.5rem',
            borderTop: '2px solid #e2e8f0',
            marginTop: '2rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={handleClearForm}
            disabled={isSaving || Boolean(isExporting)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: (isSaving || Boolean(isExporting)) ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseOver={(e) => {
              if (!isSaving && !isExporting) e.currentTarget.style.backgroundColor = '#e2e8f0';
            }}
            onMouseOut={(e) => {
              if (!isSaving && !isExporting) e.currentTarget.style.backgroundColor = '#f1f5f9';
            }}
          >
            Clear Form
          </button>

          <button
            type="button"
            onClick={() => handleDownload('docx')}
            disabled={Boolean(isExporting) || isSaving}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#f8fafc',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.95rem',
              cursor: isExporting === 'docx' ? 'wait' : (isSaving || Boolean(isExporting) ? 'not-allowed' : 'pointer'),
              fontWeight: '600',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              if (!isExporting && !isSaving) e.currentTarget.style.backgroundColor = '#e2e8f0';
            }}
            onMouseOut={(e) => {
              if (!isExporting && !isSaving) e.currentTarget.style.backgroundColor = '#f8fafc';
            }}
          >
            {isExporting === 'docx' ? 'Generating...' : 'Download Word (.docx)'}
          </button>

          <button
            type="button"
            onClick={() => handleDownload('pdf')}
            disabled={Boolean(isExporting) || isSaving}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              fontSize: '0.95rem',
              cursor: isExporting === 'pdf' ? 'wait' : (isSaving || Boolean(isExporting) ? 'not-allowed' : 'pointer'),
              fontWeight: '600',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              if (!isExporting && !isSaving) e.currentTarget.style.backgroundColor = '#fee2e2';
            }}
            onMouseOut={(e) => {
              if (!isExporting && !isSaving) e.currentTarget.style.backgroundColor = '#fef2f2';
            }}
          >
            {isExporting === 'pdf' ? 'Generating...' : 'Download PDF'}
          </button>

          <button
            type="submit"
            disabled={isSaving || Boolean(isExporting)}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: isSaving ? '#94a3b8' : '#3949ab',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: isSaving ? 'wait' : (Boolean(isExporting) ? 'not-allowed' : 'pointer'),
              boxShadow: '0 2px 4px rgba(57, 73, 171, 0.25)',
              transition: 'all 0.15s ease',
            }}
            onMouseOver={(e) => {
              if (!isSaving && !isExporting) e.currentTarget.style.backgroundColor = '#303f9f';
            }}
            onMouseOut={(e) => {
              if (!isSaving && !isExporting) e.currentTarget.style.backgroundColor = '#3949ab';
            }}
          >
            {isSaving ? 'Saving...' : 'Save CCP / Class Project'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ClassProjectPage;
