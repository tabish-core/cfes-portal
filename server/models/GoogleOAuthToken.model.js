/**
 * GoogleOAuthToken.model.js — Secure MongoDB model for stored Google OAuth tokens.
 *
 * Stores the AES-256-GCM encrypted refresh token and metadata on the server.
 * Never stores or returns plaintext refresh tokens.
 */
const mongoose = require('mongoose');

const googleOAuthTokenSchema = new mongoose.Schema(
  {
    encryptedRefreshToken: {
      type: String,
      required: [true, 'Encrypted refresh token is required'],
    },
    authorizedEmail: {
      type: String,
      default: '',
      trim: true,
    },
    scopes: {
      type: [String],
      default: [],
    },
    expiryDate: {
      type: Number,
      default: null,
    },
    lastVerifiedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GoogleOAuthToken', googleOAuthTokenSchema);
