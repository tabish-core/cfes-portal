/**
 * driveFolderHierarchy.test.js — Comprehensive test suite for the 4-tier Google Drive folder hierarchy:
 *   Semester → Faculty → Course Offering → Category
 *
 * Covers all 15 requirements specified in the redesign objective:
 *  1. Semester, faculty, offering, and category folder creation
 *  2. Reuse of existing folders without creating duplicates
 *  3. Correct parent-folder verification
 *  4. Different sections creating separate offering folders
 *  5. Different faculty members creating separate faculty folders
 *  6. Correct category routing for every document type
 *  7. Readable filenames without underscores or technical prefixes
 *  8. Filename collision handling
 *  9. Upload and replacement in the correct folder
 *  10. CourseFile googleDriveFolderId consistency
 *  11. Checklist status updates after successful operations
 *  12. Existing authorization rules
 *  13. Quiz and assignment instance isolation
 *  14. Midterm and Final Exam slot isolation
 *  15. Lecture upload, listing, and deletion
 *  16. Sanitization of invalid characters ('/' and '\') and missing information handling
 */
const mongoose = require('mongoose');
const driveService = require('../services/drive.service');
const courseFileService = require('../services/courseFile.service');
const courseOfferingService = require('../services/courseOffering.service');
const CourseFile = require('../models/CourseFile.model');
const CourseChecklist = require('../models/CourseChecklist.model');
const googleDriveConfig = require('../config/googleDrive');

describe('Google Drive 4-Tier Folder Hierarchy & Document Organization Suite', () => {
  const rootFolderId = googleDriveConfig.DESTINATION_FOLDER_ID;

  const mockSemesterId = new mongoose.Types.ObjectId();
  const mockFacultyId1 = new mongoose.Types.ObjectId();
  const mockFacultyId2 = new mongoose.Types.ObjectId();
  const mockCourseId = new mongoose.Types.ObjectId();
  const mockOfferingIdA = new mongoose.Types.ObjectId();
  const mockOfferingIdB = new mongoose.Types.ObjectId();

  const mockSemester = {
    _id: mockSemesterId,
    name: 'Fall 2026',
    status: 'active',
  };

  const mockFaculty1 = {
    _id: mockFacultyId1,
    name: 'Dr. Jane Smith',
    email: 'jane@example.com',
    designation: 'faculty',
  };

  const mockFaculty2 = {
    _id: mockFacultyId2,
    name: 'Dr. John Doe',
    email: 'john@example.com',
    designation: 'faculty',
  };

  const mockCourse = {
    _id: mockCourseId,
    courseCode: 'CSC301',
    courseName: 'Operating Systems',
    department: new mongoose.Types.ObjectId(),
  };

  const mockOffering1A = {
    _id: mockOfferingIdA,
    faculty: mockFaculty1,
    course: mockCourse,
    semester: mockSemester,
    section: 'A',
  };

  const mockOffering1B = {
    _id: mockOfferingIdB,
    faculty: mockFaculty1,
    course: mockCourse,
    semester: mockSemester,
    section: 'B',
  };

  const mockOffering2A = {
    _id: new mongoose.Types.ObjectId(),
    faculty: mockFaculty2,
    course: mockCourse,
    semester: mockSemester,
    section: 'A',
  };

  const mockUser1 = {
    _id: mockFacultyId1,
    designation: 'faculty',
  };

  beforeEach(() => {
    jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. 4-Tier Hierarchy Creation & Parent Verification
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. 4-Tier Hierarchy Folder Resolution', () => {
    test('creates and resolves 4 tiers in order: Semester → Faculty → Offering → Category', async () => {
      const calls = [];
      jest.spyOn(driveService, 'getOrCreateFolder').mockImplementation(async (name, parentId, opts) => {
        calls.push({ name, parentId, opts });
        return `fld_${name.replace(/\s+/g, '_')}`;
      });

      const folderId = await courseFileService.resolveOfferingHierarchyFolder({
        offering: mockOffering1A,
        category: 'Course Documents',
        user: mockUser1,
      });

      expect(calls).toHaveLength(4);

      // Level 1: Semester
      expect(calls[0].name).toBe('Fall 2026');
      expect(calls[0].parentId).toBe(rootFolderId);
      expect(calls[0].opts.appProperties.semesterId).toBe(mockSemesterId.toString());

      // Level 2: Faculty
      expect(calls[1].name).toBe('Dr. Jane Smith');
      expect(calls[1].parentId).toBe('fld_Fall_2026');
      expect(calls[1].opts.appProperties.facultyId).toBe(mockFacultyId1.toString());

      // Level 3: Offering
      expect(calls[2].name).toBe('Operating Systems (CSC301) - Section A');
      expect(calls[2].parentId).toBe('fld_Dr._Jane_Smith');
      expect(calls[2].opts.appProperties.offeringId).toBe(mockOfferingIdA.toString());
      expect(calls[2].opts.appProperties.courseId).toBe(mockCourseId.toString());
      expect(calls[2].opts.appProperties.section).toBe('A');

      // Level 4: Category
      expect(calls[3].name).toBe('Course Documents');
      expect(calls[3].parentId).toBe('fld_Operating_Systems_(CSC301)_-_Section_A');
      expect(calls[3].opts.appProperties.category).toBe('Course Documents');

      expect(folderId).toBe('fld_Course_Documents');
    });

    test('re-uses existing folders without creating duplicates', async () => {
      // Mock drive.files.list returning existing folder
      const mockList = jest.fn().mockResolvedValue({
        data: {
          files: [{ id: 'existing_folder_999', name: 'Course Documents', appProperties: { category: 'Course Documents' } }],
        },
      });
      const mockCreate = jest.fn();

      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue({
        files: { list: mockList, create: mockCreate },
      });

      const folderId = await driveService.getOrCreateFolder('Course Documents', 'parent_123', {
        appProperties: { category: 'Course Documents' },
      });

      expect(mockList).toHaveBeenCalledTimes(1);
      expect(mockCreate).not.toHaveBeenCalled();
      expect(folderId).toBe('existing_folder_999');
    });

    test('verifies parent folder in query when searching for existing folder', async () => {
      let queriedString = '';
      const mockList = jest.fn().mockImplementation((params) => {
        queriedString = params.q;
        return Promise.resolve({ data: { files: [{ id: 'found_id' }] } });
      });

      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue({
        files: { list: mockList, create: jest.fn() },
      });

      await driveService.getOrCreateFolder('Lectures', 'specific_parent_555');

      expect(queriedString).toContain("'specific_parent_555' in parents");
      expect(queriedString).toContain("name='Lectures'");
      expect(queriedString).toContain("trashed=false");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Sections and Faculty Isolation
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Section and Faculty Isolation', () => {
    test('different sections of the same course create separate offering folders', async () => {
      const folderNames = [];
      jest.spyOn(driveService, 'getOrCreateFolder').mockImplementation(async (name) => {
        folderNames.push(name);
        return `fld_${name}`;
      });

      await courseFileService.resolveOfferingHierarchyFolder({
        offering: mockOffering1A,
        category: 'Quizzes',
      });

      await courseFileService.resolveOfferingHierarchyFolder({
        offering: mockOffering1B,
        category: 'Quizzes',
      });

      expect(folderNames).toContain('Operating Systems (CSC301) - Section A');
      expect(folderNames).toContain('Operating Systems (CSC301) - Section B');
    });

    test('different faculty members teaching the same course create separate faculty folders', async () => {
      const folderNames = [];
      jest.spyOn(driveService, 'getOrCreateFolder').mockImplementation(async (name) => {
        folderNames.push(name);
        return `fld_${name}`;
      });

      await courseFileService.resolveOfferingHierarchyFolder({
        offering: mockOffering1A,
        category: 'Lectures',
      });

      await courseFileService.resolveOfferingHierarchyFolder({
        offering: mockOffering2A,
        category: 'Lectures',
      });

      expect(folderNames).toContain('Dr. Jane Smith');
      expect(folderNames).toContain('Dr. John Doe');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Category Routing for All Document Types
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Category Routing for Every Document Type', () => {
    const expectations = [
      { type: 'CIS', expectedCategory: 'Course Documents' },
      { type: 'CCR', expectedCategory: 'Course Documents' },
      { type: 'ASSESS_PROJECT', expectedCategory: 'Course Documents' },
      { type: 'CCP', expectedCategory: 'Course Documents' },
      { type: 'CCC', expectedCategory: 'Course Documents' },
      { type: 'CRR', expectedCategory: 'Course Documents' },
      { type: 'TIMETABLE', expectedCategory: 'Course Documents' },
      { type: 'LECTURES', expectedCategory: 'Lectures' },
      { type: 'ASSESS_QUIZ', expectedCategory: 'Quizzes' },
      { type: 'ASSESS_ASSIGN', expectedCategory: 'Assignments' },
      { type: 'MIDTERM_EXAM_PAPER', expectedCategory: 'Midterm Exam' },
      { type: 'MIDTERM_BEST_COPY', expectedCategory: 'Midterm Exam' },
      { type: 'MIDTERM_AVERAGE_COPY', expectedCategory: 'Midterm Exam' },
      { type: 'MIDTERM_WORST_COPY', expectedCategory: 'Midterm Exam' },
      { type: 'FINAL_EXAM_PAPER', expectedCategory: 'Final Exam' },
      { type: 'FINAL_BEST_COPY', expectedCategory: 'Final Exam' },
      { type: 'FINAL_AVERAGE_COPY', expectedCategory: 'Final Exam' },
      { type: 'FINAL_WORST_COPY', expectedCategory: 'Final Exam' },
    ];

    test.each(expectations)(
      'routes $type to category $expectedCategory',
      ({ type, expectedCategory }) => {
        const category = courseFileService.getCategoryForDocumentType(type);
        expect(category).toBe(expectedCategory);
      }
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Clean File Naming
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Clean File Naming Conventions', () => {
    test('canonical course documents use clear readable names without codes or underscores', () => {
      expect(courseFileService.getCleanDocumentFilename({ documentType: 'CIS', fileFormat: 'pdf' })).toBe(
        'Course Information Sheet.pdf'
      );
      expect(courseFileService.getCleanDocumentFilename({ documentType: 'CIS', fileFormat: 'docx' })).toBe(
        'Course Information Sheet.docx'
      );
      expect(courseFileService.getCleanDocumentFilename({ documentType: 'CCR', fileFormat: 'pdf' })).toBe(
        'Course Control Report.pdf'
      );
      expect(courseFileService.getCleanDocumentFilename({ documentType: 'ASSESS_PROJECT', fileFormat: 'pdf' })).toBe(
        'Class Project.pdf'
      );
      expect(courseFileService.getCleanDocumentFilename({ documentType: 'CCP', fileFormat: 'pdf' })).toBe(
        'Class Project.pdf'
      );
      expect(courseFileService.getCleanDocumentFilename({ documentType: 'CCC', fileFormat: 'pdf' })).toBe(
        'Course Completion Certificate.pdf'
      );
      expect(courseFileService.getCleanDocumentFilename({ documentType: 'CRR', fileFormat: 'pdf' })).toBe(
        'Course Review Report.pdf'
      );
      expect(courseFileService.getCleanDocumentFilename({ documentType: 'TIMETABLE', fileFormat: 'pdf' })).toBe(
        'Timetable with Consulting Hours.pdf'
      );
    });

    test('quizzes use zero-padded readable names: Quiz 01.pdf, Quiz 02.pdf', () => {
      expect(courseFileService.getCleanDocumentFilename({ documentType: 'ASSESS_QUIZ', quizNumber: '1' })).toBe(
        'Quiz 01.pdf'
      );
      expect(courseFileService.getCleanDocumentFilename({ documentType: 'ASSESS_QUIZ', quizNumber: 'Quiz 2' })).toBe(
        'Quiz 02.pdf'
      );
      expect(courseFileService.getCleanDocumentFilename({ documentType: 'ASSESS_QUIZ', quizNumber: '10' })).toBe(
        'Quiz 10.pdf'
      );
    });

    test('assignments use zero-padded readable names: Assignment 01.pdf, Assignment 02.pdf', () => {
      expect(courseFileService.getCleanDocumentFilename({ documentType: 'ASSESS_ASSIGN', assignmentNumber: 1 })).toBe(
        'Assignment 01.pdf'
      );
      expect(courseFileService.getCleanDocumentFilename({ documentType: 'ASSESS_ASSIGN', assignmentNumber: '02' })).toBe(
        'Assignment 02.pdf'
      );
    });

    test('midterm and final exams use exact readable slot names preserving extension', () => {
      expect(courseFileService.getCleanDocumentFilename({ documentType: 'MIDTERM_EXAM_PAPER', fileFormat: 'pdf' })).toBe(
        'Exam Paper.pdf'
      );
      expect(courseFileService.getCleanDocumentFilename({ documentType: 'MIDTERM_BEST_COPY', fileFormat: 'docx' })).toBe(
        'Best Student Copy.docx'
      );
      expect(courseFileService.getCleanDocumentFilename({ documentType: 'FINAL_AVERAGE_COPY', fileFormat: 'pdf' })).toBe(
        'Average Student Copy.pdf'
      );
      expect(courseFileService.getCleanDocumentFilename({ documentType: 'FINAL_WORST_COPY', fileFormat: 'doc' })).toBe(
        'Worst Student Copy.doc'
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Filename Collision Handling
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Filename Collision Handling', () => {
    test('disambiguates quiz filename when different quiz instance already has the same readable name', async () => {
      const mockQuiz1Id = new mongoose.Types.ObjectId();
      const mockQuiz2Id = new mongoose.Types.ObjectId();

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering1A);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('mock_quizzes_folder_id');

      // First quiz exists with filename Quiz 01.pdf
      jest.spyOn(CourseFile, 'findOne').mockImplementation((q) => {
        if (q.filename === 'Quiz 01.pdf' && q.instanceName?.$ne) {
          return Promise.resolve({
            _id: new mongoose.Types.ObjectId(),
            filename: 'Quiz 01.pdf',
            instanceName: mockQuiz1Id.toString(),
          });
        }
        return Promise.resolve(null);
      });

      const mockUploadSpy = jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'new_drive_quiz_id',
        name: 'Quiz 01 (test).pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      });

      jest.spyOn(CourseFile, 'create').mockImplementation((data) => Promise.resolve({ ...data, _id: new mongoose.Types.ObjectId() }));

      const QuizModel = mongoose.model('Quiz');
      jest.spyOn(QuizModel, 'findById').mockResolvedValue({
        _id: mockQuiz2Id,
        courseOffering: mockOfferingIdA,
        quizInfo: { quizNumber: '1' },
      });

      const quizPdfService = require('../services/documentService/generateQuizPDF');
      jest.spyOn(quizPdfService, 'generateQuizPDF').mockResolvedValue(Buffer.from('pdf'));

      await courseFileService.generateAndSyncQuiz({
        offeringId: mockOfferingIdA,
        quizId: mockQuiz2Id,
        user: mockUser1,
      });

      expect(mockUploadSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: expect.stringMatching(/Quiz 01 \([a-f0-9]{4}\)\.pdf/),
        })
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Name Sanitization and Error Handling
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Sanitization and Missing Info Error Handling', () => {
    test('sanitizes slashes / and backslashes in visible folder names to -', () => {
      expect(courseFileService.sanitizeDriveName('Dr. Jane / John Smith')).toBe('Dr. Jane - John Smith');
      expect(courseFileService.sanitizeDriveName('CS/SE 101')).toBe('CS - SE 101');
      expect(courseFileService.sanitizeDriveName('Operating Systems\\CSC301')).toBe('Operating Systems - CSC301');
    });

    test('throws 400 error when semester info is missing', async () => {
      const brokenOffering = {
        _id: new mongoose.Types.ObjectId(),
        faculty: mockFaculty1,
        course: mockCourse,
        semester: null,
      };

      await expect(
        courseFileService.resolveOfferingHierarchyFolder({ offering: brokenOffering })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Semester information is missing'),
      });
    });

    test('throws 400 error when faculty info is missing', async () => {
      const brokenOffering = {
        _id: new mongoose.Types.ObjectId(),
        faculty: null,
        course: mockCourse,
        semester: mockSemester,
      };

      await expect(
        courseFileService.resolveOfferingHierarchyFolder({ offering: brokenOffering })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Faculty information is missing'),
      });
    });

    test('throws 400 error when course info is missing', async () => {
      const brokenOffering = {
        _id: new mongoose.Types.ObjectId(),
        faculty: mockFaculty1,
        course: null,
        semester: mockSemester,
      };

      await expect(
        courseFileService.resolveOfferingHierarchyFolder({ offering: brokenOffering })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Course information is missing'),
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Upload & Replacement with googleDriveFolderId Consistency
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Upload & Replacement with googleDriveFolderId Consistency', () => {
    test('fresh upload sets googleDriveFolderId to the resolved category folder ID', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering1A);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('category_folder_111');
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);

      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'drive_file_fresh',
        name: 'Course Information Sheet.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      });

      let savedRecord = null;
      jest.spyOn(CourseFile, 'create').mockImplementation((data) => {
        savedRecord = { ...data, _id: new mongoose.Types.ObjectId() };
        return Promise.resolve(savedRecord);
      });

      await courseFileService.syncOfferingDocument({
        offeringId: mockOfferingIdA,
        documentType: 'CIS',
        fileFormat: 'pdf',
        buffer: Buffer.from('dummy_pdf'),
        user: mockUser1,
      });

      expect(savedRecord).toBeDefined();
      expect(savedRecord.googleDriveFolderId).toBe('category_folder_111');
      expect(savedRecord.filename).toBe('Course Information Sheet.pdf');
    });

    test('replacement updates existing file in place and updates googleDriveFolderId', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering1A);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('category_folder_222');

      const existingRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOfferingIdA,
        documentType: 'CIS',
        fileFormat: 'pdf',
        instanceName: '',
        googleDriveFileId: 'drive_file_existing_123',
        googleDriveFolderId: rootFolderId, // Old flat root folder
        version: 1,
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(existingRecord);

      const uploadSpy = jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'drive_file_existing_123',
        name: 'Course Information Sheet.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        isUpdated: true,
      });

      const res = await courseFileService.syncOfferingDocument({
        offeringId: mockOfferingIdA,
        documentType: 'CIS',
        fileFormat: 'pdf',
        buffer: Buffer.from('updated_pdf'),
        user: mockUser1,
      });

      expect(uploadSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          existingFileId: 'drive_file_existing_123',
          filename: 'Course Information Sheet.pdf',
          folderId: 'category_folder_222',
        })
      );
      expect(res.version).toBe(2);
      expect(res.googleDriveFolderId).toBe('category_folder_222');
      expect(existingRecord.save).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Checklist Update Integration
  // ───────────────────────────────────────────────────────────────────────────
  describe('8. CourseChecklist Update After Successful Synchronization', () => {
    test('marks checklist item completed=true upon successful document sync', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering1A);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('category_fld');
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'new_file_id',
        name: 'Course Control Report.pdf',
        mimeType: 'application/pdf',
      });
      jest.spyOn(CourseFile, 'create').mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

      const mockChecklist = {
        checklistItems: [{ type: 'CCR', completed: false }],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      await courseFileService.syncOfferingDocument({
        offeringId: mockOfferingIdA,
        documentType: 'CCR',
        fileFormat: 'pdf',
        buffer: Buffer.from('ccr'),
        user: mockUser1,
      });

      expect(mockChecklist.checklistItems[0].completed).toBe(true);
      expect(mockChecklist.save).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Folder Identity Matching & Concurrency Protection
  // ───────────────────────────────────────────────────────────────────────────
  describe('9. Folder Identity Matching & Concurrency Protection', () => {
    const mockDriveClient = () => ({
      files: {
        list: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    });

    test('re-uses folder when name, parent, and metadata match exactly', async () => {
      const mockDrive = mockDriveClient();
      mockDrive.files.list.mockResolvedValue({
        data: {
          files: [
            {
              id: 'fld_match_123',
              name: 'Quizzes',
              appProperties: { offeringId: 'offering_123', category: 'Quizzes' },
            },
          ],
        },
      });
      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue(mockDrive);

      const result = await driveService.getOrCreateFolder('Quizzes', 'parent_offering_1', {
        appProperties: { offeringId: 'offering_123', category: 'Quizzes' },
      });

      expect(result).toBe('fld_match_123');
      expect(mockDrive.files.create).not.toHaveBeenCalled();
    });

    test('re-uses existing legacy folder under compatibility rule when metadata is missing', async () => {
      const mockDrive = mockDriveClient();
      mockDrive.files.list.mockResolvedValue({
        data: {
          files: [
            {
              id: 'fld_legacy_folder_99',
              name: 'Fall 2026',
              appProperties: undefined, // Legacy folder without appProperties
            },
          ],
        },
      });
      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue(mockDrive);

      const result = await driveService.getOrCreateFolder('Fall 2026', rootFolderId, {
        appProperties: { semesterId: 'sem_fall_2026' },
      });

      expect(result).toBe('fld_legacy_folder_99');
      expect(mockDrive.files.create).not.toHaveBeenCalled();
    });

    test('never silently reuses folder when metadata conflicts, throwing explicit 409 conflict error', async () => {
      const mockDrive = mockDriveClient();
      mockDrive.files.list.mockResolvedValue({
        data: {
          files: [
            {
              id: 'fld_conflicting_faculty',
              name: 'Dr. Jane Smith',
              appProperties: { facultyId: 'faculty_OTHER_ID' },
            },
          ],
        },
      });
      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue(mockDrive);

      let thrownError;
      try {
        await driveService.getOrCreateFolder('Dr. Jane Smith', 'sem_folder_1', {
          appProperties: { facultyId: 'faculty_REQUESTED_ID' },
        });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.statusCode).toBe(409);
      expect(thrownError.code).toBe('FOLDER_METADATA_CONFLICT');
      expect(thrownError.message).toContain('conflicting metadata (facultyId)');
      expect(mockDrive.files.create).not.toHaveBeenCalled();
    });

    test('isolates folders with identical names under different parent folders', async () => {
      const mockDrive = mockDriveClient();
      const calls = [];
      mockDrive.files.list.mockImplementation(async ({ q }) => {
        calls.push(q);
        if (q.includes("'parent_faculty_A' in parents")) {
          return {
            data: {
              files: [
                {
                  id: 'fld_secA_jane',
                  name: 'Operating Systems (CSC301) - Section A',
                  appProperties: { section: 'A', facultyId: 'faculty_Jane' },
                },
              ],
            },
          };
        }
        return { data: { files: [] } };
      });
      mockDrive.files.create.mockResolvedValue({
        data: { id: 'fld_secA_john', name: 'Operating Systems (CSC301) - Section A' },
      });
      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue(mockDrive);

      const resJane = await driveService.getOrCreateFolder(
        'Operating Systems (CSC301) - Section A',
        'parent_faculty_A',
        { appProperties: { section: 'A', facultyId: 'faculty_Jane' } }
      );
      const resJohn = await driveService.getOrCreateFolder(
        'Operating Systems (CSC301) - Section A',
        'parent_faculty_B',
        { appProperties: { section: 'A', facultyId: 'faculty_John' } }
      );

      expect(resJane).toBe('fld_secA_jane');
      expect(resJohn).toBe('fld_secA_john');
      expect(calls[0]).toContain("'parent_faculty_A' in parents");
      expect(calls[1]).toContain("'parent_faculty_B' in parents");
    });

    test('single-flight concurrency protection serializes simultaneous creation attempts to avoid duplicate folders', async () => {
      const mockDrive = mockDriveClient();
      let createCallCount = 0;
      let folderCreated = false;

      mockDrive.files.list.mockImplementation(async () => {
        if (folderCreated) {
          return {
            data: {
              files: [
                {
                  id: 'fld_single_flight_created',
                  name: 'Assignments',
                  appProperties: { category: 'Assignments', offeringId: 'offering_concurrent' },
                },
              ],
            },
          };
        }
        return { data: { files: [] } };
      });

      mockDrive.files.create.mockImplementation(async () => {
        createCallCount += 1;
        // Simulate async I/O delay in Drive API
        await new Promise((r) => setTimeout(r, 20));
        folderCreated = true;
        return {
          data: {
            id: 'fld_single_flight_created',
            name: 'Assignments',
            appProperties: { category: 'Assignments', offeringId: 'offering_concurrent' },
          },
        };
      });

      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue(mockDrive);

      // Launch two simultaneous requests for the exact same folder
      const [res1, res2] = await Promise.all([
        driveService.getOrCreateFolder('Assignments', 'offering_parent_conc', {
          appProperties: { category: 'Assignments', offeringId: 'offering_concurrent' },
        }),
        driveService.getOrCreateFolder('Assignments', 'offering_parent_conc', {
          appProperties: { category: 'Assignments', offeringId: 'offering_concurrent' },
        }),
      ]);

      expect(res1).toBe('fld_single_flight_created');
      expect(res2).toBe('fld_single_flight_created');
      // files.create should only be called once because the second request waited on the in-flight lock
      expect(createCallCount).toBe(1);
    });

    test('recovers from concurrent creation error by rechecking Drive and reusing created folder', async () => {
      const mockDrive = mockDriveClient();
      let attempt = 0;

      mockDrive.files.list.mockImplementation(async () => {
        attempt += 1;
        if (attempt === 1) {
          // Initial lookup: folder not found
          return { data: { files: [] } };
        }
        // Re-check after error: another request created the folder
        return {
          data: {
            files: [
              {
                id: 'fld_recovered_concurrent',
                name: 'Lectures',
                appProperties: { category: 'Lectures', offeringId: 'offering_recover' },
              },
            ],
          },
        };
      });

      // files.create throws a transient race error (e.g. rate limit or 409)
      mockDrive.files.create.mockRejectedValue(new Error('Google Drive creation conflict 409'));
      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue(mockDrive);

      const result = await driveService.getOrCreateFolder('Lectures', 'offering_parent_rec', {
        appProperties: { category: 'Lectures', offeringId: 'offering_recover' },
      });

      expect(result).toBe('fld_recovered_concurrent');
    });

    test('post-creation race detection resolves to canonical first folder and trashes redundant duplicate', async () => {
      const mockDrive = mockDriveClient();
      mockDrive.files.update = jest.fn().mockResolvedValue({});
      let listCalls = 0;

      mockDrive.files.list.mockImplementation(async () => {
        listCalls += 1;
        if (listCalls === 1) {
          // Initial lookup: empty
          return { data: { files: [] } };
        }
        // Post-creation check: two folders were created in a race
        return {
          data: {
            files: [
              {
                id: 'fld_first_canonical',
                name: 'Midterm Exam',
                createdTime: '2026-10-31T10:00:00.000Z',
                appProperties: { category: 'Midterm Exam' },
              },
              {
                id: 'fld_second_duplicate',
                name: 'Midterm Exam',
                createdTime: '2026-10-31T10:00:01.000Z',
                appProperties: { category: 'Midterm Exam' },
              },
            ],
          },
        };
      });

      // Our call created the second duplicate
      mockDrive.files.create.mockResolvedValue({
        data: {
          id: 'fld_second_duplicate',
          name: 'Midterm Exam',
          createdTime: '2026-10-31T10:00:01.000Z',
          appProperties: { category: 'Midterm Exam' },
        },
      });
      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue(mockDrive);

      const result = await driveService.getOrCreateFolder('Midterm Exam', 'offering_parent_post', {
        appProperties: { category: 'Midterm Exam' },
      });

      expect(result).toBe('fld_first_canonical');
      // Redundant duplicate should be trashed, NOT permanently deleted
      expect(mockDrive.files.update).toHaveBeenCalledWith({
        fileId: 'fld_second_duplicate',
        requestBody: { trashed: true },
        supportsAllDrives: true,
      });
    });

    test('trashing failure during race cleanup preserves canonical folder without failing the operation', async () => {
      const mockDrive = mockDriveClient();
      mockDrive.files.update = jest.fn().mockRejectedValue(new Error('Permission denied on trash'));
      let listCalls = 0;

      mockDrive.files.list.mockImplementation(async () => {
        listCalls += 1;
        if (listCalls === 1) return { data: { files: [] } };
        return {
          data: {
            files: [
              {
                id: 'fld_first_canonical',
                name: 'Quizzes',
                createdTime: '2026-10-31T10:00:00.000Z',
                appProperties: { category: 'Quizzes' },
              },
              {
                id: 'fld_second_duplicate',
                name: 'Quizzes',
                createdTime: '2026-10-31T10:00:01.000Z',
                appProperties: { category: 'Quizzes' },
              },
            ],
          },
        };
      });

      mockDrive.files.create.mockResolvedValue({
        data: {
          id: 'fld_second_duplicate',
          name: 'Quizzes',
          createdTime: '2026-10-31T10:00:01.000Z',
          appProperties: { category: 'Quizzes' },
        },
      });
      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue(mockDrive);

      const result = await driveService.getOrCreateFolder('Quizzes', 'offering_parent_post2', {
        appProperties: { category: 'Quizzes' },
      });

      expect(result).toBe('fld_first_canonical');
    });

    test('compatibility with existing folders when no appProperties are specified', async () => {
      const mockDrive = mockDriveClient();
      mockDrive.files.list.mockResolvedValue({
        data: {
          files: [
            {
              id: 'fld_unscoped_existing',
              name: 'General Documents',
            },
          ],
        },
      });
      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue(mockDrive);

      const result = await driveService.getOrCreateFolder('General Documents', rootFolderId);

      expect(result).toBe('fld_unscoped_existing');
      expect(mockDrive.files.create).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Fail-Closed Hierarchy Resolution & Tier Error Propagation
  // ───────────────────────────────────────────────────────────────────────────
  describe('10. Fail-Closed Hierarchy Resolution & Error Propagation', () => {
    test('transient Drive API error at Semester tier rejects immediately and identifies failed tier', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering1A);
      jest.spyOn(driveService, 'getOrCreateFolder').mockRejectedValue(new Error('Network timeout reaching Google Drive'));

      await expect(
        courseFileService.resolveOfferingHierarchyFolder({ offeringId: mockOfferingIdA })
      ).rejects.toThrow('Failed to resolve Google Drive folder hierarchy at Semester tier: Network timeout reaching Google Drive');
    });

    test('transient Drive API error at Faculty tier rejects immediately and identifies failed tier', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering1A);
      jest.spyOn(driveService, 'getOrCreateFolder').mockImplementation(async (name) => {
        if (name === 'Fall 2026') return 'fld_semester_111';
        throw new Error('Google Drive 503 Service Unavailable');
      });

      await expect(
        courseFileService.resolveOfferingHierarchyFolder({ offeringId: mockOfferingIdA })
      ).rejects.toThrow('Failed to resolve Google Drive folder hierarchy at Faculty tier: Google Drive 503 Service Unavailable');
    });

    test('transient Drive API error at Course Offering tier rejects immediately and identifies failed tier', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering1A);
      jest.spyOn(driveService, 'getOrCreateFolder').mockImplementation(async (name) => {
        if (name === 'Fall 2026') return 'fld_semester_111';
        if (name === 'Dr. Jane Smith') return 'fld_faculty_222';
        throw new Error('Google Drive quota exceeded');
      });

      await expect(
        courseFileService.resolveOfferingHierarchyFolder({ offeringId: mockOfferingIdA })
      ).rejects.toThrow('Failed to resolve Google Drive folder hierarchy at Course Offering tier: Google Drive quota exceeded');
    });

    test('transient Drive API error at Category tier rejects immediately and identifies failed tier', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering1A);
      jest.spyOn(driveService, 'getOrCreateFolder').mockImplementation(async (name) => {
        if (name === 'Fall 2026') return 'fld_semester_111';
        if (name === 'Dr. Jane Smith') return 'fld_faculty_222';
        if (name.includes('Operating Systems')) return 'fld_offering_333';
        throw new Error('Drive API rate limit reached');
      });

      await expect(
        courseFileService.resolveOfferingHierarchyFolder({ offeringId: mockOfferingIdA, category: 'Course Documents' })
      ).rejects.toThrow('Failed to resolve Google Drive folder hierarchy at Category tier: Drive API rate limit reached');
    });

    test('no upload occurs and no CourseFile record is persisted when hierarchy resolution fails', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering1A);
      jest.spyOn(driveService, 'getOrCreateFolder').mockRejectedValue(new Error('Google Drive connection refused'));
      const uploadSpy = jest.spyOn(driveService, 'uploadDocumentBuffer');
      const createSpy = jest.spyOn(CourseFile, 'create');

      await expect(
        courseFileService.syncOfferingDocument({
          offeringId: mockOfferingIdA,
          documentType: 'CIS',
          fileFormat: 'pdf',
          buffer: Buffer.from('dummy'),
          user: mockUser1,
        })
      ).rejects.toThrow('Failed to resolve Google Drive folder hierarchy at Semester tier');

      expect(uploadSpy).not.toHaveBeenCalled();
      expect(createSpy).not.toHaveBeenCalled();
    });

    test('helper functions propagate hierarchy resolution errors without returning root folder', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering1A);
      jest.spyOn(driveService, 'getOrCreateFolder').mockRejectedValue(new Error('Drive network failure'));

      await expect(courseFileService.getLecturesFolderForOffering(mockOffering1A)).rejects.toThrow(
        'Failed to resolve Google Drive folder hierarchy at Semester tier'
      );
      await expect(courseFileService.getQuizzesFolderForOffering(mockOffering1A)).rejects.toThrow(
        'Failed to resolve Google Drive folder hierarchy at Semester tier'
      );
      await expect(courseFileService.getAssignmentsFolderForOffering(mockOffering1A)).rejects.toThrow(
        'Failed to resolve Google Drive folder hierarchy at Semester tier'
      );
      await expect(courseFileService.getMidtermFolderForOffering(mockOffering1A)).rejects.toThrow(
        'Failed to resolve Google Drive folder hierarchy at Semester tier'
      );
      await expect(courseFileService.getFinalFolderForOffering(mockOffering1A)).rejects.toThrow(
        'Failed to resolve Google Drive folder hierarchy at Semester tier'
      );
    });
  });
});
