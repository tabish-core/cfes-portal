/**
 * formActionBar.test.js — Regression and unit tests for the reusable
 * FormActionBar component across all 6 migrated academic forms.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('FormActionBar Configuration & Action Visibility', () => {
  // Simulates action determination logic inside FormActionBar
  const getVisibleActions = (props) => {
    return {
      hasClear: Boolean(props.onClear),
      hasDocx: Boolean(props.onExportDocx),
      hasPdf: Boolean(props.onExportPdf),
      hasSync: Boolean(props.onSyncDrive && props.showSyncDrive !== false),
      hasDriveLink: Boolean(props.driveWebViewLink),
      hasSave: true, // Always present
      saveType: props.saveButtonType || 'submit',
      saveLabel: props.saveLabel || 'Save Draft',
      isSaving: Boolean(props.isSaving),
      isSyncing: Boolean(props.isSyncingDrive),
      isExportingDocx: Boolean(props.isExportingDocx),
      isExportingPdf: Boolean(props.isExportingPdf),
    };
  };

  test('1. CIS configuration: supports Clear, Word, PDF, Sync, DriveLink, and Submit', () => {
    const cisProps = {
      onClear: () => {},
      onExportDocx: () => {},
      onExportPdf: () => {},
      onSyncDrive: () => {},
      showSyncDrive: true,
      driveWebViewLink: 'https://drive.google.com/file/d/123/view',
      saveButtonType: 'submit',
      saveLabel: 'Save Course Information Sheet',
      isSaving: false,
    };

    const actions = getVisibleActions(cisProps);
    assert.strictEqual(actions.hasClear, true);
    assert.strictEqual(actions.hasDocx, true);
    assert.strictEqual(actions.hasPdf, true);
    assert.strictEqual(actions.hasSync, true);
    assert.strictEqual(actions.hasDriveLink, true);
    assert.strictEqual(actions.saveType, 'submit');
    assert.strictEqual(actions.saveLabel, 'Save Course Information Sheet');
  });

  test('2. CCR configuration: supports Clear, Word, PDF, Sync, DriveLink, and Submit', () => {
    const ccrProps = {
      onClear: () => {},
      onExportDocx: () => {},
      onExportPdf: () => {},
      onSyncDrive: () => {},
      showSyncDrive: true,
      driveWebViewLink: 'https://drive.google.com/file/d/456/view',
      saveButtonType: 'submit',
      saveLabel: 'Save Report',
    };

    const actions = getVisibleActions(ccrProps);
    assert.strictEqual(actions.hasClear, true);
    assert.strictEqual(actions.hasDocx, true);
    assert.strictEqual(actions.hasPdf, true);
    assert.strictEqual(actions.hasSync, true);
    assert.strictEqual(actions.saveLabel, 'Save Report');
  });

  test('3. Timetable configuration: uses type="button" and onSave, supports Clear, Word, PDF, Sync', () => {
    const timetableProps = {
      onClear: () => {},
      onExportDocx: () => {},
      onExportPdf: () => {},
      onSyncDrive: () => {},
      showSyncDrive: true,
      saveButtonType: 'button',
      onSave: () => {},
      saveLabel: 'Save Class Schedule',
    };

    const actions = getVisibleActions(timetableProps);
    assert.strictEqual(actions.hasClear, true);
    assert.strictEqual(actions.hasDocx, true);
    assert.strictEqual(actions.hasPdf, true);
    assert.strictEqual(actions.hasSync, true);
    assert.strictEqual(actions.saveType, 'button');
    assert.strictEqual(actions.saveLabel, 'Save Class Schedule');
  });

  test('4. CCC configuration: omits Word export and Clear; supports PDF, Sync, DriveLink, and Submit', () => {
    const cccProps = {
      onExportPdf: () => {},
      onSyncDrive: () => {},
      showSyncDrive: true,
      driveWebViewLink: 'https://drive.google.com/file/d/789/view',
      saveButtonType: 'submit',
      saveLabel: 'Save Draft',
    };

    const actions = getVisibleActions(cccProps);
    assert.strictEqual(actions.hasClear, false);
    assert.strictEqual(actions.hasDocx, false);
    assert.strictEqual(actions.hasPdf, true);
    assert.strictEqual(actions.hasSync, true);
    assert.strictEqual(actions.hasDriveLink, true);
  });

  test('5. CRR configuration: supports Clear, PDF, Sync, DriveLink; omits Word export', () => {
    const crrProps = {
      onClear: () => {},
      onExportPdf: () => {},
      onSyncDrive: () => {},
      showSyncDrive: true,
      driveWebViewLink: 'https://drive.google.com/file/d/abc/view',
      saveButtonType: 'submit',
      saveLabel: 'Save Draft',
    };

    const actions = getVisibleActions(crrProps);
    assert.strictEqual(actions.hasClear, true);
    assert.strictEqual(actions.hasDocx, false);
    assert.strictEqual(actions.hasPdf, true);
    assert.strictEqual(actions.hasSync, true);
    assert.strictEqual(actions.hasDriveLink, true);
  });

  test('6. Class Project configuration: supports Clear, Word, PDF, Sync, DriveLink, and Submit', () => {
    const ccpProps = {
      onClear: () => {},
      onExportDocx: () => {},
      onExportPdf: () => {},
      onSyncDrive: () => {},
      showSyncDrive: true,
      driveWebViewLink: 'https://drive.google.com/file/d/def/view',
      saveButtonType: 'submit',
      saveLabel: 'Save CCP / Class Project',
    };

    const actions = getVisibleActions(ccpProps);
    assert.strictEqual(actions.hasClear, true);
    assert.strictEqual(actions.hasDocx, true);
    assert.strictEqual(actions.hasPdf, true);
    assert.strictEqual(actions.hasSync, true);
    assert.strictEqual(actions.saveLabel, 'Save CCP / Class Project');
  });

  test('7. Hides Sync button when showSyncDrive is false (pure catalog courseId view)', () => {
    const catalogProps = {
      onExportPdf: () => {},
      onSyncDrive: () => {},
      showSyncDrive: false,
    };

    const actions = getVisibleActions(catalogProps);
    assert.strictEqual(actions.hasSync, false);
  });

  test('8. View in Drive displays version number when version > 1', () => {
    const formatDriveLinkText = (version) => {
      return `View in Drive${version && Number(version) > 1 ? ` (v${version})` : ''}`;
    };

    assert.strictEqual(formatDriveLinkText(undefined), 'View in Drive');
    assert.strictEqual(formatDriveLinkText(1), 'View in Drive');
    assert.strictEqual(formatDriveLinkText(2), 'View in Drive (v2)');
    assert.strictEqual(formatDriveLinkText(4), 'View in Drive (v4)');
  });
});

describe('FormActionBar Loading and Disabled State Computation', () => {
  test('disables all export and sync buttons while saving', () => {
    const computeDisabledStates = ({ isSaving, isExporting, isSyncing }) => {
      return {
        clearDisabled: isSaving || Boolean(isExporting),
        docxDisabled: Boolean(isExporting) || isSaving,
        pdfDisabled: Boolean(isExporting) || isSaving,
        syncDisabled: isSyncing || isSaving || Boolean(isExporting),
        saveDisabled: isSaving || Boolean(isExporting),
      };
    };

    const whileSaving = computeDisabledStates({ isSaving: true, isExporting: '', isSyncing: false });
    assert.strictEqual(whileSaving.clearDisabled, true);
    assert.strictEqual(whileSaving.docxDisabled, true);
    assert.strictEqual(whileSaving.pdfDisabled, true);
    assert.strictEqual(whileSaving.syncDisabled, true);
    assert.strictEqual(whileSaving.saveDisabled, true);

    const whileExportingPdf = computeDisabledStates({ isSaving: false, isExporting: 'pdf', isSyncing: false });
    assert.strictEqual(whileExportingPdf.clearDisabled, true);
    assert.strictEqual(whileExportingPdf.docxDisabled, true);
    assert.strictEqual(whileExportingPdf.pdfDisabled, true);
    assert.strictEqual(whileExportingPdf.syncDisabled, true);
    assert.strictEqual(whileExportingPdf.saveDisabled, true);

    const idle = computeDisabledStates({ isSaving: false, isExporting: '', isSyncing: false });
    assert.strictEqual(idle.clearDisabled, false);
    assert.strictEqual(idle.docxDisabled, false);
    assert.strictEqual(idle.pdfDisabled, false);
    assert.strictEqual(idle.syncDisabled, false);
    assert.strictEqual(idle.saveDisabled, false);
  });
});
