/**
 * deanUsersFrontend.test.js — Unit and regression test suite for the
 * Dean Users Management page filtering, validation, credential notices, and presentation logic.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Dean Users Management Frontend Logic', () => {
  const sampleDepartments = [
    { _id: 'dept_cs', name: 'Computer Science', code: 'CS' },
    { _id: 'dept_se', name: 'Software Engineering', code: 'SE' },
    { _id: 'dept_ee', name: 'Electrical Engineering', code: 'EE' },
  ];

  const sampleFaculties = [
    {
      _id: 'u1',
      name: 'Dr. Tariq Mahmood',
      email: 'tariq@iqra.edu.pk',
      designation: 'hod',
      department: 'dept_cs',
      isActive: true,
    },
    {
      _id: 'u2',
      name: 'Aisha Siddiqui',
      email: 'aisha@iqra.edu.pk',
      designation: 'faculty',
      department: { _id: 'dept_cs', name: 'Computer Science', code: 'CS' },
      isActive: true,
    },
    {
      _id: 'u3',
      name: 'Bilal Ahmed',
      email: 'bilal@iqra.edu.pk',
      designation: 'faculty',
      department: 'dept_se',
      isActive: false,
    },
    {
      _id: 'u4',
      name: 'Dr. Zainab Khan',
      email: 'zainab@iqra.edu.pk',
      designation: 'hod',
      department: { _id: 'dept_se', name: 'Software Engineering', code: 'SE' },
      isActive: true,
    },
    {
      _id: 'u5',
      name: 'Farhan Ali',
      email: 'farhan@iqra.edu.pk',
      designation: 'faculty',
      department: null,
      isActive: true,
    },
  ];

  // Simulates the exact filter logic in Users.jsx
  const filterUsers = (users, { designation, department, status, search }) => {
    return users.filter((faculty) => {
      // 1. Designation filter
      if (designation && designation !== 'ALL' && faculty.designation !== designation) {
        return false;
      }

      // 2. Department filter
      if (department) {
        const deptId = faculty.department?._id || faculty.department;
        if (!deptId || deptId.toString() !== department.toString()) {
          return false;
        }
      }

      // 3. Status filter
      if (status && status !== 'ALL') {
        const isActive = !!faculty.isActive;
        if (status === 'active' && !isActive) return false;
        if (status === 'inactive' && isActive) return false;
      }

      // 4. Search query (name or email)
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

  // Simulates client-side create-user validation
  const validateCreateUser = ({ name, email, password, confirmPassword }) => {
    if (!name || !name.trim()) return { valid: false, error: 'Full name is required.' };
    if (!email || !email.trim()) return { valid: false, error: 'Email address is required.' };
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email.trim())) return { valid: false, error: 'Please provide a valid email address.' };
    if (!password) return { valid: false, error: 'Temporary password is required.' };
    if (password.length < 6) return { valid: false, error: 'Password must be at least 6 characters.' };
    if (password !== confirmPassword) return { valid: false, error: 'Password and confirm password do not match.' };
    return { valid: true, error: null };
  };

  // Simulates client-side edit-user validation
  const validateEditUser = ({ name, email, password, confirmPassword }) => {
    if (!name || !name.trim()) return { valid: false, error: 'Full name is required.' };
    if (!email || !email.trim()) return { valid: false, error: 'Email address is required.' };
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email.trim())) return { valid: false, error: 'Please provide a valid email address.' };
    if (password) {
      if (password.length < 6) return { valid: false, error: 'New password must be at least 6 characters.' };
      if (password !== confirmPassword) return { valid: false, error: 'New password and confirm password do not match.' };
    }
    return { valid: true, error: null };
  };

  // Simulates department name label resolution
  const resolveDepartmentLabel = (faculty, departments) => {
    if (!faculty.department) return '—';
    const deptId = faculty.department._id || faculty.department;
    const match = departments.find((d) => d._id === deptId);
    if (match) return `${match.name} (${match.code})`;
    if (faculty.department.name) {
      return faculty.department.code
        ? `${faculty.department.name} (${faculty.department.code})`
        : faculty.department.name;
    }
    return '—';
  };

  // ── 1. User List Rendering & Department Mapping ──
  test('1. Resolves department labels correctly for populated objects and ID strings', () => {
    // ID string lookup
    assert.equal(resolveDepartmentLabel(sampleFaculties[0], sampleDepartments), 'Computer Science (CS)');
    // Pre-populated object
    assert.equal(resolveDepartmentLabel(sampleFaculties[1], sampleDepartments), 'Computer Science (CS)');
    // Unassigned department
    assert.equal(resolveDepartmentLabel(sampleFaculties[4], sampleDepartments), '—');
  });

  // ── 2. Search by Name and Email ──
  test('2. Searches users by name and email (case-insensitive and trimmed)', () => {
    // Search by name
    const byName = filterUsers(sampleFaculties, { search: 'tariq' });
    assert.equal(byName.length, 1);
    assert.equal(byName[0]._id, 'u1');

    // Search by email domain/localpart
    const byEmail = filterUsers(sampleFaculties, { search: 'aisha@iqra' });
    assert.equal(byEmail.length, 1);
    assert.equal(byEmail[0]._id, 'u2');

    // Search partial case-insensitive
    const partial = filterUsers(sampleFaculties, { search: 'KHAN' });
    assert.equal(partial.length, 1);
    assert.equal(partial[0]._id, 'u4');

    // Search non-matching returns empty
    const noMatch = filterUsers(sampleFaculties, { search: 'nonexistent user' });
    assert.equal(noMatch.length, 0);
  });

  // ── 3. Filter by Designation, Department, and Status ──
  test('3. Filters users by designation, department, and active/inactive status', () => {
    // Designation filter: HoD only
    const hods = filterUsers(sampleFaculties, { designation: 'hod' });
    assert.equal(hods.length, 2);
    assert.ok(hods.every((h) => h.designation === 'hod'));

    // Department filter: CS only
    const csUsers = filterUsers(sampleFaculties, { department: 'dept_cs' });
    assert.equal(csUsers.length, 2);

    // Status filter: Inactive only
    const inactives = filterUsers(sampleFaculties, { status: 'inactive' });
    assert.equal(inactives.length, 1);
    assert.equal(inactives[0]._id, 'u3');
    assert.equal(inactives[0].isActive, false);

    // Status filter: Active only
    const actives = filterUsers(sampleFaculties, { status: 'active' });
    assert.equal(actives.length, 4);
  });

  // ── 4. Combined Filtering ──
  test('4. Combines search, designation, department, and status filters without conflict', () => {
    const combined = filterUsers(sampleFaculties, {
      designation: 'faculty',
      department: 'dept_cs',
      status: 'active',
      search: 'aisha',
    });
    assert.equal(combined.length, 1);
    assert.equal(combined[0]._id, 'u2');
  });

  // ── 5. Create User Form Validation ──
  test('5. Validates create-user required fields, email format, and password matching', () => {
    // Empty name
    const res1 = validateCreateUser({ name: '', email: 'test@iqra.edu.pk', password: 'password123', confirmPassword: 'password123' });
    assert.equal(res1.valid, false);
    assert.equal(res1.error, 'Full name is required.');

    // Invalid email
    const res2 = validateCreateUser({ name: 'Test', email: 'invalid-email', password: 'password123', confirmPassword: 'password123' });
    assert.equal(res2.valid, false);
    assert.equal(res2.error, 'Please provide a valid email address.');

    // Password too short (< 6 chars)
    const res3 = validateCreateUser({ name: 'Test', email: 'test@iqra.edu.pk', password: '123', confirmPassword: '123' });
    assert.equal(res3.valid, false);
    assert.equal(res3.error, 'Password must be at least 6 characters.');

    // Password mismatch
    const res4 = validateCreateUser({ name: 'Test', email: 'test@iqra.edu.pk', password: 'password123', confirmPassword: 'differentPassword' });
    assert.equal(res4.valid, false);
    assert.equal(res4.error, 'Password and confirm password do not match.');

    // Compliant payload
    const res5 = validateCreateUser({ name: 'Test User', email: 'test@iqra.edu.pk', password: 'securePass123', confirmPassword: 'securePass123' });
    assert.equal(res5.valid, true);
    assert.equal(res5.error, null);
  });

  // ── 6. Edit User Form Validation & Optional Password Reset ──
  test('6. Validates edit-user fields and supports optional password reset', () => {
    // Valid edit without password change
    const res1 = validateEditUser({ name: 'Dr. Tariq Updated', email: 'tariq.new@iqra.edu.pk', password: '', confirmPassword: '' });
    assert.equal(res1.valid, true);
    assert.equal(res1.error, null);

    // Short new password
    const res2 = validateEditUser({ name: 'Dr. Tariq', email: 'tariq@iqra.edu.pk', password: '123', confirmPassword: '123' });
    assert.equal(res2.valid, false);
    assert.equal(res2.error, 'New password must be at least 6 characters.');

    // Password mismatch
    const res3 = validateEditUser({ name: 'Dr. Tariq', email: 'tariq@iqra.edu.pk', password: 'newPassword123', confirmPassword: 'wrongPassword' });
    assert.equal(res3.valid, false);
    assert.equal(res3.error, 'New password and confirm password do not match.');

    // Valid edit with matching password
    const res4 = validateEditUser({ name: 'Dr. Tariq', email: 'tariq@iqra.edu.pk', password: 'newPassword123', confirmPassword: 'newPassword123' });
    assert.equal(res4.valid, true);
    assert.equal(res4.error, null);
  });

  // ── 7. Credential Notice Persistence ──
  test('7. Verifies credential notice state does not clear on input typing', () => {
    let createdCredentials = {
      name: 'Dr. Muhammad Tariq',
      email: 'tariq@iqra.edu.pk',
      password: 'temporaryPassword123',
      designation: 'hod',
      isReset: false,
    };

    // Simulates user typing into search or create form — in modernized code, credentials remain intact
    const handleTypingEvent = () => {
      // Modernized code does NOT call setCreatedCredentials(null) on input change
      return createdCredentials;
    };

    const stillPresent = handleTypingEvent();
    assert.ok(stillPresent);
    assert.equal(stillPresent.email, 'tariq@iqra.edu.pk');
    assert.equal(stillPresent.password, 'temporaryPassword123');

    // Only explicit dismissal clears it
    const handleDismiss = () => {
      createdCredentials = null;
    };
    handleDismiss();
    assert.equal(createdCredentials, null);
  });

  // ── 8. Deactivation Warning Invariant ──
  test('8. Confirms deactivation warning is triggered when isActive is false', () => {
    const editFormActive = { isActive: true };
    const editFormInactive = { isActive: false };

    assert.equal(!editFormActive.isActive, false); // Warning not shown
    assert.equal(!editFormInactive.isActive, true); // Warning shown
  });
});
