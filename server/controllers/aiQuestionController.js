/**
 * aiQuestionController.js — HTTP controller for AI question generation.
 *
 * Route: POST /api/ai/generate-question
 */

const aiQuestionService = require('../services/aiQuestionService');
const { sendError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Handle question generation requests.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const generateQuestion = async (req, res) => {
  try {
    const { prompt, context } = req.body || {};

    // Validate prompt presence and type
    if (!prompt || typeof prompt !== 'string') {
      return sendError(res, 'Prompt is required and must be text.', 400);
    }

    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length < 3) {
      return sendError(res, 'Prompt must be at least 3 characters long.', 400);
    }

    if (trimmedPrompt.length > 500) {
      return sendError(res, 'Prompt exceeds maximum allowed length of 500 characters.', 400);
    }

    // Validate context
    if (!context || typeof context !== 'string') {
      return sendError(res, "Context is required and must be either 'quiz' or 'assignment'.", 400);
    }

    const normalizedContext = context.trim().toLowerCase();
    if (!['quiz', 'assignment'].includes(normalizedContext)) {
      return sendError(res, "Context must be either 'quiz' or 'assignment'.", 400);
    }

    // Call service to generate single question
    const question = await aiQuestionService.generateQuestion({
      prompt: trimmedPrompt,
      context: normalizedContext,
    });

    return res.status(200).json({
      success: true,
      question,
    });
  } catch (err) {
    // Log error message without sensitive information
    logger.error(`AI Question Generation failure: ${err.message || 'Unknown error'}`);
    const statusCode = err.statusCode || 500;
    return sendError(res, err.message || 'Failed to generate question.', statusCode);
  }
};

module.exports = {
  generateQuestion,
};
