/**
 * logger.js — Lightweight timestamped console logger.
 * Keeps log format consistent across the entire server.
 */

const LEVELS = {
  info:  'INFO ',
  warn:  'WARN ',
  error: 'ERROR',
};

const log = (level, message) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${LEVELS[level] ?? level.toUpperCase()}: ${message}`);
};

module.exports = {
  info:  (msg) => log('info',  msg),
  warn:  (msg) => log('warn',  msg),
  error: (msg) => log('error', msg),
};
