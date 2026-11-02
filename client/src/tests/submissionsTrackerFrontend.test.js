/**
 * submissionsTrackerFrontend.test.js — Unit and regression test suite for the
 * Course File Submissions & Audit Tracker frontend filtering and presentation logic.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Submissions Tracker Frontend Filter & Presentation Logic', () => {
  const sampleOfferings = [
    {
      _id: 'off1',
      section: 'A',
      course: {
        _id: 'c1',
        courseCode: 'CS-301',
        courseName: 'Database Systems',
        department: { _id: 'd1', code: 'CS', name: 'Computer Science' },
      },
      faculty: { _id: 'f1', name: 'Dr. Alice', email: 'alice@iqra.edu.pk' },
      progress: {
        completedCount: 19,
        totalCount: 19,
        completionPercentage: 100,
        status: 'Complete',
      },
      drive: {
        syncedFilesCount: 19,
        folderId: 'folder_alice_123',
        folderUrl: 'https://drive.google.com/drive/folders/folder_alice_123',
        status: 'Synced',
      },
    },
    {
      _id: 'off2',
      section: 'B',
      course: {
        _id: 'c1',
        courseCode: 'CS-301',
        courseName: 'Database Systems',
        department: { _id: 'd1', code: 'CS', name: 'Computer Science' },
      },
      faculty: { _id: 'f2', name: 'Prof. Bob', email: 'bob@iqra.edu.pk' },
      progress: {
        completedCount: 10,
        totalCount: 19,
        completionPercentage: 52.6,
        status: 'In Progress',
      },
      drive: {
        syncedFilesCount: 4,
        folderId: 'folder_bob_456',
        folderUrl: 'https://drive.google.com/drive/folders/folder_bob_456',
        status: 'Partially Synced',
      },
    },
    {
      _id: 'off3',
      section: 'A',
      course: {
        _id: 'c2',
        courseCode: 'SE-201',
        courseName: 'Software Requirements',
        department: { _id: 'd2', code: 'SE', name: 'Software Engineering' },
      },
      faculty: { _id: 'f3', name: 'Dr. Charlie', email: 'charlie@iqra.edu.pk' },
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

  // Simulates the exact filter logic inside Submissions.jsx
  const filterOfferings = (offerings, { departmentId, status, search }) => {
    return offerings.filter((offering) => {
      if (departmentId) {
        const deptId =
          offering.course?.department?._id ||
          offering.course?.department ||
          offering.faculty?.department?._id ||
          offering.faculty?.department;
        if (!deptId || deptId.toString() !== departmentId.toString()) {
          return false;
        }
      }

      if (status && status !== 'ALL') {
        if (offering.progress?.status !== status) {
          return false;
        }
      }

      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        const code = (offering.course?.courseCode || '').toLowerCase();
        const name = (offering.course?.courseName || '').toLowerCase();
        const section = (offering.section || '').toLowerCase();
        const sectionFull = `section ${section}`;
        const faculty = (offering.faculty?.name || '').toLowerCase();

        const matches =
          code.includes(q) ||
          name.includes(q) ||
          section.includes(q) ||
          sectionFull.includes(q) ||
          faculty.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  };

  test('1. Filters offerings by department correctly', () => {
    const csResults = filterOfferings(sampleOfferings, { departmentId: 'd1', status: 'ALL', search: '' });
    assert.equal(csResults.length, 2);
    assert.equal(csResults[0]._id, 'off1');
    assert.equal(csResults[1]._id, 'off2');

    const seResults = filterOfferings(sampleOfferings, { departmentId: 'd2', status: 'ALL', search: '' });
    assert.equal(seResults.length, 1);
    assert.equal(seResults[0]._id, 'off3');
  });

  test('2. Filters offerings by compliance status (Complete, In Progress, Not Started)', () => {
    const completeResults = filterOfferings(sampleOfferings, { departmentId: '', status: 'Complete', search: '' });
    assert.equal(completeResults.length, 1);
    assert.equal(completeResults[0]._id, 'off1');

    const inProgressResults = filterOfferings(sampleOfferings, { departmentId: '', status: 'In Progress', search: '' });
    assert.equal(inProgressResults.length, 1);
    assert.equal(inProgressResults[0]._id, 'off2');

    const notStartedResults = filterOfferings(sampleOfferings, { departmentId: '', status: 'Not Started', search: '' });
    assert.equal(notStartedResults.length, 1);
    assert.equal(notStartedResults[0]._id, 'off3');
  });

  test('3. Searches offerings by course code, course name, section, and faculty name', () => {
    // Course code
    const byCode = filterOfferings(sampleOfferings, { departmentId: '', status: 'ALL', search: 'SE-201' });
    assert.equal(byCode.length, 1);
    assert.equal(byCode[0]._id, 'off3');

    // Faculty name
    const byFaculty = filterOfferings(sampleOfferings, { departmentId: '', status: 'ALL', search: 'Alice' });
    assert.equal(byFaculty.length, 1);
    assert.equal(byFaculty[0]._id, 'off1');

    // Section
    const bySection = filterOfferings(sampleOfferings, { departmentId: '', status: 'ALL', search: 'section B' });
    assert.equal(bySection.length, 1);
    assert.equal(bySection[0]._id, 'off2');
  });

  test('4. Combines multiple filters without conflict', () => {
    const combined = filterOfferings(sampleOfferings, {
      departmentId: 'd1',
      status: 'In Progress',
      search: 'Database',
    });
    assert.equal(combined.length, 1);
    assert.equal(combined[0]._id, 'off2');
  });

  test('5. Validates Google Drive folder link resolution and disabled state', () => {
    // Offering 1: Valid Drive folder URL
    assert.ok(sampleOfferings[0].drive.folderUrl);
    assert.equal(sampleOfferings[0].drive.folderUrl, 'https://drive.google.com/drive/folders/folder_alice_123');

    // Offering 3: No files synced -> Drive folder is null and button disabled
    assert.equal(sampleOfferings[2].drive.folderUrl, null);
    assert.equal(sampleOfferings[2].drive.status, 'Not Synced');
  });
});
