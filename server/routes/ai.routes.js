/**
 * ai.routes.js — Routes for AI assistance features.
 *
 * Endpoints:
 *   POST /api/ai/generate-question — Generate a single question for Quiz or Assignment
 */

const express = require('express');
const aiQuestionController = require('../controllers/aiQuestionController');
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireDesignation } = require('../middlewares/designation.middleware');

const router = express.Router();

// Faculty, HOD (and Dean) can generate questions
router.post(
  '/generate-question',
  verifyToken,
  requireDesignation('faculty', 'hod', 'dean'),
  aiQuestionController.generateQuestion
);

module.exports = router;
