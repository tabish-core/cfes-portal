const userService = require('../services/user.service');
const { sendSuccess, sendError } = require('../utils/response');

const getFaculties = async (_req, res, next) => {
  try {
    const faculties = await userService.listFaculties();
    return sendSuccess(res, { faculties }, 'Faculty users fetched');
  } catch (err) {
    next(err);
  }
};

const updateFaculty = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, password, department, isActive } = req.body;

    if (!name && !email && !password && department === undefined && isActive === undefined) {
      return sendError(res, 'At least one field is required to update', 400);
    }

    if (password && password.length < 6) {
      return sendError(res, 'Password must be at least 6 characters', 400);
    }

    const faculty = await userService.updateFaculty(id, {
      name,
      email,
      password,
      department,
      isActive,
    });

    return sendSuccess(res, { faculty }, 'Faculty account updated');
  } catch (err) {
    next(err);
  }
};

module.exports = { getFaculties, updateFaculty };
