import React from 'react';
import Button from '../common/Button';
import Icon from '../common/Icon';
import './FormActionBar.css';

/**
 * FormActionBar — Reusable action toolbar for CFES course forms.
 * Provides standardized actions for Clear, Word Export, PDF Export,
 * Google Drive Sync, Drive View Link, and Form Save.
 */
const FormActionBar = ({
  // Clear Action
  onClear,
  clearLabel = 'Clear Form',
  isClearing = false,
  clearDisabled = false,
  clearTitle = 'Clear all editable form fields',

  // Word (.docx) Export Action
  onExportDocx,
  isExportingDocx = false,
  docxLabel = 'Download Word (.docx)',
  docxLoadingLabel = 'Generating...',
  docxDisabled = false,
  docxTitle = 'Export form as Microsoft Word document',

  // PDF Export Action
  onExportPdf,
  isExportingPdf = false,
  pdfLabel = 'Download PDF',
  pdfLoadingLabel = 'Generating...',
  pdfDisabled = false,
  pdfTitle = 'Export form as PDF document',

  // Google Drive Sync Action
  onSyncDrive,
  isSyncingDrive = false,
  syncDriveLabel = '⚡ Sync to Google Drive',
  syncDriveLoadingLabel = 'Syncing to Drive...',
  syncDriveDisabled = false,
  syncDriveTitle = 'Save and synchronize document to Google Drive',
  showSyncDrive = true,

  // Google Drive Link
  driveWebViewLink,
  driveFileVersion,
  driveLinkTitle = 'Open synchronized document in Google Drive',

  // Save / Submit Action
  onSave,
  isSaving = false,
  saveLabel = 'Save Draft',
  saveLoadingLabel = 'Saving...',
  saveDisabled = false,
  saveButtonType = 'submit',
  saveVariant = 'primary',
  saveTitle,

  // Optional custom items or layout extensions
  children,
  className = '',
  style = {},
}) => {
  const showClear = Boolean(onClear);
  const showDocx = Boolean(onExportDocx);
  const showPdf = Boolean(onExportPdf);
  const showSync = Boolean(onSyncDrive && showSyncDrive);
  const showDriveLink = Boolean(driveWebViewLink);

  return (
    <div
      className={`cfes-form-action-bar ${className}`}
      style={style}
      role="toolbar"
      aria-label="Form actions"
    >
      {/* ── Left Group: Utility Actions (Clear Form) ── */}
      <div className="cfes-form-action-bar__left">
        {showClear && (
          <Button
            type="button"
            variant="secondary"
            onClick={onClear}
            disabled={clearDisabled || isClearing}
            isLoading={isClearing}
            title={clearTitle}
          >
            {clearLabel}
          </Button>
        )}
      </div>

      {/* ── Right Group: Document Export, Drive Sync, and Save ── */}
      <div className="cfes-form-action-bar__right">
        {/* Word (.docx) Export */}
        {showDocx && (
          <Button
            type="button"
            variant="secondary"
            onClick={onExportDocx}
            disabled={docxDisabled || isExportingDocx}
            isLoading={isExportingDocx}
            title={docxTitle}
          >
            {isExportingDocx ? docxLoadingLabel : docxLabel}
          </Button>
        )}

        {/* PDF Export */}
        {showPdf && (
          <Button
            type="button"
            variant="danger-subtle"
            onClick={onExportPdf}
            disabled={pdfDisabled || isExportingPdf}
            isLoading={isExportingPdf}
            title={pdfTitle}
          >
            {isExportingPdf ? pdfLoadingLabel : pdfLabel}
          </Button>
        )}

        {/* Sync to Google Drive */}
        {showSync && (
          <Button
            type="button"
            variant="subtle"
            onClick={onSyncDrive}
            disabled={syncDriveDisabled || isSyncingDrive}
            isLoading={isSyncingDrive}
            title={syncDriveTitle}
          >
            {isSyncingDrive ? syncDriveLoadingLabel : syncDriveLabel}
          </Button>
        )}

        {/* View in Drive External Link */}
        {showDriveLink && (
          <a
            href={driveWebViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="cfes-form-action-bar__drive-link"
            title={driveLinkTitle}
          >
            <span>
              View in Drive
              {driveFileVersion && Number(driveFileVersion) > 1
                ? ` (v${driveFileVersion})`
                : ''}
            </span>
            <Icon name="external" size={12} />
          </a>
        )}

        {/* Custom children / extra actions if provided */}
        {children}

        {/* Primary Save Action */}
        <Button
          type={saveButtonType}
          variant={saveVariant}
          onClick={saveButtonType === 'button' ? onSave : undefined}
          disabled={saveDisabled || isSaving}
          isLoading={isSaving}
          title={saveTitle || saveLabel}
        >
          {isSaving ? saveLoadingLabel : saveLabel}
        </Button>
      </div>
    </div>
  );
};

export default FormActionBar;
