/**
 * auth.middleware.js
 *
 * verifyToken — Validates the Bearer JWT in the Authorization header.
 * Attaches the full user document to req.user for downstream use.
 */
const jwt  = require('jsonwebtoken');
const User = require('../models/User.model');
const { sendError } = require('../utils/response');

/**
 * Middleware: verifyToken
 * Usage: router.get('/protected', verifyToken, handler)
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Access denied. No token provided.', 401);
    }

    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user from DB (catches deactivated accounts mid-session)
    const user = await User.findById(decoded.id);

    if (!user) {
      return sendError(res, 'User belonging to this token no longer exists.', 401);
    }

    if (!user.isActive) {
      return sendError(res, 'Your account has been deactivated.', 403);
    }

    req.user = user; // pass user object to next middleware/controller
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError')  return sendError(res, 'Invalid token.',  401);
    if (err.name === 'TokenExpiredError')  return sendError(res, 'Token has expired. Please log in again.', 401);
    next(err);
  }
};

module.exports = { verifyToken };
