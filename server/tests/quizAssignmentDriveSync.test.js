/**
 * quizAssignmentDriveSync.test.js — Test suite for Quiz and Assignment Google Drive Backend Integration (Phase 1).
 *
 * Verifies:
 *  1. Successful Quiz Synchronization:
 *     - Authorizes offering, verifies quiz membership, generates docx, uploads to Drive, creates CourseFile, updates checklist
 *  2. Successful Assignment Synchronization:
 *     - Authorizes offering, verifies assignment membership, generates docx, uploads to Drive, creates CourseFile, updates checklist
 *  3. Controller Endpoints (POST /api/course-files/sync/quiz/:offeringId/:quizId & assignment):
 *     - Status 200 on success, proper responses and error codes
 *  4. Unauthorized Offering Access:
 *     - Throws 403 Forbidden when faculty does not have access to the offering
 *  5. Assessment Belonging to a Different Offering:
 *     - Throws 403 Forbidden when quiz/assignment belongs to another offering
 *  6. Legacy Unassociated Assessment Handling:
 *     - Rejects unlinked assessments (courseOffering: null) with 400 Bad Request
 *  7. Re-sync Updating Existing File Rather Than Creating Duplicate:
 *     - Uses existing googleDriveFileId in driveService.uploadDocumentBuffer, increments version in-place
 *  8. Quiz and Assignment Records Coexisting with Current Unique Index:
 *     - Validates partial unique index with { isCanonical: true } allows multiple isCanonical: false records
 *  9. Missing Drive Files Handling:
 *     - When existing Drive file is 404, uploadDocumentBuffer creates fresh file and updates CourseFile record
 *  10. Drive Upload Failure Handling:
 *      - Rejects with error, does not create CourseFile, does not corrupt assessment in MongoDB
 *  11. Metadata Persistence Failures & Orphaned Drive File Cleanup:
 *      - Cleans up Drive file if CourseFile.create fails
 *  12. Safe Deletion and Cleanup:
 *      - deleteAssessmentFile deletes from Drive and deletes CourseFile record
 *      - deleteAssessmentFile preserves CourseFile if Drive deletion fails
 *      - deleteQuiz / deleteAssignment prevents deleting assessment if Drive deletion fails
 *      - Checklist state remains consistent when last or remaining assessment is deleted
 */

const mongoose = require('mongoose');
const driveService = require('../services/drive.service');
const courseFileService = require('../services/courseFile.service');
const courseFileController = require('../controllers/courseFile.controller');
const courseOfferingService = require('../services/courseOffering.service');
const quizController = require('../controllers/quiz.controller');
const assignmentController = require('../controllers/assignment.controller');
const CourseFile = require('../models/CourseFile.model');
const Quiz = require('../models/Quiz.model');
const Assignment = require('../models/Assignment.model');
const CourseChecklist = require('../models/CourseChecklist.model');
const quizPDFService = require('../services/documentService/generateQuizPDF');
const assignmentPDFService = require('../services/documentService/generateAssignmentPDF');

describe('Phase 1: Quiz & Assignment Google Drive Backend Integration Suite', () => {
  const originalEnv = process.env;

  const mockOfferingId = new mongoose.Types.ObjectId().toString();
  const mockCourseId = new mongoose.Types.ObjectId().toString();
  const mockFacultyId = new mongoose.Types.ObjectId().toString();
  const mockSemesterId = new mongoose.Types.ObjectId().toString();
  const otherOfferingId = new mongoose.Types.ObjectId().toString();

  const mockUser = {
    _id: new mongoose.Types.ObjectId(mockFacultyId),
    name: 'Dr. John Doe',
    email: 'johndoe@iu.edu.pk',
    designation: 'faculty',
  };

  const otherUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Dr. Other Faculty',
    email: 'other@iu.edu.pk',
    designation: 'faculty',
  };

  const mockOffering = {
    _id: new mongoose.Types.ObjectId(mockOfferingId),
    course: {
      _id: new mongoose.Types.ObjectId(mockCourseId),
      courseCode: 'CS301',
      courseName: 'Algorithms',
      department: new mongoose.Types.ObjectId(),
    },
    faculty: {
      _id: new mongoose.Types.ObjectId(mockFacultyId),
      name: 'Dr. John Doe',
    },
    semester: {
      _id: new mongoose.Types.ObjectId(mockSemesterId),
      name: 'Fall 2026',
    },
    section: 'A',
  };

  const createMockRes = () => {
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (payload) {
        this.body = payload;
        return this;
      },
      send: function (payload) {
        this.body = payload;
        return this;
      },
      setHeader: function (key, value) {
        this.headers[key] = value;
        return this;
      },
    };
    return res;
  };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GOOGLE_DRIVE_FOLDER_ID: 'mock_root_drive_folder_id',
    };
    jest.clearAllMocks();
    jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(null);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Successful Quiz Synchronization
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Successful Quiz Synchronization', () => {
    test('generateAndSyncQuiz generates pdf, uploads to Drive, creates CourseFile, and updates checklist', async () => {
      const mockQuizId = new mongoose.Types.ObjectId().toString();
      const mockQuiz = {
        _id: new mongoose.Types.ObjectId(mockQuizId),
        courseOffering: mockOffering._id,
        course: mockOffering.course._id,
        faculty: mockOffering.faculty._id,
        quizInfo: { quizNumber: '1', date: '2026-10-15', totalMarks: 20 },
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Quiz, 'findById').mockResolvedValue(mockQuiz);
      jest.spyOn(quizPDFService, 'generateQuizPDF').mockResolvedValue(Buffer.from('%PDF-1.4 mock_quiz_pdf_buffer'));
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('mock_quizzes_folder_id');
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null); // Fresh upload

      const mockUploadResult = {
        fileId: 'drive_quiz_file_123',
        name: 'ASSESS_QUIZ_CS301_SecA_Quiz_1.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        webViewLink: 'https://drive.google.com/file/d/drive_quiz_file_123/view',
        webContentLink: 'https://drive.google.com/file/d/drive_quiz_file_123/download',
        isUpdated: false,
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(mockUploadResult);

      const mockCreatedCourseFile = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'ASSESS_QUIZ',
        fileFormat: 'pdf',
        filename: mockUploadResult.name,
        googleDriveFileId: mockUploadResult.fileId,
        googleDriveFolderId: 'mock_quizzes_folder_id',
        googleDriveWebViewLink: mockUploadResult.webViewLink,
        googleDriveWebContentLink: mockUploadResult.webContentLink,
        mimeType: mockUploadResult.mimeType,
        sizeBytes: mockUploadResult.sizeBytes,
        version: 1,
        isCanonical: false,
        instanceName: mockQuizId,
        status: 'synced',
        uploadedBy: mockUser._id,
      };
      jest.spyOn(CourseFile, 'create').mockResolvedValue(mockCreatedCourseFile);

      const mockChecklist = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        checklistItems: [{ type: 'ASSESS_QUIZ', completed: false }],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      const result = await courseFileService.generateAndSyncQuiz({
        offeringId: mockOfferingId,
        quizId: mockQuizId,
        user: mockUser,
      });

      expect(courseOfferingService.getOfferingById).toHaveBeenCalledWith(mockOfferingId, mockUser);
      expect(Quiz.findById).toHaveBeenCalledWith(mockQuizId);
      expect(quizPDFService.generateQuizPDF).toHaveBeenCalledWith(mockQuiz);
      expect(driveService.uploadDocumentBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          buffer: expect.any(Buffer),
          filename: 'ASSESS_QUIZ_CS301_SecA_Quiz_1.pdf',
          mimeType: 'application/pdf',
          folderId: 'mock_quizzes_folder_id',
          existingFileId: null,
        })
      );
      expect(CourseFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'ASSESS_QUIZ',
          fileFormat: 'pdf',
          isCanonical: false,
          instanceName: mockQuizId,
          googleDriveFileId: 'drive_quiz_file_123',
          version: 1,
          status: 'synced',
        })
      );
      expect(mockChecklist.checklistItems[0].completed).toBe(true);
      expect(mockChecklist.save).toHaveBeenCalled();
      expect(result).toBe(mockCreatedCourseFile);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Successful Assignment Synchronization
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Successful Assignment Synchronization', () => {
    test('generateAndSyncAssignment generates pdf, uploads to Drive, creates CourseFile, and updates checklist', async () => {
      const mockAssignmentId = new mongoose.Types.ObjectId().toString();
      const mockAssignment = {
        _id: new mongoose.Types.ObjectId(mockAssignmentId),
        courseOffering: mockOffering._id,
        course: mockOffering.course._id,
        faculty: mockOffering.faculty._id,
        assignmentInfo: { assignmentNumber: '2', date: '2026-10-20', totalMarks: 50 },
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Assignment, 'findById').mockResolvedValue(mockAssignment);
      jest.spyOn(assignmentPDFService, 'generateAssignmentPDF').mockResolvedValue(Buffer.from('%PDF-1.4 mock_assign_pdf_buffer'));
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('mock_assignments_folder_id');
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);

      const mockUploadResult = {
        fileId: 'drive_assign_file_456',
        name: 'ASSESS_ASSIGN_CS301_SecA_Assignment_2.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        webViewLink: 'https://drive.google.com/file/d/drive_assign_file_456/view',
        webContentLink: 'https://drive.google.com/file/d/drive_assign_file_456/download',
        isUpdated: false,
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(mockUploadResult);

      const mockCreatedCourseFile = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'ASSESS_ASSIGN',
        fileFormat: 'pdf',
        filename: mockUploadResult.name,
        googleDriveFileId: mockUploadResult.fileId,
        googleDriveFolderId: 'mock_assignments_folder_id',
        googleDriveWebViewLink: mockUploadResult.webViewLink,
        googleDriveWebContentLink: mockUploadResult.webContentLink,
        mimeType: mockUploadResult.mimeType,
        sizeBytes: mockUploadResult.sizeBytes,
        version: 1,
        isCanonical: false,
        instanceName: mockAssignmentId,
        status: 'synced',
        uploadedBy: mockUser._id,
      };
      jest.spyOn(CourseFile, 'create').mockResolvedValue(mockCreatedCourseFile);

      const mockChecklist = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        checklistItems: [{ type: 'ASSESS_ASSIGN', completed: false }],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      const result = await courseFileService.generateAndSyncAssignment({
        offeringId: mockOfferingId,
        assignmentId: mockAssignmentId,
        user: mockUser,
      });

      expect(courseOfferingService.getOfferingById).toHaveBeenCalledWith(mockOfferingId, mockUser);
      expect(Assignment.findById).toHaveBeenCalledWith(mockAssignmentId);
      expect(assignmentPDFService.generateAssignmentPDF).toHaveBeenCalledWith(mockAssignment);
      expect(driveService.uploadDocumentBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          buffer: expect.any(Buffer),
          filename: 'ASSESS_ASSIGN_CS301_SecA_Assignment_2.pdf',
          mimeType: 'application/pdf',
          folderId: 'mock_assignments_folder_id',
          existingFileId: null,
        })
      );
      expect(CourseFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'ASSESS_ASSIGN',
          fileFormat: 'pdf',
          isCanonical: false,
          instanceName: mockAssignmentId,
          googleDriveFileId: 'drive_assign_file_456',
          version: 1,
          status: 'synced',
        })
      );
      expect(mockChecklist.checklistItems[0].completed).toBe(true);
      expect(mockChecklist.save).toHaveBeenCalled();
      expect(result).toBe(mockCreatedCourseFile);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Controller Endpoints (POST /api/course-files/sync/quiz & assignment)
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Controller Endpoints for Sync', () => {
    test('syncQuizDocument responds with 200 and sync result on success', async () => {
      const mockQuizId = new mongoose.Types.ObjectId().toString();
      const mockResult = {
        _id: new mongoose.Types.ObjectId(),
        filename: 'ASSESS_QUIZ_CS301_SecA_Quiz_1.pdf',
        googleDriveFileId: 'drive_quiz_1',
        googleDriveWebViewLink: 'https://view',
        version: 1,
        status: 'synced',
      };
      jest.spyOn(courseFileService, 'generateAndSyncQuiz').mockResolvedValue(mockResult);

      const req = {
        params: { offeringId: mockOfferingId, quizId: mockQuizId },
        user: mockUser,
      };
      const res = createMockRes();
      const next = jest.fn();

      await courseFileController.syncQuizDocument(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.googleDriveFileId).toBe('drive_quiz_1');
    });

    test('syncAssignmentDocument responds with 200 and sync result on success', async () => {
      const mockAssignmentId = new mongoose.Types.ObjectId().toString();
      const mockResult = {
        _id: new mongoose.Types.ObjectId(),
        filename: 'ASSESS_ASSIGN_CS301_SecA_Assignment_1.pdf',
        googleDriveFileId: 'drive_assign_1',
        googleDriveWebViewLink: 'https://view',
        version: 1,
        status: 'synced',
      };
      jest.spyOn(courseFileService, 'generateAndSyncAssignment').mockResolvedValue(mockResult);

      const req = {
        params: { offeringId: mockOfferingId, assignmentId: mockAssignmentId },
        user: mockUser,
      };
      const res = createMockRes();
      const next = jest.fn();

      await courseFileController.syncAssignmentDocument(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.googleDriveFileId).toBe('drive_assign_1');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Unauthorized Offering Access
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Unauthorized Offering Access', () => {
    test('rejects quiz sync with 403 when user is not authorized for the offering', async () => {
      const authErr = new Error('You do not have access to this course offering');
      authErr.statusCode = 403;
      jest.spyOn(courseOfferingService, 'getOfferingById').mockRejectedValue(authErr);

      const mockQuizId = new mongoose.Types.ObjectId().toString();
      await expect(
        courseFileService.generateAndSyncQuiz({
          offeringId: mockOfferingId,
          quizId: mockQuizId,
          user: otherUser,
        })
      ).rejects.toThrow('You do not have access to this course offering');
    });

    test('rejects assignment sync with 403 when user is not authorized for the offering', async () => {
      const authErr = new Error('You do not have access to this course offering');
      authErr.statusCode = 403;
      jest.spyOn(courseOfferingService, 'getOfferingById').mockRejectedValue(authErr);

      const mockAssignmentId = new mongoose.Types.ObjectId().toString();
      await expect(
        courseFileService.generateAndSyncAssignment({
          offeringId: mockOfferingId,
          assignmentId: mockAssignmentId,
          user: otherUser,
        })
      ).rejects.toThrow('You do not have access to this course offering');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Assessment Belonging to a Different Offering
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Assessment Belonging to a Different Offering', () => {
    test('rejects quiz sync when quiz is assigned to another offering', async () => {
      const mockQuizId = new mongoose.Types.ObjectId().toString();
      const mockQuiz = {
        _id: new mongoose.Types.ObjectId(mockQuizId),
        courseOffering: new mongoose.Types.ObjectId(otherOfferingId),
        course: mockOffering.course._id,
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Quiz, 'findById').mockResolvedValue(mockQuiz);

      await expect(
        courseFileService.generateAndSyncQuiz({
          offeringId: mockOfferingId,
          quizId: mockQuizId,
          user: mockUser,
        })
      ).rejects.toThrow('This quiz belongs to a different course offering.');
    });

    test('rejects assignment sync when assignment is assigned to another offering', async () => {
      const mockAssignmentId = new mongoose.Types.ObjectId().toString();
      const mockAssignment = {
        _id: new mongoose.Types.ObjectId(mockAssignmentId),
        courseOffering: new mongoose.Types.ObjectId(otherOfferingId),
        course: mockOffering.course._id,
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Assignment, 'findById').mockResolvedValue(mockAssignment);

      await expect(
        courseFileService.generateAndSyncAssignment({
          offeringId: mockOfferingId,
          assignmentId: mockAssignmentId,
          user: mockUser,
        })
      ).rejects.toThrow('This assignment belongs to a different course offering.');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Legacy Unassociated Assessment Handling
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Legacy Unassociated Assessment Handling', () => {
    test('rejects quiz sync with 400 if quiz has no courseOffering association', async () => {
      const mockQuizId = new mongoose.Types.ObjectId().toString();
      const mockLegacyQuiz = {
        _id: new mongoose.Types.ObjectId(mockQuizId),
        courseOffering: null,
        course: mockOffering.course._id,
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Quiz, 'findById').mockResolvedValue(mockLegacyQuiz);

      await expect(
        courseFileService.generateAndSyncQuiz({
          offeringId: mockOfferingId,
          quizId: mockQuizId,
          user: mockUser,
        })
      ).rejects.toThrow(/not associated with a course offering/);
    });

    test('rejects assignment sync with 400 if assignment has no courseOffering association', async () => {
      const mockAssignmentId = new mongoose.Types.ObjectId().toString();
      const mockLegacyAssignment = {
        _id: new mongoose.Types.ObjectId(mockAssignmentId),
        courseOffering: null,
        course: mockOffering.course._id,
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Assignment, 'findById').mockResolvedValue(mockLegacyAssignment);

      await expect(
        courseFileService.generateAndSyncAssignment({
          offeringId: mockOfferingId,
          assignmentId: mockAssignmentId,
          user: mockUser,
        })
      ).rejects.toThrow(/not associated with a course offering/);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Re-sync Updating Existing File Rather Than Creating Duplicate
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Safe Re-Synchronization (In-Place Update)', () => {
    test('re-syncing quiz updates existing Drive file in place and increments version', async () => {
      const mockQuizId = new mongoose.Types.ObjectId().toString();
      const mockQuiz = {
        _id: new mongoose.Types.ObjectId(mockQuizId),
        courseOffering: mockOffering._id,
        quizInfo: { quizNumber: '1' },
      };

      const existingRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'ASSESS_QUIZ',
        fileFormat: 'pdf',
        instanceName: mockQuizId,
        googleDriveFileId: 'drive_existing_quiz_file_id',
        version: 1,
        status: 'synced',
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Quiz, 'findById').mockResolvedValue(mockQuiz);
      jest.spyOn(quizPDFService, 'generateQuizPDF').mockResolvedValue(Buffer.from('updated_pdf_buffer'));
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('mock_quizzes_folder_id');
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(existingRecord);
      jest.spyOn(CourseFile, 'create');

      const mockUploadResult = {
        fileId: 'drive_existing_quiz_file_id',
        name: 'ASSESS_QUIZ_CS301_SecA_Quiz_1.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1500,
        webViewLink: 'https://drive.google.com/file/d/drive_existing_quiz_file_id/view',
        webContentLink: 'https://drive.google.com/file/d/drive_existing_quiz_file_id/download',
        isUpdated: true,
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(mockUploadResult);

      const result = await courseFileService.generateAndSyncQuiz({
        offeringId: mockOfferingId,
        quizId: mockQuizId,
        user: mockUser,
      });

      // Assert in-place update was requested
      expect(driveService.uploadDocumentBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          existingFileId: 'drive_existing_quiz_file_id',
        })
      );
      // CourseFile.create should NOT be called
      expect(CourseFile.create).not.toHaveBeenCalled();
      // Record version incremented from 1 to 2
      expect(existingRecord.version).toBe(2);
      expect(existingRecord.save).toHaveBeenCalled();
      expect(result.version).toBe(2);
    });

    test('re-syncing assignment updates existing Drive file in place and increments version', async () => {
      const mockAssignmentId = new mongoose.Types.ObjectId().toString();
      const mockAssignment = {
        _id: new mongoose.Types.ObjectId(mockAssignmentId),
        courseOffering: mockOffering._id,
        assignmentInfo: { assignmentNumber: '1' },
      };

      const existingRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'ASSESS_ASSIGN',
        fileFormat: 'pdf',
        instanceName: mockAssignmentId,
        googleDriveFileId: 'drive_existing_assign_file_id',
        version: 2,
        status: 'synced',
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Assignment, 'findById').mockResolvedValue(mockAssignment);
      jest.spyOn(assignmentPDFService, 'generateAssignmentPDF').mockResolvedValue(Buffer.from('updated_assign_pdf'));
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('mock_assignments_folder_id');
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(existingRecord);
      jest.spyOn(CourseFile, 'create');

      const mockUploadResult = {
        fileId: 'drive_existing_assign_file_id',
        name: 'ASSESS_ASSIGN_CS301_SecA_Assignment_1.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 3000,
        webViewLink: 'https://drive.google.com/file/d/drive_existing_assign_file_id/view',
        webContentLink: 'https://drive.google.com/file/d/drive_existing_assign_file_id/download',
        isUpdated: true,
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(mockUploadResult);

      const result = await courseFileService.generateAndSyncAssignment({
        offeringId: mockOfferingId,
        assignmentId: mockAssignmentId,
        user: mockUser,
      });

      expect(driveService.uploadDocumentBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          existingFileId: 'drive_existing_assign_file_id',
        })
      );
      expect(CourseFile.create).not.toHaveBeenCalled();
      expect(existingRecord.version).toBe(3);
      expect(existingRecord.save).toHaveBeenCalled();
      expect(result.version).toBe(3);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Quiz and Assignment Records Coexisting with Current Unique Index
  // ───────────────────────────────────────────────────────────────────────────
  describe('8. Schema Index Coexistence Verification', () => {
    test('CourseFile model unique compound index uses partialFilterExpression for canonical files only', () => {
      const indexes = CourseFile.schema.indexes();
      const compoundIndex = indexes.find((idx) => {
        const fields = Object.keys(idx[0]);
        return (
          fields.includes('courseOffering') &&
          fields.includes('documentType') &&
          fields.includes('fileFormat') &&
          fields.includes('instanceName')
        );
      });

      expect(compoundIndex).toBeDefined();
      expect(compoundIndex[1].unique).toBe(true);
      // Confirms partialFilterExpression is { isCanonical: true }, allowing non-canonical files to coexist freely
      expect(compoundIndex[1].partialFilterExpression).toEqual({ isCanonical: true });
    });

    test('new PDF sync creates a PDF record independently without overwriting existing legacy DOCX record', async () => {
      const mockQuizId = new mongoose.Types.ObjectId().toString();
      const mockQuiz = {
        _id: new mongoose.Types.ObjectId(mockQuizId),
        courseOffering: mockOffering._id,
        quizInfo: { quizNumber: '1' },
      };

      // Legacy docx record in database
      const legacyDocxRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'ASSESS_QUIZ',
        fileFormat: 'docx',
        instanceName: mockQuizId,
        googleDriveFileId: 'drive_legacy_docx_id',
        version: 1,
        status: 'synced',
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Quiz, 'findById').mockResolvedValue(mockQuiz);
      jest.spyOn(quizPDFService, 'generateQuizPDF').mockResolvedValue(Buffer.from('%PDF-1.4 mock_pdf'));
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('mock_quizzes_folder_id');

      // CourseFile.findOne is queried with fileFormat: 'pdf', so it does NOT match legacy docx record
      jest.spyOn(CourseFile, 'findOne').mockImplementation((query) => {
        if (query.fileFormat === 'pdf') return Promise.resolve(null);
        if (query.fileFormat === 'docx') return Promise.resolve(legacyDocxRecord);
        return Promise.resolve(null);
      });

      const mockUploadResult = {
        fileId: 'drive_new_pdf_id',
        name: 'ASSESS_QUIZ_CS301_SecA_Quiz_1.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2000,
        webViewLink: 'https://drive.google.com/pdf/view',
        webContentLink: 'https://drive.google.com/pdf/download',
        isUpdated: false,
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(mockUploadResult);

      const mockCreatedPdfFile = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'ASSESS_QUIZ',
        fileFormat: 'pdf',
        instanceName: mockQuizId,
        googleDriveFileId: 'drive_new_pdf_id',
        version: 1,
        status: 'synced',
      };
      jest.spyOn(CourseFile, 'create').mockResolvedValue(mockCreatedPdfFile);
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue({ checklistItems: [], save: jest.fn() });

      const result = await courseFileService.generateAndSyncQuiz({
        offeringId: mockOfferingId,
        quizId: mockQuizId,
        user: mockUser,
      });

      // Verifies findOne searched for fileFormat: 'pdf'
      expect(CourseFile.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          courseOffering: mockOffering._id,
          documentType: 'ASSESS_QUIZ',
          fileFormat: 'pdf',
          instanceName: mockQuizId,
        })
      );
      // Verifies new CourseFile.create was called with fileFormat: 'pdf'
      expect(CourseFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fileFormat: 'pdf',
          documentType: 'ASSESS_QUIZ',
          googleDriveFileId: 'drive_new_pdf_id',
        })
      );
      expect(result.fileFormat).toBe('pdf');
      // Verifies driveService was not asked to overwrite the legacy docx fileId
      expect(driveService.uploadDocumentBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          existingFileId: null,
          mimeType: 'application/pdf',
        })
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Missing Drive Files Handling
  // ───────────────────────────────────────────────────────────────────────────
  describe('9. Missing Drive Files Handling (Drive 404 Recovery)', () => {
    test('when existing Drive file is missing (404), uploadDocumentBuffer creates fresh file and updates CourseFile record', async () => {
      const mockQuizId = new mongoose.Types.ObjectId().toString();
      const mockQuiz = {
        _id: new mongoose.Types.ObjectId(mockQuizId),
        courseOffering: mockOffering._id,
        quizInfo: { quizNumber: '1' },
      };

      const existingRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'ASSESS_QUIZ',
        fileFormat: 'pdf',
        instanceName: mockQuizId,
        googleDriveFileId: 'drive_dead_file_id',
        version: 1,
        status: 'synced',
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Quiz, 'findById').mockResolvedValue(mockQuiz);
      jest.spyOn(quizPDFService, 'generateQuizPDF').mockResolvedValue(Buffer.from('pdf_buffer'));
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('mock_quizzes_folder_id');
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(existingRecord);

      // driveService handles 404 and returns a newly created file with a new ID
      const recoveredUploadResult = {
        fileId: 'drive_brand_new_file_id',
        name: 'ASSESS_QUIZ_CS301_SecA_Quiz_1.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1100,
        webViewLink: 'https://drive.google.com/file/d/drive_brand_new_file_id/view',
        webContentLink: 'https://drive.google.com/file/d/drive_brand_new_file_id/download',
        isUpdated: false,
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(recoveredUploadResult);

      const result = await courseFileService.generateAndSyncQuiz({
        offeringId: mockOfferingId,
        quizId: mockQuizId,
        user: mockUser,
      });

      expect(existingRecord.googleDriveFileId).toBe('drive_brand_new_file_id');
      expect(existingRecord.version).toBe(2);
      expect(result.googleDriveFileId).toBe('drive_brand_new_file_id');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Drive Upload Failures
  // ───────────────────────────────────────────────────────────────────────────
  describe('10. Drive Upload Failures', () => {
    test('propagates 500 error when Google Drive upload fails and does not save metadata or touch assessment', async () => {
      const mockQuizId = new mongoose.Types.ObjectId().toString();
      const mockQuiz = {
        _id: new mongoose.Types.ObjectId(mockQuizId),
        courseOffering: mockOffering._id,
        quizInfo: { quizNumber: '1' },
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Quiz, 'findById').mockResolvedValue(mockQuiz);
      jest.spyOn(quizPDFService, 'generateQuizPDF').mockResolvedValue(Buffer.from('pdf_buffer'));
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('mock_quizzes_folder_id');
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);
      jest.spyOn(CourseFile, 'create');
      jest.spyOn(CourseChecklist, 'findOne');

      jest.spyOn(driveService, 'uploadDocumentBuffer').mockRejectedValue(new Error('Drive network failure'));

      await expect(
        courseFileService.generateAndSyncQuiz({
          offeringId: mockOfferingId,
          quizId: mockQuizId,
          user: mockUser,
        })
      ).rejects.toThrow('Google Drive upload failed: Drive network failure');

      expect(CourseFile.create).not.toHaveBeenCalled();
      expect(CourseChecklist.findOne).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 11. Metadata Persistence Failures & Orphaned Drive File Cleanup
  // ───────────────────────────────────────────────────────────────────────────
  describe('11. Metadata Persistence Failures and Orphaned Cleanup', () => {
    test('cleans up uploaded Drive file when CourseFile database creation fails', async () => {
      const mockQuizId = new mongoose.Types.ObjectId().toString();
      const mockQuiz = {
        _id: new mongoose.Types.ObjectId(mockQuizId),
        courseOffering: mockOffering._id,
        quizInfo: { quizNumber: '1' },
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Quiz, 'findById').mockResolvedValue(mockQuiz);
      jest.spyOn(quizPDFService, 'generateQuizPDF').mockResolvedValue(Buffer.from('pdf_buffer'));
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('mock_quizzes_folder_id');
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);

      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'orphaned_drive_id_789',
        name: 'ASSESS_QUIZ_CS301_SecA_Quiz_1.pdf',
      });
      jest.spyOn(CourseFile, 'create').mockRejectedValue(new Error('MongoDB write error'));
      jest.spyOn(driveService, 'deleteFile').mockResolvedValue(true);

      await expect(
        courseFileService.generateAndSyncQuiz({
          offeringId: mockOfferingId,
          quizId: mockQuizId,
          user: mockUser,
        })
      ).rejects.toThrow(/Failed to save quiz file metadata: MongoDB write error/);

      // Verify orphaned file was cleaned up from Google Drive
      expect(driveService.deleteFile).toHaveBeenCalledWith('orphaned_drive_id_789');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 12. Safe Deletion and Cleanup
  // ───────────────────────────────────────────────────────────────────────────
  describe('12. Safe Deletion and Cleanup', () => {
    test('deleteAssessmentFile verifies authorization, deletes Drive file, and deletes CourseFile record', async () => {
      const mockQuizId = new mongoose.Types.ObjectId().toString();
      const mockCourseFileRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'ASSESS_QUIZ',
        instanceName: mockQuizId,
        googleDriveFileId: 'drive_file_to_delete',
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(mockCourseFileRecord);
      jest.spyOn(driveService, 'deleteFile').mockResolvedValue(true);
      jest.spyOn(CourseFile, 'findByIdAndDelete').mockResolvedValue(mockCourseFileRecord);

      const result = await courseFileService.deleteAssessmentFile({
        offeringId: mockOfferingId,
        documentType: 'ASSESS_QUIZ',
        assessmentId: mockQuizId,
        user: mockUser,
      });

      expect(courseOfferingService.getOfferingById).toHaveBeenCalledWith(mockOfferingId, mockUser);
      expect(driveService.deleteFile).toHaveBeenCalledWith('drive_file_to_delete');
      expect(CourseFile.findByIdAndDelete).toHaveBeenCalledWith(mockCourseFileRecord._id);
      expect(result.deleted).toBe(true);
    });

    test('deleteAssessmentFile preserves CourseFile record when Drive deletion fails', async () => {
      const mockQuizId = new mongoose.Types.ObjectId().toString();
      const mockCourseFileRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'ASSESS_QUIZ',
        instanceName: mockQuizId,
        googleDriveFileId: 'drive_file_fail',
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(mockCourseFileRecord);
      jest.spyOn(driveService, 'deleteFile').mockRejectedValue(new Error('Google Drive API 500 error'));
      jest.spyOn(CourseFile, 'findByIdAndDelete');

      await expect(
        courseFileService.deleteAssessmentFile({
          offeringId: mockOfferingId,
          documentType: 'ASSESS_QUIZ',
          assessmentId: mockQuizId,
          user: mockUser,
        })
      ).rejects.toThrow(/Google Drive deletion failed: Google Drive API 500 error/);

      // CourseFile must NOT be deleted so retry can find the record and file ID
      expect(CourseFile.findByIdAndDelete).not.toHaveBeenCalled();
    });

    test('deleteQuiz controller prevents quiz deletion and returns 502 when Drive deletion fails', async () => {
      const mockQuizId = new mongoose.Types.ObjectId().toString();
      const mockQuiz = {
        _id: new mongoose.Types.ObjectId(mockQuizId),
        courseOffering: mockOffering._id,
        faculty: mockOffering.faculty._id,
        deleteOne: jest.fn(),
      };

      jest.spyOn(Quiz, 'findById').mockResolvedValue(mockQuiz);
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(courseFileService, 'deleteAssessmentFile').mockRejectedValue(
        new Error('Google Drive API timeout')
      );

      const req = {
        params: { quizId: mockQuizId },
        user: mockUser,
      };
      const res = createMockRes();
      const next = jest.fn();

      await quizController.deleteQuiz(req, res, next);

      expect(res.statusCode).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Failed to delete associated Google Drive file');
      // Quiz in MongoDB was NOT deleted
      expect(mockQuiz.deleteOne).not.toHaveBeenCalled();
    });

    test('deleteAssignment controller prevents assignment deletion and returns 502 when Drive deletion fails', async () => {
      const mockAssignmentId = new mongoose.Types.ObjectId().toString();
      const mockAssignment = {
        _id: new mongoose.Types.ObjectId(mockAssignmentId),
        courseOffering: mockOffering._id,
        faculty: mockOffering.faculty._id,
        deleteOne: jest.fn(),
      };

      jest.spyOn(Assignment, 'findById').mockResolvedValue(mockAssignment);
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(courseFileService, 'deleteAssessmentFile').mockRejectedValue(
        new Error('Google Drive API connection reset')
      );

      const req = {
        params: { assignmentId: mockAssignmentId },
        user: mockUser,
      };
      const res = createMockRes();
      const next = jest.fn();

      await assignmentController.deleteAssignment(req, res, next);

      expect(res.statusCode).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Failed to delete associated Google Drive file');
      // Assignment in MongoDB was NOT deleted
      expect(mockAssignment.deleteOne).not.toHaveBeenCalled();
    });

    test('deleteQuiz deletes quiz and unmarks checklist when 0 quizzes remain', async () => {
      const mockQuizId = new mongoose.Types.ObjectId().toString();
      const mockQuiz = {
        _id: new mongoose.Types.ObjectId(mockQuizId),
        courseOffering: mockOffering._id,
        faculty: mockOffering.faculty._id,
        deleteOne: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Quiz, 'findById').mockResolvedValue(mockQuiz);
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(courseFileService, 'deleteAssessmentFile').mockResolvedValue({ deleted: true });
      jest.spyOn(Quiz, 'countDocuments').mockResolvedValue(0);

      const mockChecklist = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        checklistItems: [{ type: 'ASSESS_QUIZ', completed: true }],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      const req = {
        params: { quizId: mockQuizId },
        user: mockUser,
      };
      const res = createMockRes();
      const next = jest.fn();

      await quizController.deleteQuiz(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(mockQuiz.deleteOne).toHaveBeenCalled();
      expect(mockChecklist.checklistItems[0].completed).toBe(false);
      expect(mockChecklist.save).toHaveBeenCalled();
    });
  });
});
