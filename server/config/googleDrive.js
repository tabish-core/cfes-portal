/**
 * googleDrive.js — Google Drive API client and OAuth 2.0 configuration.
 *
 * Provides:
 *  - Configured OAuth 2.0 Web application client
 *  - Secure retrieval of refresh token (from env var or decrypted from MongoDB)
 *  - Secure token storage using AES-256-GCM
 *  - Authenticated OAuth2 client for Google Drive API v3 operations
 */
const { google } = require('googleapis');
const GoogleOAuthToken = require('../models/GoogleOAuthToken.model');
const { encrypt, decrypt } = require('../utils/crypto');

const SCOPES = ['https://www.googleapis.com/auth/drive'];

const DEFAULT_REDIRECT_URI =
  'https://cfes-portal.onrender.com/api/course-files/google/callback';

const cleanEnv = (val) => (typeof val === 'string' ? val.trim().replace(/^["']|["']$/g, '') : '');

const DESTINATION_FOLDER_ID =
  cleanEnv(process.env.GOOGLE_DRIVE_FOLDER_ID) || '1kIzXquZB7ayOhTXtunMPwoCdVmx40Kez';

/**
 * Creates and returns a fresh Google OAuth2 client.
 *
 * Supports both standard and alias variable names:
 *  - GOOGLE_OAUTH_CLIENT_ID / GOOGLE_CLIENT_ID
 *  - GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_CLIENT_SECRET
 *  - GOOGLE_OAUTH_REDIRECT_URI / GOOGLE_REDIRECT_URI
 *
 * @returns {import('googleapis').Auth.OAuth2Client}
 */
const getOAuth2Client = () => {
  const clientId =
    cleanEnv(process.env.GOOGLE_OAUTH_CLIENT_ID) ||
    cleanEnv(process.env.GOOGLE_CLIENT_ID);

  const clientSecret =
    cleanEnv(process.env.GOOGLE_OAUTH_CLIENT_SECRET) ||
    cleanEnv(process.env.GOOGLE_CLIENT_SECRET);

  const redirectUri =
    cleanEnv(process.env.GOOGLE_OAUTH_REDIRECT_URI) ||
    cleanEnv(process.env.GOOGLE_REDIRECT_URI) ||
    DEFAULT_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    const error = new Error(
      `Google OAuth Client ID and Secret must be configured via GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET (detected clientId: ${Boolean(clientId)}, clientSecret: ${Boolean(clientSecret)}). Please check Render Environment variables and ensure deployment is live.`
    );
    error.statusCode = 503;
    throw error;
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

/**
 * Returns safe boolean flags indicating if client credentials exist in environment.
 * Never exposes actual secret strings.
 */
const getClientConfigStatus = () => {
  const clientId =
    cleanEnv(process.env.GOOGLE_OAUTH_CLIENT_ID) ||
    cleanEnv(process.env.GOOGLE_CLIENT_ID);

  const clientSecret =
    cleanEnv(process.env.GOOGLE_OAUTH_CLIENT_SECRET) ||
    cleanEnv(process.env.GOOGLE_CLIENT_SECRET);

  return {
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
    isConfigured: Boolean(clientId && clientSecret),
  };
};

/**
 * Retrieves the refresh token from environment variables or decrypted from MongoDB.
 *
 * Priority:
 *  1. Environment variable GOOGLE_OAUTH_REFRESH_TOKEN (static override)
 *  2. Decrypted token stored in MongoDB (via OAuth authorization callback)
 *
 * @returns {Promise<{ refreshToken: string, source: 'env' | 'database', email?: string } | null>}
 */
const getStoredRefreshToken = async () => {
  // 1. Static environment variable override
  const staticToken = cleanEnv(process.env.GOOGLE_OAUTH_REFRESH_TOKEN);
  if (staticToken) {
    return {
      refreshToken: staticToken,
      source: 'env',
    };
  }

  // 2. Database persistent token
  try {
    const tokenDoc = await GoogleOAuthToken.findOne().sort({ updatedAt: -1 });
    if (!tokenDoc || !tokenDoc.encryptedRefreshToken) {
      return null;
    }

    const decrypted = decrypt(tokenDoc.encryptedRefreshToken);
    return {
      refreshToken: decrypted,
      source: 'database',
      email: tokenDoc.authorizedEmail,
    };
  } catch (err) {
    console.error('Error decrypting stored Google OAuth token:', err.message);
    return null;
  }
};

/**
 * Securely encrypts and stores the refresh token in MongoDB.
 *
 * @param {string} refreshToken - Plaintext refresh token from Google OAuth
 * @param {Object} metadata - Optional metadata (email, scopes, expiryDate)
 * @returns {Promise<Object>} Saved token document (without plaintext token)
 */
const storeRefreshToken = async (refreshToken, metadata = {}) => {
  if (!refreshToken) {
    throw new Error('Refresh token is required for storage.');
  }

  const encryptedRefreshToken = encrypt(refreshToken);

  const updateData = {
    encryptedRefreshToken,
    authorizedEmail: metadata.email || '',
    scopes: metadata.scopes || SCOPES,
    expiryDate: metadata.expiryDate || null,
    lastVerifiedAt: new Date(),
  };

  const saved = await GoogleOAuthToken.findOneAndUpdate(
    {},
    { $set: updateData },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    success: true,
    email: saved.authorizedEmail,
    updatedAt: saved.updatedAt,
  };
};

/**
 * Returns an authenticated OAuth2 client ready to make Google Drive API calls.
 *
 * @returns {Promise<import('googleapis').Auth.OAuth2Client>}
 */
const getAuthenticatedClient = async () => {
  const oauth2Client = getOAuth2Client();
  const tokenInfo = await getStoredRefreshToken();

  if (!tokenInfo || !tokenInfo.refreshToken) {
    const error = new Error(
      'Google Drive is not connected. Please authorize the portal via /api/course-files/google/auth or configure GOOGLE_OAUTH_REFRESH_TOKEN.'
    );
    error.statusCode = 401;
    error.code = 'GOOGLE_AUTH_REQUIRED';
    throw error;
  }

  oauth2Client.setCredentials({
    refresh_token: tokenInfo.refreshToken,
  });

  // Automatically update expiry/tokens if a new token event is fired
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.refresh_token) {
      try {
        await storeRefreshToken(tokens.refresh_token, {
          expiryDate: tokens.expiry_date,
        });
      } catch (err) {
        console.error('Failed to persist refreshed OAuth token:', err.message);
      }
    }
  });

  return oauth2Client;
};

module.exports = {
  getOAuth2Client,
  getClientConfigStatus,
  getStoredRefreshToken,
  storeRefreshToken,
  getAuthenticatedClient,
  SCOPES,
  DESTINATION_FOLDER_ID,
};
