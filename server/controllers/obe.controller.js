const asyncHandler = require('../middlewares/asyncHandler.middleware');
const ErrorResponse = require('../utils/errorResponse');
const OBEConfiguration = require('../models/OBEConfiguration.model');
const Course = require('../models/Course.model');
const CourseOffering = require('../models/CourseOffering.model');
const OBEStudent = require('../models/OBEStudent.model');
const OBEAssessment = require('../models/OBEAssessment.model');
const OBEMark = require('../models/OBEMark.model');
const { generateCourseResults } = require('../services/obe/obeCalculationService');
const { generateOBEExcel } = require('../services/obe/obeExcelService');

/**
 * Helper function to verify if the faculty is authorized for the given course.
 */
const checkCourseAuth = async (user, courseId) => {
  if (user.role === 'faculty') {
    const isAssigned = await CourseOffering.exists({ course: courseId, faculty: user._id });
    if (!isAssigned) {
      return false;
    }
  }
  return true;
};

/**
 * Helper function to ensure exactly one Mid Term and Final Exam exist
 * for the given faculty-course workspace.
 */
const ensureFixedAssessments = async (courseId, facultyId) => {
  const fixedCategories = [
    { category: 'midTerm', title: 'Mid Term' },
    { category: 'finalExam', title: 'Final Exam' }
  ];

  for (const fixed of fixedCategories) {
    const exists = await OBEAssessment.findOne({ course: courseId, faculty: facultyId, category: fixed.category });
    if (!exists) {
      await OBEAssessment.create({
        course: courseId,
        faculty: facultyId,
        category: fixed.category,
        title: fixed.title,
        order: fixed.category === 'midTerm' ? 100 : 200, // Keep them logically ordered at the end
        active: true,
        components: []
      });
    }
  }
};

/**
 * Helper to generate the next component number (e.g. Q4)
 */
const generateNextComponentNumber = (assessment, category) => {
  const prefixMap = { quizzes: 'Q', assignments: 'A', midTerm: 'M', finalExam: 'F' };
  const prefix = prefixMap[category];
  
  if (!assessment.components || assessment.components.length === 0) {
    return `${prefix}1`;
  }
  
  // Find highest number
  let maxNum = 0;
  for (const comp of assessment.components) {
    const numPart = comp.componentNumber.replace(prefix, '');
    const num = parseInt(numPart, 10);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  }
  
  return `${prefix}${maxNum + 1}`;
};

/**
 * @desc    Get OBE Configuration for a specific course
 * @route   GET /api/obe/:courseId/config
 * @access  Private (Faculty/HoD/Dean)
 */
exports.getConfig = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const facultyId = req.user._id;

  if (!(await checkCourseAuth(req.user, courseId))) {
    return next(new ErrorResponse('Not authorized to access this course', 403));
  }

  // Ensure Fixed Assessments are created during OBE initialization
  await ensureFixedAssessments(courseId, facultyId);

  // Find configuration scoped to this faculty-course pair
  let config = await OBEConfiguration.findOne({ course: courseId, faculty: facultyId }).populate('course', 'courseCode courseName creditHours type');

  // If none exists, return a default template (not saved yet, will be saved on first POST/PUT)
  if (!config) {
    const courseDetails = await Course.findById(courseId).select('courseCode courseName creditHours type');
    config = {
      course: courseDetails || courseId, // Populate with actual details if found
      clos: [],
      gas: [],
      cloGaMapping: [],
      assessments: {
        quizzes: 10,
        assignments: 25,
        midTerm: 25,
        finalExam: 40,
      },
      grades: {
        A: 88,
        BPlus: 81,
        B: 74,
        CPlus: 67,
        C: 60,
        F: 59,
      }
    };
  }

  res.status(200).json({
    success: true,
    data: config,
  });
});

/**
 * @desc    Create or Update OBE Configuration for a specific course
 * @route   POST /api/obe/:courseId/config
 * @access  Private (Faculty/HoD/Dean)
 */
exports.updateConfig = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const facultyId = req.user._id;
  const { clos, gas, cloGaMapping, assessments, grades, kpiThreshold } = req.body;

  if (!(await checkCourseAuth(req.user, courseId))) {
    return next(new ErrorResponse('Not authorized to modify this course', 403));
  }

  // Validation: Assessment weightages must sum to exactly 100
  if (assessments) {
    const { quizzes, assignments, midTerm, finalExam } = assessments;
    const total = Number(quizzes) + Number(assignments) + Number(midTerm) + Number(finalExam);
    if (total !== 100) {
      return next(new ErrorResponse(`Assessment weightages must total exactly 100%. Current total: ${total}%`, 400));
    }
  }

  // Validation: Grade boundaries logical ordering
  if (grades) {
    const { A, BPlus, B, CPlus, C, F } = grades;
    if (!(A > BPlus && BPlus > B && B > CPlus && CPlus > C && C > F)) {
      return next(new ErrorResponse('Grade boundaries must be logically ordered and not overlap.', 400));
    }
  }

  // Upsert configuration scoped to this faculty-course pair
  const config = await OBEConfiguration.findOneAndUpdate(
    { course: courseId, faculty: facultyId },
    { clos, gas, cloGaMapping, assessments, grades, kpiThreshold, faculty: facultyId },
    { new: true, upsert: true, runValidators: true }
  ).populate('course', 'courseCode courseName creditHours type');

  res.status(200).json({
    success: true,
    data: config,
  });
});

/* =========================================================
   STUDENT ROSTER ENDPOINTS
========================================================= */

/**
 * @desc    Get all active students for a course
 * @route   GET /api/obe/:courseId/students
 */
exports.getStudents = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const facultyId = req.user._id;

  if (!(await checkCourseAuth(req.user, courseId))) {
    return next(new ErrorResponse('Not authorized to access this course', 403));
  }

  const students = await OBEStudent.find({ course: courseId, faculty: facultyId, active: true }).sort({ registrationNo: 1 });

  res.status(200).json({
    success: true,
    count: students.length,
    data: students
  });
});

/**
 * @desc    Add a new student
 * @route   POST /api/obe/:courseId/students
 */
exports.createStudent = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const facultyId = req.user._id;
  const { registrationNo, studentName } = req.body;

  if (!(await checkCourseAuth(req.user, courseId))) {
    return next(new ErrorResponse('Not authorized to modify this course', 403));
  }

  // Check for existing active or inactive student in this faculty's workspace
  let existing = await OBEStudent.findOne({ course: courseId, faculty: facultyId, registrationNo });
  
  if (existing) {
    if (!existing.active) {
      existing.active = true;
      existing.studentName = studentName;
      await existing.save();
      return res.status(200).json({ success: true, data: existing });
    }
    return next(new ErrorResponse('Student with this registration number already exists in this course.', 400));
  }

  const student = await OBEStudent.create({
    course: courseId,
    faculty: facultyId,
    registrationNo,
    studentName,
    active: true
  });

  res.status(201).json({
    success: true,
    data: student
  });
});

/**
 * @desc    Update a student
 * @route   PUT /api/obe/:courseId/students/:studentId
 */
exports.updateStudent = asyncHandler(async (req, res, next) => {
  const { courseId, studentId } = req.params;
  const facultyId = req.user._id;
  const { registrationNo, studentName, active } = req.body;

  if (!(await checkCourseAuth(req.user, courseId))) {
    return next(new ErrorResponse('Not authorized to modify this course', 403));
  }

  let student = await OBEStudent.findOne({ _id: studentId, course: courseId, faculty: facultyId });
  if (!student) {
    return next(new ErrorResponse('Student not found in this course', 404));
  }

  // Prevent duplicate registrationNo if they changed it
  if (registrationNo && registrationNo !== student.registrationNo) {
    const existing = await OBEStudent.findOne({ course: courseId, faculty: facultyId, registrationNo });
    if (existing) {
      return next(new ErrorResponse('Registration number already exists for another student.', 400));
    }
  }

  student.registrationNo = registrationNo || student.registrationNo;
  student.studentName = studentName || student.studentName;
  if (active !== undefined) student.active = active;

  await student.save();

  res.status(200).json({
    success: true,
    data: student
  });
});

/**
 * @desc    Soft delete a student
 * @route   DELETE /api/obe/:courseId/students/:studentId
 */
exports.deleteStudent = asyncHandler(async (req, res, next) => {
  const { courseId, studentId } = req.params;
  const facultyId = req.user._id;

  if (!(await checkCourseAuth(req.user, courseId))) {
    return next(new ErrorResponse('Not authorized to modify this course', 403));
  }

  const student = await OBEStudent.findOne({ _id: studentId, course: courseId, faculty: facultyId });
  if (!student) {
    return next(new ErrorResponse('Student not found in this course', 404));
  }

  student.active = false;
  await student.save();

  res.status(200).json({
    success: true,
    data: {}
  });
});

/* =========================================================
   ASSESSMENT STRUCTURE ENDPOINTS
========================================================= */

/**
 * @desc    Get all active assessments for a course
 * @route   GET /api/obe/:courseId/assessments
 */
exports.getAssessments = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const facultyId = req.user._id;

  if (!(await checkCourseAuth(req.user, courseId))) {
    return next(new ErrorResponse('Not authorized to access this course', 403));
  }

  const assessments = await OBEAssessment.find({ course: courseId, faculty: facultyId, active: true }).sort({ category: 1, order: 1, createdAt: 1 });

  res.status(200).json({
    success: true,
    count: assessments.length,
    data: assessments
  });
});

/**
 * @desc    Add a new assessment (Quizzes and Assignments only)
 * @route   POST /api/obe/:courseId/assessments
 */
exports.createAssessment = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const facultyId = req.user._id;
  const { category, title, order } = req.body;

  if (!(await checkCourseAuth(req.user, courseId))) {
    return next(new ErrorResponse('Not authorized to modify this course', 403));
  }

  if (category === 'midTerm' || category === 'finalExam') {
    return next(new ErrorResponse(`Cannot manually create a ${category} assessment. It is fixed.`, 400));
  }

  const assessment = await OBEAssessment.create({
    course: courseId,
    faculty: facultyId,
    category,
    title,
    order: order || 0,
    components: [],
    active: true
  });

  res.status(201).json({
    success: true,
    data: assessment
  });
});

/**
 * @desc    Update an assessment
 * @route   PUT /api/obe/:courseId/assessments/:assessmentId
 */
exports.updateAssessment = asyncHandler(async (req, res, next) => {
  const { courseId, assessmentId } = req.params;
  const facultyId = req.user._id;
  const { title, order, active } = req.body;

  if (!(await checkCourseAuth(req.user, courseId))) {
    return next(new ErrorResponse('Not authorized to modify this course', 403));
  }

  let assessment = await OBEAssessment.findOne({ _id: assessmentId, course: courseId, faculty: facultyId });
  if (!assessment) {
    return next(new ErrorResponse('Assessment not found in this course', 404));
  }

  if (title) assessment.title = title;
  if (order !== undefined) assessment.order = order;
  if (active !== undefined) assessment.active = active;

  await assessment.save();

  res.status(200).json({
    success: true,
    data: assessment
  });
});

/**
 * @desc    Soft delete an assessment (Dynamic only)
 * @route   DELETE /api/obe/:courseId/assessments/:assessmentId
 */
exports.deleteAssessment = asyncHandler(async (req, res, next) => {
  const { courseId, assessmentId } = req.params;
  const facultyId = req.user._id;

  if (!(await checkCourseAuth(req.user, courseId))) {
    return next(new ErrorResponse('Not authorized to modify this course', 403));
  }

  const assessment = await OBEAssessment.findOne({ _id: assessmentId, course: courseId, faculty: facultyId });
  if (!assessment) {
    return next(new ErrorResponse('Assessment not found in this course', 404));
  }

  if (assessment.category === 'midTerm' || assessment.category === 'finalExam') {
    return next(new ErrorResponse(`Cannot delete a fixed ${assessment.category} assessment.`, 400));
  }

  assessment.active = false;
  await assessment.save();

  res.status(200).json({
    success: true,
    data: {}
  });
});

/* =========================================================
   ASSESSMENT COMPONENTS ENDPOINTS
========================================================= */

/**
 * @desc    Add a component to an assessment
 * @route   POST /api/obe/:courseId/assessments/:assessmentId/components
 */
exports.addComponent = asyncHandler(async (req, res, next) => {
  const { courseId, assessmentId } = req.params;
  const facultyId = req.user._id;
  const { maxMarks, cloNumber, title } = req.body;

  if (!(await checkCourseAuth(req.user, courseId))) {
    return next(new ErrorResponse('Not authorized to modify this course', 403));
  }

  const assessment = await OBEAssessment.findOne({ _id: assessmentId, course: courseId, faculty: facultyId });
  if (!assessment) return next(new ErrorResponse('Assessment not found', 404));

  // Validate CLO exists in this faculty's configuration
  const config = await OBEConfiguration.findOne({ course: courseId, faculty: facultyId });
  if (!config) return next(new ErrorResponse('OBE Configuration not found for this course.', 404));
  
  const validClo = config.clos.find(c => c.cloNumber === cloNumber && c.active);
  if (!validClo) {
    return next(new ErrorResponse(`Invalid CLO reference: ${cloNumber} does not exist or is inactive in this course.`, 400));
  }

  const componentNumber = generateNextComponentNumber(assessment, assessment.category);

  const newComponent = {
    componentNumber,
    title,
    maxMarks: Number(maxMarks),
    cloNumber,
    active: true
  };

  assessment.components.push(newComponent);
  await assessment.save();

  res.status(201).json({ success: true, data: assessment });
});

/**
 * @desc    Update a component
 * @route   PUT /api/obe/:courseId/assessments/:assessmentId/components/:componentId
 */
exports.updateComponent = asyncHandler(async (req, res, next) => {
  const { courseId, assessmentId, componentId } = req.params;
  const facultyId = req.user._id;
  const { maxMarks, cloNumber, title, active } = req.body;

  if (!(await checkCourseAuth(req.user, courseId))) {
    return next(new ErrorResponse('Not authorized to modify this course', 403));
  }

  const assessment = await OBEAssessment.findOne({ _id: assessmentId, course: courseId, faculty: facultyId });
  if (!assessment) return next(new ErrorResponse('Assessment not found', 404));

  const component = assessment.components.id(componentId);
  if (!component) return next(new ErrorResponse('Component not found', 404));

  // Validate CLO exists if changing
  if (cloNumber && cloNumber !== component.cloNumber) {
    const config = await OBEConfiguration.findOne({ course: courseId, faculty: facultyId });
    if (!config) return next(new ErrorResponse('OBE Configuration not found', 404));
    
    const validClo = config.clos.find(c => c.cloNumber === cloNumber && c.active);
    if (!validClo) {
      return next(new ErrorResponse(`Invalid CLO reference: ${cloNumber} does not exist or is inactive.`, 400));
    }
    component.cloNumber = cloNumber;
  }

  if (maxMarks !== undefined) component.maxMarks = Number(maxMarks);
  if (title !== undefined) component.title = title;
  if (active !== undefined) component.active = active;

  await assessment.save();

  res.status(200).json({ success: true, data: assessment });
});

/**
 * @desc    Soft delete a component
 * @route   DELETE /api/obe/:courseId/assessments/:assessmentId/components/:componentId
 */
exports.deleteComponent = asyncHandler(async (req, res, next) => {
  const { courseId, assessmentId, componentId } = req.params;
  const facultyId = req.user._id;

  if (!(await checkCourseAuth(req.user, courseId))) {
    return next(new ErrorResponse('Not authorized to modify this course', 403));
  }

  const assessment = await OBEAssessment.findOne({ _id: assessmentId, course: courseId, faculty: facultyId });
  if (!assessment) return next(new ErrorResponse('Assessment not found', 404));

  const component = assessment.components.id(componentId);
  if (!component) return next(new ErrorResponse('Component not found', 404));

  component.active = false;
  await assessment.save();

  res.status(200).json({ success: true, data: assessment });
});

/* =========================================================
   STUDENT MARKS ENDPOINTS
========================================================= */

/**
 * @desc    Get all marks for a course
 * @route   GET /api/obe/:courseId/marks
 */
exports.getMarks = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const facultyId = req.user._id;

  if (!(await checkCourseAuth(req.user, courseId))) {
    return next(new ErrorResponse('Not authorized to access this course', 403));
  }

  const marks = await OBEMark.find({ course: courseId, faculty: facultyId });

  res.status(200).json({
    success: true,
    count: marks.length,
    data: marks
  });
});

/**
 * @desc    Bulk save marks for a course
 * @route   PUT /api/obe/:courseId/marks/bulk
 */
exports.saveMarksBulk = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const facultyId = req.user._id;
  const { marks } = req.body;

  if (!(await checkCourseAuth(req.user, courseId))) {
    return next(new ErrorResponse('Not authorized to modify this course', 403));
  }

  if (!Array.isArray(marks)) {
    return next(new ErrorResponse('Marks payload must be an array', 400));
  }

  // Pre-fetch active students and assessments to validate in memory (O(N) db queries instead of O(N*M))
  const students = await OBEStudent.find({ course: courseId, faculty: facultyId, active: true }).lean();
  const assessments = await OBEAssessment.find({ course: courseId, faculty: facultyId, active: true }).lean();

  const studentIds = new Set(students.map(s => s._id.toString()));
  
  // Build a map of valid component IDs to their parent assessment and maxMarks
  const componentMap = new Map();
  for (const assessment of assessments) {
    if (assessment.components && assessment.components.length > 0) {
      for (const comp of assessment.components) {
        if (comp.active) {
          componentMap.set(comp._id.toString(), {
            assessmentId: assessment._id.toString(),
            maxMarks: comp.maxMarks
          });
        }
      }
    }
  }

  const bulkOps = [];

  for (const markObj of marks) {
    const { student, componentId, marks: markValue } = markObj;

    // Validate student exists and is active in this faculty's workspace
    if (!studentIds.has(student)) {
      return next(new ErrorResponse(`Invalid or inactive student: ${student}`, 400));
    }

    // Validate component exists and is active in this faculty's workspace
    if (!componentMap.has(componentId)) {
      return next(new ErrorResponse(`Invalid or inactive component: ${componentId}`, 400));
    }

    const { assessmentId, maxMarks } = componentMap.get(componentId);

    // If markValue is empty/null, it means faculty cleared it -> Delete the document
    if (markValue === null || markValue === '' || markValue === undefined) {
      bulkOps.push({
        deleteOne: {
          filter: { course: courseId, faculty: facultyId, student, componentId }
        }
      });
      continue;
    }

    // Validate marks value
    const numericMark = Number(markValue);
    if (isNaN(numericMark) || numericMark < 0 || numericMark > maxMarks) {
      return next(new ErrorResponse(`Invalid mark ${markValue} for component ${componentId}. Must be between 0 and ${maxMarks}.`, 400));
    }

    // Valid mark -> Upsert the document
    bulkOps.push({
      updateOne: {
        filter: { course: courseId, faculty: facultyId, student, componentId },
        update: { $set: { assessment: assessmentId, marks: numericMark } },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await OBEMark.bulkWrite(bulkOps);
  }

  res.status(200).json({
    success: true,
    message: 'Marks saved successfully'
  });
});

/**
 * @desc    Get computed OBE results for a course
 * @route   GET /api/obe/:courseId/results
 */
exports.getResults = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const facultyId = req.user._id;

  if (!(await checkCourseAuth(req.user, courseId))) {
    return next(new ErrorResponse('Not authorized to access this course', 403));
  }

  // Load configuration, active students, active assessments, and marks — all scoped to this faculty
  const [config, students, assessments, marks] = await Promise.all([
    OBEConfiguration.findOne({ course: courseId, faculty: facultyId }).lean(),
    OBEStudent.find({ course: courseId, faculty: facultyId, active: true }).sort({ registrationNo: 1 }).lean(),
    OBEAssessment.find({ course: courseId, faculty: facultyId, active: true }).lean(),
    OBEMark.find({ course: courseId, faculty: facultyId }).lean()
  ]);

  if (!config) {
    return next(new ErrorResponse('OBE Configuration not found. Please complete Course Setup first.', 404));
  }

  const results = generateCourseResults(config, students, assessments, marks);

  res.status(200).json({
    success: true,
    data: results
  });
});

/**
 * @desc    Export OBE Award List to Excel
 * @route   GET /api/obe/:courseId/export/excel
 */
exports.exportOBEExcel = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const facultyId = req.user._id;

  if (!(await checkCourseAuth(req.user, courseId))) {
    return next(new ErrorResponse('Not authorized to access this course', 403));
  }

  // Load course details — scoped to the current faculty's offering
  const course = await CourseOffering.findOne({ course: courseId, faculty: facultyId })
    .populate('course')
    .populate('faculty', 'name')
    .populate('semester', 'name session')
    .lean();
    
  if (!course) {
    return next(new ErrorResponse('Course not found', 404));
  }
  
  // Flatten populated properties for ease of access in excel service
  const courseData = {
    ...course,
    courseCode: course.course?.courseCode,
    courseName: course.course?.courseName,
    creditHours: course.course?.creditHours,
    type: course.course?.type
  };

  // Load all OBE data scoped to this faculty
  const [config, students, assessments, marks] = await Promise.all([
    OBEConfiguration.findOne({ course: courseId, faculty: facultyId }).lean(),
    OBEStudent.find({ course: courseId, faculty: facultyId, active: true }).sort({ registrationNo: 1 }).lean(),
    OBEAssessment.find({ course: courseId, faculty: facultyId, active: true }).lean(),
    OBEMark.find({ course: courseId, faculty: facultyId }).lean()
  ]);

  if (!config) {
    return next(new ErrorResponse('OBE Configuration not found. Please complete Course Setup first.', 404));
  }

  const results = generateCourseResults(config, students, assessments, marks);

  try {
    const buffer = await generateOBEExcel({ course: courseData, config, assessments, marks, results });
    
    // Set headers for file download
    const safeCourseCode = (courseData.courseCode || 'Course').replace(/[^a-zA-Z0-9]/g, '_');
    const safeSemester = (courseData.session || courseData.semester?.name || 'Semester').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `OBE_Award_List_${safeCourseCode}_${safeSemester}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.send(buffer);
  } catch (error) {
    require('fs').writeFileSync('d:\\cfes-portal\\server\\error_log.txt', error.stack || error.message);
    console.error('Excel Generation Error:', error);
    return next(new ErrorResponse('Failed to generate Excel file: ' + error.message, 500));
  }
});
