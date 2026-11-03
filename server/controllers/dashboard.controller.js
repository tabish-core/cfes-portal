const Department = require('../models/Department.model');
const User = require('../models/User.model');
const Course = require('../models/Course.model');
const CourseOffering = require('../models/CourseOffering.model');
const CIS = require('../models/CIS.model');
const CCR = require('../models/CCR.model');
const Semester = require('../models/Semester.model');
const CourseChecklist = require('../models/CourseChecklist.model');
const CourseFile = require('../models/CourseFile.model');
const courseOfferingService = require('../services/courseOffering.service');

// Standard count of items defined in the institutional CourseChecklist schema
const DEFAULT_CHECKLIST_ITEMS_COUNT = 19;

/**
 * @desc    Get Dean Dashboard Statistics
 * @route   GET /api/dashboard/dean
 * @access  Private (Dean only)
 */
exports.getDeanDashboardStats = async (req, res, next) => {
  try {
    // 1. Fetch baseline institutional entities and active semester in parallel
    const [
      totalDepartments,
      activeFaculty,
      totalHods,
      totalCourses,
      activeSemester,
      departmentsList
    ] = await Promise.all([
      Department.countDocuments({ isActive: { $ne: false } }),
      User.countDocuments({ designation: 'faculty', isActive: true }),
      User.countDocuments({ designation: 'hod', isActive: true }),
      Course.countDocuments({ isActive: { $ne: false } }),
      Semester.findOne({ status: 'active' }).select('_id name status'),
      Department.find({ isActive: { $ne: false } }).select('_id name code').sort({ name: 1 }).lean()
    ]);

    // 2. If no active semester is configured, return baseline institutional totals
    if (!activeSemester) {
      const departmentSummaries = departmentsList.map((dept) => ({
        _id: dept._id,
        name: dept.name,
        code: dept.code,
        offeringsCount: 0,
        facultyCount: 0,
        checklistCompletionPct: 0,
      }));

      return res.status(200).json({
        success: true,
        data: {
          activeSemester: null,
          totalDepartments,
          activeFaculty,
          totalHods,
          totalCourses,
          totalOfferings: 0,
          unassignedOfferings: 0,
          checklistCompletionPercentage: 0,
          driveSync: {
            totalSyncedFiles: 0,
            offeringsWithFilesCount: 0,
            syncRate: 0,
          },
          departments: departmentSummaries,
        },
      });
    }

    // 3. Active semester exists — fetch active semester offerings
    const activeOfferings = await CourseOffering.find({ semester: activeSemester._id })
      .populate('course', 'courseCode courseName department')
      .populate('faculty', 'name email department isActive')
      .lean();

    const totalOfferings = activeOfferings.length;
    // In CourseOffering schema, faculty is required. Unassigned offerings count evaluates null faculty.
    const unassignedOfferings = activeOfferings.filter((o) => !o.faculty).length;

    // 4. Fetch checklists, synced files, and department faculty counts
    const offeringIds = activeOfferings.map((o) => o._id);

    const [checklists, syncedFiles, departmentFacultyCounts] = await Promise.all([
      offeringIds.length > 0
        ? CourseChecklist.find({
            $or: [
              { courseOffering: { $in: offeringIds } },
              { semester: activeSemester._id },
            ],
          }).lean()
        : [],
      offeringIds.length > 0
        ? CourseFile.find({
            semester: activeSemester._id,
            status: 'synced',
          }).select('courseOffering').lean()
        : [],
      User.aggregate([
        { $match: { designation: 'faculty', isActive: true, department: { $ne: null } } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
      ]),
    ]);

    // Build faculty count lookup map by department ID
    const facultyCountMap = new Map();
    departmentFacultyCounts.forEach((df) => {
      if (df._id) facultyCountMap.set(df._id.toString(), df.count);
    });

    // Index checklists by courseOffering ID and by composite fallback (course_faculty_section)
    const checklistByOfferingId = new Map();
    const checklistByFallback = new Map();

    checklists.forEach((cl) => {
      if (cl.courseOffering) {
        checklistByOfferingId.set(cl.courseOffering.toString(), cl);
      }
      const courseIdStr = cl.course ? cl.course.toString() : '';
      const facultyIdStr = cl.faculty ? cl.faculty.toString() : '';
      const sectionStr = cl.section || 'A';
      if (courseIdStr && facultyIdStr) {
        checklistByFallback.set(`${courseIdStr}_${facultyIdStr}_${sectionStr}`, cl);
      }
    });

    // 5. Aggregate checklist metrics across all active offerings and by department
    const deptStatsMap = new Map();
    departmentsList.forEach((dept) => {
      deptStatsMap.set(dept._id.toString(), {
        _id: dept._id,
        name: dept.name,
        code: dept.code,
        offeringsCount: 0,
        facultyCount: facultyCountMap.get(dept._id.toString()) || 0,
        completedItemsSum: 0,
        totalItemsSum: 0,
      });
    });

    let overallCompletedItems = 0;
    let overallTotalItems = 0;

    activeOfferings.forEach((offering) => {
      // Find matching checklist
      let checklist = checklistByOfferingId.get(offering._id.toString());
      if (!checklist) {
        const courseIdStr = offering.course?._id
          ? offering.course._id.toString()
          : (offering.course ? offering.course.toString() : '');
        const facultyIdStr = offering.faculty?._id
          ? offering.faculty._id.toString()
          : (offering.faculty ? offering.faculty.toString() : '');
        const sectionStr = offering.section || 'A';
        checklist = checklistByFallback.get(`${courseIdStr}_${facultyIdStr}_${sectionStr}`);
      }

      let completedCount = 0;
      let totalCount = DEFAULT_CHECKLIST_ITEMS_COUNT;

      if (checklist && Array.isArray(checklist.checklistItems) && checklist.checklistItems.length > 0) {
        totalCount = checklist.checklistItems.length;
        completedCount = checklist.checklistItems.filter((item) => item.completed).length;
      }

      overallCompletedItems += completedCount;
      overallTotalItems += totalCount;

      // Identify department for this offering: offering.department (canonical), fallback to course.department or faculty.department
      const deptId = offering.department
        ? (offering.department._id || offering.department).toString()
        : (offering.course?.department
          ? (offering.course.department._id || offering.course.department).toString()
          : (offering.faculty?.department
            ? (offering.faculty.department._id || offering.faculty.department).toString()
            : null));

      if (deptId && deptStatsMap.has(deptId)) {
        const deptStat = deptStatsMap.get(deptId);
        deptStat.offeringsCount += 1;
        deptStat.completedItemsSum += completedCount;
        deptStat.totalItemsSum += totalCount;
      }
    });

    // Overall checklist completion percentage (1 decimal place)
    const checklistCompletionPercentage = overallTotalItems > 0
      ? Math.round((overallCompletedItems / overallTotalItems) * 1000) / 10
      : 0;

    // 6. Google Drive Sync Metrics
    const totalSyncedFiles = syncedFiles.length;
    const offeringsWithSyncedFiles = new Set(
      syncedFiles.map((f) => f.courseOffering?.toString()).filter(Boolean)
    ).size;

    const driveSyncRate = totalOfferings > 0
      ? Math.round((offeringsWithSyncedFiles / totalOfferings) * 1000) / 10
      : 0;

    // 7. Format department summaries
    const departmentSummaries = Array.from(deptStatsMap.values()).map((dept) => {
      const completionPct = dept.totalItemsSum > 0
        ? Math.round((dept.completedItemsSum / dept.totalItemsSum) * 1000) / 10
        : 0;

      return {
        _id: dept._id,
        name: dept.name,
        code: dept.code,
        offeringsCount: dept.offeringsCount,
        facultyCount: dept.facultyCount,
        checklistCompletionPct: completionPct,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        activeSemester: {
          id: activeSemester._id,
          name: activeSemester.name,
        },
        totalDepartments,
        activeFaculty,
        totalHods,
        totalCourses,
        totalOfferings,
        unassignedOfferings,
        checklistCompletionPercentage,
        driveSync: {
          totalSyncedFiles,
          offeringsWithFilesCount: offeringsWithSyncedFiles,
          syncRate: driveSyncRate,
        },
        departments: departmentSummaries,
      },
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
    if (!req.user || !req.user.department) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to a department.'
      });
    }

    const deptId = req.user.department._id || req.user.department;

    // 1. Fetch department details, active semester, faculty count, and courses count in parallel
    const [deptDoc, activeSemester, departmentFacultyCount, departmentCoursesCount] = await Promise.all([
      Department.findById(deptId).select('_id name code').lean(),
      Semester.findOne({ status: 'active' }).select('_id name status').lean(),
      User.countDocuments({ department: deptId, designation: 'faculty', isActive: true }),
      Course.countDocuments({ department: deptId, isActive: { $ne: false } }),
    ]);

    if (!deptDoc) {
      return res.status(404).json({
        success: false,
        message: 'Assigned department not found.'
      });
    }

    // 2. If no active semester is configured, return baseline departmental metrics safely
    if (!activeSemester) {
      return res.status(200).json({
        success: true,
        data: {
          activeSemester: null,
          department: {
            id: deptDoc._id,
            name: deptDoc.name,
            code: deptDoc.code,
          },
          departmentFacultyCount,
          assignedInstructorsCount: 0,
          departmentCoursesCount,
          activeOfferingsCount: 0,
          unassignedOfferingsCount: 0,
          checklistCompletionPercentage: 0,
          driveSyncRate: 0,
          driveSync: {
            totalSyncedFiles: 0,
            offeringsWithFilesCount: 0,
            syncRate: 0,
          },
          totalFaculty: departmentFacultyCount,
          totalCourses: departmentCoursesCount,
          totalOfferings: 0,
          unassignedOfferings: 0,
          offerings: [],
        }
      });
    }

    // 3. Active semester exists — fetch department offerings with progress and drive sync
    // Reuses courseOfferingService.listOfferingsBySemester with strict department isolation
    const offerings = await courseOfferingService.listOfferingsBySemester(
      activeSemester._id.toString(),
      { department: deptId },
      true // includeProgress
    );

    const totalOfferings = offerings.length;
    const unassignedOfferings = offerings.filter((o) => !o.faculty).length;

    // Assigned unique instructors count
    const assignedInstructorIds = new Set(
      offerings
        .map((o) => (o.faculty?._id ? o.faculty._id.toString() : (o.faculty ? o.faculty.toString() : null)))
        .filter(Boolean)
    );
    const assignedInstructorsCount = assignedInstructorIds.size;

    // Checklist metrics aggregation
    let totalCompletedItems = 0;
    let totalPossibleItems = 0;

    offerings.forEach((o) => {
      totalCompletedItems += o.progress?.completedCount ?? 0;
      totalPossibleItems += o.progress?.totalCount ?? 19;
    });

    const checklistCompletionPercentage = totalPossibleItems > 0
      ? Math.round((totalCompletedItems / totalPossibleItems) * 1000) / 10
      : 0;

    // Google Drive sync metrics
    let totalSyncedFiles = 0;
    let offeringsWithFilesCount = 0;

    offerings.forEach((o) => {
      const count = o.drive?.syncedFilesCount ?? 0;
      totalSyncedFiles += count;
      if (count > 0) offeringsWithFilesCount += 1;
    });

    const driveSyncRate = totalOfferings > 0
      ? Math.round((offeringsWithFilesCount / totalOfferings) * 1000) / 10
      : 0;

    // Format active offering summaries
    const offeringSummaries = offerings.map((o) => ({
      _id: o._id,
      section: o.section || 'A',
      course: o.course ? {
        _id: o.course._id,
        courseCode: o.course.courseCode,
        courseName: o.course.courseName,
        creditHours: o.course.creditHours,
        type: o.course.type,
      } : null,
      instructor: o.faculty ? {
        _id: o.faculty._id,
        name: o.faculty.name,
        email: o.faculty.email,
      } : null,
      faculty: o.faculty ? {
        _id: o.faculty._id,
        name: o.faculty.name,
        email: o.faculty.email,
      } : null,
      checklistProgress: {
        completedCount: o.progress?.completedCount ?? 0,
        totalCount: o.progress?.totalCount ?? 19,
        completionPercentage: o.progress?.completionPercentage ?? 0,
        status: o.progress?.status || 'Not Started',
      },
      driveStatus: {
        syncedFilesCount: o.drive?.syncedFilesCount ?? 0,
        folderId: o.drive?.folderId || null,
        folderUrl: o.drive?.folderUrl || null,
        status: o.drive?.status || 'Not Synced',
      },
    }));

    res.status(200).json({
      success: true,
      data: {
        activeSemester: {
          id: activeSemester._id,
          name: activeSemester.name,
          status: activeSemester.status,
        },
        department: {
          id: deptDoc._id,
          name: deptDoc.name,
          code: deptDoc.code,
        },
        departmentFacultyCount,
        assignedInstructorsCount,
        departmentCoursesCount,
        activeOfferingsCount: totalOfferings,
        unassignedOfferingsCount: unassignedOfferings,
        checklistCompletionPercentage,
        driveSyncRate,
        driveSync: {
          totalSyncedFiles,
          offeringsWithFilesCount,
          syncRate: driveSyncRate,
        },
        totalFaculty: departmentFacultyCount,
        totalCourses: departmentCoursesCount,
        totalOfferings,
        unassignedOfferings,
        offerings: offeringSummaries,
      }
    });
  } catch (err) {
    next(err);
  }
};
