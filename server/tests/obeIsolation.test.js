/**
 * OBE Faculty-Course Isolation Tests
 * 
 * Validates that OBE data is properly isolated per faculty+course pair.
 * These are unit tests that verify the controller logic by checking that
 * all query functions correctly scope by faculty.
 * 
 * Run: npx jest tests/obeIsolation.test.js
 */

// We test the controller logic by analyzing the actual source code
// to verify every query includes faculty scoping.
const fs = require('fs');
const path = require('path');

describe('OBE Faculty-Course Isolation', () => {
  let controllerSource;
  let configModelSource;
  let assessmentModelSource;
  let studentModelSource;
  let markModelSource;

  beforeAll(() => {
    controllerSource = fs.readFileSync(
      path.join(__dirname, '..', 'controllers', 'obe.controller.js'), 'utf8'
    );
    configModelSource = fs.readFileSync(
      path.join(__dirname, '..', 'models', 'OBEConfiguration.model.js'), 'utf8'
    );
    assessmentModelSource = fs.readFileSync(
      path.join(__dirname, '..', 'models', 'OBEAssessment.model.js'), 'utf8'
    );
    studentModelSource = fs.readFileSync(
      path.join(__dirname, '..', 'models', 'OBEStudent.model.js'), 'utf8'
    );
    markModelSource = fs.readFileSync(
      path.join(__dirname, '..', 'models', 'OBEMark.model.js'), 'utf8'
    );
  });

  describe('Model Schema — faculty field exists', () => {
    test('OBEConfiguration has faculty field with required: true', () => {
      expect(configModelSource).toContain("ref: 'User'");
      expect(configModelSource).toContain("required: [true, 'Faculty reference is required']");
    });

    test('OBEAssessment has faculty field with required: true', () => {
      expect(assessmentModelSource).toContain("ref: 'User'");
      expect(assessmentModelSource).toContain("required: [true, 'Faculty reference is required']");
    });

    test('OBEStudent has faculty field with required: true', () => {
      expect(studentModelSource).toContain("ref: 'User'");
      expect(studentModelSource).toContain("required: [true, 'Faculty reference is required']");
    });

    test('OBEMark has faculty field with required: true', () => {
      expect(markModelSource).toContain("ref: 'User'");
      expect(markModelSource).toContain("required: [true, 'Faculty reference is required']");
    });
  });

  describe('Model Schema — compound indexes include faculty', () => {
    test('OBEConfiguration has unique compound index { course, faculty }', () => {
      expect(configModelSource).toMatch(/index\(\s*\{\s*course:\s*1\s*,\s*faculty:\s*1\s*\}\s*,\s*\{\s*unique:\s*true\s*\}/);
    });

    test('OBEStudent has unique compound index { course, faculty, registrationNo }', () => {
      expect(studentModelSource).toMatch(/index\(\s*\{\s*course:\s*1\s*,\s*faculty:\s*1\s*,\s*registrationNo:\s*1\s*\}\s*,\s*\{\s*unique:\s*true\s*\}/);
    });

    test('OBEMark has unique compound index { course, faculty, student, componentId }', () => {
      expect(markModelSource).toMatch(/index\(\s*\{\s*course:\s*1\s*,\s*faculty:\s*1\s*,\s*student:\s*1\s*,\s*componentId:\s*1\s*\}\s*,\s*\{\s*unique:\s*true\s*\}/);
    });

    test('OBEAssessment has compound index { course, faculty }', () => {
      expect(assessmentModelSource).toMatch(/index\(\s*\{\s*course:\s*1\s*,\s*faculty:\s*1\s*\}/);
    });
  });

  describe('Model Schema — old single-field unique on course is removed', () => {
    test('OBEConfiguration no longer has unique: true on course field itself', () => {
      // The old schema had: course: { ..., unique: true }
      // The new schema should NOT have unique: true on the course field
      // But it should still have course as a required field
      const courseFieldMatch = configModelSource.match(/course:\s*\{[^}]*\}/s);
      expect(courseFieldMatch).not.toBeNull();
      // The course field block should NOT contain 'unique: true'
      expect(courseFieldMatch[0]).not.toContain('unique');
    });
  });

  describe('Controller — faculty identity comes from req.user._id', () => {
    test('controller uses req.user._id for faculty identity', () => {
      expect(controllerSource).toContain('const facultyId = req.user._id');
    });

    test('controller does NOT accept facultyId from req.body or req.query', () => {
      // Ensure no destructuring of facultyId from request body
      expect(controllerSource).not.toMatch(/const\s*\{[^}]*facultyId[^}]*\}\s*=\s*req\.body/);
      expect(controllerSource).not.toMatch(/const\s*\{[^}]*facultyId[^}]*\}\s*=\s*req\.query/);
      expect(controllerSource).not.toMatch(/req\.body\.facultyId/);
      expect(controllerSource).not.toMatch(/req\.query\.facultyId/);
    });
  });

  describe('Controller — every OBE query is scoped by faculty', () => {
    test('getConfig queries OBEConfiguration with faculty scope', () => {
      expect(controllerSource).toContain('OBEConfiguration.findOne({ course: courseId, faculty: facultyId })');
    });

    test('updateConfig upserts OBEConfiguration with faculty scope', () => {
      expect(controllerSource).toContain(
        '{ course: courseId, faculty: facultyId }'
      );
      // The findOneAndUpdate filter must include faculty
      expect(controllerSource).toMatch(/findOneAndUpdate\(\s*\{\s*course:\s*courseId\s*,\s*faculty:\s*facultyId\s*\}/);
    });

    test('getStudents queries with faculty scope', () => {
      expect(controllerSource).toContain('OBEStudent.find({ course: courseId, faculty: facultyId, active: true })');
    });

    test('createStudent checks for duplicates within faculty scope', () => {
      expect(controllerSource).toContain('OBEStudent.findOne({ course: courseId, faculty: facultyId, registrationNo })');
    });

    test('createStudent includes faculty in creation', () => {
      expect(controllerSource).toContain('faculty: facultyId,\n    registrationNo,');
    });

    test('updateStudent scopes lookup by faculty', () => {
      expect(controllerSource).toContain(
        'OBEStudent.findOne({ _id: studentId, course: courseId, faculty: facultyId })'
      );
    });

    test('deleteStudent scopes lookup by faculty', () => {
      // There are two calls to findOne with { _id: studentId, course: courseId, faculty: facultyId }
      // (updateStudent and deleteStudent)
      const matches = controllerSource.match(
        /OBEStudent\.findOne\(\{\s*_id:\s*studentId\s*,\s*course:\s*courseId\s*,\s*faculty:\s*facultyId\s*\}\)/g
      );
      expect(matches).not.toBeNull();
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    test('getAssessments queries with faculty scope', () => {
      expect(controllerSource).toContain(
        'OBEAssessment.find({ course: courseId, faculty: facultyId, active: true })'
      );
    });

    test('createAssessment includes faculty in creation', () => {
      expect(controllerSource).toContain('faculty: facultyId,\n    category,');
    });

    test('updateAssessment scopes lookup by faculty', () => {
      expect(controllerSource).toContain(
        'OBEAssessment.findOne({ _id: assessmentId, course: courseId, faculty: facultyId })'
      );
    });

    test('getMarks queries with faculty scope', () => {
      expect(controllerSource).toContain('OBEMark.find({ course: courseId, faculty: facultyId })');
    });

    test('saveMarksBulk scopes student/assessment validation by faculty', () => {
      expect(controllerSource).toContain(
        'OBEStudent.find({ course: courseId, faculty: facultyId, active: true })'
      );
      expect(controllerSource).toContain(
        'OBEAssessment.find({ course: courseId, faculty: facultyId, active: true })'
      );
    });

    test('saveMarksBulk uses faculty in bulkWrite filters', () => {
      expect(controllerSource).toContain(
        'filter: { course: courseId, faculty: facultyId, student, componentId }'
      );
    });

    test('getResults scopes all data loading by faculty', () => {
      // The Promise.all in getResults should scope every query
      expect(controllerSource).toContain(
        'OBEConfiguration.findOne({ course: courseId, faculty: facultyId }).lean()'
      );
    });

    test('exportOBEExcel scopes CourseOffering by faculty', () => {
      expect(controllerSource).toContain(
        'CourseOffering.findOne({ course: courseId, faculty: facultyId })'
      );
    });
  });

  describe('Controller — ensureFixedAssessments is faculty-scoped', () => {
    test('ensureFixedAssessments takes facultyId parameter', () => {
      expect(controllerSource).toContain('const ensureFixedAssessments = async (courseId, facultyId)');
    });

    test('ensureFixedAssessments queries with faculty scope', () => {
      expect(controllerSource).toContain(
        'OBEAssessment.findOne({ course: courseId, faculty: facultyId, category: fixed.category })'
      );
    });

    test('ensureFixedAssessments creates with faculty field', () => {
      expect(controllerSource).toContain('faculty: facultyId,\n        category: fixed.category');
    });

    test('getConfig calls ensureFixedAssessments with facultyId', () => {
      expect(controllerSource).toContain('await ensureFixedAssessments(courseId, facultyId)');
    });
  });
});
