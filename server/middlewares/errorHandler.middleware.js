/**
 * errorHandler.middleware.js — Centralised Express error handler.
 *
 * Must be the LAST middleware registered in server.js.
 * Catches all errors passed via next(err) and returns a consistent JSON response.
 *
 * Handled cases:
 *  - Mongoose ValidationError  → 422
 *  - Mongoose duplicate key    → 409
 *  - Mongoose CastError        → 400
 *  - Custom statusCode on err  → uses that code
 *  - All others                → 500 (message hidden in production)
 */
const logger      = require('../utils/logger');
const { sendError } = require('../utils/response');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  logger.error(`${err.message} | ${req.method} ${req.originalUrl}`);

  // Mongoose: validation failed (e.g. required field missing)
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join('. ');
    return sendError(res, message, 422);
  }

  // Mongoose: duplicate key (e.g. unique email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return sendError(res, `${field} already exists.`, 409);
  }

  // Mongoose: invalid ObjectId
  if (err.name === 'CastError') {
    return sendError(res, `Invalid value for field: ${err.path}`, 400);
  }

  // Custom errors from services (statusCode set explicitly)
  const status  = err.statusCode || 500;
  const message =
    status === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;

  return sendError(res, message, status);
};

module.exports = errorHandler;
