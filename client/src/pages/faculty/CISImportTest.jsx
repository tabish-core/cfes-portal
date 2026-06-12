/**
 * CISImportTest.jsx — Proof-of-concept page for CIS DOCX import.
 *
 * Route: /cis/import-test
 * Purpose: Upload a CIS .docx file, parse it on the backend,
 *          and display the extracted JSON in a readable format.
 *
 * NOT connected to the existing CIS form — purely for debugging.
 */

import { useState, useRef } from 'react';
import api from '../../api/axios';
import './CISImportTest.css';

export default function CISImportTest() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      // Validate client-side
      if (!selected.name.endsWith('.docx')) {
        setError('Only .docx files are accepted.');
        setFile(null);
        return;
      }
      setFile(selected);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a .docx file first.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/cis-import/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setResult(response.data);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'An unexpected error occurred.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setActiveTab('summary');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="cis-import-test">
      {/* Header */}
      <div className="cis-import-header">
        <div className="cis-import-header__badge">Proof of Concept</div>
        <h1 className="cis-import-header__title">CIS Document Parser</h1>
        <p className="cis-import-header__subtitle">
          Upload a completed CIS Word document (.docx) to test the parsing
          engine. This page extracts and displays all detected sections, tables,
          and text content.
        </p>
      </div>

      {/* Upload Card */}
      <div className="cis-import-upload-card">
        <div className="cis-import-upload-card__inner">
          <div className="cis-import-upload-zone">
            <div className="cis-import-upload-zone__icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <polyline points="9 15 12 12 15 15" />
              </svg>
            </div>
            <label className="cis-import-upload-zone__label">
              <span>Choose a .docx file or drag it here</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                className="cis-import-upload-zone__input"
              />
            </label>
          </div>

          {file && (
            <div className="cis-import-file-info">
              <div className="cis-import-file-info__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="cis-import-file-info__details">
                <span className="cis-import-file-info__name">{file.name}</span>
                <span className="cis-import-file-info__size">
                  {formatFileSize(file.size)}
                </span>
              </div>
              <button
                className="cis-import-file-info__remove"
                onClick={handleReset}
                title="Remove file"
              >
                ×
              </button>
            </div>
          )}

          <div className="cis-import-upload-actions">
            <button
              className="cis-import-btn cis-import-btn--primary"
              onClick={handleUpload}
              disabled={!file || loading}
            >
              {loading ? (
                <>
                  <span className="cis-import-spinner" />
                  Parsing Document…
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 16 12 12 8 16" />
                    <line x1="12" y1="12" x2="12" y2="21" />
                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                  </svg>
                  Upload &amp; Parse
                </>
              )}
            </button>
            {result && (
              <button
                className="cis-import-btn cis-import-btn--ghost"
                onClick={handleReset}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="cis-import-error">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && result.success && (
        <div className="cis-import-results">
          {/* Tab Navigation */}
          <div className="cis-import-tabs">
            {[
              { key: 'summary', label: 'Summary', icon: '📊' },
              { key: 'tables', label: `Tables (${result.data.summary.totalTables})`, icon: '📋' },
              { key: 'sections', label: `Sections (${result.data.summary.totalSections})`, icon: '📑' },
              { key: 'rawText', label: 'Raw Text', icon: '📝' },
              { key: 'json', label: 'Full JSON', icon: '{ }' },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`cis-import-tab ${activeTab === tab.key ? 'cis-import-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="cis-import-tab__icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="cis-import-tab-content">
            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <div className="cis-import-summary">
                <div className="cis-import-stat-grid">
                  <div className="cis-import-stat">
                    <span className="cis-import-stat__value">{result.data.summary.totalTables}</span>
                    <span className="cis-import-stat__label">Tables Detected</span>
                  </div>
                  <div className="cis-import-stat">
                    <span className="cis-import-stat__value">{result.data.summary.totalSections}</span>
                    <span className="cis-import-stat__label">Sections Found</span>
                  </div>
                  <div className="cis-import-stat">
                    <span className="cis-import-stat__value">{(result.data.summary.rawTextLength / 1000).toFixed(1)}k</span>
                    <span className="cis-import-stat__label">Characters Extracted</span>
                  </div>
                  <div className="cis-import-stat">
                    <span className="cis-import-stat__value">{result.data.summary.conversionWarnings}</span>
                    <span className="cis-import-stat__label">Warnings</span>
                  </div>
                </div>

                <div className="cis-import-meta">
                  <h3>File Details</h3>
                  <div className="cis-import-meta__row">
                    <span className="cis-import-meta__label">File Name</span>
                    <span className="cis-import-meta__value">{result.fileName}</span>
                  </div>
                  <div className="cis-import-meta__row">
                    <span className="cis-import-meta__label">File Size</span>
                    <span className="cis-import-meta__value">{formatFileSize(result.fileSize)}</span>
                  </div>
                  <div className="cis-import-meta__row">
                    <span className="cis-import-meta__label">HTML Output Size</span>
                    <span className="cis-import-meta__value">{formatFileSize(result.data.summary.htmlLength)}</span>
                  </div>
                </div>

                {result.data.conversionMessages.length > 0 && (
                  <div className="cis-import-warnings">
                    <h3>⚠️ Conversion Warnings</h3>
                    {result.data.conversionMessages.map((msg, i) => (
                      <div key={i} className="cis-import-warning-item">
                        <span className="cis-import-warning-item__type">{msg.type}</span>
                        <span>{msg.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tables Tab */}
            {activeTab === 'tables' && (
              <div className="cis-import-tables">
                {result.data.tables.length === 0 ? (
                  <p className="cis-import-empty">No tables detected in this document.</p>
                ) : (
                  result.data.tables.map((table) => (
                    <div key={table.tableIndex} className="cis-import-table-card">
                      <div className="cis-import-table-card__header">
                        <h3>Table {table.tableIndex + 1}</h3>
                        <span className="cis-import-table-card__meta">
                          {table.rowCount} rows × {table.colCount} cols
                        </span>
                      </div>
                      <div className="cis-import-table-card__body">
                        <table className="cis-import-extracted-table">
                          <tbody>
                            {table.rows.map((row) => (
                              <tr key={row.rowIndex}>
                                {row.cells.map((cell) => (
                                  <td
                                    key={cell.cellIndex}
                                    colSpan={cell.colspan}
                                    rowSpan={cell.rowspan}
                                    className={cell.text === '' ? 'cis-import-cell--empty' : ''}
                                    title={cell.text}
                                  >
                                    {cell.text || '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Sections Tab */}
            {activeTab === 'sections' && (
              <div className="cis-import-sections">
                {result.data.sections.length === 0 ? (
                  <p className="cis-import-empty">No section headings detected.</p>
                ) : (
                  <div className="cis-import-section-list">
                    {result.data.sections.map((section, i) => (
                      <div key={i} className="cis-import-section-item">
                        <span className={`cis-import-section-badge cis-import-section-badge--${section.level}`}>
                          {section.level === 'bold' ? 'BOLD' : `H${section.level}`}
                        </span>
                        <span className="cis-import-section-text">{section.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Raw Text Tab */}
            {activeTab === 'rawText' && (
              <div className="cis-import-raw-text">
                <div className="cis-import-raw-text__header">
                  <span>{result.data.summary.rawTextLength.toLocaleString()} characters</span>
                </div>
                <pre className="cis-import-raw-text__content">
                  {result.data.rawText}
                </pre>
              </div>
            )}

            {/* Full JSON Tab */}
            {activeTab === 'json' && (
              <div className="cis-import-json">
                <div className="cis-import-json__header">
                  <button
                    className="cis-import-btn cis-import-btn--small"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        JSON.stringify(result.data, null, 2)
                      );
                    }}
                  >
                    📋 Copy JSON
                  </button>
                </div>
                <pre className="cis-import-json__content">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
