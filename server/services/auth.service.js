/**
 * auth.service.js — Pure business logic for authentication.
 * No req/res here — keeps controllers thin and this layer testable.
 */
const jwt  = require('jsonwebtoken');
const User = require('../models/User.model');

/* ── Token helpers ──────────────────────────────────────── */

/**
 * Sign a JWT with the user's id and designation.
 * @param {{ id: string, designation: string }} payload
 * @returns {string} signed JWT
 */
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * Verify and decode a JWT string.
 * @param {string} token
 * @returns {object} decoded payload
 */
const decodeToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

/* ── Auth operations ────────────────────────────────────── */

/**
 * Register a new user (called by Admin only — enforced at route level).
 * @param {{ name, email, password, designation, department }} data
 * @returns {{ user: User, token: string }}
 */
const register = async ({ name, email, password, designation, department }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    const err = new Error('A user with this email already exists');
    err.statusCode = 409;
    throw err;
  }

  // Password is hashed by the pre-save hook on User model
  const user  = await User.create({ name, email, password, designation, department });
  const token = generateToken({ id: user._id, designation: user.designation });

  // Automatically link HoD to Department if applicable
  if (user.designation === 'hod' && user.department) {
    const Department = require('../models/Department.model');
    await Department.findByIdAndUpdate(user.department, { hod: user._id });
  }

  return { user, token };
};

/**
 * Authenticate a user by email + password and return a JWT.
 * @param {{ email, password }} credentials
 * @returns {{ user: User, token: string }}
 */
const login = async ({ email, password }) => {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    const err = new Error('Email and password are required');
    err.statusCode = 400;
    throw err;
  }

  // Explicitly select password (it has select:false on schema)
  const user = await User.findOne({ email: normalizedEmail }).select('+password');

  if (!user) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  if (!user.isActive) {
    const err = new Error('Your account has been deactivated. Contact an administrator.');
    err.statusCode = 403;
    throw err;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const token = generateToken({ id: user._id, designation: user.designation });
  return { user, token };
};

module.exports = { generateToken, decodeToken, register, login };
