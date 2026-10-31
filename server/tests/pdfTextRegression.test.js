/**
 * pdfTextRegression.test.js — Regression test suite for CIS and CCR PDF text rendering and Drive synchronization.
 *
 * Verifies that:
 *  1. Actual rendered HTML passed to Puppeteer contains all text from real Mongoose Document instances.
 *  2. CIS course summary, basic info, CLO table, textbooks, weekly plan, and grading policy render completely.
 *  3. CIS grading policy correctly maps `quizzes` (and legacy `quiz` fallback), never defaulting to 0% if saved.
 *  4. CCR course info, all weekly plan columns, special rows, and alternate rows render completely.
 *  5. formController.exportCISForm and exportCCRForm correctly convert Mongoose documents to plain objects.
 *  6. Drive synchronization (generateAndSyncCIS, generateAndSyncCCR) generates full PDFs, updates in place on re-sync,
 *     increments version, creates no duplicate records, and completes checklist items only after success.
 */

const mongoose = require('mongoose');
const handlebars = require('handlebars');
const CIS = require('../models/CIS.model');
const CCR = require('../models/CCR.model');
const CourseFile = require('../models/CourseFile.model');
const CourseChecklist = require('../models/CourseChecklist.model');
const CourseOffering = require('../models/CourseOffering.model');
const { generateCISPDF } = require('../services/documentService/generateCISPDF');
const { generateCCRPDF } = require('../services/documentService/generateCCRPDF');
const { Timetable } = require('../models/Timetable.model');
const { generateTimetablePDF, preprocessTimetableForPDF } = require('../services/documentService/generateTimetablePDF');
const formController = require('../controllers/form.controller');
const courseFileService = require('../services/courseFile.service');
const courseOfferingService = require('../services/courseOffering.service');
const driveService = require('../services/drive.service');

// Increase timeout for tests that launch Puppeteer headless browser
jest.setTimeout(30000);

describe('CIS and CCR PDF Text Regression & Drive Sync Suite', () => {
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

  let capturedHtml = '';
  let compileSpy;

  beforeAll(() => {
    const originalCompile = handlebars.compile;
    compileSpy = jest.spyOn(handlebars, 'compile').mockImplementation((templateStr, options) => {
      const compiled = originalCompile.call(handlebars, templateStr, options);
      return (data) => {
        const rendered = compiled(data);
        capturedHtml = rendered;
        return rendered;
      };
    });
  });

  afterAll(() => {
    if (compileSpy) compileSpy.mockRestore();
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = 'test_jwt_secret';
    process.env.GOOGLE_DRIVE_FOLDER_ID = 'test_folder_id';
    capturedHtml = '';
    jest.clearAllMocks();

    // Prevent unmocked Mongoose models from buffering indefinitely in tests
    jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue({
      checklistItems: [{ type: 'CIS', completed: false }, { type: 'CCR', completed: false }],
      save: jest.fn().mockResolvedValue(true),
    });
    jest.spyOn(CourseChecklist, 'findOneAndUpdate').mockResolvedValue({ _id: 'chk_1' });
    jest.spyOn(CourseOffering, 'countDocuments').mockResolvedValue(1);
    jest.spyOn(CourseOffering, 'findOne').mockResolvedValue(mockOffering);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. CIS PDF Generation & Field Rendering
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. CIS PDF Text Rendering', () => {
    const createRealMongooseCIS = (gradingOverrides = {}) => {
      return new CIS({
        course: new mongoose.Types.ObjectId(mockCourseId),
        faculty: new mongoose.Types.ObjectId(mockFacultyId),
        semester: new mongoose.Types.ObjectId(mockSemesterId),
        courseOffering: new mongoose.Types.ObjectId(mockOfferingId),
        section: 'A',
        formType: 'CIS',
        courseSummary: {
          courseCode: 'CSC301',
          courseName: 'Operating Systems',
          creditHours: '3(3-0)',
        },
        basicInfo: {
          instructor: 'Dr. Alan Turing',
          designation: 'Professor',
          prerequisites: 'Data Structures',
          semester: 'Fall 2026',
          email: 'turing@iqra.edu.pk',
          phone: '03001234567',
          consultingHours: 'MW 10:00 - 12:00',
          officeLocation: 'Room 402',
        },
        courseObjectives: 'Understand fundamental operating system principles.',
        courseContents: 'Processes, CPU scheduling, synchronization, deadlocks, memory management.',
        cloTable: [
          {
            cloNumber: 'CLO-1',
            cloStatement: 'Analyze concurrent processes and race conditions',
            btLevel: 'C4',
            gaMapping: 'GA2',
            acmKaMapping: 'OS/Concurrency',
            sgdMapping: 'SDG-4',
            weightPercentage: 25,
          },
          {
            cloNumber: 'CLO-2',
            cloStatement: 'Design deadlock avoidance algorithms',
            btLevel: 'C3',
            gaMapping: 'GA3',
            acmKaMapping: 'OS/Scheduling',
            sgdMapping: 'SDG-9',
            weightPercentage: 35,
          },
        ],
        textbooks: [
          {
            serialNo: '1',
            bookTitle: 'Modern Operating Systems',
            authors: 'Andrew S. Tanenbaum',
            editionPublicationPublisher: '4th Edition, Pearson',
          },
        ],
        obaTable: [
          {
            category: 'quiz',
            assessmentTool: 'Quiz 1',
            cloMapped: 'CLO-1',
            cloMarks: 10,
            weightPercentage: 5,
            totalMarks: 10,
            assessmentDate: 'Week 4',
          },
        ],
        weeklyPlan: [
          {
            week: '1',
            lectureNo: '1',
            topicCovered: 'Introduction to Operating Systems Architecture',
            clo: 'CLO-1',
            assessmentTool: 'Quiz 1',
            isSpecialRow: false,
          },
          {
            week: '8',
            lectureNo: '',
            topicCovered: '',
            clo: '',
            assessmentTool: '',
            isSpecialRow: true,
            specialRowText: 'Mid Semester Examination Week',
          },
        ],
        gradingPolicy: {
          quizzes: 15,
          assignments: 10,
          project: 10,
          midterm: 25,
          finalExam: 40,
          ...gradingOverrides,
        },
      });
    };

    test('generateCISPDF renders all text fields when passed a real Mongoose Document', async () => {
      const realDoc = createRealMongooseCIS();

      // Pass the raw Mongoose subdocuments inside exportData structure
      const exportData = {
        courseInfo: {
          ...(realDoc.courseSummary ? realDoc.courseSummary.toObject() : {}),
          ...(realDoc.basicInfo ? realDoc.basicInfo.toObject() : {}),
          courseObjectives: realDoc.courseObjectives,
          courseContents: realDoc.courseContents,
        },
        alternateData: {
          cloTable: realDoc.cloTable,
          textbooks: realDoc.textbooks,
          obaTable: realDoc.obaTable,
          gradingPolicy: realDoc.gradingPolicy,
        },
        weeklyData: realDoc.weeklyPlan,
      };

      const buffer = await generateCISPDF(exportData);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);

      const html = capturedHtml;

      // Course summary
      expect(html).toContain('CSC301');
      expect(html).toContain('Operating Systems');
      expect(html).toContain('3(3-0)');

      // Basic information
      expect(html).toContain('Dr. Alan Turing');
      expect(html).toContain('Professor');
      expect(html).toContain('Data Structures');
      expect(html).toContain('Fall 2026');
      expect(html).toContain('turing@iqra.edu.pk');
      expect(html).toContain('03001234567');
      expect(html).toContain('MW 10:00 - 12:00');
      expect(html).toContain('Room 402');

      // Objectives & contents
      expect(html).toContain('Understand fundamental operating system principles.');
      expect(html).toContain('Processes, CPU scheduling, synchronization');

      // CLO table rows
      expect(html).toContain('CLO-1');
      expect(html).toContain('Analyze concurrent processes and race conditions');
      expect(html).toContain('C4');
      expect(html).toContain('GA2');
      expect(html).toContain('OS/Concurrency');
      expect(html).toContain('SDG-4');
      expect(html).toContain('25%');

      // Textbook rows
      expect(html).toContain('Modern Operating Systems');
      expect(html).toContain('Andrew S. Tanenbaum');
      expect(html).toContain('4th Edition, Pearson');

      // Weekly plan rows & special rows
      expect(html).toContain('Introduction to Operating Systems Architecture');
      expect(html).toContain('Mid Semester Examination Week');

      // Grading policy: quizzes displaying saved 15%
      expect(html).toContain('15%');
      expect(html).toContain('40%');
    });

    test('generateCISPDF correctly renders gradingPolicy.quizzes and falls back to legacy quiz', async () => {
      // Case A: primary quizzes = 15
      const docA = createRealMongooseCIS({ quizzes: 15 });
      await generateCISPDF({
        courseInfo: {},
        alternateData: { gradingPolicy: docA.gradingPolicy },
        weeklyData: [],
      });
      expect(capturedHtml).toContain('15%');

      // Case B: legacy quiz = 12
      const legacyData = {
        courseInfo: {},
        alternateData: { gradingPolicy: { quiz: 12, assignments: 15 } },
        weeklyData: [],
      };
      await generateCISPDF(legacyData);
      expect(capturedHtml).toContain('12%');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. CCR PDF Generation & Field Rendering
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. CCR PDF Text Rendering', () => {
    const createRealMongooseCCR = () => {
      return new CCR({
        course: new mongoose.Types.ObjectId(mockCourseId),
        faculty: new mongoose.Types.ObjectId(mockFacultyId),
        semester: new mongoose.Types.ObjectId(mockSemesterId),
        courseOffering: new mongoose.Types.ObjectId(mockOfferingId),
        section: 'A',
        formType: 'CCR',
        courseInfo: {
          facultyName: 'Prof. Ada Lovelace',
          program: 'BS Computer Science',
          courseTitle: 'Design and Analysis of Algorithms',
          courseCode: 'CSC402',
          edpCode: 'EDP-7890',
          sessionDay: 'Wednesday',
          timeSlot: '11:00 - 14:00',
          location: 'Lab 5',
        },
        weeklyData: [
          {
            weekNo: '1',
            scheduleDate: '2026-09-02',
            timeIn: '11:00',
            timeOut: '14:00',
            topicCovered: 'Asymptotic Analysis and Recurrence Relations',
            activityType: 'Lecture',
            duration: '3',
            signature: 'AL',
            remarks: 'All topics covered on schedule',
            isSpecialRow: false,
          },
          {
            weekNo: '9',
            scheduleDate: '',
            timeIn: '',
            timeOut: '',
            topicCovered: '',
            activityType: 'Exam',
            duration: '',
            signature: '',
            remarks: '',
            isSpecialRow: true,
            specialRowText: 'Mid Semester Examination Period',
          },
        ],
        alternateData: [
          {
            rowNo: 1,
            scheduleDate: '2026-10-15',
            timeIn: '15:00',
            timeOut: '18:00',
            topicCovered: 'Dynamic Programming Makeup Session',
            activityType: 'Makeup',
            duration: '3',
            signature: 'AL',
            remarks: 'Conducted in Room 204',
          },
        ],
      });
    };

    test('generateCCRPDF renders all courseInfo, weeklyData, and alternateData fields from real Mongoose Document', async () => {
      const realDoc = createRealMongooseCCR();

      // Pass the raw Mongoose document fields directly
      const exportData = {
        courseInfo: realDoc.courseInfo,
        weeklyData: realDoc.weeklyData,
        alternateData: realDoc.alternateData,
      };

      const buffer = await generateCCRPDF(exportData);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);

      const html = capturedHtml;

      // Course information
      expect(html).toContain('Prof. Ada Lovelace');
      expect(html).toContain('BS Computer Science');
      expect(html).toContain('Design and Analysis of Algorithms');
      expect(html).toContain('CSC402');
      expect(html).toContain('EDP-7890');
      expect(html).toContain('Wednesday');
      expect(html).toContain('11:00 - 14:00');
      expect(html).toContain('Lab 5');

      // Weekly plan rows
      expect(html).toContain('Asymptotic Analysis and Recurrence Relations');
      expect(html).toContain('2026-09-02');
      expect(html).toContain('11:00');
      expect(html).toContain('14:00');
      expect(html).toContain('Lecture');
      expect(html).toContain('All topics covered on schedule');

      // Special row
      expect(html).toContain('Mid Semester Examination Period');

      // Alternate teacher / makeup class rows
      expect(html).toContain('Dynamic Programming Makeup Session');
      expect(html).toContain('2026-10-15');
      expect(html).toContain('Makeup');
      expect(html).toContain('Conducted in Room 204');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Controller Export Integration (CIS & CCR)
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Controller Export Endpoints with Mongoose toObject Conversion', () => {
    test('exportCISForm converts Mongoose document to plain object and passes it to generator', async () => {
      const realCISDoc = new CIS({
        course: new mongoose.Types.ObjectId(mockCourseId),
        faculty: new mongoose.Types.ObjectId(mockFacultyId),
        courseOffering: new mongoose.Types.ObjectId(mockOfferingId),
        section: 'A',
        courseSummary: { courseCode: 'CSC501', courseName: 'Advanced Database Systems' },
        basicInfo: { instructor: 'Dr. Codd', designation: 'Visiting Professor' },
        courseObjectives: 'RDBMS architecture and query optimization',
        courseContents: 'B-Trees, indexing, transactions',
        cloTable: [{ cloNumber: 'CLO-1', cloStatement: 'Query plan optimization' }],
        textbooks: [{ serialNo: '1', bookTitle: 'Database System Concepts' }],
        obaTable: [],
        weeklyPlan: [{ week: '1', lectureNo: '1', topicCovered: 'Relational Algebra' }],
        gradingPolicy: { quizzes: 20 },
      });

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(courseOfferingService, 'checkCourseAccess').mockResolvedValue({ authorized: true });
      jest.spyOn(courseOfferingService, 'resolveOfferingForLegacyContext').mockResolvedValue({
        ambiguous: false,
        offering: mockOffering,
      });

      // Mock findOne to return the real Mongoose Document instance
      jest.spyOn(CIS, 'findOne').mockResolvedValue(realCISDoc);

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

      await formController.exportCISForm(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.send).toHaveBeenCalled();

      // Check rendered HTML
      const html = capturedHtml;
      expect(html).toContain('CSC501');
      expect(html).toContain('Advanced Database Systems');
      expect(html).toContain('Dr. Codd');
      expect(html).toContain('Query plan optimization');
      expect(html).toContain('Database System Concepts');
      expect(html).toContain('Relational Algebra');
      expect(html).toContain('20%');
    });

    test('exportCCRForm converts Mongoose document to plain object and passes it to generator', async () => {
      const realCCRDoc = new CCR({
        course: new mongoose.Types.ObjectId(mockCourseId),
        faculty: new mongoose.Types.ObjectId(mockFacultyId),
        courseOffering: new mongoose.Types.ObjectId(mockOfferingId),
        section: 'A',
        courseInfo: {
          facultyName: 'Dr. John von Neumann',
          courseTitle: 'Theory of Computation',
          courseCode: 'CSC601',
        },
        weeklyData: [
          {
            weekNo: '1',
            topicCovered: 'Turing Machines and Decidability',
            activityType: 'Lecture',
            duration: '3',
          },
        ],
        alternateData: [],
      });

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(courseOfferingService, 'checkCourseAccess').mockResolvedValue({ authorized: true });
      jest.spyOn(courseOfferingService, 'resolveOfferingForLegacyContext').mockResolvedValue({
        ambiguous: false,
        offering: mockOffering,
      });

      jest.spyOn(CCR, 'findOne').mockResolvedValue(realCCRDoc);

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

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.send).toHaveBeenCalled();

      const html = capturedHtml;
      expect(html).toContain('Dr. John von Neumann');
      expect(html).toContain('Theory of Computation');
      expect(html).toContain('CSC601');
      expect(html).toContain('Turing Machines and Decidability');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Drive Synchronization (generateAndSyncCIS & generateAndSyncCCR)
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Drive Synchronization PDF Generation & Version In-Place Update', () => {
    test('generateAndSyncCIS converts Mongoose document to plain object and syncs PDF', async () => {
      const realCISDoc = new CIS({
        course: new mongoose.Types.ObjectId(mockCourseId),
        faculty: new mongoose.Types.ObjectId(mockFacultyId),
        courseOffering: new mongoose.Types.ObjectId(mockOfferingId),
        courseSummary: { courseCode: 'CSC701', courseName: 'Distributed Systems' },
        basicInfo: { instructor: 'Dr. Leslie Lamport' },
        courseObjectives: 'Consensus protocols and fault tolerance',
        courseContents: 'Paxos, Raft, vector clocks',
        cloTable: [{ cloNumber: 'CLO-1', cloStatement: 'Implement Raft consensus' }],
        textbooks: [{ serialNo: '1', bookTitle: 'Distributed Systems Principles' }],
        obaTable: [],
        weeklyPlan: [{ week: '1', lectureNo: '1', topicCovered: 'Logical Time' }],
        gradingPolicy: { quizzes: 15 },
      });

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CIS, 'findOne').mockResolvedValue(realCISDoc);

      // Mock driveService upload
      const mockUploadResult = {
        fileId: 'drive_file_cis_101',
        name: 'CIS_CSC701.pdf',
        webViewLink: 'https://drive.google.com/view/cis',
      };
      jest.spyOn(driveService, 'uploadDocumentBuffer').mockResolvedValue(mockUploadResult);

      // Mock CourseFile save/find
      let existingRecord = null;
      jest.spyOn(CourseFile, 'findOne').mockImplementation(() => existingRecord);
      jest.spyOn(CourseFile, 'create').mockImplementation((data) => {
        existingRecord = { ...data, _id: new mongoose.Types.ObjectId(), version: 1 };
        return Promise.resolve(existingRecord);
      });

      const syncResult = await courseFileService.generateAndSyncCIS({
        offeringId: mockOfferingId,
        fileFormat: 'pdf',
        user: mockUser,
      });

      expect(syncResult).toBeDefined();
      expect(syncResult.documentType).toBe('CIS');

      // Verify the generated PDF sent to Drive had the full rendered HTML
      const html = capturedHtml;
      expect(html).toContain('CSC701');
      expect(html).toContain('Distributed Systems');
      expect(html).toContain('Dr. Leslie Lamport');
      expect(html).toContain('Implement Raft consensus');
      expect(html).toContain('Distributed Systems Principles');
      expect(html).toContain('Logical Time');
      expect(html).toContain('15%');
    });

    test('generateAndSyncCCR converts Mongoose document to plain object and re-sync updates file in place', async () => {
      const realCCRDoc = new CCR({
        course: new mongoose.Types.ObjectId(mockCourseId),
        faculty: new mongoose.Types.ObjectId(mockFacultyId),
        courseOffering: new mongoose.Types.ObjectId(mockOfferingId),
        courseInfo: {
          facultyName: 'Dr. Barbara Liskov',
          courseTitle: 'Advanced Programming',
          courseCode: 'CSC801',
        },
        weeklyData: [
          {
            weekNo: '1',
            topicCovered: 'Data Abstraction and Subtyping',
            activityType: 'Lecture',
            duration: '3',
          },
        ],
        alternateData: [],
      });

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CCR, 'findOne').mockResolvedValue(realCCRDoc);

      let existingDriveFileId = 'drive_ccr_file_initial';
      const mockUploadSpy = jest.spyOn(driveService, 'uploadDocumentBuffer').mockImplementation((params) => {
        return Promise.resolve({
          fileId: params.existingFileId || existingDriveFileId,
          name: params.fileName,
          webViewLink: 'https://drive.google.com/view/ccr',
        });
      });

      // Track CourseFile records in-memory
      let savedRecord = null;
      jest.spyOn(CourseFile, 'findOne').mockImplementation(() => savedRecord);
      jest.spyOn(CourseFile, 'create').mockImplementation((data) => {
        savedRecord = {
          ...data,
          _id: new mongoose.Types.ObjectId(),
          save: jest.fn().mockImplementation(function() {
            return Promise.resolve(this);
          }),
        };
        return Promise.resolve(savedRecord);
      });
      const mockChecklist = {
        checklistItems: [{ type: 'CCR', completed: false }],
        save: jest.fn().mockResolvedValue(true),
      };
      const checklistFindSpy = jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      // First sync: creates record (version 1)
      const firstResult = await courseFileService.generateAndSyncCCR({
        offeringId: mockOfferingId,
        fileFormat: 'pdf',
        user: mockUser,
      });

      expect(firstResult.version).toBe(1);
      expect(checklistFindSpy).toHaveBeenCalledWith(
        expect.objectContaining({ courseOffering: mockOffering._id })
      );
      expect(mockChecklist.checklistItems[0].completed).toBe(true);
      expect(mockChecklist.save).toHaveBeenCalled();

      // Verify HTML content
      const html1 = capturedHtml;
      expect(html1).toContain('Dr. Barbara Liskov');
      expect(html1).toContain('Advanced Programming');
      expect(html1).toContain('CSC801');
      expect(html1).toContain('Data Abstraction and Subtyping');

      // Second sync (re-sync): must update in place with existingFileId, increment version to 2, no duplicate
      const secondResult = await courseFileService.generateAndSyncCCR({
        offeringId: mockOfferingId,
        fileFormat: 'pdf',
        user: mockUser,
      });

      expect(mockUploadSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          existingFileId: 'drive_ccr_file_initial',
        })
      );
      expect(secondResult.version).toBe(2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Timetable PDF Text Rendering & Drive Synchronization
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Timetable PDF Text Rendering & Drive Synchronization', () => {
    test('generateTimetablePDF renders all timeSlots with valid time ranges and labels from real Mongoose Document', async () => {
      const fs = require('fs');
      const path = require('path');
      const mongooseDoc = new Timetable({
        faculty: new mongoose.Types.ObjectId(mockFacultyId),
        semester: new mongoose.Types.ObjectId(mockSemesterId),
        facultyInfo: {
          facultyName: 'Dr. Jane Faculty',
          designation: 'Associate Professor',
          department: 'Department of Computer Science',
          facultySchool: 'Faculty of Engineering Sciences and Technology',
          academicTerm: 'Fall 2026',
        },
        timeSlots: [
          { slotId: 'slot_1', startTime: '08:30', endTime: '10:00', label: 'Slot 1', order: 1 },
          { slotId: 'slot_2', startTime: '10:00', endTime: '11:30', label: 'Slot 2', order: 2 },
          { slotId: 'slot_3', startTime: '11:30', endTime: '13:00', label: 'Slot 3', order: 3 },
        ],
        days: [
          { day: 'Monday', isOffDay: false },
          { day: 'Tuesday', isOffDay: false },
          { day: 'Saturday', isOffDay: true },
        ],
        activities: [
          {
            id: 'act_1',
            day: 'Monday',
            startSlotId: 'slot_1',
            endSlotId: 'slot_1',
            activityType: 'Class',
            title: 'Operating Systems',
            venue: 'Lab 3',
          },
        ],
        consultingHours: [
          {
            id: 'ch_1',
            day: 'Tuesday',
            startTime: '10:00',
            endTime: '11:30',
            location: 'Faculty Office 204',
          },
        ],
      });

      // 1. Verify preprocessor converts subdocuments to plain objects
      const preprocessed = preprocessTimetableForPDF(mongooseDoc);
      expect(preprocessed.timeSlots[0].label).toBe('Slot 1');
      expect(preprocessed.timeSlots[0].startTime).toBe('08:30');
      expect(preprocessed.timeSlots[0].endTime).toBe('10:00');
      expect(Object.prototype.hasOwnProperty.call(preprocessed.timeSlots[0], 'startTime')).toBe(true);

      // 2. Verify Handlebars template renders full time ranges, not '-'
      const templatePath = path.join(__dirname, '../services/documentService/templates/timetableTemplate.hbs');
      const templateHtml = fs.readFileSync(templatePath, 'utf8');
      const template = handlebars.compile(templateHtml);
      const renderedHtml = template(preprocessed);

      expect(renderedHtml).toContain('08:30-10:00');
      expect(renderedHtml).toContain('10:00-11:30');
      expect(renderedHtml).toContain('11:30-13:00');
      expect(renderedHtml).toContain('Slot 1');
      expect(renderedHtml).toContain('Slot 2');
      expect(renderedHtml).toContain('Operating Systems');
      expect(renderedHtml).not.toMatch(/<th>\s*-\s*<\/th>/);

      // 3. Verify actual PDF generation succeeds with real document
      const pdfBuffer = await generateTimetablePDF(mongooseDoc);
      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
      expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    test('generateAndSyncTimetable queries with populate/lean and re-sync updates file in place without duplicates', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);

      const realDoc = new Timetable({
        faculty: new mongoose.Types.ObjectId(mockFacultyId),
        semester: new mongoose.Types.ObjectId(mockSemesterId),
        facultyInfo: {
          facultyName: 'Dr. Jane Faculty',
          designation: 'Associate Professor',
          department: 'Department of Computer Science',
          facultySchool: 'Faculty of Engineering Sciences and Technology',
          academicTerm: 'Fall 2026',
        },
        timeSlots: [
          { slotId: 'slot_1', startTime: '08:30', endTime: '10:00', label: 'Slot 1', order: 1 },
          { slotId: 'slot_2', startTime: '10:00', endTime: '11:30', label: 'Slot 2', order: 2 },
        ],
        days: [
          { day: 'Monday', isOffDay: false },
          { day: 'Tuesday', isOffDay: false },
        ],
        activities: [],
        consultingHours: [],
      });

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(realDoc),
      };
      jest.spyOn(Timetable, 'findOne').mockReturnValue(mockQuery);

      let savedCourseFile = null;
      jest.spyOn(CourseFile, 'findOne').mockImplementation(() => Promise.resolve(savedCourseFile));
      jest.spyOn(CourseFile, 'create').mockImplementation(async (data) => {
        savedCourseFile = {
          ...data,
          _id: new mongoose.Types.ObjectId(),
          version: data.version || 1,
          save: jest.fn().mockImplementation(function () {
            return Promise.resolve(this);
          }),
        };
        return savedCourseFile;
      });

      const mockUploadSpy = jest.spyOn(driveService, 'uploadDocumentBuffer').mockImplementation(async (opts) => {
        return {
          fileId: opts.existingFileId || 'drive_tt_file_initial',
          name: opts.fileName,
          mimeType: opts.mimeType,
          sizeBytes: opts.buffer.length,
          webViewLink: 'https://drive.google.com/file/d/test/view',
          webContentLink: 'https://drive.google.com/uc?id=test',
          isUpdated: Boolean(opts.existingFileId),
        };
      });

      const mockChecklist = {
        checklistItems: [{ type: 'TIMETABLE', completed: false }],
        save: jest.fn().mockResolvedValue(true),
      };
      const checklistFindSpy = jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockChecklist);

      // First sync: creates record (version 1)
      const firstResult = await courseFileService.generateAndSyncTimetable({
        offeringId: mockOfferingId,
        fileFormat: 'pdf',
        user: mockUser,
      });

      expect(mockQuery.populate).toHaveBeenCalledWith('semester', 'name status');
      expect(mockQuery.lean).toHaveBeenCalled();
      expect(firstResult.version).toBe(1);
      expect(checklistFindSpy).toHaveBeenCalledWith(
        expect.objectContaining({ courseOffering: mockOffering._id })
      );
      expect(mockChecklist.checklistItems[0].completed).toBe(true);
      expect(mockChecklist.save).toHaveBeenCalled();

      // Second sync (re-sync): must update in place with existingFileId, increment version to 2, no duplicate
      const secondResult = await courseFileService.generateAndSyncTimetable({
        offeringId: mockOfferingId,
        fileFormat: 'pdf',
        user: mockUser,
      });

      expect(mockUploadSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          existingFileId: 'drive_tt_file_initial',
        })
      );
      expect(secondResult.version).toBe(2);
    });
  });
});
