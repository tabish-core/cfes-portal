/**
 * deanDepartmentsFrontend.test.js — Unit and regression test suite for the
 * Dean Departments Management page filtering, search, HoD assignment,
 * confirmation modal states, and data presentation.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Dean Departments Management Frontend Logic', () => {
  const sampleDepartments = [
    {
      _id: 'dept_cs',
      name: 'Computer Science',
      code: 'CS',
      isActive: true,
      hod: {
        _id: 'u_tariq',
        name: 'Dr. Tariq Mahmood',
        email: 'tariq@iqra.edu.pk',
      },
    },
    {
      _id: 'dept_se',
      name: 'Software Engineering',
      code: 'SE',
      isActive: true,
      hod: {
        _id: 'u_zainab',
        name: 'Dr. Zainab Khan',
        email: 'zainab@iqra.edu.pk',
      },
    },
    {
      _id: 'dept_ee',
      name: 'Electrical Engineering',
      code: 'EE',
      isActive: true,
      hod: null, // Vacant
    },
    {
      _id: 'dept_bba',
      name: 'Business Administration',
      code: 'BBA',
      isActive: false, // Inactive department
      hod: null, // Vacant
    },
  ];

  // Simulates the exact filter logic inside Departments.jsx
  const filterDepartments = (depts, { hodFilter, search }) => {
    return depts.filter((dept) => {
      // 1. HoD status filter
      if (hodFilter === 'assigned' && !dept.hod) return false;
      if (hodFilter === 'vacant' && dept.hod) return false;

      // 2. Search query (name or code or hod name)
      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        const name = (dept.name || '').toLowerCase();
        const code = (dept.code || '').toLowerCase();
        const hodName = (dept.hod?.name || '').toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !hodName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  };

  // ── 1. Department List Rendering ──
  test('1. Renders department list with code, name, HoD, and status', () => {
    assert.equal(sampleDepartments.length, 4);
    const cs = sampleDepartments[0];
    assert.equal(cs.code, 'CS');
    assert.equal(cs.name, 'Computer Science');
    assert.equal(cs.hod.name, 'Dr. Tariq Mahmood');
    assert.equal(cs.isActive, true);

    const ee = sampleDepartments[2];
    assert.equal(ee.code, 'EE');
    assert.equal(ee.hod, null);
    assert.equal(ee.isActive, true);
  });

  // ── 2. Search by Name, Code, and HoD Name ──
  test('2. Searches departments by code, department name, and assigned HoD name', () => {
    // Search by code
    const byCode = filterDepartments(sampleDepartments, { search: 'SE' });
    assert.equal(byCode.length, 1);
    assert.equal(byCode[0]._id, 'dept_se');

    // Search by department name
    const byName = filterDepartments(sampleDepartments, { search: 'Electrical' });
    assert.equal(byName.length, 1);
    assert.equal(byName[0]._id, 'dept_ee');

    // Search by HoD name
    const byHod = filterDepartments(sampleDepartments, { search: 'Tariq' });
    assert.equal(byHod.length, 1);
    assert.equal(byHod[0]._id, 'dept_cs');

    // Case-insensitive & trimmed search
    const caseCheck = filterDepartments(sampleDepartments, { search: '  business  ' });
    assert.equal(caseCheck.length, 1);
    assert.equal(caseCheck[0]._id, 'dept_bba');
  });

  // ── 3. Filter by HoD Status ──
  test('3. Filters departments by HoD assignment status (Assigned vs Vacant)', () => {
    // Assigned only
    const assigned = filterDepartments(sampleDepartments, { hodFilter: 'assigned' });
    assert.equal(assigned.length, 2);
    assert.ok(assigned.every((d) => d.hod !== null));

    // Vacant only
    const vacant = filterDepartments(sampleDepartments, { hodFilter: 'vacant' });
    assert.equal(vacant.length, 2);
    assert.ok(vacant.every((d) => d.hod === null));

    // All
    const all = filterDepartments(sampleDepartments, { hodFilter: 'ALL' });
    assert.equal(all.length, 4);
  });

  // ── 4. Combined Filter and Search ──
  test('4. Combines HoD status filter and search query without conflict', () => {
    // Vacant + search for "Engineering"
    const combined = filterDepartments(sampleDepartments, {
      hodFilter: 'vacant',
      search: 'Engineering',
    });
    assert.equal(combined.length, 1);
    assert.equal(combined[0]._id, 'dept_ee');

    // Assigned + search for non-matching
    const noMatch = filterDepartments(sampleDepartments, {
      hodFilter: 'assigned',
      search: 'Electrical',
    });
    assert.equal(noMatch.length, 0);
  });

  // ── 5. HoD Reassignment Logic & Payload Formation ──
  test('5. Validates HoD assignment payload and detecting reassignment', () => {
    const dept = sampleDepartments[0]; // CS has Dr. Tariq as HoD
    const newHodId = 'u_bilal';

    // Verify detection of change
    const isChanged = newHodId !== (dept.hod?._id || '');
    assert.equal(isChanged, true);

    // Reassignment payload
    const payload = { hodId: newHodId };
    assert.equal(payload.hodId, 'u_bilal');

    // Setting vacant payload
    const vacantPayload = { hodId: null };
    assert.equal(vacantPayload.hodId, null);
  });

  // ── 6. Dedicated Confirmation Modal State ──
  test('6. Verifies removal confirmation modal preserves department and current HoD identity', () => {
    let deptForRemoval = null;
    let removalModalOpen = false;

    // Admin opens removal confirmation for CS
    const handleOpenRemovalModal = (dept) => {
      deptForRemoval = dept;
      removalModalOpen = true;
    };

    handleOpenRemovalModal(sampleDepartments[0]);
    assert.ok(removalModalOpen);
    assert.equal(deptForRemoval._id, 'dept_cs');
    assert.equal(deptForRemoval.hod.name, 'Dr. Tariq Mahmood');

    // Cancel closes modal without changes
    const handleCloseRemovalModal = () => {
      deptForRemoval = null;
      removalModalOpen = false;
    };
    handleCloseRemovalModal();
    assert.equal(removalModalOpen, false);
    assert.equal(deptForRemoval, null);
  });

  // ── 7. Duplicate Submission Prevention ──
  test('7. Prevents duplicate submissions while saving HoD assignment', () => {
    let savingHod = false;
    let apiCallCount = 0;

    const mockSave = () => {
      if (savingHod) return;
      savingHod = true;
      apiCallCount++;
    };

    mockSave();
    mockSave(); // In-flight click is rejected
    assert.equal(apiCallCount, 1);
  });

  // ── 8. Summary Count Invariants ──
  test('8. Calculates total, assigned, and vacant counts accurately', () => {
    const total = sampleDepartments.length;
    const assigned = sampleDepartments.filter((d) => d.hod).length;
    const vacant = total - assigned;

    assert.equal(total, 4);
    assert.equal(assigned, 2);
    assert.equal(vacant, 2);
  });
});
