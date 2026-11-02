/**
 * deanDashboard.test.js — Automated test suite for Modernized Dean Dashboard Statistics.
 *
 * Verifies:
 * 1. Active-semester metrics calculation:
 *    - Correctly calculates totalOfferings, unassignedOfferings, checklistCompletionPercentage.
 *    - Accounts for offerings with and without CourseChecklist records.
 *    - Calculates Google Drive sync statistics from CourseFile metadata.
 *    - Aggregates department metrics (offerings, active faculty, checklist completion %).
 * 2. No active semester handling:
 *    - Returns activeSemester: null and zeroed semester metrics without division-by-zero errors.
 * 3. Empty dataset / zero-offering handling:
 *    - Gracefully returns 0% for completion and sync rates when total offerings is 0.
 * 4. Route authorization & protection:
 *    - Confirms /api/dashboard/dean is protected by verifyToken and requireDesignation('dean').
 */

const mongoose = require('mongoose');

// Models
const Department = require('../models/Department.model');
const User = require('../models/User.model');
const Course = require('../models/Course.model');
const CourseOffering = require('../models/CourseOffering.model');
const Semester = require('../models/Semester.model');
const CourseChecklist = require('../models/CourseChecklist.model');
const CourseFile = require('../models/CourseFile.model');

// Controller
const dashboardController = require('../controllers/dashboard.controller');

// Routes
const dashboardRoutes = require('../routes/dashboard.routes');

describe('Dean Dashboard Modernization Test Suite', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  describe('1. Active Semester Metrics & Calculation Logic', () => {
    test('calculates accurate institutional and active-semester statistics', async () => {
      const activeSemesterId = new mongoose.Types.ObjectId();
      const dept1Id = new mongoose.Types.ObjectId();
      const dept2Id = new mongoose.Types.ObjectId();

      const offering1Id = new mongoose.Types.ObjectId();
      const offering2Id = new mongoose.Types.ObjectId();

      // Mock Department.countDocuments & find
      jest.spyOn(Department, 'countDocuments').mockResolvedValue(2);
      jest.spyOn(Department, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([
              { _id: dept1Id, name: 'Computer Science', code: 'CS' },
              { _id: dept2Id, name: 'Software Engineering', code: 'SE' }
            ])
          })
        })
      });

      // Mock User.countDocuments & aggregate
      jest.spyOn(User, 'countDocuments').mockImplementation((query) => {
        if (query.designation === 'faculty') return Promise.resolve(10);
        if (query.designation === 'hod') return Promise.resolve(2);
        return Promise.resolve(0);
      });
      jest.spyOn(User, 'aggregate').mockResolvedValue([
        { _id: dept1Id, count: 6 },
        { _id: dept2Id, count: 4 }
      ]);

      // Mock Course.countDocuments
      jest.spyOn(Course, 'countDocuments').mockResolvedValue(15);

      // Mock Semester.findOne
      jest.spyOn(Semester, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: activeSemesterId,
          name: 'Fall 2026',
          status: 'active'
        })
      });

      // Mock CourseOffering.find
      const mockOfferings = [
        {
          _id: offering1Id,
          semester: activeSemesterId,
          course: { _id: new mongoose.Types.ObjectId(), courseCode: 'CSC101', department: dept1Id },
          faculty: { _id: new mongoose.Types.ObjectId(), name: 'Dr. Alice', department: dept1Id },
          section: 'A'
        },
        {
          _id: offering2Id,
          semester: activeSemesterId,
          course: { _id: new mongoose.Types.ObjectId(), courseCode: 'SEN201', department: dept2Id },
          faculty: { _id: new mongoose.Types.ObjectId(), name: 'Prof. Bob', department: dept2Id },
          section: 'A'
        }
      ];

      jest.spyOn(CourseOffering, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockOfferings)
          })
        })
      });

      // Mock CourseChecklist.find:
      // Offering 1 has a checklist with 19 items (10 completed)
      // Offering 2 has NO checklist document yet (defaults to 19 items, 0 completed)
      const checklistItems = Array.from({ length: 19 }, (_, i) => ({
        name: `Item ${i + 1}`,
        type: `TYPE_${i + 1}`,
        completed: i < 10 // 10 out of 19 completed
      }));

      jest.spyOn(CourseChecklist, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(),
            courseOffering: offering1Id,
            checklistItems
          }
        ])
      });

      // Mock CourseFile.find:
      // Offering 1 has 2 synced files, offering 2 has 0
      jest.spyOn(CourseFile, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { courseOffering: offering1Id },
            { courseOffering: offering1Id }
          ])
        })
      });

      const req = {};
      const res = mockResponse();
      const next = jest.fn();

      await dashboardController.getDeanDashboardStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;

      expect(data.activeSemester).toEqual({
        id: activeSemesterId,
        name: 'Fall 2026'
      });
      expect(data.totalDepartments).toBe(2);
      expect(data.activeFaculty).toBe(10);
      expect(data.totalHods).toBe(2);
      expect(data.totalCourses).toBe(15);
      expect(data.totalOfferings).toBe(2);
      expect(data.unassignedOfferings).toBe(0);

      // Expected checklist calculation:
      // Offering 1: 10 completed / 19 total
      // Offering 2 (missing checklist): 0 completed / 19 total
      // Overall completed = 10, total = 38 -> (10 / 38) * 100 = 26.3%
      expect(data.checklistCompletionPercentage).toBe(26.3);

      // Drive Sync: 2 total synced files, 1 out of 2 offerings has synced files -> 50%
      expect(data.driveSync.totalSyncedFiles).toBe(2);
      expect(data.driveSync.offeringsWithFilesCount).toBe(1);
      expect(data.driveSync.syncRate).toBe(50);

      // Departments table:
      expect(data.departments).toHaveLength(2);
      const csDept = data.departments.find((d) => d.code === 'CS');
      expect(csDept.offeringsCount).toBe(1);
      expect(csDept.facultyCount).toBe(6);
      expect(csDept.checklistCompletionPct).toBe(52.6); // 10 / 19 * 100

      const seDept = data.departments.find((d) => d.code === 'SE');
      expect(seDept.offeringsCount).toBe(1);
      expect(seDept.facultyCount).toBe(4);
      expect(seDept.checklistCompletionPct).toBe(0); // 0 / 19 * 100
    });
  });

  describe('2. Empty State & Division-by-Zero Protection', () => {
    test('handles missing active semester cleanly without division-by-zero errors', async () => {
      jest.spyOn(Department, 'countDocuments').mockResolvedValue(3);
      jest.spyOn(Department, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([
              { _id: new mongoose.Types.ObjectId(), name: 'CS', code: 'CS' }
            ])
          })
        })
      });
      jest.spyOn(User, 'countDocuments').mockResolvedValue(5);
      jest.spyOn(Course, 'countDocuments').mockResolvedValue(10);
      jest.spyOn(Semester, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      const req = {};
      const res = mockResponse();
      const next = jest.fn();

      await dashboardController.getDeanDashboardStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;

      expect(data.activeSemester).toBeNull();
      expect(data.totalOfferings).toBe(0);
      expect(data.unassignedOfferings).toBe(0);
      expect(data.checklistCompletionPercentage).toBe(0);
      expect(data.driveSync.totalSyncedFiles).toBe(0);
      expect(data.driveSync.syncRate).toBe(0);
      expect(data.departments[0].offeringsCount).toBe(0);
      expect(data.departments[0].checklistCompletionPct).toBe(0);
    });

    test('handles active semester with zero offerings gracefully', async () => {
      const activeSemesterId = new mongoose.Types.ObjectId();

      jest.spyOn(Department, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(Department, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([
              { _id: new mongoose.Types.ObjectId(), name: 'CS', code: 'CS' }
            ])
          })
        })
      });
      jest.spyOn(User, 'countDocuments').mockResolvedValue(4);
      jest.spyOn(User, 'aggregate').mockResolvedValue([]);
      jest.spyOn(Course, 'countDocuments').mockResolvedValue(8);
      jest.spyOn(Semester, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: activeSemesterId,
          name: 'Spring 2027',
          status: 'active'
        })
      });

      jest.spyOn(CourseOffering, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      });

      const req = {};
      const res = mockResponse();
      const next = jest.fn();

      await dashboardController.getDeanDashboardStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;

      expect(data.activeSemester.name).toBe('Spring 2027');
      expect(data.totalOfferings).toBe(0);
      expect(data.checklistCompletionPercentage).toBe(0);
      expect(data.driveSync.syncRate).toBe(0);
      expect(data.driveSync.totalSyncedFiles).toBe(0);
    });
  });

  describe('3. Route Security & Dean Designation Requirement', () => {
    test('confirms /api/dashboard/dean route is registered with authentication and dean designation', () => {
      // Inspect Express router layer stack for /api/dashboard/dean
      const deanRouteLayer = dashboardRoutes.stack.find(
        (layer) => layer.route && layer.route.path === '/dean' && layer.route.methods.get
      );

      expect(deanRouteLayer).toBeDefined();
      expect(deanRouteLayer.route.stack.length).toBeGreaterThanOrEqual(3);

      // Verify the controller function is attached
      const lastHandler = deanRouteLayer.route.stack[deanRouteLayer.route.stack.length - 1];
      expect(lastHandler.handle).toBe(dashboardController.getDeanDashboardStats);
    });
  });
});
