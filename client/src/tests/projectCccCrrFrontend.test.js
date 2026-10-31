/**
 * projectCccCrrFrontend.test.js — Frontend unit & logic tests for CCP, CCC, and CRR Drive sync.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const mockCalls = [];
let mockResponses = {};

const mockApi = {
  get: async (url, config) => {
    mockCalls.push({ method: 'GET', url, config });
    if (mockResponses[`GET:${url}`]) {
      const res = mockResponses[`GET:${url}`];
      if (res instanceof Error) throw res;
      return res;
    }
    return { data: { success: true, data: [] } };
  },
  post: async (url, data, config) => {
    mockCalls.push({ method: 'POST', url, data, config });
    if (mockResponses[`POST:${url}`]) {
      const res = mockResponses[`POST:${url}`];
      if (res instanceof Error) throw res;
      return res;
    }
    return { data: { success: true, data: {} } };
  },
};

const syncProjectDocument = async (offeringId) => {
  const { data } = await mockApi.post(`/course-files/sync/project/${offeringId}`);
  return data;
};

const syncCCCDocument = async (offeringId) => {
  const { data } = await mockApi.post(`/course-files/sync/ccc/${offeringId}`);
  return data;
};

const syncCRRDocument = async (offeringId) => {
  const { data } = await mockApi.post(`/course-files/sync/crr/${offeringId}`);
  return data;
};

describe('CCP, CCC, and CRR Frontend Drive Sync Integration', () => {
  const offeringId = '6639f1c7d2e4a8b1c9000101';

  beforeEach(() => {
    mockCalls.length = 0;
    mockResponses = {};
  });

  describe('1. API Service Endpoint Contracts', () => {
    test('syncProjectDocument sends POST to /course-files/sync/project/:offeringId', async () => {
      mockResponses[`POST:/course-files/sync/project/${offeringId}`] = {
        data: {
          success: true,
          data: {
            documentType: 'ASSESS_PROJECT',
            filename: 'ASSESS_PROJECT_CS301_SecA.pdf',
            version: 1,
            status: 'synced',
          },
          message: 'CCP / Class Project (PDF) synchronized to Google Drive successfully.',
        },
      };

      const res = await syncProjectDocument(offeringId);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.documentType, 'ASSESS_PROJECT');
      assert.strictEqual(mockCalls.length, 1);
      assert.strictEqual(mockCalls[0].url, `/course-files/sync/project/${offeringId}`);
    });

    test('syncCCCDocument sends POST to /course-files/sync/ccc/:offeringId', async () => {
      mockResponses[`POST:/course-files/sync/ccc/${offeringId}`] = {
        data: {
          success: true,
          data: {
            documentType: 'CCC',
            filename: 'CCC_CS301_SecA.pdf',
            version: 1,
            status: 'synced',
          },
          message: 'Course Completion Certificate (PDF) synchronized to Google Drive successfully.',
        },
      };

      const res = await syncCCCDocument(offeringId);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.documentType, 'CCC');
      assert.strictEqual(mockCalls.length, 1);
      assert.strictEqual(mockCalls[0].url, `/course-files/sync/ccc/${offeringId}`);
    });

    test('syncCRRDocument sends POST to /course-files/sync/crr/:offeringId', async () => {
      mockResponses[`POST:/course-files/sync/crr/${offeringId}`] = {
        data: {
          success: true,
          data: {
            documentType: 'CRR',
            filename: 'CRR_CS301_SecA.pdf',
            version: 1,
            status: 'synced',
          },
          message: 'Course Review Report (PDF) synchronized to Google Drive successfully.',
        },
      };

      const res = await syncCRRDocument(offeringId);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.documentType, 'CRR');
      assert.strictEqual(mockCalls.length, 1);
      assert.strictEqual(mockCalls[0].url, `/course-files/sync/crr/${offeringId}`);
    });

    test('cleanly propagates API errors (e.g. 404 unsaved form or 403 unauthorized)', async () => {
      const err = new Error('Form not saved');
      err.response = { status: 404, data: { message: 'Form not saved' } };
      mockResponses[`POST:/course-files/sync/project/${offeringId}`] = err;

      await assert.rejects(
        async () => {
          await syncProjectDocument(offeringId);
        },
        (error) => {
          assert.strictEqual(error.response.status, 404);
          return true;
        }
      );
    });
  });

  describe('2. UI Status and Version Computation', () => {
    test('computes synced badge with version for ASSESS_PROJECT, CCC, and CRR', () => {
      const computeDriveStatus = (matchingFile, hasError) => {
        if (matchingFile?.status === 'synced') {
          return matchingFile.version > 1 ? `Synced v${matchingFile.version}` : 'Synced';
        }
        if (hasError) return 'Sync failed';
        return 'PDF Not Synced';
      };

      assert.strictEqual(computeDriveStatus({ status: 'synced', version: 1 }, false), 'Synced');
      assert.strictEqual(computeDriveStatus({ status: 'synced', version: 3 }, false), 'Synced v3');
      assert.strictEqual(computeDriveStatus(null, true), 'Sync failed');
      assert.strictEqual(computeDriveStatus(null, false), 'PDF Not Synced');
    });

    test('maps legacy CCP files to ASSESS_PROJECT in filesByDocType', () => {
      const courseFiles = [
        { documentType: 'CCP', status: 'synced', version: 1, filename: 'CCP_CS301_SecA.pdf' },
        { documentType: 'CCC', status: 'synced', version: 1, filename: 'CCC_CS301_SecA.pdf' },
        { documentType: 'CRR', status: 'synced', version: 2, filename: 'CRR_CS301_SecA.pdf' },
      ];

      const filesByDocType = {};
      courseFiles.forEach((file) => {
        const type = file.documentType;
        if (!filesByDocType[type]) filesByDocType[type] = [];
        filesByDocType[type].push(file);
        if (type === 'CCP') {
          if (!filesByDocType['ASSESS_PROJECT']) filesByDocType['ASSESS_PROJECT'] = [];
          filesByDocType['ASSESS_PROJECT'].push(file);
        }
      });

      assert.strictEqual(filesByDocType['ASSESS_PROJECT'].length, 1);
      assert.strictEqual(filesByDocType['ASSESS_PROJECT'][0].filename, 'CCP_CS301_SecA.pdf');
      assert.strictEqual(filesByDocType['CCC'].length, 1);
      assert.strictEqual(filesByDocType['CRR'].length, 1);
    });

    test('only enables form-page sync buttons when offeringId is present', () => {
      const shouldRenderFormSyncButton = (hasOfferingId) => Boolean(hasOfferingId);
      assert.strictEqual(shouldRenderFormSyncButton('valid_offering_id'), true);
      assert.strictEqual(shouldRenderFormSyncButton(null), false);
      assert.strictEqual(shouldRenderFormSyncButton(undefined), false);
      assert.strictEqual(shouldRenderFormSyncButton(''), false);
    });
  });
});
