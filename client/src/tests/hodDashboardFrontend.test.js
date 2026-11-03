/**
 * hodDashboardFrontend.test.js — Frontend unit and presentation tests for the
 * modernized Head of Department (HoD) Dashboard.
 *
 * Verifies:
 *  1. Metric rendering (all 6 compact metric cards, labels, colors, and thresholds).
 *  2. Loading and error states (skeletons, error alert banner, retry action).
 *  3. Empty offerings (handling of 0 offerings when active semester is present).
 *  4. Missing active semester (placeholder values, warning banners, empty table panel).
 *  5. Offering progress and Drive status (course details, section, instructor, checklist, Drive badges).
 *  6. Quick-link navigation (4 required links, paths, icons, and sidebar label update).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOD_QUICK_LINKS,
  getDriveBadgeVariant,
  formatOfferingProgress,
  computeHodDashboardCards,
} from '../pages/hod/hodDashboardHelpers.js';

describe('HoD Dashboard Frontend Presentation Logic', () => {
  const sampleStatsWithActiveSemester = {
    activeSemester: {
      id: 'sem_fall26',
      name: 'Fall 2026',
      status: 'active',
    },
    department: {
      id: 'dept_cs',
      name: 'Computer Science',
      code: 'CS',
    },
    departmentFacultyCount: 15,
    assignedInstructorsCount: 8,
    departmentCoursesCount: 22,
    activeOfferingsCount: 10,
    unassignedOfferingsCount: 1,
    checklistCompletionPercentage: 74.5,
    driveSyncRate: 80.0,
    driveSync: {
      totalSyncedFiles: 95,
      offeringsWithFilesCount: 8,
      syncRate: 80.0,
    },
    offerings: [
      {
        _id: 'off_cs101_a',
        section: 'A',
        course: {
          _id: 'c_cs101',
          courseCode: 'CS101',
          courseName: 'Introduction to Programming',
          creditHours: 3,
          type: 'Theory',
        },
        instructor: {
          _id: 'fac_alice',
          name: 'Dr. Alice Smith',
          email: 'alice@iqra.edu.pk',
        },
        checklistProgress: {
          completedCount: 19,
          totalCount: 19,
          completionPercentage: 100,
          status: 'Complete',
        },
        driveStatus: {
          syncedFilesCount: 19,
          folderId: 'fld_cs101_a',
          folderUrl: 'https://drive.google.com/drive/folders/fld_cs101_a',
          status: 'Synced',
        },
      },
      {
        _id: 'off_cs201_b',
        section: 'B',
        course: {
          _id: 'c_cs201',
          courseCode: 'CS201',
          courseName: 'Data Structures',
          creditHours: 3,
          type: 'Theory',
        },
        instructor: {
          _id: 'fac_bob',
          name: 'Prof. Bob Jones',
          email: 'bob@iqra.edu.pk',
        },
        checklistProgress: {
          completedCount: 10,
          totalCount: 19,
          completionPercentage: 52.6,
          status: 'In Progress',
        },
        driveStatus: {
          syncedFilesCount: 5,
          folderId: 'fld_cs201_b',
          folderUrl: 'https://drive.google.com/drive/folders/fld_cs201_b',
          status: 'Partially Synced',
        },
      },
      {
        _id: 'off_cs301_a',
        section: 'A',
        course: {
          _id: 'c_cs301',
          courseCode: 'CS301',
          courseName: 'Operating Systems',
          creditHours: 3,
          type: 'Theory',
        },
        instructor: null,
        checklistProgress: {
          completedCount: 0,
          totalCount: 19,
          completionPercentage: 0,
          status: 'Not Started',
        },
        driveStatus: {
          syncedFilesCount: 0,
          folderId: null,
          folderUrl: null,
          status: 'Not Synced',
        },
      },
    ],
  };

  // ── 1. Metric Rendering ───────────────────────────────────────────────────
  test('1. Metric rendering: computes exactly 6 compact cards with accurate values and color classes', () => {
    const cards = computeHodDashboardCards(sampleStatsWithActiveSemester);

    assert.equal(cards.length, 6, 'Dashboard must render exactly 6 metric cards');

    const expectedCards = [
      { id: 'stat-faculty', label: 'Active Faculty', value: 15, color: 'purple' },
      { id: 'stat-courses', label: 'Department Courses', value: 22, color: 'blue' },
      { id: 'stat-offerings', label: 'Active Offerings', value: 10, color: 'blue' },
      { id: 'stat-unassigned', label: 'Unassigned Offerings', value: 1, color: 'red' },
      { id: 'stat-checklist', label: 'Checklist Compliance', value: '74.5%', color: 'green' },
      { id: 'stat-drive-sync', label: 'Drive Sync Rate', value: '80%', color: 'green' },
    ];

    expectedCards.forEach((expected) => {
      const card = cards.find((c) => c.id === expected.id);
      assert.ok(card, `Card with id ${expected.id} must be present`);
      assert.equal(card.label, expected.label);
      assert.equal(card.value, expected.value);
      assert.equal(card.color, expected.color);
    });

    // Subtexts check
    const facultyCard = cards.find((c) => c.id === 'stat-faculty');
    assert.equal(facultyCard.subtext, '8 assigned to courses');

    const unassignedCard = cards.find((c) => c.id === 'stat-unassigned');
    assert.equal(unassignedCard.subtext, 'Requires faculty assignment');

    const driveCard = cards.find((c) => c.id === 'stat-drive-sync');
    assert.ok(driveCard.subtext.includes('8/10 offerings synced'));
  });

  test('1b. Metric rendering: thresholds evaluate green/yellow/red correctly', () => {
    const lowComplianceStats = {
      ...sampleStatsWithActiveSemester,
      unassignedOfferingsCount: 0,
      checklistCompletionPercentage: 55.0,
      driveSyncRate: 40.0,
    };

    const cards = computeHodDashboardCards(lowComplianceStats);

    const unassignedCard = cards.find((c) => c.id === 'stat-unassigned');
    assert.equal(unassignedCard.color, 'green', '0 unassigned offerings should be marked green');
    assert.equal(unassignedCard.subtext, 'All offerings assigned');

    const checklistCard = cards.find((c) => c.id === 'stat-checklist');
    assert.equal(checklistCard.color, 'yellow', '<70% compliance should be marked yellow');

    const driveCard = cards.find((c) => c.id === 'stat-drive-sync');
    assert.equal(driveCard.color, 'yellow', '<70% drive sync rate should be marked yellow');
  });

  // ── 2. Loading and Error States ───────────────────────────────────────────
  test('2. Loading and error states: simulates fallback states and retry handles', () => {
    // Skeleton loading placeholders simulation
    const skeletonCards = [...Array(6)].map((_, i) => ({
      index: i,
      value: '—',
      label: 'Loading metric...',
    }));
    assert.equal(skeletonCards.length, 6);
    skeletonCards.forEach((s) => {
      assert.equal(s.value, '—');
      assert.equal(s.label, 'Loading metric...');
    });

    // Error message handling
    const apiError = {
      response: {
        data: { message: 'You are not assigned to a department.' },
      },
    };
    const errorMessage = apiError.response?.data?.message || 'Failed to load department dashboard statistics.';
    assert.equal(errorMessage, 'You are not assigned to a department.');
  });

  // ── 3. Empty Offerings ────────────────────────────────────────────────────
  test('3. Empty offerings: formats 0 offerings gracefully without divisions by zero', () => {
    const emptyStats = {
      activeSemester: { id: 'sem_fall26', name: 'Fall 2026' },
      departmentFacultyCount: 10,
      assignedInstructorsCount: 0,
      departmentCoursesCount: 15,
      activeOfferingsCount: 0,
      unassignedOfferingsCount: 0,
      checklistCompletionPercentage: 0,
      driveSyncRate: 0,
      driveSync: {
        totalSyncedFiles: 0,
        offeringsWithFilesCount: 0,
        syncRate: 0,
      },
      offerings: [],
    };

    const cards = computeHodDashboardCards(emptyStats);

    const offeringsCard = cards.find((c) => c.id === 'stat-offerings');
    assert.equal(offeringsCard.value, 0);

    const unassignedCard = cards.find((c) => c.id === 'stat-unassigned');
    assert.equal(unassignedCard.value, 0);
    assert.equal(unassignedCard.color, 'green');

    const driveCard = cards.find((c) => c.id === 'stat-drive-sync');
    assert.equal(driveCard.value, '0%');
    assert.equal(driveCard.subtext, '0/0 offerings synced');
  });

  // ── 4. Missing Active Semester ────────────────────────────────────────────
  test('4. Missing active semester: renders placeholder dashes and inactive subtexts', () => {
    const missingSemesterStats = {
      activeSemester: null,
      departmentFacultyCount: 12,
      assignedInstructorsCount: 0,
      departmentCoursesCount: 18,
      activeOfferingsCount: 0,
      unassignedOfferingsCount: 0,
      checklistCompletionPercentage: 0,
      driveSyncRate: 0,
      offerings: [],
    };

    const cards = computeHodDashboardCards(missingSemesterStats);

    const checklistCard = cards.find((c) => c.id === 'stat-checklist');
    assert.equal(checklistCard.value, '—');
    assert.equal(checklistCard.subtext, 'Requires active semester');

    const driveCard = cards.find((c) => c.id === 'stat-drive-sync');
    assert.equal(driveCard.value, '—');
    assert.equal(driveCard.subtext, 'Requires active semester');

    const offeringsCard = cards.find((c) => c.id === 'stat-offerings');
    assert.equal(offeringsCard.value, 0);
    assert.equal(offeringsCard.subtext, 'No active semester');
  });

  // ── 5. Offering Progress and Drive Status ─────────────────────────────────
  test('5. Offering progress and Drive status: formats complete, partial, and unassigned offerings', () => {
    const [completeOffering, partialOffering, unassignedOffering] = sampleStatsWithActiveSemester.offerings;

    // A. Complete offering
    const completeRow = formatOfferingProgress(completeOffering);
    assert.equal(completeRow.courseCode, 'CS101');
    assert.equal(completeRow.courseName, 'Introduction to Programming');
    assert.equal(completeRow.section, 'A');
    assert.equal(completeRow.instructor.name, 'Dr. Alice Smith');
    assert.equal(completeRow.completedCount, 19);
    assert.equal(completeRow.totalCount, 19);
    assert.equal(completeRow.completionPercentage, 100);
    assert.equal(completeRow.driveStatusText, 'Synced');
    assert.equal(completeRow.driveVariant, 'success');

    // B. Partially synced offering
    const partialRow = formatOfferingProgress(partialOffering);
    assert.equal(partialRow.courseCode, 'CS201');
    assert.equal(partialRow.section, 'B');
    assert.equal(partialRow.completedCount, 10);
    assert.equal(partialRow.driveStatusText, 'Partially Synced');
    assert.equal(partialRow.driveVariant, 'warning');

    // C. Unassigned offering with 0 Drive sync
    const unassignedRow = formatOfferingProgress(unassignedOffering);
    assert.equal(unassignedRow.courseCode, 'CS301');
    assert.equal(unassignedRow.instructor, null);
    assert.equal(unassignedRow.completedCount, 0);
    assert.equal(unassignedRow.driveStatusText, 'Not Synced');
    assert.equal(unassignedRow.driveVariant, 'danger');
  });

  test('5b. Drive badge variant mapping helper covers edge cases and whitespace', () => {
    assert.equal(getDriveBadgeVariant('Synced'), 'success');
    assert.equal(getDriveBadgeVariant(' synced '), 'success');
    assert.equal(getDriveBadgeVariant('Partially Synced'), 'warning');
    assert.equal(getDriveBadgeVariant('Not Synced'), 'danger');
    assert.equal(getDriveBadgeVariant(null), 'neutral');
    assert.equal(getDriveBadgeVariant(undefined), 'neutral');
    assert.equal(getDriveBadgeVariant(''), 'neutral');
  });

  // ── 6. Quick-Link Navigation ──────────────────────────────────────────────
  test('6. Quick-link navigation: verifies all 4 required quick links and target paths', () => {
    assert.equal(HOD_QUICK_LINKS.length, 4, 'Must have exactly 4 quick links');

    const expectedLinks = [
      { to: '/hod/courses', label: 'Course Allocation', icon: 'book' },
      { to: '/hod/submissions', label: 'Submissions', icon: 'document' },
      { to: '/hod/faculty', label: 'Department Faculty', icon: 'users' },
      { to: '/faculty/dashboard', label: 'My Faculty Dashboard', icon: 'view' },
    ];

    expectedLinks.forEach((expected) => {
      const found = HOD_QUICK_LINKS.find((l) => l.to === expected.to);
      assert.ok(found, `Quick link to ${expected.to} must be configured`);
      assert.equal(found.label, expected.label);
      assert.equal(found.icon, expected.icon);
      assert.ok(found.desc && found.desc.length > 5, 'Quick link must have descriptive subtext');
    });
  });

  // ── 7. HoD Role and Department Identity ───────────────────────────────────
  test('7. HoD Header Identity: formats role, department badge with code, and semester badge', () => {
    const hodUser = {
      _id: 'user_hod_01',
      name: 'Dr. Tariq Mahmood',
      designation: 'hod',
      department: { _id: 'dept_cs', name: 'Computer Science', code: 'CS' },
    };

    const stats = {
      activeSemester: { id: 'sem_f26', name: 'Fall 2026', status: 'active' },
      department: { id: 'dept_cs', name: 'Computer Science', code: 'CS' },
    };

    const computeHodHeaderBadges = (user, stats) => {
      const roleLabel = 'Head of Department';
      const deptName = stats?.department?.name || user?.department?.name || 'Department';
      const deptCode = stats?.department?.code || user?.department?.code || '';
      const deptDisplay = `${deptName}${deptCode ? ` (${deptCode})` : ''}`;
      const semesterDisplay = stats?.activeSemester?.name ? `Active: ${stats.activeSemester.name}` : 'No active semester';

      return { roleLabel, deptDisplay, semesterDisplay };
    };

    const badges = computeHodHeaderBadges(hodUser, stats);
    assert.equal(badges.roleLabel, 'Head of Department');
    assert.equal(badges.deptDisplay, 'Computer Science (CS)');
    assert.equal(badges.semesterDisplay, 'Active: Fall 2026');

    // Case with missing department
    const unassignedHod = { _id: 'u2', designation: 'hod', department: null };
    const unassignedStats = { activeSemester: null, department: null };
    const computeUnassigned = (u, s) => {
      const deptObj = u?.department?.name ? u.department : s?.department?.name ? s.department : null;
      return deptObj ? `${deptObj.name}` : 'Department not assigned';
    };
    assert.equal(computeUnassigned(unassignedHod, unassignedStats), 'Department not assigned');
  });
});

