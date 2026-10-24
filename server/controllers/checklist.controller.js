const mongoose = require('mongoose');
const CourseChecklist = require('../models/CourseChecklist.model');
const CourseOffering = require('../models/CourseOffering.model');
const courseOfferingService = require('../services/courseOffering.service');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * @route   GET /api/checklist/offering/:offeringId
 * @access  Private (Faculty/HoD/Dean)
 */
const getChecklistByOffering = async (req, res, next) => {
  try {
    const { offeringId } = req.params;
    let offering;
    try {
      offering = await courseOfferingService.getOfferingById(offeringId, req.user);
    } catch (err) {
      return sendError(res, err.message, err.statusCode || 500);
    }

    // 1. First, search for checklist directly linked to this offering
    let checklist = await CourseChecklist.findOne({ courseOffering: offering._id });

    // 2. If not found, attempt safe fallback for unlinked legacy record with exact semester and section
    if (!checklist) {
      checklist = await CourseChecklist.findOne({
        courseOffering: null,
        course: offering.course._id || offering.course,
        faculty: offering.faculty._id || offering.faculty,
        semester: offering.semester._id || offering.semester,
        section: offering.section || 'A'
      });
    }

    // 3. Fallback for legacy records created before semester/section was populated ONLY if exactly 1 offering exists for this course + faculty
    if (!checklist) {
      const offeringCount = await CourseOffering.countDocuments({
        course: offering.course._id || offering.course,
        faculty: offering.faculty._id || offering.faculty
      });
      if (offeringCount === 1) {
        checklist = await CourseChecklist.findOne({
          courseOffering: null,
          course: offering.course._id || offering.course,
          faculty: offering.faculty._id || offering.faculty,
          semester: null
        });
      }
    }

    // If an existing record was found without courseOffering reference, associate it safely
    if (checklist && !checklist.courseOffering) {
      checklist.courseOffering = offering._id;
      if (!checklist.section) checklist.section = offering.section || 'A';
      if (!checklist.semester) checklist.semester = offering.semester._id || offering.semester;
      await checklist.save();
    }

    return sendSuccess(res, { checklist: checklist || null, offering }, 'Checklist fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/checklist/:courseId
 * @access  Private (Faculty/HoD/Dean)
 *
 * Query params:
 *   offeringId — CourseOffering ObjectId (recommended)
 *   semester   — Semester ObjectId (optional for backward compat)
 */
const getChecklist = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { offeringId, semester: semesterId } = req.query;

    if (offeringId) {
      req.params.offeringId = offeringId;
      return getChecklistByOffering(req, res, next);
    }

    const facultyId = req.user._id;

    if (!courseId) {
      return sendError(res, 'Course ID is required', 400);
    }

    const authCheck = await courseOfferingService.checkCourseAccess(req.user, courseId);
    if (!authCheck.authorized) {
      return sendError(res, authCheck.message, authCheck.status);
    }

    const offeringRes = await courseOfferingService.resolveOfferingForLegacyContext(req.user, courseId, semesterId);
    if (offeringRes.ambiguous) {
      return sendSuccess(res, { checklist: null, offering: null }, 'Multiple offerings exist for this course. Please specify offeringId.');
    }
    if (offeringRes.offering) {
      req.params.offeringId = offeringRes.offering._id.toString();
      return getChecklistByOffering(req, res, next);
    }

    const query = {
      course: courseId,
      faculty: facultyId,
      courseOffering: null
    };
    if (semesterId) query.semester = semesterId;

    const count = await CourseChecklist.countDocuments(query);
    if (count > 1) {
      return sendSuccess(res, { checklist: null, offering: null }, 'Multiple unlinked checklists exist for this course.');
    }

    const checklist = await CourseChecklist.findOne(query);

    return sendSuccess(res, { checklist: checklist || null }, 'Checklist fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/checklist
 * @access  Private (Faculty/HoD/Dean)
 *
 * Body:
 *   offeringId (optional but recommended), courseId, semesterId (optional), courseTitle, courseCode, batch, checklistItems
 */
const saveChecklist = async (req, res, next) => {
  try {
    const { offeringId, courseId, semesterId, courseTitle, courseCode, batch, checklistItems } = req.body;

    let targetOffering = null;
    if (offeringId) {
      try {
        targetOffering = await courseOfferingService.getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 500);
      }
    }

    if (!targetOffering) {
      if (!courseId) {
        return sendError(res, 'Course ID or Offering ID is required', 400);
      }

      const authCheck = await courseOfferingService.checkCourseAccess(req.user, courseId);
      if (!authCheck.authorized) {
        return sendError(res, authCheck.message, authCheck.status);
      }

      const offeringRes = await courseOfferingService.resolveOfferingForLegacyContext(req.user, courseId, semesterId);
      if (offeringRes.ambiguous) {
        return sendError(
          res,
          'Multiple course offerings exist for this course. Please provide offeringId to specify the target offering and section.',
          409
        );
      }
      if (offeringRes.offering) {
        targetOffering = offeringRes.offering;
      }
    }

    if (targetOffering) {
      const filter = {
        $or: [
          { courseOffering: targetOffering._id },
          {
            course: targetOffering.course._id,
            faculty: targetOffering.faculty._id,
            semester: targetOffering.semester._id,
            section: targetOffering.section || 'A'
          }
        ]
      };

      const updateData = {
        courseOffering: targetOffering._id,
        course: targetOffering.course._id,
        faculty: targetOffering.faculty._id,
        semester: targetOffering.semester._id,
        section: targetOffering.section || 'A',
        courseTitle: courseTitle || targetOffering.course.courseName || '',
        courseCode: courseCode || targetOffering.course.courseCode || '',
        batch: batch || '',
        checklistItems
      };

      const checklist = await CourseChecklist.findOneAndUpdate(
        filter,
        { $set: updateData },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      return sendSuccess(res, { checklist }, 'Checklist saved successfully');
    }

    // Legacy fallback (no offering could be established)
    const facultyId = req.user._id;
    const count = await CourseChecklist.countDocuments({
      course: courseId,
      faculty: facultyId,
      courseOffering: null,
      ...(semesterId ? { semester: semesterId } : {})
    });
    if (count > 1) {
      return sendError(
        res,
        'Multiple checklists exist for this course across different sections. Please provide offeringId to specify the target offering and section.',
        409
      );
    }

    const filter = { course: courseId, faculty: facultyId, courseOffering: null };
    if (semesterId) filter.semester = semesterId;

    const updateData = {
      courseOffering: null,
      course: courseId,
      faculty: facultyId,
      courseTitle,
      courseCode,
      batch,
      checklistItems
    };
    if (semesterId) updateData.semester = semesterId;

    const checklist = await CourseChecklist.findOneAndUpdate(
      filter,
      { $set: updateData },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return sendSuccess(res, { checklist }, 'Checklist saved successfully');
  } catch (err) {
    next(err);

  }
};

module.exports = {
  getChecklist,
  getChecklistByOffering,
  saveChecklist
};

