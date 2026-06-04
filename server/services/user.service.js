const User = require('../models/User.model');

const listFaculties = async (departmentFilter = {}) => {
  return User.find({ designation: { $in: ['faculty', 'hod'] }, ...departmentFilter })
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

module.exports = { listFaculties, updateFaculty };
