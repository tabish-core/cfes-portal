/**
 * courseOffering.service.js — Business logic for course offering operations.
 *
 * A CourseOffering links a faculty member to a course in a specific semester/section.
 */
const mongoose        = require('mongoose');
const CourseOffering   = require('../models/CourseOffering.model');
const Course           = require('../models/Course.model');
const User             = require('../models/User.model');
const Semester         = require('../models/Semester.model');
const Department       = require('../models/Department.model');
const CourseChecklist  = require('../models/CourseChecklist.model');
const CourseFile       = require('../models/CourseFile.model');

// Mapping of checklist item types to acceptable synced CourseFile documentTypes
const SYNCHABLE_ITEM_DOC_TYPES = {
  CIS: ['CIS'],
  CCR: ['CCR'],
  TIMETABLE: ['TIMETABLE'],
  LECTURES: ['LECTURES'],
  ASSESS_QUIZ: ['ASSESS_QUIZ'],
  ASSESS_ASSIGN: ['ASSESS_ASSIGN'],
  ASSESS_MID: ['MIDTERM_EXAM_PAPER', 'MIDTERM_BEST_COPY', 'MIDTERM_AVERAGE_COPY', 'MIDTERM_WORST_COPY', 'ASSESS_MID'],
  ASSESS_FINAL: ['FINAL_EXAM_PAPER', 'FINAL_BEST_COPY', 'FINAL_AVERAGE_COPY', 'FINAL_WORST_COPY', 'ASSESS_FINAL'],
  ASSESS_PROJECT: ['ASSESS_PROJECT', 'CCP'],
  CCC: ['CCC'],
  CRR: ['CRR'],
};

/* ── helpers ───────────────────────────────────────────────────────────── */
const fail = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
};

/* ── Department visibility matrix ──────────────────────────────────────────
 *
 * Cross-department visibility for HoDs is a READ-ONLY arrangement. It does NOT
 * change department ownership, HoD responsibilities, or any write permission.
 *
 * Keys are canonical department codes (as stored on Department.code). Values
 * are the set of department codes the HoD of that department may view.
 *
 * Admin/Dean ('dean' designation) has universal access and is handled
 * separately — it never consults this map.
 */
const DEPARTMENT_VISIBILITY_MATRIX = {
  AI:   ['AI'],
  CS:   ['CS', 'AI', 'CYS'],
  CYS:  ['CYS'],
  BSSE: ['BSSE', 'AC', 'BSE'],
  AC:   ['AC'],
  BSE:  ['BSE'],
  BEEE: ['BEEE'],
};

/**
 * Resolve the department code from a user document, tolerating both populated
 * objects and raw ObjectId strings.
 *
 * @param {Object|null} user
 * @returns {string|null}
 */
const resolveUserDepartmentCode = (user) => {
  if (!user) return null;
  const dept = user.department;
  if (!dept) return null;
  if (typeof dept === 'string') return dept;
  if (typeof dept.code === 'string') return dept.code.toUpperCase();
  if (dept._id && typeof dept._id.toString === 'function') return dept._id.toString();
  return null;
};

/**
 * Compute the set of department ObjectIds a user is permitted to view.
 *
 * Rules:
 *  - Dean/Admin: universal access -> null (no filter; all departments).
 *  - HoD: own department + any departments listed in the visibility matrix.
 *  - Faculty: own department only.
 *  - User with no department: empty set (blocked).
 *
 * @param {Object|null} user - Authenticated user (req.user)
 * @returns {Promise<Array<string>>} Array of department ObjectId strings.
 *   Returns null to signal "universal access" (Dean).
 */
const getVisibleDepartmentIds = async (user) => {
  if (!user) return [];

  // Dean has universal access across all departments
  if (user.designation === 'dean') {
    return null;
  }

  const userDeptId = (user.department?._id || user.department)?.toString();
  if (!userDeptId) {
    return [];
  }

  // Faculty can only see their own department
  if (user.designation === 'faculty') {
    return [userDeptId];
  }

  // HoD: own department + matrix-visible departments
  if (user.designation === 'hod') {
    const ownCode = resolveUserDepartmentCode(user);
    const visibleCodes = ownCode ? DEPARTMENT_VISIBILITY_MATRIX[ownCode] : null;

    // If we cannot resolve a code, fall back to own-department only
    if (!visibleCodes || visibleCodes.length === 0) {
      return [userDeptId];
    }

    // Resolve each visible code to its department ObjectId
    const Department = mongoose.model('Department');
    const departments = await Department.find({
      code: { $in: visibleCodes },
      isActive: { $ne: false },
    })
      .select('_id code name')
      .lean();

    const ids = departments.map((d) => d._id.toString());

    // Always include the HoD's own department (matrix may omit it if it is
    // the only entry, but we must never lose ownership scope).
    if (!ids.includes(userDeptId)) {
      ids.push(userDeptId);
    }

    return ids;
  }

  return [userDeptId];
};

/**
 * Determine whether a user may READ a given CourseOffering.
 *
 * This is a READ-ONLY visibility check. It does NOT grant write rights.
 *
 * Rules:
 *  - Dean: always allowed.
 *  - Assigned instructor: always allowed (their own offering).
 *  - HoD: allowed if the offering's department is in the HoD's visible set.
 *  - Faculty (non-instructor): not allowed.
 *
 * @param {Object} offering - Populated or plain CourseOffering object
 * @param {Object|null} user - Authenticated user
 * @returns {Promise<boolean>}
 */
const canViewOffering = async (offering, user) => {
  if (!offering) return false;
  if (!user) return false;

  if (user.designation === 'dean') return true;

  // Assigned instructor always has access to their own offering
  const offeringFacultyId = offering.faculty?._id
    ? offering.faculty._id.toString()
    : (offering.faculty ? offering.faculty.toString() : null);
  if (offeringFacultyId && offeringFacultyId === user._id.toString()) {
    return true;
  }

  if (user.designation !== 'hod') return false;

  const offeringDept =
    offering.department?._id ||
    offering.department ||
    offering.course?.department?._id ||
    offering.course?.department;
  if (!offeringDept) return false;

  const offeringDeptId = offeringDept.toString();
  const visibleIds = await getVisibleDepartmentIds(user);
  if (visibleIds === null) return true; // Dean (defensive; handled above)
  return visibleIds.includes(offeringDeptId);
};

/* ── Service functions ─────────────────────────────────────────────────── */

/**
 * Create a new CourseOffering (admin assigns faculty → course → semester).
 *
 * Validates:
 *  1. All three IDs are valid ObjectIds pointing to existing documents.
 *  2. The faculty user is active and has role 'faculty'.
 *  3. The offering doesn't already exist (compound unique index will catch,
 *     but we provide a friendlier error message here).
 *
 * @param {string} facultyId
 * @param {string} courseId
 * @param {string} semesterId
 * @param {string} [section='A']
 */
const createOffering = async (facultyId, courseId, semesterId, section = 'A', user, departmentId = null) => {
  // ── Validate IDs ────────────────────────────────────────────────────────
  if (facultyId && !mongoose.Types.ObjectId.isValid(facultyId))  fail('Invalid faculty ID',  400);
  if (!mongoose.Types.ObjectId.isValid(courseId))    fail('Invalid course ID',   400);
  if (!mongoose.Types.ObjectId.isValid(semesterId))  fail('Invalid semester ID', 400);
  if (departmentId && !mongoose.Types.ObjectId.isValid(departmentId)) fail('Invalid department ID', 400);

  // ── Confirm documents exist ─────────────────────────────────────────────
  const [faculty, course, semester] = await Promise.all([
    facultyId ? User.findById(facultyId) : Promise.resolve(null),
    Course.findById(courseId),
    Semester.findById(semesterId),
  ]);

  if (facultyId && !faculty) fail('Faculty user not found', 404);
  if (faculty && !faculty.isActive) fail('Cannot assign course to a deactivated faculty account', 403);
  if (!course)           fail('Course not found', 404);
  if (!semester)         fail('Semester not found', 404);

  // Determine offering department owner
  let targetDepartmentId = null;

  if (user && user.designation === 'hod') {
    if (!user.department) fail('HoD has no assigned department.', 403);
    targetDepartmentId = user.department._id || user.department;

    // HoD can only assign faculty belonging to their own department
    if (faculty) {
      const facDept = faculty.department?._id || faculty.department;
      if (!facDept || facDept.toString() !== targetDepartmentId.toString()) {
        fail('You are only allowed to assign faculty members belonging to your department.', 403);
      }
    }
  } else if (user && user.designation === 'dean') {
    // Dean can specify department explicitly, or fallback to faculty's department or course's department
    if (departmentId) {
      targetDepartmentId = departmentId;
    } else if (faculty && faculty.department) {
      targetDepartmentId = faculty.department._id || faculty.department;
    } else if (course.department) {
      targetDepartmentId = course.department._id || course.department;
    } else {
      fail('Department owner is required for course offering.', 400);
    }
  } else {
    // Fallback if user is unsupplied (e.g. testing)
    if (departmentId) {
      targetDepartmentId = departmentId;
    } else if (faculty && faculty.department) {
      targetDepartmentId = faculty.department._id || faculty.department;
    } else if (course.department) {
      targetDepartmentId = course.department._id || course.department;
    } else {
      fail('Department owner is required for course offering.', 400);
    }
  }

  // ── Check for duplicate ─────────────────────────────────────────────────
  const duplicate = await CourseOffering.findOne({
    course: courseId,
    semester: semesterId,
    section: (section || 'A').toUpperCase().trim(),
  });
  if (duplicate) {
    fail(
      `This course (section ${(section || 'A').toUpperCase()}) is already assigned in this semester.`,
      409
    );
  }

  // ── Create ──────────────────────────────────────────────────────────────
  const offering = await CourseOffering.create({
    faculty: facultyId || null,
    course: courseId,
    semester: semesterId,
    section: (section || 'A').toUpperCase().trim(),
    department: targetDepartmentId,
  });

  return offering.populate([
    { path: 'faculty', select: 'name email department' },
    { path: 'course', select: 'courseCode courseName type creditHours' },
    { path: 'semester', select: 'name status' },
    { path: 'department', select: 'name code' },
  ]);
};

/**
 * Remove (unassign) a course offering by its _id.
 */
const removeOffering = async (offeringId, user) => {
  if (!mongoose.Types.ObjectId.isValid(offeringId)) fail('Invalid offering ID', 400);

  const offering = await CourseOffering.findById(offeringId).populate('course');
  if (!offering) fail('Course offering not found', 404);

  if (user && user.designation === 'hod') {
    const offeringDept =
      offering.department?._id ||
      offering.department ||
      offering.course?.department?._id ||
      offering.course?.department;
    const userDeptId = (user.department?._id || user.department)?.toString();
    if (!userDeptId || !offeringDept || offeringDept.toString() !== userDeptId) {
      fail('You are only allowed to remove offerings belonging to your department.', 403);
    }
  }

  await offering.deleteOne();
  return offering;
};

/**
 * Resolves the Google Drive parent folder ID and URL for a CourseOffering.
 *
 * Requirements:
 *  1. Only expose an Open Drive link when the correct CourseOffering parent folder
 *     URL is reliably available from offering-level metadata.
 *  2. NEVER construct a parent folder URL from CourseFile.googleDriveFolderId, which
 *     refers to a Tier 4 document-category subfolder (e.g., 'Course Documents', 'Lectures', 'Quizzes').
 *  3. If the correct parent folder cannot be established, returns null so the UI
 *     safely hides the Open Drive action.
 *
 * @param {Object} offering - CourseOffering object
 * @returns {{ folderId: string|null, folderUrl: string|null }}
 */
const resolveOfferingParentFolder = (offering) => {
  if (!offering) {
    return { folderId: null, folderUrl: null };
  }

  // 1. Direct explicit folder URL on CourseOffering metadata
  const directUrl =
    (typeof offering.googleDriveFolderUrl === 'string' && offering.googleDriveFolderUrl.trim()) ||
    (typeof offering.folderUrl === 'string' && offering.folderUrl.trim()) ||
    (typeof offering.drive?.folderUrl === 'string' && offering.drive.folderUrl.trim()) ||
    null;

  if (directUrl && directUrl.startsWith('http')) {
    const match = directUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
    const extractedId = match ? match[1] : null;
    const folderId =
      extractedId ||
      offering.googleDriveFolderId ||
      offering.driveFolderId ||
      (offering.drive?.folderId && !offering.drive?._isCategoryFolder ? offering.drive.folderId : null) ||
      null;

    return {
      folderId,
      folderUrl: directUrl,
    };
  }

  // 2. Direct parent folder ID on CourseOffering metadata (NOT from CourseFile category folder)
  const directFolderId =
    (typeof offering.googleDriveFolderId === 'string' && offering.googleDriveFolderId.trim()) ||
    (typeof offering.driveFolderId === 'string' && offering.driveFolderId.trim()) ||
    (typeof offering.drive?.folderId === 'string' && !offering.drive?._isCategoryFolder
      ? offering.drive.folderId.trim()
      : null) ||
    null;

  if (directFolderId) {
    return {
      folderId: directFolderId,
      folderUrl: `https://drive.google.com/drive/folders/${directFolderId}`,
    };
  }

  // 3. Fallback: Parent CourseOffering folder is not reliably available.
  // Never treat CourseFile category folder IDs as parent folder.
  return {
    folderId: null,
    folderUrl: null,
  };
};

/**
 * Enrich an array of offering documents with CourseChecklist progress (canonical 19 items)
 * and Google Drive synchronization metadata.
 *
 * Missing checklists default safely to 0/19 and 'Not Started'.
 * Missing Drive files default safely to 'Not Synced' with null folderUrl.
 *
 * @param {Array<Object>} offerings - Raw offering plain objects
 * @param {string} semesterId - Academic semester ObjectId string
 * @param {object} [opts]
 * @param {boolean} [opts.stripDriveLinks=false] - When true, removes per-document
 *   googleDriveWebViewLink / googleDriveWebContentLink from enriched CourseFile data
 *   for offerings outside the caller's own department. Used for cross-department
 *   HoD views where individual document links must not be exposed.
 * @param {string} [opts.ownDepartmentId] - The caller's own department ObjectId string.
 *   Used together with stripDriveLinks to decide which offerings keep their links.
 * @param {Array<string>|null} [opts.visibleDepartmentIds] - Used with ownDepartmentId to
 *   determine which offerings are "own department" vs "cross-department visible".
 * @returns {Promise<Array<Object>>} Enriched offerings with .progress and .drive
 */
const enrichOfferingsWithProgress = async (
  offerings,
  semesterId,
  { stripDriveLinks = false, ownDepartmentId = null, visibleDepartmentIds = null } = {}
) => {
  if (!offerings || offerings.length === 0) {
    return [];
  }

  const offeringIds = offerings.map((o) => o._id);

  const [checklists, courseFiles] = await Promise.all([
    CourseChecklist.find({
      $or: [
        { courseOffering: { $in: offeringIds } },
        { semester: semesterId },
      ],
    }).lean(),
    CourseFile.find({
      courseOffering: { $in: offeringIds },
      status: 'synced',
    })
      .select('courseOffering documentType googleDriveFolderId googleDriveWebViewLink googleDriveWebContentLink')
      .lean(),
  ]);

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

  // Group synced files by offeringId
  const filesByOfferingId = new Map();
  courseFiles.forEach((file) => {
    if (file.courseOffering) {
      const key = file.courseOffering.toString();
      if (!filesByOfferingId.has(key)) {
        filesByOfferingId.set(key, []);
      }
      filesByOfferingId.get(key).push(file);
    }
  });

  const DEFAULT_ITEMS_COUNT = 19;

  return offerings.map((offering) => {
    const offIdStr = offering._id.toString();

    // 1. Resolve checklist
    let cl = checklistByOfferingId.get(offIdStr);
    if (!cl) {
      const courseIdStr = offering.course?._id ? offering.course._id.toString() : '';
      const facultyIdStr = offering.faculty?._id ? offering.faculty._id.toString() : '';
      const sectionStr = offering.section || 'A';
      cl = checklistByFallback.get(`${courseIdStr}_${facultyIdStr}_${sectionStr}`);
    }

    let completedCount = 0;
    let totalCount = DEFAULT_ITEMS_COUNT;
    if (cl && Array.isArray(cl.checklistItems) && cl.checklistItems.length > 0) {
      totalCount = cl.checklistItems.length;
      completedCount = cl.checklistItems.filter((item) => item.completed).length;
    }

    const completionPercentage = totalCount > 0
      ? Math.round((completedCount / totalCount) * 1000) / 10
      : 0;

    let checklistStatus = 'Not Started';
    if (completedCount === totalCount && totalCount > 0) {
      checklistStatus = 'Complete';
    } else if (completedCount > 0) {
      checklistStatus = 'In Progress';
    }

    // 2. Resolve parent Google Drive folder URL strictly from CourseOffering metadata.
    // CourseFile.googleDriveFolderId refers to a Tier 4 document-category folder (e.g. 'Course Documents',
    // 'Lectures', 'Quizzes'), which must NEVER be used to construct the parent CourseOffering folder URL.
    const files = filesByOfferingId.get(offIdStr) || [];
    const syncedFilesCount = files.length;

    // Cross-department Drive-link stripping:
    // An HoD may view another department's offering (read-only) but must NOT receive
    // individual Google Drive document links (googleDriveWebViewLink /
    // googleDriveWebContentLink) for documents belonging to that other department.
    // The offering-level parent folderUrl is preserved (it is metadata on the
    // CourseOffering, not a per-document link).
    const offeringDeptId =
      (offering.department?._id || offering.department || offering.course?.department?._id || offering.course?.department)?.toString?.() || null;
    const isOwnDepartment = !stripDriveLinks || !ownDepartmentId
      ? true
      : (offeringDeptId ? offeringDeptId === ownDepartmentId : (Array.isArray(visibleDepartmentIds) ? false : true));

    const sanitizedFiles = isOwnDepartment
      ? files
      : files.map((f) => ({
          ...f,
          googleDriveWebViewLink: null,
          googleDriveWebContentLink: null,
        }));
    const sanitizedSyncedFilesCount = sanitizedFiles.length;
    const { folderId: parentFolderId, folderUrl } = resolveOfferingParentFolder(offering);

    // 3. Determine Google Drive Synchronization Status
    let driveStatus = 'Not Synced';
    if (sanitizedSyncedFilesCount > 0) {
      if (checklistStatus === 'Complete') {
        const syncedDocTypes = new Set(sanitizedFiles.map((f) => f.documentType));
        const synchableCompletedItems = (cl?.checklistItems || []).filter(
          (item) => item.completed && SYNCHABLE_ITEM_DOC_TYPES[item.type]
        );

        let allSynchablePresent = true;
        if (synchableCompletedItems.length > 0) {
          allSynchablePresent = synchableCompletedItems.every((item) => {
            const acceptableTypes = SYNCHABLE_ITEM_DOC_TYPES[item.type];
            return acceptableTypes.some((t) => syncedDocTypes.has(t));
          });
        }

        driveStatus = allSynchablePresent ? 'Synced' : 'Partially Synced';
      } else {
        driveStatus = 'Partially Synced';
      }
    }

    return {
      ...offering,
      progress: {
        completedCount,
        totalCount,
        completionPercentage,
        status: checklistStatus,
      },
      drive: {
        syncedFilesCount: sanitizedSyncedFilesCount,
        folderId: parentFolderId,
        folderUrl,
        status: driveStatus,
      },
      _driveFiles: sanitizedFiles,
    };
  });
};

/**
 * List all offerings for a given semester, populated with faculty + course info.
 * If includeProgress is true, enriches each offering with CourseChecklist completion
 * and CourseFile Google Drive sync metadata.
 *
 * @param {string} semesterId
 * @param {object} [departmentFilter={}] - Legacy single-department filter ({ department: id }).
 *   Ignored when visibleDepartmentIds is supplied.
 * @param {boolean} [includeProgress=false]
 * @param {object} [opts]
 * @param {Array<string>|null} [opts.visibleDepartmentIds] - Array of department ObjectId
 *   strings the caller may view. null = universal (Dean). When supplied, the query
 *   uses { $in: visibleDepartmentIds } instead of the single-department filter.
 *   When omitted (undefined), the legacy departmentFilter is applied unchanged.
 * @param {boolean} [opts.stripDriveLinks=false] - When true, removes per-document
 *   googleDriveWebViewLink / googleDriveWebContentLink from enriched CourseFile data
 *   for offerings outside the caller's own department. Used for cross-department
 *   HoD views where individual document links must not be exposed.
 * @param {string} [opts.ownDepartmentId] - The caller's own department ObjectId string.
 *   Used together with stripDriveLinks to decide which offerings keep their links.
 */
const listOfferingsBySemester = async (
  semesterId,
  departmentFilter = {},
  includeProgress = false,
  { visibleDepartmentIds = undefined, stripDriveLinks = false, ownDepartmentId = null } = {}
) => {
  if (!mongoose.Types.ObjectId.isValid(semesterId)) fail('Invalid semester ID', 400);

  const query = { semester: semesterId };

  if (visibleDepartmentIds === null) {
    // Dean / universal access — no department restriction
  } else if (Array.isArray(visibleDepartmentIds) && visibleDepartmentIds.length > 0) {
    query.department = { $in: visibleDepartmentIds };
  } else if (departmentFilter && departmentFilter.department) {
    query.department = departmentFilter.department;
  } else if (departmentFilter && departmentFilter._id === null) {
    // If blocked
    return [];
  }

  const queryObj = CourseOffering.find(query)
    .populate([
      { path: 'faculty', select: 'name email department designation' },
      { path: 'department', select: 'name code' },
    ])
    .populate({
      path: 'course',
      select: 'courseCode courseName type creditHours department',
      populate: { path: 'department', select: 'name code' },
    })
    .populate('semester', 'name status')
    .sort({ 'course.courseCode': 1 });

  if (!includeProgress) {
    return queryObj;
  }

  const offerings = await queryObj.lean();
  return enrichOfferingsWithProgress(offerings, semesterId, {
    stripDriveLinks,
    ownDepartmentId,
    visibleDepartmentIds,
  });
};

/**
 * Return offerings for a specific faculty in a specific semester.
 * Enriched with checklist progress and Google Drive synchronization metadata.
 *
 * @param {string} facultyId
 * @param {string} semesterId
 * @param {boolean} [includeProgress=true]
 */
const getMyOfferings = async (facultyId, semesterId, includeProgress = true) => {
  if (!mongoose.Types.ObjectId.isValid(semesterId)) fail('Invalid semester ID', 400);

  const queryObj = CourseOffering.find({ faculty: facultyId, semester: semesterId })
    .populate('course', 'courseCode courseName type creditHours')
    .populate('semester', 'name status')
    .sort({ 'course.courseCode': 1 });

  const offerings = await queryObj.lean();

  if (!includeProgress) {
    return offerings;
  }

  return enrichOfferingsWithProgress(offerings, semesterId);
};

/**
 * Compute dashboard statistics for a faculty member in a given semester.
 * Modernized to use the canonical 19-item CourseChecklist and Google Drive CourseFile sync.
 * Preserves legacy fields (totalForms, draftForms, submittedForms, pendingForms) for backward compatibility.
 *
 * Returns:
 *  assignedCourses          – Number of course offerings assigned to the faculty
 *  completedChecklists      – Course offerings where all 19 checklist items are complete
 *  averageChecklistProgress – Average checklist completion % across assigned courses
 *  fullySyncedCourses       – Course offerings fully synchronized to Google Drive
 *  driveSyncRate            – Percentage of assigned courses fully Drive synced
 *  totalCourses             – Preserved legacy alias for assignedCourses
 *  totalForms               – Preserved legacy forms count (courses * 2)
 *  draftForms               – Preserved legacy CIS/CCR draft count
 *  submittedForms           – Preserved legacy CIS/CCR submitted count
 *  pendingForms             – Preserved legacy pending count
 */
const getMyDashboardStats = async (facultyId, semesterId) => {
  if (!mongoose.Types.ObjectId.isValid(semesterId)) fail('Invalid semester ID', 400);

  // 1. Fetch personal offerings enriched with checklist and Drive sync progress
  const offerings = await getMyOfferings(facultyId, semesterId, true);
  const totalCourses = offerings.length;
  const assignedCourses = totalCourses;

  let completedChecklists = 0;
  let fullySyncedCourses = 0;
  let totalPercentage = 0;

  offerings.forEach((off) => {
    if (off.progress?.status === 'Complete') {
      completedChecklists++;
    }
    if (off.drive?.status === 'Synced') {
      fullySyncedCourses++;
    }
    totalPercentage += (off.progress?.completionPercentage || 0);
  });

  const averageChecklistProgress = totalCourses > 0
    ? Math.round((totalPercentage / totalCourses) * 10) / 10
    : 0;

  const driveSyncRate = totalCourses > 0
    ? Math.round((fullySyncedCourses / totalCourses) * 1000) / 10
    : 0;

  // 2. Preserve legacy CIS & CCR metrics for backward compatibility with existing consumers
  const CIS = require('../models/CIS.model');
  const CCR = require('../models/CCR.model');

  const FORM_TYPES_COUNT = 2; // CIS + CCR
  const totalForms = totalCourses * FORM_TYPES_COUNT;

  const [cisDraft, cisSubmitted, ccrDraft, ccrSubmitted] = await Promise.all([
    CIS.countDocuments({ faculty: facultyId, semester: semesterId, status: 'draft' }).catch(() => 0),
    CIS.countDocuments({ faculty: facultyId, semester: semesterId, status: 'submitted' }).catch(() => 0),
    CCR.countDocuments({ faculty: facultyId, semester: semesterId, status: 'draft' }).catch(() => 0),
    CCR.countDocuments({ faculty: facultyId, semester: semesterId, status: 'submitted' }).catch(() => 0),
  ]);

  const draftForms = cisDraft + ccrDraft;
  const submittedForms = cisSubmitted + ccrSubmitted;
  const pendingForms = Math.max(0, totalForms - draftForms - submittedForms);

  return {
    // Modern 19-item Checklist & Drive metrics
    assignedCourses,
    completedChecklists,
    averageChecklistProgress,
    fullySyncedCourses,
    driveSyncRate,

    // Preserved legacy fields
    totalCourses,
    totalForms,
    draftForms,
    submittedForms,
    pendingForms,
  };
};

/**
 * Retrieve a single CourseOffering by ID and verify user authorization.
 *
 * Rules:
 *  - Faculty can only access their own offering.
 *  - HoD can only access offerings within their department.
 *  - Dean has global access.
 */
const getOfferingById = async (offeringId, user) => {
  if (!mongoose.Types.ObjectId.isValid(offeringId)) fail('Invalid offering ID', 400);

  const offering = await CourseOffering.findById(offeringId)
    .populate({
      path: 'course',
      select: 'courseCode courseName type creditHours isLab department',
      populate: { path: 'department', select: 'name code' }
    })
    .populate('faculty', 'name email department designation')
    .populate('semester', 'name status');

  if (!offering) fail('Course offering not found', 404);

  // Authorization enforcement
  if (user) {
    if (user.designation === 'dean') {
      // Dean has universal access across all departments and offerings
      return offering;
    }

    const offeringFacultyId = offering.faculty?._id
      ? offering.faculty._id.toString()
      : offering.faculty?.toString();
    const isAssignedFaculty = Boolean(offeringFacultyId && offeringFacultyId === user._id.toString());

    // If the authenticated user (faculty or HoD) is assigned to teach this offering,
    // grant instructor access unconditionally.
    if (isAssignedFaculty) {
      return offering;
    }

    // If not the assigned instructor, check designation permissions (HoD departmental access)
    if (user.designation === 'hod') {
      const offeringDept =
        offering.department?._id ||
        offering.department ||
        offering.course?.department?._id ||
        offering.course?.department;
      const userDeptId = (user.department?._id || user.department)?.toString();
      if (!userDeptId || !offeringDept || offeringDept.toString() !== userDeptId) {
        fail('You are only authorized to access course offerings belonging to your department.', 403);
      }
    } else {
      fail('You are not authorized to access this course offering.', 403);
    }
  }

  return offering;
};

/**
 * Retrieve a single CourseOffering by ID for READ-ONLY viewing, applying the
 * expanded cross-department visibility matrix.
 *
 * IMPORTANT: This variant exists ONLY for read operations. It must NOT be used
 * by any write path (create/update/delete/upload/sync/export). All write paths
 * continue to use the strict getOfferingById(), which is unchanged.
 *
 * Rules:
 *  - Dean: universal access.
 *  - Assigned instructor: always allowed (their own offering).
 *  - HoD: allowed if the offering's department is in the HoD's visible set
 *    (own department + matrix-visible departments).
 *  - Faculty (non-instructor): not allowed.
 *
 * The returned object carries a `__meta.isCrossDepartmentView` flag so callers
 * can apply read-only safeguards (e.g. hiding sync/upload controls).
 *
 * @param {string} offeringId
 * @param {Object|null} user - Authenticated user
 * @returns {Promise<Object>} The offering, or throws 403/404.
 */
const getOfferingByIdForView = async (offeringId, user) => {
  if (!mongoose.Types.ObjectId.isValid(offeringId)) fail('Invalid offering ID', 400);

  const offering = await CourseOffering.findById(offeringId)
    .populate({
      path: 'course',
      select: 'courseCode courseName type creditHours isLab department',
      populate: { path: 'department', select: 'name code' }
    })
    .populate('faculty', 'name email department designation')
    .populate('semester', 'name status')
    .lean();

  if (!offering) fail('Course offering not found', 404);

  const allowed = await canViewOffering(offering, user);
  if (!allowed) {
    // Preserve the original strict error semantics for non-dean users
    if (user && user.designation === 'hod') {
      fail('You are only authorized to access course offerings belonging to your department.', 403);
    }
    fail('You are not authorized to access this course offering.', 403);
  }

  // Determine whether this is a cross-department view (for read-only flagging)
  let isCrossDepartmentView = false;
  if (user && user.designation === 'hod') {
    const userDeptId = (user.department?._id || user.department)?.toString();
    const offeringDept =
      offering.department?._id ||
      offering.department ||
      offering.course?.department?._id ||
      offering.course?.department;
    isCrossDepartmentView = Boolean(
      userDeptId && offeringDept && offeringDept.toString() !== userDeptId
    );
  }

  offering.__meta = {
    isCrossDepartmentView,
    canModify: !isCrossDepartmentView,
  };
  return offering;
};

/**
 * Verifies if the requesting user is authorized to access the given course.
 *
 * Authorization rules:
 *   - Dean: universal access across all departments.
 *   - HoD: universal catalog access for departmental allocation and curriculum planning.
 *   - Faculty: allowed if assigned via CourseOffering or Course.assignedFaculty.
 *
 * @param {Object} user - Authenticated user from req.user
 * @param {string} courseId - Course MongoDB ObjectId string
 * @returns {Promise<{ authorized: boolean, status?: number, message?: string, course?: Object }>}
 */
const checkCourseAccess = async (user, courseId) => {
  if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
    return { authorized: false, status: 400, message: 'Invalid or missing Course ID.' };
  }

  const course = await Course.findById(courseId);
  if (!course) {
    return { authorized: false, status: 404, message: 'Course not found.' };
  }

  if (user.designation === 'dean') {
    return { authorized: true, course };
  }

  if (user.designation === 'hod') {
    const courseDept = course.department?._id || course.department;
    const userDeptId = (user.department?._id || user.department)?.toString();
    if (!userDeptId || !courseDept || courseDept.toString() !== userDeptId) {
      return {
        authorized: false,
        status: 403,
        message: 'Forbidden. As HoD, you are only allowed to access courses belonging to your department.',
      };
    }
    return { authorized: true, course };
  }

  const isAssigned =
    (await CourseOffering.exists({ course: courseId, faculty: user._id })) ||
    (course.assignedFaculty && course.assignedFaculty.toString() === user._id.toString());

  if (!isAssigned) {
    return {
      authorized: false,
      status: 403,
      message: 'Forbidden. You are not assigned to this course.',
    };
  }

  return { authorized: true, course };
};

/**
 * Resolves course offerings for a legacy context (where offeringId was not supplied).
 *
 * Rules:
 *  - If multiple offerings match (e.g. Section A and Section B, or multiple semesters),
 *    the target cannot be established reliably -> { ambiguous: true, count, offerings }
 *  - If exactly 1 offering matches -> { ambiguous: false, count: 1, offering: offerings[0] }
 *  - If 0 offerings match -> { ambiguous: false, count: 0, offering: null }
 *
 * @param {Object} user - Authenticated user (req.user)
 * @param {string} courseId - Course ObjectId
 * @param {string} [semesterId] - Optional semester ObjectId
 * @param {string} [facultyId=null] - Optional override faculty ObjectId (for Dean/HOD)
 */
const resolveOfferingForLegacyContext = async (user, courseId, semesterId, facultyId = null) => {
  const targetFacultyId = facultyId || user._id;
  const query = {
    course: courseId,
    faculty: targetFacultyId,
  };
  if (semesterId && mongoose.Types.ObjectId.isValid(semesterId)) {
    query.semester = semesterId;
  }

  const offerings = await CourseOffering.find(query)
    .populate({
      path: 'course',
      select: 'courseCode courseName type creditHours isLab department',
      populate: { path: 'department', select: 'name code' }
    })
    .populate('faculty', 'name email department designation')
    .populate('semester', 'name status');

  if (offerings.length > 1) {
    return { ambiguous: true, count: offerings.length, offerings };
  }

  if (offerings.length === 1) {
    return { ambiguous: false, count: 1, offering: offerings[0] };
  }

  return { ambiguous: false, count: 0, offering: null };
};

module.exports = {
  createOffering,
  removeOffering,
  listOfferingsBySemester,
  getMyOfferings,
  getMyDashboardStats,
  getOfferingById,
  getOfferingByIdForView,
  checkCourseAccess,
  resolveOfferingForLegacyContext,
  resolveOfferingParentFolder,
  getVisibleDepartmentIds,
  canViewOffering,
  DEPARTMENT_VISIBILITY_MATRIX,
  resolveUserDepartmentCode,
};


