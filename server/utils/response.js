/**
 * response.js — Standardised API response helpers.
 * Every response in the app flows through these two functions
 * so the client always receives a consistent JSON shape:
 * { success, message, data }
 */

/**
 * @param {import('express').Response} res
 * @param {*}      data
 * @param {string} message
 * @param {number} statusCode
 */
const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({ success: true, message, data });
};

/**
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} statusCode
 */
const sendError = (res, message = 'Something went wrong', statusCode = 500) => {
  return res.status(statusCode).json({ success: false, message, data: null });
};

module.exports = { sendSuccess, sendError };
