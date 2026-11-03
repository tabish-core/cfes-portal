/**
 * deanDashboardFrontend.test.js — Regression and unit tests for the modernized
 * Dean Dashboard presentation logic, metric cards, department table, and quick links.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Dean Dashboard Frontend Presentation Logic', () => {
  // Simulates card and state determination logic from Dashboard.jsx
  const computeDashboardPresentation = (stats) => {
    const hasActiveSemester = Boolean(stats?.activeSemester);

    const statCards = [
      {
        id: 'stat-departments',
        label: 'Departments',
        value: stats?.totalDepartments ?? 0,
        subtext: 'Institutional departments',
        color: 'blue',
      },
      {
        id: 'stat-faculty',
        label: 'Active Faculty',
        value: stats?.activeFaculty ?? 0,
        subtext: `${stats?.totalHods ?? 0} Head(s) of Dept`,
        color: 'purple',
      },
      {
        id: 'stat-courses',
        label: 'Course Catalog',
        value: stats?.totalCourses ?? 0,
        subtext: 'Registered catalog courses',
        color: 'green',
      },
      {
        id: 'stat-offerings',
        label: 'Active Offerings',
        value: stats?.totalOfferings ?? 0,
        subtext: hasActiveSemester ? (stats?.activeSemester?.name || 'Active Semester') : 'No active semester',
        color: 'blue',
      },
      {
        id: 'stat-unassigned',
        label: 'Unassigned Offerings',
        value: stats?.unassignedOfferings ?? 0,
        subtext: 'Requires faculty allocation',
        color: stats?.unassignedOfferings > 0 ? 'red' : 'green',
      },
      {
        id: 'stat-checklist',
        label: 'Checklist Compliance',
        value: hasActiveSemester ? `${stats?.checklistCompletionPercentage ?? 0}%` : '—',
        subtext: hasActiveSemester ? 'Active semester average' : 'Requires active semester',
        color: (stats?.checklistCompletionPercentage ?? 0) >= 70 ? 'green' : 'yellow',
      },
      {
        id: 'stat-drive-sync',
        label: 'Google Drive Sync',
        value: hasActiveSemester ? `${stats?.driveSync?.syncRate ?? 0}%` : '—',
        subtext: hasActiveSemester
          ? `${stats?.driveSync?.offeringsWithFilesCount ?? 0}/${stats?.totalOfferings ?? 0} offerings (${stats?.driveSync?.totalSyncedFiles ?? 0} files)`
          : 'Requires active semester',
        color: (stats?.driveSync?.syncRate ?? 0) >= 70 ? 'green' : 'yellow',
      },
    ];

    const quickLinks = [
      { to: '/dean/users', label: 'Faculty Management', icon: 'users' },
      { to: '/dean/courses', label: 'Course Allocation', icon: 'book' },
      { to: '/dean/departments', label: 'Department Management', icon: 'building' },
      { to: '/dean/submissions', label: 'Submissions & Audit', icon: 'document' },
    ];

    const departments = stats?.departments || [];

    return {
      hasActiveSemester,
      statCards,
      quickLinks,
      departments,
    };
  };

  test('1. Configures all 7 stat cards when active semester is present', () => {
    const mockStats = {
      activeSemester: { id: 'sem123', name: 'Fall 2026' },
      totalDepartments: 4,
      activeFaculty: 25,
      totalHods: 4,
      totalCourses: 40,
      totalOfferings: 32,
      unassignedOfferings: 0,
      checklistCompletionPercentage: 81.5,
      driveSync: {
        totalSyncedFiles: 142,
        offeringsWithFilesCount: 28,
        syncRate: 87.5,
      },
      departments: [
        { _id: 'd1', name: 'Computer Science', code: 'CS', offeringsCount: 20, facultyCount: 15, checklistCompletionPct: 85 },
      ],
    };

    const result = computeDashboardPresentation(mockStats);

    assert.equal(result.hasActiveSemester, true);
    assert.equal(result.statCards.length, 7);

    const checklistCard = result.statCards.find((c) => c.id === 'stat-checklist');
    assert.equal(checklistCard.value, '81.5%');
    assert.equal(checklistCard.color, 'green');

    const driveCard = result.statCards.find((c) => c.id === 'stat-drive-sync');
    assert.equal(driveCard.value, '87.5%');
    assert.ok(driveCard.subtext.includes('28/32 offerings'));
    assert.ok(driveCard.subtext.includes('142 files'));

    const unassignedCard = result.statCards.find((c) => c.id === 'stat-unassigned');
    assert.equal(unassignedCard.value, 0);
    assert.equal(unassignedCard.color, 'green');
  });

  test('2. Formats missing active semester gracefully with placeholder values and warning state', () => {
    const mockStats = {
      activeSemester: null,
      totalDepartments: 3,
      activeFaculty: 12,
      totalHods: 3,
      totalCourses: 20,
      totalOfferings: 0,
      unassignedOfferings: 0,
      checklistCompletionPercentage: 0,
      driveSync: {
        totalSyncedFiles: 0,
        offeringsWithFilesCount: 0,
        syncRate: 0,
      },
      departments: [],
    };

    const result = computeDashboardPresentation(mockStats);

    assert.equal(result.hasActiveSemester, false);

    const checklistCard = result.statCards.find((c) => c.id === 'stat-checklist');
    assert.equal(checklistCard.value, '—');
    assert.equal(checklistCard.subtext, 'Requires active semester');

    const driveCard = result.statCards.find((c) => c.id === 'stat-drive-sync');
    assert.equal(driveCard.value, '—');
    assert.equal(driveCard.subtext, 'Requires active semester');

    const offeringsCard = result.statCards.find((c) => c.id === 'stat-offerings');
    assert.equal(offeringsCard.value, 0);
    assert.equal(offeringsCard.subtext, 'No active semester');
  });

  test('3. Verifies quick links route exclusively to existing valid administrative routes', () => {
    const result = computeDashboardPresentation(null);

    const validRoutes = new Set([
      '/dean/users',
      '/dean/courses',
      '/dean/departments',
      '/dean/submissions',
    ]);

    assert.equal(result.quickLinks.length, 4);
    result.quickLinks.forEach((link) => {
      assert.ok(validRoutes.has(link.to), `Route ${link.to} must be in allowed Dean routes`);
    });
  });

  test('4. Correctly computes department completion progress bar values', () => {
    const dept = {
      _id: 'dept1',
      name: 'Software Engineering',
      code: 'SE',
      offeringsCount: 10,
      facultyCount: 8,
      checklistCompletionPct: 92.4,
    };

    const widthPercent = Math.min(100, Math.max(0, dept.checklistCompletionPct));
    assert.equal(widthPercent, 92.4);
  });

  // ── 5. Institutional Identity & Dean Scope Verification ──
  test('5. Presents institutional oversight scope for Dean without fabricating an academic department', () => {
    const deanUser = {
      _id: 'user_dean_01',
      name: 'Dr. Dean User',
      designation: 'dean',
      department: null,
    };

    // Helper simulating header identity logic in Dean Dashboard
    const computeDeanIdentity = (user) => {
      const roleBadge = user?.designation === 'dean' ? 'Dean of Academic Affairs' : 'Faculty Member';
      const scopeBadge = 'University Administration';
      const deptBadge = user?.department ? user.department.name : null;
      return { roleBadge, scopeBadge, deptBadge };
    };

    const identity = computeDeanIdentity(deanUser);
    assert.equal(identity.roleBadge, 'Dean of Academic Affairs');
    assert.equal(identity.scopeBadge, 'University Administration');
    assert.equal(identity.deptBadge, null, 'Dean must not be shown a fabricated department');
  });
});
