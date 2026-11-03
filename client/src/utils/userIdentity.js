/**
 * userIdentity.js — Institutional user identity and department resolution helpers.
 *
 * Requirements:
 *  1. Dean: Role is "Dean of Academic Affairs", Scope is "University Administration",
 *     and department is NEVER displayed or fabricated.
 *  2. HoD: Role is "Head of Department", department displays "{name} ({code})",
 *     or "Department not assigned" if missing.
 *  3. Faculty: Role is "Faculty Member", department displays "{name} ({code})",
 *     or "Department not assigned" if missing.
 *  4. Never guess or infer a department from courses or offerings.
 */

/**
 * Returns canonical institutional label for the user's role/designation.
 * @param {Object} user - Authenticated user object from AuthContext
 * @returns {string} - Formatted role label
 */
export const getUserRoleLabel = (user) => {
  if (user?.designation === 'dean') return 'Dean of Academic Affairs';
  if (user?.designation === 'hod') return 'Head of Department';
  return 'Faculty Member';
};

/**
 * Returns formatted department identity for HoD and Faculty users.
 * Returns null for Dean (Deans have university-wide administration scope, never a department).
 * Returns "Department not assigned" if no department record is assigned.
 *
 * @param {Object} user - Authenticated user object from AuthContext
 * @param {Object} [fallbackDept] - Optional verified department object from departmental stats
 * @returns {string|null} - Formatted department display string, or null for Dean
 */
export const getUserDepartmentLabel = (user, fallbackDept = null) => {
  if (user?.designation === 'dean') {
    return null;
  }

  const dept =
    user?.department && typeof user.department === 'object' && user.department.name
      ? user.department
      : fallbackDept && typeof fallbackDept === 'object' && fallbackDept.name
      ? fallbackDept
      : null;

  if (dept?.name) {
    return `${dept.name}${dept.code ? ` (${dept.code})` : ''}`;
  }

  return 'Department not assigned';
};

