/**
 * ccp.controller.js — HTTP handlers for CCP / Class Project / PBL form (formType: 'ASSESS_PROJECT').
 *
 * Implements:
 *   - getCCPForm:  Fetch CCP data for a course with course/faculty authorization and semester resolution.
 *   - saveCCPForm: Create or update CCP data using atomic upsert, preserving existing fields and isolating data.
 */
const mongoose = require('mongoose');
const CCP = require('../models/CCP.model');
const Course = require('../models/Course.model');
const CourseOffering = require('../models/CourseOffering.model');
const Semester = require('../models/Semester.model');
const { sendSuccess, sendError } = require('../utils/response');
const courseOfferingService = require('../services/courseOffering.service');
const { generateCCPWord } = require('../services/documentService/generateCCPWord');
const { generateCCPPDF } = require('../services/documentService/generateCCPPDF');


const checkCourseAccess = (user, courseId) => courseOfferingService.checkCourseAccess(user, courseId);

/**
 * Resolves the semester ObjectId for a course/faculty CCP document.
 *
 * Resolution order:
 *  1. Explicitly requested semesterId (if valid ObjectId)
 *  2. Semester of an existing CCP record for this course + faculty
 *  3. Active semester where an offering exists for this course + faculty
 *  4. System active semester (fallback)
 *  5. null (if no semester records exist)
 */
const resolveSemester = async (requestedSemesterId, courseId, facultyId) => {
  if (requestedSemesterId && mongoose.Types.ObjectId.isValid(requestedSemesterId)) {
    return new mongoose.Types.ObjectId(requestedSemesterId);
  }

  // Check if a record already exists to preserve its semester
  const existing = await CCP.findOne({
    course: courseId,
    faculty: facultyId,
    formType: 'ASSESS_PROJECT',
  }).select('semester');

  if (existing && existing.semester) {
    return existing.semester;
  }

  // Try to find the active semester
  const activeSemester = await Semester.findOne({ status: 'active' });
  if (activeSemester) {
    const offeringExists = await CourseOffering.exists({
      course: courseId,
      faculty: facultyId,
      semester: activeSemester._id,
    });
    if (offeringExists) {
      return activeSemester._id;
    }
    return activeSemester._id;
  }

  return null;
};

/**
 * @route   GET /api/forms/ccp/:courseId
 * @access  Private (Authenticated Faculty/HoD/Dean)
 *
 * Query params:
 *   semester — Semester ObjectId (optional)
 *   faculty  — Faculty ObjectId (optional, only Dean/HoD can view other faculty data)
 */
const getCCPForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { semester: requestedSemesterId, faculty: queryFacultyId, offeringId } = req.query;

    let offering = null;
    if (offeringId) {
      try {
        offering = await courseOfferingService.getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 500);
      }
    }

    if (!offering) {
      if (!courseId) {
        return sendError(res, 'Course ID or Offering ID is required', 400);
      }
      // 1. Authorize course access
      const authCheck = await checkCourseAccess(req.user, courseId);
      if (!authCheck.authorized) {
        return sendError(res, authCheck.message, authCheck.status);
      }

      // 2. Faculty isolation
      let targetFacultyId = req.user._id;
      if (
        queryFacultyId &&
        (req.user.designation === 'dean' || req.user.designation === 'hod') &&
        mongoose.Types.ObjectId.isValid(queryFacultyId)
      ) {
        targetFacultyId = new mongoose.Types.ObjectId(queryFacultyId);
      }

      const offeringRes = await courseOfferingService.resolveOfferingForLegacyContext(
        req.user,
        courseId,
        requestedSemesterId,
        targetFacultyId
      );
      if (offeringRes.ambiguous) {
        return sendSuccess(res, { form: null }, 'Multiple offerings exist for this course; specify offeringId to retrieve a specific section form.');
      }
      if (offeringRes.offering) {
        offering = offeringRes.offering;
      }
    }

    if (offering) {
      // 1. Explicitly linked to this offering
      let form = await CCP.findOne({ courseOffering: offering._id, formType: 'ASSESS_PROJECT' });

      // 2. Unlinked legacy document with EXACT same semester and section
      if (!form) {
        form = await CCP.findOne({
          courseOffering: null,
          course: offering.course._id || offering.course,
          faculty: offering.faculty._id || offering.faculty,
          semester: offering.semester._id || offering.semester,
          section: offering.section || 'A',
          formType: 'ASSESS_PROJECT'
        });
      }

      // 3. Unlinked legacy document with semester: null ONLY if EXACTLY 1 offering exists for this course + faculty
      if (!form) {
        const offeringCount = await CourseOffering.countDocuments({
          course: offering.course._id || offering.course,
          faculty: offering.faculty._id || offering.faculty
        });
        if (offeringCount === 1) {
          form = await CCP.findOne({
            courseOffering: null,
            course: offering.course._id || offering.course,
            faculty: offering.faculty._id || offering.faculty,
            semester: null,
            formType: 'ASSESS_PROJECT'
          });
        }
      }

      // Safely link unlinked legacy record
      if (form && !form.courseOffering) {
        form.courseOffering = offering._id;
        if (!form.section) form.section = offering.section || 'A';
        if (!form.semester) form.semester = offering.semester._id || offering.semester;
        await form.save();
      }

      return sendSuccess(res, { form: form || null }, 'CCP form fetched successfully.');
    }

    // Pure legacy fallback (no offering could be established)
    let targetFacultyId = req.user._id;
    if (
      queryFacultyId &&
      (req.user.designation === 'dean' || req.user.designation === 'hod') &&
      mongoose.Types.ObjectId.isValid(queryFacultyId)
    ) {
      targetFacultyId = new mongoose.Types.ObjectId(queryFacultyId);
    }

    const query = {
      course: courseId,
      faculty: targetFacultyId,
      courseOffering: null,
      formType: 'ASSESS_PROJECT',
    };

    if (requestedSemesterId && mongoose.Types.ObjectId.isValid(requestedSemesterId)) {
      query.semester = new mongoose.Types.ObjectId(requestedSemesterId);
    }

    const count = await CCP.countDocuments(query);
    if (count > 1) {
      return sendSuccess(res, { form: null }, 'Multiple unlinked CCP forms exist for this course.');
    }

    let form = await CCP.findOne(query);

    // If no document found and no specific semester was requested, check with active semester
    if (!form && !requestedSemesterId) {
      const activeSem = await Semester.findOne({ status: 'active' });
      if (activeSem) {
        form = await CCP.findOne({
          course: courseId,
          faculty: targetFacultyId,
          courseOffering: null,
          formType: 'ASSESS_PROJECT',
          semester: activeSem._id,
        });
      }
    }

    return sendSuccess(res, { form: form || null }, 'CCP form fetched successfully.');
  } catch (err) {
    next(err);
  }

};

/**
 * @route   POST /api/forms/ccp
 * @route   PUT  /api/forms/ccp/:courseId
 * @access  Private (Authenticated Faculty/HoD/Dean)
 *
 * Body:
 *   courseId               — Course ObjectId (required)
 *   semesterId             — Semester ObjectId (optional)
 *   headerInfo             — { department, program, courseTitle, courseCode, announcedDate, dueDate, totalMarks }
 *   mappingTable           — { mappedClo, sdg, knowledgeProfile, complexProblemSolvingMapped }
 *   problemStatement       — string
 *   constraintsAssumptions — string
 *   computationalTools     — string
 *   expectedOutcomes       — string
 *   deliverables           — { heading, items: [{ label, required, completed }] }
 *   wpAttributes           — [{ code, title, description, isMapped, justification }]
 *   status                 — 'draft' | 'submitted'
 */
const saveCCPForm = async (req, res, next) => {
  try {
    const courseId = req.params.courseId || req.body.courseId;
    const {
      offeringId,
      semesterId,
      headerInfo,
      mappingTable,
      problemStatement,
      constraintsAssumptions,
      computationalTools,
      expectedOutcomes,
      deliverables,
      wpAttributes,
      status,
    } = req.body;

    let offering = null;
    if (offeringId) {
      try {
        offering = await courseOfferingService.getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 500);
      }
    }

    if (!offering) {
      if (!courseId) {
        return sendError(res, 'Course ID or Offering ID is required', 400);
      }
      // 1. Authorize course access
      const authCheck = await checkCourseAccess(req.user, courseId);
      if (!authCheck.authorized) {
        return sendError(res, authCheck.message, authCheck.status);
      }

      const offeringRes = await courseOfferingService.resolveOfferingForLegacyContext(
        req.user,
        courseId,
        semesterId
      );
      if (offeringRes.ambiguous) {
        return sendError(
          res,
          'Multiple course offerings exist for this course. Please provide offeringId to specify the target offering and section.',
          409
        );
      }
      if (offeringRes.offering) {
        offering = offeringRes.offering;
      }
    }

    // 2. Faculty isolation & semester resolution
    const facultyId = offering ? offering.faculty._id : req.user._id;
    const resolvedSemesterId = offering ? offering.semester._id : await resolveSemester(semesterId, courseId, facultyId);

    // 3. Build unique upsert filter
    let filter;
    let updateData;

    if (offering) {
      filter = {
        $or: [
          { courseOffering: offering._id, formType: 'ASSESS_PROJECT' },
          {
            course: offering.course._id,
            faculty: offering.faculty._id,
            semester: offering.semester._id,
            section: offering.section || 'A',
            formType: 'ASSESS_PROJECT'
          }
        ]
      };
      updateData = {
        courseOffering: offering._id,
        course: offering.course._id,
        faculty: offering.faculty._id,
        semester: offering.semester._id,
        section: offering.section || 'A',
        formType: 'ASSESS_PROJECT',
        status: status === 'submitted' ? 'submitted' : 'draft',
      };
    } else {
      const count = await CCP.countDocuments({
        course: courseId,
        faculty: facultyId,
        courseOffering: null,
        formType: 'ASSESS_PROJECT',
        ...(resolvedSemesterId ? { semester: resolvedSemesterId } : {})
      });
      if (count > 1) {
        return sendError(
          res,
          'Multiple documents exist for this course across different sections. Please provide offeringId to specify the target offering and section.',
          409
        );
      }

      filter = {
        course: courseId,
        faculty: facultyId,
        courseOffering: null,
        formType: 'ASSESS_PROJECT',
      };
      if (resolvedSemesterId) {
        filter.semester = resolvedSemesterId;
      }
      updateData = {
        courseOffering: null,
        course: courseId,
        faculty: facultyId,
        formType: 'ASSESS_PROJECT',
        status: status === 'submitted' ? 'submitted' : 'draft',
      };
      if (resolvedSemesterId) {
        updateData.semester = resolvedSemesterId;
      }
    }

    if (headerInfo !== undefined && typeof headerInfo === 'object') {
      updateData.headerInfo = headerInfo;
    }
    if (mappingTable !== undefined && typeof mappingTable === 'object') {
      updateData.mappingTable = mappingTable;
    }
    if (problemStatement !== undefined) {
      updateData.problemStatement = typeof problemStatement === 'string' ? problemStatement : '';
    }
    if (constraintsAssumptions !== undefined) {
      updateData.constraintsAssumptions = typeof constraintsAssumptions === 'string' ? constraintsAssumptions : '';
    }
    if (computationalTools !== undefined) {
      updateData.computationalTools = typeof computationalTools === 'string' ? computationalTools : '';
    }
    if (expectedOutcomes !== undefined) {
      updateData.expectedOutcomes = typeof expectedOutcomes === 'string' ? expectedOutcomes : '';
    }
    if (deliverables !== undefined && typeof deliverables === 'object') {
      updateData.deliverables = deliverables;
    }
    if (wpAttributes !== undefined && Array.isArray(wpAttributes)) {
      updateData.wpAttributes = wpAttributes;
    }

    // 4. Execute atomic upsert
    const form = await CCP.findOneAndUpdate(
      filter,
      { $set: updateData },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );

    return sendSuccess(res, { form }, 'CCP form saved successfully.');
  } catch (err) {
    if (err.code === 11000) {
      return sendError(res, 'A CCP record already exists for this course, faculty, semester, and section.', 409);
    }
    next(err);
  }
};

/**
 * @route   GET /api/forms/ccp/:courseId/export
 * @access  Private (Authenticated Faculty/HoD/Dean)
 *
 * Query params:
 *   format     — 'docx' | 'pdf'
 *   offeringId — CourseOffering ObjectId (optional)
 *   semester   — Semester ObjectId (optional)
 *   faculty    — Faculty ObjectId (optional, Dean/HoD only)
 */
const exportCCPForm = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { format, semester: requestedSemesterId, faculty: queryFacultyId, offeringId } = req.query;

    if (!format || !['docx', 'pdf'].includes(format.toLowerCase())) {
      return sendError(res, "Invalid export format. Must be 'docx' or 'pdf'.", 400);
    }

    let offering = null;
    if (offeringId) {
      try {
        offering = await courseOfferingService.getOfferingById(offeringId, req.user);
      } catch (err) {
        return sendError(res, err.message, err.statusCode || 500);
      }
    }

    if (!offering) {
      if (!courseId) {
        return sendError(res, 'Course ID or Offering ID is required', 400);
      }
      // 1. Authorize course access
      const authCheck = await checkCourseAccess(req.user, courseId);
      if (!authCheck.authorized) {
        return sendError(res, authCheck.message, authCheck.status);
      }

      // 2. Faculty isolation
      let targetFacultyId = req.user._id;
      if (
        queryFacultyId &&
        (req.user.designation === 'dean' || req.user.designation === 'hod') &&
        mongoose.Types.ObjectId.isValid(queryFacultyId)
      ) {
        targetFacultyId = new mongoose.Types.ObjectId(queryFacultyId);
      }

      const offeringRes = await courseOfferingService.resolveOfferingForLegacyContext(
        req.user,
        courseId,
        requestedSemesterId,
        targetFacultyId
      );
      if (offeringRes.ambiguous) {
        return sendError(
          res,
          'Multiple course offerings exist for this course. Please provide offeringId to specify which offering to export.',
          409
        );
      }
      if (offeringRes.offering) {
        offering = offeringRes.offering;
      }
    }

    let form = null;
    let fallbackCourse = null;

    if (offering) {
      // 1. Explicitly linked to this offering
      form = await CCP.findOne({ courseOffering: offering._id, formType: 'ASSESS_PROJECT' }).lean();

      // 2. Unlinked legacy document with EXACT same semester and section
      if (!form) {
        form = await CCP.findOne({
          courseOffering: null,
          course: offering.course._id || offering.course,
          faculty: offering.faculty._id || offering.faculty,
          semester: offering.semester._id || offering.semester,
          section: offering.section || 'A',
          formType: 'ASSESS_PROJECT'
        }).lean();
      }

      // 3. Unlinked legacy document with semester: null ONLY if EXACTLY 1 offering exists for this course + faculty
      if (!form) {
        const offeringCount = await CourseOffering.countDocuments({
          course: offering.course._id || offering.course,
          faculty: offering.faculty._id || offering.faculty
        });
        if (offeringCount === 1) {
          form = await CCP.findOne({
            courseOffering: null,
            course: offering.course._id || offering.course,
            faculty: offering.faculty._id || offering.faculty,
            semester: null,
            formType: 'ASSESS_PROJECT'
          }).lean();
        }
      }

      fallbackCourse = offering.course;
    } else {
      let targetFacultyId = req.user._id;
      if (
        queryFacultyId &&
        (req.user.designation === 'dean' || req.user.designation === 'hod') &&
        mongoose.Types.ObjectId.isValid(queryFacultyId)
      ) {
        targetFacultyId = new mongoose.Types.ObjectId(queryFacultyId);
      }

      // 3. Query CCP document
      const query = {
        course: courseId,
        faculty: targetFacultyId,
        courseOffering: null,
        formType: 'ASSESS_PROJECT',
      };

      if (requestedSemesterId && mongoose.Types.ObjectId.isValid(requestedSemesterId)) {
        query.semester = new mongoose.Types.ObjectId(requestedSemesterId);
      }

      const count = await CCP.countDocuments(query);
      if (count > 1) {
        return sendError(res, 'Multiple unlinked CCP forms exist for this course. Please provide offeringId.', 409);
      }

      form = await CCP.findOne(query).lean();

      // Fallback to active semester if no document found and no specific semester was requested
      if (!form && !requestedSemesterId) {
        const activeSem = await Semester.findOne({ status: 'active' });
        if (activeSem) {
          form = await CCP.findOne({
            course: courseId,
            faculty: targetFacultyId,
            courseOffering: null,
            formType: 'ASSESS_PROJECT',
            semester: activeSem._id,
          }).lean();
        }
      }
    }


    if (!form) {
      return sendError(res, 'CCP form not found. Please save it first.', 404);
    }

    const exportData = {
      headerInfo: form.headerInfo || {},
      mappingTable: form.mappingTable || {},
      problemStatement: form.problemStatement || '',
      constraintsAssumptions: form.constraintsAssumptions || '',
      computationalTools: form.computationalTools || '',
      expectedOutcomes: form.expectedOutcomes || '',
      deliverables: form.deliverables || {},
      wpAttributes: form.wpAttributes || [],
    };

    const courseCode = form.headerInfo?.courseCode || fallbackCourse?.courseCode || 'Course';
    const sanitizedCode = courseCode.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format.toLowerCase() === 'docx') {
      const buffer = await generateCCPWord(exportData);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="CCP_Class_Project_${sanitizedCode}.docx"`
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      return res.send(buffer);
    }

    if (format.toLowerCase() === 'pdf') {
      const buffer = await generateCCPPDF(exportData);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="CCP_Class_Project_${sanitizedCode}.pdf"`
      );
      res.setHeader('Content-Type', 'application/pdf');
      return res.send(buffer);
    }
  } catch (err) {
    console.error('Error in exportCCPForm:', err);
    next(err);
  }
};


module.exports = {
  getCCPForm,
  saveCCPForm,
  exportCCPForm,
  checkCourseAccess,
  resolveSemester,
};
