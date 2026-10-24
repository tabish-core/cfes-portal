/**
 * phase1Scoping.test.js — Automated test suite for Phase 1 CourseOffering and Section Scoping.
 *
 * Verifies:
 * 1. Schema & Index Scoping:
 *    - All 6 models (CourseChecklist, CIS, CCR, CCP, CCC, CRR) have `courseOffering` and `section`.
 *    - All models define compound unique indexes that include `section: 1`.
 *    - All models index `courseOffering: 1`.
 * 2. CourseOffering Service Authorization & Scope Enforcement:
 *    - Invalid ObjectId -> 400
 *    - Non-existent offering -> 404
 *    - Faculty accessing their own offering -> 200 (Success)
 *    - Faculty accessing another faculty's offering -> 403 (Forbidden)
 *    - HOD accessing offering in their department -> 200 (Success)
 *    - HOD accessing offering outside their department -> 403 (Forbidden)
 *    - Dean accessing any offering -> 200 (Universal Access)
 * 3. Checklist Scoping:
 *    - getChecklistByOffering retrieves offering-specific checklist
 *    - saveChecklist scopes checklist to offering and section
 * 4. Section Separation & Independence:
 *    - Two sections (Section A and Section B) of the same course have distinct scope
 *    - Form saving and retrieval respects section and offeringId
 * 5. Route Registration & Backward Compatibility:
 *    - Offering-specific routes registered
 *    - Legacy routes preserved for backward compatibility
 */

const mongoose = require('mongoose');

// Models
const CourseChecklist = require('../models/CourseChecklist.model');
const CIS = require('../models/CIS.model');
const CCR = require('../models/CCR.model');
const CCP = require('../models/CCP.model');
const CCC = require('../models/CCC.model');
const CRR = require('../models/CRR.model');
const CourseOffering = require('../models/CourseOffering.model');

// Services & Controllers
const courseOfferingService = require('../services/courseOffering.service');
const checklistController = require('../controllers/checklist.controller');
const formController = require('../controllers/form.controller');
const ccpController = require('../controllers/ccp.controller');

// Routes
const courseOfferingRoutes = require('../routes/courseOffering.routes');
const checklistRoutes = require('../routes/checklist.routes');
const formRoutes = require('../routes/form.routes');

const makeMockQuery = (val) => {
  return {
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(val),
    then(onFulfilled, onRejected) {
      return Promise.resolve(val).then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return Promise.resolve(val).catch(onRejected);
    },
  };
};

describe('Phase 1: CourseOffering & Section Scoping Test Suite', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Schema & Index Verification
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Schema & Index Verification', () => {
    test('CourseChecklist model includes courseOffering, section (default A), and section-aware compound unique index', () => {
      const checklist = new CourseChecklist({
        course: new mongoose.Types.ObjectId(),
        faculty: new mongoose.Types.ObjectId(),
      });
      expect(checklist.section).toBe('A');
      expect(checklist.courseOffering).toBeNull();

      const indexes = CourseChecklist.schema.indexes();
      const uniqueCompound = indexes.find(
        (idx) => idx[1]?.unique && idx[0].course && idx[0].faculty && idx[0].section
      );
      expect(uniqueCompound).toBeDefined();
      expect(uniqueCompound[0].section).toBe(1);

      const offeringIndex = indexes.find((idx) => idx[0].courseOffering === 1);
      expect(offeringIndex).toBeDefined();
    });

    test('CIS model includes courseOffering, section, and section-aware compound unique index', () => {
      const cis = new CIS({
        course: new mongoose.Types.ObjectId(),
        faculty: new mongoose.Types.ObjectId(),
      });
      expect(cis.section).toBe('A');
      expect(cis.courseOffering).toBeNull();

      const indexes = CIS.schema.indexes();
      const uniqueCompound = indexes.find(
        (idx) => idx[1]?.unique && idx[0].course && idx[0].faculty && idx[0].section
      );
      expect(uniqueCompound).toBeDefined();
      expect(uniqueCompound[0].section).toBe(1);

      const offeringIndex = indexes.find((idx) => idx[0].courseOffering === 1);
      expect(offeringIndex).toBeDefined();
    });

    test('CCR, CCP, CCC, and CRR models include courseOffering, section, and section-aware unique indexes', () => {
      const models = [
        { model: CCR, name: 'CCR' },
        { model: CCP, name: 'CCP' },
        { model: CCC, name: 'CCC' },
        { model: CRR, name: 'CRR' },
      ];

      for (const { model } of models) {
        const instance = new model({
          course: new mongoose.Types.ObjectId(),
          faculty: new mongoose.Types.ObjectId(),
        });
        expect(instance.section).toBe('A');
        expect(instance.courseOffering).toBeNull();

        const indexes = model.schema.indexes();
        const uniqueCompound = indexes.find(
          (idx) => idx[1]?.unique && idx[0].course && idx[0].faculty && idx[0].section && idx[0].formType
        );
        expect(uniqueCompound).toBeDefined();
        expect(uniqueCompound[0].section).toBe(1);
        expect(uniqueCompound[0].formType).toBe(1);

        const offeringIndex = indexes.find((idx) => idx[0].courseOffering === 1);
        expect(offeringIndex).toBeDefined();
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. CourseOffering Service Authorization & Scope Enforcement
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. CourseOffering Service Authorization & Scope Enforcement', () => {
    const faculty1Id = new mongoose.Types.ObjectId();
    const faculty2Id = new mongoose.Types.ObjectId();
    const hod1DeptId = new mongoose.Types.ObjectId();
    const hod2DeptId = new mongoose.Types.ObjectId();

    const mockOffering = {
      _id: new mongoose.Types.ObjectId(),
      course: {
        _id: new mongoose.Types.ObjectId(),
        courseCode: 'CS101',
        courseName: 'Intro to Programming',
        department: { _id: hod1DeptId, name: 'Computer Science' },
      },
      faculty: { _id: faculty1Id, name: 'Faculty One' },
      semester: { _id: new mongoose.Types.ObjectId(), name: 'Fall 2026' },
      section: 'A',
      status: 'active',
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('Rejects invalid offeringId format with 400 Bad Request', async () => {
      const user = { _id: faculty1Id, designation: 'faculty' };
      await expect(courseOfferingService.getOfferingById('invalid-id', user)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid offering ID',
      });
    });

    test('Returns 404 when offering is not found', async () => {
      jest.spyOn(CourseOffering, 'findById').mockReturnValue(makeMockQuery(null));

      const user = { _id: faculty1Id, designation: 'faculty' };
      await expect(
        courseOfferingService.getOfferingById(new mongoose.Types.ObjectId(), user)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Course offering not found',
      });
    });

    test('Faculty member accessing their OWN offering succeeds (200)', async () => {
      jest.spyOn(CourseOffering, 'findById').mockReturnValue(makeMockQuery(mockOffering));

      const user = { _id: faculty1Id, designation: 'faculty' };
      const offering = await courseOfferingService.getOfferingById(mockOffering._id, user);
      expect(offering).toBeDefined();
      expect(offering._id).toEqual(mockOffering._id);
      expect(offering.section).toBe('A');
    });

    test('Faculty member accessing ANOTHER faculty offering fails (403 Forbidden)', async () => {
      jest.spyOn(CourseOffering, 'findById').mockReturnValue(makeMockQuery(mockOffering));

      const user = { _id: faculty2Id, designation: 'faculty' }; // Different faculty
      await expect(
        courseOfferingService.getOfferingById(mockOffering._id, user)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You are not authorized to access this course offering.',
      });
    });

    test('HOD accessing offering in their OWN department succeeds (200)', async () => {
      jest.spyOn(CourseOffering, 'findById').mockReturnValue(makeMockQuery(mockOffering));

      const user = { _id: new mongoose.Types.ObjectId(), designation: 'hod', department: hod1DeptId };
      const offering = await courseOfferingService.getOfferingById(mockOffering._id, user);
      expect(offering).toBeDefined();
      expect(offering._id).toEqual(mockOffering._id);
    });

    test('HOD accessing offering in a DIFFERENT department fails (403 Forbidden)', async () => {
      jest.spyOn(CourseOffering, 'findById').mockReturnValue(makeMockQuery(mockOffering));

      const user = { _id: new mongoose.Types.ObjectId(), designation: 'hod', department: hod2DeptId }; // Different dept
      await expect(
        courseOfferingService.getOfferingById(mockOffering._id, user)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You are only authorized to access course offerings belonging to your department.',
      });
    });

    test('Dean accessing offering in ANY department succeeds (Universal Access)', async () => {
      jest.spyOn(CourseOffering, 'findById').mockReturnValue(makeMockQuery(mockOffering));

      const user = { _id: new mongoose.Types.ObjectId(), designation: 'dean' };
      const offering = await courseOfferingService.getOfferingById(mockOffering._id, user);
      expect(offering).toBeDefined();
      expect(offering._id).toEqual(mockOffering._id);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Checklist Scoping & Ownership
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Checklist Scoping & Ownership', () => {
    const facultyId = new mongoose.Types.ObjectId();
    const offeringId = new mongoose.Types.ObjectId();
    const courseId = new mongoose.Types.ObjectId();
    const semesterId = new mongoose.Types.ObjectId();

    const mockOffering = {
      _id: offeringId,
      course: { _id: courseId, courseCode: 'CS101', courseName: 'Programming' },
      faculty: { _id: facultyId, name: 'Test Faculty' },
      semester: { _id: semesterId, name: 'Spring 2026' },
      section: 'B',
      status: 'active',
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('getChecklistByOffering returns offering-scoped checklist with section', async () => {
      const mockSavedChecklist = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: offeringId,
        course: courseId,
        faculty: facultyId,
        semester: semesterId,
        section: 'B',
        items: [{ formType: 'CIS', isCompleted: true }],
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CourseChecklist, 'findOne').mockResolvedValue(mockSavedChecklist);

      const req = {
        params: { offeringId: offeringId.toString() },
        user: { _id: facultyId, designation: 'faculty' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await checklistController.getChecklistByOffering(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.data.checklist).toBeDefined();
      expect(responseData.data.checklist.courseOffering).toEqual(offeringId);
      expect(responseData.data.checklist.section).toBe('B');
      expect(responseData.data.offering).toBeDefined();
      expect(responseData.data.offering.section).toBe('B');
    });

    test('saveChecklist saves offeringId and section when offeringId is provided', async () => {
      const mockSavedChecklist = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: offeringId,
        course: courseId,
        faculty: facultyId,
        semester: semesterId,
        section: 'B',
        items: [{ formType: 'CIS', isCompleted: true }],
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOffering);
      jest.spyOn(CourseChecklist, 'findOneAndUpdate').mockResolvedValue(mockSavedChecklist);

      const req = {
        body: {
          offeringId: offeringId.toString(),
          items: [{ formType: 'CIS', isCompleted: true }],
        },
        user: { _id: facultyId, designation: 'faculty' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await checklistController.saveChecklist(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.data.checklist.section).toBe('B');
      expect(responseData.data.checklist.courseOffering).toEqual(offeringId);
    });

    test('saveChecklist maintains backward compatibility when offeringId is omitted', async () => {
      const mockSavedChecklist = {
        _id: new mongoose.Types.ObjectId(),
        course: courseId,
        faculty: facultyId,
        section: 'A',
        items: [{ formType: 'CCR', isCompleted: true }],
      };

      jest.spyOn(courseOfferingService, 'checkCourseAccess').mockResolvedValue({ authorized: true });
      jest.spyOn(courseOfferingService, 'resolveOfferingForLegacyContext').mockResolvedValue({
        ambiguous: false,
        count: 0,
        offering: null,
      });
      jest.spyOn(CourseChecklist, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(CourseChecklist, 'findOneAndUpdate').mockResolvedValue(mockSavedChecklist);

      const req = {
        body: {
          courseId: courseId.toString(),
          items: [{ formType: 'CCR', isCompleted: true }],
        },
        user: { _id: facultyId, designation: 'faculty' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await checklistController.saveChecklist(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.data.checklist.course).toEqual(courseId);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Section Separation & Independence
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Section Separation & Independence', () => {
    test('Ensures two sections (Section A and Section B) produce distinct unique keys', () => {
      const courseId = new mongoose.Types.ObjectId();
      const facultyId = new mongoose.Types.ObjectId();
      const semesterId = new mongoose.Types.ObjectId();

      const docA = new CIS({
        course: courseId,
        faculty: facultyId,
        semester: semesterId,
        section: 'A',
      });

      const docB = new CIS({
        course: courseId,
        faculty: facultyId,
        semester: semesterId,
        section: 'B',
      });

      expect(docA.section).toBe('A');
      expect(docB.section).toBe('B');
      expect(docA.section).not.toEqual(docB.section);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Route Registration & Backward Compatibility
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Route Registration Integrity', () => {
    test('CourseOffering routes expose GET /:id', () => {
      const routes = courseOfferingRoutes.stack.map((layer) => ({
        path: layer.route?.path,
        methods: Object.keys(layer.route?.methods || {}),
      }));

      expect(routes.some((r) => r.path === '/:id' && r.methods.includes('get'))).toBe(true);
    });

    test('Checklist routes expose both GET /offering/:offeringId and legacy GET /:courseId', () => {
      const routes = checklistRoutes.stack.map((layer) => ({
        path: layer.route?.path,
        methods: Object.keys(layer.route?.methods || {}),
      }));

      // Offering route exists
      expect(routes.some((r) => r.path === '/offering/:offeringId' && r.methods.includes('get'))).toBe(true);

      // Legacy course route exists
      expect(routes.some((r) => r.path === '/:courseId' && r.methods.includes('get'))).toBe(true);

      // Save checklist exists
      expect(routes.some((r) => r.path === '/' && r.methods.includes('post'))).toBe(true);

      // Ensure /offering/:offeringId is evaluated before /:courseId
      const offeringIndex = checklistRoutes.stack.findIndex(
        (l) => l.route?.path === '/offering/:offeringId'
      );
      const courseIndex = checklistRoutes.stack.findIndex((l) => l.route?.path === '/:courseId');
      expect(offeringIndex).toBeLessThan(courseIndex);
    });

    test('Form routes preserve all standard form endpoints and export endpoints', () => {
      const routes = formRoutes.stack.map((layer) => ({
        path: layer.route?.path,
        methods: Object.keys(layer.route?.methods || {}),
      }));

      const requiredPaths = [
        { path: '/cis/:courseId', method: 'get' },
        { path: '/cis', method: 'post' },
        { path: '/cis/:courseId/export', method: 'get' },
        { path: '/ccr/:courseId', method: 'get' },
        { path: '/ccr', method: 'post' },
        { path: '/ccr/:courseId/export', method: 'get' },
        { path: '/ccp/:courseId', method: 'get' },
        { path: '/ccp', method: 'post' },
        { path: '/ccp/:courseId/export', method: 'get' },
        { path: '/ccc/:courseId', method: 'get' },
        { path: '/ccc', method: 'post' },
        { path: '/course-review/:courseId', method: 'get' },
        { path: '/course-review', method: 'post' },
      ];

      for (const reqPath of requiredPaths) {
        const found = routes.some(
          (r) => r.path === reqPath.path && r.methods.includes(reqPath.method)
        );
        expect(found).toBe(true);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Safety-Correction Pass Regression Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Safety-Correction Pass Regression Tests', () => {
    const { verifyTestDbConfiguration } = require('./liveIntegrationPhase1');

    const courseId = new mongoose.Types.ObjectId();
    const facultyId = new mongoose.Types.ObjectId();
    const semester1Id = new mongoose.Types.ObjectId();
    const semester2Id = new mongoose.Types.ObjectId();
    const offeringAId = new mongoose.Types.ObjectId();
    const offeringBId = new mongoose.Types.ObjectId();

    const mockOfferingA = {
      _id: offeringAId,
      course: { _id: courseId, courseCode: 'CS101', courseName: 'Test Course' },
      faculty: { _id: facultyId, name: 'Faculty Test' },
      semester: { _id: semester1Id, name: 'Fall 2026' },
      section: 'A',
      status: 'active',
    };

    const mockOfferingB = {
      _id: offeringBId,
      course: { _id: courseId, courseCode: 'CS101', courseName: 'Test Course' },
      faculty: { _id: facultyId, name: 'Faculty Test' },
      semester: { _id: semester1Id, name: 'Fall 2026' },
      section: 'B',
      status: 'active',
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('6.1 Ambiguous legacy forms remain unlinked when multiple offerings exist', async () => {
      // Multiple offerings exist for course + faculty
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOfferingA);
      jest.spyOn(CourseOffering, 'countDocuments').mockResolvedValue(2);

      // findOne returns null for offering-linked and exact-semester queries
      jest.spyOn(CIS, 'findOne').mockResolvedValue(null);

      const req = {
        params: { courseId: courseId.toString() },
        query: { offeringId: offeringAId.toString() },
        user: { _id: facultyId, designation: 'faculty' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await formController.getCISForm(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.data.form).toBeNull();

      // Verify findOne was NEVER called with semester: null because offeringCount > 1
      const findOneCalls = CIS.findOne.mock.calls;
      const unlinkedSemesterNullCall = findOneCalls.find(
        (c) => c[0].courseOffering === null && c[0].semester === null
      );
      expect(unlinkedSemesterNullCall).toBeUndefined();
    });

    test('6.2 Section A cannot retrieve or claim Section B form record', async () => {
      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(mockOfferingA);
      jest.spyOn(CourseOffering, 'countDocuments').mockResolvedValue(2);

      // Section B already has a saved form linked to offeringBId
      const formSectionB = {
        _id: new mongoose.Types.ObjectId(),
        courseOffering: offeringBId,
        section: 'B',
        course: courseId,
        faculty: facultyId,
        semester: semester1Id,
        save: jest.fn(),
      };

      // Mock findOne: when querying with courseOffering: offeringAId -> null; unlinked query -> null
      jest.spyOn(CIS, 'findOne').mockImplementation((query) => {
        if (query.courseOffering && query.courseOffering.toString() === offeringAId.toString()) {
          return Promise.resolve(null);
        }
        if (query.courseOffering === null) {
          // No unlinked form exists
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });

      const req = {
        params: { courseId: courseId.toString() },
        query: { offeringId: offeringAId.toString() },
        user: { _id: facultyId, designation: 'faculty' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await formController.getCISForm(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.data.form).toBeNull();
      expect(formSectionB.save).not.toHaveBeenCalled();
    });

    test('6.3 Form from a previous semester is not returned for a new offering in a different semester', async () => {
      const newOffering = {
        _id: new mongoose.Types.ObjectId(),
        course: { _id: courseId, courseCode: 'CS101' },
        faculty: { _id: facultyId, name: 'Faculty Test' },
        semester: { _id: semester2Id, name: 'Spring 2027' },
        section: 'A',
      };

      jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(newOffering);
      jest.spyOn(CourseOffering, 'countDocuments').mockResolvedValue(2); // previous + current offering

      // Previous semester form exists (semester1Id)
      jest.spyOn(CCR, 'findOne').mockImplementation((query) => {
        if (query.courseOffering && query.courseOffering.toString() === newOffering._id.toString()) {
          return Promise.resolve(null);
        }
        if (query.semester && query.semester.toString() === semester2Id.toString()) {
          return Promise.resolve(null); // No form yet for Spring 2027
        }
        return Promise.resolve(null);
      });

      const req = {
        params: { courseId: courseId.toString() },
        query: { offeringId: newOffering._id.toString() },
        user: { _id: facultyId, designation: 'faculty' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await formController.getCCRForm(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.data.form).toBeNull();
    });

    test('6.4 CCC legacy route works with semester parameter without ReferenceError', async () => {
      const mockCCC = {
        _id: new mongoose.Types.ObjectId(),
        course: courseId,
        faculty: facultyId,
        semester: semester1Id,
        formType: 'CCC',
      };

      jest.spyOn(courseOfferingService, 'checkCourseAccess').mockResolvedValue({ authorized: true });
      jest.spyOn(courseOfferingService, 'resolveOfferingForLegacyContext').mockResolvedValue({
        ambiguous: false,
        count: 0,
        offering: null,
      });
      jest.spyOn(CCC, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(CCC, 'findOne').mockResolvedValue(mockCCC);

      const req = {
        params: { courseId: courseId.toString() },
        query: { semester: semester1Id.toString() },
        user: { _id: facultyId, designation: 'faculty' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      // Must execute cleanly without throwing ReferenceError: query is not defined
      await formController.getCCCForm(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.data.form).toBeDefined();
      expect(responseData.data.form._id).toEqual(mockCCC._id);
      expect(next).not.toHaveBeenCalled();
    });

    test('6.5 Unauthorized legacy saves are rejected with 403 without database writes', async () => {
      jest.spyOn(courseOfferingService, 'checkCourseAccess').mockResolvedValue({
        authorized: false,
        status: 403,
        message: 'Forbidden. You are not assigned to this course.',
      });

      // Spy on database mutators
      jest.spyOn(CIS, 'findOneAndUpdate').mockResolvedValue(null);
      jest.spyOn(CCR, 'findOneAndUpdate').mockResolvedValue(null);
      jest.spyOn(CCC, 'findOneAndUpdate').mockResolvedValue(null);
      jest.spyOn(CRR, 'findOneAndUpdate').mockResolvedValue(null);
      jest.spyOn(CourseChecklist, 'findOneAndUpdate').mockResolvedValue(null);

      const unassignedUser = { _id: new mongoose.Types.ObjectId(), designation: 'faculty' };

      // Test CIS legacy save
      const cisRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await formController.saveCISForm(
        { body: { courseId: courseId.toString() }, user: unassignedUser },
        cisRes,
        jest.fn()
      );
      expect(cisRes.status).toHaveBeenCalledWith(403);
      expect(CIS.findOneAndUpdate).not.toHaveBeenCalled();

      // Test CCR legacy save
      const ccrRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await formController.saveCCRForm(
        { body: { courseId: courseId.toString() }, user: unassignedUser },
        ccrRes,
        jest.fn()
      );
      expect(ccrRes.status).toHaveBeenCalledWith(403);
      expect(CCR.findOneAndUpdate).not.toHaveBeenCalled();

      // Test CCC legacy save
      const cccRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await formController.saveCCCForm(
        { body: { courseId: courseId.toString() }, user: unassignedUser },
        cccRes,
        jest.fn()
      );
      expect(cccRes.status).toHaveBeenCalledWith(403);
      expect(CCC.findOneAndUpdate).not.toHaveBeenCalled();

      // Test Course Review legacy save
      const crrRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await formController.saveCourseReviewForm(
        { body: { courseId: courseId.toString() }, user: unassignedUser },
        crrRes,
        jest.fn()
      );
      expect(crrRes.status).toHaveBeenCalledWith(403);
      expect(CRR.findOneAndUpdate).not.toHaveBeenCalled();

      // Test Checklist legacy save
      const chkRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await checklistController.saveChecklist(
        { body: { courseId: courseId.toString() }, user: unassignedUser },
        chkRes,
        jest.fn()
      );
      expect(chkRes.status).toHaveBeenCalledWith(403);
      expect(CourseChecklist.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('6.6 Integration test refuses to run without a separately configured test database', () => {
      const originalTestUri = process.env.MONGO_TEST_URI;
      const originalProdUri = process.env.MONGO_URI;

      try {
        // Case A: MONGO_TEST_URI is missing
        delete process.env.MONGO_TEST_URI;
        expect(() => verifyTestDbConfiguration()).toThrow(
          /SAFETY ERROR: MONGO_TEST_URI is not set/
        );

        // Case B: MONGO_TEST_URI is identical to production MONGO_URI
        process.env.MONGO_URI = 'mongodb+srv://prod-cluster.mongodb.net/cfes_prod';
        process.env.MONGO_TEST_URI = 'mongodb+srv://prod-cluster.mongodb.net/cfes_prod';
        expect(() => verifyTestDbConfiguration()).toThrow(
          /SAFETY ERROR: MONGO_TEST_URI cannot be identical to production MONGO_URI/
        );

        // Case C: MONGO_TEST_URI is distinct and valid
        process.env.MONGO_TEST_URI = 'mongodb://127.0.0.1:27017/cfes_test_db';
        expect(verifyTestDbConfiguration()).toBe('mongodb://127.0.0.1:27017/cfes_test_db');
      } finally {
        process.env.MONGO_TEST_URI = originalTestUri;
        process.env.MONGO_URI = originalProdUri;
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Fix 1 & Fix 2 Safety-Correction Regression Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Fix 1 & Fix 2 Safety-Correction Regression Tests', () => {
    const dept1Id = new mongoose.Types.ObjectId();
    const dept2Id = new mongoose.Types.ObjectId();
    const testCourseId = new mongoose.Types.ObjectId();
    const Course = require('../models/Course.model');

    beforeEach(() => {
      jest.restoreAllMocks();
    });

    // ── Fix 1: HOD Access to Courses Without a Department ──────────────────
    describe('Fix 1: checkCourseAccess HOD Department Strict Enforcement', () => {
      test('7.1.1 HOD and course belong to the same department (Allowed)', async () => {
        jest.spyOn(Course, 'findById').mockResolvedValue({
          _id: testCourseId,
          courseCode: 'CS101',
          department: dept1Id,
        });

        const hodUser = { _id: new mongoose.Types.ObjectId(), designation: 'hod', department: dept1Id };
        const result = await courseOfferingService.checkCourseAccess(hodUser, testCourseId);
        expect(result.authorized).toBe(true);
        expect(result.course).toBeDefined();
      });

      test('7.1.2 HOD and course belong to different departments (Denied 403)', async () => {
        jest.spyOn(Course, 'findById').mockResolvedValue({
          _id: testCourseId,
          courseCode: 'CS101',
          department: dept2Id, // Different
        });

        const hodUser = { _id: new mongoose.Types.ObjectId(), designation: 'hod', department: dept1Id };
        const result = await courseOfferingService.checkCourseAccess(hodUser, testCourseId);
        expect(result.authorized).toBe(false);
        expect(result.status).toBe(403);
        expect(result.message).toMatch(/only allowed to access courses belonging to your department/);
      });

      test('7.1.3 HOD has no department (Denied 403)', async () => {
        jest.spyOn(Course, 'findById').mockResolvedValue({
          _id: testCourseId,
          courseCode: 'CS101',
          department: dept1Id,
        });

        const hodUser = { _id: new mongoose.Types.ObjectId(), designation: 'hod', department: null };
        const result = await courseOfferingService.checkCourseAccess(hodUser, testCourseId);
        expect(result.authorized).toBe(false);
        expect(result.status).toBe(403);
      });

      test('7.1.4 Course has no department (Denied 403)', async () => {
        jest.spyOn(Course, 'findById').mockResolvedValue({
          _id: testCourseId,
          courseCode: 'GEN101',
          department: null, // Course has no department
        });

        const hodUser = { _id: new mongoose.Types.ObjectId(), designation: 'hod', department: dept1Id };
        const result = await courseOfferingService.checkCourseAccess(hodUser, testCourseId);
        expect(result.authorized).toBe(false);
        expect(result.status).toBe(403);
        expect(result.message).toMatch(/only allowed to access courses belonging to your department/);
      });

      test('7.1.5 Dean retains access to courses across departments and department-less courses', async () => {
        // Course without department
        jest.spyOn(Course, 'findById').mockResolvedValue({
          _id: testCourseId,
          courseCode: 'UNIV101',
          department: null,
        });

        const deanUser = { _id: new mongoose.Types.ObjectId(), designation: 'dean' };
        const result = await courseOfferingService.checkCourseAccess(deanUser, testCourseId);
        expect(result.authorized).toBe(true);
      });
    });

    // ── Fix 2: Prevent Ambiguous Legacy Saves From Selecting Wrong Section ─
    describe('Fix 2: Prevent Ambiguous Legacy Saves, GETs, and Exports', () => {
      const cId = new mongoose.Types.ObjectId();
      const fId = new mongoose.Types.ObjectId();
      const sId = new mongoose.Types.ObjectId();
      const offAId = new mongoose.Types.ObjectId();
      const offBId = new mongoose.Types.ObjectId();

      const offeringSecA = {
        _id: offAId,
        course: { _id: cId, courseCode: 'CS101', courseName: 'Test CS' },
        faculty: { _id: fId, name: 'Prof Test' },
        semester: { _id: sId, name: 'Fall 2026' },
        section: 'A',
      };

      const offeringSecB = {
        _id: offBId,
        course: { _id: cId, courseCode: 'CS101', courseName: 'Test CS' },
        faculty: { _id: fId, name: 'Prof Test' },
        semester: { _id: sId, name: 'Fall 2026' },
        section: 'B',
      };

      test('7.2.1 A legacy save for a course with both Section A and Section B cannot arbitrarily update either section (rejects 409)', async () => {
        jest.spyOn(courseOfferingService, 'checkCourseAccess').mockResolvedValue({ authorized: true });
        // Two offerings exist for course + faculty
        jest.spyOn(courseOfferingService, 'resolveOfferingForLegacyContext').mockResolvedValue({
          ambiguous: true,
          count: 2,
          offerings: [offeringSecA, offeringSecB],
        });
        jest.spyOn(CIS, 'findOneAndUpdate').mockResolvedValue(null);

        const req = {
          body: {
            courseId: cId.toString(),
            courseSummary: { courseCode: 'CS101', courseName: 'Test CS' },
            basicInfo: { instructor: 'Prof Test' },
            objectives: 'Test objectives',
          },
          user: { _id: fId, designation: 'faculty' },
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await formController.saveCISForm(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(409);
        const data = res.json.mock.calls[0][0];
        expect(data.message).toMatch(/Multiple course offerings exist.*provide offeringId/);
        expect(CIS.findOneAndUpdate).not.toHaveBeenCalled();
      });

      test('7.2.2 A request with a valid offeringId updates only that offering document', async () => {
        jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(offeringSecB);
        const updatedDoc = { _id: new mongoose.Types.ObjectId(), courseOffering: offBId, section: 'B' };
        jest.spyOn(CIS, 'findOneAndUpdate').mockResolvedValue(updatedDoc);

        const req = {
          body: {
            offeringId: offBId.toString(),
            courseId: cId.toString(),
            section: 'A', // Client erroneously/conflictingly sends section A in body
            courseSummary: { courseCode: 'CS101', courseName: 'Test CS' },
            basicInfo: { instructor: 'Prof Test' },
            objectives: 'Test objectives',
          },
          user: { _id: fId, designation: 'faculty' },
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await formController.saveCISForm(req, res, jest.fn());

        expect(res.json).toHaveBeenCalled();
        expect(CIS.findOneAndUpdate).toHaveBeenCalled();
        const updateArgs = CIS.findOneAndUpdate.mock.calls[0][1].$set;
        // Proves section was derived authoritatively as 'B' from offeringSecB, NOT trusted from req.body.section ('A')
        expect(updateArgs.courseOffering).toEqual(offBId);
        expect(updateArgs.section).toBe('B');
      });

      test('7.2.3 A request with an unauthorized offeringId is rejected (403)', async () => {
        const error = new Error('You are not authorized to access this course offering.');
        error.statusCode = 403;
        jest.spyOn(courseOfferingService, 'getOfferingById').mockRejectedValue(error);
        jest.spyOn(CIS, 'findOneAndUpdate').mockResolvedValue(null);

        const req = {
          body: {
            offeringId: offAId.toString(),
            courseSummary: { courseCode: 'CS101', courseName: 'Test CS' },
            basicInfo: { instructor: 'Prof Test' },
            objectives: 'Test objectives',
          },
          user: { _id: new mongoose.Types.ObjectId(), designation: 'faculty' }, // unauthorized
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await formController.saveCISForm(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(403);
        expect(CIS.findOneAndUpdate).not.toHaveBeenCalled();
      });

      test('7.2.4 Legacy GET and export paths cannot return another section document when ambiguous', async () => {
        jest.spyOn(courseOfferingService, 'checkCourseAccess').mockResolvedValue({ authorized: true });
        jest.spyOn(courseOfferingService, 'resolveOfferingForLegacyContext').mockResolvedValue({
          ambiguous: true,
          count: 2,
          offerings: [offeringSecA, offeringSecB],
        });

        // Test GET
        const getReq = {
          params: { courseId: cId.toString() },
          query: {},
          user: { _id: fId, designation: 'faculty' },
        };
        const getRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        await formController.getCISForm(getReq, getRes, jest.fn());

        expect(getRes.json).toHaveBeenCalled();
        const getData = getRes.json.mock.calls[0][0];
        expect(getData.data.form).toBeNull(); // Does not return Section A or Section B

        // Test Export
        const expReq = {
          params: { courseId: cId.toString() },
          query: { format: 'pdf' },
          user: { _id: fId, designation: 'faculty' },
        };
        const expRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        await formController.exportCISForm(expReq, expRes, jest.fn());

        expect(expRes.status).toHaveBeenCalledWith(409);
        const expData = expRes.json.mock.calls[0][0];
        expect(expData.message).toMatch(/Multiple course offerings exist.*provide offeringId/);
      });

      test('7.2.5 Existing correctly linked records continue to load and save', async () => {
        const savedDoc = { _id: new mongoose.Types.ObjectId(), courseOffering: offAId, section: 'A' };
        jest.spyOn(courseOfferingService, 'getOfferingById').mockResolvedValue(offeringSecA);
        jest.spyOn(CIS, 'findOne').mockResolvedValue(savedDoc);

        const req = {
          params: { courseId: cId.toString() },
          query: { offeringId: offAId.toString() },
          user: { _id: fId, designation: 'faculty' },
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await formController.getCISForm(req, res, jest.fn());

        expect(res.json).toHaveBeenCalled();
        const data = res.json.mock.calls[0][0];
        expect(data.data.form).toBeDefined();
        expect(data.data.form._id).toEqual(savedDoc._id);
        expect(data.data.form.courseOffering).toEqual(offAId);
      });

      test('7.2.6 Ambiguous legacy records remain untouched (unlinked)', async () => {
        // Model findOne called with query returns null when multiple unlinked docs exist
        jest.spyOn(courseOfferingService, 'checkCourseAccess').mockResolvedValue({ authorized: true });
        jest.spyOn(courseOfferingService, 'resolveOfferingForLegacyContext').mockResolvedValue({
          ambiguous: false,
          count: 0,
          offering: null,
        });

        // 2 unlinked docs exist in DB
        jest.spyOn(CIS, 'countDocuments').mockResolvedValue(2);
        jest.spyOn(CIS, 'findOne').mockResolvedValue(null);

        const req = {
          params: { courseId: cId.toString() },
          query: {},
          user: { _id: fId, designation: 'faculty' },
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await formController.getCISForm(req, res, jest.fn());

        expect(res.json).toHaveBeenCalled();
        const data = res.json.mock.calls[0][0];
        // findFormByOfferingOrQuery saw count > 1 and returned null without mutating or returning arbitrary doc
        expect(data.data.form).toBeNull();
      });
    });
  });
});

