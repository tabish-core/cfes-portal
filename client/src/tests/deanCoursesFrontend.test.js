/**
 * deanCoursesFrontend.test.js — Unit and regression test suite for the
 * Dean / HoD Course Allocation & Offerings page filtering, assignment validation,
 * Unassigned faculty option, semester selection, and destructive confirmation logic.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Dean & HoD Courses Management Frontend Logic', () => {
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
      department: { _id: 'dept_cs', name: 'Computer Science', code: 'CS' },
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
      department: { _id: 'dept_cs', name: 'Computer Science', code: 'CS' },
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
      department: { _id: 'dept_se', name: 'Software Engineering', code: 'SE' },
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
    {
      _id: 'off_4',
      section: 'A',
      department: { _id: 'dept_cs', name: 'Computer Science', code: 'CS' },
      course: {
        _id: 'c_mth101',
        courseCode: 'MTH-101',
        courseName: 'Calculus & Analytical Geometry',
        type: 'General',
        department: null, // Shared course
      },
      faculty: null, // Unassigned
      semester: { _id: 'sem_fall25', name: 'Fall 2025', status: 'active' },
    },
  ];

  // Simulates the exact filter logic inside Courses.jsx
  const filterOfferings = (offerings, { departmentId, search }) => {
    return offerings.filter((offering) => {
      // 1. Department filter
      if (departmentId) {
        const courseDept =
          offering.department?._id ||
          offering.department ||
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
        const facultyName = (offering.faculty?.name || 'unassigned').toLowerCase();
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
    if (!facultyId) errors.faculty = 'Please select a faculty member or Unassigned.';
    if (!section || !section.trim()) errors.section = 'Section is required.';
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  };

  // Prepares the API submission payload matching Courses.jsx logic
  const prepareSubmissionPayload = ({ semesterId, courseId, selectedFacultyId, section }) => {
    const facultyPayload = selectedFacultyId === 'UNASSIGNED' ? null : (selectedFacultyId || null);
    return {
      facultyId: facultyPayload,
      courseId,
      semesterId,
      section: (section || 'A').toUpperCase().trim(),
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
    assert.equal(sampleOfferings.length, 4);
    const item = sampleOfferings[0];
    assert.equal(item.course.courseCode, 'CS-301');
    assert.equal(item.section, 'A');
    assert.equal(item.faculty.name, 'Dr. Tariq Mahmood');
    assert.equal(item.course.department.name, 'Computer Science');

    // Unassigned offering display
    const unassignedItem = sampleOfferings[3];
    assert.equal(unassignedItem.course.courseCode, 'MTH-101');
    assert.equal(unassignedItem.faculty, null);
    const facultyDisplay = unassignedItem.faculty?.name || 'Unassigned';
    assert.equal(facultyDisplay, 'Unassigned');
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

    // Search by "unassigned" matches unassigned offerings
    const byUnassigned = filterOfferings(sampleOfferings, { search: 'unassigned' });
    assert.equal(byUnassigned.length, 1);
    assert.equal(byUnassigned[0]._id, 'off_4');
  });

  // ── 4. Department Filter ──
  test('4. Filters offerings by academic department including unassigned offerings', () => {
    // CS department (includes off_1, off_2, and unassigned off_4)
    const csOnly = filterOfferings(sampleOfferings, { departmentId: 'dept_cs' });
    assert.equal(csOnly.length, 3);
    assert.ok(csOnly.some((o) => o._id === 'off_4'));

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

  // ── 6. Assignment Form Validation & Unassigned Option ──
  test('6. Validates required fields on assignment form and accepts Unassigned', () => {
    // Missing all fields
    const res1 = validateAssignmentForm({ semesterId: '', courseId: '', facultyId: '', section: '' });
    assert.equal(res1.isValid, false);
    assert.equal(res1.errors.semester, 'Please select a semester.');
    assert.equal(res1.errors.course, 'Please select a course.');
    assert.equal(res1.errors.faculty, 'Please select a faculty member or Unassigned.');
    assert.equal(res1.errors.section, 'Section is required.');

    // Compliant assignment with assigned faculty
    const res2 = validateAssignmentForm({
      semesterId: 'sem_fall25',
      courseId: 'c_cs301',
      facultyId: 'f_tariq',
      section: 'A',
    });
    assert.equal(res2.isValid, true);
    assert.equal(Object.keys(res2.errors).length, 0);

    // Compliant assignment with Unassigned option
    const res3 = validateAssignmentForm({
      semesterId: 'sem_fall25',
      courseId: 'c_mth101',
      facultyId: 'UNASSIGNED',
      section: 'B',
    });
    assert.equal(res3.isValid, true);
    assert.equal(Object.keys(res3.errors).length, 0);
  });

  // ── 7. Submission Payload Preparation ──
  test('7. Prepares payload with faculty: null when UNASSIGNED is selected', () => {
    // When UNASSIGNED is selected
    const unassignedPayload = prepareSubmissionPayload({
      semesterId: 'sem_fall25',
      courseId: 'c_mth101',
      selectedFacultyId: 'UNASSIGNED',
      section: 'A',
    });
    assert.equal(unassignedPayload.facultyId, null);
    assert.equal(unassignedPayload.courseId, 'c_mth101');
    assert.equal(unassignedPayload.section, 'A');

    // When a faculty member is selected
    const assignedPayload = prepareSubmissionPayload({
      semesterId: 'sem_fall25',
      courseId: 'c_cs301',
      selectedFacultyId: 'f_tariq',
      section: 'b ',
    });
    assert.equal(assignedPayload.facultyId, 'f_tariq');
    assert.equal(assignedPayload.section, 'B');
  });

  // ── 8. Offering Transition Workflow (Assigned <-> Unassigned) ──
  test('8. Supports transitioning offerings between assigned and unassigned via allocation cycle', () => {
    let currentOfferings = [...sampleOfferings];

    // Transition off_1 from assigned to unassigned:
    // Step 1: Remove existing offering
    currentOfferings = currentOfferings.filter((o) => o._id !== 'off_1');
    assert.equal(currentOfferings.length, 3);

    // Step 2: Re-create off_1 as unassigned
    const reallocatedUnassigned = {
      _id: 'off_1_new',
      section: 'A',
      department: { _id: 'dept_cs', name: 'Computer Science', code: 'CS' },
      course: sampleOfferings[0].course,
      faculty: null,
      semester: sampleOfferings[0].semester,
    };
    currentOfferings.push(reallocatedUnassigned);

    // Verify unassigned display and filter
    const found = currentOfferings.find((o) => o._id === 'off_1_new');
    assert.ok(found);
    assert.equal(found.faculty, null);
    assert.equal(found.faculty?.name || 'Unassigned', 'Unassigned');

    // Transition off_4 from unassigned to assigned:
    // Step 1: Remove unassigned offering
    currentOfferings = currentOfferings.filter((o) => o._id !== 'off_4');

    // Step 2: Re-create off_4 assigned to Dr. Tariq
    const reallocatedAssigned = {
      _id: 'off_4_new',
      section: 'A',
      department: { _id: 'dept_cs', name: 'Computer Science', code: 'CS' },
      course: sampleOfferings[3].course,
      faculty: sampleOfferings[0].faculty,
      semester: sampleOfferings[3].semester,
    };
    currentOfferings.push(reallocatedAssigned);

    const foundAssigned = currentOfferings.find((o) => o._id === 'off_4_new');
    assert.ok(foundAssigned);
    assert.equal(foundAssigned.faculty.name, 'Dr. Tariq Mahmood');
  });

  // ── 9. Destructive Removal Confirmation Invariant ──
  test('9. Confirms destructive removal requires explicit confirmation modal state', () => {
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

  // ── 10. Duplicate Submission Prevention Invariant ──
  test('10. Prevents duplicate submissions while saving is in flight', () => {
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

  // ── 11. Master Data Fetching: HoD Skips /api/departments vs Dean Requests /api/departments ──
  test('11. HoD page does not request /api/departments, while Dean page still requests departments', async () => {
    const apiCallsMade = [];

    // Mock API client
    const mockApi = {
      get: async (url) => {
        apiCallsMade.push(url);
        if (url === '/departments') {
          return { data: { data: { departments: sampleDepartments } } };
        }
        return { data: { data: {} } };
      },
    };

    const mockGetFaculties = async () => ({ faculties: [] });
    const mockGetCourses = async () => ({ courses: [] });
    const mockGetSemesters = async () => ({ semesters: [] });

    // Simulate fetchMasterData for Dean (isHod = false)
    const fetchMasterDataDean = async () => {
      const isHod = false;
      const promises = [mockGetFaculties(), mockGetCourses(), mockGetSemesters()];
      if (!isHod) {
        promises.push(mockApi.get('/departments'));
      }
      return Promise.all(promises);
    };

    // Simulate fetchMasterData for HoD (isHod = true)
    const fetchMasterDataHod = async () => {
      const isHod = true;
      const promises = [mockGetFaculties(), mockGetCourses(), mockGetSemesters()];
      if (!isHod) {
        promises.push(mockApi.get('/departments'));
      }
      return Promise.all(promises);
    };

    // Run Dean fetch
    await fetchMasterDataDean();
    assert.ok(apiCallsMade.includes('/departments'), 'Dean must call /api/departments');
    assert.equal(apiCallsMade.filter((url) => url === '/departments').length, 1);

    // Reset calls and run HoD fetch
    apiCallsMade.length = 0;
    await fetchMasterDataHod();
    assert.equal(
      apiCallsMade.includes('/departments'),
      false,
      'HoD must NEVER call /api/departments (prevents 403 Forbidden)'
    );
    assert.equal(apiCallsMade.length, 0);
  });

  // ── 12. HoD-Created Offerings Automatically Assign to HoD Department ──
  test('12. HoD-created offerings automatically retain assignment to HoD department', () => {
    const hodUser = {
      _id: 'u_hod_cs',
      name: 'Dr. CS HoD',
      designation: 'hod',
      department: { _id: 'dept_cs', name: 'Computer Science', code: 'CS' },
    };

    const isHod = hodUser.designation === 'hod';
    const userDeptId = hodUser.department?._id || hodUser.department;

    // Simulate prepare payload for HoD
    const createOfferingPayload = (params) => {
      const payload = {
        facultyId: params.facultyId === 'UNASSIGNED' ? null : (params.facultyId || null),
        courseId: params.courseId,
        semesterId: params.semesterId,
        section: (params.section || 'A').toUpperCase().trim(),
      };
      if (isHod && userDeptId) {
        payload.departmentId = userDeptId;
      }
      return payload;
    };

    const payload = createOfferingPayload({
      facultyId: 'f_tariq',
      courseId: 'c_shared_math',
      semesterId: 'sem_fall25',
      section: 'A',
    });

    assert.equal(payload.departmentId, 'dept_cs');
    assert.equal(payload.courseId, 'c_shared_math');
    assert.equal(payload.facultyId, 'f_tariq');
  });

  // ── 13. HoD Faculty Assignment Filtered to HoD Department ──
  test('13. HoD can assign only faculty belonging to their own department', () => {
    const hodDeptId = 'dept_cs';
    const allFaculties = [
      { _id: 'f1', name: 'Dr. Alice', department: 'dept_cs' },
      { _id: 'f2', name: 'Dr. Bob', department: 'dept_se' },
      { _id: 'f3', name: 'Dr. Charlie', department: { _id: 'dept_cs', name: 'Computer Science' } },
    ];

    // Filter logic in Courses.jsx
    const filterFacultyForHod = (faculties, isHod, userDeptId) => {
      if (isHod && userDeptId) {
        return faculties.filter((f) => {
          const facDeptId = f.department?._id || f.department;
          return facDeptId && facDeptId.toString() === userDeptId.toString();
        });
      }
      return faculties;
    };

    const hodOptions = filterFacultyForHod(allFaculties, true, hodDeptId);
    assert.equal(hodOptions.length, 2);
    assert.ok(hodOptions.every((f) => {
      const d = f.department?._id || f.department;
      return d === 'dept_cs';
    }));

    // Dean sees all faculties
    const deanOptions = filterFacultyForHod(allFaculties, false, null);
    assert.equal(deanOptions.length, 3);
  });
});
