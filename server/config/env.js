/**
 * env.js — Load and validate environment variables.
 * Must be required first in server.js before anything else.
 */
require('dotenv').config();

const REQUIRED_VARS = ['MONGO_URI', 'JWT_SECRET'];

REQUIRED_VARS.forEach((key) => {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
});
