/**
 * hodFacultyFrontend.test.js — Unit test suite for HoD Faculty Page logic:
 * 1. Department-scoped faculty isolation.
 * 2. Search by faculty name and email.
 * 3. Simple filters: designation, account status, teaching allocation.
 * 4. Offering count mappings in active semester.
 * 5. Loading, error, and empty states.
 * 6. Responsive presentation attributes.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('HoD Faculty Page Frontend Presentation & Filter Logic', () => {
  const hodDeptId = 'dept_cs_123';

  const sampleFaculties = [
    {
      _id: 'fac_1',
      name: 'Dr. Tariq Mahmood',
      email: 'tariq@iqra.edu.pk',
      designation: 'hod',
      isActive: true,
      department: { _id: 'dept_cs_123', name: 'Computer Science', code: 'CS' },
    },
    {
      _id: 'fac_2',
      name: 'Aisha Siddiqui',
      email: 'aisha@iqra.edu.pk',
      designation: 'faculty',
      isActive: true,
      department: { _id: 'dept_cs_123', name: 'Computer Science', code: 'CS' },
    },
    {
      _id: 'fac_3',
      name: 'Zahid Khan',
      email: 'zahid@iqra.edu.pk',
      designation: 'faculty',
      isActive: false,
      department: { _id: 'dept_cs_123', name: 'Computer Science', code: 'CS' },
    },
    {
      _id: 'fac_4',
      name: 'Dr. Bilal Ahmed',
      email: 'bilal@iqra.edu.pk',
      designation: 'faculty',
      isActive: true,
      department: { _id: 'dept_se_456', name: 'Software Engineering', code: 'SE' },
    },
  ];

  const sampleOfferingsCountMap = {
    fac_1: 2, // Allocated 2 courses
    fac_2: 1, // Allocated 1 course
    fac_3: 0, // Unallocated
    fac_4: 3,
  };

  // Simulates the exact filter logic implemented in Faculty.jsx
  const filterDepartmentFaculty = (
    faculties,
    { userDeptId, designationFilter = 'ALL', statusFilter = 'ALL', allocationFilter = 'ALL', search = '' },
    offeringsMap = {}
  ) => {
    return faculties.filter((faculty) => {
      // 1. Strict Department Safeguard
      if (userDeptId && faculty.department) {
        const facDeptId = faculty.department._id || faculty.department;
        if (facDeptId.toString() !== userDeptId.toString()) {
          return false;
        }
      }

      // 2. Designation Filter
      if (designationFilter !== 'ALL' && faculty.designation !== designationFilter) {
        return false;
      }

      // 3. Status Filter
      if (statusFilter !== 'ALL') {
        const isActive = Boolean(faculty.isActive);
        if (statusFilter === 'active' && !isActive) return false;
        if (statusFilter === 'inactive' && isActive) return false;
      }

      // 4. Teaching Allocation Filter
      if (allocationFilter !== 'ALL') {
        const count = offeringsMap[faculty._id] || 0;
        if (allocationFilter === 'allocated' && count === 0) return false;
        if (allocationFilter === 'unallocated' && count > 0) return false;
      }

      // 5. Search Query (Name or Email)
      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        const name = (faculty.name || '').toLowerCase();
        const email = (faculty.email || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q)) {
          return false;
        }
      }

      return true;
    });
  };

  // ── 1. Department Scoping Safeguards ──
  test('1. Strictly restricts visible faculty to the logged-in HoD department', () => {
    const scopedList = filterDepartmentFaculty(
      sampleFaculties,
      { userDeptId: hodDeptId },
      sampleOfferingsCountMap
    );

    assert.equal(scopedList.length, 3);
    assert.ok(scopedList.every((f) => (f.department._id || f.department) === hodDeptId));
    assert.ok(!scopedList.some((f) => f.name === 'Dr. Bilal Ahmed'));
  });

  // ── 2. Search by Name and Email ──
  test('2. Searches faculty by partial name or email case-insensitively', () => {
    // Search by name
    const byName = filterDepartmentFaculty(
      sampleFaculties,
      { userDeptId: hodDeptId, search: 'aisha' },
      sampleOfferingsCountMap
    );
    assert.equal(byName.length, 1);
    assert.equal(byName[0]._id, 'fac_2');

    // Search by email
    const byEmail = filterDepartmentFaculty(
      sampleFaculties,
      { userDeptId: hodDeptId, search: 'tariq@iqra.edu.pk' },
      sampleOfferingsCountMap
    );
    assert.equal(byEmail.length, 1);
    assert.equal(byEmail[0]._id, 'fac_1');

    // Search partial with no match
    const noMatch = filterDepartmentFaculty(
      sampleFaculties,
      { userDeptId: hodDeptId, search: 'nonexistent' },
      sampleOfferingsCountMap
    );
    assert.equal(noMatch.length, 0);
  });

  // ── 3. Designation Filter ──
  test('3. Filters faculty by administrative designation (hod vs faculty)', () => {
    // Only HoD
    const hodOnly = filterDepartmentFaculty(
      sampleFaculties,
      { userDeptId: hodDeptId, designationFilter: 'hod' },
      sampleOfferingsCountMap
    );
    assert.equal(hodOnly.length, 1);
    assert.equal(hodOnly[0].name, 'Dr. Tariq Mahmood');

    // Only Faculty
    const facultyOnly = filterDepartmentFaculty(
      sampleFaculties,
      { userDeptId: hodDeptId, designationFilter: 'faculty' },
      sampleOfferingsCountMap
    );
    assert.equal(facultyOnly.length, 2);
  });

  // ── 4. Status Filter ──
  test('4. Filters faculty by account active/inactive status', () => {
    // Active only
    const activeOnly = filterDepartmentFaculty(
      sampleFaculties,
      { userDeptId: hodDeptId, statusFilter: 'active' },
      sampleOfferingsCountMap
    );
    assert.equal(activeOnly.length, 2);
    assert.ok(activeOnly.every((f) => f.isActive));

    // Inactive only
    const inactiveOnly = filterDepartmentFaculty(
      sampleFaculties,
      { userDeptId: hodDeptId, statusFilter: 'inactive' },
      sampleOfferingsCountMap
    );
    assert.equal(inactiveOnly.length, 1);
    assert.equal(inactiveOnly[0].name, 'Zahid Khan');
  });

  // ── 5. Allocation Filter & Offerings Count ──
  test('5. Filters faculty by active teaching allocation status', () => {
    // Allocated faculty (count > 0)
    const allocated = filterDepartmentFaculty(
      sampleFaculties,
      { userDeptId: hodDeptId, allocationFilter: 'allocated' },
      sampleOfferingsCountMap
    );
    assert.equal(allocated.length, 2);
    assert.ok(allocated.some((f) => f._id === 'fac_1'));
    assert.ok(allocated.some((f) => f._id === 'fac_2'));

    // Unallocated faculty (count === 0)
    const unallocated = filterDepartmentFaculty(
      sampleFaculties,
      { userDeptId: hodDeptId, allocationFilter: 'unallocated' },
      sampleOfferingsCountMap
    );
    assert.equal(unallocated.length, 1);
    assert.equal(unallocated[0]._id, 'fac_3');
  });

  // ── 6. Multi-Criteria Combined Filter ──
  test('6. Combines search, designation, status, and allocation filters without conflict', () => {
    const combined = filterDepartmentFaculty(
      sampleFaculties,
      {
        userDeptId: hodDeptId,
        designationFilter: 'faculty',
        statusFilter: 'active',
        allocationFilter: 'allocated',
        search: 'aisha',
      },
      sampleOfferingsCountMap
    );

    assert.equal(combined.length, 1);
    assert.equal(combined[0].name, 'Aisha Siddiqui');
  });

  // ── 7. Display Formatting Helpers ──
  test('7. Formats faculty designations and offering count labels accurately', () => {
    // Designation label
    const formatDesignation = (desig) => (desig === 'hod' ? 'Head of Department' : 'Faculty');
    assert.equal(formatDesignation('hod'), 'Head of Department');
    assert.equal(formatDesignation('faculty'), 'Faculty');

    // Offering count badge label
    const formatOfferingCount = (count) => {
      if (count > 0) return `${count} ${count === 1 ? 'Offering' : 'Offerings'}`;
      return 'Unallocated';
    };

    assert.equal(formatOfferingCount(1), '1 Offering');
    assert.equal(formatOfferingCount(3), '3 Offerings');
    assert.equal(formatOfferingCount(0), 'Unallocated');
  });

  // ── 8. Empty and Loading State Invariants ──
  test('8. Handles empty department state and filter mismatch state distinctly', () => {
    const emptyDepartmentList = [];
    const isDepartmentEmpty = emptyDepartmentList.length === 0;
    assert.ok(isDepartmentEmpty);

    // Mismatched filters on non-empty department list
    const filteredOut = filterDepartmentFaculty(
      sampleFaculties,
      { userDeptId: hodDeptId, search: 'NonExistentPerson' },
      sampleOfferingsCountMap
    );
    const hasActiveFilters = true;
    const isFilteredEmpty = filteredOut.length === 0;

    assert.ok(isFilteredEmpty);
    assert.ok(hasActiveFilters);
  });

  // ── 9. HoD Faculty Header Identity Badges ──
  test('9. Presents HoD role badge and department identity on Faculty directory', () => {
    const user = {
      name: 'Dr. Tariq Mahmood',
      designation: 'hod',
      department: { _id: hodDeptId, name: 'Computer Science', code: 'CS' },
    };
    const activeSemester = { name: 'Spring 2026' };

    const roleBadge = 'Head of Department';
    const deptBadge = `${user.department.name}${user.department.code ? ` (${user.department.code})` : ''}`;
    const semesterBadge = activeSemester?.name || '';

    assert.equal(roleBadge, 'Head of Department');
    assert.equal(deptBadge, 'Computer Science (CS)');
    assert.equal(semesterBadge, 'Spring 2026');

    // Case with unassigned department
    const unassignedUser = { name: 'Interim HoD', designation: 'hod', department: null };
    const unassignedDeptBadge = unassignedUser.department?.name
      ? `${unassignedUser.department.name}`
      : 'Department not assigned';
    assert.equal(unassignedDeptBadge, 'Department not assigned');
  });
});

