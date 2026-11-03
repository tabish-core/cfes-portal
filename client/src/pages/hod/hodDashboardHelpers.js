/**
 * hodDashboardHelpers.js — Pure presentation and data formatting helpers
 * for the modernized Head of Department (HoD) Dashboard.
 */

export const HOD_QUICK_LINKS = [
  {
    to: '/hod/courses',
    label: 'Course Allocation',
    desc: 'Assign departmental course offerings and sections to faculty',
    icon: 'book',
  },
  {
    to: '/hod/submissions',
    label: 'Submissions',
    desc: 'Audit course files, checklist compliance, and Drive sync',
    icon: 'document',
  },
  {
    to: '/hod/faculty',
    label: 'Department Faculty',
    desc: 'Review faculty members and their active teaching loads',
    icon: 'users',
  },
  {
    to: '/faculty/dashboard',
    label: 'My Faculty Dashboard',
    desc: 'Switch to personal faculty view to manage assigned course files',
    icon: 'view',
  },
];

/**
 * Maps Drive sync status string to semantic StatusBadge variant.
 */
export const getDriveBadgeVariant = (status) => {
  if (!status) return 'neutral';
  const s = String(status).trim().toLowerCase();
  if (s === 'synced') return 'success';
  if (s === 'partially synced') return 'warning';
  if (s === 'not synced') return 'danger';
  return 'neutral';
};

/**
 * Formats a single course offering for the Department Course Progress table.
 */
export const formatOfferingProgress = (offering) => {
  if (!offering) {
    return {
      id: null,
      courseCode: '—',
      courseName: 'Untitled Course',
      section: 'A',
      instructor: null,
      completedCount: 0,
      totalCount: 19,
      completionPercentage: 0,
      driveStatusText: 'Not Synced',
      driveVariant: 'danger',
    };
  }

  const courseCode = offering.course?.courseCode || '—';
  const courseName = offering.course?.courseName || 'Untitled Course';
  const section = offering.section || 'A';
  const instructor = offering.instructor || offering.faculty || null;

  const checklist = offering.checklistProgress || offering.checklist || offering.progress || {};
  const completedCount = checklist.completedCount ?? 0;
  const totalCount = checklist.totalCount ?? 19;
  const completionPercentage = checklist.completionPercentage ?? (
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  );

  const drive = offering.driveStatus || offering.drive || {};
  const driveStatusText = drive.status || (drive.syncedFilesCount > 0 ? 'Synced' : 'Not Synced');
  const driveVariant = getDriveBadgeVariant(driveStatusText);

  return {
    id: offering._id,
    courseCode,
    courseName,
    section,
    instructor,
    completedCount,
    totalCount,
    completionPercentage,
    driveStatusText,
    driveVariant,
  };
};

/**
 * Computes the 6 compact metric cards for the HoD dashboard.
 */
export const computeHodDashboardCards = (stats) => {
  const hasActiveSemester = Boolean(stats?.activeSemester);

  const activeFaculty = stats?.departmentFacultyCount ?? stats?.totalFaculty ?? 0;
  const assignedInstructors = stats?.assignedInstructorsCount ?? 0;
  const departmentCourses = stats?.departmentCoursesCount ?? stats?.totalCourses ?? 0;
  const activeOfferings = stats?.activeOfferingsCount ?? stats?.totalOfferings ?? 0;
  const unassignedOfferings = stats?.unassignedOfferingsCount ?? stats?.unassignedOfferings ?? 0;
  const checklistCompliance = stats?.checklistCompletionPercentage ?? 0;
  const driveSyncRate = stats?.driveSyncRate ?? stats?.driveSync?.syncRate ?? 0;

  const offeringsWithFiles = stats?.driveSync?.offeringsWithFilesCount ?? (
    Array.isArray(stats?.offerings)
      ? stats.offerings.filter((o) => (o.driveStatus?.syncedFilesCount ?? o.drive?.syncedFilesCount ?? 0) > 0).length
      : 0
  );

  return [
    {
      id: 'stat-faculty',
      label: 'Active Faculty',
      value: activeFaculty,
      subtext: `${assignedInstructors} assigned to courses`,
      color: 'purple',
    },
    {
      id: 'stat-courses',
      label: 'Department Courses',
      value: departmentCourses,
      subtext: null,
      color: 'blue',
    },
    {
      id: 'stat-offerings',
      label: 'Active Offerings',
      value: activeOfferings,
      subtext: hasActiveSemester ? null : 'No active semester',
      color: 'blue',
    },
    {
      id: 'stat-unassigned',
      label: 'Unassigned Offerings',
      value: unassignedOfferings,
      subtext: unassignedOfferings > 0 ? 'Requires faculty assignment' : 'All offerings assigned',
      color: unassignedOfferings > 0 ? 'red' : 'green',
    },
    {
      id: 'stat-checklist',
      label: 'Checklist Compliance',
      value: hasActiveSemester ? `${checklistCompliance}%` : '—',
      subtext: hasActiveSemester ? null : 'Requires active semester',
      color: checklistCompliance >= 70 ? 'green' : 'yellow',
    },
    {
      id: 'stat-drive-sync',
      label: 'Drive Sync Rate',
      value: hasActiveSemester ? `${driveSyncRate}%` : '—',
      subtext: hasActiveSemester
        ? `${offeringsWithFiles}/${activeOfferings} offerings synced`
        : 'Requires active semester',
      color: driveSyncRate >= 70 ? 'green' : 'yellow',
    },
  ];
};

