import React, { useState, useEffect, useRef, useCallback } from 'react';
import useToast from '../../../hooks/useToast';
import {
  getOfferingFiles,
  uploadLectureFiles,
  downloadCourseFile,
  deleteCourseFile,
} from '../../../services/courseFile.service';
import Button from '../../common/Button';
import StatusBadge from '../../common/StatusBadge';
import Icon from '../../common/Icon';
import './LecturesPage.css';

const ALLOWED_EXTENSIONS = ['ppt', 'pptx', 'pdf', 'doc', 'docx'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

/**
 * Format bytes into human-readable string (e.g. 1.2 MB, 450 KB)
 */
const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Returns a normalized format badge object
 */
const getFormatBadge = (ext = '') => {
  const normalized = ext.toLowerCase().replace('.', '');
  return {
    label: normalized ? normalized.toUpperCase() : 'FILE',
    ext: normalized,
  };
};

const LecturesPage = ({ courseId, offeringId }) => {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  /* ── Load existing lecture files for this offering ───────── */
  const fetchLectureFiles = useCallback(async () => {
    if (!offeringId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const allFiles = await getOfferingFiles(offeringId, 'LECTURES');
      setFiles(allFiles || []);
    } catch (err) {
      console.error('Failed to load lecture files:', err);
      toast.error('Failed to load lecture files for this course.');
    } finally {
      setLoading(false);
    }
  }, [offeringId, toast]);

  useEffect(() => {
    fetchLectureFiles();
  }, [fetchLectureFiles]);

  /* ── File validation helper ──────────────────────────────── */
  const validateFiles = (fileList) => {
    const valid = [];
    const errors = [];

    Array.from(fileList).forEach((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        errors.push(`"${file.name}": Unsupported format (.${ext}). Allowed: .ppt, .pptx, .pdf, .doc, .docx`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`"${file.name}": File size (${formatFileSize(file.size)}) exceeds 25 MB limit.`);
        return;
      }
      // Check if file with same name is already uploaded
      const alreadyUploaded = files.some((f) => f.filename.toLowerCase() === file.name.toLowerCase());
      if (alreadyUploaded) {
        errors.push(`"${file.name}": A lecture file with this name already exists in this course.`);
        return;
      }
      valid.push(file);
    });

    if (errors.length > 0) {
      errors.forEach((e) => toast.error(e));
    }

    return valid;
  };

  /* ── Drag & Drop Handlers ────────────────────────────────── */
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const valid = validateFiles(e.dataTransfer.files);
      if (valid.length > 0) {
        setSelectedFiles(valid);
      }
    }
  };

  /* ── File Input Change Handler ───────────────────────────── */
  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const valid = validateFiles(e.target.files);
      if (valid.length > 0) {
        setSelectedFiles(valid);
      }
    }
    e.target.value = ''; // reset so same file can be re-selected if removed
  };

  /* ── Trigger File Dialog ─────────────────────────────────── */
  const triggerFileDialog = () => {
    if (fileInputRef.current && !isUploading) {
      fileInputRef.current.click();
    }
  };

  /* ── Remove from selected staging ────────────────────────── */
  const handleRemoveSelected = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  /* ── Upload confirmed files to Google Drive ──────────────── */
  const handleUploadSubmit = async () => {
    if (!offeringId) {
      toast.error('Offering context is missing. Please navigate from an assigned course offering.');
      return;
    }
    if (selectedFiles.length === 0) return;

    try {
      setIsUploading(true);
      setUploadProgress(
        selectedFiles.length === 1
          ? 'Uploading 1 file to Google Drive...'
          : `Uploading ${selectedFiles.length} files to Google Drive...`
      );

      const res = await uploadLectureFiles(offeringId, selectedFiles);

      const count = selectedFiles.length;
      toast.success(
        res.message || `${count} lecture ${count === 1 ? 'file' : 'files'} uploaded to Google Drive successfully!`
      );

      setSelectedFiles([]);
      await fetchLectureFiles();
    } catch (err) {
      console.error('Lecture upload failed:', err);
      toast.error(err.response?.data?.message || 'Failed to upload lecture files to Google Drive.');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  /* ── Download File Handler ───────────────────────────────── */
  const handleDownload = async (file) => {
    try {
      setDownloadingId(file._id);
      await downloadCourseFile(file._id, file.filename);
      toast.success(`Downloaded ${file.filename}`);
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to download file from Google Drive.');
    } finally {
      setDownloadingId(null);
    }
  };

  /* ── Delete File Handler ─────────────────────────────────── */
  const handleDelete = async (file) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${file.filename}"?\n\nThis will remove the file from Google Drive and cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setDeletingId(file._id);
      await deleteCourseFile(file._id);
      toast.success(`"${file.filename}" deleted successfully.`);
      await fetchLectureFiles();
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error(err.response?.data?.message || 'Failed to delete file.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="lectures-page">
      {/* Information Banner */}
      <div className="lectures-banner">
        <p className="lectures-banner-desc">
          Upload and manage lecture materials for this course. Files are synchronized directly with your course&apos;s Google Drive repository.
        </p>
        <div className="lectures-banner-count">
          Total files: <strong>{files.length}</strong>
        </div>
      </div>

      {/* Hidden native multi-file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".ppt,.pptx,.pdf,.doc,.docx"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
        disabled={isUploading}
      />

      {/* ── Compact Upload Area ──────────────────────────────── */}
      <div
        className={`lectures-dropzone ${isDragging ? 'lectures-dropzone--dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileDialog}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerFileDialog();
          }
        }}
      >
        <div className="lectures-dropzone-icon">
          <Icon name="cloud" size={32} />
        </div>
        <div className="lectures-dropzone-title">
          Select or drag &amp; drop lecture files here
        </div>
        <p className="lectures-dropzone-subtitle">
          Supported formats: <strong>.ppt, .pptx, .pdf, .doc, .docx</strong> (PowerPoint, PDF, Word). Maximum size: <strong>25 MB</strong> per file.
        </p>

        <div className="lectures-dropzone-actions">
          <Button
            variant="secondary"
            size="sm"
            icon="folder"
            onClick={(e) => {
              e.stopPropagation();
              triggerFileDialog();
            }}
            disabled={isUploading || !offeringId}
          >
            Browse &amp; Select Files
          </Button>
        </div>

        {!offeringId && (
          <div className="lectures-dropzone-warning">
            <Icon name="alert" size={14} style={{ marginRight: '4px' }} />
            Offering context is required to synchronize files with Google Drive.
          </div>
        )}
      </div>

      {/* ── Staged Selected Files Pending Upload ─────────────── */}
      {selectedFiles.length > 0 && (
        <div className="lectures-staged-panel">
          <div className="lectures-staged-header">
            <h4 className="lectures-staged-title">
              Selected Files ({selectedFiles.length})
            </h4>
            <div className="lectures-staged-actions">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setSelectedFiles([])}
                disabled={isUploading}
              >
                Clear
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon="upload"
                isLoading={isUploading}
                onClick={handleUploadSubmit}
              >
                {isUploading ? 'Uploading...' : 'Upload to Google Drive'}
              </Button>
            </div>
          </div>

          {isUploading && (
            <div className="lectures-progress-indicator">
              <Icon name="spinner" size={16} />
              <span>{uploadProgress}</span>
            </div>
          )}

          <div className="lectures-staged-list">
            {selectedFiles.map((f, idx) => {
              const ext = f.name.split('.').pop()?.toLowerCase();
              const badge = getFormatBadge(ext);
              return (
                <div key={idx} className="lectures-staged-item">
                  <div className="lectures-staged-item-info">
                    <Icon name="file" size={16} style={{ color: 'var(--cfes-slate-500)', flexShrink: 0 }} />
                    <span className="lectures-staged-item-name" title={f.name}>
                      {f.name}
                    </span>
                    <span className={`lectures-format-badge lectures-format-badge--${badge.ext}`}>
                      {badge.label}
                    </span>
                    <span className="lectures-staged-item-size">
                      ({formatFileSize(f.size)})
                    </span>
                  </div>
                  {!isUploading && (
                    <button
                      type="button"
                      className="lectures-staged-remove-btn"
                      onClick={() => handleRemoveSelected(idx)}
                      title="Remove file from selection"
                      aria-label={`Remove ${f.name}`}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Uploaded Lecture Files List ──────────────────────── */}
      <div className="lectures-card">
        <div className="lectures-card-header">
          <h3 className="lectures-card-title">
            Lecture Materials Repository
          </h3>
          <span className="lectures-card-count">
            {files.length} {files.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        {loading ? (
          <div className="lectures-loading-state">
            <Icon name="spinner" size={18} />
            <span>Loading lecture materials from repository...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="lectures-empty-state">
            <div className="lectures-empty-icon">
              <Icon name="document" size={40} />
            </div>
            <div className="lectures-empty-title">
              No lecture files uploaded yet
            </div>
            <p className="lectures-empty-desc">
              Upload your presentations, notes, and handouts to synchronize them with Google Drive.
            </p>
            <Button
              variant="primary"
              size="sm"
              icon="upload"
              onClick={triggerFileDialog}
              disabled={isUploading || !offeringId}
            >
              Upload Files
            </Button>
          </div>
        ) : (
          <div className="lectures-table-wrapper">
            <table className="lectures-table">
              <thead>
                <tr>
                  <th style={{ width: '44%' }}>Document / Filename</th>
                  <th style={{ width: '12%' }}>Format</th>
                  <th style={{ width: '12%' }}>File Size</th>
                  <th style={{ width: '14%' }}>Status</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => {
                  const badge = getFormatBadge(file.fileFormat || file.filename?.split('.').pop());
                  const isDeleting = deletingId === file._id;
                  const isDownloading = downloadingId === file._id;

                  return (
                    <tr key={file._id}>
                      {/* Filename with SVG icon */}
                      <td>
                        <div className="lectures-filename-cell">
                          <Icon name="file" size={16} style={{ color: 'var(--cfes-blue-600)', flexShrink: 0 }} />
                          <span className="lectures-filename-text" title={file.filename}>
                            {file.filename}
                          </span>
                        </div>
                      </td>

                      {/* Format Badge */}
                      <td>
                        <span className={`lectures-format-badge lectures-format-badge--${badge.ext}`}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Size */}
                      <td style={{ color: 'var(--cfes-slate-600)', fontSize: 'var(--cfes-font-xs)' }}>
                        {formatFileSize(file.sizeBytes)}
                      </td>

                      {/* Sync Status Badge */}
                      <td>
                        <StatusBadge
                          status={file.status === 'synced' ? 'synced' : (file.status || 'pending')}
                          label={file.status === 'synced' ? 'Synced' : (file.status || 'Pending')}
                          size="sm"
                        />
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="lectures-actions-cell">
                          {/* View in Drive Link */}
                          {file.googleDriveWebViewLink && (
                            <a
                              href={file.googleDriveWebViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cfes-btn cfes-btn--subtle cfes-btn--sm"
                              title="Open lecture file in Google Drive"
                            >
                              <span className="cfes-btn-icon">
                                <Icon name="external" size={13} />
                              </span>
                              <span>View</span>
                            </a>
                          )}

                          {/* Download Button */}
                          <Button
                            variant="secondary"
                            size="sm"
                            icon="download"
                            isLoading={isDownloading}
                            onClick={() => handleDownload(file)}
                            title="Download file directly"
                          >
                            Download
                          </Button>

                          {/* Delete Button */}
                          <Button
                            variant="danger-subtle"
                            size="sm"
                            icon="trash"
                            isLoading={isDeleting}
                            onClick={() => handleDelete(file)}
                            title="Delete file from Google Drive and portal"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LecturesPage;
