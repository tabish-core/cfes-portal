/**
 * quiz.controller.js — HTTP handlers for Quiz CRUD operations.
 *
 * Unlike CCC/CCR/CRR (one document per course), quizzes are many-per-course.
 * This controller provides full CRUD instead of the get/upsert pattern used
 * by the single-document forms.
 *
 * Routes:
 *   GET    /api/quizzes/course/:courseId   — List all quizzes for a course
 *   GET    /api/quizzes/:quizId           — Get a single quiz
 *   POST   /api/quizzes                   — Create a new quiz
 *   PUT    /api/quizzes/:quizId           — Update an existing quiz
 *   DELETE /api/quizzes/:quizId           — Delete a quiz
 */
const Quiz = require('../models/Quiz.model');
const { sendSuccess, sendError } = require('../utils/response');
const { generateQuizWord } = require('../services/documentService/generateQuizWord');

/* ── Helpers ───────────────────────────────────────────────────────────── */

const filled = (v) => typeof v === 'string' && v.trim().length > 0;

const validateQuiz = ({ quizInfo }) => {
  const errors = [];
  if (!quizInfo || typeof quizInfo !== 'object') {
    errors.push({ field: 'quizInfo', message: 'Quiz Information section is required.' });
    return errors;
  }
  if (!filled(quizInfo.quizNumber)) errors.push({ field: 'quizNumber', message: 'Quiz Number is required.' });
  return errors;
};

/* ── GET /api/quizzes/course/:courseId ──────────────────────────────── */
/**
 * List all quizzes belonging to the logged-in faculty for a given course.
 */
const getQuizzesForCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const facultyId = req.user._id;

    const quizzes = await Quiz.find({ course: courseId, faculty: facultyId })
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(res, { quizzes }, 'Quizzes fetched');
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/quizzes/:quizId ──────────────────────────────────────── */
/**
 * Get a single quiz by its MongoDB _id.
 */
const getQuiz = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const quiz = await Quiz.findById(quizId).lean();

    if (!quiz) {
      return sendError(res, 'Quiz not found', 404);
    }

    return sendSuccess(res, { quiz }, 'Quiz fetched');
  } catch (err) {
    next(err);
  }
};

/* ── POST /api/quizzes ─────────────────────────────────────────────── */
/**
 * Create a new quiz for a course.
 */
const createQuiz = async (req, res, next) => {
  try {
    const facultyId = req.user._id;
    const { courseId, quizInfo, courseInfo, cloMappings, questions } = req.body;

    if (!courseId) {
      return sendError(res, 'courseId is required', 400);
    }

    // Validate
    const errors = validateQuiz({ quizInfo });
    if (errors.length > 0) {
      return sendError(res, 'Validation failed', 400);
    }

    // Auto-number questions
    const numberedQuestions = (questions || []).map((q, i) => ({
      questionNumber: i + 1,
      questionText: q.questionText || q.text || '',
      marks: q.marks || ''
    }));

    const quiz = await Quiz.create({
      course: courseId,
      faculty: facultyId,
      quizInfo,
      courseInfo: courseInfo || {},
      cloMappings: cloMappings || [],
      questions: numberedQuestions,
      status: 'draft'
    });

    return sendSuccess(res, { quiz }, 'Quiz created successfully', 201);
  } catch (err) {
    next(err);
  }
};

/* ── PUT /api/quizzes/:quizId ──────────────────────────────────────── */
/**
 * Update an existing quiz.
 */
const updateQuiz = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const { quizInfo, courseInfo, cloMappings, questions } = req.body;

    // Auto-number questions
    const numberedQuestions = (questions || []).map((q, i) => ({
      questionNumber: i + 1,
      questionText: q.questionText || q.text || '',
      marks: q.marks || ''
    }));

    const updateData = {
      quizInfo,
      courseInfo: courseInfo || {},
      cloMappings: cloMappings || [],
      questions: numberedQuestions,
    };

    const quiz = await Quiz.findByIdAndUpdate(quizId, updateData, { new: true });

    if (!quiz) {
      return sendError(res, 'Quiz not found', 404);
    }

    return sendSuccess(res, { quiz }, 'Quiz updated successfully');
  } catch (err) {
    next(err);
  }
};

/* ── DELETE /api/quizzes/:quizId ───────────────────────────────────── */
/**
 * Delete a quiz.
 */
const deleteQuiz = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const quiz = await Quiz.findByIdAndDelete(quizId);

    if (!quiz) {
      return sendError(res, 'Quiz not found', 404);
    }

    return sendSuccess(res, null, 'Quiz deleted successfully');
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/quizzes/:quizId/export ───────────────────────────────── */
/**
 * Export quiz to DOCX.
 */
const exportQuizWord = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const quiz = await Quiz.findById(quizId).lean();

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const buffer = await generateQuizWord(quiz);

    const safeCourse = (quiz.courseInfo?.courseTitle || 'Course').replace(/[^a-z0-9]/gi, '_');
    const safeQuizNum = (quiz.quizInfo?.quizNumber || 'Quiz').replace(/[^a-z0-9]/gi, '_');
    const filename = `${safeCourse}_${safeQuizNum}.docx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } catch (err) {
    console.error('Quiz export failed:', err);
    res.status(500).json({ success: false, message: 'Failed to generate Quiz document' });
  }
};

module.exports = {
  getQuizzesForCourse,
  getQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  exportQuizWord
};
