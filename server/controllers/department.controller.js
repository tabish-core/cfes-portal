const Department = require('../models/Department.model');
const User = require('../models/User.model');
const { sendSuccess, sendError } = require('../utils/response');

const getAllDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find()
      .populate('hod', 'name email')
      .sort({ name: 1 });
    return sendSuccess(res, { departments }, 'Departments fetched');
  } catch (err) {
    next(err);
  }
};

const assignHod = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { hodId } = req.body;

    const department = await Department.findById(id);
    if (!department) return sendError(res, 'Department not found', 404);

    if (hodId) {
      const user = await User.findById(hodId);
      if (!user) return sendError(res, 'User not found', 404);
      
      // Update old HoD designation back to faculty if they are no longer HoD anywhere
      if (department.hod && department.hod.toString() !== hodId.toString()) {
        await User.findByIdAndUpdate(department.hod, { designation: 'faculty' });
      }

      department.hod = hodId;
      await department.save();

      // Update new HoD designation and department
      user.designation = 'hod';
      user.department = department._id;
      await user.save();
    } else {
      // Remove HoD
      if (department.hod) {
        await User.findByIdAndUpdate(department.hod, { designation: 'faculty' });
        department.hod = null;
        await department.save();
      }
    }

    return sendSuccess(res, { department }, 'HoD updated successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllDepartments, assignHod };
