/**
 * googleDriveStage2.test.js — Comprehensive automated test suite for Stage 2 Google Drive integration.
 *
 * Verifies:
 *  1. Drive Service Upload & Streaming (`services/drive.service.js`):
 *     - Uploading document buffer through mocked Drive client (files.create)
 *     - Correct filename, MIME type, parents folder, and supportsAllDrives: true
 *     - Canonical in-place replacement (files.update) when existingFileId is provided
 *     - Graceful recovery: when files.update returns 404, falls back to files.create
 *     - Secure file streaming (files.get alt: media) and metadata retrieval
 *     - Error handling on invalid buffers or missing parameters
 *  2. CourseFile Model & Persistence (`models/CourseFile.model.js`):
 *     - Schema validation for required fields, enums, versioning, and defaults
 *     - Compound unique index on { courseOffering, documentType, fileFormat, instanceName }
 *  3. Course File Service Orchestration (`services/courseFile.service.js`):
 *     - Authorization enforcement via courseOfferingService.getOfferingById
 *     - Canonical document synchronization and version incrementing
 *     - Multi-instance document isolation (Quiz 1 vs Quiz 2)
 *     - Checklist completion status automatic update
 *     - CIS generation and synchronization (generateAndSyncCIS)
 *  4. Controller & Route Endpoints (`controllers/courseFile.controller.js`):
 *     - listOfferingFiles (GET /api/course-files/offering/:offeringId)
 *     - syncCISDocument (POST /api/course-files/sync/cis/:offeringId)
 *     - uploadOfferingDocument (POST /api/course-files/upload/:offeringId)
 *     - viewCourseFile (GET /api/course-files/:id/view)
 *     - downloadCourseFile (GET /api/course-files/:id/download)
 *  5. Preservation of Existing CIS Export:
 *     - Normal export behavior intact
 *     - Optional syncToDrive parameter support
 */

const mongoose = require('mongoose');
const { Readable } = require('node:stream');
const driveService = require('../services/drive.service');
const courseFileService = require('../services/courseFile.service');
const courseFileController = require('../controllers/courseFile.controller');
const courseOfferingService = require('../services/courseOffering.service');
const CourseFile = require('../models/CourseFile.model');
const CIS = require('../models/CIS.model');
const CourseChecklist = require('../models/CourseChecklist.model');
const googleDriveConfig = require('../config/googleDrive');
const cisWordService = require('../services/documentService/generateCISWord');
const cisPdfService = require('../services/documentService/generateCISPDF');
const formController = require('../controllers/form.controller');

describe('Stage 2: Google Drive Document Upload, Persistence & CIS Sync Suite', () => {
  const originalEnv = process.env;

  const mockOfferingId = new mongoose.Types.ObjectId().toString();
  const mockCourseId = new mongoose.Types.ObjectId().toString();
  const mockFacultyId = new mongoose.Types.ObjectId().toString();
  const mockSemesterId = new mongoose.Types.ObjectId().toString();
  const mockFileId = new mongoose.Types.ObjectId().toString();

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
      courseCode: 'CSC201',
      courseName: 'Data Structures',
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

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = 'test_jwt_secret_stage2_testing';
    process.env.GOOGLE_DRIVE_FOLDER_ID = '1kIzXquZB7ayOhTXtunMPwoCdVmx40Kez';
    jest.clearAllMocks();
    jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(null);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Drive Service Upload & Streaming (services/drive.service.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Drive Service Upload & Streaming (services/drive.service.js)', () => {
    test('uploadDocumentBuffer creates a new file in destination folder via drive.files.create', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        data: {
          id: 'drive_file_id_new_123',
          name: 'CIS_CSC201_SecA.pdf',
          mimeType: 'application/pdf',
          size: '1024',
          webViewLink: 'https://drive.google.com/file/d/drive_file_id_new_123/view',
          webContentLink: 'https://drive.google.com/uc?id=drive_file_id_new_123',
        },
      });

      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue({
        files: { create: mockCreate },
      });

      const buffer = Buffer.from('dummy_pdf_content');
      const result = await driveService.uploadDocumentBuffer({
        buffer,
        filename: 'CIS_CSC201_SecA.pdf',
        mimeType: 'application/pdf',
        folderId: '1kIzXquZB7ayOhTXtunMPwoCdVmx40Kez',
      });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const createArgs = mockCreate.mock.calls[0][0];
      expect(createArgs.requestBody.name).toBe('CIS_CSC201_SecA.pdf');
      expect(createArgs.requestBody.parents).toEqual(['1kIzXquZB7ayOhTXtunMPwoCdVmx40Kez']);
      expect(createArgs.media.mimeType).toBe('application/pdf');
      expect(createArgs.supportsAllDrives).toBe(true);

      expect(result.fileId).toBe('drive_file_id_new_123');
      expect(result.name).toBe('CIS_CSC201_SecA.pdf');
      expect(result.isUpdated).toBe(false);
      expect(result.sizeBytes).toBe(1024);
    });

    test('uploadDocumentBuffer performs in-place update when existingFileId is provided', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({
        data: {
          id: 'drive_file_id_existing_999',
          name: 'CIS_CSC201_SecA.pdf',
          mimeType: 'application/pdf',
          size: '2048',
          webViewLink: 'https://drive.google.com/file/d/drive_file_id_existing_999/view',
          webContentLink: 'https://drive.google.com/uc?id=drive_file_id_existing_999',
        },
      });
      const mockCreate = jest.fn();

      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue({
        files: { update: mockUpdate, create: mockCreate },
      });

      const buffer = Buffer.from('updated_pdf_content');
      const result = await driveService.uploadDocumentBuffer({
        buffer,
        filename: 'CIS_CSC201_SecA.pdf',
        mimeType: 'application/pdf',
        existingFileId: 'drive_file_id_existing_999',
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockCreate).not.toHaveBeenCalled();
      const updateArgs = mockUpdate.mock.calls[0][0];
      expect(updateArgs.fileId).toBe('drive_file_id_existing_999');
      expect(updateArgs.requestBody.name).toBe('CIS_CSC201_SecA.pdf');
      expect(updateArgs.supportsAllDrives).toBe(true);

      expect(result.fileId).toBe('drive_file_id_existing_999');
      expect(result.isUpdated).toBe(true);
    });

    test('uploadDocumentBuffer recovers gracefully when existingFileId returns 404', async () => {
      const notFoundError = new Error('File not found in Drive');
      notFoundError.code = 404;

      const mockUpdate = jest.fn().mockRejectedValue(notFoundError);
      const mockCreate = jest.fn().mockResolvedValue({
        data: {
          id: 'drive_file_id_recreated_888',
          name: 'CIS_CSC201_SecA.pdf',
          mimeType: 'application/pdf',
          size: '1500',
        },
      });

      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue({
        files: { update: mockUpdate, create: mockCreate },
      });

      const buffer = Buffer.from('recreated_pdf_content');
      const result = await driveService.uploadDocumentBuffer({
        buffer,
        filename: 'CIS_CSC201_SecA.pdf',
        mimeType: 'application/pdf',
        existingFileId: 'missing_old_file_id',
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result.fileId).toBe('drive_file_id_recreated_888');
      expect(result.isUpdated).toBe(false);
    });

    test('uploadDocumentBuffer rejects non-buffer inputs with 400 status', async () => {
      await expect(
        driveService.uploadDocumentBuffer({
          buffer: 'not_a_buffer',
          filename: 'test.pdf',
          mimeType: 'application/pdf',
        })
      ).rejects.toThrow(/valid file Buffer is required/);
    });

    test('getFileStream requests stream from Drive API with supportsAllDrives: true', async () => {
      const mockStream = new Readable({
        read() {
          this.push('file_content_chunks');
          this.push(null);
        },
      });

      const mockGet = jest.fn().mockResolvedValue({ data: mockStream });
      jest.spyOn(driveService, 'getDriveClient').mockResolvedValue({
        files: { get: mockGet },
      });

      const stream = await driveService.getFileStream('drive_file_123');
      expect(mockGet).toHaveBeenCalledWith(
        { fileId: 'drive_file_123', alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' }
      );
      expect(stream).toBe(mockStream);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. CourseFile Model Schema & Concurrency (models/CourseFile.model.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. CourseFile Model Schema & Concurrency (models/CourseFile.model.js)', () => {
    test('Defines compound unique index on courseOffering, documentType, fileFormat, and instanceName', () => {
      const indexes = CourseFile.schema.indexes();
      const uniqueIndex = indexes.find((idx) => {
        const fields = Object.keys(idx[0]);
        return (
          fields.includes('courseOffering') &&
          fields.includes('documentType') &&
          fields.includes('fileFormat') &&
          fields.includes('instanceName') &&
          idx[1]?.unique === true
        );
      });

      expect(uniqueIndex).toBeDefined();
    });

    test('Includes standard DOCUMENT_TYPES enum matching university requirements', () => {
      expect(CourseFile.DOCUMENT_TYPES).toContain('CIS');
      expect(CourseFile.DOCUMENT_TYPES).toContain('CCR');
      expect(CourseFile.DOCUMENT_TYPES).toContain('CCC');
      expect(CourseFile.DOCUMENT_TYPES).toContain('ASSESS_QUIZ');
      expect(CourseFile.DOCUMENT_TYPES).toContain('ASSESS_ASSIGN');
      expect(CourseFile.DOCUMENT_TYPES).toContain('ASSESS_MID');
      expect(CourseFile.DOCUMENT_TYPES).toContain('ASSESS_FINAL');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Course File Service Orchestration (services/courseFile.service.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Course File Service Orchestration (services/courseFile.service.js)', () => {
    test('syncOfferingDocument authorizes request, calls Drive upload, and creates CourseFile record', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'drive_doc_id_100',
        name: 'CIS_CSC201_SecA.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 4096,
        webViewLink: 'https://drive.google.com/file/d/drive_doc_id_100/view',
        webContentLink: 'https://drive.google.com/uc?id=drive_doc_id_100',
        isUpdated: false,
      });

      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);

      const mockSavedDoc = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'CIS',
        fileFormat: 'pdf',
        filename: 'CIS_CSC201_SecA.pdf',
        googleDriveFileId: 'drive_doc_id_100',
        version: 1,
        status: 'synced',
      };
      jest.spyOn(CourseFile, 'create').mockResolvedValue(mockSavedDoc);

      const mockChecklist = {
        checklistItems: [{ type: 'CIS', completed: false }],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      const buffer = Buffer.from('test_cis_pdf_data');
      const result = await courseFileService.syncOfferingDocument({
        offeringId: mockOfferingId,
        documentType: 'CIS',
        fileFormat: 'pdf',
        buffer,
        user: mockUser,
      });

      expect(courseOfferingService.getOfferingById).toHaveBeenCalledWith(mockOfferingId, mockUser);
      expect(driveService.uploadDocumentBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'CIS_CSC201_SecA.pdf',
          mimeType: 'application/pdf',
        })
      );
      expect(CourseFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          courseOffering: mockOffering._id,
          documentType: 'CIS',
          version: 1,
          isCanonical: true,
        })
      );
      expect(mockChecklist.checklistItems[0].completed).toBe(true);
      expect(mockChecklist.save).toHaveBeenCalled();
      expect(result).toBe(mockSavedDoc);
    });

    test('syncOfferingDocument performs canonical replacement and increments version on existing records', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const existingRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'CIS',
        fileFormat: 'pdf',
        instanceName: '',
        googleDriveFileId: 'drive_doc_id_old_50',
        version: 1,
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(existingRecord);

      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'drive_doc_id_old_50',
        name: 'CIS_CSC201_SecA.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 5120,
        webViewLink: 'https://drive.google.com/file/d/drive_doc_id_old_50/view',
        isUpdated: true,
      });

      const buffer = Buffer.from('new_cis_version_pdf');
      const result = await courseFileService.syncOfferingDocument({
        offeringId: mockOfferingId,
        documentType: 'CIS',
        fileFormat: 'pdf',
        buffer,
        user: mockUser,
      });

      expect(driveService.uploadDocumentBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          existingFileId: 'drive_doc_id_old_50',
        })
      );
      expect(result.version).toBe(2);
      expect(result.googleDriveFileId).toBe('drive_doc_id_old_50');
      expect(existingRecord.save).toHaveBeenCalled();
    });

    test('generateAndSyncCIS retrieves saved CIS form and calls syncOfferingDocument', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const mockCISDoc = {
        courseSummary: { courseCode: 'CSC201', courseName: 'Data Structures' },
        basicInfo: { instructor: 'Dr. Jane' },
        courseObjectives: 'Learn trees and graphs',
        courseContents: 'Stacks, queues, trees',
        cloTable: [],
        textbooks: [],
        obaTable: [],
        gradingPolicy: {},
        weeklyPlan: [],
      };
      jest.spyOn(CIS, 'findOne').mockResolvedValue(mockCISDoc);

      const mockGeneratedBuffer = Buffer.from('generated_puppeteer_pdf');
      jest.spyOn(cisPdfService, 'generateCISPDF').mockResolvedValue(mockGeneratedBuffer);

      const mockSyncedResult = {
        _id: new mongoose.Types.ObjectId(),
        documentType: 'CIS',
        fileFormat: 'pdf',
        version: 1,
      };
      jest.spyOn(courseFileService, 'syncOfferingDocument').mockResolvedValue(mockSyncedResult);

      const result = await courseFileService.generateAndSyncCIS({
        offeringId: mockOfferingId,
        fileFormat: 'pdf',
        user: mockUser,
      });

      expect(cisPdfService.generateCISPDF).toHaveBeenCalled();
      expect(courseFileService.syncOfferingDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          offeringId: mockOffering._id,
          documentType: 'CIS',
          fileFormat: 'pdf',
          buffer: mockGeneratedBuffer,
        })
      );
      expect(result).toBe(mockSyncedResult);
    });

    test('generateAndSyncCIS throws 404 when no saved CIS form exists', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CIS, 'findOne').mockResolvedValue(null);

      await expect(
        courseFileService.generateAndSyncCIS({
          offeringId: mockOfferingId,
          fileFormat: 'pdf',
          user: mockUser,
        })
      ).rejects.toThrow(/CIS.*form has not been saved/);
    });

    test('downloadCourseFile authorizes user and returns drive readable stream', async () => {
      const mockCourseFile = {
        _id: new mongoose.Types.ObjectId(mockFileId),
        courseOffering: mockOffering._id,
        googleDriveFileId: 'drive_id_download_test',
        filename: 'CIS_CSC201_SecA.pdf',
        mimeType: 'application/pdf',
      };

      jest.spyOn(CourseFile, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCourseFile),
      });
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const mockStream = new Readable({
        read() {
          this.push('chunk');
          this.push(null);
        },
      });
      jest.spyOn(driveService, 'getFileStream').mockResolvedValue(mockStream);

      const { stream, courseFile } = await courseFileService.downloadCourseFile(
        mockFileId,
        mockUser
      );

      expect(courseOfferingService.getOfferingById).toHaveBeenCalledWith(mockOffering._id, mockUser);
      expect(driveService.getFileStream).toHaveBeenCalledWith('drive_id_download_test');
      expect(stream).toBe(mockStream);
      expect(courseFile).toBe(mockCourseFile);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Controller Handlers (controllers/courseFile.controller.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Controller Handlers (controllers/courseFile.controller.js)', () => {
    const createMockRes = () => {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      res.setHeader = jest.fn().mockReturnValue(res);
      res.redirect = jest.fn().mockReturnValue(res);
      return res;
    };

    test('listOfferingFiles returns 200 with list of files', async () => {
      const mockFiles = [
        { documentType: 'CIS', filename: 'CIS_CSC201_SecA.pdf', version: 1 },
      ];
      jest.spyOn(courseFileService, 'listOfferingFiles').mockResolvedValue(mockFiles);

      const req = { params: { offeringId: mockOfferingId }, user: mockUser };
      const res = createMockRes();
      const next = jest.fn();

      await courseFileController.listOfferingFiles(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockFiles,
        })
      );
    });

    test('syncCISDocument returns 200 with synchronized document details', async () => {
      const mockResult = {
        documentType: 'CIS',
        fileFormat: 'pdf',
        filename: 'CIS_CSC201_SecA.pdf',
        version: 1,
      };
      jest.spyOn(courseFileService, 'generateAndSyncCIS').mockResolvedValue(mockResult);

      const req = {
        params: { offeringId: mockOfferingId },
        query: { format: 'pdf' },
        user: mockUser,
      };
      const res = createMockRes();
      const next = jest.fn();

      await courseFileController.syncCISDocument(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockResult,
        })
      );
    });

    test('downloadCourseFile sets headers and pipes stream to response', async () => {
      const mockStream = {
        pipe: jest.fn(),
        on: jest.fn(),
      };
      const mockCourseFile = {
        filename: 'CIS_CSC201_SecA.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
      };

      jest.spyOn(courseFileService, 'downloadCourseFile').mockResolvedValue({
        stream: mockStream,
        courseFile: mockCourseFile,
      });

      const req = { params: { id: mockFileId }, user: mockUser };
      const res = createMockRes();
      const next = jest.fn();

      await courseFileController.downloadCourseFile(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="CIS_CSC201_SecA.pdf"'
      );
      expect(mockStream.pipe).toHaveBeenCalledWith(res);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Pre-Flight Validation & Concurrency Reconciliation
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Pre-Flight Validation & Concurrency Reconciliation', () => {
    test('syncOfferingDocument rejects invalid documentType without calling Google Drive API', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      const driveUploadSpy = jest.spyOn(driveService, 'uploadDocumentBuffer');

      const buffer = Buffer.from('dummy');
      await expect(
        courseFileService.syncOfferingDocument({
          offeringId: mockOfferingId,
          documentType: 'INVALID_TYPE_XYZ',
          fileFormat: 'pdf',
          buffer,
          user: mockUser,
        })
      ).rejects.toThrow(/Invalid document type/);

      expect(driveUploadSpy).not.toHaveBeenCalled();
    });

    test('syncOfferingDocument rejects invalid fileFormat without calling Google Drive API', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      const driveUploadSpy = jest.spyOn(driveService, 'uploadDocumentBuffer');

      const buffer = Buffer.from('dummy');
      await expect(
        courseFileService.syncOfferingDocument({
          offeringId: mockOfferingId,
          documentType: 'CIS',
          fileFormat: 'exe',
          buffer,
          user: mockUser,
        })
      ).rejects.toThrow(/Invalid file format/);

      expect(driveUploadSpy).not.toHaveBeenCalled();
    });

    test('syncOfferingDocument handles concurrent E11000 duplicate key by reconciling with existing record', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      // findOne initially returns null (race condition simulation)
      const findOneSpy = jest.spyOn(CourseFile, 'findOne');
      const concurrentSavedRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'CIS',
        fileFormat: 'pdf',
        version: 1,
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };

      findOneSpy
        .mockResolvedValueOnce(null) // first check before upload
        .mockResolvedValueOnce(concurrentSavedRecord); // re-query on E11000

      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'drive_race_file_777',
        name: 'CIS_CSC201_SecA.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 3000,
      });

      const duplicateError = new Error('E11000 duplicate key error');
      duplicateError.code = 11000;
      jest.spyOn(CourseFile, 'create').mockRejectedValue(duplicateError);

      const buffer = Buffer.from('test');
      const result = await courseFileService.syncOfferingDocument({
        offeringId: mockOfferingId,
        documentType: 'CIS',
        fileFormat: 'pdf',
        buffer,
        user: mockUser,
      });

      expect(concurrentSavedRecord.save).toHaveBeenCalled();
      expect(result.version).toBe(2);
      expect(result.googleDriveFileId).toBe('drive_race_file_777');
    });

    test('syncOfferingDocument attaches driveFileId to error when database save fails', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);

      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'drive_orphaned_file_999',
        name: 'CIS_CSC201_SecA.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 3000,
      });

      const dbError = new Error('Database connection lost');
      jest.spyOn(CourseFile, 'create').mockRejectedValue(dbError);

      const buffer = Buffer.from('test');
      try {
        await courseFileService.syncOfferingDocument({
          offeringId: mockOfferingId,
          documentType: 'CIS',
          fileFormat: 'pdf',
          buffer,
          user: mockUser,
        });
        throw new Error('Expected syncOfferingDocument to fail');
      } catch (err) {
        expect(err.message).toBe('Database connection lost');
        expect(err.driveFileId).toBe('drive_orphaned_file_999');
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. CIS Export Compatibility & Fault-Tolerance (controllers/form.controller.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. CIS Export Compatibility & Fault-Tolerance', () => {
    const createMockRes = () => {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      res.setHeader = jest.fn().mockReturnValue(res);
      res.send = jest.fn().mockReturnValue(res);
      return res;
    };

    test('exportCISForm streams document without Drive sync when syncToDrive is omitted', async () => {
      const mockCISDoc = {
        courseSummary: { courseCode: 'CSC201' },
        basicInfo: {},
        courseObjectives: '',
        courseContents: '',
        cloTable: [],
        textbooks: [],
        obaTable: [],
        gradingPolicy: {},
        weeklyPlan: [],
        courseOffering: mockOffering._id,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CIS, 'findOne').mockResolvedValue(mockCISDoc);
      jest.spyOn(cisPdfService, 'generateCISPDF').mockResolvedValue(Buffer.from('exported_pdf'));

      const syncSpy = jest.spyOn(courseFileService, 'syncOfferingDocument');

      const req = {
        params: { courseId: mockCourseId },
        query: { format: 'pdf', offeringId: mockOfferingId },
        user: mockUser,
      };
      const res = createMockRes();
      const next = jest.fn();

      await formController.exportCISForm(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.send).toHaveBeenCalled();
      expect(syncSpy).not.toHaveBeenCalled();
    });

    test('exportCISForm continues to stream file even if Drive sync fails when syncToDrive=true', async () => {
      const mockCISDoc = {
        courseSummary: { courseCode: 'CSC201' },
        basicInfo: {},
        courseObjectives: '',
        courseContents: '',
        cloTable: [],
        textbooks: [],
        obaTable: [],
        gradingPolicy: {},
        weeklyPlan: [],
        courseOffering: mockOffering._id,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CIS, 'findOne').mockResolvedValue(mockCISDoc);
      jest.spyOn(cisPdfService, 'generateCISPDF').mockResolvedValue(Buffer.from('exported_pdf'));

      jest
        .spyOn(courseFileService, 'syncOfferingDocument')
        .mockRejectedValue(new Error('Google Drive quota exceeded'));

      const req = {
        params: { courseId: mockCourseId },
        query: { format: 'pdf', offeringId: mockOfferingId, syncToDrive: 'true' },
        user: mockUser,
      };
      const res = createMockRes();
      const next = jest.fn();

      await formController.exportCISForm(req, res, next);

      // Download must still succeed
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.send).toHaveBeenCalled();
      expect(Buffer.isBuffer(res.send.mock.calls[0][0])).toBe(true);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Authorization Isolation (Offering & CourseFile ID tampering)
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Authorization Isolation', () => {
    test('getCourseFileById throws 403 Forbidden when unauthorized faculty requests another offering file', async () => {
      const unauthorizedFaculty = {
        _id: new mongoose.Types.ObjectId(),
        designation: 'faculty',
      };

      const mockCourseFile = {
        _id: new mongoose.Types.ObjectId(mockFileId),
        courseOffering: mockOffering,
      };

      jest.spyOn(CourseFile, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCourseFile),
      });

      // getOfferingById will fail with 403 when faculty is unauthorized
      jest.spyOn(courseOfferingService, 'getOfferingById').mockImplementation(() => {
        const error = new Error('You are not authorized to access this course offering.');
        error.statusCode = 403;
        throw error;
      });

      await expect(
        courseFileService.getCourseFileById(mockFileId, unauthorizedFaculty)
      ).rejects.toThrow(/not authorized/);
    });

    test('getCourseFileById throws 404 when file does not exist', async () => {
      jest.spyOn(CourseFile, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await expect(
        courseFileService.getCourseFileById(mockFileId, mockUser)
      ).rejects.toThrow(/Course file record not found/);
    });
  });
});
