/**
 * auth.controller.js — Thin handler layer for auth routes.
 * All business logic lives in auth.service.js.
 *
 * Routes handled:
 *  POST  /api/auth/login      → login
 *  POST  /api/auth/register   → register  (Admin only)
 *  GET   /api/auth/me         → getMe     (Any authenticated user)
 */
const authService          = require('../services/auth.service');
const { sendSuccess, sendError } = require('../utils/response');

/* ─────────────────────────────────────────────────────────
 * @route   POST /api/auth/login
 * @access  Public
 * ───────────────────────────────────────────────────────── */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Email and password are required', 400);
    }

    const { user, token } = await authService.login({ email, password });
    return sendSuccess(res, { user, token }, 'Login successful');
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────
 * @route   POST /api/auth/register
 * @access  Private — Admin only
 * ───────────────────────────────────────────────────────── */
const register = async (req, res, next) => {
  try {
    const { name, email, password, designation, department } = req.body;

    if (!name || !email || !password) {
      return sendError(res, 'Name, email and password are required', 400);
    }

    const { user, token } = await authService.register({ name, email, password, designation, department });
    return sendSuccess(res, { user, token }, 'User registered successfully', 201);
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────
 * @route   GET /api/auth/me
 * @access  Private — Any authenticated user
 * ───────────────────────────────────────────────────────── */
const getMe = async (req, res, next) => {
  try {
    // req.user is set by verifyToken middleware
    return sendSuccess(res, { user: req.user }, 'Authenticated user fetched');
  } catch (err) {
    next(err);
  }
};

module.exports = { login, register, getMe };
