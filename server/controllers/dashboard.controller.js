const Department = require('../models/Department.model');
const User = require('../models/User.model');
const Course = require('../models/Course.model');
const CourseOffering = require('../models/CourseOffering.model');
const CIS = require('../models/CIS.model');
const CCR = require('../models/CCR.model');
const Semester = require('../models/Semester.model');

/**
 * @desc    Get Dean Dashboard Statistics
 * @route   GET /api/dashboard/dean
 * @access  Private (Dean only)
 */
exports.getDeanDashboardStats = async (req, res, next) => {
  try {
    // Run all queries in parallel for performance
    const [
      totalDepartments,
      totalFaculty,
      totalHods,
      totalCourses,
      totalOfferings,
      cisSubmittedCount,
      cisDraftCount,
      ccrSubmittedCount,
      ccrDraftCount,
      activeSemester
    ] = await Promise.all([
      Department.countDocuments(),
      User.countDocuments({ designation: 'faculty' }),
      User.countDocuments({ designation: 'hod' }),
      Course.countDocuments(),
      CourseOffering.countDocuments(),
      CIS.countDocuments({ status: 'submitted' }),
      CIS.countDocuments({ status: 'draft' }),
      CCR.countDocuments({ status: 'submitted' }),
      CCR.countDocuments({ status: 'draft' }),
      Semester.findOne({ status: 'active' }).select('name')
    ]);

    const totalSubmittedForms = cisSubmittedCount + ccrSubmittedCount;
    const totalDraftForms = cisDraftCount + ccrDraftCount;

    res.status(200).json({
      success: true,
      data: {
        totalDepartments,
        totalFaculty,
        totalHods,
        totalCourses,
        totalOfferings,
        totalSubmittedForms,
        totalDraftForms,
        activeSemester: activeSemester ? activeSemester.name : 'None',
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get HoD Dashboard Statistics
 * @route   GET /api/dashboard/hod
 * @access  Private (HoD only)
 */
exports.getHodDashboardStats = async (req, res, next) => {
  try {
    if (!req.user.department) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to a department.'
      });
    }

    const deptId = req.user.department;

    // Run initial independent queries
    const [totalFaculty, totalCourses, deptCourseDocs] = await Promise.all([
      User.countDocuments({ department: deptId, designation: 'faculty' }),
      Course.countDocuments({ department: deptId }),
      Course.find({ department: deptId }).select('_id')
    ]);

    const courseIds = deptCourseDocs.map(c => c._id);

    let totalOfferings = 0;
    let cisSubmittedCount = 0;
    let cisDraftCount = 0;
    let ccrSubmittedCount = 0;
    let ccrDraftCount = 0;

    if (courseIds.length > 0) {
      // Run dependent queries
      [
        totalOfferings,
        cisSubmittedCount,
        cisDraftCount,
        ccrSubmittedCount,
        ccrDraftCount
      ] = await Promise.all([
        CourseOffering.countDocuments({ course: { $in: courseIds } }),
        CIS.countDocuments({ course: { $in: courseIds }, status: 'submitted' }),
        CIS.countDocuments({ course: { $in: courseIds }, status: 'draft' }),
        CCR.countDocuments({ course: { $in: courseIds }, status: 'submitted' }),
        CCR.countDocuments({ course: { $in: courseIds }, status: 'draft' })
      ]);
    }

    const FORM_TYPES_COUNT = 2; // CIS + CCR
    const totalFormsExpected = totalOfferings * FORM_TYPES_COUNT;
    const totalSubmittedForms = cisSubmittedCount + ccrSubmittedCount;
    const totalDraftForms = cisDraftCount + ccrDraftCount;
    const pendingForms = Math.max(0, totalFormsExpected - totalDraftForms - totalSubmittedForms);

    res.status(200).json({
      success: true,
      data: {
        totalFaculty,
        totalCourses,
        totalOfferings,
        totalSubmittedForms,
        totalDraftForms,
        pendingForms,
      }
    });
  } catch (err) {
    next(err);
  }
};
