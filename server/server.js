/**
 * server.js — Express application entry point.
 *
 * Startup order:
 *  1. Load + validate env vars
 *  2. Connect to MongoDB
 *  3. Register middlewares (security, logging, body parsing)
 *  4. Mount API routes
 *  5. 404 handler
 *  6. Centralised error handler (must be last)
 *  7. Start HTTP server
 */

// Step 1: env must be loaded before anything else
require('./config/env');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db');
const errorHandler = require('./middlewares/errorHandler.middleware');
const logger = require('./utils/logger');

// ── Route imports ────────────────────────────────────────
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const courseRoutes = require('./routes/course.routes');
const formRoutes = require('./routes/form.routes');
const checklistRoutes = require('./routes/checklist.routes');
// Future: const courseFileRoutes = require('./routes/courseFile.routes');

/* ── App setup ─────────────────────────────────────────── */
const app = express();

// Step 2: Connect to MongoDB
connectDB();

// Step 3: Middlewares
app.use(helmet());                         // Security headers
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('dev'));                    // HTTP request logger
app.use(express.json());                   // Parse JSON bodies
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded bodies

/* ── Root route ─────────────────────────────────────────── */
app.get('/', (_req, res) => {
  res.send('CFES Portal API is running...');
});

/* ── Health check ───────────────────────────────────────── */
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

/* ── Step 4: API Routes ─────────────────────────────────── */
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/checklist', checklistRoutes);
// app.use('/api/course-files', courseFileRoutes);

/* ── Step 5: 404 Handler ────────────────────────────────── */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

/* ── Step 6: Centralised Error Handler (MUST be last) ───── */
app.use(errorHandler);

/* ── Step 7: Start server ───────────────────────────────── */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
