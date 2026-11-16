const mongoose = require('mongoose');

const Department = require('../models/Department.model');
const CourseOffering = require('../models/CourseOffering.model');
const User = require('../models/User.model');
const Course = require('../models/Course.model');
const Semester = require('../models/Semester.model');

const courseOfferingService = require('../services/courseOffering.service');

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

/** Build a query object stubbed so `await query` resolves to `value`. */
const makeAwaitableQuery = (value) => {
  const query = {
    populate: jest.fn(() => query),
    select: jest.fn(() => query),
    lean: jest.fn(() => query),
    then: (onFulfilled) => Promise.resolve(value).then(onFulfilled),
  };
  return query;
};

describe('Department Cross-Visibility Service Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('DEPARTMENT_VISIBILITY_MATRIX (via service)', () => {
    const { DEPARTMENT_VISIBILITY_MATRIX } = require('../services/courseOffering.service');

    test('has correct department mappings per the approved matrix', () => {
      expect(DEPARTMENT_VISIBILITY_MATRIX).toEqual({
        AI:   ['AI'],
        CS:   ['CS', 'AI', 'CYS'],
        CYS:  ['CYS'],
        BSSE: ['BSSE', 'AC', 'BSE'],
        AC:   ['AC'],
        BSE:  ['BSE'],
        BEEE: ['BEEE'],
        BSTEL: ['BSTEL'],
      });
    });
  });

  describe('resolveUserDepartmentCode', () => {
    test('extracts code string from user.department.code', () => {
      expect(
        courseOfferingService.resolveUserDepartmentCode({ department: { code: 'CS' } })
      ).toBe('CS');
    });

    test('uppercases code when necessary', () => {
      expect(
        courseOfferingService.resolveUserDepartmentCode({ department: { code: 'cs' } })
      ).toBe('CS');
    });

    test('returns string department when user.department is already a string', () => {
      expect(
        courseOfferingService.resolveUserDepartmentCode({ department: 'CS' })
      ).toBe('CS');
    });

    test('returns null when user has no department', () => {
      expect(
        courseOfferingService.resolveUserDepartmentCode({ department: null })
      ).toBeNull();
    });
  });

  describe('getVisibleDepartmentIds', () => {
    test('returns null for dean (universal access)', async () => {
      expect(
        await courseOfferingService.getVisibleDepartmentIds({
          designation: 'dean',
          _id: new mongoose.Types.ObjectId(),
        })
      ).toBeNull();
    });

    test('returns own department id for faculty', async () => {
      const deptId = new mongoose.Types.ObjectId();
      const result = await courseOfferingService.getVisibleDepartmentIds({
        designation: 'faculty',
        _id: new mongoose.Types.ObjectId(),
        department: deptId,
      });
      expect(result).toEqual([deptId.toString()]);
    });

    test('returns own + matrix departments for Hod of CS', async () => {
      const csDeptId = new mongoose.Types.ObjectId();
      const aiDeptId = new mongoose.Types.ObjectId();
      const cysDeptId = new mongoose.Types.ObjectId();

      jest.spyOn(Department, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: csDeptId, code: 'CS', name: 'Computer Science', isActive: true },
            { _id: aiDeptId, code: 'AI', name: 'Artificial Intelligence', isActive: true },
            { _id: cysDeptId, code: 'CYS', name: 'Cyber Security', isActive: true },
          ]),
        }),
      });

      const result = await courseOfferingService.getVisibleDepartmentIds({
        designation: 'hod',
        _id: new mongoose.Types.ObjectId(),
        department: { _id: csDeptId, code: 'CS' },
      });

      expect(result).toEqual(
        expect.arrayContaining([csDeptId.toString(), aiDeptId.toString(), cysDeptId.toString()])
      );
      expect(result).toHaveLength(3);
    });

    test('Hod with unknown department code falls back to own department only', async () => {
      const hodDeptId = new mongoose.Types.ObjectId();
      jest.spyOn(Department, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await courseOfferingService.getVisibleDepartmentIds({
        designation: 'hod',
        _id: new mongoose.Types.ObjectId(),
        department: { _id: hodDeptId, code: 'UNKNOWN' },
      });

      expect(result).toEqual([hodDeptId.toString()]);
    });

    test('returns empty array for user with no department', async () => {
      expect(
        await courseOfferingService.getVisibleDepartmentIds({
          designation: 'hod',
          _id: new mongoose.Types.ObjectId(),
        })
      ).toEqual([]);
    });

    test('AI Hod sees only AI', async () => {
      const aiDeptId = new mongoose.Types.ObjectId();
      jest.spyOn(Department, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: aiDeptId, code: 'AI', name: 'AI', isActive: true },
          ]),
        }),
      });

      const result = await courseOfferingService.getVisibleDepartmentIds({
        designation: 'hod',
        _id: new mongoose.Types.ObjectId(),
        department: { _id: aiDeptId, code: 'AI' },
      });

      expect(result).toEqual([aiDeptId.toString()]);
    });

    test('BSSE Hod sees BSSE, AC, BSE', async () => {
      const bsseId = new mongoose.Types.ObjectId();
      const acId = new mongoose.Types.ObjectId();
      const bseId = new mongoose.Types.ObjectId();
      jest.spyOn(Department, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: bsseId, code: 'BSSE', name: 'BSSE', isActive: true },
            { _id: acId, code: 'AC', name: 'AC', isActive: true },
            { _id: bseId, code: 'BSE', name: 'BSE', isActive: true },
          ]),
        }),
      });

      const result = await courseOfferingService.getVisibleDepartmentIds({
        designation: 'hod',
        _id: new mongoose.Types.ObjectId(),
        department: { _id: bsseId, code: 'BSSE' },
      });

      expect(result).toEqual(
        expect.arrayContaining([bsseId.toString(), acId.toString(), bseId.toString()])
      );
      expect(result).toHaveLength(3);
    });

    test('BEEE Hod sees only BEEE', async () => {
      const beeeId = new mongoose.Types.ObjectId();
      jest.spyOn(Department, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: beeeId, code: 'BEEE', name: 'BEEE', isActive: true },
          ]),
        }),
      });

      const result = await courseOfferingService.getVisibleDepartmentIds({
        designation: 'hod',
        _id: new mongoose.Types.ObjectId(),
        department: { _id: beeeId, code: 'BEEE' },
      });

      expect(result).toEqual([beeeId.toString()]);
    });
  });

  describe('canViewOffering', () => {
    const offeringDeptId = new mongoose.Types.ObjectId();
    const offering = {
      _id: new mongoose.Types.ObjectId(),
      faculty: { _id: new mongoose.Types.ObjectId() },
      department: offeringDeptId,
    };

    test('dean can view any offering', async () => {
      expect(await courseOfferingService.canViewOffering(offering, {
        designation: 'dean',
      })).toBe(true);
    });

    test('instructor can view their own offering', async () => {
      const myId = new mongoose.Types.ObjectId();
      const ownOffering = { ...offering, faculty: { _id: myId } };
      expect(await courseOfferingService.canViewOffering(ownOffering, {
        designation: 'faculty',
        _id: myId,
      })).toBe(true);
    });

    test('faculty cannot view another faculty offering', async () => {
      const ownOffering = { ...offering, faculty: { _id: new mongoose.Types.ObjectId() } };
      expect(await courseOfferingService.canViewOffering(ownOffering, {
        designation: 'faculty',
        _id: new mongoose.Types.ObjectId(),
      })).toBe(false);
    });

    test('hod can view offering in own department', async () => {
      const hodDeptId = new mongoose.Types.ObjectId();
      const hodOffering = { ...offering, department: hodDeptId };
      const hodId = new mongoose.Types.ObjectId();
      jest.spyOn(Department, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: hodDeptId, code: 'CS', name: 'CS', isActive: true },
          ]),
        }),
      });
      expect(await courseOfferingService.canViewOffering(hodOffering, {
        designation: 'hod',
        _id: hodId,
        department: { _id: hodDeptId, code: 'CS' },
      })).toBe(true);
    });

    test('hod cannot view offering outside visible matrix', async () => {
      jest.spyOn(Department, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: new mongoose.Types.ObjectId(), code: 'AI', name: 'AI', isActive: true },
          ]),
        }),
      });
      expect(await courseOfferingService.canViewOffering(offering, {
        designation: 'hod',
        _id: new mongoose.Types.ObjectId(),
        department: { _id: new mongoose.Types.ObjectId(), code: 'AI' },
      })).toBe(false);
    });
  });

  describe('getOfferingByIdForView', () => {
    const offering = {
      _id: new mongoose.Types.ObjectId(),
      section: 'A',
      course: {
        _id: new mongoose.Types.ObjectId(),
        courseCode: 'CS101',
        courseName: 'Intro to Programming',
        department: new mongoose.Types.ObjectId(),
      },
      faculty: { _id: new mongoose.Types.ObjectId() },
      department: new mongoose.Types.ObjectId(),
    };

    test('dean sees offering with isCrossDepartmentView=false and canModify=true', async () => {
      jest.spyOn(CourseOffering, 'findById').mockReturnValue(makeAwaitableQuery(offering));

      const result = await courseOfferingService.getOfferingByIdForView(
        offering._id.toString(),
        { designation: 'dean', _id: new mongoose.Types.ObjectId() }
      );

      expect(result.__meta).toEqual({
        isCrossDepartmentView: false,
        canModify: true,
      });
    });

    test('hod sees cross-department offering flagged correctly', async () => {
      const hodDeptId = new mongoose.Types.ObjectId();
      const aiDeptId = new mongoose.Types.ObjectId(); // CS HoD can view AI per matrix
      const crossOffering = {
        ...offering,
        department: aiDeptId,
        course: { ...offering.course, department: aiDeptId },
      };
      jest.spyOn(CourseOffering, 'findById').mockReturnValue(makeAwaitableQuery(crossOffering));
      jest.spyOn(Department, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: hodDeptId, code: 'CS', name: 'CS', isActive: true },
            { _id: aiDeptId, code: 'AI', name: 'AI', isActive: true },
          ]),
        }),
      });

      const result = await courseOfferingService.getOfferingByIdForView(
        crossOffering._id.toString(),
        { designation: 'hod', _id: new mongoose.Types.ObjectId(), department: { _id: hodDeptId, code: 'CS' } }
      );

      expect(result.__meta.isCrossDepartmentView).toBe(true);
      expect(result.__meta.canModify).toBe(false);
    });

    test('returns 403 for hod unauthorized to view offering', async () => {
      jest.spyOn(CourseOffering, 'findById').mockReturnValue(makeAwaitableQuery(offering));
      jest.spyOn(Department, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      await expect(
        courseOfferingService.getOfferingByIdForView(offering._id.toString(), {
          designation: 'hod',
          _id: new mongoose.Types.ObjectId(),
          department: { _id: new mongoose.Types.ObjectId(), code: 'CS' },
        })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    test('returns 404 when offering does not exist', async () => {
      jest.spyOn(CourseOffering, 'findById').mockReturnValue(makeAwaitableQuery(null));

      await expect(
        courseOfferingService.getOfferingByIdForView(new mongoose.Types.ObjectId().toString(), {
          designation: 'dean',
        })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('getVisibleDepartmentIds via dashboard controller (widening)', () => {
    test('dashboard calls listOfferingsBySemester with visibleDepartmentIds config', async () => {
      const activeSemesterId = new mongoose.Types.ObjectId();
      const deptId = new mongoose.Types.ObjectId();

      const mockOfferings = [
        {
          _id: new mongoose.Types.ObjectId(),
          section: 'A',
          course: {
            _id: new mongoose.Types.ObjectId(),
            courseCode: 'CS101',
            courseName: 'Intro to Programming',
            creditHours: 3,
            type: 'Theory',
            department: deptId,
          },
          faculty: { _id: new mongoose.Types.ObjectId(), name: 'Dr. Alice' },
          progress: { completedCount: 5, totalCount: 19, completionPercentage: 26.3, status: 'In Progress' },
          drive: { syncedFilesCount: 1, folderId: 'fld_1', folderUrl: 'https://drive.google.com/fld_1', status: 'Synced' },
        },
      ];

      // Mock the service method directly
      jest.spyOn(courseOfferingService, 'listOfferingsBySemester').mockResolvedValue(mockOfferings);
      jest.spyOn(courseOfferingService, 'getVisibleDepartmentIds').mockResolvedValue([deptId.toString()]);

      const dashboardController = require('../controllers/dashboard.controller');
      const req = {
        user: {
          _id: new mongoose.Types.ObjectId(),
          name: 'HoD CS',
          designation: 'hod',
          department: { _id: deptId, code: 'CS' },
        },
      };
      const res = mockResponse();

      // Mock Department.findById / Semester.findOne / counts used by dashboard
      jest.spyOn(Department, 'findById').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: deptId, name: 'Computer Science', code: 'CS' }),
        }),
      });
      jest.spyOn(Semester, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: activeSemesterId, name: 'Fall 2026', status: 'active' }),
        }),
      });
      jest.spyOn(User, 'countDocuments').mockResolvedValue(5);
      jest.spyOn(Course, 'countDocuments').mockResolvedValue(8);

      await dashboardController.getHodDashboardStats(req, res, jest.fn());

      expect(courseOfferingService.listOfferingsBySemester).toHaveBeenCalledWith(
        activeSemesterId.toString(),
        expect.anything(),
        true,
        expect.objectContaining({
          visibleDepartmentIds: expect.any(Array),
          stripDriveLinks: true,
          ownDepartmentId: deptId.toString(),
        })
      );
    });
  });
});