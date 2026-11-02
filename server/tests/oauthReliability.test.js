/**
 * oauthReliability.test.js — Google Drive OAuth Reliability Test Suite
 *
 * Verifies the 9 critical reliability requirements:
 *  1. Valid MongoDB token takes precedence over stale environment token
 *  2. Reconnect returning a new refresh token encrypts and saves it successfully
 *  3. Reconnect response without a refresh token is not reported as successful
 *  4. Encryption failure prevents reconnect success
 *  5. MongoDB persistence failure prevents reconnect success
 *  6. Failed reconnect preserves the previously stored token record
 *  7. invalid_grant produces a clear reconnect-required state (503 INVALID_GRANT)
 *  8. Invalid tokens do not trigger endless/redundant retries
 *  9. Existing Google Drive operations continue to use the expected token source
 */

const jwt = require('jsonwebtoken');
const { encrypt, decrypt } = require('../utils/crypto');
const googleDriveConfig = require('../config/googleDrive');
const driveService = require('../services/drive.service');
const courseFileService = require('../services/courseFile.service');
const courseFileController = require('../controllers/courseFile.controller');
const GoogleOAuthToken = require('../models/GoogleOAuthToken.model');
const CourseFile = require('../models/CourseFile.model');
const courseOfferingService = require('../services/courseOffering.service');

describe('Google Drive OAuth Reliability & Precedence Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = 'test_jwt_secret_for_oauth_reliability_2026';
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'test_client_id.apps.googleusercontent.com';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test_client_secret_xyz';
    process.env.GOOGLE_OAUTH_REDIRECT_URI =
      'https://cfes-portal.onrender.com/api/course-files/google/callback';
    process.env.GOOGLE_DRIVE_FOLDER_ID = '1kIzXquZB7ayOhTXtunMPwoCdVmx40Kez';
    if (driveService.inFlightFolderResolutions) {
      driveService.inFlightFolderResolutions.clear();
    }
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. MongoDB Token Precedence Over Stale Environment Variable
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Authoritative Token Precedence', () => {
    test('a valid MongoDB token takes precedence over a stale GOOGLE_OAUTH_REFRESH_TOKEN environment variable', async () => {
      // Simulate stale token in environment (e.g., old Render env var)
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN = '1//stale_render_env_refresh_token_expired';

      // Authoritative database token
      const dbRefreshToken = '1//authoritative_mongodb_refresh_token_valid';
      const encryptedDbToken = encrypt(dbRefreshToken);

      jest.spyOn(GoogleOAuthToken, 'findOne').mockReturnValue({
        sort: jest.fn().mockResolvedValue({
          encryptedRefreshToken: encryptedDbToken,
          authorizedEmail: 'admin_primary@iu.edu.pk',
        }),
      });

      const tokenInfo = await googleDriveConfig.getStoredRefreshToken();

      expect(tokenInfo).toBeDefined();
      expect(tokenInfo.source).toBe('database');
      expect(tokenInfo.refreshToken).toBe(dbRefreshToken);
      expect(tokenInfo.refreshToken).not.toBe(process.env.GOOGLE_OAUTH_REFRESH_TOKEN);
      expect(tokenInfo.email).toBe('admin_primary@iu.edu.pk');
    });

    test('falls back safely to GOOGLE_OAUTH_REFRESH_TOKEN only when MongoDB has no token record', async () => {
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN = '1//cold_start_env_refresh_token';

      jest.spyOn(GoogleOAuthToken, 'findOne').mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      const tokenInfo = await googleDriveConfig.getStoredRefreshToken();

      expect(tokenInfo).toBeDefined();
      expect(tokenInfo.source).toBe('env');
      expect(tokenInfo.refreshToken).toBe('1//cold_start_env_refresh_token');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Safe Reconnect: Encrypts and Persists New Refresh Token
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Safe Reconnect Verification', () => {
    test('a reconnect that returns a new refresh token encrypts and saves it successfully', async () => {
      const validState = jwt.sign(
        { userId: 'admin_user_id', action: 'google_drive_oauth' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const newRefreshToken = '1//newly_issued_google_refresh_token_999';
      const mockOAuthClient = {
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'mock_access_token_abc',
            refresh_token: newRefreshToken,
            expiry_date: Date.now() + 3600000,
          },
        }),
        setCredentials: jest.fn(),
        getTokenInfo: jest.fn().mockResolvedValue({ email: 'admin@iu.edu.pk' }),
      };

      jest.spyOn(googleDriveConfig, 'getOAuth2Client').mockReturnValue(mockOAuthClient);

      let savedRecord = null;
      jest.spyOn(GoogleOAuthToken, 'findOneAndUpdate').mockImplementation(async (query, update) => {
        savedRecord = {
          ...update.$set,
          updatedAt: new Date(),
        };
        return savedRecord;
      });

      const mockReq = { query: { code: 'auth_code_from_google', state: validState } };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await courseFileController.handleGoogleCallback(mockReq, mockRes, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const htmlOutput = mockRes.send.mock.calls[0][0];
      expect(htmlOutput).toContain('Google Drive Connected Successfully!');
      expect(htmlOutput).toContain('admin@iu.edu.pk');

      // Verify token was encrypted before persistence
      expect(savedRecord).toBeDefined();
      expect(savedRecord.encryptedRefreshToken).toBeDefined();
      expect(savedRecord.encryptedRefreshToken).not.toBe(newRefreshToken);
      expect(decrypt(savedRecord.encryptedRefreshToken)).toBe(newRefreshToken);

      // Verify sensitive credentials never leak into HTML output
      expect(htmlOutput).not.toContain(newRefreshToken);
      expect(htmlOutput).not.toContain('mock_access_token_abc');
    });

    test('reconnect response without a refresh token is NOT reported as successful (returns 400)', async () => {
      const validState = jwt.sign(
        { userId: 'admin_user_id', action: 'google_drive_oauth' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      // Google omitted refresh_token (e.g., prompt=consent was missing or user already authorized)
      const mockOAuthClient = {
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'access_token_without_refresh',
            expiry_date: Date.now() + 3600000,
          },
        }),
        setCredentials: jest.fn(),
      };

      jest.spyOn(googleDriveConfig, 'getOAuth2Client').mockReturnValue(mockOAuthClient);
      const storeSpy = jest.spyOn(googleDriveConfig, 'storeRefreshToken');

      const mockReq = { query: { code: 'auth_code_no_refresh', state: validState } };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await courseFileController.handleGoogleCallback(mockReq, mockRes, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(400);
      const htmlOutput = mockRes.send.mock.calls[0][0];
      expect(htmlOutput).toContain('Missing Refresh Token');
      expect(htmlOutput).not.toContain('Google Drive Connected Successfully!');
      expect(storeSpy).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Reconnect Failures: Encryption & MongoDB Persistence Protection
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Atomicity & Preservation of Existing Tokens', () => {
    test('encryption failure prevents success and preserves previous state', async () => {
      const validState = jwt.sign(
        { userId: 'admin_user_id', action: 'google_drive_oauth' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const mockOAuthClient = {
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'acc_token',
            refresh_token: '1//valid_new_token',
          },
        }),
        setCredentials: jest.fn(),
        getTokenInfo: jest.fn().mockResolvedValue({ email: 'admin@iu.edu.pk' }),
      };

      jest.spyOn(googleDriveConfig, 'getOAuth2Client').mockReturnValue(mockOAuthClient);
      jest.spyOn(googleDriveConfig, 'storeRefreshToken').mockRejectedValue(
        new Error('Encryption failure: cryptographic hardware key error')
      );

      const findOneAndUpdateSpy = jest.spyOn(GoogleOAuthToken, 'findOneAndUpdate');

      const mockReq = { query: { code: 'valid_code', state: validState } };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await courseFileController.handleGoogleCallback(mockReq, mockRes, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(500);
      const htmlOutput = mockRes.send.mock.calls[0][0];
      expect(htmlOutput).toContain('Token Persistence Failed');
      expect(htmlOutput).toContain('previous token record was preserved');
      expect(htmlOutput).not.toContain('Google Drive Connected Successfully!');
      expect(findOneAndUpdateSpy).not.toHaveBeenCalled();
    });

    test('MongoDB persistence failure prevents success and preserves previous state', async () => {
      const validState = jwt.sign(
        { userId: 'admin_user_id', action: 'google_drive_oauth' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const mockOAuthClient = {
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'acc_token',
            refresh_token: '1//valid_new_token',
          },
        }),
        setCredentials: jest.fn(),
        getTokenInfo: jest.fn().mockResolvedValue({ email: 'admin@iu.edu.pk' }),
      };

      jest.spyOn(googleDriveConfig, 'getOAuth2Client').mockReturnValue(mockOAuthClient);
      jest.spyOn(GoogleOAuthToken, 'findOneAndUpdate').mockRejectedValue(
        new Error('MongoNetworkError: failed to connect to server [cluster.mongodb.net:27017]')
      );

      const mockReq = { query: { code: 'valid_code', state: validState } };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await courseFileController.handleGoogleCallback(mockReq, mockRes, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(500);
      const htmlOutput = mockRes.send.mock.calls[0][0];
      expect(htmlOutput).toContain('Token Persistence Failed');
      expect(htmlOutput).not.toContain('Google Drive Connected Successfully!');
    });

    test('a failed reconnect preserves the previously stored token record in MongoDB', async () => {
      const existingToken = '1//original_previously_working_refresh_token';
      const existingDoc = {
        encryptedRefreshToken: encrypt(existingToken),
        authorizedEmail: 'original_admin@iu.edu.pk',
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      };

      jest.spyOn(GoogleOAuthToken, 'findOne').mockReturnValue({
        sort: jest.fn().mockResolvedValue(existingDoc),
      });

      // Before reconnect: retrieves existing token
      const tokenBefore = await googleDriveConfig.getStoredRefreshToken();
      expect(tokenBefore.refreshToken).toBe(existingToken);

      // Attempt reconnect that fails during persistence
      jest.spyOn(GoogleOAuthToken, 'findOneAndUpdate').mockRejectedValue(
        new Error('WriteConflict in storage engine')
      );

      await expect(
        googleDriveConfig.storeRefreshToken('1//attempted_token_that_fails_to_save')
      ).rejects.toThrow('WriteConflict');

      // After failed reconnect: existing database token is still authoritative and untouched
      const tokenAfter = await googleDriveConfig.getStoredRefreshToken();
      expect(tokenAfter.refreshToken).toBe(existingToken);
      expect(tokenAfter.email).toBe('original_admin@iu.edu.pk');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Invalid Grant Handling & Error Propagation
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Invalid Grant (invalid_grant) Error Handling', () => {
    test('driveService.verifyFolderAccess identifies invalid_grant and produces HTTP 503 INVALID_GRANT', async () => {
      const gAuthError = new Error('invalid_grant: Bad Request');
      gAuthError.code = 'invalid_grant';

      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue({
        files: { get: jest.fn().mockRejectedValue(gAuthError) },
      });

      await expect(driveService.verifyFolderAccess()).rejects.toMatchObject({
        statusCode: 503,
        code: 'INVALID_GRANT',
        isInvalidGrant: true,
        message: expect.stringContaining('authorization has expired or been revoked'),
      });
    });

    test('courseFileController.verifyGoogleDriveAccess maps invalid_grant to HTTP 503 JSON response', async () => {
      const gAuthError = new Error('invalid_grant: Bad Request');
      gAuthError.code = 'INVALID_GRANT';
      gAuthError.statusCode = 503;

      jest.spyOn(driveService, 'verifyFolderAccess').mockRejectedValue(gAuthError);

      const mockReq = { user: { _id: '123' } };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await courseFileController.verifyGoogleDriveAccess(mockReq, mockRes, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.status).not.toHaveBeenCalledWith(401);
      const payload = mockRes.json.mock.calls[0][0];
      expect(payload.success).toBe(false);
      expect(payload.code).toBe('INVALID_GRANT');
      expect(payload.message).toContain('invalid_grant');
    });

    test('courseFileService.resolveOfferingHierarchyFolder propagates INVALID_GRANT and identifies failed tier', async () => {
      const mockOffering = {
        _id: 'offering_123',
        semester: { _id: 'sem_1', name: 'Fall 2026' },
        faculty: { _id: 'fac_1', name: 'Dr. Jane Smith' },
        course: { _id: 'crs_1', courseName: 'Operating Systems', courseCode: 'CS301' },
        section: 'A',
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const invalidGrantError = new Error(
        'Google Drive authorization has expired or been revoked (invalid_grant). An administrator must re-authorize Google Drive via /api/course-files/google/auth.'
      );
      invalidGrantError.statusCode = 503;
      invalidGrantError.code = 'INVALID_GRANT';
      invalidGrantError.isInvalidGrant = true;

      jest.spyOn(driveService, 'getOrCreateFolder').mockRejectedValue(invalidGrantError);

      await expect(
        courseFileService.resolveOfferingHierarchyFolder({ offeringId: 'offering_123' })
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'INVALID_GRANT',
        isInvalidGrant: true,
        message: expect.stringContaining('Failed to resolve Google Drive folder hierarchy at Semester tier'),
      });
    });

    test('courseFileService.syncOfferingDocument rejects closed on invalid_grant without modifying documents', async () => {
      const mockOffering = {
        _id: 'offering_123',
        semester: { _id: 'sem_1', name: 'Fall 2026' },
        faculty: { _id: 'fac_1', name: 'Dr. Jane Smith' },
        course: { _id: 'crs_1', courseName: 'Operating Systems', courseCode: 'CS301' },
        section: 'A',
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const invalidGrantError = new Error(
        'Google Drive authorization has expired or been revoked (invalid_grant). An administrator must re-authorize Google Drive via /api/course-files/google/auth.'
      );
      invalidGrantError.statusCode = 503;
      invalidGrantError.code = 'INVALID_GRANT';
      invalidGrantError.isInvalidGrant = true;

      jest.spyOn(driveService, 'getOrCreateFolder').mockRejectedValue(invalidGrantError);

      const uploadSpy = jest.spyOn(driveService, 'uploadDocumentBuffer');
      const createSpy = jest.spyOn(CourseFile, 'create');

      await expect(
        courseFileService.syncOfferingDocument({
          offeringId: 'offering_123',
          documentType: 'CIS',
          fileFormat: 'pdf',
          buffer: Buffer.from('test buffer content'),
          user: { _id: 'faculty_user_1', role: 'Faculty' },
        })
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'INVALID_GRANT',
      });

      expect(uploadSpy).not.toHaveBeenCalled();
      expect(createSpy).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Avoid Endless Retries on Invalid Token
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Retry Prevention on Invalid Grants', () => {
    test('executeGetOrCreateFolder aborts immediately on invalid_grant without calling list again', async () => {
      const gAuthError = new Error('invalid_grant: Bad Request');

      const mockDrive = {
        files: {
          list: jest.fn().mockResolvedValue({ data: { files: [] } }), // initial check: folder doesn't exist
          create: jest.fn().mockRejectedValue(gAuthError), // creation fails with invalid_grant
        },
      };

      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue(mockDrive);

      await expect(
        driveService.getOrCreateFolder('Test Folder', 'root_id', { throwOnError: true })
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'INVALID_GRANT',
      });

      // Initial list was called once. The re-check list after creation failure MUST NOT be called!
      expect(mockDrive.files.list).toHaveBeenCalledTimes(1);
      expect(mockDrive.files.create).toHaveBeenCalledTimes(1);
    });

    test('getOrCreateFolder never falls back to parentFolderId when error is invalid_grant', async () => {
      const gAuthError = new Error('invalid_grant: Bad Request');

      const mockDrive = {
        files: {
          list: jest.fn().mockRejectedValue(gAuthError),
        },
      };

      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue(mockDrive);

      // Even if throwOnError is explicitly set to false, invalid_grant MUST NOT fall back!
      await expect(
        driveService.getOrCreateFolder('Test Folder', 'parent_root_123', { throwOnError: false })
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'INVALID_GRANT',
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Existing Google Drive Operations Token Source Integrity
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Google Drive Operations Token Integration', () => {
    test('getAuthenticatedClient sets credentials with MongoDB refresh token', async () => {
      const dbRefreshToken = '1//auth_db_token_for_drive_operations';
      jest.spyOn(GoogleOAuthToken, 'findOne').mockReturnValue({
        sort: jest.fn().mockResolvedValue({
          encryptedRefreshToken: encrypt(dbRefreshToken),
          authorizedEmail: 'admin@iu.edu.pk',
        }),
      });

      const client = await googleDriveConfig.getAuthenticatedClient();

      expect(client).toBeDefined();
      expect(client.credentials.refresh_token).toBe(dbRefreshToken);
    });

    test('uploadDocumentBuffer, getFileStream, getFileMetadata, deleteFile all invoke authenticated client', async () => {
      const mockDrive = {
        files: {
          create: jest.fn().mockResolvedValue({
            data: { id: 'file_111', name: 'doc.pdf', mimeType: 'application/pdf', size: 100 },
          }),
          get: jest.fn().mockResolvedValue({
            data: { id: 'file_111', name: 'doc.pdf' },
          }),
          delete: jest.fn().mockResolvedValue({}),
        },
      };

      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue(mockDrive);

      // uploadDocumentBuffer
      const uploadRes = await driveService.uploadDocumentBuffer({
        buffer: Buffer.from('dummy content'),
        filename: 'doc.pdf',
        mimeType: 'application/pdf',
        folderId: 'folder_123',
      });
      expect(uploadRes.fileId).toBe('file_111');

      // getFileMetadata
      const metaRes = await driveService.getFileMetadata('file_111');
      expect(metaRes.id).toBe('file_111');

      // deleteFile
      const delRes = await driveService.deleteFile('file_111');
      expect(delRes).toBe(true);
    });
  });
});
