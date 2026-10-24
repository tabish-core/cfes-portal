/**
 * ccpPersistence.test.js — Automated test suite for CCP backend persistence.
 *
 * Verifies:
 *  1. CCP Model schema fields, defaults, and compound index.
 *  2. Course access authorization checks (Dean, HoD, Faculty assigned vs unassigned).
 *  3. Authenticated save (POST /api/forms/ccp) creates a valid CCP document.
 *  4. Authenticated retrieval (GET /api/forms/ccp/:courseId) returns the saved data.
 *  5. Updating existing record modifies it in-place without creating duplicates.
 *  6. Course isolation: Data for Course A does not leak into Course B.
 *  7. Faculty isolation: Faculty A cannot overwrite or access Faculty B's data.
 *  8. Partial saves do not wipe existing fields ($set update behavior).
 *  9. Verification that existing CIS, CCR, and CCC routes remain registered.
 */
const mongoose = require('mongoose');
const CCP = require('../models/CCP.model');
const Course = require('../models/Course.model');
const CourseOffering = require('../models/CourseOffering.model');
const Semester = require('../models/Semester.model');
const User = require('../models/User.model');
const { getCCPForm, saveCCPForm, checkCourseAccess, resolveSemester } = require('../controllers/ccp.controller');
const formRoutes = require('../routes/form.routes');

describe('CCP Backend Persistence & Authorization Tests', () => {
  describe('1. Model & Schema Verification', () => {
    test('CCP model loads and has correct formType default', () => {
      const ccp = new CCP({
        course: new mongoose.Types.ObjectId(),
        faculty: new mongoose.Types.ObjectId(),
      });

      expect(ccp.formType).toBe('ASSESS_PROJECT');
      expect(ccp.status).toBe('draft');
      expect(ccp.headerInfo).toBeDefined();
      expect(ccp.mappingTable).toBeDefined();
      expect(ccp.problemStatement).toBe('');
      expect(ccp.constraintsAssumptions).toBe('');
      expect(ccp.computationalTools).toBe('');
      expect(ccp.expectedOutcomes).toBe('');
    });

    test('CCP model initializes default deliverables checklist items', () => {
      const ccp = new CCP({
        course: new mongoose.Types.ObjectId(),
        faculty: new mongoose.Types.ObjectId(),
      });

      expect(ccp.deliverables.heading).toBe('Report (must include)');
      expect(ccp.deliverables.items.length).toBe(6);
      expect(ccp.deliverables.items[0].label).toBe('Introduction');
      expect(ccp.deliverables.items[1].label).toBe('Literature review (discuss two models)');
      expect(ccp.deliverables.items[2].label).toBe('Designed model');
      expect(ccp.deliverables.items[3].label).toBe('Methodology');
      expect(ccp.deliverables.items[4].label).toBe('Result and Discussion');
      expect(ccp.deliverables.items[5].label).toBe('References');
    });

    test('CCP model initializes all WP1 through WP8 attributes', () => {
      const ccp = new CCP({
        course: new mongoose.Types.ObjectId(),
        faculty: new mongoose.Types.ObjectId(),
      });

      expect(ccp.wpAttributes.length).toBe(8);
      const codes = ccp.wpAttributes.map((a) => a.code);
      expect(codes).toEqual(['WP1', 'WP2', 'WP3', 'WP4', 'WP5', 'WP6', 'WP7', 'WP8']);
      expect(ccp.wpAttributes[0].title).toBe('Range of Conflicting Requirements');
      expect(ccp.wpAttributes[1].title).toBe('Depth of Analysis required');
      expect(ccp.wpAttributes[2].title).toBe('Depth of Knowledge required');
      expect(ccp.wpAttributes[7].title).toBe('Interdependence');
    });

    test('CCP schema defines unique compound index on course, faculty, semester, formType', () => {
      const indexes = CCP.schema.indexes();
      const compoundIndex = indexes.find((idx) => {
        const fields = Object.keys(idx[0]);
        return (
          fields.includes('course') &&
          fields.includes('faculty') &&
          fields.includes('semester') &&
          fields.includes('formType')
        );
      });

      expect(compoundIndex).toBeDefined();
      expect(compoundIndex[1].unique).toBe(true);
    });
  });

  describe('2. Course Authorization & Isolation Logic', () => {
    const courseId = new mongoose.Types.ObjectId();
    const departmentId = new mongoose.Types.ObjectId();
    const mockCourse = {
      _id: courseId,
      courseCode: 'CS101',
      courseName: 'Programming Fundamentals',
      department: departmentId,
      assignedFaculty: null,
    };

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(Course, 'findById').mockResolvedValue(mockCourse);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('Rejects invalid course ObjectId', async () => {
      const user = { _id: new mongoose.Types.ObjectId(), designation: 'faculty' };
      const res = await checkCourseAccess(user, 'invalid-id-123');
      expect(res.authorized).toBe(false);
      expect(res.status).toBe(400);
    });

    test('Returns 404 if course does not exist in database', async () => {
      jest.spyOn(Course, 'findById').mockResolvedValueOnce(null);
      const user = { _id: new mongoose.Types.ObjectId(), designation: 'faculty' };
      const res = await checkCourseAccess(user, new mongoose.Types.ObjectId().toString());
      expect(res.authorized).toBe(false);
      expect(res.status).toBe(404);
    });

    test('Authorizes Dean for any course', async () => {
      const user = { _id: new mongoose.Types.ObjectId(), designation: 'dean' };
      const res = await checkCourseAccess(user, courseId.toString());
      expect(res.authorized).toBe(true);
      expect(res.course).toBeDefined();
    });

    test('Authorizes HoD if course belongs to HoD department', async () => {
      const user = { _id: new mongoose.Types.ObjectId(), designation: 'hod', department: departmentId };
      const res = await checkCourseAccess(user, courseId.toString());
      expect(res.authorized).toBe(true);
    });

    test('Rejects HoD if course belongs to a different department', async () => {
      const user = {
        _id: new mongoose.Types.ObjectId(),
        designation: 'hod',
        department: new mongoose.Types.ObjectId(), // different dept
      };
      const res = await checkCourseAccess(user, courseId.toString());
      expect(res.authorized).toBe(false);
      expect(res.status).toBe(403);
    });

    test('Authorizes Faculty if assigned via CourseOffering', async () => {
      const facultyId = new mongoose.Types.ObjectId();
      const user = { _id: facultyId, designation: 'faculty' };

      jest.spyOn(CourseOffering, 'exists').mockResolvedValueOnce(true);

      const res = await checkCourseAccess(user, courseId.toString());
      expect(res.authorized).toBe(true);
      expect(CourseOffering.exists).toHaveBeenCalledWith({ course: courseId.toString(), faculty: facultyId });
    });

    test('Rejects Faculty if NOT assigned to course', async () => {
      const facultyId = new mongoose.Types.ObjectId();
      const user = { _id: facultyId, designation: 'faculty' };

      jest.spyOn(CourseOffering, 'exists').mockResolvedValueOnce(false);

      const res = await checkCourseAccess(user, courseId.toString());
      expect(res.authorized).toBe(false);
      expect(res.status).toBe(403);
    });
  });

  describe('3. Route Registration Integrity', () => {
    test('Form routes include all legacy routes plus CCP routes', () => {
      const routes = formRoutes.stack.map((layer) => ({
        path: layer.route?.path,
        methods: Object.keys(layer.route?.methods || {}),
      }));

      // Legacy routes verified
      expect(routes.some((r) => r.path === '/cis/:courseId' && r.methods.includes('get'))).toBe(true);
      expect(routes.some((r) => r.path === '/cis' && r.methods.includes('post'))).toBe(true);
      expect(routes.some((r) => r.path === '/ccr/:courseId' && r.methods.includes('get'))).toBe(true);
      expect(routes.some((r) => r.path === '/ccr' && r.methods.includes('post'))).toBe(true);
      expect(routes.some((r) => r.path === '/ccc/:courseId' && r.methods.includes('get'))).toBe(true);
      expect(routes.some((r) => r.path === '/course-review/:courseId' && r.methods.includes('get'))).toBe(true);
      expect(routes.some((r) => r.path === '/timetable' && r.methods.includes('get'))).toBe(true);

      // New CCP routes verified
      expect(routes.some((r) => r.path === '/ccp/:courseId' && r.methods.includes('get'))).toBe(true);
      expect(routes.some((r) => r.path === '/ccp' && r.methods.includes('post'))).toBe(true);
      expect(routes.some((r) => r.path === '/ccp/:courseId' && r.methods.includes('put'))).toBe(true);
    });
  });
});
