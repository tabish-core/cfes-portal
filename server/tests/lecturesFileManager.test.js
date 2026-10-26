/**
 * lecturesFileManager.test.js — Test suite for Lectures File Manager with Google Drive Integration
 *
 * Verifies:
 *  1. Authorized lecture upload (single file: .pptx, .pdf, .docx, .ppt, .doc)
 *  2. Multi-file lecture upload in single request
 *  3. Unauthorized offering access rejection (403 Forbidden)
 *  4. Unsupported file formats rejected with 400 Bad Request
 *  5. Oversized files (> 25MB) rejected with 400 Bad Request
 *  6. Duplicate filename prevention for the same offering
 *  7. Multiple lecture files of identical format coexisting for an offering
 *  8. Offering-scoped file listing with documentType=LECTURES filter
 *  9. Correct file deletion (removes from Drive and MongoDB)
 *  10. Checklist completion update on upload (LECTURES.completed = true)
 *  11. Checklist status un-marking when the last remaining lecture file is deleted
 *  12. Drive failure and MongoDB failure error handling
 *  13. CourseFile controller endpoints (uploadOfferingDocument, deleteCourseFile, listOfferingFiles)
 */

const mongoose = require('mongoose');
const driveService = require('../services/drive.service');
const courseFileService = require('../services/courseFile.service');
const courseFileController = require('../controllers/courseFile.controller');
const courseOfferingService = require('../services/courseOffering.service');
const CourseFile = require('../models/CourseFile.model');
const CourseChecklist = require('../models/CourseChecklist.model');

describe('Lectures File Manager with Google Drive Integration Suite', () => {
  const originalEnv = process.env;

  const mockOfferingId = new mongoose.Types.ObjectId().toString();
  const mockCourseId = new mongoose.Types.ObjectId().toString();
  const mockFacultyId = new mongoose.Types.ObjectId().toString();
  const mockSemesterId = new mongoose.Types.ObjectId().toString();

  const mockUser = {
    _id: new mongoose.Types.ObjectId(mockFacultyId),
    name: 'Dr. John Doe',
    email: 'johndoe@iu.edu.pk',
    designation: 'faculty',
  };

  const mockOffering = {
    _id: new mongoose.Types.ObjectId(mockOfferingId),
    course: {
      _id: new mongoose.Types.ObjectId(mockCourseId),
      courseCode: 'CS301',
      courseName: 'Database Systems',
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

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GOOGLE_DRIVE_FOLDER_ID: 'mock_root_drive_folder_id',
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Authorized lecture upload (single file)
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Single Lecture File Upload', () => {
    test('uploads a valid .pptx file successfully with correct metadata and Drive subfolder', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null); // No duplicate filename
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('mock_lectures_folder_id');
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'drive_file_123',
        webViewLink: 'https://drive.google.com/file/d/drive_file_123/view',
        webContentLink: 'https://drive.google.com/file/d/drive_file_123/download',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        sizeBytes: 2048,
      });

      const mockSavedRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'LECTURES',
        originalFilename: 'Lecture_01_Intro.pptx',
        filename: 'Lecture_01_Intro.pptx',
        fileFormat: 'pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        fileSizeBytes: 2048,
        googleDriveFileId: 'drive_file_123',
        googleDriveWebViewLink: 'https://drive.google.com/file/d/drive_file_123/view',
        status: 'synced',
        uploadedBy: mockUser._id,
      };
      jest.spyOn(CourseFile, 'create').mockResolvedValue(mockSavedRecord);

      // Mock checklist update
      const mockChecklist = {
        courseOffering: mockOffering._id,
        checklistItems: [{ type: 'LECTURES', completed: false, name: 'Lectures' }],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      const result = await courseFileService.uploadLectureFile({
        offeringId: mockOfferingId,
        file: {
          originalname: 'Lecture_01_Intro.pptx',
          buffer: Buffer.from('mock_pptx_data'),
          size: 2048,
          mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        },
        user: mockUser,
      });

      expect(courseOfferingService.getOfferingById).toHaveBeenCalledWith(mockOfferingId, mockUser);
      expect(driveService.getOrCreateFolder).toHaveBeenCalledWith(
        'CS301_SecA_Lectures',
        expect.any(String)
      );
      expect(driveService.uploadDocumentBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'Lecture_01_Intro.pptx',
          folderId: 'mock_lectures_folder_id',
        })
      );
      expect(CourseFile.create).toHaveBeenCalled();
      expect(mockChecklist.checklistItems[0].completed).toBe(true);
      expect(mockChecklist.save).toHaveBeenCalled();
      expect(result).toBe(mockSavedRecord);
    });

    test('accepts .pdf, .docx, .ppt, and .doc formats', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('mock_lectures_folder_id');
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'mock_file_id',
        webViewLink: 'https://drive.google.com/view',
        sizeBytes: 1000,
      });
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(null);

      const formats = [
        { name: 'Lecture_02.pdf', format: 'pdf' },
        { name: 'Lecture_03.docx', format: 'docx' },
        { name: 'Lecture_04.ppt', format: 'ppt' },
        { name: 'Lecture_05.doc', format: 'doc' },
      ];

      for (const item of formats) {
        jest.spyOn(CourseFile, 'create').mockResolvedValueOnce({
          _id: new mongoose.Types.ObjectId(),
          filename: item.name,
          fileFormat: item.format,
        });

        const res = await courseFileService.uploadLectureFile({
          offeringId: mockOfferingId,
          file: {
            originalname: item.name,
            buffer: Buffer.from('test_data'),
            size: 1000,
          },
          user: mockUser,
        });

        expect(res.fileFormat).toBe(item.format);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Multi-File Upload in Single Request
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Multi-File Lecture Upload', () => {
    test('uploads multiple lecture files in one call and returns summary', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('mock_lectures_folder_id');
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'mock_file_id',
        webViewLink: 'https://drive.google.com/view',
        sizeBytes: 1024,
      });
      jest.spyOn(CourseFile, 'create').mockImplementation((data) =>
        Promise.resolve({ _id: new mongoose.Types.ObjectId(), ...data })
      );
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(null);

      const files = [
        { originalname: 'Slide_01.pptx', buffer: Buffer.from('slide1'), size: 1024 },
        { originalname: 'Notes_01.pdf', buffer: Buffer.from('notes1'), size: 2048 },
        { originalname: 'Handout_01.docx', buffer: Buffer.from('handout1'), size: 512 },
      ];

      const results = await courseFileService.uploadLectureFiles({
        offeringId: mockOfferingId,
        files,
        user: mockUser,
      });

      expect(results).toHaveLength(3);
      expect(results[0].filename).toBe('Slide_01.pptx');
      expect(results[1].filename).toBe('Notes_01.pdf');
      expect(results[2].filename).toBe('Handout_01.docx');
    });

    test('rejects multi-file call when files array is empty', async () => {
      try {
        await courseFileService.uploadLectureFiles({
          offeringId: mockOfferingId,
          files: [],
          user: mockUser,
        });
        throw new Error('Should have failed');
      } catch (err) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toMatch(/At least one file is required/);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Unauthorized Offering Access Rejection
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Authorization Rejection', () => {
    test('rejects upload when user is not authorized for the offering', async () => {
      const authErr = new Error('You are not authorized to access this course offering');
      authErr.statusCode = 403;
      jest.spyOn(courseOfferingService, 'getOfferingById').mockRejectedValue(authErr);

      try {
        await courseFileService.uploadLectureFile({
          offeringId: mockOfferingId,
          file: {
            originalname: 'Lecture_01.pdf',
            buffer: Buffer.from('data'),
            size: 100,
          },
          user: mockUser,
        });
        throw new Error('Should have failed');
      } catch (err) {
        expect(err.statusCode).toBe(403);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Unsupported File Formats Rejected
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. File Format Validation', () => {
    test('rejects disallowed file extensions (e.g., .exe, .txt, .zip, .mp4) with 400', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const invalidNames = ['virus.exe', 'notes.txt', 'archive.zip', 'recording.mp4', 'file_without_ext'];

      for (const name of invalidNames) {
        try {
          await courseFileService.uploadLectureFile({
            offeringId: mockOfferingId,
            file: {
              originalname: name,
              buffer: Buffer.from('data'),
              size: 100,
            },
            user: mockUser,
          });
          throw new Error('Should have failed');
        } catch (err) {
          expect(err.statusCode).toBe(400);
          expect(err.message).toMatch(/Unsupported file format/);
        }
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Oversized File Validation
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. File Size Validation', () => {
    test('rejects file larger than 25 MB with 400 Bad Request', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const oversizedBytes = 25 * 1024 * 1024 + 1; // 25 MB + 1 byte
      try {
        await courseFileService.uploadLectureFile({
          offeringId: mockOfferingId,
          file: {
            originalname: 'BigPresentation.pptx',
            buffer: Buffer.from('big'),
            size: oversizedBytes,
          },
          user: mockUser,
        });
        throw new Error('Should have failed');
      } catch (err) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toMatch(/exceeds the maximum allowed size/);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Duplicate Filename Prevention
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Duplicate Filename Prevention', () => {
    test('rejects uploading a file with an already existing filename for that offering', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      // Existing file in DB
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        filename: 'Lecture_01_Intro.pptx',
        documentType: 'LECTURES',
      });

      try {
        await courseFileService.uploadLectureFile({
          offeringId: mockOfferingId,
          file: {
            originalname: 'Lecture_01_Intro.pptx',
            buffer: Buffer.from('new_version'),
            size: 100,
          },
          user: mockUser,
        });
        throw new Error('Should have failed');
      } catch (err) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toMatch(/already exists for this course offering/);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Multiple Lecture Files of Same Format Coexisting
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Multiple Lecture Files of Same Format Coexisting', () => {
    test('allows distinct filenames with same format (.pptx) to be created without index conflicts', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('mock_lectures_folder_id');
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'mock_file_id',
        webViewLink: 'https://drive.google.com/view',
        sizeBytes: 100,
      });
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(null);

      const file1 = { originalname: 'Lecture_01.pptx', buffer: Buffer.from('p1'), size: 100 };
      const file2 = { originalname: 'Lecture_02.pptx', buffer: Buffer.from('p2'), size: 100 };

      jest.spyOn(CourseFile, 'create')
        .mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), filename: 'Lecture_01.pptx', fileFormat: 'pptx' })
        .mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), filename: 'Lecture_02.pptx', fileFormat: 'pptx' });

      const res1 = await courseFileService.uploadLectureFile({ offeringId: mockOfferingId, file: file1, user: mockUser });
      const res2 = await courseFileService.uploadLectureFile({ offeringId: mockOfferingId, file: file2, user: mockUser });

      expect(res1.filename).toBe('Lecture_01.pptx');
      expect(res2.filename).toBe('Lecture_02.pptx');
      expect(res1.fileFormat).toBe('pptx');
      expect(res2.fileFormat).toBe('pptx');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Offering-Scoped File Listing with documentType=LECTURES Filter
  // ───────────────────────────────────────────────────────────────────────────
  describe('8. Offering-Scoped File Listing', () => {
    test('listOfferingFiles filters by documentType=LECTURES when specified', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([
          { _id: '1', filename: 'Lecture_01.pptx', documentType: 'LECTURES' },
          { _id: '2', filename: 'Lecture_02.pdf', documentType: 'LECTURES' },
        ]),
      };
      jest.spyOn(CourseFile, 'find').mockReturnValue(mockQuery);

      const files = await courseFileService.listOfferingFiles(mockOfferingId, mockUser, 'LECTURES');

      expect(CourseFile.find).toHaveBeenCalledWith({
        courseOffering: mockOfferingId,
        documentType: 'LECTURES',
      });
      expect(files).toHaveLength(2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Correct File Deletion
  // ───────────────────────────────────────────────────────────────────────────
  describe('9. File Deletion and Checklist Reversion', () => {
    test('deletes file from Drive and MongoDB, and marks checklist completed=false when 0 lecture files remain', async () => {
      const mockFileId = new mongoose.Types.ObjectId();
      const mockRecord = {
        _id: mockFileId,
        courseOffering: mockOffering._id,
        documentType: 'LECTURES',
        googleDriveFileId: 'drive_file_to_delete',
        filename: 'Lecture_01.pdf',
      };

      jest.spyOn(CourseFile, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockRecord),
      });
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(driveService, 'deleteFile').mockResolvedValue(true);
      jest.spyOn(CourseFile, 'findByIdAndDelete').mockResolvedValue(mockRecord);

      // Count remaining files -> 0
      jest.spyOn(CourseFile, 'countDocuments').mockResolvedValue(0);

      const mockChecklist = {
        courseOffering: mockOffering._id,
        checklistItems: [{ type: 'LECTURES', completed: true, name: 'Lectures' }],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      const res = await courseFileService.deleteCourseFile(mockFileId.toString(), mockUser);

      expect(driveService.deleteFile).toHaveBeenCalledWith('drive_file_to_delete');
      expect(CourseFile.findByIdAndDelete).toHaveBeenCalledWith(mockFileId.toString());
      expect(mockChecklist.checklistItems[0].completed).toBe(false);
      expect(mockChecklist.save).toHaveBeenCalled();
      expect(res.deleted).toBe(true);
      expect(res.remainingLecturesCount).toBe(0);
    });

    test('retains checklist completed=true when other lecture files still remain after deletion', async () => {
      const mockFileId = new mongoose.Types.ObjectId();
      const mockRecord = {
        _id: mockFileId,
        courseOffering: mockOffering._id,
        documentType: 'LECTURES',
        googleDriveFileId: 'drive_file_to_delete',
        filename: 'Lecture_01.pdf',
      };

      jest.spyOn(CourseFile, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockRecord),
      });
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(driveService, 'deleteFile').mockResolvedValue(true);
      jest.spyOn(CourseFile, 'findByIdAndDelete').mockResolvedValue(mockRecord);

      // Count remaining files -> 2 remaining
      jest.spyOn(CourseFile, 'countDocuments').mockResolvedValue(2);

      const mockChecklist = {
        courseOffering: mockOffering._id,
        checklistItems: [{ type: 'LECTURES', completed: true, name: 'Lectures' }],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      const res = await courseFileService.deleteCourseFile(mockFileId.toString(), mockUser);

      expect(mockChecklist.checklistItems[0].completed).toBe(true);
      expect(mockChecklist.save).not.toHaveBeenCalled();
      expect(res.deleted).toBe(true);
      expect(res.remainingLecturesCount).toBe(2);
    });

    test('rejects deletion with 404 when file does not exist', async () => {
      jest.spyOn(CourseFile, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      try {
        await courseFileService.deleteCourseFile(new mongoose.Types.ObjectId().toString(), mockUser);
        throw new Error('Should have failed');
      } catch (err) {
        expect(err.statusCode).toBe(404);
        expect(err.message).toMatch(/Course file record not found/);
      }
    });

    test('rejects deletion with 403 when user is unauthorized for offering', async () => {
      const mockRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'LECTURES',
      };
      jest.spyOn(CourseFile, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockRecord),
      });

      const authErr = new Error('Unauthorized');
      authErr.statusCode = 403;
      jest.spyOn(courseOfferingService, 'getOfferingById').mockRejectedValue(authErr);

      try {
        await courseFileService.deleteCourseFile(mockRecord._id.toString(), mockUser);
        throw new Error('Should have failed');
      } catch (err) {
        expect(err.statusCode).toBe(403);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Drive Failure and MongoDB Failure Handling
  // ───────────────────────────────────────────────────────────────────────────
  describe('10. Failure Handling', () => {
    test('handles Google Drive upload error and throws 500', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('mock_lectures_folder_id');
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockRejectedValue(new Error('Google Drive quota exceeded'));

      try {
        await courseFileService.uploadLectureFile({
          offeringId: mockOfferingId,
          file: {
            originalname: 'Lecture_Fail.pdf',
            buffer: Buffer.from('data'),
            size: 100,
          },
          user: mockUser,
        });
        throw new Error('Should have failed');
      } catch (err) {
        expect(err.statusCode).toBe(500);
        expect(err.message).toMatch(/Google Drive upload failed: Google Drive quota exceeded/);
      }
    });

    test('re-throws error when MongoDB CourseFile.create fails after Drive upload and cleans up orphaned file', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);
      jest.spyOn(driveService, 'getOrCreateFolder').mockResolvedValue('mock_lectures_folder_id');
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'orphaned_drive_file_id',
        webViewLink: 'https://drive.google.com/view',
        sizeBytes: 100,
      });
      jest.spyOn(driveService, 'deleteFile').mockResolvedValue(true);
      jest.spyOn(CourseFile, 'create').mockRejectedValue(new Error('MongoDB connection timeout'));

      try {
        await courseFileService.uploadLectureFile({
          offeringId: mockOfferingId,
          file: {
            originalname: 'Lecture_DbFail.pptx',
            buffer: Buffer.from('data'),
            size: 100,
          },
          user: mockUser,
        });
        throw new Error('Should have failed');
      } catch (err) {
        expect(err.statusCode).toBe(500);
        expect(err.message).toMatch(/Failed to save lecture file metadata: MongoDB connection timeout/);
        expect(driveService.deleteFile).toHaveBeenCalledWith('orphaned_drive_file_id');
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 11. Controller Endpoints Integration
  // ───────────────────────────────────────────────────────────────────────────
  describe('11. Controller Endpoints', () => {
    test('uploadOfferingDocument delegates to uploadLectureFiles when documentType=LECTURES', async () => {
      const mockReq = {
        params: { offeringId: mockOfferingId },
        body: { documentType: 'LECTURES' },
        files: [
          { originalname: 'L1.pptx', buffer: Buffer.from('1'), size: 100 },
          { originalname: 'L2.pdf', buffer: Buffer.from('2'), size: 200 },
        ],
        user: mockUser,
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      jest.spyOn(courseFileService, 'uploadLectureFiles').mockResolvedValue([
        { _id: '1', filename: 'L1.pptx' },
        { _id: '2', filename: 'L2.pdf' },
      ]);

      await courseFileController.uploadOfferingDocument(mockReq, mockRes);

      expect(courseFileService.uploadLectureFiles).toHaveBeenCalledWith({
        offeringId: mockOfferingId,
        files: mockReq.files,
        user: mockUser,
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            count: 2,
          }),
        })
      );
    });

    test('deleteCourseFile controller returns success response', async () => {
      const mockReq = {
        params: { id: 'file_123' },
        user: mockUser,
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      jest.spyOn(courseFileService, 'deleteCourseFile').mockResolvedValue({
        deleted: true,
        documentType: 'LECTURES',
        remainingLecturesCount: 1,
      });

      await courseFileController.deleteCourseFile(mockReq, mockRes);

      expect(courseFileService.deleteCourseFile).toHaveBeenCalledWith('file_123', mockUser);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'File deleted successfully.',
        })
      );
    });

    test('listOfferingFiles controller forwards documentType query param', async () => {
      const mockReq = {
        params: { offeringId: mockOfferingId },
        query: { documentType: 'LECTURES' },
        user: mockUser,
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      jest.spyOn(courseFileService, 'listOfferingFiles').mockResolvedValue([
        { _id: '1', filename: 'L1.pptx', documentType: 'LECTURES' },
      ]);

      await courseFileController.listOfferingFiles(mockReq, mockRes);

      expect(courseFileService.listOfferingFiles).toHaveBeenCalledWith(
        mockOfferingId,
        mockUser,
        'LECTURES'
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
        })
      );
    });
  });
});
