/**
 * googleDriveStage4B.test.js — Automated test suite for Stage 4B: Timetable with Consulting Hours Google Drive Synchronization.
 *
 * Verifies:
 *  1. PDF and DOCX format selection in generateAndSyncTimetable
 *  2. Unsupported format rejection with 400 Bad Request
 *  3. Missing saved Timetable error handling (404 Not Found)
 *  4. Unauthorized offering access rejection (403 Forbidden)
 *  5. Correct faculty and semester lookup strictly avoiding courseOffering query
 *  6. Successful synchronization and checklist completion (type: 'TIMETABLE')
 *  7. Document generation failure (500) and Drive upload failure handling
 *  8. Repeated synchronization updates canonical file (version increment) without duplicates
 *  9. Controller endpoint syncTimetableDocument (POST /api/course-files/sync/timetable/:offeringId)
 *  10. Verification that ordinary Timetable Word and PDF exports remain intact and functional
 */

const mongoose = require('mongoose');
const driveService = require('../services/drive.service');
const courseFileService = require('../services/courseFile.service');
const courseFileController = require('../controllers/courseFile.controller');
const courseOfferingService = require('../services/courseOffering.service');
const CourseFile = require('../models/CourseFile.model');
const { Timetable } = require('../models/Timetable.model');
const CourseChecklist = require('../models/CourseChecklist.model');
const timetableWordService = require('../services/documentService/generateTimetableWord');
const timetablePdfService = require('../services/documentService/generateTimetablePDF');
const timetableController = require('../controllers/timetable.controller');
const timetableService = require('../services/timetable.service');

describe('Stage 4B: Timetable Google Drive Synchronization Suite', () => {
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

  const mockTimetableDoc = {
    _id: new mongoose.Types.ObjectId(),
    faculty: mockOffering.faculty._id,
    semester: mockOffering.semester._id,
    facultyInfo: {
      facultyName: 'Dr. Jane Faculty',
      designation: 'Assistant Professor',
      department: 'Department of Computer Science',
      facultySchool: 'Faculty of Engineering Sciences and Technology',
      academicTerm: 'Fall 2026',
    },
    timeSlots: [
      { slotId: 'slot1', startTime: '08:30', endTime: '10:00', label: 'Slot 1', order: 1 },
      { slotId: 'slot2', startTime: '10:00', endTime: '11:30', label: 'Slot 2', order: 2 },
    ],
    days: [
      { day: 'Monday', isOffDay: false },
      { day: 'Tuesday', isOffDay: false },
    ],
    activities: [
      {
        id: 'act1',
        day: 'Monday',
        startSlotId: 'slot1',
        endSlotId: 'slot1',
        activityType: 'Class / Course',
        title: 'Operating Systems',
        venue: 'Lab 3',
      },
      {
        id: 'act2',
        day: 'Tuesday',
        startSlotId: 'slot2',
        endSlotId: 'slot2',
        activityType: 'Counseling / Consulting Hours',
        title: 'Office Consulting',
        venue: 'Faculty Office 204',
      },
    ],
    consultingHours: [
      {
        day: 'Tuesday',
        startTime: '10:00',
        endTime: '11:30',
        venue: 'Faculty Office 204',
      },
    ],
    status: 'draft',
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = 'test_jwt_secret_stage4b';
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
    test('generateAndSyncTimetable generates PDF buffer when format=pdf is requested', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Timetable, 'findOne').mockResolvedValue(mockTimetableDoc);

      const mockPdfBuffer = Buffer.from('mock_timetable_pdf_buffer');
      jest.spyOn(timetablePdfService, 'generateTimetablePDF').mockResolvedValue(mockPdfBuffer);
      jest.spyOn(timetableWordService, 'generateTimetableWord');

      const mockResult = {
        _id: 'file_id_pdf',
        documentType: 'TIMETABLE',
        fileFormat: 'pdf',
        version: 1,
      };
      jest.spyOn(courseFileService, 'syncOfferingDocument').mockResolvedValue(mockResult);

      const result = await courseFileService.generateAndSyncTimetable({
        offeringId: mockOfferingId,
        fileFormat: 'pdf',
        user: mockUser,
      });

      expect(timetablePdfService.generateTimetablePDF).toHaveBeenCalledTimes(1);
      expect(timetablePdfService.generateTimetablePDF).toHaveBeenCalledWith(mockTimetableDoc);
      expect(timetableWordService.generateTimetableWord).not.toHaveBeenCalled();
      expect(courseFileService.syncOfferingDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          offeringId: mockOffering._id,
          documentType: 'TIMETABLE',
          fileFormat: 'pdf',
          instanceName: '',
          buffer: mockPdfBuffer,
          user: mockUser,
        })
      );
      expect(result).toBe(mockResult);
    });

    test('generateAndSyncTimetable generates DOCX buffer when format=docx is requested', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Timetable, 'findOne').mockResolvedValue(mockTimetableDoc);

      const mockDocxBuffer = Buffer.from('mock_timetable_docx_buffer');
      jest.spyOn(timetableWordService, 'generateTimetableWord').mockResolvedValue(mockDocxBuffer);
      jest.spyOn(timetablePdfService, 'generateTimetablePDF');

      const mockResult = {
        _id: 'file_id_docx',
        documentType: 'TIMETABLE',
        fileFormat: 'docx',
        version: 1,
      };
      jest.spyOn(courseFileService, 'syncOfferingDocument').mockResolvedValue(mockResult);

      const result = await courseFileService.generateAndSyncTimetable({
        offeringId: mockOfferingId,
        fileFormat: 'docx',
        user: mockUser,
      });

      expect(timetableWordService.generateTimetableWord).toHaveBeenCalledTimes(1);
      expect(timetableWordService.generateTimetableWord).toHaveBeenCalledWith(mockTimetableDoc);
      expect(timetablePdfService.generateTimetablePDF).not.toHaveBeenCalled();
      expect(courseFileService.syncOfferingDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          offeringId: mockOffering._id,
          documentType: 'TIMETABLE',
          fileFormat: 'docx',
          instanceName: '',
          buffer: mockDocxBuffer,
          user: mockUser,
        })
      );
      expect(result).toBe(mockResult);
    });

    test('generateAndSyncTimetable rejects invalid format with 400 Bad Request', async () => {
      await expect(
        courseFileService.generateAndSyncTimetable({
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
  // 2. Missing saved Timetable
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Missing saved Timetable', () => {
    test('generateAndSyncTimetable throws 404 when no timetable has been saved for faculty and semester', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Timetable, 'findOne').mockResolvedValue(null);

      await expect(
        courseFileService.generateAndSyncTimetable({
          offeringId: mockOfferingId,
          fileFormat: 'pdf',
          user: mockUser,
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringMatching(
          /Class Schedule and Counseling Hours \(Timetable\) has not been saved/
        ),
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Unauthorized offering access
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Unauthorized offering access', () => {
    test('generateAndSyncTimetable rejects with 403 when requesting faculty does not own offering', async () => {
      const authError = new Error('You are not authorized to access this course offering.');
      authError.statusCode = 403;
      jest.spyOn(courseOfferingService, 'getOfferingById').mockRejectedValue(authError);
      jest.spyOn(Timetable, 'findOne');

      await expect(
        courseFileService.generateAndSyncTimetable({
          offeringId: mockOfferingId,
          fileFormat: 'pdf',
          user: mockUser,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You are not authorized to access this course offering.',
      });

      expect(Timetable.findOne).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Correct Faculty/Semester Scoping (No courseOffering query)
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Faculty & Semester Scoping (No courseOffering lookup)', () => {
    test('Timetable lookup strictly queries { faculty, semester } and never queries by courseOffering', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      const findOneSpy = jest.spyOn(Timetable, 'findOne').mockResolvedValue(mockTimetableDoc);

      jest.spyOn(timetablePdfService, 'generateTimetablePDF').mockResolvedValue(Buffer.from('pdf'));
      jest.spyOn(courseFileService, 'syncOfferingDocument').mockResolvedValue({ status: 'synced' });

      await courseFileService.generateAndSyncTimetable({
        offeringId: mockOfferingId,
        fileFormat: 'pdf',
        user: mockUser,
      });

      expect(findOneSpy).toHaveBeenCalledTimes(1);
      const queryArg = findOneSpy.mock.calls[0][0];

      // Verifies exact query parameters
      expect(queryArg).toEqual({
        faculty: mockOffering.faculty._id,
        semester: mockOffering.semester._id,
      });

      // Confirms courseOffering is NOT in query
      expect(queryArg).not.toHaveProperty('courseOffering');
      expect(queryArg).not.toHaveProperty('course');
      expect(queryArg).not.toHaveProperty('section');
    });

    test('Timetable query populates semester, uses lean, and passes plain object data to PDF generator', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      // Create a chained query mock returning a Mongoose Document instance
      const realDoc = new Timetable({
        faculty: mockOffering.faculty._id,
        semester: mockOffering.semester._id,
        facultyInfo: mockTimetableDoc.facultyInfo,
        timeSlots: mockTimetableDoc.timeSlots,
        days: mockTimetableDoc.days,
        activities: mockTimetableDoc.activities,
        consultingHours: mockTimetableDoc.consultingHours,
      });

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(realDoc),
      };
      jest.spyOn(Timetable, 'findOne').mockReturnValue(mockQuery);

      let passedTimetable = null;
      jest.spyOn(timetablePdfService, 'generateTimetablePDF').mockImplementation(async (data) => {
        passedTimetable = data;
        return Buffer.from('pdf');
      });
      jest.spyOn(courseFileService, 'syncOfferingDocument').mockResolvedValue({ status: 'synced' });

      await courseFileService.generateAndSyncTimetable({
        offeringId: mockOfferingId,
        fileFormat: 'pdf',
        user: mockUser,
      });

      expect(mockQuery.populate).toHaveBeenCalledWith('semester', 'name status');
      expect(mockQuery.lean).toHaveBeenCalled();
      expect(passedTimetable).toBeDefined();
      // Confirm that the timetable passed to the generator is converted to a plain object
      expect(passedTimetable instanceof mongoose.Document).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(passedTimetable.timeSlots[0], 'startTime')).toBe(true);
      expect(passedTimetable.timeSlots[0].startTime).toBe('08:30');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Successful synchronization and checklist completion
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Synchronization & Checklist Completion', () => {
    test('marks checklist item TIMETABLE completed upon successful synchronization', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Timetable, 'findOne').mockResolvedValue(mockTimetableDoc);
      jest.spyOn(timetablePdfService, 'generateTimetablePDF').mockResolvedValue(Buffer.from('timetable_pdf'));

      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);
      const mockCreatedRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'TIMETABLE',
        fileFormat: 'pdf',
        filename: 'TIMETABLE_CSC305_SecA.pdf',
        googleDriveFileId: 'drive_file_id_timetable_99',
        googleDriveWebViewLink: 'https://drive.google.com/file/d/drive_file_id_timetable_99/view',
        version: 1,
        status: 'synced',
      };
      jest.spyOn(CourseFile, 'create').mockResolvedValue(mockCreatedRecord);

      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'drive_file_id_timetable_99',
        name: 'TIMETABLE_CSC305_SecA.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 4096,
        webViewLink: 'https://drive.google.com/file/d/drive_file_id_timetable_99/view',
        webContentLink: 'https://drive.google.com/uc?id=drive_file_id_timetable_99',
      });

      const mockChecklistDoc = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        checklistItems: [
          { type: 'CIS', completed: false },
          { type: 'CCR', completed: false },
          { type: 'TIMETABLE', completed: false },
        ],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklistDoc);

      const result = await courseFileService.generateAndSyncTimetable({
        offeringId: mockOfferingId,
        fileFormat: 'pdf',
        user: mockUser,
      });

      expect(result.status).toBe('synced');
      expect(result.documentType).toBe('TIMETABLE');

      // Verify that TIMETABLE item is marked completed
      const timetableItem = mockChecklistDoc.checklistItems.find((i) => i.type === 'TIMETABLE');
      expect(timetableItem.completed).toBe(true);
      expect(mockChecklistDoc.save).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Generation or Drive Failure Handling
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Generator & Drive Failure Handling', () => {
    test('catches generator errors, wraps with 500 status and descriptive message', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Timetable, 'findOne').mockResolvedValue(mockTimetableDoc);

      jest.spyOn(timetablePdfService, 'generateTimetablePDF').mockRejectedValue(
        new Error('Chromium process died unexpectedly')
      );

      await expect(
        courseFileService.generateAndSyncTimetable({
          offeringId: mockOfferingId,
          fileFormat: 'pdf',
          user: mockUser,
        })
      ).rejects.toMatchObject({
        statusCode: 500,
        message: expect.stringMatching(
          /Failed to generate Timetable \(PDF\): Chromium process died unexpectedly/
        ),
      });
    });

    test('propagates Google Drive API upload errors cleanly without false checklist completion', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Timetable, 'findOne').mockResolvedValue(mockTimetableDoc);
      jest.spyOn(timetablePdfService, 'generateTimetablePDF').mockResolvedValue(Buffer.from('pdf_buffer'));
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);

      const driveErr = new Error('Google Drive quota exceeded');
      driveErr.statusCode = 507;
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockRejectedValue(driveErr);

      const mockChecklistDoc = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        checklistItems: [{ type: 'TIMETABLE', completed: false }],
        save: jest.fn(),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklistDoc);

      await expect(
        courseFileService.generateAndSyncTimetable({
          offeringId: mockOfferingId,
          fileFormat: 'pdf',
          user: mockUser,
        })
      ).rejects.toMatchObject({
        message: 'Google Drive quota exceeded',
      });

      // Checklist must NOT be marked completed
      expect(mockChecklistDoc.checklistItems[0].completed).toBe(false);
      expect(mockChecklistDoc.save).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Repeated synchronization updates canonical file (version increment)
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Repeated synchronization updates canonical file without duplicates', () => {
    test('second synchronization updates existing Drive file in place and increments version to 2', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(Timetable, 'findOne').mockResolvedValue(mockTimetableDoc);

      const mockBuffer = Buffer.from('timetable_v2_updated_pdf');
      jest.spyOn(timetablePdfService, 'generateTimetablePDF').mockResolvedValue(mockBuffer);

      // Existing CourseFile record found
      const existingRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'TIMETABLE',
        fileFormat: 'pdf',
        instanceName: '',
        googleDriveFileId: 'drive_existing_timetable_file_101',
        version: 1,
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(existingRecord);
      jest.spyOn(CourseFile, 'create');

      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'drive_existing_timetable_file_101',
        name: 'TIMETABLE_CSC305_SecA.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 9012,
        webViewLink: 'https://drive.google.com/file/d/drive_existing_timetable_file_101/view',
        webContentLink: 'https://drive.google.com/uc?id=drive_existing_timetable_file_101',
        isUpdated: true,
      });

      const result = await courseFileService.generateAndSyncTimetable({
        offeringId: mockOfferingId,
        fileFormat: 'pdf',
        user: mockUser,
      });

      // Existing Google Drive ID was passed to update in place
      expect(driveService.uploadDocumentBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          existingFileId: 'drive_existing_timetable_file_101',
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
  // 8. Controller Endpoint: syncTimetableDocument
  // ───────────────────────────────────────────────────────────────────────────
  describe('8. Controller Endpoint: syncTimetableDocument', () => {
    test('syncTimetableDocument returns 200 with formatted success response', async () => {
      const mockResult = {
        _id: 'cf_id_tt_123',
        documentType: 'TIMETABLE',
        fileFormat: 'pdf',
        googleDriveWebViewLink: 'https://drive.google.com/file/d/tt123/view',
        version: 1,
      };
      jest.spyOn(courseFileService, 'generateAndSyncTimetable').mockResolvedValue(mockResult);

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

      await courseFileController.syncTimetableDocument(req, res, next);

      expect(courseFileService.generateAndSyncTimetable).toHaveBeenCalledWith({
        offeringId: mockOfferingId,
        fileFormat: 'pdf',
        user: mockUser,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
        message: 'Timetable and Consulting Hours (PDF) synchronized to Google Drive successfully.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('syncTimetableDocument forwards errors to next() middleware', async () => {
      const err = new Error('Timetable not found');
      err.statusCode = 404;
      jest.spyOn(courseFileService, 'generateAndSyncTimetable').mockRejectedValue(err);

      const req = {
        params: { offeringId: mockOfferingId },
        query: {},
        user: mockUser,
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await courseFileController.syncTimetableDocument(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Ordinary Timetable Word & PDF Export Preservation
  // ───────────────────────────────────────────────────────────────────────────
  describe('9. Ordinary Timetable Word & PDF Export Preservation', () => {
    test('exportTimetable generates and streams DOCX attachment without touching Drive', async () => {
      jest.spyOn(timetableService, 'getTimetableForExport').mockResolvedValue(mockTimetableDoc);
      jest.spyOn(driveService, 'uploadDocumentBuffer');

      const req = {
        params: { courseId: mockCourseId },
        query: { format: 'docx', semester: mockSemesterId },
        user: mockUser,
      };
      const res = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };
      const next = jest.fn();

      await timetableController.exportTimetable(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringMatching(/attachment; filename=Timetable_Dr\._Jane_Faculty\.docx/)
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

    test('exportTimetable generates and streams PDF attachment without touching Drive', async () => {
      jest.spyOn(timetableService, 'getTimetableForExport').mockResolvedValue(mockTimetableDoc);
      jest.spyOn(driveService, 'uploadDocumentBuffer');

      const req = {
        params: { courseId: mockCourseId },
        query: { format: 'pdf', semester: mockSemesterId },
        user: mockUser,
      };
      const res = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };
      const next = jest.fn();

      await timetableController.exportTimetable(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringMatching(/attachment; filename=Timetable_Dr\._Jane_Faculty\.pdf/)
      );
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.send).toHaveBeenCalled();
      expect(Buffer.isBuffer(res.send.mock.calls[0][0])).toBe(true);
      expect(driveService.uploadDocumentBuffer).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    }, 15000);
  });
});
