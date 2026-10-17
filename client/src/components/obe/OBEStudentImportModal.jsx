import React, { useState, useRef } from 'react';
import api from '../../api/axios';
import useToast from '../../hooks/useToast';
import { generateStudentTemplate, parseStudentExcel } from '../../services/obeStudentExcelService';
import './OBEStudentImportModal.css';

const OBEStudentImportModal = ({ courseId, isOpen, onClose, onImportSuccess, currentStudents = [] }) => {
  const toast = useToast();
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsingError, setParsingError] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'valid', 'issues'
  const [importMode, setImportMode] = useState('append'); // 'append' or 'replace'
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [showExcludedList, setShowExcludedList] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    generateStudentTemplate();
  };

  const processFile = (file) => {
    setParsingError(null);
    setParsedRows([]);
    setImportResult(null);
    setReplaceConfirmed(false);
    setShowExcludedList(false);

    const validExtensions = ['.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const isValidExt = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidExt) {
      setParsingError('Please select a valid Excel file (.xlsx or .xls).');
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target.result;
      const result = parseStudentExcel(buffer);
      if (!result.success) {
        setParsingError(result.error);
        return;
      }
      setParsedRows(result.rows);
    };

    reader.onerror = () => {
      setParsingError('Error reading file from disk.');
    };

    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const totalRows = parsedRows.length;
  const validRows = parsedRows.filter(r => r.isValid);
  const invalidRows = parsedRows.filter(r => !r.isValid);

  const displayedRows = activeTab === 'valid'
    ? validRows
    : activeTab === 'issues'
      ? invalidRows
      : parsedRows;

  // Comparison for Replace Mode
  const activeRegMap = new Map();
  (currentStudents || []).forEach(s => {
    if (s.active !== false && s.registrationNo) {
      activeRegMap.set(s.registrationNo.trim().toUpperCase(), s);
    }
  });

  const willBeAdded = [];
  const willBeRetained = [];
  const fileRegSet = new Set();

  validRows.forEach(r => {
    const norm = r.registrationNo.trim().toUpperCase();
    fileRegSet.add(norm);
    if (activeRegMap.has(norm)) {
      willBeRetained.push(r);
    } else {
      willBeAdded.push(r);
    }
  });

  const willBeRemoved = [];
  activeRegMap.forEach((student, norm) => {
    if (!fileRegSet.has(norm)) {
      willBeRemoved.push(student);
    }
  });

  const handleImportSubmit = async () => {
    if (validRows.length === 0) return;
    if (importMode === 'replace' && (invalidRows.length > 0 || !replaceConfirmed)) return;

    try {
      setIsImporting(true);
      setParsingError(null);

      const payload = {
        mode: importMode,
        students: validRows.map(r => ({
          registrationNo: r.registrationNo,
          studentName: r.studentName
        }))
      };

      const { data } = await api.post(`/obe/${courseId}/students/import`, payload);
      setImportResult(data.data);

      if (importMode === 'replace') {
        const totalActive = (data.data.retainedCount || 0) + (data.data.addedCount || 0);
        toast.success(`Roster updated (${totalActive} active students).`);
      } else {
        toast.success(`Imported ${data.data.importedCount} student(s).`);
      }

      if (onImportSuccess) {
        onImportSuccess();
      }
    } catch (err) {
      setParsingError(
        err.response?.data?.error || 'Server error occurred while importing students.'
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParsingError(null);
    setParsedRows([]);
    setImportResult(null);
    setActiveTab('all');
    setImportMode('append');
    setReplaceConfirmed(false);
    setShowExcludedList(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleModalClose = () => {
    if (isImporting) return;
    handleReset();
    onClose();
  };

  return (
    <div className="obe-modal-backdrop" onClick={handleModalClose}>
      <div className="obe-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="obe-modal-header">
          <div className="obe-modal-header-left">
            <h3 className="obe-modal-title">
              {importResult ? 'Import Results' : 'Import Students'}
            </h3>
            {!importResult && (
              <button
                type="button"
                className="obe-template-link"
                onClick={handleDownloadTemplate}
                title="Download standard Excel template"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Template
              </button>
            )}
          </div>
          <button
            className="obe-modal-close-btn"
            onClick={handleModalClose}
            disabled={isImporting}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="obe-modal-body">
          {importResult ? (
            /* Streamlined Post-Import View */
            <div className="obe-confirm-clean">
              <div className="obe-confirm-status">
                <div className="obe-confirm-check">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h4 className="obe-confirm-title">
                    {importResult.mode === 'replace' ? 'Roster Replaced Successfully' : 'Students Imported Successfully'}
                  </h4>
                  <p className="obe-confirm-desc">
                    {importResult.mode === 'replace'
                      ? 'The course roster matches the uploaded spreadsheet. Missing students are excluded (marks kept).'
                      : `${importResult.importedCount} student(s) added to this course.`}
                  </p>
                </div>
              </div>

              {/* Clean Metric Row */}
              <div className="obe-confirm-metrics">
                <div className="metric-item">
                  <span className="metric-val">{importResult.totalProcessed}</span>
                  <span className="metric-lbl">In File</span>
                </div>
                <div className="metric-item metric-added">
                  <span className="metric-val">+{importResult.addedCount ?? importResult.importedCount}</span>
                  <span className="metric-lbl">{importResult.mode === 'replace' ? 'Added' : 'Imported'}</span>
                </div>
                <div className="metric-item metric-retained">
                  <span className="metric-val">={importResult.retainedCount ?? importResult.skippedCount ?? 0}</span>
                  <span className="metric-lbl">{importResult.mode === 'replace' ? 'Retained' : 'Existing'}</span>
                </div>
                {importResult.mode === 'replace' && (
                  <div className="metric-item metric-excluded">
                    <span className="metric-val">-{importResult.removedCount ?? 0}</span>
                    <span className="metric-lbl">Excluded</span>
                  </div>
                )}
                {importResult.invalidCount > 0 && (
                  <div className="metric-item metric-invalid">
                    <span className="metric-val">{importResult.invalidCount}</span>
                    <span className="metric-lbl">Invalid</span>
                  </div>
                )}
              </div>

              {/* Excluded Details (Replace mode) */}
              {importResult.mode === 'replace' && importResult.removed?.length > 0 && (
                <div className="obe-confirm-breakdown">
                  <div className="breakdown-title">
                    Excluded from Active Roster ({importResult.removed.length}):
                  </div>
                  <div className="breakdown-scroll">
                    {importResult.removed.map((s, idx) => (
                      <div key={idx} className="breakdown-row">
                        <span className="obe-reg-code">{s.registrationNo}</span>
                        <span className="breakdown-name">{s.studentName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skipped Details (Append mode) */}
              {importResult.mode !== 'replace' && importResult.skipped?.length > 0 && (
                <div className="obe-confirm-breakdown">
                  <div className="breakdown-title">
                    Existing Students Preserved ({importResult.skipped.length}):
                  </div>
                  <div className="breakdown-scroll">
                    {importResult.skipped.map((s, idx) => (
                      <div key={idx} className="breakdown-row">
                        <span className="obe-reg-code">{s.registrationNo}</span>
                        <span className="breakdown-name">{s.studentName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Upload & Config View */
            <>
              {!selectedFile ? (
                /* Clean Upload Dropzone */
                <div
                  className="obe-upload-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <div className="obe-dropzone-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="15" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div className="obe-dropzone-primary-text">Click to upload or drag & drop</div>
                  <div className="obe-dropzone-sub-text">
                    Requires <strong>Registration Number</strong> and <strong>Student Name</strong> columns (.xlsx, .xls)
                  </div>
                </div>
              ) : (
                /* Selected File Header */
                <div className="obe-file-bar">
                  <div className="obe-file-info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="obe-file-name">{selectedFile.name}</span>
                    <span className="obe-file-size">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="obe-change-file-btn"
                    disabled={isImporting}
                  >
                    Change file
                  </button>
                </div>
              )}

              {/* Error Alert */}
              {parsingError && (
                <div className="obe-alert-simple error">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{parsingError}</span>
                </div>
              )}

              {/* Streamlined Mode Segmented Bar */}
              {parsedRows.length > 0 && (
                <div className="obe-mode-segmented-wrap">
                  <div className="obe-mode-segmented">
                    <button
                      type="button"
                      className={`obe-segmented-btn ${importMode === 'append' ? 'active' : ''}`}
                      onClick={() => setImportMode('append')}
                    >
                      Append / Add New
                    </button>
                    <button
                      type="button"
                      className={`obe-segmented-btn ${importMode === 'replace' ? 'active replace' : ''}`}
                      onClick={() => setImportMode('replace')}
                    >
                      Replace Roster
                    </button>
                  </div>
                  <div className="obe-mode-caption">
                    {importMode === 'append'
                      ? 'Adds new students. Existing records and assessment marks are preserved.'
                      : 'Active roster will match this file. Missing students are excluded (marks kept).'}
                  </div>

                  {/* Replace Mode Controls */}
                  {importMode === 'replace' && (
                    <div className="obe-replace-inline-bar">
                      <div className="obe-replace-counts">
                        <span className="count-tag add">+{willBeAdded.length} add</span>
                        <span className="count-tag retain">={willBeRetained.length} retain</span>
                        <span className="count-tag remove">-{willBeRemoved.length} exclude</span>
                      </div>

                      {willBeRemoved.length > 0 && (
                        <button
                          type="button"
                          className="obe-text-link"
                          onClick={() => setShowExcludedList(prev => !prev)}
                        >
                          {showExcludedList ? 'Hide' : 'View'} excluded ({willBeRemoved.length})
                        </button>
                      )}

                      {showExcludedList && willBeRemoved.length > 0 && (
                        <div className="breakdown-scroll" style={{ width: '100%', marginTop: '4px' }}>
                          {willBeRemoved.map((s, idx) => (
                            <div key={idx} className="breakdown-row">
                              <span className="obe-reg-code">{s.registrationNo}</span>
                              <span className="breakdown-name">{s.studentName}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {invalidRows.length > 0 ? (
                        <div className="obe-alert-simple error" style={{ width: '100%', margin: '4px 0 0 0' }}>
                          Resolve {invalidRows.length} invalid row(s) before replacing, or use Append mode.
                        </div>
                      ) : (
                        <label className="obe-replace-checkbox-inline">
                          <input
                            type="checkbox"
                            checked={replaceConfirmed}
                            onChange={e => setReplaceConfirmed(e.target.checked)}
                          />
                          <span>I confirm replacing the active student roster</span>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Compact Preview Table */}
              {parsedRows.length > 0 && (
                <div className="obe-preview-container">
                  <div className="obe-table-toolbar">
                    <div className="obe-table-filter-links">
                      <button
                        type="button"
                        className={`obe-link-tab ${activeTab === 'all' ? 'active' : ''}`}
                        onClick={() => setActiveTab('all')}
                      >
                        All ({totalRows})
                      </button>
                      <button
                        type="button"
                        className={`obe-link-tab ${activeTab === 'valid' ? 'active' : ''}`}
                        onClick={() => setActiveTab('valid')}
                      >
                        Valid ({validRows.length})
                      </button>
                      {invalidRows.length > 0 && (
                        <button
                          type="button"
                          className={`obe-link-tab issues ${activeTab === 'issues' ? 'active' : ''}`}
                          onClick={() => setActiveTab('issues')}
                        >
                          Issues ({invalidRows.length})
                        </button>
                      )}
                    </div>
                    <div className="obe-table-summary-text">
                      {validRows.length} of {totalRows} ready
                    </div>
                  </div>

                  <div className="obe-table-scroll">
                    <table className="obe-preview-table">
                      <thead>
                        <tr>
                          <th style={{ width: '38px' }}>#</th>
                          <th style={{ width: '140px' }}>Registration No</th>
                          <th>Student Name</th>
                          <th style={{ width: '100px', textAlign: 'right' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedRows.map((row) => (
                          <tr
                            key={row.rowNumber}
                            className={row.isValid ? '' : 'row-invalid'}
                          >
                            <td style={{ color: '#94a3b8' }}>{row.rowNumber}</td>
                            <td>
                              {row.registrationNo ? (
                                <span className="obe-reg-code">{row.registrationNo}</span>
                              ) : (
                                <span className="obe-missing-text">Missing</span>
                              )}
                            </td>
                            <td>
                              {row.studentName || (
                                <span className="obe-missing-text">Missing</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {row.isValid ? (
                                <span className="obe-badge-valid">Ready</span>
                              ) : (
                                <span className="obe-badge-invalid" title={row.error}>
                                  {row.error}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="obe-modal-footer">
          {importResult ? (
            <div className="obe-footer-flex">
              <button
                type="button"
                className="obe-btn-secondary"
                onClick={handleReset}
              >
                Import Another File
              </button>
              <button
                type="button"
                className="obe-btn-primary"
                onClick={handleModalClose}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="obe-btn-secondary"
                onClick={handleModalClose}
                disabled={isImporting}
              >
                Cancel
              </button>

              {importMode === 'replace' ? (
                <button
                  type="button"
                  className="obe-btn-primary"
                  onClick={handleImportSubmit}
                  disabled={
                    validRows.length === 0 ||
                    invalidRows.length > 0 ||
                    !replaceConfirmed ||
                    isImporting
                  }
                >
                  {isImporting ? (
                    <>
                      <span className="obe-spinner" />
                      Replacing...
                    </>
                  ) : (
                    <>Replace Roster ({validRows.length})</>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="obe-btn-primary"
                  onClick={handleImportSubmit}
                  disabled={validRows.length === 0 || isImporting}
                >
                  {isImporting ? (
                    <>
                      <span className="obe-spinner" />
                      Importing...
                    </>
                  ) : (
                    <>Import {validRows.length > 0 ? `(${validRows.length})` : ''}</>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OBEStudentImportModal;
