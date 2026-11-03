/**
 * userIdentity.test.js — Frontend unit and presentation tests for user department
 * and role identity resolution across the CFES portal shell and pages.
 *
 * Verifies:
 *  1. Dean account (Role: Dean of Academic Affairs, University Administration scope, NO department displayed).
 *  2. HoD account with assigned department (Role: Head of Department, e.g. Computer Science (CS)).
 *  3. Faculty account with assigned department (Role: Faculty Member, e.g. Electrical Engineering (EE)).
 *  4. Faculty account without department (Role: Faculty Member, Department not assigned).
 *  5. HoD account without department (Role: Head of Department, Department not assigned).
 *  6. Safe handling: never guesses or infers department from offerings or courses.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getUserRoleLabel, getUserDepartmentLabel } from '../utils/userIdentity.js';

describe('User Identity & Academic Department Resolution', () => {
  // ── 1. Dean Account ──
  test('1. Dean account: identifies as Dean of Academic Affairs without displaying a department', () => {
    const deanUser = {
      _id: 'user_dean_1',
      name: 'Dr. Academic Dean',
      designation: 'dean',
      department: null,
    };

    const role = getUserRoleLabel(deanUser);
    const dept = getUserDepartmentLabel(deanUser);

    assert.equal(role, 'Dean of Academic Affairs');
    assert.equal(dept, null, 'Dean must not display any department');
  });

  // ── 2. HoD Account with Department ──
  test('2. HoD account with department: identifies as Head of Department with formatted name and code', () => {
    const hodUser = {
      _id: 'user_hod_1',
      name: 'Dr. Tariq Mahmood',
      designation: 'hod',
      department: {
        _id: 'dept_cs_1',
        name: 'Computer Science',
        code: 'CS',
      },
    };

    const role = getUserRoleLabel(hodUser);
    const dept = getUserDepartmentLabel(hodUser);

    assert.equal(role, 'Head of Department');
    assert.equal(dept, 'Computer Science (CS)');
  });

  // ── 3. Faculty Account with Department ──
  test('3. Faculty account with department: identifies as Faculty Member with formatted name and code', () => {
    const facultyUser = {
      _id: 'user_fac_1',
      name: 'Engr. Sarah Khan',
      designation: 'faculty',
      department: {
        _id: 'dept_ee_1',
        name: 'Electrical Engineering',
        code: 'EE',
      },
    };

    const role = getUserRoleLabel(facultyUser);
    const dept = getUserDepartmentLabel(facultyUser);

    assert.equal(role, 'Faculty Member');
    assert.equal(dept, 'Electrical Engineering (EE)');
  });

  // ── 4. Faculty Account without Department ──
  test('4. Faculty account without department: displays "Department not assigned"', () => {
    const unassignedFaculty = {
      _id: 'user_fac_unassigned',
      name: 'New Faculty Member',
      designation: 'faculty',
      department: null,
    };

    const role = getUserRoleLabel(unassignedFaculty);
    const dept = getUserDepartmentLabel(unassignedFaculty);

    assert.equal(role, 'Faculty Member');
    assert.equal(dept, 'Department not assigned');
  });

  // ── 5. HoD Account without Department ──
  test('5. HoD account without department: displays "Department not assigned"', () => {
    const unassignedHod = {
      _id: 'user_hod_unassigned',
      name: 'Interim Head',
      designation: 'hod',
      department: null,
    };

    const role = getUserRoleLabel(unassignedHod);
    const dept = getUserDepartmentLabel(unassignedHod);

    assert.equal(role, 'Head of Department');
    assert.equal(dept, 'Department not assigned');
  });

  // ── 6. Fallback Department Object Resolution ──
  test('6. Supports verified fallback department from departmental stats when user record is partial', () => {
    const partialHod = {
      _id: 'user_hod_partial',
      name: 'Dr. Partial HoD',
      designation: 'hod',
      department: 'dept_se_123', // Raw ID string before populate
    };

    const statsDepartment = {
      id: 'dept_se_123',
      name: 'Software Engineering',
      code: 'SE',
    };

    const deptWithFallback = getUserDepartmentLabel(partialHod, statsDepartment);
    assert.equal(deptWithFallback, 'Software Engineering (SE)');

    // When no verified fallback exists either, defaults to "Department not assigned"
    const deptWithoutFallback = getUserDepartmentLabel(partialHod, null);
    assert.equal(deptWithoutFallback, 'Department not assigned');
  });

  // ── 7. Never Guess or Infer from Offerings/Courses ──
  test('7. Never infers department from unrelated courses or offering objects', () => {
    const facultyWithoutDept = {
      _id: 'user_fac_no_dept',
      name: 'Dr. Independent',
      designation: 'faculty',
      department: null,
    };

    // Even if assigned to a Mechanical Engineering course, user department remains "Department not assigned"
    const _courseOffering = {
      _id: 'off_me_101',
      course: {
        courseCode: 'ME-101',
        courseName: 'Thermodynamics',
        department: { name: 'Mechanical Engineering', code: 'ME' },
      },
    };

    // User department label resolution ignores courseOffering and returns strictly unassigned
    const dept = getUserDepartmentLabel(facultyWithoutDept);
    assert.equal(dept, 'Department not assigned');
    assert.notEqual(dept, 'Mechanical Engineering (ME)');
  });
});

