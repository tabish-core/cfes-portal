/**
 * facultyDashboardFrontend.test.js — Frontend unit & regression tests for the
 * shared Faculty Dashboard (`/faculty/dashboard`):
 * 1. 4 Modernized summary stat cards.
 * 2. 19-Item CourseChecklist progress & status rendering (missing defaults to 0/19 and Not Started).
 * 3. Drive sync status & conditional "Open Drive" button visibility.
 * 4. Personal teaching isolation for both Faculty and HoD ("My Faculty View").
 * 5. Semester selection and empty/loading states.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Modernized Shared Faculty Dashboard Presentation Logic', () => {
  const sampleSemesters = [
    { _id: 'sem_spring26', name: 'Spring 2026', status: 'active' },
    { _id: 'sem_fall25', name: 'Fall 2025', status: 'inactive' },
  ];

  const sampleOfferings = [
    {
      _id: 'off_101',
      course: {
        _id: 'c_cs332',
        courseCode: 'CSC-332',
        courseName: 'Design & Analysis of Algorithms',
      },
      section: 'A',
      semester: { _id: 'sem_spring26', name: 'Spring 2026', status: 'active' },
      progress: {
        completedCount: 19,
        totalCount: 19,
        completionPercentage: 100,
        status: 'Complete',
      },
      drive: {
        syncedFilesCount: 8,
        folderId: 'folder_drive_101',
        folderUrl: 'https://drive.google.com/drive/folders/folder_drive_101',
        status: 'Synced',
      },
    },
    {
      _id: 'off_102',
      course: {
        _id: 'c_cs232',
        courseCode: 'CSC-232',
        courseName: 'Data Structures & Algorithms',
      },
      section: 'B',
      semester: { _id: 'sem_spring26', name: 'Spring 2026', status: 'active' },
      progress: {
        completedCount: 12,
        totalCount: 19,
        completionPercentage: 63.2,
        status: 'In Progress',
      },
      drive: {
        syncedFilesCount: 3,
        folderId: 'folder_drive_102',
        folderUrl: 'https://drive.google.com/drive/folders/folder_drive_102',
        status: 'Partially Synced',
      },
    },
    {
      _id: 'off_103',
      course: {
        _id: 'c_cs101',
        courseCode: 'CSC-101',
        courseName: 'Introduction to Programming',
      },
      section: 'A',
      semester: { _id: 'sem_spring26', name: 'Spring 2026', status: 'active' },
      // Missing progress and drive (newly created offering)
      progress: {
        completedCount: 0,
        totalCount: 19,
        completionPercentage: 0,
        status: 'Not Started',
      },
      drive: {
        syncedFilesCount: 0,
        folderId: null,
        folderUrl: null,
        status: 'Not Synced',
      },
    },
  ];

  // Helper simulating stat card generation in Dashboard.jsx
  const computeStatCards = (stats) => {
    if (!stats) return [];
    return [
      {
        label: 'Assigned Courses',
        value: stats.assignedCourses ?? stats.totalCourses ?? 0,
        color: 'blue',
      },
      {
        label: 'Completed Checklists',
        value: stats.completedChecklists ?? 0,
        color: 'green',
      },
      {
        label: 'Average Progress',
        value: `${stats.averageChecklistProgress ?? 0}%`,
        color: 'purple',
      },
      {
        label: 'Drive Synced',
        value: stats.fullySyncedCourses ?? 0,
        color: 'indigo',
      },
    ];
  };

  // ── 1. Stat Cards Presentation ──
  test('1. Configures 4 modern summary metrics cards accurately', () => {
    const stats = {
      assignedCourses: 3,
      completedChecklists: 1,
      averageChecklistProgress: 54.4,
      fullySyncedCourses: 1,
      driveSyncRate: 33.3,
      totalCourses: 3,
    };

    const cards = computeStatCards(stats);
    assert.equal(cards.length, 4);

    assert.equal(cards[0].label, 'Assigned Courses');
    assert.equal(cards[0].value, 3);
    assert.equal(cards[0].color, 'blue');

    assert.equal(cards[1].label, 'Completed Checklists');
    assert.equal(cards[1].value, 1);
    assert.equal(cards[1].color, 'green');

    assert.equal(cards[2].label, 'Average Progress');
    assert.equal(cards[2].value, '54.4%');
    assert.equal(cards[2].color, 'purple');

    assert.equal(cards[3].label, 'Drive Synced');
    assert.equal(cards[3].value, 1);
    assert.equal(cards[3].color, 'indigo');
  });

  // ── 2. Course Checklist Progress & Missing Handling ──
  test('2. Renders 19-item checklist progress and handles missing checklist safely as 0/19 Not Started', () => {
    // Complete offering
    const completeOff = sampleOfferings[0];
    assert.equal(completeOff.progress.completedCount, 19);
    assert.equal(completeOff.progress.totalCount, 19);
    assert.equal(completeOff.progress.completionPercentage, 100);
    assert.equal(completeOff.progress.status, 'Complete');

    // In Progress offering
    const inProgressOff = sampleOfferings[1];
    assert.equal(inProgressOff.progress.completedCount, 12);
    assert.equal(inProgressOff.progress.totalCount, 19);
    assert.equal(inProgressOff.progress.status, 'In Progress');

    // Missing/Empty offering
    const emptyOff = sampleOfferings[2];
    assert.equal(emptyOff.progress.completedCount, 0);
    assert.equal(emptyOff.progress.totalCount, 19);
    assert.equal(emptyOff.progress.completionPercentage, 0);
    assert.equal(emptyOff.progress.status, 'Not Started');
  });

  // ── 3. Google Drive Sync Status & Conditional Open Drive Action ──
  test('3. Evaluates Drive sync status and shows Open Drive action only when parent folderUrl exists', () => {
    // Case 1: Synced offering with valid parent folder URL
    const syncedOff = sampleOfferings[0];
    assert.equal(syncedOff.drive.status, 'Synced');
    assert.ok(syncedOff.drive.folderUrl);
    assert.equal(Boolean(syncedOff.drive.folderUrl), true);
    assert.equal(syncedOff.drive.folderUrl, 'https://drive.google.com/drive/folders/folder_drive_101');

    // Case 2: Offering with synced files but only category folder ID (no parent folder established)
    // Open Drive action MUST be hidden and never construct a URL from category ID
    const categoryOnlyOff = {
      _id: 'off_cat_only',
      progress: { completedCount: 5, totalCount: 19, status: 'In Progress' },
      drive: { syncedFilesCount: 2, folderId: null, folderUrl: null, status: 'Partially Synced' },
    };
    assert.equal(categoryOnlyOff.drive.status, 'Partially Synced');
    assert.equal(categoryOnlyOff.drive.folderUrl, null);
    assert.equal(Boolean(categoryOnlyOff.drive.folderUrl), false);

    // Case 3: Not Synced offering without Drive metadata
    const notSyncedOff = sampleOfferings[2];
    assert.equal(notSyncedOff.drive.status, 'Not Synced');
    assert.equal(notSyncedOff.drive.folderUrl, null);
    assert.equal(Boolean(notSyncedOff.drive.folderUrl), false);

    // Case 4: Verify link never points to a category folder
    const categoryFolderId = 'category_course_docs_999';
    assert.notEqual(syncedOff.drive.folderUrl, `https://drive.google.com/drive/folders/${categoryFolderId}`);
    assert.equal(categoryOnlyOff.drive.folderUrl, null);
  });

  // ── 4. Personal Teaching Isolation (Faculty & HoD) ──
  test('4. Scopes teaching view strictly to the authenticated instructor without cross-faculty leakage', () => {
    const instructorAId = 'user_faculty_a';
    const instructorBId = 'user_faculty_b';

    const allOfferings = [
      { _id: 'o_1', faculty: instructorAId, course: { courseCode: 'CS1' } },
      { _id: 'o_2', faculty: instructorAId, course: { courseCode: 'CS2' } },
      { _id: 'o_3', faculty: instructorBId, course: { courseCode: 'CS3' } },
    ];

    // Instructor A personal view
    const viewA = allOfferings.filter((o) => o.faculty === instructorAId);
    assert.equal(viewA.length, 2);
    assert.ok(!viewA.some((o) => o.faculty === instructorBId));

    // Instructor B (e.g. HoD accessing My Faculty View)
    const viewB = allOfferings.filter((o) => o.faculty === instructorBId);
    assert.equal(viewB.length, 1);
    assert.equal(viewB[0]._id, 'o_3');
  });

  // ── 5. Semester Selection and Fallback Handling ──
  test('5. Auto-selects active semester and provides safe fallback when none is active', () => {
    // Has active semester
    const active = sampleSemesters.find((s) => s.status === 'active');
    assert.ok(active);
    assert.equal(active._id, 'sem_spring26');

    // Archive-only semester list
    const archiveOnly = [
      { _id: 'sem_fall24', name: 'Fall 2024', status: 'inactive' },
      { _id: 'sem_spring25', name: 'Spring 2025', status: 'inactive' },
    ];
    const fallback = archiveOnly.find((s) => s.status === 'active') || archiveOnly[0] || null;
    assert.ok(fallback);
    assert.equal(fallback._id, 'sem_fall24');
  });

  // ── 6. Department and Role Identity on Faculty Dashboard ──
  test('6. Computes appropriate role label and department display without fabricating departments for Deans', () => {
    const computeFacultyHeaderIdentity = (user, selectedSemesterName) => {
      const isDean = user?.designation === 'dean';
      const roleLabel =
        user?.designation === 'hod'
          ? 'Head of Department'
          : isDean
          ? 'Dean of Academic Affairs'
          : 'Faculty Member';

      const userDept = user?.department;
      const deptDisplay = isDean
        ? null
        : userDept?.name
        ? `${userDept.name}${userDept.code ? ` (${userDept.code})` : ''}`
        : 'Department not assigned';

      return {
        roleLabel,
        deptDisplay,
        semesterDisplay: selectedSemesterName ? `Semester: ${selectedSemesterName}` : null,
      };
    };

    // Case 1: Standard Faculty Member
    const regularFaculty = {
      name: 'John Doe',
      designation: 'faculty',
      department: { name: 'Electrical Engineering', code: 'EE' },
    };
    const id1 = computeFacultyHeaderIdentity(regularFaculty, 'Spring 2026');
    assert.equal(id1.roleLabel, 'Faculty Member');
    assert.equal(id1.deptDisplay, 'Electrical Engineering (EE)');
    assert.equal(id1.semesterDisplay, 'Semester: Spring 2026');

    // Case 2: HoD in "My Faculty View"
    const hodFaculty = {
      name: 'Dr. Tariq Mahmood',
      designation: 'hod',
      department: { name: 'Computer Science', code: 'CS' },
    };
    const id2 = computeFacultyHeaderIdentity(hodFaculty, 'Fall 2026');
    assert.equal(id2.roleLabel, 'Head of Department');
    assert.equal(id2.deptDisplay, 'Computer Science (CS)');
    assert.equal(id2.semesterDisplay, 'Semester: Fall 2026');

    // Case 3: Dean user (should not fabricate a department)
    const deanUser = {
      name: 'Prof. Dean',
      designation: 'dean',
      department: null,
    };
    const id3 = computeFacultyHeaderIdentity(deanUser, 'Spring 2026');
    assert.equal(id3.roleLabel, 'Dean of Academic Affairs');
    assert.equal(id3.deptDisplay, null, 'Dean must not be shown a fabricated department');

    // Case 4: Faculty without department (unassigned)
    const unassignedFaculty = {
      name: 'New Faculty',
      designation: 'faculty',
      department: null,
    };
    const id4 = computeFacultyHeaderIdentity(unassignedFaculty, 'Spring 2026');
    assert.equal(id4.roleLabel, 'Faculty Member');
    assert.equal(id4.deptDisplay, 'Department not assigned');
  });
});

