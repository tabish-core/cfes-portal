const mongoose = require('mongoose');
const Quiz = require('../models/Quiz.model');
const CourseOffering = require('../models/CourseOffering.model');
const CourseChecklist = require('../models/CourseChecklist.model');
const courseOfferingService = require('../services/courseOffering.service');
const { sendSuccess, sendError } = require('../utils/response');
const quizWordService = require('../services/documentService/generateQuizWord');


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

/**
 * Updates CourseChecklist item completion status for an offering.
 *
 * @param {Object|string} offering - The CourseOffering document or offeringId
 * @param {string} documentType - 'ASSESS_QUIZ'
 * @param {boolean} isCompleted - Whether the item should be marked complete
 */
const updateAssessmentChecklist = async (offering, documentType, isCompleted) => {
  if (!offering) return;
  try {
    const offeringId = offering._id || offering;
    let checklist = await CourseChecklist.findOne({ courseOffering: offeringId });
    if (!checklist && offering.course && offering.faculty) {
      checklist = await CourseChecklist.findOne({
        course: offering.course._id || offering.course,
        faculty: offering.faculty._id || offering.faculty,
        semester: offering.semester?._id || offering.semester,
        section: offering.section || 'A',
      });
    }

    if (checklist) {
      if (!checklist.courseOffering) {
        checklist.courseOffering = offeringId;
        if (!checklist.section && offering.section) checklist.section = offering.section;
        if (!checklist.semester && offering.semester) {
          checklist.semester = offering.semester._id || offering.semester;
        }
      }
      if (Array.isArray(checklist.checklistItems)) {
        const item = checklist.checklistItems.find((i) => i.type === documentType);
        if (item && item.completed !== isCompleted) {
          item.completed = isCompleted;
          await checklist.save();
        }
      }
    }
  } catch (err) {
    console.warn(`Could not update checklist status for ${documentType}:`, err.message);
  }
};

/* ── GET /api/quizzes/course/:courseId ──────────────────────────────── */
/**
 * List all quizzes for a course, scoped to CourseOffering if offeringId is provided.
 */
const getQuizzesForCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { offeringId } = req.query;

    if (offeringId) {
      if (!mongoose.Types.ObjectId.isValid(offeringId)) {
        return sendError(res, 'Invalid offering ID', 400);
      }

      let offering;
      try {
        offering = await courseOfferingService.getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 403);
      }

      const offeringCourseId = (offering.course?._id || offering.course).toString();
      if (courseId && courseId !== 'undefined' && offeringCourseId !== courseId.toString()) {
        return sendError(res, 'Offering does not match the specified course', 400);
      }

      let quizzes = await Quiz.find({ courseOffering: offering._id })
        .sort({ createdAt: -1 })
        .lean();

      // Safe fallback for unassociated legacy records ONLY when exactly 1 offering exists for this (course, faculty)
      if (quizzes.length === 0) {
        const offeringFacultyId = offering.faculty?._id || offering.faculty;
        const offeringCount = await CourseOffering.countDocuments({
          course: offeringCourseId,
          faculty: offeringFacultyId,
        });

        if (offeringCount === 1) {
          quizzes = await Quiz.find({
            course: offeringCourseId,
            faculty: offeringFacultyId,
            courseOffering: null,
          })
            .sort({ createdAt: -1 })
            .lean();
        }

      }

      return sendSuccess(res, { quizzes }, 'Quizzes fetched');
    }

    // Pure legacy call (no offeringId provided)
    const authCheck = await courseOfferingService.checkCourseAccess(req.user, courseId);
    if (!authCheck.authorized) {
      return sendError(res, authCheck.message, authCheck.status);
    }

    // Check if multiple offerings exist for this faculty + course
    const offeringCount = await CourseOffering.countDocuments({
      course: courseId,
      faculty: req.user._id,
    });

    if (offeringCount > 1) {
      // Ambiguous across multiple offerings: do not expose unassociated records across every offering
      return sendSuccess(res, { quizzes: [] }, 'Multiple offerings exist for this course. Please specify offeringId.');
    }

    const quizzes = await Quiz.find({
      course: courseId,
      faculty: req.user._id,
      courseOffering: null,
    })
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(res, { quizzes }, 'Quizzes fetched');
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/quizzes/offering/:offeringId ─────────────────────────── */
/**
 * List all quizzes scoped directly by offeringId.
 */
const getQuizzesForOffering = async (req, res, next) => {
  try {
    const { offeringId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(offeringId)) {
      return sendError(res, 'Invalid offering ID', 400);
    }

    let offering;
    try {
      offering = await courseOfferingService.getOfferingById(offeringId, req.user);
    } catch (err) {
      return sendError(res, err.message, err.statusCode || 403);
    }

    const offeringCourseId = (offering.course?._id || offering.course).toString();
    req.params.courseId = offeringCourseId;
    req.query.offeringId = offeringId;
    return getQuizzesForCourse(req, res, next);
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/quizzes/:quizId ──────────────────────────────────────── */
/**
 * Get a single quiz by its MongoDB _id with offering authorization.
 */
const getQuiz = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const quiz = await Quiz.findById(quizId).lean();

    if (!quiz) {
      return sendError(res, 'Quiz not found', 404);
    }

    if (quiz.courseOffering) {
      try {
        await courseOfferingService.getOfferingById(quiz.courseOffering, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 403);
      }
    } else {
      // Legacy unlinked record: check ownership or faculty access
      if (req.user.designation === 'faculty' && quiz.faculty.toString() !== req.user._id.toString()) {
        return sendError(res, 'You are not authorized to view this quiz', 403);
      }
    }

    return sendSuccess(res, { quiz }, 'Quiz fetched');
  } catch (err) {
    next(err);
  }
};

/* ── POST /api/quizzes ─────────────────────────────────────────────── */
/**
 * Create a new quiz with CourseOffering association and checklist completion.
 */
const createQuiz = async (req, res, next) => {
  try {
    const facultyId = req.user._id;
    const { courseId, offeringId, quizInfo, courseInfo, cloMappings, questions } = req.body;

    if (!courseId && !offeringId) {
      return sendError(res, 'courseId or offeringId is required', 400);
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
      marks: q.marks || '',
    }));

    if (offeringId) {
      if (!mongoose.Types.ObjectId.isValid(offeringId)) {
        return sendError(res, 'Invalid offering ID', 400);
      }

      let offering;
      try {
        offering = await courseOfferingService.getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 403);
      }

      const offeringCourseId = (offering.course?._id || offering.course).toString();
      if (courseId && courseId !== 'undefined' && offeringCourseId !== courseId.toString()) {
        return sendError(res, 'Offering does not match the specified course', 400);
      }

      const quiz = await Quiz.create({
        courseOffering: offering._id,
        course: offeringCourseId,
        faculty: offering.faculty?._id || offering.faculty,
        semester: offering.semester?._id || offering.semester || null,
        quizInfo,
        courseInfo: courseInfo || {},
        cloMappings: cloMappings || [],
        questions: numberedQuestions,
        status: 'draft',
      });

      // Update CourseChecklist completion
      await updateAssessmentChecklist(offering, 'ASSESS_QUIZ', true);

      return sendSuccess(res, { quiz }, 'Quiz created successfully', 201);
    }

    // Legacy creation without offeringId
    const authCheck = await courseOfferingService.checkCourseAccess(req.user, courseId);
    if (!authCheck.authorized) {
      return sendError(res, authCheck.message, authCheck.status);
    }

    const offeringRes = await courseOfferingService.resolveOfferingForLegacyContext(req.user, courseId);
    if (offeringRes.ambiguous) {
      return sendError(
        res,
        'Multiple course offerings exist for this course. Please provide offeringId to specify the target offering.',
        409
      );
    }

    const targetOffering = offeringRes.offering;
    const quiz = await Quiz.create({
      courseOffering: targetOffering ? targetOffering._id : null,
      course: courseId,
      faculty: facultyId,
      semester: targetOffering ? (targetOffering.semester?._id || targetOffering.semester) : null,
      quizInfo,
      courseInfo: courseInfo || {},
      cloMappings: cloMappings || [],
      questions: numberedQuestions,
      status: 'draft',
    });

    if (targetOffering) {
      await updateAssessmentChecklist(targetOffering, 'ASSESS_QUIZ', true);
    }

    return sendSuccess(res, { quiz }, 'Quiz created successfully', 201);
  } catch (err) {
    next(err);
  }
};

/* ── PUT /api/quizzes/:quizId ──────────────────────────────────────── */
/**
 * Update an existing quiz with offering authorization check.
 */
const updateQuiz = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const { quizInfo, courseInfo, cloMappings, questions, offeringId } = req.body;

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return sendError(res, 'Quiz not found', 404);
    }

    // Authorize against existing offering or ownership
    if (quiz.courseOffering) {
      try {
        await courseOfferingService.getOfferingById(quiz.courseOffering, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 403);
      }
    } else {
      if (req.user.designation === 'faculty' && quiz.faculty.toString() !== req.user._id.toString()) {
        return sendError(res, 'You are not authorized to update this quiz', 403);
      }

      // If client supplied offeringId to safely link legacy record, verify and associate
      if (offeringId) {
        if (!mongoose.Types.ObjectId.isValid(offeringId)) {
          return sendError(res, 'Invalid offering ID', 400);
        }
        let offering;
        try {
          offering = await courseOfferingService.getOfferingById(offeringId, req.user);
        } catch (err) {
          return sendError(res, err.message, err.statusCode || 403);
        }

        const offeringCourseId = (offering.course?._id || offering.course).toString();
        if (offeringCourseId !== quiz.course.toString()) {
          return sendError(res, 'Offering does not match the course of this quiz', 400);
        }

        quiz.courseOffering = offering._id;
        quiz.semester = offering.semester?._id || offering.semester || null;
        await updateAssessmentChecklist(offering, 'ASSESS_QUIZ', true);
      }
    }

    // Auto-number questions
    if (questions) {
      quiz.questions = (questions || []).map((q, i) => ({
        questionNumber: i + 1,
        questionText: q.questionText || q.text || '',
        marks: q.marks || '',
      }));
    }

    if (quizInfo) quiz.quizInfo = quizInfo;
    if (courseInfo) quiz.courseInfo = courseInfo;
    if (cloMappings) quiz.cloMappings = cloMappings;

    await quiz.save();

    return sendSuccess(res, { quiz }, 'Quiz updated successfully');
  } catch (err) {
    next(err);
  }
};

/* ── DELETE /api/quizzes/:quizId ───────────────────────────────────── */
/**
 * Delete a quiz and recalculate checklist completion for the offering.
 */
const deleteQuiz = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const quiz = await Quiz.findById(quizId);

    if (!quiz) {
      return sendError(res, 'Quiz not found', 404);
    }

    let offering = null;
    if (quiz.courseOffering) {
      try {
        offering = await courseOfferingService.getOfferingById(quiz.courseOffering, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 403);
      }
    } else {
      if (req.user.designation === 'faculty' && quiz.faculty.toString() !== req.user._id.toString()) {
        return sendError(res, 'You are not authorized to delete this quiz', 403);
      }
    }

    const offeringRef = quiz.courseOffering;
    await quiz.deleteOne();

    // Recalculate checklist completion for the offering
    if (offeringRef) {
      const remainingCount = await Quiz.countDocuments({ courseOffering: offeringRef });
      await updateAssessmentChecklist(offering || { _id: offeringRef }, 'ASSESS_QUIZ', remainingCount > 0);
    }

    return sendSuccess(res, null, 'Quiz deleted successfully');
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/quizzes/:quizId/export ───────────────────────────────── */
/**
 * Export quiz to DOCX with offering authorization check.
 */
const exportQuizWord = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const quiz = await Quiz.findById(quizId).lean();

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // Verify authorization before generating or returning the document
    if (quiz.courseOffering) {
      try {
        await courseOfferingService.getOfferingById(quiz.courseOffering, req.user);
      } catch (err) {
        return res.status(err.statusCode || 403).json({ success: false, message: err.message });
      }
    } else {
      if (req.user.designation === 'faculty' && quiz.faculty.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'You are not authorized to export this quiz' });
      }
    }

    const buffer = await quizWordService.generateQuizWord(quiz);

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
  getQuizzesForOffering,
  getQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  exportQuizWord,
};

