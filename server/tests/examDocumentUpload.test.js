/**
 * examDocumentUpload.test.js — Backend test suite for Midterm and Final Exam Document Upload Feature.
 *
 * Verifies:
 *  1. All 8 Document Categories:
 *     - Midterm: MIDTERM_EXAM_PAPER, MIDTERM_BEST_COPY, MIDTERM_AVERAGE_COPY, MIDTERM_WORST_COPY
 *     - Final:   FINAL_EXAM_PAPER, FINAL_BEST_COPY, FINAL_AVERAGE_COPY, FINAL_WORST_COPY
 *  2. Supported File Formats (.pdf, .doc, .docx):
 *     - Successfully uploads PDF, DOC, and DOCX without conversion
 *  3. File Format & Size Validation:
 *     - Rejects unsupported extensions (.txt, .png, .xlsx) with 400 Bad Request
 *     - Rejects unsupported MIME types with 400 Bad Request
 *     - Enforces 25 MB maximum file size limit
 *     - Rejects missing buffer or empty file
 *  4. CourseOffering Authorization:
 *     - 400 when offeringId is missing
 *     - 403 when user is not authorized for the offering
 *  5. Offering-Specific Google Drive Folder Organization:
 *     - Midterm routes to `${courseCode}_Sec${section}_Midterm`
 *     - Final routes to `${courseCode}_Sec${section}_Final`
 *     - Midterm and Final documents never cross-route or overwrite each other
 *  6. Upload and Replacement Functionality:
 *     - Fresh upload creates canonical CourseFile (version 1)
 *     - Replacement passes existingFileId to driveService and increments version without duplicates
 *  7. Recovery When Existing Drive File is Deleted (404 recovery):
 *     - Handles Drive re-creation and updates existing CourseFile record with new file ID
 *  8. Independent Checklist Completion Tracking:
 *     - 0/4 uploaded -> completed: false (Not Started)
 *     - 1-3/4 uploaded -> completed: false (In Progress)
 *     - 4/4 uploaded -> completed: true (Completed)
 *     - Midterm 4/4 does not mark Final complete, and vice versa
 *     - Deleting an exam file recalculates checklist completion
 *  9. Safe Failure Handling & Concurrency:
 *     - Google Drive upload failure throws 500 and prevents CourseFile creation
 *     - Metadata persistence failure deletes orphaned Google Drive file
 *     - Concurrent upload collision (E11000) reconciles cleanly
 *  10. Controller Endpoints:
 *      - POST /api/course-files/upload/exam/:offeringId returns 200 with result
 *      - POST /api/course-files/upload/:offeringId with exam documentType routes correctly
 */

const mongoose = require('mongoose');
const driveService = require('../services/drive.service');
const courseFileService = require('../services/courseFile.service');
const courseFileController = require('../controllers/courseFile.controller');
const courseOfferingService = require('../services/courseOffering.service');
const CourseFile = require('../models/CourseFile.model');
const CourseChecklist = require('../models/CourseChecklist.model');

describe('Midterm & Final Exam Document Upload Feature Test Suite', () => {
  const originalEnv = process.env;

  const mockOfferingId = new mongoose.Types.ObjectId().toString();
  const mockCourseId = new mongoose.Types.ObjectId().toString();
  const mockFacultyId = new mongoose.Types.ObjectId().toString();
  const mockSemesterId = new mongoose.Types.ObjectId().toString();

  const mockUser = {
    _id: new mongoose.Types.ObjectId(mockFacultyId),
    name: 'Dr. Jane Smith',
    email: 'janesmith@iu.edu.pk',
    designation: 'faculty',
  };

  const mockOffering = {
    _id: new mongoose.Types.ObjectId(mockOfferingId),
    course: {
      _id: new mongoose.Types.ObjectId(mockCourseId),
      courseCode: 'CS402',
      courseName: 'Operating Systems',
    },
    faculty: {
      _id: new mongoose.Types.ObjectId(mockFacultyId),
      name: 'Dr. Jane Smith',
    },
    semester: {
      _id: new mongoose.Types.ObjectId(mockSemesterId),
      name: 'Spring 2026',
    },
    section: 'B',
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
    jest.spyOn(CourseFile, 'distinct').mockResolvedValue([]);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. All Eight Document Categories & Supported Formats
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. All Eight Document Categories & Supported Formats', () => {
    const allEightCategories = [
      // Midterm
      { type: 'MIDTERM_EXAM_PAPER', isMidterm: true },
      { type: 'MIDTERM_BEST_COPY', isMidterm: true },
      { type: 'MIDTERM_AVERAGE_COPY', isMidterm: true },
      { type: 'MIDTERM_WORST_COPY', isMidterm: true },
      // Final
      { type: 'FINAL_EXAM_PAPER', isMidterm: false },
      { type: 'FINAL_BEST_COPY', isMidterm: false },
      { type: 'FINAL_AVERAGE_COPY', isMidterm: false },
      { type: 'FINAL_WORST_COPY', isMidterm: false },
    ];

    allEightCategories.forEach(({ type, isMidterm }) => {
      test(`successfully uploads document category: ${type}`, async () => {
        jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
        jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue(isMidterm ? 'midterm_fld' : 'final_fld');
        jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);
        jest.spyOn(CourseFile, 'distinct').mockResolvedValue([type]);

        const uploadResult = {
          fileId: `drive_${type.toLowerCase()}_id`,
          name: `${type}_Sample.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 1500,
          webViewLink: `https://drive.google.com/file/d/drive_${type.toLowerCase()}_id/view`,
          webContentLink: `https://drive.google.com/file/d/drive_${type.toLowerCase()}_id/download`,
        };
        jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(uploadResult);

        const mockCreated = {
          _id: new mongoose.Types.ObjectId(),
          courseOffering: mockOffering._id,
          documentType: type,
          fileFormat: 'pdf',
          filename: uploadResult.name,
          googleDriveFileId: uploadResult.fileId,
          version: 1,
          isCanonical: true,
          status: 'synced',
        };
        jest.spyOn(CourseFile, 'create').mockResolvedValue(mockCreated);
        jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(null);

        const mockFile = {
          originalname: `${type}_Sample.pdf`,
          mimetype: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 mock exam file content'),
          size: 1500,
        };

        const result = await courseFileService.uploadExamDocument({
          offeringId: mockOfferingId,
          documentType: type,
          file: mockFile,
          user: mockUser,
        });

        expect(result).toBeDefined();
        expect(result.documentType).toBe(type);
        expect(result.version).toBe(1);
        expect(result.isCanonical).toBe(true);
        expect(driveService.uploadDocumentBuffer).toHaveBeenCalledWith(
          expect.objectContaining({
            filename: `${type}_Sample.pdf`,
            mimeType: 'application/pdf',
            folderId: isMidterm ? 'midterm_fld' : 'final_fld',
            existingFileId: null,
          })
        );
      });
    });

    test('accepts Microsoft Word (.docx) format without conversion', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('midterm_fld');
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);
      jest.spyOn(CourseFile, 'distinct').mockResolvedValue(['MIDTERM_EXAM_PAPER']);

      const uploadResult = {
        fileId: 'drive_docx_123',
        name: 'Midterm_Question_Paper.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 8192,
        webViewLink: 'https://drive.google.com/file/d/drive_docx_123/view',
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(uploadResult);

      const mockCreated = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'MIDTERM_EXAM_PAPER',
        fileFormat: 'docx',
        filename: uploadResult.name,
        googleDriveFileId: uploadResult.fileId,
        version: 1,
      };
      jest.spyOn(CourseFile, 'create').mockResolvedValue(mockCreated);
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(null);

      const mockFile = {
        originalname: 'Midterm_Question_Paper.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from('PK mock docx zip binary stream'),
        size: 8192,
      };

      const result = await courseFileService.uploadExamDocument({
        offeringId: mockOfferingId,
        documentType: 'MIDTERM_EXAM_PAPER',
        file: mockFile,
        user: mockUser,
      });

      expect(result.fileFormat).toBe('docx');
      expect(driveService.uploadDocumentBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'Midterm_Question_Paper.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      );
    });

    test('accepts legacy Microsoft Word (.doc) format', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('final_fld');
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);
      jest.spyOn(CourseFile, 'distinct').mockResolvedValue(['FINAL_BEST_COPY']);

      const uploadResult = {
        fileId: 'drive_doc_456',
        name: 'Final_Best_Student_Copy.doc',
        mimeType: 'application/msword',
        sizeBytes: 5000,
        webViewLink: 'https://drive.google.com/file/d/drive_doc_456/view',
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(uploadResult);

      const mockCreated = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'FINAL_BEST_COPY',
        fileFormat: 'doc',
        filename: uploadResult.name,
        googleDriveFileId: uploadResult.fileId,
        version: 1,
      };
      jest.spyOn(CourseFile, 'create').mockResolvedValue(mockCreated);
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(null);

      const mockFile = {
        originalname: 'Final_Best_Student_Copy.doc',
        mimetype: 'application/msword',
        buffer: Buffer.from('mock doc binary stream'),
        size: 5000,
      };

      const result = await courseFileService.uploadExamDocument({
        offeringId: mockOfferingId,
        documentType: 'FINAL_BEST_COPY',
        file: mockFile,
        user: mockUser,
      });

      expect(result.fileFormat).toBe('doc');
      expect(driveService.uploadDocumentBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'Final_Best_Student_Copy.doc',
          mimeType: 'application/msword',
        })
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Validation & Format Rejection
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Validation & Format Rejection', () => {
    test('rejects unsupported file extension (.txt) with 400 Bad Request', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const mockFile = {
        originalname: 'notes.txt',
        mimetype: 'text/plain',
        buffer: Buffer.from('plain text content'),
        size: 100,
      };

      await expect(
        courseFileService.uploadExamDocument({
          offeringId: mockOfferingId,
          documentType: 'MIDTERM_EXAM_PAPER',
          file: mockFile,
          user: mockUser,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("Unsupported file format: '.txt'"),
      });
    });

    test('rejects image files (.png) with 400 Bad Request', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const mockFile = {
        originalname: 'screenshot.png',
        mimetype: 'image/png',
        buffer: Buffer.from('\x89PNG\r\n\x1a\n mock png'),
        size: 1024,
      };

      await expect(
        courseFileService.uploadExamDocument({
          offeringId: mockOfferingId,
          documentType: 'MIDTERM_BEST_COPY',
          file: mockFile,
          user: mockUser,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("Unsupported file format: '.png'"),
      });
    });

    test('rejects invalid MIME type with 400 Bad Request even if extension is spoofed', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const mockFile = {
        originalname: 'exam.pdf',
        mimetype: 'text/html', // Spoofed extension but HTML mime type
        buffer: Buffer.from('<html>spoofed</html>'),
        size: 200,
      };

      await expect(
        courseFileService.uploadExamDocument({
          offeringId: mockOfferingId,
          documentType: 'MIDTERM_EXAM_PAPER',
          file: mockFile,
          user: mockUser,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("Invalid MIME type: 'text/html'"),
      });
    });

    test('rejects files larger than 25 MB with 400 Bad Request', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const mockFile = {
        originalname: 'huge_exam_file.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.alloc(10), // Small buffer for test memory
        size: 26 * 1024 * 1024, // 26 MB reported size
      };

      await expect(
        courseFileService.uploadExamDocument({
          offeringId: mockOfferingId,
          documentType: 'MIDTERM_EXAM_PAPER',
          file: mockFile,
          user: mockUser,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('exceeds the maximum allowed size of 25 MB'),
      });
    });

    test('rejects invalid or non-exam documentType with 400 Bad Request', async () => {
      const mockFile = {
        originalname: 'doc.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 test'),
        size: 500,
      };

      await expect(
        courseFileService.uploadExamDocument({
          offeringId: mockOfferingId,
          documentType: 'INVALID_EXAM_TYPE',
          file: mockFile,
          user: mockUser,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("Invalid exam document type: 'INVALID_EXAM_TYPE'"),
      });
    });

    test('rejects missing file buffer with 400 Bad Request', async () => {
      await expect(
        courseFileService.uploadExamDocument({
          offeringId: mockOfferingId,
          documentType: 'MIDTERM_EXAM_PAPER',
          file: null,
          user: mockUser,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('A valid file Buffer is required'),
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. CourseOffering Authorization
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. CourseOffering Authorization', () => {
    test('throws 403 Forbidden when faculty does not have access to the offering', async () => {
      const authError = new Error('Access denied. You do not have permission to view or modify this course offering.');
      authError.statusCode = 403;
      jest.spyOn(courseOfferingService, 'getOfferingById').mockRejectedValue(authError);

      const mockFile = {
        originalname: 'Midterm_Paper.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 test'),
        size: 500,
      };

      await expect(
        courseFileService.uploadExamDocument({
          offeringId: mockOfferingId,
          documentType: 'MIDTERM_EXAM_PAPER',
          file: mockFile,
          user: mockUser,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('Access denied'),
      });
    });

    test('throws 400 Bad Request when offeringId is missing', async () => {
      const mockFile = {
        originalname: 'Midterm_Paper.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 test'),
        size: 500,
      };

      await expect(
        courseFileService.uploadExamDocument({
          offeringId: '',
          documentType: 'MIDTERM_EXAM_PAPER',
          file: mockFile,
          user: mockUser,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Course offering ID is required'),
      });
    });

    test('allows HOD to upload documents for an offering within their department scope', async () => {
      const deptId = new mongoose.Types.ObjectId();
      const mockHodUser = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Dr. HOD Computer Science',
        designation: 'hod',
        department: deptId,
      };

      const hodOffering = {
        ...mockOffering,
        course: {
          ...mockOffering.course,
          department: deptId,
        },
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(hodOffering);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('midterm_fld');
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);

      const uploadResult = {
        fileId: 'hod_drive_upload_1',
        name: 'Midterm_Paper_HOD.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1500,
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(uploadResult);
      jest.spyOn(CourseFile, 'create').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        ...uploadResult,
        documentType: 'MIDTERM_EXAM_PAPER',
        isCanonical: true,
      });

      const mockFile = {
        originalname: 'Midterm_Paper_HOD.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 test'),
        size: 1500,
      };

      const result = await courseFileService.uploadExamDocument({
        offeringId: mockOfferingId,
        documentType: 'MIDTERM_EXAM_PAPER',
        file: mockFile,
        user: mockHodUser,
      });

      expect(result).toBeDefined();
      expect(courseOfferingService.getOfferingById).toHaveBeenCalledWith(mockOfferingId, mockHodUser);
    });

    test('rejects HOD with 403 Forbidden when offering belongs to a different department', async () => {
      const hodFromOtherDept = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Dr. Other Dept HOD',
        designation: 'hod',
        department: new mongoose.Types.ObjectId(),
      };

      const deptForbiddenError = new Error('You are only authorized to access course offerings belonging to your department.');
      deptForbiddenError.statusCode = 403;
      jest.spyOn(courseOfferingService, 'getOfferingById').mockRejectedValue(deptForbiddenError);

      const mockFile = {
        originalname: 'Midterm_Paper.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 test'),
        size: 500,
      };

      await expect(
        courseFileService.uploadExamDocument({
          offeringId: mockOfferingId,
          documentType: 'MIDTERM_EXAM_PAPER',
          file: mockFile,
          user: hodFromOtherDept,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('belonging to your department'),
      });
    });

    test('allows Dean to upload documents globally across any offering and department', async () => {
      const deanUser = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Prof. Dean of Faculty',
        designation: 'dean',
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('final_fld');
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);

      const uploadResult = {
        fileId: 'dean_drive_upload_1',
        name: 'Final_Exam_Dean.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2500,
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(uploadResult);
      jest.spyOn(CourseFile, 'create').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        ...uploadResult,
        documentType: 'FINAL_EXAM_PAPER',
        isCanonical: true,
      });

      const mockFile = {
        originalname: 'Final_Exam_Dean.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 test'),
        size: 2500,
      };

      const result = await courseFileService.uploadExamDocument({
        offeringId: mockOfferingId,
        documentType: 'FINAL_EXAM_PAPER',
        file: mockFile,
        user: deanUser,
      });

      expect(result).toBeDefined();
      expect(courseOfferingService.getOfferingById).toHaveBeenCalledWith(mockOfferingId, deanUser);
    });

    test('rejects unauthorized user attempting to delete an exam course file with 403 Forbidden', async () => {
      const unauthorizedUser = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Dr. Unauthorized',
        designation: 'faculty',
      };

      const mockCourseFile = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'MIDTERM_BEST_COPY',
        googleDriveFileId: 'drive_protected_id',
      };

      jest.spyOn(CourseFile, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCourseFile),
      });

      const authError = new Error('You are not authorized to access this course offering.');
      authError.statusCode = 403;
      jest.spyOn(courseOfferingService, 'getOfferingById').mockRejectedValue(authError);

      await expect(
        courseFileService.deleteCourseFile(mockCourseFile._id.toString(), unauthorizedUser)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('not authorized'),
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Offering-Specific Google Drive Folder Organization
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Offering-Specific Google Drive Folder Organization', () => {
    test('routes Midterm uploads to ${courseCode}_Sec${section}_Midterm subfolder', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);
      jest.spyOn(CourseFile, 'distinct').mockResolvedValue(['MIDTERM_EXAM_PAPER']);

      let capturedFolderName = '';
      jest.spyOn(driveService, 'getOrCreateFolder').mockImplementation(async (name) => {
        capturedFolderName = name;
        return 'mock_midterm_folder_id';
      });

      const uploadResult = {
        fileId: 'midterm_drive_1',
        name: 'Midterm_CS402_SecB.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2000,
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(uploadResult);
      jest.spyOn(CourseFile, 'create').mockResolvedValue({
        ...uploadResult,
        documentType: 'MIDTERM_EXAM_PAPER',
        isCanonical: true,
      });

      const mockFile = {
        originalname: 'Midterm_Exam.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 test'),
        size: 2000,
      };

      await courseFileService.uploadExamDocument({
        offeringId: mockOfferingId,
        documentType: 'MIDTERM_EXAM_PAPER',
        file: mockFile,
        user: mockUser,
      });

      expect(capturedFolderName).toBe('CS402_SecB_Midterm');
    });

    test('routes Final uploads to ${courseCode}_Sec${section}_Final subfolder', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);
      jest.spyOn(CourseFile, 'distinct').mockResolvedValue(['FINAL_EXAM_PAPER']);

      let capturedFolderName = '';
      jest.spyOn(driveService, 'getOrCreateFolder').mockImplementation(async (name) => {
        capturedFolderName = name;
        return 'mock_final_folder_id';
      });

      const uploadResult = {
        fileId: 'final_drive_1',
        name: 'Final_CS402_SecB.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2000,
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(uploadResult);
      jest.spyOn(CourseFile, 'create').mockResolvedValue({
        ...uploadResult,
        documentType: 'FINAL_EXAM_PAPER',
        isCanonical: true,
      });

      const mockFile = {
        originalname: 'Final_Exam.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 test'),
        size: 2000,
      };

      await courseFileService.uploadExamDocument({
        offeringId: mockOfferingId,
        documentType: 'FINAL_EXAM_PAPER',
        file: mockFile,
        user: mockUser,
      });

      expect(capturedFolderName).toBe('CS402_SecB_Final');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. In-Place Replacement Without Duplication
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. In-Place Replacement Without Duplication', () => {
    test('updates existing Drive file in-place and increments version when replacing', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('midterm_fld');
      jest.spyOn(CourseFile, 'distinct').mockResolvedValue(['MIDTERM_BEST_COPY']);

      const existingRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'MIDTERM_BEST_COPY',
        fileFormat: 'pdf',
        filename: 'Old_Best_Copy.pdf',
        googleDriveFileId: 'drive_existing_copy_id',
        googleDriveFolderId: 'midterm_fld',
        version: 1,
        isCanonical: true,
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(existingRecord);

      const updatedUploadResult = {
        fileId: 'drive_existing_copy_id', // same file ID returned by driveService.uploadDocumentBuffer
        name: 'New_Revised_Best_Copy.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 4096,
        webViewLink: 'https://drive.google.com/file/d/drive_existing_copy_id/view',
        isUpdated: true,
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(updatedUploadResult);

      const mockNewFile = {
        originalname: 'New_Revised_Best_Copy.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from('mock docx new content'),
        size: 4096,
      };

      const result = await courseFileService.uploadExamDocument({
        offeringId: mockOfferingId,
        documentType: 'MIDTERM_BEST_COPY',
        file: mockNewFile,
        user: mockUser,
      });

      // Verify driveService was invoked with existingFileId
      expect(driveService.uploadDocumentBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          existingFileId: 'drive_existing_copy_id',
          filename: 'New_Revised_Best_Copy.docx',
        })
      );

      // Verify version incremented to 2
      expect(result.version).toBe(2);
      expect(result.fileFormat).toBe('docx');
      expect(result.filename).toBe('New_Revised_Best_Copy.docx');
      expect(existingRecord.save).toHaveBeenCalled();
    });

    test('recovers when existing Drive file was deleted (404 recovery)', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('final_fld');
      jest.spyOn(CourseFile, 'distinct').mockResolvedValue(['FINAL_AVERAGE_COPY']);

      const existingRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'FINAL_AVERAGE_COPY',
        fileFormat: 'pdf',
        filename: 'Old_Average_Copy.pdf',
        googleDriveFileId: 'drive_deleted_404_id',
        version: 1,
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(existingRecord);

      // driveService handles 404 by creating fresh file and returning NEW fileId
      const recoveredUploadResult = {
        fileId: 'drive_fresh_recreated_id',
        name: 'New_Average_Copy.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 3000,
        webViewLink: 'https://drive.google.com/file/d/drive_fresh_recreated_id/view',
        isUpdated: false,
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(recoveredUploadResult);

      const mockFile = {
        originalname: 'New_Average_Copy.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 new'),
        size: 3000,
      };

      const result = await courseFileService.uploadExamDocument({
        offeringId: mockOfferingId,
        documentType: 'FINAL_AVERAGE_COPY',
        file: mockFile,
        user: mockUser,
      });

      // CourseFile record must now have the recreated file ID
      expect(result.googleDriveFileId).toBe('drive_fresh_recreated_id');
      expect(result.version).toBe(2);
      expect(existingRecord.save).toHaveBeenCalled();
    });

    test('replaces PDF with PDF preserving fileFormat, incrementing version, and keeping driveFileId', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('midterm_fld');

      const existingRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'MIDTERM_EXAM_PAPER',
        fileFormat: 'pdf',
        filename: 'Midterm_v1.pdf',
        googleDriveFileId: 'drive_midterm_paper_id',
        version: 1,
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(existingRecord);

      const updatedUploadResult = {
        fileId: 'drive_midterm_paper_id',
        name: 'Midterm_v2.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 3500,
        webViewLink: 'https://drive.google.com/file/d/drive_midterm_paper_id/view',
        isUpdated: true,
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(updatedUploadResult);

      const mockFile = {
        originalname: 'Midterm_v2.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 revised midterm'),
        size: 3500,
      };

      const result = await courseFileService.uploadExamDocument({
        offeringId: mockOfferingId,
        documentType: 'MIDTERM_EXAM_PAPER',
        file: mockFile,
        user: mockUser,
      });

      expect(driveService.uploadDocumentBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          existingFileId: 'drive_midterm_paper_id',
          filename: 'Midterm_v2.pdf',
        })
      );
      expect(result.version).toBe(2);
      expect(result.fileFormat).toBe('pdf');
      expect(result.filename).toBe('Midterm_v2.pdf');
      expect(result.googleDriveFileId).toBe('drive_midterm_paper_id');
    });

    test('replaces DOCX with DOC updating fileFormat, incrementing version, and keeping driveFileId', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('final_fld');

      const existingRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'FINAL_WORST_COPY',
        fileFormat: 'docx',
        filename: 'Final_Worst.docx',
        googleDriveFileId: 'drive_final_worst_id',
        version: 2,
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(existingRecord);

      const updatedUploadResult = {
        fileId: 'drive_final_worst_id',
        name: 'Final_Worst.doc',
        mimeType: 'application/msword',
        sizeBytes: 4200,
        webViewLink: 'https://drive.google.com/file/d/drive_final_worst_id/view',
        isUpdated: true,
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(updatedUploadResult);

      const mockFile = {
        originalname: 'Final_Worst.doc',
        mimetype: 'application/msword',
        buffer: Buffer.from('mock doc bytes'),
        size: 4200,
      };

      const result = await courseFileService.uploadExamDocument({
        offeringId: mockOfferingId,
        documentType: 'FINAL_WORST_COPY',
        file: mockFile,
        user: mockUser,
      });

      expect(result.version).toBe(3);
      expect(result.fileFormat).toBe('doc');
      expect(result.filename).toBe('Final_Worst.doc');
      expect(result.googleDriveFileId).toBe('drive_final_worst_id');
    });

    test('replacing one category slot preserves all other category slots unchanged', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('midterm_fld');

      // The 4 slots in DB:
      const existingPaper = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'MIDTERM_EXAM_PAPER',
        fileFormat: 'pdf',
        version: 1,
        googleDriveFileId: 'drive_paper_fixed',
      };
      const existingBest = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'MIDTERM_BEST_COPY',
        fileFormat: 'pdf',
        version: 1,
        googleDriveFileId: 'drive_best_to_replace',
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      const existingAverage = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'MIDTERM_AVERAGE_COPY',
        fileFormat: 'pdf',
        version: 1,
        googleDriveFileId: 'drive_avg_fixed',
      };
      const existingWorst = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'MIDTERM_WORST_COPY',
        fileFormat: 'pdf',
        version: 1,
        googleDriveFileId: 'drive_worst_fixed',
      };

      // Query only targets MIDTERM_BEST_COPY
      jest.spyOn(CourseFile, 'findOne').mockImplementation((query) => {
        if (query.documentType === 'MIDTERM_BEST_COPY') return Promise.resolve(existingBest);
        if (query.documentType === 'MIDTERM_EXAM_PAPER') return Promise.resolve(existingPaper);
        if (query.documentType === 'MIDTERM_AVERAGE_COPY') return Promise.resolve(existingAverage);
        if (query.documentType === 'MIDTERM_WORST_COPY') return Promise.resolve(existingWorst);
        return Promise.resolve(null);
      });

      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'drive_best_to_replace',
        name: 'New_Best.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 5000,
        isUpdated: true,
      });

      const mockFile = {
        originalname: 'New_Best.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from('mock docx'),
        size: 5000,
      };

      const replacedResult = await courseFileService.uploadExamDocument({
        offeringId: mockOfferingId,
        documentType: 'MIDTERM_BEST_COPY',
        file: mockFile,
        user: mockUser,
      });

      // Only BEST copy was modified and incremented
      expect(replacedResult.documentType).toBe('MIDTERM_BEST_COPY');
      expect(replacedResult.version).toBe(2);

      // The other three category records remain completely unchanged
      expect(existingPaper.version).toBe(1);
      expect(existingPaper.googleDriveFileId).toBe('drive_paper_fixed');
      expect(existingAverage.version).toBe(1);
      expect(existingAverage.googleDriveFileId).toBe('drive_avg_fixed');
      expect(existingWorst.version).toBe(1);
      expect(existingWorst.googleDriveFileId).toBe('drive_worst_fixed');
    });

    test('replacing Midterm document does not affect or overwrite Final document', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('midterm_fld');

      const existingMidtermPaper = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'MIDTERM_EXAM_PAPER',
        fileFormat: 'pdf',
        version: 1,
        googleDriveFileId: 'drive_midterm_paper_id',
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      const existingFinalPaper = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'FINAL_EXAM_PAPER',
        fileFormat: 'pdf',
        version: 1,
        googleDriveFileId: 'drive_final_paper_id',
      };

      jest.spyOn(CourseFile, 'findOne').mockImplementation((query) => {
        if (query.documentType === 'MIDTERM_EXAM_PAPER') return Promise.resolve(existingMidtermPaper);
        if (query.documentType === 'FINAL_EXAM_PAPER') return Promise.resolve(existingFinalPaper);
        return Promise.resolve(null);
      });

      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'drive_midterm_paper_id',
        name: 'New_Midterm.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 3000,
        isUpdated: true,
      });

      const mockFile = {
        originalname: 'New_Midterm.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 revised'),
        size: 3000,
      };

      await courseFileService.uploadExamDocument({
        offeringId: mockOfferingId,
        documentType: 'MIDTERM_EXAM_PAPER',
        file: mockFile,
        user: mockUser,
      });

      expect(existingMidtermPaper.version).toBe(2);
      expect(existingFinalPaper.version).toBe(1);
      expect(existingFinalPaper.googleDriveFileId).toBe('drive_final_paper_id');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Independent Checklist Completion Tracking
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Independent Checklist Completion Tracking', () => {
    test('updates checklist item completed to false when < 4 midterm categories uploaded', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('midterm_fld');
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);

      // Only 2 of 4 categories uploaded
      jest.spyOn(CourseFile, 'distinct').mockResolvedValue([
        'MIDTERM_EXAM_PAPER',
        'MIDTERM_BEST_COPY',
      ]);

      const mockChecklist = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        checklistItems: [
          { type: 'ASSESS_MID', completed: false },
          { type: 'ASSESS_FINAL', completed: false },
        ],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      await courseFileService.updateExamChecklistStatus(mockOfferingId, 'MIDTERM_BEST_COPY');

      const midItem = mockChecklist.checklistItems.find((i) => i.type === 'ASSESS_MID');
      expect(midItem.completed).toBe(false);
      expect(mockChecklist.save).not.toHaveBeenCalled(); // No change needed since already false
    });

    test('marks Midterm completed when all 4 distinct categories uploaded without marking Final complete', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('midterm_fld');

      // All 4 midterm categories uploaded
      jest.spyOn(CourseFile, 'distinct').mockResolvedValue([
        'MIDTERM_EXAM_PAPER',
        'MIDTERM_BEST_COPY',
        'MIDTERM_AVERAGE_COPY',
        'MIDTERM_WORST_COPY',
      ]);

      const mockChecklist = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        checklistItems: [
          { type: 'ASSESS_MID', completed: false },
          { type: 'ASSESS_FINAL', completed: false },
        ],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      await courseFileService.updateExamChecklistStatus(mockOfferingId, 'MIDTERM_WORST_COPY');

      const midItem = mockChecklist.checklistItems.find((i) => i.type === 'ASSESS_MID');
      const finalItem = mockChecklist.checklistItems.find((i) => i.type === 'ASSESS_FINAL');

      expect(midItem.completed).toBe(true);
      expect(finalItem.completed).toBe(false); // Must remain incomplete!
      expect(mockChecklist.save).toHaveBeenCalled();
    });

    test('marks Final completed when all 4 distinct categories uploaded without affecting Midterm', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('final_fld');

      // All 4 final categories uploaded
      jest.spyOn(CourseFile, 'distinct').mockResolvedValue([
        'FINAL_EXAM_PAPER',
        'FINAL_BEST_COPY',
        'FINAL_AVERAGE_COPY',
        'FINAL_WORST_COPY',
      ]);

      const mockChecklist = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        checklistItems: [
          { type: 'ASSESS_MID', completed: false },
          { type: 'ASSESS_FINAL', completed: false },
        ],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      await courseFileService.updateExamChecklistStatus(mockOfferingId, 'FINAL_WORST_COPY');

      const midItem = mockChecklist.checklistItems.find((i) => i.type === 'ASSESS_MID');
      const finalItem = mockChecklist.checklistItems.find((i) => i.type === 'ASSESS_FINAL');

      expect(midItem.completed).toBe(false); // Midterm remains incomplete!
      expect(finalItem.completed).toBe(true);
      expect(mockChecklist.save).toHaveBeenCalled();
    });

    test('deleting an exam file recalculates completion status from 4/4 to 3/4 (completed: false)', async () => {
      const mockCourseFile = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'MIDTERM_WORST_COPY',
        googleDriveFileId: 'drive_to_delete_id',
      };

      jest.spyOn(CourseFile, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCourseFile),
      });
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(driveService, 'deleteFile').mockResolvedValue(true);
      jest.spyOn(CourseFile, 'findByIdAndDelete').mockResolvedValue(mockCourseFile);

      // Now only 3 categories remain
      jest.spyOn(CourseFile, 'distinct').mockResolvedValue([
        'MIDTERM_EXAM_PAPER',
        'MIDTERM_BEST_COPY',
        'MIDTERM_AVERAGE_COPY',
      ]);

      const mockChecklist = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        checklistItems: [{ type: 'ASSESS_MID', completed: true }],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      await courseFileService.deleteCourseFile(mockCourseFile._id.toString(), mockUser);

      const midItem = mockChecklist.checklistItems.find((i) => i.type === 'ASSESS_MID');
      expect(midItem.completed).toBe(false);
      expect(mockChecklist.save).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Safe Failure Handling & Concurrency
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Safe Failure Handling & Concurrency', () => {
    test('Google Drive failure throws 500 and prevents CourseFile creation', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('midterm_fld');
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);
      jest.spyOn(CourseFile, 'create').mockImplementation(() => {});

      jest.spyOn(driveService, 'uploadDocumentBuffer').mockRejectedValue(
        new Error('Google Drive API rate limit or network timeout')
      );

      const mockFile = {
        originalname: 'Exam.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 test'),
        size: 1000,
      };

      await expect(
        courseFileService.uploadExamDocument({
          offeringId: mockOfferingId,
          documentType: 'MIDTERM_EXAM_PAPER',
          file: mockFile,
          user: mockUser,
        })
      ).rejects.toMatchObject({
        statusCode: 500,
        message: expect.stringContaining('Google Drive upload failed'),
      });

      expect(CourseFile.create).not.toHaveBeenCalled();
    });

    test('deletes orphaned Google Drive file when CourseFile database creation fails', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('midterm_fld');
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);

      const uploadResult = {
        fileId: 'orphaned_drive_file_id',
        name: 'Exam.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(uploadResult);
      jest.spyOn(driveService, 'deleteFile').mockResolvedValue(true);

      const dbError = new Error('Database connection lost during insert');
      jest.spyOn(CourseFile, 'create').mockRejectedValue(dbError);

      const mockFile = {
        originalname: 'Exam.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 test'),
        size: 1000,
      };

      await expect(
        courseFileService.uploadExamDocument({
          offeringId: mockOfferingId,
          documentType: 'MIDTERM_EXAM_PAPER',
          file: mockFile,
          user: mockUser,
        })
      ).rejects.toMatchObject({
        statusCode: 500,
        message: expect.stringContaining('Failed to save exam file metadata'),
      });

      // Drive cleanup must be called to prevent orphan file accumulation
      expect(driveService.deleteFile).toHaveBeenCalledWith('orphaned_drive_file_id');
    });

    test('reconciles concurrent upload collision (E11000)', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('midterm_fld');

      // Initial find returns null (simulating concurrent insert race)
      const existingInDbAfterRace = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'MIDTERM_EXAM_PAPER',
        fileFormat: 'pdf',
        version: 1,
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };

      jest
        .spyOn(CourseFile, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingInDbAfterRace);

      const uploadResult = {
        fileId: 'drive_colliding_file',
        name: 'Exam.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(uploadResult);

      const dupError = new Error('E11000 duplicate key error');
      dupError.code = 11000;
      jest.spyOn(CourseFile, 'create').mockRejectedValue(dupError);
      jest.spyOn(CourseFile, 'distinct').mockResolvedValue(['MIDTERM_EXAM_PAPER']);

      const mockFile = {
        originalname: 'Exam.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 test'),
        size: 1000,
      };

      const result = await courseFileService.uploadExamDocument({
        offeringId: mockOfferingId,
        documentType: 'MIDTERM_EXAM_PAPER',
        file: mockFile,
        user: mockUser,
      });

      expect(result.version).toBe(2);
      expect(existingInDbAfterRace.save).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Controller Endpoints
  // ───────────────────────────────────────────────────────────────────────────
  describe('8. Controller Endpoints', () => {
    test('POST /upload/exam/:offeringId controller returns 200 with result payload', async () => {
      const mockResult = {
        _id: new mongoose.Types.ObjectId(),
        documentType: 'MIDTERM_EXAM_PAPER',
        filename: 'Exam_CS402.pdf',
        fileFormat: 'pdf',
        googleDriveFileId: 'drive_ctrl_1',
      };
      jest.spyOn(courseFileService, 'uploadExamDocument').mockResolvedValue(mockResult);

      const req = {
        params: { offeringId: mockOfferingId },
        body: { documentType: 'MIDTERM_EXAM_PAPER' },
        file: {
          originalname: 'Exam_CS402.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 test'),
          size: 1000,
        },
        user: mockUser,
      };
      const res = createMockRes();
      const next = jest.fn();

      await courseFileController.uploadExamDocument(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documentType).toBe('MIDTERM_EXAM_PAPER');
      expect(res.body.message).toContain('Midterm Exam document');
    });

    test('POST /upload/:offeringId controller delegates exam document types to uploadExamDocument', async () => {
      const mockResult = {
        _id: new mongoose.Types.ObjectId(),
        documentType: 'FINAL_BEST_COPY',
        filename: 'Best_Final.docx',
        fileFormat: 'docx',
      };
      jest.spyOn(courseFileService, 'uploadExamDocument').mockResolvedValue(mockResult);

      const req = {
        params: { offeringId: mockOfferingId },
        body: { documentType: 'FINAL_BEST_COPY' },
        file: {
          originalname: 'Best_Final.docx',
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          buffer: Buffer.from('mock docx'),
          size: 2000,
        },
        user: mockUser,
      };
      const res = createMockRes();
      const next = jest.fn();

      await courseFileController.uploadOfferingDocument(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(courseFileService.uploadExamDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          offeringId: mockOfferingId,
          documentType: 'FINAL_BEST_COPY',
        })
      );
    });

    test('POST /upload/exam/:offeringId returns 400 when documentType is missing', async () => {
      const req = {
        params: { offeringId: mockOfferingId },
        body: {},
        file: {
          originalname: 'file.pdf',
          buffer: Buffer.from('test'),
        },
        user: mockUser,
      };
      const res = createMockRes();
      const next = jest.fn();

      await courseFileController.uploadExamDocument(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('Document type is required');
    });

    test('POST /upload/exam/:offeringId returns 400 when file is missing', async () => {
      const req = {
        params: { offeringId: mockOfferingId },
        body: { documentType: 'MIDTERM_EXAM_PAPER' },
        file: null,
        files: [],
        user: mockUser,
      };
      const res = createMockRes();
      const next = jest.fn();

      await courseFileController.uploadExamDocument(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('A document file is required for upload');
    });
  });
});
