/**
 * role.middleware.js
 *
 * requireRole — Factory that returns a middleware restricting access
 * to users whose role is in the provided allowedRoles list.
 *
 * Must run AFTER verifyToken (relies on req.user being set).
 *
 * Usage:
 *   router.post('/register', verifyToken, requireRole('admin'), handler)
 *   router.get('/submissions', verifyToken, requireRole('admin', 'faculty'), handler)
 */
const { sendError } = require('../utils/response');

/**
 * @param {...string} allowedRoles — e.g. requireRole('admin') or requireRole('admin','faculty')
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Unauthorized. Please log in.', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        `Forbidden. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}.`,
        403
      );
    }

    next();
  };
};

module.exports = { requireRole };
