/**
 * auth.routes.js — Authentication API routes.
 *
 * Base path: /api/auth  (mounted in server.js)
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  Method  │  Route           │  Access       │  Action   │
 * ├─────────────────────────────────────────────────────────┤
 * │  POST    │  /api/auth/login │  Public       │  Login    │
 * │  POST    │  /api/auth/register│ Admin only  │  Register │
 * │  GET     │  /api/auth/me    │  Any auth     │  Get self │
 * └─────────────────────────────────────────────────────────┘
 */
const express        = require('express');
const router         = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken }  = require('../middlewares/auth.middleware');
const { requireRole }  = require('../middlewares/role.middleware');

// Public
router.post('/login', authController.login);

// Admin only — must be logged in as admin to create new users
router.post('/register', verifyToken, requireRole('admin'), authController.register);

// Any authenticated user — returns their own profile
router.get('/me', verifyToken, authController.getMe);

module.exports = router;
