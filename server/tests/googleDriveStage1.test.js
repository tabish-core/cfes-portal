/**
 * googleDriveStage1.test.js — Automated test suite for Stage 1 Google Drive OAuth integration.
 *
 * Verifies:
 *  1. AES-256-GCM Token Encryption & Decryption (`utils/crypto.js`):
 *     - Round-trip encryption and decryption
 *     - Random IV per encryption
 *     - Rejection of tampered payloads and invalid formats
 *  2. OAuth Configuration & Credential Resolution (`config/googleDrive.js`):
 *     - Missing client ID / secret error handling
 *     - Environment variable refresh token priority
 *     - Decrypted MongoDB refresh token fallback
 *     - Encrypted token storage
 *     - Missing token rejection (GOOGLE_AUTH_REQUIRED)
 *  3. Drive Service & Folder Access Verification (`services/drive.service.js`):
 *     - Verification using `supportsAllDrives: true`
 *     - Validates folder mimeType and `canAddChildren` write capability
 *     - Handles trashed folders, 404 Not Found, 403 Forbidden, and invalid_grant
 *  4. Controller & Route Endpoints (`controllers/courseFile.controller.js`):
 *     - `initiateGoogleAuth`: CSRF state token generation and auth URL structure
 *     - `handleGoogleCallback`: CSRF validation, code exchange, and secure HTML output
 *     - `getGoogleAuthStatus`: connection status without secret exposure
 *     - `verifyGoogleDriveAccess`: end-to-end folder verification response
 *  5. Route Registration:
 *     - Confirms all 4 Google OAuth endpoints are registered on the router
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { encrypt, decrypt } = require('../utils/crypto');
const googleDriveConfig = require('../config/googleDrive');
const driveService = require('../services/drive.service');
const courseFileController = require('../controllers/courseFile.controller');
const courseFileRoutes = require('../routes/courseFile.routes');
const GoogleOAuthToken = require('../models/GoogleOAuthToken.model');

describe('Stage 1: Google Drive OAuth & Client Verification Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = 'test_jwt_secret_for_stage1_testing_2026';
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'test_client_id.apps.googleusercontent.com';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test_client_secret_xyz';
    process.env.GOOGLE_OAUTH_REDIRECT_URI =
      'https://cfes-portal.onrender.com/api/course-files/google/callback';
    process.env.GOOGLE_DRIVE_FOLDER_ID = '1kIzXquZB7ayOhTXtunMPwoCdVmx40Kez';
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. AES-256-GCM Token Encryption & Decryption
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. AES-256-GCM Token Encryption & Decryption (utils/crypto.js)', () => {
    test('Encrypts and decrypts a sample refresh token accurately', () => {
      const sampleRefreshToken = '1//04test_refresh_token_abcdef1234567890';
      const encrypted = encrypt(sampleRefreshToken);

      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(sampleRefreshToken);
      expect(encrypted.split(':').length).toBe(3); // iv:authTag:ciphertext

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(sampleRefreshToken);
    });

    test('Produces different ciphertexts for the same plaintext due to random IV', () => {
      const token = '1//04same_token_value_random_iv_check';
      const encrypted1 = encrypt(token);
      const encrypted2 = encrypt(token);

      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1)).toBe(token);
      expect(decrypt(encrypted2)).toBe(token);
    });

    test('Rejects empty or non-string inputs with descriptive errors', () => {
      expect(() => encrypt('')).toThrow(/must be a non-empty string/);
      expect(() => encrypt(null)).toThrow(/must be a non-empty string/);
      expect(() => decrypt('')).toThrow(/must be a non-empty string/);
      expect(() => decrypt(null)).toThrow(/must be a non-empty string/);
    });

    test('Throws on malformed or tampered encrypted payloads', () => {
      expect(() => decrypt('malformed_no_colons')).toThrow(/Invalid encrypted payload format/);

      const valid = encrypt('valid_payload_to_tamper');
      const parts = valid.split(':');
      // Tamper with ciphertext
      parts[2] = parts[2].slice(0, -2) + 'aa';
      expect(() => decrypt(parts.join(':'))).toThrow(); // Authentication tag verification failure
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. OAuth Configuration & Credential Resolution (config/googleDrive.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. OAuth Configuration & Credential Resolution (config/googleDrive.js)', () => {
    test('Throws error when GOOGLE_OAUTH_CLIENT_ID or CLIENT_SECRET is missing', () => {
      delete process.env.GOOGLE_OAUTH_CLIENT_ID;
      expect(() => googleDriveConfig.getOAuth2Client()).toThrow(/Client ID and Secret must be configured/);
    });

    test('Constructs OAuth2Client with configured environment parameters', () => {
      const client = googleDriveConfig.getOAuth2Client();
      expect(client).toBeDefined();
      expect(client._clientId).toBe('test_client_id.apps.googleusercontent.com');
      expect(client._clientSecret).toBe('test_client_secret_xyz');
      expect(client.redirectUri).toBe(
        'https://cfes-portal.onrender.com/api/course-files/google/callback'
      );
    });

    test('getStoredRefreshToken prioritizes static GOOGLE_OAUTH_REFRESH_TOKEN env var', async () => {
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN = '1//static_env_refresh_token';
      const tokenInfo = await googleDriveConfig.getStoredRefreshToken();
      expect(tokenInfo).toBeDefined();
      expect(tokenInfo.refreshToken).toBe('1//static_env_refresh_token');
      expect(tokenInfo.source).toBe('env');
    });

    test('getStoredRefreshToken retrieves and decrypts token from MongoDB when env var is absent', async () => {
      delete process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
      const rawToken = '1//db_stored_refresh_token_test';
      const encrypted = encrypt(rawToken);

      jest.spyOn(GoogleOAuthToken, 'findOne').mockReturnValue({
        sort: jest.fn().mockResolvedValue({
          encryptedRefreshToken: encrypted,
          authorizedEmail: 'faculty@iu.edu.pk',
        }),
      });

      const tokenInfo = await googleDriveConfig.getStoredRefreshToken();
      expect(tokenInfo).toBeDefined();
      expect(tokenInfo.refreshToken).toBe(rawToken);
      expect(tokenInfo.source).toBe('database');
      expect(tokenInfo.email).toBe('faculty@iu.edu.pk');
    });

    test('getStoredRefreshToken returns null when no token exists in env or database', async () => {
      delete process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
      jest.spyOn(GoogleOAuthToken, 'findOne').mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      const tokenInfo = await googleDriveConfig.getStoredRefreshToken();
      expect(tokenInfo).toBeNull();
    });

    test('getAuthenticatedClient throws 401 GOOGLE_AUTH_REQUIRED when no credentials exist', async () => {
      delete process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
      jest.spyOn(GoogleOAuthToken, 'findOne').mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      await expect(googleDriveConfig.getAuthenticatedClient()).rejects.toMatchObject({
        statusCode: 401,
        code: 'GOOGLE_AUTH_REQUIRED',
      });
    });

    test('storeRefreshToken encrypts token and saves to GoogleOAuthToken collection', async () => {
      const mockSaved = {
        authorizedEmail: 'user@iu.edu.pk',
        updatedAt: new Date(),
      };
      jest.spyOn(GoogleOAuthToken, 'findOneAndUpdate').mockResolvedValue(mockSaved);

      const result = await googleDriveConfig.storeRefreshToken('1//raw_token_to_save', {
        email: 'user@iu.edu.pk',
      });

      expect(result.success).toBe(true);
      expect(result.email).toBe('user@iu.edu.pk');
      expect(GoogleOAuthToken.findOneAndUpdate).toHaveBeenCalled();
      const callArgs = GoogleOAuthToken.findOneAndUpdate.mock.calls[0][1].$set;
      expect(callArgs.encryptedRefreshToken).not.toBe('1//raw_token_to_save');
      expect(decrypt(callArgs.encryptedRefreshToken)).toBe('1//raw_token_to_save');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Drive Service & Folder Access Verification (services/drive.service.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Drive Service & Folder Access Verification (services/drive.service.js)', () => {
    test('verifyFolderAccess confirms access to Shared Drive folder with supportsAllDrives: true', async () => {
      const mockFolderData = {
        id: '1kIzXquZB7ayOhTXtunMPwoCdVmx40Kez',
        name: 'CFES Faculty Course Dossiers',
        mimeType: 'application/vnd.google-apps.folder',
        trashed: false,
        driveId: '0AAAbcSharedDrive123',
        capabilities: {
          canAddChildren: true,
          canEdit: true,
        },
        webViewLink: 'https://drive.google.com/drive/folders/1kIzXquZB7ayOhTXtunMPwoCdVmx40Kez',
      };

      const mockGet = jest.fn().mockResolvedValue({ data: mockFolderData });
      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue({
        files: { get: mockGet },
      });

      const result = await driveService.verifyFolderAccess('1kIzXquZB7ayOhTXtunMPwoCdVmx40Kez');

      expect(mockGet).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: '1kIzXquZB7ayOhTXtunMPwoCdVmx40Kez',
          supportsAllDrives: true,
        })
      );
      expect(result.success).toBe(true);
      expect(result.folderName).toBe('CFES Faculty Course Dossiers');
      expect(result.isSharedDrive).toBe(true);
      expect(result.canAddChildren).toBe(true);
      expect(result.hasWriteAccess).toBe(true);
    });

    test('verifyFolderAccess rejects trashed destination folder with 400', async () => {
      const mockFolderData = {
        id: '1kIzXquZB7ayOhTXtunMPwoCdVmx40Kez',
        name: 'Deleted Folder',
        mimeType: 'application/vnd.google-apps.folder',
        trashed: true,
      };

      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue({
        files: { get: jest.fn().mockResolvedValue({ data: mockFolderData }) },
      });

      await expect(
        driveService.verifyFolderAccess('1kIzXquZB7ayOhTXtunMPwoCdVmx40Kez')
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringMatching(/currently in the Google Drive Trash/),
      });
    });

    test('verifyFolderAccess rejects target that is not a folder (mimeType mismatch)', async () => {
      const mockFileData = {
        id: '1kIzXquZB7ayOhTXtunMPwoCdVmx40Kez',
        name: 'document.pdf',
        mimeType: 'application/pdf',
        trashed: false,
      };

      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue({
        files: { get: jest.fn().mockResolvedValue({ data: mockFileData }) },
      });

      await expect(
        driveService.verifyFolderAccess('1kIzXquZB7ayOhTXtunMPwoCdVmx40Kez')
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringMatching(/is not a folder/),
      });
    });

    test('verifyFolderAccess handles Google 404 (folder not found or no access)', async () => {
      const gError = new Error('File not found');
      gError.code = 404;

      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue({
        files: { get: jest.fn().mockRejectedValue(gError) },
      });

      await expect(
        driveService.verifyFolderAccess('non_existent_folder_id')
      ).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringMatching(/not found.*granted access as an Editor/),
      });
    });

    test('verifyFolderAccess handles Google 403 (forbidden / insufficient permissions)', async () => {
      const gError = new Error('The user does not have sufficient permissions for this file.');
      gError.code = 403;

      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue({
        files: { get: jest.fn().mockRejectedValue(gError) },
      });

      await expect(
        driveService.verifyFolderAccess('restricted_folder_id')
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringMatching(/Permission denied/),
      });
    });

    test('verifyFolderAccess handles revoked credentials (invalid_grant)', async () => {
      const gError = new Error('invalid_grant: Bad Request');

      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue({
        files: { get: jest.fn().mockRejectedValue(gError) },
      });

      await expect(
        driveService.verifyFolderAccess('1kIzXquZB7ayOhTXtunMPwoCdVmx40Kez')
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_GRANT',
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Controller & Route Endpoints (controllers/courseFile.controller.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Controller & Route Endpoints (controllers/courseFile.controller.js)', () => {
    test('initiateGoogleAuth generates valid auth URL containing CSRF state token and offline access', async () => {
      const mockReq = {
        user: { _id: new mongoose.Types.ObjectId(), email: 'faculty@iu.edu.pk' },
        query: {},
        headers: { accept: 'application/json' },
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        redirect: jest.fn(),
      };

      await courseFileController.initiateGoogleAuth(mockReq, mockRes, jest.fn());

      expect(mockRes.json).toHaveBeenCalled();
      const payload = mockRes.json.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data.authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(payload.data.authUrl).toContain('access_type=offline');
      expect(payload.data.authUrl).toContain('prompt=consent');
      expect(payload.data.authUrl).toContain('state=');

      // Verify the state parameter is a valid JWT signed with JWT_SECRET
      const url = new URL(payload.data.authUrl);
      const state = url.searchParams.get('state');
      const decoded = jwt.verify(state, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(mockReq.user._id.toString());
      expect(decoded.action).toBe('google_drive_oauth');
    });

    test('initiateGoogleAuth redirects when redirect=true query parameter is supplied', async () => {
      const mockReq = {
        user: { _id: new mongoose.Types.ObjectId(), email: 'faculty@iu.edu.pk' },
        query: { redirect: 'true' },
        headers: {},
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        redirect: jest.fn(),
      };

      await courseFileController.initiateGoogleAuth(mockReq, mockRes, jest.fn());

      expect(mockRes.redirect).toHaveBeenCalled();
      expect(mockRes.redirect.mock.calls[0][0]).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    });

    test('handleGoogleCallback rejects requests with invalid or tampered CSRF state (400)', async () => {
      const mockReq = {
        query: { code: 'fake_auth_code', state: 'invalid_tampered_state' },
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await courseFileController.handleGoogleCallback(mockReq, mockRes, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send.mock.calls[0][0]).toContain('Invalid or Expired State');
    });

    test('handleGoogleCallback exchanges valid code for tokens and renders success HTML', async () => {
      const validState = jwt.sign(
        { userId: '123', action: 'google_drive_oauth' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const mockTokens = {
        access_token: 'mock_access_token_abc',
        refresh_token: '1//mock_refresh_token_xyz',
        expiry_date: Date.now() + 3600000,
      };

      const mockOAuthClient = {
        getToken: jest.fn().mockResolvedValue({ tokens: mockTokens }),
        setCredentials: jest.fn(),
        getTokenInfo: jest.fn().mockResolvedValue({ email: 'authorized_user@gmail.com' }),
      };

      jest.spyOn(googleDriveConfig, 'getOAuth2Client').mockReturnValue(mockOAuthClient);
      jest.spyOn(googleDriveConfig, 'storeRefreshToken').mockResolvedValue({ success: true });

      const mockReq = {
        query: { code: 'valid_code_from_google', state: validState },
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await courseFileController.handleGoogleCallback(mockReq, mockRes, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const htmlOutput = mockRes.send.mock.calls[0][0];
      expect(htmlOutput).toContain('Google Drive Connected Successfully!');
      expect(htmlOutput).toContain('authorized_user@gmail.com');
      expect(googleDriveConfig.storeRefreshToken).toHaveBeenCalledWith(
        '1//mock_refresh_token_xyz',
        expect.objectContaining({ email: 'authorized_user@gmail.com' })
      );
      // Ensures tokens are NEVER rendered into the HTML response
      expect(htmlOutput).not.toContain('mock_access_token_abc');
      expect(htmlOutput).not.toContain('1//mock_refresh_token_xyz');
    });

    test('getGoogleAuthStatus returns connection status without leaking credentials', async () => {
      jest.spyOn(driveService, 'getConnectionStatus').mockResolvedValue({
        isConfigured: true,
        source: 'database',
        authorizedEmail: 'user@iu.edu.pk',
        destinationFolderId: '1kIzXquZB7ayOhTXtunMPwoCdVmx40Kez',
      });

      const mockReq = { user: { _id: '123' } };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await courseFileController.getGoogleAuthStatus(mockReq, mockRes, jest.fn());

      expect(mockRes.json).toHaveBeenCalled();
      const payload = mockRes.json.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data.isConfigured).toBe(true);
      expect(payload.data.authorizedEmail).toBe('user@iu.edu.pk');
      expect(payload.data.refreshToken).toBeUndefined();
    });

    test('verifyGoogleDriveAccess calls driveService and returns verified result', async () => {
      const mockResult = {
        success: true,
        folderName: 'CFES Dossiers',
        folderId: '1kIzXquZB7ayOhTXtunMPwoCdVmx40Kez',
        canAddChildren: true,
        hasWriteAccess: true,
      };

      jest.spyOn(driveService, 'verifyFolderAccess').mockResolvedValue(mockResult);

      const mockReq = { user: { _id: '123' } };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await courseFileController.verifyGoogleDriveAccess(mockReq, mockRes, jest.fn());

      expect(mockRes.json).toHaveBeenCalled();
      const payload = mockRes.json.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data.folderName).toBe('CFES Dossiers');
      expect(payload.data.hasWriteAccess).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Route Registration Integrity
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Route Registration Integrity (routes/courseFile.routes.js)', () => {
    test('Exposes GET /google/auth, /google/callback, /google/status, /google/verify', () => {
      const registeredRoutes = courseFileRoutes.stack
        .filter((layer) => layer.route)
        .map((layer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const authRoute = registeredRoutes.find((r) => r.path === '/google/auth');
      const callbackRoute = registeredRoutes.find((r) => r.path === '/google/callback');
      const statusRoute = registeredRoutes.find((r) => r.path === '/google/status');
      const verifyRoute = registeredRoutes.find((r) => r.path === '/google/verify');

      expect(authRoute).toBeDefined();
      expect(authRoute.methods).toContain('get');

      expect(callbackRoute).toBeDefined();
      expect(callbackRoute.methods).toContain('get');

      expect(statusRoute).toBeDefined();
      expect(statusRoute.methods).toContain('get');

      expect(verifyRoute).toBeDefined();
      expect(verifyRoute.methods).toContain('get');
    });
  });
});
