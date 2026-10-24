/**
 * crypto.js — AES-256-GCM authenticated encryption utility.
 *
 * Used for encrypting sensitive tokens (e.g., OAuth refresh tokens) at rest
 * in MongoDB. Derives a 256-bit encryption key from JWT_SECRET.
 */
const crypto = require('node:crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM
const SALT = 'cfes_portal_token_salt_v1';

/**
 * Derives a 32-byte key from the application secret.
 */
const getEncryptionKey = () => {
  const secret = process.env.JWT_SECRET || 'cfes_default_fallback_secret_key_2026';
  return crypto.scryptSync(secret, SALT, 32);
};

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * @param {string} text - Plaintext to encrypt
 * @returns {string} Colon-delimited string: "ivHex:authTagHex:ciphertextHex"
 */
const encrypt = (text) => {
  if (!text || typeof text !== 'string') {
    throw new Error('Text to encrypt must be a non-empty string.');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * Decrypts an AES-256-GCM encrypted string.
 *
 * @param {string} encryptedPayload - Colon-delimited string: "ivHex:authTagHex:ciphertextHex"
 * @returns {string} Decrypted plaintext string
 */
const decrypt = (encryptedPayload) => {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') {
    throw new Error('Payload to decrypt must be a non-empty string.');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format. Expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

module.exports = {
  encrypt,
  decrypt,
};
