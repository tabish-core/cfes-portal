import React, { useState, useRef, useMemo } from 'react';
import useToast from '../../../hooks/useToast';
import { uploadExamDocument, EXAM_SLOTS } from '../../../services/courseFile.service';
import Button from '../../common/Button';
import StatusBadge from '../../common/StatusBadge';
import Icon from '../../common/Icon';
import './ExamUploadSection.css';

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
 * Format badge CSS modifier
 */
const getFormatBadgeClass = (format) => {
  const norm = (format || '').toLowerCase();
  if (norm === 'pdf') return 'exam-slot-format-badge--pdf';
  if (norm === 'doc' || norm === 'docx') return 'exam-slot-format-badge--doc';
  return 'exam-slot-format-badge--default';
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
 * Supports both standalone page rendering (isCard={false}) with full progress header
 * and checklist expanded row rendering (isCard={true}) with compact, clean presentation.
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
  const filesByType = useMemo(() => {
    const map = {};
    courseFiles.forEach((file) => {
      if (file.documentType) {
        map[file.documentType] = file;
      }
    });
    return map;
  }, [courseFiles]);

  // Compute uploaded count and completion status
  const uploadedCount = useMemo(() => {
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

  return (
    <div
      className={`exam-section ${isCard ? 'exam-section--card' : 'exam-section--standalone'}`}
      data-testid={`exam-section-${examType.toLowerCase()}`}
    >
      {/* Header with Title and Progress — Shown only when rendered as standalone page */}
      {!isCard && (
        <div className="exam-header">
          <div className="exam-header-left">
            <div className="exam-header-title-row">
              <h3 className="exam-header-title">
                {examTitle} Required Documents
              </h3>
              <StatusBadge
                status={
                  completionStatus === 'Completed'
                    ? 'completed'
                    : completionStatus === 'In Progress'
                    ? 'pending'
                    : 'neutral'
                }
                label={
                  completionStatus === 'Completed'
                    ? `Completed (4/4)`
                    : completionStatus === 'In Progress'
                    ? `In Progress (${uploadedCount}/4)`
                    : `Not Started (0/4)`
                }
                dot={completionStatus !== 'Not Started'}
                size="sm"
              />
            </div>
            <p className="exam-header-desc">
              All 4 document categories must be uploaded to complete this exam checklist item.
              Supported formats: PDF (.pdf), Word (.doc, .docx) • Max size: 25 MB per file.
            </p>
          </div>

          {/* Mini visual progress indicator */}
          <div className="exam-header-progress-wrap">
            <div className="exam-header-progress-labels">
              <span>Progress</span>
              <span>{uploadedCount} of 4</span>
            </div>
            <div className="exam-header-progress-track">
              <div
                className={`exam-header-progress-bar ${
                  uploadedCount < 4 ? 'exam-header-progress-bar--partial' : ''
                }`}
                style={{ width: `${(uploadedCount / 4) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Grid of 4 Upload Slots (2x2 on Desktop, 1-col on Mobile) */}
      <div className="exam-slots-grid">
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
              className={`exam-slot-card ${isUploaded ? 'exam-slot-card--uploaded' : ''}`}
            >
              {/* Slot Header */}
              <div>
                <div className="exam-slot-header">
                  <div className="exam-slot-title-wrap">
                    <div className="exam-slot-icon-box">
                      <Icon name={slot.icon || 'document'} size={16} />
                    </div>
                    <h4 className="exam-slot-title">
                      {index + 1}. {slot.category}
                    </h4>
                  </div>

                  {/* Status Badge */}
                  <StatusBadge
                    status={isUploaded ? 'synced' : 'neutral'}
                    label={
                      isUploaded
                        ? `Synced${file?.version > 1 ? ` v${file.version}` : ''}`
                        : 'Not Uploaded'
                    }
                    dot={isUploaded}
                    size="sm"
                    className="exam-slot-badge"
                  />
                </div>

                <p className="exam-slot-desc">
                  {slot.description}
                </p>

                {/* Uploaded File Metadata Display */}
                {isUploaded && (
                  <div className="exam-slot-file-panel">
                    <div className="exam-slot-file-row">
                      <div className="exam-slot-filename" title={file.filename}>
                        <Icon name="file" size={14} style={{ color: 'var(--cfes-blue-600)', flexShrink: 0 }} />
                        <span className="exam-slot-filename-text">{file.filename}</span>
                      </div>

                      <span className={`exam-slot-format-badge ${getFormatBadgeClass(file.fileFormat)}`}>
                        {file.fileFormat || 'PDF'}
                      </span>
                    </div>

                    <div className="exam-slot-file-meta">
                      <span>{formatFileSize(file.sizeBytes)}</span>
                      {file.version > 1 && (
                        <span>• Version {file.version} (Updated)</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Inline Error Display */}
                {errorMsg && (
                  <div className="exam-slot-feedback exam-slot-feedback--error">
                    <Icon name="alert" size={14} style={{ flexShrink: 0 }} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Inline Success Notice */}
                {successMsg && !errorMsg && (
                  <div className="exam-slot-feedback exam-slot-feedback--success">
                    <Icon name="check" size={14} style={{ flexShrink: 0 }} />
                    <span>{successMsg}</span>
                  </div>
                )}
              </div>

              {/* Slot Actions */}
              <div className="exam-slot-actions">
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={(el) => (fileInputRefs.current[slot.documentType] = el)}
                  onChange={(e) => handleFileChange(slot.documentType, e)}
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  style={{ display: 'none' }}
                />

                {/* Upload or Replace Button */}
                <Button
                  variant={isUploaded ? 'secondary' : 'primary'}
                  size="sm"
                  icon={isUploaded ? 'refresh' : 'upload'}
                  isLoading={isUploading}
                  onClick={() => handleSelectFileClick(slot.documentType)}
                  disabled={isUploading || !offeringId}
                  title={
                    isUploaded
                      ? `Replace ${slot.category} with a new Word or PDF file`
                      : `Upload ${slot.category}`
                  }
                >
                  {isUploading
                    ? isUploaded
                      ? 'Replacing...'
                      : 'Uploading...'
                    : isUploaded
                    ? 'Replace Document'
                    : 'Upload Document'}
                </Button>

                {/* View in Drive Button */}
                {isUploaded && file?.googleDriveWebViewLink && (
                  <a
                    href={file.googleDriveWebViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cfes-btn cfes-btn--subtle cfes-btn--sm"
                    title="Open document in Google Drive in a new tab"
                  >
                    <span className="cfes-btn-icon">
                      <Icon name="external" size={13} />
                    </span>
                    <span>View in Drive</span>
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
