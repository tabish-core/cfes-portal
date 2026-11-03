/**
 * facultyDashboardPersonal.test.js — Backend test suite for the shared Faculty Dashboard:
 * 1. Personal offering scoping (Faculty vs HoD personal teaching data).
 * 2. 19-Item CourseChecklist progress enrichment and missing checklist handling.
 * 3. Drive sync status determination and folder URL resolution.
 * 4. Modernized dashboard statistics (Assigned Courses, Completed Checklists,
 *    Average Progress, Fully Synced Courses) + preserved legacy fields.
 * 5. Controller HTTP handler contract verification.
 */

const mongoose = require('mongoose');

// Models
const CourseOffering = require('../models/CourseOffering.model');
const CourseChecklist = require('../models/CourseChecklist.model');
const CourseFile = require('../models/CourseFile.model');
const Course = require('../models/Course.model');
const User = require('../models/User.model');
const Semester = require('../models/Semester.model');
const CIS = require('../models/CIS.model');
const CCR = require('../models/CCR.model');

// Services & Controllers
const courseOfferingService = require('../services/courseOffering.service');
const courseOfferingController = require('../controllers/courseOffering.controller');

describe('Shared Faculty Dashboard Backend Services & Scoping Suite', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const facultyAId = new mongoose.Types.ObjectId();
  const hodUserId = new mongoose.Types.ObjectId(); // HoD who also teaches
  const facultyBId = new mongoose.Types.ObjectId();
  const semesterId = new mongoose.Types.ObjectId();
  const otherSemesterId = new mongoose.Types.ObjectId();
  const deptId = new mongoose.Types.ObjectId();

  const regularFacultyUser = {
    _id: facultyAId,
    name: 'Dr. Faculty A',
    email: 'facultya@university.edu',
    designation: 'faculty',
    department: deptId,
  };

  const hodUser = {
    _id: hodUserId,
    name: 'Dr. CS HoD',
    email: 'cshod@university.edu',
    designation: 'hod',
    department: deptId,
  };

  const mockCourse = {
    _id: new mongoose.Types.ObjectId(),
    courseCode: 'CS301',
    courseName: 'Database Systems',
    type: 'Core',
    creditHours: 3,
  };

  // ── 1. Personal Teaching Isolation (Faculty & HoD) ─────────────────────────
  describe('1. Personal Teaching Scoping & Semester Isolation', () => {
    test('Regular faculty retrieves only their personal offerings for the selected semester', async () => {
      const mockQueryChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(),
            course: mockCourse,
            faculty: facultyAId,
            semester: semesterId,
            section: 'A',
          },
        ]),
      };

      jest.spyOn(CourseOffering, 'find').mockReturnValue(mockQueryChain);
      jest.spyOn(CourseChecklist, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      jest.spyOn(CourseFile, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
      });

      const offerings = await courseOfferingService.getMyOfferings(facultyAId.toString(), semesterId.toString(), true);

      expect(CourseOffering.find).toHaveBeenCalledWith({
        faculty: facultyAId.toString(),
        semester: semesterId.toString(),
      });
      expect(offerings).toHaveLength(1);
      expect(offerings[0].faculty).toEqual(facultyAId);
    });

    test('HoD retrieves only personal teaching offerings and not entire department offerings', async () => {
      const mockQueryChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(),
            course: mockCourse,
            faculty: hodUserId,
            semester: semesterId,
            section: 'B',
          },
        ]),
      };

      jest.spyOn(CourseOffering, 'find').mockReturnValue(mockQueryChain);
      jest.spyOn(CourseChecklist, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      jest.spyOn(CourseFile, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
      });

      const req = {
        query: { semester: semesterId.toString() },
        user: hodUser,
      };
      const res = mockResponse();
      const next = jest.fn();

      await courseOfferingController.getMyOfferings(req, res, next);

      expect(CourseOffering.find).toHaveBeenCalledWith({
        faculty: hodUserId,
        semester: semesterId.toString(),
      });
      const data = res.json.mock.calls[0][0].data;
      expect(data.offerings).toHaveLength(1);
      expect(data.offerings[0].faculty).toEqual(hodUserId);
    });

    test('Offerings from other semesters are strictly excluded', async () => {
      const mockQueryChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };

      jest.spyOn(CourseOffering, 'find').mockReturnValue(mockQueryChain);

      const offerings = await courseOfferingService.getMyOfferings(
        facultyAId.toString(),
        otherSemesterId.toString(),
        false
      );

      expect(CourseOffering.find).toHaveBeenCalledWith({
        faculty: facultyAId.toString(),
        semester: otherSemesterId.toString(),
      });
      expect(offerings).toHaveLength(0);
    });
  });

  // ── 2. Checklist Progress & Drive Sync Enrichment ─────────────────────────
  describe('2. 19-Item Checklist Progress & Google Drive Enrichment', () => {
    test('Offering with a valid parent folder URL exposes the correct Drive link', async () => {
      const offeringId = new mongoose.Types.ObjectId();
      const rawOffering = {
        _id: offeringId,
        course: mockCourse,
        faculty: facultyAId,
        semester: semesterId,
        section: 'A',
        googleDriveFolderId: 'parent_offering_folder_101',
        googleDriveFolderUrl: 'https://drive.google.com/drive/folders/parent_offering_folder_101',
      };

      const mockChecklistItems = [
        { type: 'CIS', name: 'Course Information Sheet', completed: true },
        { type: 'CCR', name: 'Course Control Report', completed: true },
        { type: 'TIMETABLE', name: 'Timetable', completed: true },
        { type: 'LECTURES', name: 'Lectures', completed: true },
        { type: 'ASSESS_QUIZ', name: 'Quizzes', completed: true },
        { type: 'ASSESS_ASSIGN', name: 'Assignments', completed: true },
        { type: 'ASSESS_MID', name: 'Midterm Exam', completed: true },
        { type: 'ASSESS_FINAL', name: 'Final Exam', completed: true },
        { type: 'ASSESS_PROJECT', name: 'Project/CCP', completed: true },
        { type: 'CCC', name: 'Certificate', completed: true },
        { type: 'CRR', name: 'Review Report', completed: true },
        ...Array.from({ length: 8 }, (_, i) => ({
          type: `OTHER_${i}`,
          name: `Item ${i}`,
          completed: true,
        })),
      ]; // Exactly 19 completed items

      const mockChecklist = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: offeringId,
        checklistItems: mockChecklistItems,
      };

      // CourseFile.googleDriveFolderId contains category folder IDs (e.g. 'cat_folder_course_docs')
      const mockDriveFiles = [
        { courseOffering: offeringId, documentType: 'CIS', googleDriveFolderId: 'cat_folder_course_docs' },
        { courseOffering: offeringId, documentType: 'CCR', googleDriveFolderId: 'cat_folder_course_docs' },
        { courseOffering: offeringId, documentType: 'TIMETABLE', googleDriveFolderId: 'cat_folder_course_docs' },
        { courseOffering: offeringId, documentType: 'LECTURES', googleDriveFolderId: 'cat_folder_lectures' },
        { courseOffering: offeringId, documentType: 'ASSESS_QUIZ', googleDriveFolderId: 'cat_folder_quizzes' },
        { courseOffering: offeringId, documentType: 'ASSESS_ASSIGN', googleDriveFolderId: 'cat_folder_assign' },
        { courseOffering: offeringId, documentType: 'MIDTERM_EXAM_PAPER', googleDriveFolderId: 'cat_folder_exams' },
        { courseOffering: offeringId, documentType: 'FINAL_EXAM_PAPER', googleDriveFolderId: 'cat_folder_exams' },
        { courseOffering: offeringId, documentType: 'ASSESS_PROJECT', googleDriveFolderId: 'cat_folder_course_docs' },
        { courseOffering: offeringId, documentType: 'CCC', googleDriveFolderId: 'cat_folder_course_docs' },
        { courseOffering: offeringId, documentType: 'CRR', googleDriveFolderId: 'cat_folder_course_docs' },
      ];

      const mockQueryChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([rawOffering]),
      };

      jest.spyOn(CourseOffering, 'find').mockReturnValue(mockQueryChain);
      jest.spyOn(CourseChecklist, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([mockChecklist]) });
      jest.spyOn(CourseFile, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockDriveFiles) }),
      });

      const offerings = await courseOfferingService.getMyOfferings(facultyAId.toString(), semesterId.toString(), true);

      expect(offerings).toHaveLength(1);
      const off = offerings[0];
      expect(off.progress.completedCount).toBe(19);
      expect(off.progress.totalCount).toBe(19);
      expect(off.progress.completionPercentage).toBe(100);
      expect(off.progress.status).toBe('Complete');

      // The link must point to the parent CourseOffering folder, NOT the category folder
      expect(off.drive.status).toBe('Synced');
      expect(off.drive.folderId).toBe('parent_offering_folder_101');
      expect(off.drive.folderUrl).toBe('https://drive.google.com/drive/folders/parent_offering_folder_101');
      expect(off.drive.syncedFilesCount).toBe(11);
    });

    test('Offering with only a category folder ID hides the Open Drive action and never creates link from category ID', async () => {
      const offeringId = new mongoose.Types.ObjectId();
      const rawOffering = {
        _id: offeringId,
        course: mockCourse,
        faculty: facultyAId,
        semester: semesterId,
        section: 'A',
        // NO offering-level parent folder metadata!
      };

      const mockChecklist = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: offeringId,
        checklistItems: [
          { type: 'CIS', name: 'Course Information Sheet', completed: true },
          { type: 'CCR', name: 'Course Control Report', completed: false },
        ],
      };

      // Files exist with Tier 4 category folder IDs
      const mockDriveFiles = [
        { courseOffering: offeringId, documentType: 'CIS', googleDriveFolderId: 'tier4_category_course_docs_999' },
      ];

      const mockQueryChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([rawOffering]),
      };

      jest.spyOn(CourseOffering, 'find').mockReturnValue(mockQueryChain);
      jest.spyOn(CourseChecklist, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([mockChecklist]) });
      jest.spyOn(CourseFile, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockDriveFiles) }),
      });

      const offerings = await courseOfferingService.getMyOfferings(facultyAId.toString(), semesterId.toString(), true);

      expect(offerings).toHaveLength(1);
      const off = offerings[0];
      // Checklist progress is preserved
      expect(off.progress.completedCount).toBe(1);
      // Drive status is preserved
      expect(off.drive.syncedFilesCount).toBe(1);
      expect(off.drive.status).toBe('Partially Synced');

      // Crucial requirement: NEVER construct parent folder URL from category folder ID
      expect(off.drive.folderId).toBeNull();
      expect(off.drive.folderUrl).toBeNull();
    });

    test('Offering without Drive metadata returns null folder and Not Synced', async () => {
      const offeringId = new mongoose.Types.ObjectId();
      const rawOffering = {
        _id: offeringId,
        course: mockCourse,
        faculty: facultyAId,
        semester: semesterId,
        section: 'A',
      };

      const mockQueryChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([rawOffering]),
      };

      jest.spyOn(CourseOffering, 'find').mockReturnValue(mockQueryChain);
      jest.spyOn(CourseChecklist, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      jest.spyOn(CourseFile, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
      });

      const offerings = await courseOfferingService.getMyOfferings(facultyAId.toString(), semesterId.toString(), true);

      expect(offerings).toHaveLength(1);
      const off = offerings[0];
      expect(off.progress.completedCount).toBe(0);
      expect(off.progress.totalCount).toBe(19);
      expect(off.progress.completionPercentage).toBe(0);
      expect(off.progress.status).toBe('Not Started');

      expect(off.drive.status).toBe('Not Synced');
      expect(off.drive.folderId).toBeNull();
      expect(off.drive.folderUrl).toBeNull();
      expect(off.drive.syncedFilesCount).toBe(0);
    });

    test('Verify the link never points to an incorrect category folder', async () => {
      const offeringId = new mongoose.Types.ObjectId();
      const rawOffering = {
        _id: offeringId,
        course: mockCourse,
        faculty: facultyAId,
        semester: semesterId,
        section: 'B',
      };

      const categoryFolderId = 'exam_copies_subfolder_555';
      const mockDriveFiles = [
        { courseOffering: offeringId, documentType: 'MIDTERM_BEST_COPY', googleDriveFolderId: categoryFolderId },
        { courseOffering: offeringId, documentType: 'FINAL_BEST_COPY', googleDriveFolderId: categoryFolderId },
      ];

      const mockQueryChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([rawOffering]),
      };

      jest.spyOn(CourseOffering, 'find').mockReturnValue(mockQueryChain);
      jest.spyOn(CourseChecklist, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      jest.spyOn(CourseFile, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockDriveFiles) }),
      });

      const offerings = await courseOfferingService.getMyOfferings(facultyAId.toString(), semesterId.toString(), true);
      const off = offerings[0];

      // Must never match the category folder
      if (off.drive.folderUrl) {
        expect(off.drive.folderUrl).not.toContain(categoryFolderId);
      }
      expect(off.drive.folderId).not.toBe(categoryFolderId);
      expect(off.drive.folderUrl).toBeNull();
    });

    test('resolveOfferingParentFolder directly validates offering-level sources and rejects category folders', () => {
      // Valid parent folder URL
      const res1 = courseOfferingService.resolveOfferingParentFolder({
        googleDriveFolderUrl: 'https://drive.google.com/drive/folders/parent_abc',
      });
      expect(res1.folderUrl).toBe('https://drive.google.com/drive/folders/parent_abc');
      expect(res1.folderId).toBe('parent_abc');

      // Valid parent folder ID
      const res2 = courseOfferingService.resolveOfferingParentFolder({
        googleDriveFolderId: 'parent_def',
      });
      expect(res2.folderUrl).toBe('https://drive.google.com/drive/folders/parent_def');
      expect(res2.folderId).toBe('parent_def');

      // Empty offering or missing metadata
      const res3 = courseOfferingService.resolveOfferingParentFolder({});
      expect(res3.folderUrl).toBeNull();
      expect(res3.folderId).toBeNull();

      // Offering with null / non-object
      const res4 = courseOfferingService.resolveOfferingParentFolder(null);
      expect(res4.folderUrl).toBeNull();
      expect(res4.folderId).toBeNull();
    });
  });

  // ── 3. Modernized Dashboard Stats ─────────────────────────────────────────
  describe('3. Modern Dashboard Stats & Legacy Contract Preservation', () => {
    beforeEach(() => {
      jest.spyOn(CIS, 'countDocuments').mockImplementation(({ status }) => {
        if (status === 'draft') return Promise.resolve(1);
        if (status === 'submitted') return Promise.resolve(1);
        return Promise.resolve(0);
      });
      jest.spyOn(CCR, 'countDocuments').mockImplementation(({ status }) => {
        if (status === 'draft') return Promise.resolve(0);
        if (status === 'submitted') return Promise.resolve(1);
        return Promise.resolve(0);
      });
    });

    test('Calculates modern 4 metrics and preserves legacy contract fields', async () => {
      const offCompleteId = new mongoose.Types.ObjectId();
      const offPartialId = new mongoose.Types.ObjectId();

      const offComplete = {
        _id: offCompleteId,
        course: mockCourse,
        faculty: facultyAId,
        semester: semesterId,
        section: 'A',
      };

      const offPartial = {
        _id: offPartialId,
        course: mockCourse,
        faculty: facultyAId,
        semester: semesterId,
        section: 'B',
      };

      const mockQueryChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([offComplete, offPartial]),
      };

      const mockChecklists = [
        {
          courseOffering: offCompleteId,
          checklistItems: Array.from({ length: 19 }, () => ({ completed: true })),
        },
        {
          courseOffering: offPartialId,
          checklistItems: [
            ...Array.from({ length: 10 }, () => ({ completed: true })),
            ...Array.from({ length: 9 }, () => ({ completed: false })),
          ],
        },
      ];

      const mockFiles = [
        { courseOffering: offCompleteId, documentType: 'CIS', googleDriveFolderId: 'f1' },
      ];

      jest.spyOn(CourseOffering, 'find').mockReturnValue(mockQueryChain);
      jest.spyOn(CourseChecklist, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue(mockChecklists) });
      jest.spyOn(CourseFile, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockFiles) }),
      });

      const stats = await courseOfferingService.getMyDashboardStats(facultyAId.toString(), semesterId.toString());

      // Modern metrics
      expect(stats.assignedCourses).toBe(2);
      expect(stats.completedChecklists).toBe(1);
      expect(stats.averageChecklistProgress).toBe(76.3); // (100 + 52.6) / 2 = 76.3
      expect(stats).toHaveProperty('fullySyncedCourses');
      expect(stats).toHaveProperty('driveSyncRate');

      // Preserved legacy fields
      expect(stats.totalCourses).toBe(2);
      expect(stats.totalForms).toBe(4); // 2 courses * 2
      expect(stats).toHaveProperty('draftForms');
      expect(stats).toHaveProperty('submittedForms');
      expect(stats).toHaveProperty('pendingForms');
    });

    test('Zero courses assigned safely defaults metrics to 0 without division by zero', async () => {
      const mockQueryChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };

      jest.spyOn(CourseOffering, 'find').mockReturnValue(mockQueryChain);

      const stats = await courseOfferingService.getMyDashboardStats(facultyAId.toString(), semesterId.toString());

      expect(stats.assignedCourses).toBe(0);
      expect(stats.completedChecklists).toBe(0);
      expect(stats.averageChecklistProgress).toBe(0);
      expect(stats.fullySyncedCourses).toBe(0);
      expect(stats.driveSyncRate).toBe(0);
      expect(stats.totalCourses).toBe(0);
    });
  });
});
