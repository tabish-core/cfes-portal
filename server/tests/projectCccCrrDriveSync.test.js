/**
 * projectCccCrrDriveSync.test.js — Test suite for Google Drive PDF Synchronization
 * of CCP/Class Project (ASSESS_PROJECT), Course Completion Certificate (CCC), and Course Review Report (CRR).
 */

const mongoose = require('mongoose');
const driveService = require('../services/drive.service');
const courseFileService = require('../services/courseFile.service');
const courseFileController = require('../controllers/courseFile.controller');
const courseOfferingService = require('../services/courseOffering.service');
const CourseFile = require('../models/CourseFile.model');
const CourseChecklist = require('../models/CourseChecklist.model');
const CourseOffering = require('../models/CourseOffering.model');
const CCP = require('../models/CCP.model');
const CCC = require('../models/CCC.model');
const CourseReviewReport = require('../models/CRR.model');
const ccpPdfService = require('../services/documentService/generateCCPPDF');
const cccPdfService = require('../services/documentService/generateCCCPDF');
const crrPdfService = require('../services/documentService/generateCRRPDF');

describe('Google Drive PDF Synchronization: CCP, CCC, and CRR', () => {
  const originalEnv = process.env;

  const mockOfferingId = new mongoose.Types.ObjectId().toString();
  const mockCourseId = new mongoose.Types.ObjectId().toString();
  const mockFacultyId = new mongoose.Types.ObjectId().toString();
  const mockSemesterId = new mongoose.Types.ObjectId().toString();
  const mockDepartmentId = new mongoose.Types.ObjectId().toString();

  const mockFacultyUser = {
    _id: new mongoose.Types.ObjectId(mockFacultyId),
    name: 'Engr. Sarah Faculty',
    email: 'sarah@iu.edu.pk',
    designation: 'faculty',
    department: new mongoose.Types.ObjectId(mockDepartmentId),
  };

  const mockHodUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Dr. Head of Department',
    email: 'hod@iu.edu.pk',
    designation: 'hod',
    department: new mongoose.Types.ObjectId(mockDepartmentId),
  };

  const mockDeanUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Prof. Dean',
    email: 'dean@iu.edu.pk',
    designation: 'dean',
  };

  const mockUnauthorizedUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Dr. Other Faculty',
    email: 'other@iu.edu.pk',
    designation: 'faculty',
    department: new mongoose.Types.ObjectId(),
  };

  const mockOffering = {
    _id: new mongoose.Types.ObjectId(mockOfferingId),
    course: {
      _id: new mongoose.Types.ObjectId(mockCourseId),
      courseCode: 'CS301',
      courseName: 'Software Engineering',
      department: new mongoose.Types.ObjectId(mockDepartmentId),
    },
    faculty: {
      _id: new mongoose.Types.ObjectId(mockFacultyId),
      name: 'Engr. Sarah Faculty',
    },
    semester: {
      _id: new mongoose.Types.ObjectId(mockSemesterId),
      name: 'Fall 2026',
    },
    section: 'A',
  };

  const mockCcpDoc = {
    _id: new mongoose.Types.ObjectId(),
    courseOffering: new mongoose.Types.ObjectId(mockOfferingId),
    formType: 'ASSESS_PROJECT',
    headerInfo: {
      department: 'Computer Science',
      program: 'BSCS',
      courseTitle: 'Software Engineering',
      courseCode: 'CS301',
      announcedDate: '2026-09-15',
      dueDate: '2026-11-20',
      totalMarks: '100',
    },
    mappingTable: {
      mappedClo: 'CLO-3',
      sdg: 'SDG-9',
      knowledgeProfile: 'WK5',
      complexProblemSolvingMapped: 'WP1, WP3',
    },
    problemStatement: 'Design and implement an automated CI/CD pipeline.',
    constraintsAssumptions: 'Must support Docker containers.',
    computationalTools: 'Git, Jenkins, Docker',
    expectedOutcomes: 'Working end-to-end pipeline.',
    deliverables: {
      heading: 'Report (must include)',
      items: [
        { label: 'Introduction', required: true, completed: true },
        { label: 'Methodology', required: true, completed: false },
      ],
    },
    wpAttributes: [
      { code: 'WP1', title: 'Range of Conflicting Requirements', isMapped: true, justification: 'Multiple microservices.' },
    ],
    save: jest.fn().mockResolvedValue(true),
  };

  const mockCccDoc = {
    _id: new mongoose.Types.ObjectId(),
    courseOffering: new mongoose.Types.ObjectId(mockOfferingId),
    formType: 'CCC',
    courseInfo: {
      facultyName: 'Engr. Sarah Faculty',
      courseTitle: 'Software Engineering',
      courseCode: 'CS301',
      program: 'BSCS',
      semesterName: 'Fall 2026',
    },
    certificateData: {
      sessionsHeld: '30',
      totalRequiredSessions: '30',
      date: '2026-12-01',
      endTermReviewFilled: 'Yes',
    },
    save: jest.fn().mockResolvedValue(true),
  };

  const mockCrrDoc = {
    _id: new mongoose.Types.ObjectId(),
    courseOffering: new mongoose.Types.ObjectId(mockOfferingId),
    formType: 'CRR',
    courseInfo: {
      teacherName: 'Engr. Sarah Faculty',
      department: 'Computer Science',
      courseTitle: 'Software Engineering',
      courseCode: 'CS301',
      creditHours: '3',
      semester: 'Fall 2026',
      noOfStudents: '45',
    },
    assessmentSummary: [
      { clo: 'CLO 1', cloAttainment: '78%', mappedGAs: 'GA1', gaAttainment: '75%', assessmentName: 'Quiz 1' },
    ],
    gradeSummary: {
      'A+': '5',
      'A': '12',
      'B+': '10',
      'B': '8',
      'C+': '5',
      'C': '3',
      'F': '2',
      classAverage: '72.4',
    },
    courseLearningOutcomes: {
      outcomesAdequate: 'Yes',
      revisionSuggestion: 'None',
      cloAttainmentStatus: 'Satisfied',
      cloAttainmentReason: 'Most students met benchmark.',
      ploAttainmentStatus: 'Satisfied',
      ploAttainmentReason: 'Target achieved.',
    },
    courseEnhancement: {
      courseEnhancementComment: 'Add more practical lab exercises.',
      implementationComments: 'Plan scheduled for next term.',
      appropriatenessComments: 'Appropriate.',
    },
    signatureInfo: {
      instructorDate: '2026-12-05',
      hodDate: '2026-12-06',
    },
    save: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = 'test_secret_project_ccc_crr';
    process.env.GOOGLE_DRIVE_FOLDER_ID = 'test_root_drive_folder_id';
    jest.clearAllMocks();
    jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(null);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Model Verification
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Model & Document Types Verification', () => {
    test('CourseFile.DOCUMENT_TYPES includes ASSESS_PROJECT, CCC, and CRR', () => {
      expect(CourseFile.DOCUMENT_TYPES).toContain('ASSESS_PROJECT');
      expect(CourseFile.DOCUMENT_TYPES).toContain('CCC');
      expect(CourseFile.DOCUMENT_TYPES).toContain('CRR');
      expect(CourseFile.DOCUMENT_TYPES).toContain('CCP'); // Retained for backward compatibility
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. CCP / Class Project (ASSESS_PROJECT)
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. CCP / Class Project (ASSESS_PROJECT) Synchronization', () => {
    test('successfully generates PDF and synchronizes CCP to Google Drive', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CCP, 'findOne').mockResolvedValue(mockCcpDoc);

      const mockPdfBuffer = Buffer.from('mock_ccp_pdf_binary');
      const ccpGenSpy = jest.spyOn(ccpPdfService, 'generateCCPPDF').mockResolvedValue(mockPdfBuffer);

      const mockCourseFile = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'ASSESS_PROJECT',
        fileFormat: 'pdf',
        filename: 'ASSESS_PROJECT_CS301_SecA.pdf',
        googleDriveFileId: 'drive_file_ccp_123',
        version: 1,
        status: 'synced',
      };
      const syncSpy = jest.spyOn(courseFileService, 'syncOfferingDocument').mockResolvedValue(mockCourseFile);

      const result = await courseFileService.generateAndSyncProject({
        offeringId: mockOfferingId,
        user: mockFacultyUser,
      });

      expect(courseOfferingService.getOfferingById).toHaveBeenCalledWith(mockOfferingId, mockFacultyUser);
      expect(ccpGenSpy).toHaveBeenCalled();
      expect(syncSpy).toHaveBeenCalledWith({
        offeringId: mockOffering._id,
        documentType: 'ASSESS_PROJECT',
        fileFormat: 'pdf',
        instanceName: '',
        buffer: mockPdfBuffer,
        user: mockFacultyUser,
      });
      expect(result.documentType).toBe('ASSESS_PROJECT');
      expect(result.filename).toBe('ASSESS_PROJECT_CS301_SecA.pdf');
    });

    test('updates CourseChecklist item ASSESS_PROJECT to completed: true upon sync', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'new_drive_ccp_file_id',
        name: 'ASSESS_PROJECT_CS301_SecA.pdf',
        mimeType: 'application/pdf',
        webViewLink: 'https://drive.google.com/view/ccp',
        webContentLink: 'https://drive.google.com/download/ccp',
        sizeBytes: 2048,
      });

      const mockCreatedFile = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'ASSESS_PROJECT',
        fileFormat: 'pdf',
        filename: 'ASSESS_PROJECT_CS301_SecA.pdf',
        googleDriveFileId: 'new_drive_ccp_file_id',
        version: 1,
        status: 'synced',
      };
      jest.spyOn(CourseFile, 'create').mockResolvedValue(mockCreatedFile);

      const mockChecklist = {
        courseOffering: mockOffering._id,
        checklistItems: [
          { name: 'Course Information Sheet', type: 'CIS', completed: false },
          { name: 'CCP/Class Project/PBL', type: 'ASSESS_PROJECT', completed: false },
        ],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      await courseFileService.syncOfferingDocument({
        offeringId: mockOfferingId,
        documentType: 'ASSESS_PROJECT',
        fileFormat: 'pdf',
        instanceName: '',
        buffer: Buffer.from('test_buffer'),
        user: mockFacultyUser,
      });

      const projectItem = mockChecklist.checklistItems.find((i) => i.type === 'ASSESS_PROJECT');
      expect(projectItem.completed).toBe(true);
      expect(mockChecklist.save).toHaveBeenCalled();
    });

    test('re-sync updates existing record in-place and increments version without duplicates', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const existingRecord = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'ASSESS_PROJECT',
        fileFormat: 'pdf',
        googleDriveFileId: 'original_drive_file_id',
        version: 1,
        status: 'synced',
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(existingRecord);
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'original_drive_file_id',
        name: 'ASSESS_PROJECT_CS301_SecA.pdf',
        mimeType: 'application/pdf',
        webViewLink: 'https://drive.google.com/view/ccp',
        webContentLink: 'https://drive.google.com/download/ccp',
        sizeBytes: 2500,
      });

      const res = await courseFileService.syncOfferingDocument({
        offeringId: mockOfferingId,
        documentType: 'ASSESS_PROJECT',
        fileFormat: 'pdf',
        instanceName: '',
        buffer: Buffer.from('updated_buffer'),
        user: mockFacultyUser,
      });

      expect(res.version).toBe(2);
      expect(driveService.uploadDocumentBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          existingFileId: 'original_drive_file_id',
          filename: 'ASSESS_PROJECT_CS301_SecA.pdf',
        })
      );
    });

    test('throws 404 if CCP form has not been saved yet', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CCP, 'findOne').mockResolvedValue(null);
      jest.spyOn(CourseOffering, 'countDocuments').mockResolvedValue(0);

      await expect(
        courseFileService.generateAndSyncProject({
          offeringId: mockOfferingId,
          user: mockFacultyUser,
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('Class Project form has not been saved'),
      });
    });

    test('throws 403 if unauthorized user attempts to sync CCP', async () => {
      const err = new Error('You are not authorized to access this course offering.');
      err.statusCode = 403;
      jest.spyOn(courseOfferingService, 'getOfferingById').mockRejectedValue(err);

      await expect(
        courseFileService.generateAndSyncProject({
          offeringId: mockOfferingId,
          user: mockUnauthorizedUser,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Course Completion Certificate (CCC)
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Course Completion Certificate (CCC) Synchronization', () => {
    test('successfully generates PDF and synchronizes CCC to Google Drive', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CCC, 'findOne').mockResolvedValue(mockCccDoc);

      const mockPdfBuffer = Buffer.from('mock_ccc_pdf_binary');
      const cccGenSpy = jest.spyOn(cccPdfService, 'generateCCCPDF').mockResolvedValue(mockPdfBuffer);

      const mockCourseFile = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'CCC',
        fileFormat: 'pdf',
        filename: 'CCC_CS301_SecA.pdf',
        googleDriveFileId: 'drive_file_ccc_456',
        version: 1,
        status: 'synced',
      };
      const syncSpy = jest.spyOn(courseFileService, 'syncOfferingDocument').mockResolvedValue(mockCourseFile);

      const result = await courseFileService.generateAndSyncCCC({
        offeringId: mockOfferingId,
        user: mockFacultyUser,
      });

      expect(courseOfferingService.getOfferingById).toHaveBeenCalledWith(mockOfferingId, mockFacultyUser);
      expect(cccGenSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          courseInfo: expect.objectContaining({ courseCode: 'CS301' }),
          certificateData: expect.objectContaining({ sessionsHeld: '30' }),
        })
      );
      expect(syncSpy).toHaveBeenCalledWith({
        offeringId: mockOffering._id,
        documentType: 'CCC',
        fileFormat: 'pdf',
        instanceName: '',
        buffer: mockPdfBuffer,
        user: mockFacultyUser,
      });
      expect(result.documentType).toBe('CCC');
      expect(result.filename).toBe('CCC_CS301_SecA.pdf');
    });

    test('updates CourseChecklist item CCC to completed: true upon sync', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'new_drive_ccc_file_id',
        name: 'CCC_CS301_SecA.pdf',
        mimeType: 'application/pdf',
        webViewLink: 'https://drive.google.com/view/ccc',
        webContentLink: 'https://drive.google.com/download/ccc',
        sizeBytes: 1500,
      });

      const mockCreatedFile = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'CCC',
        fileFormat: 'pdf',
        filename: 'CCC_CS301_SecA.pdf',
        googleDriveFileId: 'new_drive_ccc_file_id',
        version: 1,
        status: 'synced',
      };
      jest.spyOn(CourseFile, 'create').mockResolvedValue(mockCreatedFile);

      const mockChecklist = {
        courseOffering: mockOffering._id,
        checklistItems: [
          { name: 'Course Completion Certificate', type: 'CCC', completed: false },
        ],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      await courseFileService.syncOfferingDocument({
        offeringId: mockOfferingId,
        documentType: 'CCC',
        fileFormat: 'pdf',
        instanceName: '',
        buffer: Buffer.from('ccc_buffer'),
        user: mockFacultyUser,
      });

      const cccItem = mockChecklist.checklistItems.find((i) => i.type === 'CCC');
      expect(cccItem.completed).toBe(true);
      expect(mockChecklist.save).toHaveBeenCalled();
    });

    test('throws 404 if CCC form has not been saved yet', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CCC, 'findOne').mockResolvedValue(null);
      jest.spyOn(CourseOffering, 'countDocuments').mockResolvedValue(0);

      await expect(
        courseFileService.generateAndSyncCCC({
          offeringId: mockOfferingId,
          user: mockFacultyUser,
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('Course Completion Certificate (CCC) has not been saved'),
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Course Review Report (CRR)
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Course Review Report (CRR) Synchronization', () => {
    test('successfully generates PDF and synchronizes CRR to Google Drive', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CourseReviewReport, 'findOne').mockResolvedValue(mockCrrDoc);

      const mockPdfBuffer = Buffer.from('mock_crr_pdf_binary');
      const crrGenSpy = jest.spyOn(crrPdfService, 'generateCRRPDF').mockResolvedValue(mockPdfBuffer);

      const mockCourseFile = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'CRR',
        fileFormat: 'pdf',
        filename: 'CRR_CS301_SecA.pdf',
        googleDriveFileId: 'drive_file_crr_789',
        version: 1,
        status: 'synced',
      };
      const syncSpy = jest.spyOn(courseFileService, 'syncOfferingDocument').mockResolvedValue(mockCourseFile);

      const result = await courseFileService.generateAndSyncCRR({
        offeringId: mockOfferingId,
        user: mockFacultyUser,
      });

      expect(courseOfferingService.getOfferingById).toHaveBeenCalledWith(mockOfferingId, mockFacultyUser);
      expect(crrGenSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          courseInfo: expect.objectContaining({ courseCode: 'CS301' }),
          assessmentSummary: expect.any(Array),
          gradeSummary: expect.objectContaining({ classAverage: '72.4' }),
          courseLearningOutcomes: expect.objectContaining({ outcomesAdequate: 'Yes' }),
        })
      );
      expect(syncSpy).toHaveBeenCalledWith({
        offeringId: mockOffering._id,
        documentType: 'CRR',
        fileFormat: 'pdf',
        instanceName: '',
        buffer: mockPdfBuffer,
        user: mockFacultyUser,
      });
      expect(result.documentType).toBe('CRR');
      expect(result.filename).toBe('CRR_CS301_SecA.pdf');
    });

    test('updates CourseChecklist item CRR to completed: true upon sync', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CourseFile, 'findOne').mockResolvedValue(null);
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue({
        fileId: 'new_drive_crr_file_id',
        name: 'CRR_CS301_SecA.pdf',
        mimeType: 'application/pdf',
        webViewLink: 'https://drive.google.com/view/crr',
        webContentLink: 'https://drive.google.com/download/crr',
        sizeBytes: 3200,
      });

      const mockCreatedFile = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: mockOffering._id,
        documentType: 'CRR',
        fileFormat: 'pdf',
        filename: 'CRR_CS301_SecA.pdf',
        googleDriveFileId: 'new_drive_crr_file_id',
        version: 1,
        status: 'synced',
      };
      jest.spyOn(CourseFile, 'create').mockResolvedValue(mockCreatedFile);

      const mockChecklist = {
        courseOffering: mockOffering._id,
        checklistItems: [
          { name: 'Course Review Report', type: 'CRR', completed: false },
        ],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      await courseFileService.syncOfferingDocument({
        offeringId: mockOfferingId,
        documentType: 'CRR',
        fileFormat: 'pdf',
        instanceName: '',
        buffer: Buffer.from('crr_buffer'),
        user: mockFacultyUser,
      });

      const crrItem = mockChecklist.checklistItems.find((i) => i.type === 'CRR');
      expect(crrItem.completed).toBe(true);
      expect(mockChecklist.save).toHaveBeenCalled();
    });

    test('throws 404 if CRR form has not been saved yet', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CourseReviewReport, 'findOne').mockResolvedValue(null);
      jest.spyOn(CourseOffering, 'countDocuments').mockResolvedValue(0);

      await expect(
        courseFileService.generateAndSyncCRR({
          offeringId: mockOfferingId,
          user: mockFacultyUser,
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('Course Review Report (CRR) has not been saved'),
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Controller Endpoints
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Controller Endpoints Integration', () => {
    test('POST /api/course-files/sync/project/:offeringId returns 200 with result', async () => {
      const mockResult = {
        _id: 'cf_project_1',
        documentType: 'ASSESS_PROJECT',
        fileFormat: 'pdf',
        filename: 'ASSESS_PROJECT_CS301_SecA.pdf',
      };
      jest.spyOn(courseFileService, 'generateAndSyncProject').mockResolvedValue(mockResult);

      const req = {
        params: { offeringId: mockOfferingId },
        user: mockFacultyUser,
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await courseFileController.syncProjectDocument(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockResult,
        })
      );
    });

    test('POST /api/course-files/sync/ccc/:offeringId returns 200 with result', async () => {
      const mockResult = {
        _id: 'cf_ccc_1',
        documentType: 'CCC',
        fileFormat: 'pdf',
        filename: 'CCC_CS301_SecA.pdf',
      };
      jest.spyOn(courseFileService, 'generateAndSyncCCC').mockResolvedValue(mockResult);

      const req = {
        params: { offeringId: mockOfferingId },
        user: mockFacultyUser,
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await courseFileController.syncCCCDocument(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockResult,
        })
      );
    });

    test('POST /api/course-files/sync/crr/:offeringId returns 200 with result', async () => {
      const mockResult = {
        _id: 'cf_crr_1',
        documentType: 'CRR',
        fileFormat: 'pdf',
        filename: 'CRR_CS301_SecA.pdf',
      };
      jest.spyOn(courseFileService, 'generateAndSyncCRR').mockResolvedValue(mockResult);

      const req = {
        params: { offeringId: mockOfferingId },
        user: mockFacultyUser,
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await courseFileController.syncCRRDocument(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockResult,
        })
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Role-Based Permissions (HOD and Dean access)
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Role-Based Permissions', () => {
    test('HOD of the department is authorized to sync documents', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CCP, 'findOne').mockResolvedValue(mockCcpDoc);
      jest.spyOn(ccpPdfService, 'generateCCPPDF').mockResolvedValue(Buffer.from('pdf'));
      jest.spyOn(courseFileService, 'syncOfferingDocument').mockResolvedValue({
        documentType: 'ASSESS_PROJECT',
        version: 1,
      });

      const result = await courseFileService.generateAndSyncProject({
        offeringId: mockOfferingId,
        user: mockHodUser,
      });

      expect(courseOfferingService.getOfferingById).toHaveBeenCalledWith(mockOfferingId, mockHodUser);
      expect(result.documentType).toBe('ASSESS_PROJECT');
    });

    test('Dean is globally authorized to sync documents across any department', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CCC, 'findOne').mockResolvedValue(mockCccDoc);
      jest.spyOn(cccPdfService, 'generateCCCPDF').mockResolvedValue(Buffer.from('pdf'));
      jest.spyOn(courseFileService, 'syncOfferingDocument').mockResolvedValue({
        documentType: 'CCC',
        version: 1,
      });

      const result = await courseFileService.generateAndSyncCCC({
        offeringId: mockOfferingId,
        user: mockDeanUser,
      });

      expect(courseOfferingService.getOfferingById).toHaveBeenCalledWith(mockOfferingId, mockDeanUser);
      expect(result.documentType).toBe('CCC');
    });
  });
});
