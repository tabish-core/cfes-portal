const userService = require('../services/user.service');
const courseOfferingService = require('../services/courseOffering.service');
const Department = require('../models/Department.model');
const { sendSuccess, sendError } = require('../utils/response');

const getFaculties = async (req, res, next) => {
  try {
    // Opt-in cross-department directory visibility for HoDs.
    // When ?visible=true is supplied, the HoD's expanded visible department set
    // is used instead of the strict single-department filter. This is READ-ONLY;
    // it does not affect PUT /users/faculty/:id (Dean-only) or any write path.
    if (req.query.visible === 'true' && req.user && req.user.designation === 'hod') {
      const visibleIds = await courseOfferingService.getVisibleDepartmentIds(req.user);
      if (visibleIds === null) {
        // Dean-equivalent universal access
        const faculties = await userService.listFaculties({});
        return sendSuccess(res, { faculties, visibleDepartmentIds: null }, 'Faculty users fetched');
      }
      const ownDeptId = (req.user.department?._id || req.user.department)?.toString() || null;
      const faculties = await userService.listFacultiesByVisibleDepartments(visibleIds, {
        includeOwnDepartment: true,
        ownDepartmentId: ownDeptId,
      });

      // Return the visible department master list (names + codes) so the
      // frontend can build department filter tabs without hardcoding.
      const departments = await Department.find({ _id: { $in: visibleIds } })
        .select('_id name code')
        .sort({ name: 1 })
        .lean();

      return sendSuccess(
        res,
        { faculties, visibleDepartmentIds: visibleIds, departments },
        'Faculty users fetched'
      );
    }

    const faculties = await userService.listFaculties(req.departmentFilter);
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
