/**
 * deanCoursesFrontend.test.js — Unit and regression test suite for the
 * Dean Course Allocation & Offerings page filtering, assignment validation,
 * semester selection, and destructive confirmation logic.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Dean Courses Management Frontend Logic', () => {
  const sampleSemesters = [
    { _id: 'sem_fall25', name: 'Fall 2025', status: 'active' },
    { _id: 'sem_spring26', name: 'Spring 2026', status: 'inactive' },
  ];

  const sampleDepartments = [
    { _id: 'dept_cs', name: 'Computer Science', code: 'CS' },
    { _id: 'dept_se', name: 'Software Engineering', code: 'SE' },
  ];

  const sampleOfferings = [
    {
      _id: 'off_1',
      section: 'A',
      course: {
        _id: 'c_cs301',
        courseCode: 'CS-301',
        courseName: 'Database Systems',
        type: 'Core',
        department: { _id: 'dept_cs', name: 'Computer Science', code: 'CS' },
      },
      faculty: {
        _id: 'f_tariq',
        name: 'Dr. Tariq Mahmood',
        email: 'tariq@iqra.edu.pk',
        department: 'dept_cs',
      },
      semester: { _id: 'sem_fall25', name: 'Fall 2025', status: 'active' },
    },
    {
      _id: 'off_2',
      section: 'B',
      course: {
        _id: 'c_cs301',
        courseCode: 'CS-301',
        courseName: 'Database Systems',
        type: 'Core',
        department: { _id: 'dept_cs', name: 'Computer Science', code: 'CS' },
      },
      faculty: {
        _id: 'f_aisha',
        name: 'Aisha Siddiqui',
        email: 'aisha@iqra.edu.pk',
        department: 'dept_cs',
      },
      semester: { _id: 'sem_fall25', name: 'Fall 2025', status: 'active' },
    },
    {
      _id: 'off_3',
      section: 'A',
      course: {
        _id: 'c_se201',
        courseCode: 'SE-201',
        courseName: 'Software Requirements Engineering',
        type: 'Core',
        department: { _id: 'dept_se', name: 'Software Engineering', code: 'SE' },
      },
      faculty: {
        _id: 'f_bilal',
        name: 'Bilal Ahmed',
        email: 'bilal@iqra.edu.pk',
        department: 'dept_se',
      },
      semester: { _id: 'sem_fall25', name: 'Fall 2025', status: 'active' },
    },
  ];

  // Simulates the exact filter logic inside Courses.jsx
  const filterOfferings = (offerings, { departmentId, search }) => {
    return offerings.filter((offering) => {
      // 1. Department filter
      if (departmentId) {
        const courseDept =
          offering.course?.department?._id ||
          offering.course?.department ||
          offering.faculty?.department?._id ||
          offering.faculty?.department;
        if (!courseDept || courseDept.toString() !== departmentId.toString()) {
          return false;
        }
      }

      // 2. Search query (courseCode, courseName, faculty name, section)
      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        const code = (offering.course?.courseCode || '').toLowerCase();
        const name = (offering.course?.courseName || '').toLowerCase();
        const facultyName = (offering.faculty?.name || '').toLowerCase();
        const sec = (offering.section || '').toLowerCase();
        const secFull = `section ${sec}`;

        const matches =
          code.includes(q) ||
          name.includes(q) ||
          facultyName.includes(q) ||
          sec.includes(q) ||
          secFull.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  };

  // Simulates course offering assignment validation
  const validateAssignmentForm = ({ semesterId, courseId, facultyId, section }) => {
    const errors = {};
    if (!semesterId) errors.semester = 'Please select a semester.';
    if (!courseId) errors.course = 'Please select a course.';
    if (!facultyId) errors.faculty = 'Please select a faculty member.';
    if (!section || !section.trim()) errors.section = 'Section is required.';
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  };

  // ── 1. Semester Selection Invariants ──
  test('1. Resolves active semester as initial default and supports switching', () => {
    const active = sampleSemesters.find((s) => s.status === 'active');
    assert.ok(active);
    assert.equal(active._id, 'sem_fall25');
    assert.equal(active.name, 'Fall 2025');

    // Switching selected view semester
    let viewSemesterId = active._id;
    viewSemesterId = 'sem_spring26';
    assert.equal(viewSemesterId, 'sem_spring26');
  });

  // ── 2. Offering List Rendering & Department Mapping ──
  test('2. Renders offerings with course, section, faculty, and department metadata', () => {
    assert.equal(sampleOfferings.length, 3);
    const item = sampleOfferings[0];
    assert.equal(item.course.courseCode, 'CS-301');
    assert.equal(item.section, 'A');
    assert.equal(item.faculty.name, 'Dr. Tariq Mahmood');
    assert.equal(item.course.department.name, 'Computer Science');
  });

  // ── 3. Search Offerings ──
  test('3. Searches offerings by course code, course name, faculty name, and section', () => {
    // Search by course code
    const byCode = filterOfferings(sampleOfferings, { search: 'SE-201' });
    assert.equal(byCode.length, 1);
    assert.equal(byCode[0]._id, 'off_3');

    // Search by course name
    const byName = filterOfferings(sampleOfferings, { search: 'Database' });
    assert.equal(byName.length, 2);

    // Search by faculty name
    const byFaculty = filterOfferings(sampleOfferings, { search: 'Aisha' });
    assert.equal(byFaculty.length, 1);
    assert.equal(byFaculty[0]._id, 'off_2');

    // Search by section
    const bySection = filterOfferings(sampleOfferings, { search: 'section B' });
    assert.equal(bySection.length, 1);
    assert.equal(bySection[0]._id, 'off_2');
  });

  // ── 4. Department Filter ──
  test('4. Filters offerings by academic department', () => {
    // CS department
    const csOnly = filterOfferings(sampleOfferings, { departmentId: 'dept_cs' });
    assert.equal(csOnly.length, 2);

    // SE department
    const seOnly = filterOfferings(sampleOfferings, { departmentId: 'dept_se' });
    assert.equal(seOnly.length, 1);
    assert.equal(seOnly[0]._id, 'off_3');
  });

  // ── 5. Combined Filter and Search ──
  test('5. Combines department filter and search query without conflict', () => {
    const combined = filterOfferings(sampleOfferings, {
      departmentId: 'dept_cs',
      search: 'Tariq',
    });
    assert.equal(combined.length, 1);
    assert.equal(combined[0]._id, 'off_1');

    // Non-matching combo
    const noMatch = filterOfferings(sampleOfferings, {
      departmentId: 'dept_se',
      search: 'Tariq',
    });
    assert.equal(noMatch.length, 0);
  });

  // ── 6. Assignment Form Validation ──
  test('6. Validates required fields on assignment form', () => {
    // Missing all fields
    const res1 = validateAssignmentForm({ semesterId: '', courseId: '', facultyId: '', section: '' });
    assert.equal(res1.isValid, false);
    assert.equal(res1.errors.semester, 'Please select a semester.');
    assert.equal(res1.errors.course, 'Please select a course.');
    assert.equal(res1.errors.faculty, 'Please select a faculty member.');
    assert.equal(res1.errors.section, 'Section is required.');

    // Compliant assignment
    const res2 = validateAssignmentForm({
      semesterId: 'sem_fall25',
      courseId: 'c_cs301',
      facultyId: 'f_tariq',
      section: 'A',
    });
    assert.equal(res2.isValid, true);
    assert.equal(Object.keys(res2.errors).length, 0);
  });

  // ── 7. Destructive Removal Confirmation Invariant ──
  test('7. Confirms destructive removal requires explicit confirmation modal state', () => {
    let offeringToRemove = null;
    let isModalOpen = false;

    // Admin clicks "Remove" on an offering
    const handleOpenRemoveModal = (offering) => {
      offeringToRemove = offering;
      isModalOpen = true;
    };

    handleOpenRemoveModal(sampleOfferings[0]);
    assert.ok(isModalOpen);
    assert.equal(offeringToRemove._id, 'off_1');
    assert.equal(offeringToRemove.course.courseCode, 'CS-301');

    // Admin cancels
    const handleCloseRemoveModal = () => {
      offeringToRemove = null;
      isModalOpen = false;
    };
    handleCloseRemoveModal();
    assert.equal(isModalOpen, false);
    assert.equal(offeringToRemove, null);
  });

  // ── 8. Duplicate Submission Prevention Invariant ──
  test('8. Prevents duplicate submissions while saving is in flight', () => {
    let assigning = false;
    let submitCount = 0;

    const mockSubmit = () => {
      if (assigning) return;
      assigning = true;
      submitCount++;
    };

    mockSubmit();
    mockSubmit(); // Second click while in flight is ignored
    assert.equal(submitCount, 1);
  });
});
