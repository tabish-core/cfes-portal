const User = require('../models/User.model');

/**
 * List faculty + HoD users for a single department (default scope).
 *
 * @param {object} departmentFilter - e.g. { department: deptId } or { _id: null } to block
 * @returns {Promise<Array<Object>>}
 */
const listFaculties = async (departmentFilter = {}) => {
  return User.find({ designation: { $in: ['faculty', 'hod'] }, ...departmentFilter })
    .populate('department', 'name code')
    .select('-__v')
    .sort({ createdAt: -1 });
};

/**
 * List faculty + HoD users across a set of departments (cross-department visibility).
 *
 * Used for READ-ONLY HoD directory views where the HoD may see faculty in their
 * own department plus any matrix-visible departments. This is a pure read path;
 * it does NOT grant write rights and does NOT modify any User document.
 *
 * @param {Array<string>} departmentIds - Array of department ObjectId strings
 * @param {object} [opts]
 * @param {boolean} [opts.includeOwnDepartment=true] - Whether to always include the
 *   caller's own department even if not present in departmentIds.
 * @param {string} [opts.ownDepartmentId] - Caller's own department ObjectId string
 * @returns {Promise<Array<Object>>}
 */
const listFacultiesByVisibleDepartments = async (departmentIds, { includeOwnDepartment = true, ownDepartmentId = null } = {}) => {
  const ids = Array.isArray(departmentIds) ? departmentIds.filter(Boolean) : [];

  if (ids.length === 0) {
    return [];
  }

  const query = {
    designation: { $in: ['faculty', 'hod'] },
    department: { $in: ids },
  };

  if (includeOwnDepartment && ownDepartmentId && !ids.includes(ownDepartmentId)) {
    query.department = { $in: [...ids, ownDepartmentId] };
  }

  return User.find(query)
    .populate('department', 'name code')
    .select('-__v')
    .sort({ createdAt: -1 });
};

const updateFaculty = async (id, { name, email, password, department, isActive }) => {
  const faculty = await User.findOne({ _id: id, designation: { $in: ['faculty', 'hod'] } }).select('+password');
  if (!faculty) {
    const err = new Error('Faculty user not found');
    err.statusCode = 404;
    throw err;
  }

  if (email) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: faculty._id },
    });
    if (existing) {
      const err = new Error('Email is already in use by another account');
      err.statusCode = 409;
      throw err;
    }
    faculty.email = normalizedEmail;
  }

  if (typeof name === 'string') faculty.name = name.trim();
  if (typeof department === 'string') faculty.department = department.trim();
  if (typeof isActive === 'boolean') faculty.isActive = isActive;
  if (password) faculty.password = password;

  await faculty.save();
  return faculty;
};

module.exports = { listFaculties, listFacultiesByVisibleDepartments, updateFaculty };
