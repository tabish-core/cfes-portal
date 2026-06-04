/**
 * designation.middleware.js
 *
 * requireDesignation — Factory that returns a middleware restricting access
 * to users whose designation is in the provided allowedDesignations list.
 *
 * Must run AFTER verifyToken (relies on req.user being set).
 */
const { sendError } = require('../utils/response');

/**
 * @param {...string} allowedDesignations — e.g. requireDesignation('dean')
 */
const requireDesignation = (...allowedDesignations) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Unauthorized. Please log in.', 401);
    }

    if (!allowedDesignations.includes(req.user.designation)) {
      return sendError(
        res,
        `Forbidden. Required designation: ${allowedDesignations.join(' or ')}. Your designation: ${req.user.designation}.`,
        403
      );
    }

    next();
  };
};

/**
 * requireDepartmentScope
 * Middleware for HoD routes to ensure they only access data for their own department.
 * It attaches a req.departmentFilter object that controllers can spread into queries.
 */
const requireDepartmentScope = (req, res, next) => {
  if (!req.user) return sendError(res, 'Unauthorized.', 401);

  if (req.user.designation === 'dean') {
    // Dean has no department filter
    req.departmentFilter = {};
  } else if (req.user.designation === 'hod') {
    if (!req.user.department) {
      return sendError(res, 'HoD has no assigned department.', 403);
    }
    req.departmentFilter = { department: req.user.department };
  } else {
    // Faculty usually access their own courses, but if they hit a scoped route:
    if (!req.user.department) {
      req.departmentFilter = { _id: null }; // block
    } else {
      req.departmentFilter = { department: req.user.department };
    }
  }

  next();
};

module.exports = { requireDesignation, requireDepartmentScope };
