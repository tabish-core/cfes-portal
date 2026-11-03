/**
 * hodDashboard.test.js — Backend test suite for Modernized HoD Dashboard Statistics API.
 *
 * Verifies:
 * 1. Active-semester metrics calculation & department isolation:
 *    - Scopes offerings strictly to active semester and HoD's assigned department.
 *    - Resolves department faculty, catalog courses, assigned instructors, and unassigned offerings.
 * 2. Checklist aggregation & Drive sync calculations:
 *    - Aggregates completed vs total items across offerings.
 *    - Calculates driveSyncRate and includes offering progress/drive summaries.
 * 3. Safe handling of missing active semester & missing department:
 *    - Returns activeSemester: null safely with baseline metrics.
 *    - Rejects request with 403 if HoD user has no assigned department.
 */

const mongoose = require('mongoose');

// Models
const Department = require('../models/Department.model');
const User = require('../models/User.model');
const Course = require('../models/Course.model');
const Semester = require('../models/Semester.model');

// Controller & Service
const dashboardController = require('../controllers/dashboard.controller');
const courseOfferingService = require('../services/courseOffering.service');

describe('HoD Dashboard Backend Test Suite', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const dept1Id = new mongoose.Types.ObjectId();
  const dept2Id = new mongoose.Types.ObjectId();
  const activeSemesterId = new mongoose.Types.ObjectId();

  describe('1. Active Semester Filtering & Department Isolation', () => {
    test('scopes metrics strictly to the active semester and the HoD department', async () => {
      const instructor1Id = new mongoose.Types.ObjectId();
      const instructor2Id = new mongoose.Types.ObjectId();

      // Mock Department
      jest.spyOn(Department, 'findById').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: dept1Id,
            name: 'Computer Science',
            code: 'CS',
          }),
        }),
      });

      // Mock Semester
      jest.spyOn(Semester, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: activeSemesterId,
            name: 'Fall 2026',
            status: 'active',
          }),
        }),
      });

      // Mock User count (faculty in department)
      jest.spyOn(User, 'countDocuments').mockImplementation((query) => {
        if (query.department.toString() === dept1Id.toString()) return Promise.resolve(5);
        return Promise.resolve(0);
      });

      // Mock Course count (courses in department)
      jest.spyOn(Course, 'countDocuments').mockImplementation((query) => {
        if (query.department.toString() === dept1Id.toString()) return Promise.resolve(8);
        return Promise.resolve(0);
      });

      // Mock courseOfferingService.listOfferingsBySemester
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
          },
          faculty: {
            _id: instructor1Id,
            name: 'Dr. Alice',
            email: 'alice@iqra.edu.pk',
          },
          progress: {
            completedCount: 19,
            totalCount: 19,
            completionPercentage: 100,
            status: 'Complete',
          },
          drive: {
            syncedFilesCount: 5,
            folderId: 'fld_1',
            folderUrl: 'https://drive.google.com/drive/folders/fld_1',
            status: 'Synced',
          },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          section: 'B',
          course: {
            _id: new mongoose.Types.ObjectId(),
            courseCode: 'CS102',
            courseName: 'Data Structures',
            creditHours: 4,
            type: 'Theory',
          },
          faculty: {
            _id: instructor2Id,
            name: 'Prof. Bob',
            email: 'bob@iqra.edu.pk',
          },
          progress: {
            completedCount: 10,
            totalCount: 19,
            completionPercentage: 52.6,
            status: 'In Progress',
          },
          drive: {
            syncedFilesCount: 2,
            folderId: 'fld_2',
            folderUrl: 'https://drive.google.com/drive/folders/fld_2',
            status: 'Partially Synced',
          },
        },
      ];

      jest.spyOn(courseOfferingService, 'listOfferingsBySemester').mockResolvedValue(mockOfferings);

      const req = {
        user: {
          _id: new mongoose.Types.ObjectId(),
          name: 'HoD CS',
          designation: 'hod',
          department: dept1Id,
        },
      };
      const res = mockResponse();
      const next = jest.fn();

      await dashboardController.getHodDashboardStats(req, res, next);

      // Verify listOfferingsBySemester was called with active semester and HoD department filter
      expect(courseOfferingService.listOfferingsBySemester).toHaveBeenCalledWith(
        activeSemesterId.toString(),
        { department: dept1Id },
        true
      );

      expect(res.status).toHaveBeenCalledWith(200);
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.success).toBe(true);

      const data = jsonCall.data;
      expect(data.activeSemester).toEqual({
        id: activeSemesterId,
        name: 'Fall 2026',
        status: 'active',
      });
      expect(data.department).toEqual({
        id: dept1Id,
        name: 'Computer Science',
        code: 'CS',
      });
      expect(data.departmentFacultyCount).toBe(5);
      expect(data.departmentCoursesCount).toBe(8);
      expect(data.activeOfferingsCount).toBe(2);
      expect(data.unassignedOfferingsCount).toBe(0);
      expect(data.assignedInstructorsCount).toBe(2);

      // Checklist aggregation: (19 + 10) / (19 + 19) = 29 / 38 = 76.3%
      expect(data.checklistCompletionPercentage).toBe(76.3);

      // Drive sync: 2 out of 2 offerings have synced files (syncRate = 100%)
      expect(data.driveSyncRate).toBe(100);
      expect(data.driveSync.totalSyncedFiles).toBe(7);

      // Offering summaries
      expect(data.offerings).toHaveLength(2);
      expect(data.offerings[0].course.courseCode).toBe('CS101');
      expect(data.offerings[0].instructor.name).toBe('Dr. Alice');
      expect(data.offerings[0].checklistProgress.status).toBe('Complete');
      expect(data.offerings[0].driveStatus.status).toBe('Synced');
    });

    test('correctly handles unassigned offerings and computes unique assigned instructors', async () => {
      const instructor1Id = new mongoose.Types.ObjectId();

      jest.spyOn(Department, 'findById').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: dept1Id, name: 'Computer Science', code: 'CS' }),
        }),
      });

      jest.spyOn(Semester, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: activeSemesterId, name: 'Fall 2026', status: 'active' }),
        }),
      });

      jest.spyOn(User, 'countDocuments').mockResolvedValue(4);
      jest.spyOn(Course, 'countDocuments').mockResolvedValue(6);

      // 1 offering assigned to instructor1, 1 offering unassigned (null faculty)
      const mockOfferings = [
        {
          _id: new mongoose.Types.ObjectId(),
          section: 'A',
          course: { _id: new mongoose.Types.ObjectId(), courseCode: 'CS101', courseName: 'Intro' },
          faculty: { _id: instructor1Id, name: 'Dr. Alice', email: 'alice@iqra.edu.pk' },
          progress: { completedCount: 5, totalCount: 19, completionPercentage: 26.3, status: 'In Progress' },
          drive: { syncedFilesCount: 1, folderId: 'fld_1', folderUrl: 'https://drive.google.com/fld_1', status: 'Partially Synced' },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          section: 'B',
          course: { _id: new mongoose.Types.ObjectId(), courseCode: 'CS101', courseName: 'Intro' },
          faculty: null, // unassigned
          progress: { completedCount: 0, totalCount: 19, completionPercentage: 0, status: 'Not Started' },
          drive: { syncedFilesCount: 0, folderId: null, folderUrl: null, status: 'Not Synced' },
        },
      ];

      jest.spyOn(courseOfferingService, 'listOfferingsBySemester').mockResolvedValue(mockOfferings);

      const req = {
        user: { _id: new mongoose.Types.ObjectId(), designation: 'hod', department: dept1Id },
      };
      const res = mockResponse();

      await dashboardController.getHodDashboardStats(req, res, jest.fn());

      const data = res.json.mock.calls[0][0].data;
      expect(data.activeOfferingsCount).toBe(2);
      expect(data.unassignedOfferingsCount).toBe(1);
      expect(data.assignedInstructorsCount).toBe(1); // Only 1 unique assigned instructor

      // Drive sync rate: 1 with files / 2 total = 50%
      expect(data.driveSyncRate).toBe(50);
      expect(data.driveSync.offeringsWithFilesCount).toBe(1);

      // Offerings summary contains unassigned offering with null instructor
      expect(data.offerings[1].instructor).toBeNull();
      expect(data.offerings[1].checklistProgress.status).toBe('Not Started');
      expect(data.offerings[1].driveStatus.status).toBe('Not Synced');
    });
  });

  describe('2. Safe Handling of Missing Semester & Department Boundaries', () => {
    test('safely handles absence of an active semester without errors', async () => {
      jest.spyOn(Department, 'findById').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: dept1Id, name: 'Computer Science', code: 'CS' }),
        }),
      });

      // No active semester found
      jest.spyOn(Semester, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      jest.spyOn(User, 'countDocuments').mockResolvedValue(5);
      jest.spyOn(Course, 'countDocuments').mockResolvedValue(8);

      const req = {
        user: { _id: new mongoose.Types.ObjectId(), designation: 'hod', department: dept1Id },
      };
      const res = mockResponse();

      await dashboardController.getHodDashboardStats(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.activeSemester).toBeNull();
      expect(data.department.name).toBe('Computer Science');
      expect(data.departmentFacultyCount).toBe(5);
      expect(data.departmentCoursesCount).toBe(8);
      expect(data.activeOfferingsCount).toBe(0);
      expect(data.unassignedOfferingsCount).toBe(0);
      expect(data.assignedInstructorsCount).toBe(0);
      expect(data.checklistCompletionPercentage).toBe(0);
      expect(data.driveSyncRate).toBe(0);
      expect(data.offerings).toEqual([]);
    });

    test('returns 403 Forbidden if HoD user is not assigned to a department', async () => {
      const req = {
        user: { _id: new mongoose.Types.ObjectId(), designation: 'hod', department: null },
      };
      const res = mockResponse();

      await dashboardController.getHodDashboardStats(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'You are not assigned to a department.',
        })
      );
    });

    test('returns 404 if assigned department does not exist in database', async () => {
      jest.spyOn(Department, 'findById').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      jest.spyOn(Semester, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: activeSemesterId, name: 'Fall 2026', status: 'active' }),
        }),
      });

      jest.spyOn(User, 'countDocuments').mockResolvedValue(0);
      jest.spyOn(Course, 'countDocuments').mockResolvedValue(0);

      const req = {
        user: { _id: new mongoose.Types.ObjectId(), designation: 'hod', department: dept1Id },
      };
      const res = mockResponse();

      await dashboardController.getHodDashboardStats(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Assigned department not found.',
        })
      );
    });
  });
});
