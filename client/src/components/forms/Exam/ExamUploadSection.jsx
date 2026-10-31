import React, { useState, useRef } from 'react';
import useToast from '../../../hooks/useToast';
import { uploadExamDocument } from '../../../services/courseFile.service';

export const EXAM_SLOTS = {
  MIDTERM: [
    {
      documentType: 'MIDTERM_EXAM_PAPER',
      category: 'Exam Paper',
      description: 'Official Midterm examination question paper.',
      icon: '📝',
    },
    {
      documentType: 'MIDTERM_BEST_COPY',
      category: 'Best Student Copy',
      description: 'Highest-scoring evaluated student answer script.',
      icon: '⭐',
    },
    {
      documentType: 'MIDTERM_AVERAGE_COPY',
      category: 'Average Student Copy',
      description: 'Average / median evaluated student answer script.',
      icon: '📊',
    },
    {
      documentType: 'MIDTERM_WORST_COPY',
      category: 'Worst Student Copy',
      description: 'Minimum-passing evaluated student answer script.',
      icon: '📉',
    },
  ],
  FINAL: [
    {
      documentType: 'FINAL_EXAM_PAPER',
      category: 'Exam Paper',
      description: 'Official Final examination question paper.',
      icon: '📝',
    },
    {
      documentType: 'FINAL_BEST_COPY',
      category: 'Best Student Copy',
      description: 'Highest-scoring evaluated student answer script.',
      icon: '⭐',
    },
    {
      documentType: 'FINAL_AVERAGE_COPY',
      category: 'Average Student Copy',
      description: 'Average / median evaluated student answer script.',
      icon: '📊',
    },
    {
      documentType: 'FINAL_WORST_COPY',
      category: 'Worst Student Copy',
      description: 'Minimum-passing evaluated student answer script.',
      icon: '📉',
    },
  ],
};

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

/**
 * Format bytes to readable size
 */
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

/**
 * Format badge style
 */
const getFormatBadgeStyle = (format) => {
  const normalized = (format || '').toLowerCase();
  if (normalized === 'pdf') {
    return {
      backgroundColor: '#fef2f2',
      color: '#b91c1c',
      border: '1px solid #fecaca',
    };
  }
  if (normalized === 'docx' || normalized === 'doc') {
    return {
      backgroundColor: '#eff6ff',
      color: '#1d4ed8',
      border: '1px solid #bfdbfe',
    };
  }
  return {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
  };
};

/**
 * ExamUploadSection Component
 *
 * Renders the 4 required upload slots for Midterm or Final Exam:
 * 1. Exam Paper
 * 2. Best Student Copy
 * 3. Average Student Copy
 * 4. Worst Student Copy
 *
 * Each slot provides:
 * - Category label & icon
 * - Upload status badge (Not Uploaded / Synced v{version})
 * - Original filename & file format badge
 * - Upload button (when empty) / Replace button (when uploaded)
 * - View in Google Drive link
 * - Upload progress indicator and clear validation errors
 */
const ExamUploadSection = ({
  examType = 'MIDTERM', // 'MIDTERM' | 'FINAL'
  offeringId,
  courseFiles = [],
  onUploadSuccess,
  isCard = true,
}) => {
  const slots = EXAM_SLOTS[examType] || EXAM_SLOTS.MIDTERM;
  const examTitle = examType === 'MIDTERM' ? 'Midterm Exam' : 'Final Exam';
  const toast = useToast();

  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [slotErrors, setSlotErrors] = useState({});
  const [slotSuccess, setSlotSuccess] = useState({});
  const fileInputRefs = useRef({});

  // Map existing CourseFile records by documentType
  const filesByType = React.useMemo(() => {
    const map = {};
    courseFiles.forEach((file) => {
      if (file.documentType) {
        map[file.documentType] = file;
      }
    });
    return map;
  }, [courseFiles]);

  // Compute uploaded count and completion status
  const uploadedCount = React.useMemo(() => {
    return slots.filter((slot) => {
      const file = filesByType[slot.documentType];
      return file && file.status === 'synced';
    }).length;
  }, [slots, filesByType]);

  const completionStatus =
    uploadedCount === 0
      ? 'Not Started'
      : uploadedCount === 4
      ? 'Completed'
      : 'In Progress';

  const handleSelectFileClick = (docType) => {
    setSlotErrors((prev) => ({ ...prev, [docType]: null }));
    if (fileInputRefs.current[docType]) {
      fileInputRefs.current[docType].click();
    }
  };

  const handleFileChange = async (docType, e) => {
    const file = e.target.files?.[0];
    // Reset file input value so selecting the same file again triggers change
    e.target.value = '';

    if (!file) return;

    // Client-side validation: File size
    if (file.size > MAX_FILE_SIZE) {
      const errorMsg = `File "${file.name}" exceeds the maximum allowed size of 25 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`;
      setSlotErrors((prev) => ({ ...prev, [docType]: errorMsg }));
      toast.error(errorMsg);
      return;
    }

    // Client-side validation: Extension
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      const errorMsg = `Unsupported format ".${ext}". Only PDF (.pdf), Word (.doc), and Word (.docx) files are supported.`;
      setSlotErrors((prev) => ({ ...prev, [docType]: errorMsg }));
      toast.error(errorMsg);
      return;
    }

    if (!offeringId) {
      const errorMsg = 'Course offering ID is missing. Please reload from the offering checklist.';
      setSlotErrors((prev) => ({ ...prev, [docType]: errorMsg }));
      toast.error(errorMsg);
      return;
    }

    try {
      setUploadingSlot(docType);
      setSlotErrors((prev) => ({ ...prev, [docType]: null }));
      setSlotSuccess((prev) => ({ ...prev, [docType]: null }));

      const response = await uploadExamDocument(offeringId, docType, file);

      const isReplace = Boolean(filesByType[docType]);
      const msg = isReplace
        ? `Successfully replaced ${file.name} in Google Drive!`
        : `Successfully uploaded ${file.name} to Google Drive!`;

      setSlotSuccess((prev) => ({ ...prev, [docType]: msg }));
      toast.success(response?.message || msg);

      if (onUploadSuccess) {
        await onUploadSuccess();
      }
    } catch (err) {
      console.error(`Failed to upload ${docType}:`, err);
      const message =
        err.response?.data?.message ||
        err.message ||
        'Failed to upload document to Google Drive. Please try again.';
      setSlotErrors((prev) => ({ ...prev, [docType]: message }));
      toast.error(message);
    } finally {
      setUploadingSlot(null);
    }
  };

  const containerStyle = isCard
    ? {
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '1.5rem',
        marginTop: '0.75rem',
        marginBottom: '1rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
      }
    : {};

  return (
    <div style={containerStyle} data-testid={`exam-section-${examType.toLowerCase()}`}>
      {/* Header with Title and Progress */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid #f1f5f9',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h3
              style={{
                margin: 0,
                fontSize: '1.15rem',
                fontWeight: '700',
                color: '#0f172a',
              }}
            >
              {examTitle} Required Documents
            </h3>
            {/* Status badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                fontWeight: '600',
                backgroundColor:
                  completionStatus === 'Completed'
                    ? '#ecfdf5'
                    : completionStatus === 'In Progress'
                    ? '#eff6ff'
                    : '#f1f5f9',
                color:
                  completionStatus === 'Completed'
                    ? '#047857'
                    : completionStatus === 'In Progress'
                    ? '#1d4ed8'
                    : '#64748b',
                border: `1px solid ${
                  completionStatus === 'Completed'
                    ? '#a7f3d0'
                    : completionStatus === 'In Progress'
                    ? '#bfdbfe'
                    : '#e2e8f0'
                }`,
              }}
            >
              <span>{completionStatus === 'Completed' ? '✓' : '●'}</span>
              <span>
                {completionStatus} ({uploadedCount}/4)
              </span>
            </span>
          </div>
          <p
            style={{
              margin: '0.35rem 0 0',
              fontSize: '0.85rem',
              color: '#64748b',
            }}
          >
            All 4 document categories must be uploaded to complete this exam checklist item.
            Supported formats: PDF (.pdf), Word (.doc, .docx) • Max size: 25 MB per file.
          </p>
        </div>

        {/* Mini visual progress indicator */}
        <div style={{ minWidth: '150px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: '#64748b',
              marginBottom: '0.25rem',
              fontWeight: '600',
            }}
          >
            <span>Progress</span>
            <span>{uploadedCount} of 4</span>
          </div>
          <div
            style={{
              height: '8px',
              backgroundColor: '#e2e8f0',
              borderRadius: '9999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${(uploadedCount / 4) * 100}%`,
                height: '100%',
                backgroundColor:
                  uploadedCount === 4
                    ? '#10b981'
                    : uploadedCount > 0
                    ? '#3b82f6'
                    : 'transparent',
                borderRadius: '9999px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* Grid of 4 Upload Slots */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        {slots.map((slot, index) => {
          const file = filesByType[slot.documentType];
          const isUploaded = Boolean(file && file.status === 'synced');
          const isUploading = uploadingSlot === slot.documentType;
          const errorMsg = slotErrors[slot.documentType];
          const successMsg = slotSuccess[slot.documentType];

          return (
            <div
              key={slot.documentType}
              data-testid={`exam-slot-${slot.documentType.toLowerCase()}`}
              style={{
                backgroundColor: isUploaded ? '#fafdfb' : '#f8fafc',
                border: `1px solid ${isUploaded ? '#bbf7d0' : '#e2e8f0'}`,
                borderRadius: '10px',
                padding: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s',
                boxShadow: isUploaded
                  ? '0 1px 3px rgba(16, 185, 129, 0.08)'
                  : 'none',
              }}
            >
              {/* Slot Header */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>{slot.icon}</span>
                    <div>
                      <h4
                        style={{
                          margin: 0,
                          fontSize: '0.95rem',
                          fontWeight: '700',
                          color: '#0f172a',
                        }}
                      >
                        {index + 1}. {slot.category}
                      </h4>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '9999px',
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      backgroundColor: isUploaded ? '#ecfdf5' : '#f1f5f9',
                      color: isUploaded ? '#047857' : '#64748b',
                      border: `1px solid ${isUploaded ? '#a7f3d0' : '#e2e8f0'}`,
                    }}
                  >
                    {isUploaded ? (
                      <>
                        <span>✓</span>
                        <span>
                          Synced{file?.version > 1 ? ` v${file.version}` : ''}
                        </span>
                      </>
                    ) : (
                      <span>Not Uploaded</span>
                    )}
                  </span>
                </div>

                <p
                  style={{
                    margin: '0 0 0.75rem',
                    fontSize: '0.8rem',
                    color: '#64748b',
                    lineHeight: '1.4',
                  }}
                >
                  {slot.description}
                </p>

                {/* Uploaded File Metadata Display */}
                {isUploaded && (
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '0.65rem 0.75rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                      }}
                    >
                      <div
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          color: '#1e293b',
                        }}
                        title={file.filename}
                      >
                        📄 {file.filename}
                      </div>

                      {/* File format tag */}
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          ...getFormatBadgeStyle(file.fileFormat),
                        }}
                      >
                        {file.fileFormat || 'PDF'}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        marginTop: '0.35rem',
                        fontSize: '0.75rem',
                        color: '#64748b',
                      }}
                    >
                      <span>{formatFileSize(file.sizeBytes)}</span>
                      {file.version > 1 && (
                        <span>• Version {file.version} (Updated)</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Inline Error Display */}
                {errorMsg && (
                  <div
                    style={{
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      padding: '0.5rem 0.65rem',
                      fontSize: '0.78rem',
                      color: '#b91c1c',
                      marginBottom: '0.75rem',
                      lineHeight: '1.35',
                    }}
                  >
                    ⚠️ {errorMsg}
                  </div>
                )}

                {/* Inline Success Notice */}
                {successMsg && !errorMsg && (
                  <div
                    style={{
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '6px',
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.78rem',
                      color: '#166534',
                      marginBottom: '0.75rem',
                    }}
                  >
                    ✓ {successMsg}
                  </div>
                )}
              </div>

              {/* Slot Actions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  marginTop: '0.5rem',
                }}
              >
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={(el) => (fileInputRefs.current[slot.documentType] = el)}
                  onChange={(e) => handleFileChange(slot.documentType, e)}
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  style={{ display: 'none' }}
                />

                {/* Upload or Replace Button */}
                <button
                  type="button"
                  onClick={() => handleSelectFileClick(slot.documentType)}
                  disabled={isUploading}
                  style={{
                    padding: '0.45rem 0.85rem',
                    backgroundColor: isUploaded ? '#ffffff' : '#2563eb',
                    color: isUploaded ? '#334155' : '#ffffff',
                    border: isUploaded ? '1px solid #cbd5e1' : 'none',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: '600',
                    cursor: isUploading ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.15s',
                    opacity: isUploading ? 0.7 : 1,
                  }}
                  title={
                    isUploaded
                      ? `Replace ${slot.category} with a new Word or PDF file`
                      : `Upload ${slot.category}`
                  }
                >
                  {isUploading ? (
                    <>
                      <span
                        className="spinner-sm"
                        style={{
                          display: 'inline-block',
                          animation: 'spin 1s linear infinite',
                        }}
                      >
                        ⟳
                      </span>
                      <span>{isUploaded ? 'Replacing...' : 'Uploading...'}</span>
                    </>
                  ) : isUploaded ? (
                    <>
                      <span>🔄</span>
                      <span>Replace Document</span>
                    </>
                  ) : (
                    <>
                      <span>📤</span>
                      <span>Upload Document</span>
                    </>
                  )}
                </button>

                {/* View in Drive Button */}
                {isUploaded && file?.googleDriveWebViewLink && (
                  <a
                    href={file.googleDriveWebViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '0.45rem 0.75rem',
                      backgroundColor: '#f0fdf4',
                      color: '#166534',
                      border: '1px solid #bbf7d0',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontWeight: '600',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      transition: 'all 0.15s',
                    }}
                    title="Open document in Google Drive in a new tab"
                  >
                    <span>View in Drive</span>
                    <span style={{ fontSize: '0.75rem' }}>↗</span>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExamUploadSection;
