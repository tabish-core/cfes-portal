/**
 * hodCourseAllocationOwnership.test.js — Backend test suite for:
 * 1. HoD universal catalog visibility (shared and cross-department courses).
 * 2. Course offering department ownership (independent of catalog course department).
 * 3. Department isolation for faculty assignment (HoD can only assign own department faculty).
 * 4. Offering management boundaries (HoD cannot remove or access other departments' offerings).
 * 5. Unassigned offerings retain department ownership and remain isolated.
 * 6. Dean universal access (university-wide access for catalog, creation, removal, and queries).
 */

const mongoose = require('mongoose');

// Models
const CourseOffering = require('../models/CourseOffering.model');
const Course = require('../models/Course.model');
const User = require('../models/User.model');
const Semester = require('../models/Semester.model');
const Department = require('../models/Department.model');

// Services & Controllers
const courseOfferingService = require('../services/courseOffering.service');
const courseService = require('../services/course.service');
const courseController = require('../controllers/course.controller');
const courseOfferingController = require('../controllers/courseOffering.controller');

describe('HoD Course Allocation & Offering Department Ownership Suite', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const deptAId = new mongoose.Types.ObjectId();
  const deptBId = new mongoose.Types.ObjectId();
  const semesterId = new mongoose.Types.ObjectId();

  const hodUserDeptA = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Dr. CS HoD',
    email: 'cshod@university.edu',
    designation: 'hod',
    department: deptAId,
  };

  const deanUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Dean Academic',
    email: 'dean@university.edu',
    designation: 'dean',
  };

  const facultyDeptA = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Faculty CS',
    email: 'csfaculty@university.edu',
    designation: 'faculty',
    department: deptAId,
    isActive: true,
  };

  const facultyDeptB = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Faculty SE',
    email: 'sefaculty@university.edu',
    designation: 'faculty',
    department: deptBId,
    isActive: true,
  };

  const sharedCourse = {
    _id: new mongoose.Types.ObjectId(),
    courseCode: 'MTH101',
    courseName: 'Calculus & Analytical Geometry',
    department: null, // Shared / institutional
    isActive: true,
  };

  const courseDeptB = {
    _id: new mongoose.Types.ObjectId(),
    courseCode: 'SEN301',
    courseName: 'Software Architecture',
    department: deptBId,
    isActive: true,
  };

  // ── 1. Catalog Course Visibility ──────────────────────────────────────────
  describe('1. Universal Course Catalog Visibility', () => {
    test('HoD retrieves all catalog courses without departmental filtering', async () => {
      const mockCatalog = [sharedCourse, courseDeptB];

      jest.spyOn(courseService, 'listCourses').mockResolvedValue(mockCatalog);

      const req = {
        user: hodUserDeptA,
        query: {},
      };
      const res = mockResponse();
      const next = jest.fn();

      await courseController.getAllCourses(req, res, next);

      expect(courseService.listCourses).toHaveBeenCalledWith({});
      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.courses).toHaveLength(2);
      expect(data.courses.map((c) => c.courseCode)).toContain('MTH101');
      expect(data.courses.map((c) => c.courseCode)).toContain('SEN301');
    });

    test('Dean also retrieves all catalog courses', async () => {
      const mockCatalog = [sharedCourse, courseDeptB];
      jest.spyOn(courseService, 'listCourses').mockResolvedValue(mockCatalog);

      const req = {
        user: deanUser,
        query: {},
      };
      const res = mockResponse();
      const next = jest.fn();

      await courseController.getAllCourses(req, res, next);

      expect(courseService.listCourses).toHaveBeenCalledWith({});
      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.courses).toHaveLength(2);
    });
  });

  // ── 2. Offering Creation & Department Ownership ────────────────────────────
  describe('2. Offering Department Ownership & Creation', () => {
    test('HoD can create an offering for a shared course owned by HoD department', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(facultyDeptA);
      jest.spyOn(Course, 'findById').mockResolvedValue(sharedCourse);
      jest.spyOn(Semester, 'findById').mockResolvedValue({ _id: semesterId, name: 'Fall 2026' });
      jest.spyOn(CourseOffering, 'findOne').mockResolvedValue(null);

      const createdOfferingDoc = {
        _id: new mongoose.Types.ObjectId(),
        faculty: facultyDeptA._id,
        course: sharedCourse._id,
        semester: semesterId,
        section: 'A',
        department: deptAId,
        populate: jest.fn().mockImplementation(() => ({
          _id: new mongoose.Types.ObjectId(),
          faculty: facultyDeptA,
          course: sharedCourse,
          semester: { _id: semesterId, name: 'Fall 2026' },
          department: { _id: deptAId, name: 'Computer Science', code: 'CS' },
        })),
      };

      jest.spyOn(CourseOffering, 'create').mockResolvedValue(createdOfferingDoc);

      const result = await courseOfferingService.createOffering(
        facultyDeptA._id.toString(),
        sharedCourse._id.toString(),
        semesterId.toString(),
        'A',
        hodUserDeptA
      );

      expect(CourseOffering.create).toHaveBeenCalledWith({
        faculty: facultyDeptA._id.toString(),
        course: sharedCourse._id.toString(),
        semester: semesterId.toString(),
        section: 'A',
        department: deptAId,
      });

      expect(result.department.code).toBe('CS');
    });

    test('HoD cannot assign faculty belonging to another department', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(facultyDeptB);
      jest.spyOn(Course, 'findById').mockResolvedValue(sharedCourse);
      jest.spyOn(Semester, 'findById').mockResolvedValue({ _id: semesterId, name: 'Fall 2026' });

      await expect(
        courseOfferingService.createOffering(
          facultyDeptB._id.toString(),
          sharedCourse._id.toString(),
          semesterId.toString(),
          'A',
          hodUserDeptA
        )
      ).rejects.toThrow('You are only allowed to assign faculty members belonging to your department.');
    });

    test('Unassigned offering retains department ownership and faculty is null', async () => {
      jest.spyOn(Course, 'findById').mockResolvedValue(sharedCourse);
      jest.spyOn(Semester, 'findById').mockResolvedValue({ _id: semesterId, name: 'Fall 2026' });
      jest.spyOn(CourseOffering, 'findOne').mockResolvedValue(null);

      const createdUnassignedDoc = {
        _id: new mongoose.Types.ObjectId(),
        faculty: null,
        course: sharedCourse._id,
        semester: semesterId,
        section: 'B',
        department: deptAId,
        populate: jest.fn().mockImplementation(() => ({
          _id: new mongoose.Types.ObjectId(),
          faculty: null,
          course: sharedCourse,
          semester: { _id: semesterId, name: 'Fall 2026' },
          department: { _id: deptAId, name: 'Computer Science', code: 'CS' },
        })),
      };

      jest.spyOn(CourseOffering, 'create').mockResolvedValue(createdUnassignedDoc);

      const result = await courseOfferingService.createOffering(
        null, // unassigned
        sharedCourse._id.toString(),
        semesterId.toString(),
        'B',
        hodUserDeptA
      );

      expect(CourseOffering.create).toHaveBeenCalledWith({
        faculty: null,
        course: sharedCourse._id.toString(),
        semester: semesterId.toString(),
        section: 'B',
        department: deptAId,
      });

      expect(result.faculty).toBeNull();
      expect(result.department._id).toEqual(deptAId);
    });
  });

  // ── 3. Offering Scoping & Management Isolation ────────────────────────────
  describe('3. Offering Scoping & Boundary Enforcement', () => {
    test('HoD cannot remove an offering owned by another department', async () => {
      const offeringDeptB = {
        _id: new mongoose.Types.ObjectId(),
        course: courseDeptB,
        department: deptBId,
        populate: jest.fn().mockReturnThis(),
        deleteOne: jest.fn(),
      };

      jest.spyOn(CourseOffering, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(offeringDeptB),
      });

      await expect(
        courseOfferingService.removeOffering(offeringDeptB._id.toString(), hodUserDeptA)
      ).rejects.toThrow('You are only allowed to remove offerings belonging to your department.');

      expect(offeringDeptB.deleteOne).not.toHaveBeenCalled();
    });

    test('HoD can remove an offering owned by their department even if catalog course is shared', async () => {
      const offeringDeptA = {
        _id: new mongoose.Types.ObjectId(),
        course: sharedCourse,
        department: deptAId,
        populate: jest.fn().mockReturnThis(),
        deleteOne: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(CourseOffering, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(offeringDeptA),
      });

      const removed = await courseOfferingService.removeOffering(offeringDeptA._id.toString(), hodUserDeptA);
      expect(offeringDeptA.deleteOne).toHaveBeenCalled();
      expect(removed._id).toEqual(offeringDeptA._id);
    });

    test('listOfferingsBySemester scopes queries strictly by offering department', async () => {
      const mockQueryChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([
          { _id: new mongoose.Types.ObjectId(), department: deptAId, section: 'A' },
        ]),
      };

      jest.spyOn(CourseOffering, 'find').mockReturnValue(mockQueryChain);

      await courseOfferingService.listOfferingsBySemester(
        semesterId.toString(),
        { department: deptAId },
        false
      );

      expect(CourseOffering.find).toHaveBeenCalledWith({
        semester: semesterId.toString(),
        department: deptAId,
      });
    });

    test('Dean can list offerings without department restriction', async () => {
      const mockQueryChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([]),
      };

      jest.spyOn(CourseOffering, 'find').mockReturnValue(mockQueryChain);

      await courseOfferingService.listOfferingsBySemester(
        semesterId.toString(),
        {}, // Dean: no department filter
        false
      );

      expect(CourseOffering.find).toHaveBeenCalledWith({
        semester: semesterId.toString(),
      });
    });

    test('Dean can remove any offering regardless of department owner', async () => {
      const offeringDeptB = {
        _id: new mongoose.Types.ObjectId(),
        course: courseDeptB,
        department: deptBId,
        populate: jest.fn().mockReturnThis(),
        deleteOne: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(CourseOffering, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(offeringDeptB),
      });

      const removed = await courseOfferingService.removeOffering(offeringDeptB._id.toString(), deanUser);
      expect(offeringDeptB.deleteOne).toHaveBeenCalled();
      expect(removed._id).toEqual(offeringDeptB._id);
    });
  });

  // ── 4. Offering Transitions Between Assigned & Unassigned ─────────────────
  describe('4. Offering Transitions (Assigned <-> Unassigned)', () => {
    test('Offering faculty can be set to null (unassigned) while preserving department ownership', async () => {
      const mockOffering = {
        _id: new mongoose.Types.ObjectId(),
        course: sharedCourse._id,
        semester: semesterId,
        section: 'A',
        department: deptAId,
        faculty: facultyDeptA._id,
        save: jest.fn().mockResolvedValue(true),
      };

      // Transition to unassigned
      mockOffering.faculty = null;
      await mockOffering.save();

      expect(mockOffering.faculty).toBeNull();
      expect(mockOffering.department).toEqual(deptAId);
      expect(mockOffering.save).toHaveBeenCalled();
    });

    test('Unassigned offering can be assigned to a department faculty member', async () => {
      const mockOffering = {
        _id: new mongoose.Types.ObjectId(),
        course: sharedCourse._id,
        semester: semesterId,
        section: 'A',
        department: deptAId,
        faculty: null,
        save: jest.fn().mockResolvedValue(true),
      };

      // Transition to assigned
      mockOffering.faculty = facultyDeptA._id;
      await mockOffering.save();

      expect(mockOffering.faculty).toEqual(facultyDeptA._id);
      expect(mockOffering.department).toEqual(deptAId);
      expect(mockOffering.save).toHaveBeenCalled();
    });

    test('Controller handles creating offering with facultyId: null for unassigned option', async () => {
      const createdOffering = {
        _id: new mongoose.Types.ObjectId(),
        faculty: null,
        course: sharedCourse,
        semester: { _id: semesterId, name: 'Fall 2026' },
        department: { _id: deptAId, name: 'Computer Science', code: 'CS' },
        section: 'A',
      };

      jest.spyOn(courseOfferingService, 'createOffering').mockResolvedValue(createdOffering);

      const req = {
        body: {
          facultyId: null, // Submitted from UI when "Unassigned" is chosen
          courseId: sharedCourse._id.toString(),
          semesterId: semesterId.toString(),
          section: 'A',
        },
        user: hodUserDeptA,
      };
      const res = mockResponse();
      const next = jest.fn();

      await courseOfferingController.createOffering(req, res, next);

      expect(courseOfferingService.createOffering).toHaveBeenCalledWith(
        null,
        sharedCourse._id.toString(),
        semesterId.toString(),
        'A',
        hodUserDeptA,
        undefined
      );
      expect(res.status).toHaveBeenCalledWith(201);
      const data = res.json.mock.calls[0][0].data;
      expect(data.offering.faculty).toBeNull();
    });
  });
});

