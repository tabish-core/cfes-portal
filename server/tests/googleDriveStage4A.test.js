/**
 * googleDriveStage4A.test.js — Automated test suite for Stage 4A: CCR Google Drive Synchronization.
 *
 * Verifies:
 *  1. PDF and DOCX format selection in generateAndSyncCCR
 *  2. Missing saved CCR form error handling (404)
 *  3. Unauthorized offering access rejection (403)
 *  4. Successful synchronization and checklist completion (type: 'CCR')
 *  5. Drive or document generation failure handling (500)
 *  6. Repeated synchronization updates canonical file (version increment) without duplicates
 *  7. Controller endpoint syncCCRDocument (POST /api/course-files/sync/ccr/:offeringId)
 *  8. Verification that ordinary CCR Word and PDF exports remain intact and functional
 */

const mongoose = require('mongoose');
const driveService = require('../services/drive.service');
const courseFileService = require('../services/courseFile.service');
const courseFileController = require('../controllers/courseFile.controller');
const courseOfferingService = require('../services/courseOffering.service');
const CourseFile = require('../models/CourseFile.model');
const CCR = require('../models/CCR.model');
const CourseChecklist = require('../models/CourseChecklist.model');
const ccrWordService = require('../services/documentService/generateCCRWord');
const ccrPdfService = require('../services/documentService/generateCCRPDF');
const formController = require('../controllers/form.controller');

describe('Stage 4A: CCR Google Drive Synchronization Suite', () => {
  const originalEnv = process.env;

  const mockOfferingId = new mongoose.Types.ObjectId().toString();
  const mockCourseId = new mongoose.Types.ObjectId().toString();
  const mockFacultyId = new mongoose.Types.ObjectId().toString();
  const mockSemesterId = new mongoose.Types.ObjectId().toString();

  const mockUser = {
    _id: new mongoose.Types.ObjectId(mockFacultyId),
    name: 'Dr. Jane Faculty',
    email: 'jane@iu.edu.pk',
    designation: 'faculty',
  };

  const mockOffering = {
    _id: new mongoose.Types.ObjectId(mockOfferingId),
    course: {
      _id: new mongoose.Types.ObjectId(mockCourseId),
      courseCode: 'CSC305',
      courseName: 'Operating Systems',
      department: new mongoose.Types.ObjectId(),
    },
    faculty: {
      _id: new mongoose.Types.ObjectId(mockFacultyId),
      name: 'Dr. Jane Faculty',
    },
    semester: {
      _id: new mongoose.Types.ObjectId(mockSemesterId),
      name: 'Fall 2026',
    },
    section: 'A',
  };

  const mockCCRDoc = {
    _id: new mongoose.Types.ObjectId(),
    courseOffering: mockOffering._id,
    course: mockOffering.course._id,
    faculty: mockOffering.faculty._id,
    semester: mockOffering.semester._id,
    section: 'A',
    formType: 'CCR',
    courseInfo: {
      facultyName: 'Dr. Jane Faculty',
      program: 'BSCS',
      courseTitle: 'Operating Systems',
      courseCode: 'CSC305',
      edpCode: '10293',
      sessionDay: 'Monday',
      timeSlot: '09:00 - 12:00',
      location: 'Lab 3',
    },
    weeklyData: [
      {
        weekNo: '1',
        scheduleDate: '2026-09-01',
        timeIn: '09:00',
        timeOut: '12:00',
        topicCovered: 'Introduction to OS',
        activityType: 'Lec',
        duration: '3',
        signature: 'JF',
        remarks: 'Completed',
        isSpecialRow: false,
      },
    ],
    alternateData: [],
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = 'test_jwt_secret_stage4a';
    process.env.GOOGLE_DRIVE_FOLDER_ID = '1kIzXquZB7ayOhTXtunMPwoCdVmx40Kez';
    jest.clearAllMocks();
    jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(null);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. PDF and DOCX format selection
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. PDF and DOCX Selection', () => {
    test('generateAndSyncCCR generates PDF buffer when format=pdf is requested', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CCR, 'findOne').mockResolvedValue(mockCCRDoc);

      const mockPdfBuffer = Buffer.from('mock_ccr_pdf_buffer');
      jest.spyOn(ccrPdfService, 'generateCCRPDF').mockResolvedValue(mockPdfBuffer);
      jest.spyOn(ccrWordService, 'generateCCRWord');

      const mockResult = { _id: 'file_id_pdf', documentType: 'CCR', fileFormat: 'pdf', version: 1 };
      jest.spyOn(courseFileService, 'syncOfferingDocument').mockResolvedValue(mockResult);

      const result = await courseFileService.generateAndSyncCCR({
        offeringId: mockOfferingId,
        fileFormat: 'pdf',
        user: mockUser,
      });

      expect(ccrPdfService.generateCCRPDF).toHaveBeenCalledTimes(1);
      expect(ccrWordService.generateCCRWord).not.toHaveBeenCalled();
      expect(courseFileService.syncOfferingDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          offeringId: mockOffering._id,
          documentType: 'CCR',
          fileFormat: 'pdf',
          instanceName: '',
          buffer: mockPdfBuffer,
          user: mockUser,
        })
      );
      expect(result).toBe(mockResult);
    });

    test('generateAndSyncCCR generates Word (.docx) buffer when format=docx is requested', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CCR, 'findOne').mockResolvedValue(mockCCRDoc);

      const mockDocxBuffer = Buffer.from('mock_ccr_docx_buffer');
      jest.spyOn(ccrWordService, 'generateCCRWord').mockResolvedValue(mockDocxBuffer);
      jest.spyOn(ccrPdfService, 'generateCCRPDF');

      const mockResult = { _id: 'file_id_docx', documentType: 'CCR', fileFormat: 'docx', version: 1 };
      jest.spyOn(courseFileService, 'syncOfferingDocument').mockResolvedValue(mockResult);

      const result = await courseFileService.generateAndSyncCCR({
        offeringId: mockOfferingId,
        fileFormat: 'docx',
        user: mockUser,
      });

      expect(ccrWordService.generateCCRWord).toHaveBeenCalledTimes(1);
      expect(ccrPdfService.generateCCRPDF).not.toHaveBeenCalled();
      expect(courseFileService.syncOfferingDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          offeringId: mockOffering._id,
          documentType: 'CCR',
          fileFormat: 'docx',
          instanceName: '',
          buffer: mockDocxBuffer,
          user: mockUser,
        })
      );
      expect(result).toBe(mockResult);
    });

    test('generateAndSyncCCR rejects invalid format with 400 Bad Request', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      await expect(
        courseFileService.generateAndSyncCCR({
          offeringId: mockOfferingId,
          fileFormat: 'xlsx',
          user: mockUser,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringMatching(/Invalid file format: 'xlsx'/),
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Missing saved CCR form
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Missing saved CCR form', () => {
    test('generateAndSyncCCR throws 404 when no CCR form is saved for offering', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CCR, 'findOne').mockResolvedValue(null);

      await expect(
        courseFileService.generateAndSyncCCR({
          offeringId: mockOfferingId,
          fileFormat: 'pdf',
          user: mockUser,
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringMatching(/Course Control Report \(CCR\) form has not been saved/),
      });
    });

    test('generateAndSyncCCR falls back to legacy matching if offering link is absent', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      // First call (by courseOffering) returns null; second call (legacy fallback) returns doc
      jest.spyOn(CCR, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockCCRDoc);

      const mockPdfBuffer = Buffer.from('mock_ccr_pdf_buffer');
      jest.spyOn(ccrPdfService, 'generateCCRPDF').mockResolvedValue(mockPdfBuffer);

      const mockResult = { _id: 'file_id_fallback', documentType: 'CCR', fileFormat: 'pdf' };
      jest.spyOn(courseFileService, 'syncOfferingDocument').mockResolvedValue(mockResult);

      const result = await courseFileService.generateAndSyncCCR({
        offeringId: mockOfferingId,
        fileFormat: 'pdf',
        user: mockUser,
      });

      expect(CCR.findOne).toHaveBeenCalledTimes(2);
      expect(result).toBe(mockResult);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Unauthorized offering access
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Unauthorized offering access', () => {
    test('generateAndSyncCCR rejects with 403 when requesting faculty does not own offering', async () => {
      const authError = new Error('You are not authorized to access this course offering.');
      authError.statusCode = 403;
      jest.spyOn(courseOfferingService, 'getOfferingById').mockRejectedValue(authError);
      jest.spyOn(CCR, 'findOne');

      await expect(
        courseFileService.generateAndSyncCCR({
          offeringId: mockOfferingId,
          fileFormat: 'pdf',
          user: { _id: 'unauthorized_faculty_id', designation: 'faculty' },
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You are not authorized to access this course offering.',
      });

      expect(CCR.findOne).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Successful synchronization and checklist completion
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Successful synchronization and checklist completion', () => {
    test('generateAndSyncCCR uploads document, persists CourseFile, and marks CCR checklist completed', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CCR, 'findOne').mockResolvedValue(mockCCRDoc);

      const mockBuffer = Buffer.from('ccr_pdf_binary');
      jest.spyOn(ccrPdfService, 'generateCCRPDF').mockResolvedValue(mockBuffer);

      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'drive_ccr_file_001',
        name: 'CCR_CSC305_SecA.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 4096,
        webViewLink: 'https://drive.google.com/file/d/drive_ccr_file_001/view',
        webContentLink: 'https://drive.google.com/uc?id=drive_ccr_file_001',
        isUpdated: false,
      });

      const mockSavedCourseFile = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'CCR',
        fileFormat: 'pdf',
        filename: 'CCR_CSC305_SecA.pdf',
        googleDriveFileId: 'drive_ccr_file_001',
        version: 1,
        isCanonical: true,
        instanceName: '',
        status: 'synced',
      };
      jest.spyOn(CourseFile, 'create').mockResolvedValue(mockSavedCourseFile);

      const mockChecklist = {
        courseOffering: mockOffering._id,
        checklistItems: [
          { name: 'Course Information Sheet', type: 'CIS', completed: false },
          { name: 'Course Control Report', type: 'CCR', completed: false },
        ],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      const result = await courseFileService.generateAndSyncCCR({
        offeringId: mockOfferingId,
        fileFormat: 'pdf',
        user: mockUser,
      });

      expect(driveService.uploadDocumentBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'CCR_CSC305_SecA.pdf',
          mimeType: 'application/pdf',
          existingFileId: null,
        })
      );
      expect(CourseFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          courseOffering: mockOffering._id,
          documentType: 'CCR',
          fileFormat: 'pdf',
          instanceName: '',
          isCanonical: true,
          version: 1,
        })
      );
      // Checklist item for CCR marked completed
      const ccrItem = mockChecklist.checklistItems.find((i) => i.type === 'CCR');
      expect(ccrItem.completed).toBe(true);
      expect(mockChecklist.save).toHaveBeenCalled();
      expect(result).toBe(mockSavedCourseFile);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Drive or document generation failure handling
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Drive or document generation failure handling', () => {
    test('wraps generator failures in 500 status with informative error message', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CCR, 'findOne').mockResolvedValue(mockCCRDoc);

      jest.spyOn(ccrPdfService, 'generateCCRPDF').mockRejectedValue(new Error('Puppeteer launch crashed'));

      await expect(
        courseFileService.generateAndSyncCCR({
          offeringId: mockOfferingId,
          fileFormat: 'pdf',
          user: mockUser,
        })
      ).rejects.toMatchObject({
        statusCode: 500,
        message: expect.stringMatching(/Failed to generate Course Control Report \(PDF\): Puppeteer launch crashed/),
      });
    });

    test('propagates Google Drive API upload errors cleanly', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CCR, 'findOne').mockResolvedValue(mockCCRDoc);
      jest.spyOn(ccrPdfService, 'generateCCRPDF').mockResolvedValue(Buffer.from('pdf_buffer'));
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);

      const driveErr = new Error('Google Drive quota exceeded');
      driveErr.statusCode = 507;
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockRejectedValue(driveErr);

      await expect(
        courseFileService.generateAndSyncCCR({
          offeringId: mockOfferingId,
          fileFormat: 'pdf',
          user: mockUser,
        })
      ).rejects.toMatchObject({
        message: 'Google Drive quota exceeded',
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Repeated synchronization updates canonical file (version increment)
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Repeated synchronization updates canonical file without duplicates', () => {
    test('second synchronization updates existing Google Drive file in place and increments version to 2', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CCR, 'findOne').mockResolvedValue(mockCCRDoc);

      const mockBuffer = Buffer.from('ccr_v2_updated_pdf');
      jest.spyOn(ccrPdfService, 'generateCCRPDF').mockResolvedValue(mockBuffer);

      // Existing CourseFile record found
      const existingRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'CCR',
        fileFormat: 'pdf',
        instanceName: '',
        googleDriveFileId: 'drive_existing_ccr_file_77',
        version: 1,
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(existingRecord);
      jest.spyOn(CourseFile, 'create');

      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'drive_existing_ccr_file_77',
        name: 'CCR_CSC305_SecA.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 8192,
        webViewLink: 'https://drive.google.com/file/d/drive_existing_ccr_file_77/view',
        webContentLink: 'https://drive.google.com/uc?id=drive_existing_ccr_file_77',
        isUpdated: true,
      });

      const result = await courseFileService.generateAndSyncCCR({
        offeringId: mockOfferingId,
        fileFormat: 'pdf',
        user: mockUser,
      });

      // Existing Google Drive ID was passed to update
      expect(driveService.uploadDocumentBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          existingFileId: 'drive_existing_ccr_file_77',
        })
      );
      // CourseFile.create was NOT called (no duplicate record)
      expect(CourseFile.create).not.toHaveBeenCalled();
      // Record version incremented to 2
      expect(existingRecord.version).toBe(2);
      expect(existingRecord.save).toHaveBeenCalled();
      expect(result.version).toBe(2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Controller Endpoint Handler
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Controller Endpoint: syncCCRDocument', () => {
    test('syncCCRDocument returns 200 with formatted success response', async () => {
      const mockResult = {
        _id: 'cf_id_123',
        documentType: 'CCR',
        fileFormat: 'pdf',
        googleDriveWebViewLink: 'https://drive.google.com/file/d/ccr123/view',
        version: 1,
      };
      jest.spyOn(courseFileService, 'generateAndSyncCCR').mockResolvedValue(mockResult);

      const req = {
        params: { offeringId: mockOfferingId },
        query: { format: 'pdf' },
        user: mockUser,
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await courseFileController.syncCCRDocument(req, res, next);

      expect(courseFileService.generateAndSyncCCR).toHaveBeenCalledWith({
        offeringId: mockOfferingId,
        fileFormat: 'pdf',
        user: mockUser,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
        message: 'Course Control Report (PDF) synchronized to Google Drive successfully.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('syncCCRDocument forwards service errors to next() middleware', async () => {
      const error = new Error('Sync failed');
      jest.spyOn(courseFileService, 'generateAndSyncCCR').mockRejectedValue(error);

      const req = {
        params: { offeringId: mockOfferingId },
        query: {},
        user: mockUser,
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await courseFileController.syncCCRDocument(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Ordinary CCR Export Preservation
  // ───────────────────────────────────────────────────────────────────────────
  describe('8. Ordinary CCR Word & PDF Export Preservation', () => {
    test('exportCCRForm generates and streams DOCX attachment without touching Drive', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CCR, 'findOne').mockResolvedValue(mockCCRDoc);
      jest.spyOn(driveService, 'uploadDocumentBuffer');

      const req = {
        params: { courseId: mockCourseId },
        query: { format: 'docx', offeringId: mockOfferingId },
        user: mockUser,
      };
      const res = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };
      const next = jest.fn();

      await formController.exportCCRForm(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringMatching(/attachment; filename=CCR_CSC305\.docx/)
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(res.send).toHaveBeenCalled();
      expect(Buffer.isBuffer(res.send.mock.calls[0][0])).toBe(true);
      expect(driveService.uploadDocumentBuffer).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test('exportCCRForm generates and streams PDF attachment without touching Drive', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CCR, 'findOne').mockResolvedValue(mockCCRDoc);
      jest.spyOn(driveService, 'uploadDocumentBuffer');

      const req = {
        params: { courseId: mockCourseId },
        query: { format: 'pdf', offeringId: mockOfferingId },
        user: mockUser,
      };
      const res = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };
      const next = jest.fn();

      await formController.exportCCRForm(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringMatching(/attachment; filename=CCR_CSC305\.pdf/)
      );
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.send).toHaveBeenCalled();
      expect(Buffer.isBuffer(res.send.mock.calls[0][0])).toBe(true);
      expect(driveService.uploadDocumentBuffer).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    }, 15000);
  });
});
