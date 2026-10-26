import React, { useState, useEffect, useRef, useCallback } from 'react';
import useToast from '../../../hooks/useToast';
import api from '../../../api/axios';
import {
  getOfferingFiles,
  uploadLectureFiles,
  downloadCourseFile,
  deleteCourseFile,
} from '../../../services/courseFile.service';

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
 * Returns a format-specific badge style and icon
 */
const getFormatBadge = (ext = '') => {
  const normalized = ext.toLowerCase().replace('.', '');
  switch (normalized) {
    case 'pdf':
      return {
        label: 'PDF',
        bgColor: '#fef2f2',
        color: '#991b1b',
        borderColor: '#fecaca',
        icon: '📄',
      };
    case 'pptx':
    case 'ppt':
      return {
        label: normalized.toUpperCase(),
        bgColor: '#fff7ed',
        color: '#9a3412',
        borderColor: '#ffedd5',
        icon: '📊',
      };
    case 'docx':
    case 'doc':
      return {
        label: normalized.toUpperCase(),
        bgColor: '#eff6ff',
        color: '#1d4ed8',
        borderColor: '#bfdbfe',
        icon: '📝',
      };
    default:
      return {
        label: normalized.toUpperCase() || 'FILE',
        bgColor: '#f8fafc',
        color: '#475569',
        borderColor: '#e2e8f0',
        icon: '📁',
      };
  }
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
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* Short Feature Description */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <p style={{ margin: '0 0 0.25rem', color: '#475569', fontSize: '0.95rem' }}>
            Upload and manage lecture materials for this course. Files are synchronized directly with your course's Google Drive repository.
          </p>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Total files: <strong>{files.length}</strong>
          </span>
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
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          backgroundColor: isDragging ? '#eff6ff' : '#f8fafc',
          border: isDragging ? '2px dashed #3b82f6' : '2px dashed #cbd5e1',
          borderRadius: '8px',
          padding: '1.5rem',
          textAlign: 'center',
          marginBottom: '2rem',
          transition: 'all 0.2s ease',
          boxShadow: isDragging ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📤</div>
        <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '1rem', marginBottom: '0.35rem' }}>
          Select or drag & drop lecture files here
        </div>
        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#64748b', lineHeight: '1.4' }}>
          Supported formats: <strong>.ppt, .pptx, .pdf, .doc, .docx</strong> (PowerPoint, PDF, Word). Maximum size: <strong>25 MB</strong> per file.
        </p>

        <button
          type="button"
          onClick={triggerFileDialog}
          disabled={isUploading || !offeringId}
          style={{
            padding: '0.65rem 1.4rem',
            backgroundColor: '#3949ab',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.9rem',
            fontWeight: '600',
            cursor: isUploading || !offeringId ? 'not-allowed' : 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            opacity: isUploading || !offeringId ? 0.7 : 1,
            transition: 'background-color 0.15s',
          }}
        >
          <span>📁 Browse & Select Files</span>
        </button>

        {!offeringId && (
          <p style={{ margin: '0.75rem 0 0', color: '#b91c1c', fontSize: '0.85rem', fontWeight: '500' }}>
            ⚠ Offering context is required to synchronize files with Google Drive.
          </p>
        )}
      </div>

      {/* ── Staged Selected Files Pending Upload ─────────────── */}
      {selectedFiles.length > 0 && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '1.25rem',
            marginBottom: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b', fontWeight: '600' }}>
              Selected Files ({selectedFiles.length})
            </h4>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setSelectedFiles([])}
                disabled={isUploading}
                style={{
                  padding: '0.4rem 0.8rem',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleUploadSubmit}
                disabled={isUploading}
                style={{
                  padding: '0.4rem 1.1rem',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: isUploading ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                {isUploading ? <span>Uploading...</span> : <span>⚡ Upload to Google Drive</span>}
              </button>
            </div>
          </div>

          {isUploading && (
            <div style={{ padding: '0.5rem 0', color: '#2563eb', fontSize: '0.88rem', fontWeight: '500' }}>
              ⏳ {uploadProgress}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {selectedFiles.map((f, idx) => {
              const ext = f.name.split('.').pop()?.toLowerCase();
              const badge = getFormatBadge(ext);
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    fontSize: '0.88rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                    <span>{badge.icon}</span>
                    <span style={{ fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.name}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      ({formatFileSize(f.size)})
                    </span>
                  </div>
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSelected(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        padding: '0 0.3rem',
                      }}
                      title="Remove file from selection"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Uploaded Lecture Files List ──────────────────────── */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>
            Lecture Materials Repository
          </h3>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            {files.length} {files.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
            Loading lecture materials from repository...
          </div>
        ) : files.length === 0 ? (
          /* Empty state matching portal style */
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📚</div>
            <div style={{ fontSize: '1.05rem', fontWeight: '600', color: '#334155', marginBottom: '0.35rem' }}>
              No lecture files uploaded yet.
            </div>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.88rem', color: '#64748b' }}>
              Upload your presentations, notes, and handouts to synchronize them with Google Drive.
            </p>
            <button
              type="button"
              onClick={triggerFileDialog}
              disabled={isUploading || !offeringId}
              style={{
                padding: '0.6rem 1.3rem',
                backgroundColor: '#3949ab',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.88rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Upload Files
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '600', color: '#475569', width: '45%' }}>
                    Document / Filename
                  </th>
                  <th style={{ padding: '0.75rem 0.75rem', fontWeight: '600', color: '#475569', width: '12%' }}>
                    Format
                  </th>
                  <th style={{ padding: '0.75rem 0.75rem', fontWeight: '600', color: '#475569', width: '12%' }}>
                    File Size
                  </th>
                  <th style={{ padding: '0.75rem 0.75rem', fontWeight: '600', color: '#475569', width: '13%' }}>
                    Status
                  </th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '600', color: '#475569', textAlign: 'right', width: '18%' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => {
                  const badge = getFormatBadge(file.fileFormat);
                  const isDeleting = deletingId === file._id;
                  const isDownloading = downloadingId === file._id;

                  return (
                    <tr
                      key={file._id}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Filename with icon */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{badge.icon}</span>
                          <span
                            style={{
                              fontWeight: '600',
                              color: '#1e293b',
                              wordBreak: 'break-word',
                              maxWidth: '420px',
                            }}
                            title={file.filename}
                          >
                            {file.filename}
                          </span>
                        </div>
                      </td>

                      {/* Format Badge */}
                      <td style={{ padding: '0.85rem 0.75rem', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.55rem',
                            backgroundColor: badge.bgColor,
                            color: badge.color,
                            border: `1px solid ${badge.borderColor}`,
                            borderRadius: '4px',
                            fontSize: '0.78rem',
                            fontWeight: '700',
                            letterSpacing: '0.03em',
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Size */}
                      <td style={{ padding: '0.85rem 0.75rem', verticalAlign: 'middle', color: '#475569', fontSize: '0.85rem' }}>
                        {formatFileSize(file.sizeBytes)}
                      </td>

                      {/* Sync Status */}
                      <td style={{ padding: '0.85rem 0.75rem', verticalAlign: 'middle' }}>
                        {file.status === 'synced' ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.2rem 0.55rem',
                              backgroundColor: '#f0fdf4',
                              color: '#166534',
                              border: '1px solid #bbf7d0',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                              fontWeight: '600',
                            }}
                          >
                            <span>✓</span>
                            <span>Synced</span>
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.2rem 0.55rem',
                              backgroundColor: '#fef2f2',
                              color: '#991b1b',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                              fontWeight: '600',
                            }}
                          >
                            {file.status || 'Pending'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {/* View in Drive Link */}
                          {file.googleDriveWebViewLink ? (
                            <a
                              href={file.googleDriveWebViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: '0.35rem 0.7rem',
                                backgroundColor: '#f0fdf4',
                                color: '#166534',
                                border: '1px solid #bbf7d0',
                                borderRadius: '4px',
                                fontSize: '0.82rem',
                                fontWeight: '600',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                transition: 'all 0.15s',
                              }}
                              title="Open lecture file in Google Drive"
                            >
                              <span>View</span>
                              <span style={{ fontSize: '0.75rem' }}>↗</span>
                            </a>
                          ) : null}

                          {/* Download Button */}
                          <button
                            type="button"
                            onClick={() => handleDownload(file)}
                            disabled={isDownloading}
                            style={{
                              padding: '0.35rem 0.7rem',
                              backgroundColor: '#ffffff',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              fontSize: '0.82rem',
                              fontWeight: '600',
                              cursor: isDownloading ? 'wait' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              transition: 'all 0.15s',
                            }}
                            title="Download file directly"
                          >
                            {isDownloading ? 'Downloading...' : 'Download'}
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDelete(file)}
                            disabled={isDeleting}
                            style={{
                              padding: '0.35rem 0.7rem',
                              backgroundColor: '#ffffff',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              borderRadius: '4px',
                              fontSize: '0.82rem',
                              fontWeight: '600',
                              cursor: isDeleting ? 'wait' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              transition: 'all 0.15s',
                            }}
                            title="Delete file from Google Drive and portal"
                          >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                          </button>
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
