import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import useToast from '../../../hooks/useToast';
import { syncProjectDocument, getOfferingFiles } from '../../../services/courseFile.service';
import FormActionBar from '../FormActionBar';
import Icon from '../../common/Icon';
import AssignmentInfoSection from './AssignmentInfoSection';
import MappingSection from './MappingSection';
import ProblemStatementSection from './ProblemStatementSection';
import DeliverablesSection from './DeliverablesSection';
import WPAttributesTable from './WPAttributesTable';
import './ClassProjectPage.css';

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
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveFile, setDriveFile] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);

  /* ── Google Drive Sync Handler ───────────────────────────── */
  const handleSyncToDrive = async () => {
    if (!offeringId) {
      toast.error('Google Drive synchronization requires an offering-scoped view.');
      return;
    }
    try {
      setIsSyncingDrive(true);
      const res = await syncProjectDocument(offeringId);
      toast.success(
        res.message || 'CCP / Class Project (PDF) synchronized to Google Drive successfully!'
      );
      if (res.data) setDriveFile(res.data);
    } catch (err) {
      console.error('Failed to sync Class Project to Google Drive:', err);
      toast.error(
        err.response?.data?.message || 'Failed to synchronize Class Project with Google Drive.'
      );
    } finally {
      setIsSyncingDrive(false);
    }
  };

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

        // Check existing Google Drive sync status for this offering
        if (offeringId) {
          try {
            const files = await getOfferingFiles(offeringId);
            const matched = files.find(
              (f) =>
                (f.documentType === 'ASSESS_PROJECT' || f.documentType === 'CCP') &&
                f.status === 'synced'
            );
            if (matched && !isCancelled) setDriveFile(matched);
          } catch {
            // Non-critical check fallback
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
      <div className="cfes-ccp-container">
        <div className="cfes-crr-loading-banner" style={{ margin: '3rem auto', maxWidth: '400px' }}>
          <Icon name="spinner" size={20} />
          <span>Loading CCP / Class Project form data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="cfes-ccp-container">
      {/* ── Document Header ── */}
      <div className="cfes-ccp-header">
        <div className="cfes-ccp-doc-badge">
          <Icon name="document" size={14} />
          <span>Accreditation Assessment Document</span>
        </div>
        <h1 className="cfes-ccp-inst-title">Iqra University</h1>
        <p className="cfes-ccp-faculty-name">Faculty of Engineering Sciences &amp; Technology</p>
        <p className="cfes-ccp-doc-title">
          Complex Computing Problem (CCP) / Complex Engineering Problem (CEP) / Class Project
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
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
        <FormActionBar
          onClear={handleClearForm}
          clearDisabled={isSaving || Boolean(isExporting)}
          onExportDocx={() => handleDownload('docx')}
          isExportingDocx={isExporting === 'docx'}
          docxDisabled={Boolean(isExporting) || isSaving}
          onExportPdf={() => handleDownload('pdf')}
          isExportingPdf={isExporting === 'pdf'}
          pdfDisabled={Boolean(isExporting) || isSaving}
          showSyncDrive={Boolean(offeringId)}
          onSyncDrive={handleSyncToDrive}
          isSyncingDrive={isSyncingDrive}
          syncDriveDisabled={isSyncingDrive || isLoading || isSaving || Boolean(isExporting)}
          syncDriveTitle="Save and synchronize CCP / Class Project document to Google Drive"
          driveWebViewLink={driveFile?.googleDriveWebViewLink}
          driveFileVersion={driveFile?.version}
          saveButtonType="submit"
          saveLabel="Save CCP / Class Project"
          isSaving={isSaving}
          saveDisabled={isSaving || Boolean(isExporting)}
        />
      </form>
    </div>
  );
};

export default ClassProjectPage;
