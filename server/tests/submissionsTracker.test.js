/**
 * submissionsTracker.test.js — Backend test suite for Submissions & Audit Tracker API.
 *
 * Verifies:
 * 1. GET /api/offerings?semester=:id&includeProgress=true:
 *    - Successfully aggregates CourseOffering, CourseChecklist, and CourseFile metadata.
 *    - Correctly calculates checklist completion (completedCount, totalCount, completionPercentage, status).
 *    - Correctly resolves Google Drive folderId, folderUrl, and drive status.
 *    - Handles missing CourseChecklist and missing CourseFile records safely.
 * 2. Multi-Tenancy & Access Scoping:
 *    - Dean receives university-wide offerings across departments.
 *    - HoD receives offerings restricted to their assigned department.
 * 3. Validation & Error Handling:
 *    - Rejects missing or invalid semester ID.
 */

const mongoose = require('mongoose');

// Models
const CourseOffering = require('../models/CourseOffering.model');
const Course = require('../models/Course.model');
const CourseChecklist = require('../models/CourseChecklist.model');
const CourseFile = require('../models/CourseFile.model');

// Service & Controller
const courseOfferingService = require('../services/courseOffering.service');
const courseOfferingController = require('../controllers/courseOffering.controller');

describe('Submissions & Audit Tracker Backend Test Suite', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  describe('1. Offering Progress & Drive Sync Enrichment', () => {
    test('enriches offerings with checklist progress and Google Drive sync status when includeProgress is true', async () => {
      const semesterId = new mongoose.Types.ObjectId();
      const offering1Id = new mongoose.Types.ObjectId();
      const offering2Id = new mongoose.Types.ObjectId();

      const mockOfferings = [
        {
          _id: offering1Id,
          semester: semesterId,
          section: 'A',
          faculty: { _id: new mongoose.Types.ObjectId(), name: 'Dr. Alice', email: 'alice@iqra.edu.pk' },
          course: {
            _id: new mongoose.Types.ObjectId(),
            courseCode: 'CSC101',
            courseName: 'Intro to Programming',
            department: { _id: new mongoose.Types.ObjectId(), name: 'Computer Science', code: 'CS' }
          }
        },
        {
          _id: offering2Id,
          semester: semesterId,
          section: 'B',
          faculty: { _id: new mongoose.Types.ObjectId(), name: 'Prof. Bob', email: 'bob@iqra.edu.pk' },
          course: {
            _id: new mongoose.Types.ObjectId(),
            courseCode: 'SEN201',
            courseName: 'Software Engineering',
            department: { _id: new mongoose.Types.ObjectId(), name: 'Software Engineering', code: 'SE' }
          }
        }
      ];

      // Mock CourseOffering.find chain
      jest.spyOn(CourseOffering, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockOfferings)
              })
            })
          })
        })
      });

      // Offering 1 has a checklist with 19 items (14 completed)
      const checklistItems = Array.from({ length: 19 }, (_, i) => ({
        name: `Item ${i + 1}`,
        type: `TYPE_${i + 1}`,
        completed: i < 14
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

      // Offering 1 has 14 synced files in Google Drive folder "folder_xyz_123"
      // Offering 2 has NO synced files in Google Drive
      jest.spyOn(CourseFile, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              courseOffering: offering1Id,
              documentType: 'CIS',
              googleDriveFolderId: 'folder_xyz_123'
            }
          ])
        })
      });

      const result = await courseOfferingService.listOfferingsBySemester(
        semesterId.toString(),
        {}, // Dean: no department filter
        true // includeProgress
      );

      expect(result).toHaveLength(2);

      // Verify Offering 1
      const off1 = result.find((o) => o._id === offering1Id);
      expect(off1).toBeDefined();
      expect(off1.progress).toEqual({
        completedCount: 14,
        totalCount: 19,
        completionPercentage: 73.7,
        status: 'In Progress'
      });
      expect(off1.drive).toEqual({
        syncedFilesCount: 1,
        folderId: 'folder_xyz_123',
        folderUrl: 'https://drive.google.com/drive/folders/folder_xyz_123',
        status: 'Partially Synced'
      });

      // Verify Offering 2 (missing checklist document and missing Drive files)
      const off2 = result.find((o) => o._id === offering2Id);
      expect(off2).toBeDefined();
      expect(off2.progress).toEqual({
        completedCount: 0,
        totalCount: 19, // Defaults to standard institutional 19 items
        completionPercentage: 0,
        status: 'Not Started'
      });
      expect(off2.drive).toEqual({
        syncedFilesCount: 0,
        folderId: null,
        folderUrl: null,
        status: 'Not Synced'
      });
    });
  });

  describe('2. Controller & Tenant Scoping Integration', () => {
    test('Dean accesses university-wide offerings with includeProgress=true', async () => {
      const semesterId = new mongoose.Types.ObjectId();
      const mockResult = [{ _id: new mongoose.Types.ObjectId(), progress: { completedCount: 5 } }];

      jest.spyOn(courseOfferingService, 'listOfferingsBySemester').mockResolvedValue(mockResult);

      const req = {
        query: { semester: semesterId.toString(), includeProgress: 'true' },
        user: { designation: 'dean' },
        departmentFilter: {} // Dean: university-wide
      };
      const res = mockResponse();
      const next = jest.fn();

      await courseOfferingController.listBySemester(req, res, next);

      expect(courseOfferingService.listOfferingsBySemester).toHaveBeenCalledWith(
        semesterId.toString(),
        {},
        true
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { offerings: mockResult }
        })
      );
    });

    test('HoD is strictly scoped to their assigned department', async () => {
      const semesterId = new mongoose.Types.ObjectId();
      const deptId = new mongoose.Types.ObjectId();
      const mockResult = [{ _id: new mongoose.Types.ObjectId(), progress: { completedCount: 8 } }];

      jest.spyOn(courseOfferingService, 'listOfferingsBySemester').mockResolvedValue(mockResult);

      const req = {
        query: { semester: semesterId.toString(), includeProgress: 'true' },
        user: { designation: 'hod', department: deptId },
        departmentFilter: { department: deptId } // HoD: scoped
      };
      const res = mockResponse();
      const next = jest.fn();

      await courseOfferingController.listBySemester(req, res, next);

      expect(courseOfferingService.listOfferingsBySemester).toHaveBeenCalledWith(
        semesterId.toString(),
        { department: deptId },
        true
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('returns 400 if semester query parameter is missing', async () => {
      const req = { query: {} };
      const res = mockResponse();
      const next = jest.fn();

      await courseOfferingController.listBySemester(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'semester query parameter is required'
        })
      );
    });
  });
});
