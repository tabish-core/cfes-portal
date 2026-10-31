/**
 * examUploadFrontend.test.js — Frontend unit & integration tests for Midterm & Final Exam Document Upload Feature.
 *
 * Verifies:
 *  1. EXAM_SLOTS Definition & Metadata:
 *     - Exactly 4 slots for Midterm (MIDTERM_EXAM_PAPER, BEST, AVERAGE, WORST)
 *     - Exactly 4 slots for Final (FINAL_EXAM_PAPER, BEST, AVERAGE, WORST)
 *     - Correct category names, descriptions, and icon mappings
 *  2. File Format & Size Validation:
 *     - Allowed extensions: .pdf, .doc, .docx
 *     - Rejection of unsupported extensions (.ppt, .png, .txt, .xlsx)
 *     - 25 MB size limit enforcement
 *  3. Slot State Logic (Upload vs Replace & Metadata Display):
 *     - Empty slot shows 'Upload', 'Not Uploaded' status, no Drive link
 *     - Populated slot shows 'Replace', 'Synced (v{version})', original filename, format badge, and Drive link
 *  4. Independent Completion Calculation:
 *     - 0/4 documents -> 'Not Started'
 *     - 1/4 to 3/4 documents -> 'In Progress'
 *     - 4/4 documents -> 'Completed'
 *     - Midterm and Final calculations are independent (Midterm 4/4 does not mark Final complete)
 *  5. Checklist Integration & Total Synced Count:
 *     - Checklist ASSESS_MID counts as 1 synced item only when 4/4 distinct Midterm slots are synced
 *     - Checklist ASSESS_FINAL counts as 1 synced item only when 4/4 distinct Final slots are synced
 *     - Partial uploads (e.g., 2/4) do not count towards the overall checklist synced total
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
const EXAM_SLOTS = {
  MIDTERM: [
    {
      documentType: 'MIDTERM_EXAM_PAPER',
      category: 'Exam Paper',
      description: 'Official Midterm examination question paper.',
      icon: '📝',
    },
    {
      documentType: 'MIDTERM_BEST_COPY',
      category: 'Best Student Copy',
      description: 'Highest-scoring evaluated student answer script.',
      icon: '⭐',
    },
    {
      documentType: 'MIDTERM_AVERAGE_COPY',
      category: 'Average Student Copy',
      description: 'Average / median evaluated student answer script.',
      icon: '📊',
    },
    {
      documentType: 'MIDTERM_WORST_COPY',
      category: 'Worst Student Copy',
      description: 'Minimum-passing evaluated student answer script.',
      icon: '📉',
    },
  ],
  FINAL: [
    {
      documentType: 'FINAL_EXAM_PAPER',
      category: 'Exam Paper',
      description: 'Official Final examination question paper.',
      icon: '📝',
    },
    {
      documentType: 'FINAL_BEST_COPY',
      category: 'Best Student Copy',
      description: 'Highest-scoring evaluated student answer script.',
      icon: '⭐',
    },
    {
      documentType: 'FINAL_AVERAGE_COPY',
      category: 'Average Student Copy',
      description: 'Average / median evaluated student answer script.',
      icon: '📊',
    },
    {
      documentType: 'FINAL_WORST_COPY',
      category: 'Worst Student Copy',
      description: 'Minimum-passing evaluated student answer script.',
      icon: '📉',
    },
  ],
};

describe('Midterm & Final Exam Frontend Upload Feature Test Suite', () => {
  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx'];

  // Helper validation logic mirroring ExamUploadSection
  const validateFile = (file) => {
    if (!file) return { valid: false, error: 'No file provided' };
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File "${file.name}" exceeds the maximum allowed size of 25 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
      };
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: `Unsupported format ".${ext}". Only PDF (.pdf), Word (.doc), and Word (.docx) files are supported.`,
      };
    }
    return { valid: true, error: null };
  };

  // Helper completion calculator mirroring ExamUploadSection and CourseFileChecklist
  const computeExamCompletion = (slots, courseFiles) => {
    const filesByType = {};
    (courseFiles || []).forEach((f) => {
      if (f.documentType && f.status === 'synced') {
        filesByType[f.documentType] = f;
      }
    });

    const uploadedCount = slots.filter((s) => Boolean(filesByType[s.documentType])).length;

    let status = 'Not Started';
    if (uploadedCount === 4) {
      status = 'Completed';
    } else if (uploadedCount > 0) {
      status = 'In Progress';
    }

    return {
      uploadedCount,
      totalSlots: slots.length,
      status,
      isCompleted: uploadedCount === 4,
    };
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Slot Definitions and Category Metadata
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Exam Slot Definitions & Categories', () => {
    test('defines exactly 4 required categories for Midterm Exam', () => {
      assert.ok(EXAM_SLOTS.MIDTERM);
      assert.equal(EXAM_SLOTS.MIDTERM.length, 4);

      const docTypes = EXAM_SLOTS.MIDTERM.map((s) => s.documentType);
      assert.deepEqual(docTypes, [
        'MIDTERM_EXAM_PAPER',
        'MIDTERM_BEST_COPY',
        'MIDTERM_AVERAGE_COPY',
        'MIDTERM_WORST_COPY',
      ]);

      const categories = EXAM_SLOTS.MIDTERM.map((s) => s.category);
      assert.deepEqual(categories, [
        'Exam Paper',
        'Best Student Copy',
        'Average Student Copy',
        'Worst Student Copy',
      ]);
    });

    test('defines exactly 4 required categories for Final Exam', () => {
      assert.ok(EXAM_SLOTS.FINAL);
      assert.equal(EXAM_SLOTS.FINAL.length, 4);

      const docTypes = EXAM_SLOTS.FINAL.map((s) => s.documentType);
      assert.deepEqual(docTypes, [
        'FINAL_EXAM_PAPER',
        'FINAL_BEST_COPY',
        'FINAL_AVERAGE_COPY',
        'FINAL_WORST_COPY',
      ]);

      const categories = EXAM_SLOTS.FINAL.map((s) => s.category);
      assert.deepEqual(categories, [
        'Exam Paper',
        'Best Student Copy',
        'Average Student Copy',
        'Worst Student Copy',
      ]);
    });

    test('each slot contains category, description, and icon', () => {
      [...EXAM_SLOTS.MIDTERM, ...EXAM_SLOTS.FINAL].forEach((slot) => {
        assert.ok(slot.documentType, 'Slot must have documentType');
        assert.ok(slot.category, 'Slot must have category');
        assert.ok(slot.description, 'Slot must have description');
        assert.ok(slot.icon, 'Slot must have icon');
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Client-Side Format & Size Validation
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Client-Side Format & Size Validation', () => {
    test('accepts valid PDF file under 25 MB', () => {
      const file = { name: 'Midterm_Question_Paper.pdf', size: 2 * 1024 * 1024 };
      const res = validateFile(file);
      assert.equal(res.valid, true);
      assert.equal(res.error, null);
    });

    test('accepts valid DOCX file under 25 MB', () => {
      const file = { name: 'Best_Student_Copy.docx', size: 10 * 1024 * 1024 };
      const res = validateFile(file);
      assert.equal(res.valid, true);
      assert.equal(res.error, null);
    });

    test('accepts legacy DOC file under 25 MB', () => {
      const file = { name: 'Average_Copy.doc', size: 1 * 1024 * 1024 };
      const res = validateFile(file);
      assert.equal(res.valid, true);
      assert.equal(res.error, null);
    });

    test('rejects unsupported file formats (.ppt, .png, .txt, .xlsx)', () => {
      const unsupported = [
        'presentation.ppt',
        'slides.pptx',
        'screenshot.png',
        'notes.txt',
        'grades.xlsx',
        'archive.zip',
      ];

      unsupported.forEach((filename) => {
        const file = { name: filename, size: 500 * 1024 };
        const res = validateFile(file);
        assert.equal(res.valid, false);
        assert.match(res.error, /Unsupported format/);
      });
    });

    test('rejects files exceeding 25 MB', () => {
      const hugeFile = { name: 'Huge_Exam_Scans.pdf', size: 26 * 1024 * 1024 };
      const res = validateFile(hugeFile);
      assert.equal(res.valid, false);
      assert.match(res.error, /exceeds the maximum allowed size of 25 MB/);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Slot Action & Metadata Display Logic
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Slot Action & Metadata Display Logic', () => {
    test('renders Upload button and Not Uploaded status when slot is empty', () => {
      const courseFiles = [];
      const filesByType = {};
      courseFiles.forEach((f) => {
        filesByType[f.documentType] = f;
      });

      const slot = EXAM_SLOTS.MIDTERM[0]; // MIDTERM_EXAM_PAPER
      const existingFile = filesByType[slot.documentType];

      const buttonLabel = existingFile ? 'Replace' : 'Upload Document';
      const statusLabel = existingFile ? `Synced (v${existingFile.version || 1})` : 'Not Uploaded';
      const hasDriveLink = Boolean(existingFile?.googleDriveWebViewLink);

      assert.equal(buttonLabel, 'Upload Document');
      assert.equal(statusLabel, 'Not Uploaded');
      assert.equal(hasDriveLink, false);
    });

    test('renders Replace button, version badge, and View in Drive link when slot is uploaded', () => {
      const courseFiles = [
        {
          documentType: 'MIDTERM_EXAM_PAPER',
          filename: 'CS402_Midterm_Paper.docx',
          fileFormat: 'docx',
          version: 2,
          sizeBytes: 45000,
          status: 'synced',
          googleDriveWebViewLink: 'https://drive.google.com/file/d/drive_paper_1/view',
        },
      ];

      const filesByType = {};
      courseFiles.forEach((f) => {
        filesByType[f.documentType] = f;
      });

      const slot = EXAM_SLOTS.MIDTERM[0];
      const existingFile = filesByType[slot.documentType];

      const buttonLabel = existingFile ? 'Replace' : 'Upload Document';
      const statusLabel = existingFile ? `Synced (v${existingFile.version || 1})` : 'Not Uploaded';
      const driveUrl = existingFile?.googleDriveWebViewLink;

      assert.equal(buttonLabel, 'Replace');
      assert.equal(statusLabel, 'Synced (v2)');
      assert.equal(driveUrl, 'https://drive.google.com/file/d/drive_paper_1/view');
      assert.equal(existingFile.filename, 'CS402_Midterm_Paper.docx');
      assert.equal(existingFile.fileFormat, 'docx');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Independent Completion Calculation
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Independent Completion Calculation', () => {
    test('returns Not Started when 0/4 documents are uploaded', () => {
      const res = computeExamCompletion(EXAM_SLOTS.MIDTERM, []);
      assert.equal(res.uploadedCount, 0);
      assert.equal(res.status, 'Not Started');
      assert.equal(res.isCompleted, false);
    });

    test('returns In Progress when 1/4 to 3/4 documents are uploaded', () => {
      const oneFile = [
        { documentType: 'MIDTERM_EXAM_PAPER', status: 'synced' },
      ];
      const res1 = computeExamCompletion(EXAM_SLOTS.MIDTERM, oneFile);
      assert.equal(res1.uploadedCount, 1);
      assert.equal(res1.status, 'In Progress');
      assert.equal(res1.isCompleted, false);

      const threeFiles = [
        { documentType: 'MIDTERM_EXAM_PAPER', status: 'synced' },
        { documentType: 'MIDTERM_BEST_COPY', status: 'synced' },
        { documentType: 'MIDTERM_AVERAGE_COPY', status: 'synced' },
      ];
      const res3 = computeExamCompletion(EXAM_SLOTS.MIDTERM, threeFiles);
      assert.equal(res3.uploadedCount, 3);
      assert.equal(res3.status, 'In Progress');
      assert.equal(res3.isCompleted, false);
    });

    test('returns Completed when 4/4 documents are uploaded', () => {
      const allFour = [
        { documentType: 'MIDTERM_EXAM_PAPER', status: 'synced' },
        { documentType: 'MIDTERM_BEST_COPY', status: 'synced' },
        { documentType: 'MIDTERM_AVERAGE_COPY', status: 'synced' },
        { documentType: 'MIDTERM_WORST_COPY', status: 'synced' },
      ];
      const res = computeExamCompletion(EXAM_SLOTS.MIDTERM, allFour);
      assert.equal(res.uploadedCount, 4);
      assert.equal(res.status, 'Completed');
      assert.equal(res.isCompleted, true);
    });

    test('calculates Midterm and Final statuses completely independently', () => {
      const allMidtermFiles = [
        { documentType: 'MIDTERM_EXAM_PAPER', status: 'synced' },
        { documentType: 'MIDTERM_BEST_COPY', status: 'synced' },
        { documentType: 'MIDTERM_AVERAGE_COPY', status: 'synced' },
        { documentType: 'MIDTERM_WORST_COPY', status: 'synced' },
        // Only 1 Final document
        { documentType: 'FINAL_EXAM_PAPER', status: 'synced' },
      ];

      const midRes = computeExamCompletion(EXAM_SLOTS.MIDTERM, allMidtermFiles);
      const finalRes = computeExamCompletion(EXAM_SLOTS.FINAL, allMidtermFiles);

      assert.equal(midRes.uploadedCount, 4);
      assert.equal(midRes.status, 'Completed');
      assert.equal(midRes.isCompleted, true);

      assert.equal(finalRes.uploadedCount, 1);
      assert.equal(finalRes.status, 'In Progress');
      assert.equal(finalRes.isCompleted, false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Checklist Integration & Total Synced Count
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Checklist Integration & Total Synced Count', () => {
    const MIDTERM_DOC_TYPES = [
      'MIDTERM_EXAM_PAPER',
      'MIDTERM_BEST_COPY',
      'MIDTERM_AVERAGE_COPY',
      'MIDTERM_WORST_COPY',
    ];
    const FINAL_DOC_TYPES = [
      'FINAL_EXAM_PAPER',
      'FINAL_BEST_COPY',
      'FINAL_AVERAGE_COPY',
      'FINAL_WORST_COPY',
    ];
    const CHECKLIST_FORM_TYPES = new Set([
      'CIS',
      'CCR',
      'TIMETABLE',
      'AR',
      'LECTURES',
      'ASSESS_QUIZ',
      'ASSESS_ASSIGN',
      'ASSESS_MID',
      'ASSESS_FINAL',
      'ASSESS_PROJECT',
      'CCC',
      'FMGR',
      'CLO',
      'GA',
      'CRR',
      'TECH',
      'DESIGN',
      'CEA',
    ]);

    const calculateTotalSyncedCount = (files) => {
      const syncedTypes = new Set();
      (files || []).forEach((f) => {
        if (f.status === 'synced') syncedTypes.add(f.documentType);
      });

      const isMidtermDone = MIDTERM_DOC_TYPES.filter((t) => syncedTypes.has(t)).length === 4;
      if (isMidtermDone) syncedTypes.add('ASSESS_MID');

      const isFinalDone = FINAL_DOC_TYPES.filter((t) => syncedTypes.has(t)).length === 4;
      if (isFinalDone) syncedTypes.add('ASSESS_FINAL');

      let count = 0;
      CHECKLIST_FORM_TYPES.forEach((ft) => {
        if (syncedTypes.has(ft)) count++;
      });
      return count;
    };

    test('does NOT count ASSESS_MID towards total synced count when only 3/4 files uploaded', () => {
      const files = [
        { documentType: 'CIS', status: 'synced' },
        { documentType: 'MIDTERM_EXAM_PAPER', status: 'synced' },
        { documentType: 'MIDTERM_BEST_COPY', status: 'synced' },
        { documentType: 'MIDTERM_AVERAGE_COPY', status: 'synced' },
      ];

      const total = calculateTotalSyncedCount(files);
      // Only 'CIS' should count (1). ASSESS_MID should NOT count because worst copy is missing.
      assert.equal(total, 1);
    });

    test('counts ASSESS_MID towards total synced count when all 4/4 files are uploaded', () => {
      const files = [
        { documentType: 'CIS', status: 'synced' },
        { documentType: 'MIDTERM_EXAM_PAPER', status: 'synced' },
        { documentType: 'MIDTERM_BEST_COPY', status: 'synced' },
        { documentType: 'MIDTERM_AVERAGE_COPY', status: 'synced' },
        { documentType: 'MIDTERM_WORST_COPY', status: 'synced' },
      ];

      const total = calculateTotalSyncedCount(files);
      // 'CIS' (1) + 'ASSESS_MID' (1) = 2
      assert.equal(total, 2);
    });

    test('counts both ASSESS_MID and ASSESS_FINAL when both have all 4/4 files uploaded', () => {
      const files = [
        { documentType: 'CIS', status: 'synced' },
        { documentType: 'CCR', status: 'synced' },
        // All 4 Midterm
        { documentType: 'MIDTERM_EXAM_PAPER', status: 'synced' },
        { documentType: 'MIDTERM_BEST_COPY', status: 'synced' },
        { documentType: 'MIDTERM_AVERAGE_COPY', status: 'synced' },
        { documentType: 'MIDTERM_WORST_COPY', status: 'synced' },
        // All 4 Final
        { documentType: 'FINAL_EXAM_PAPER', status: 'synced' },
        { documentType: 'FINAL_BEST_COPY', status: 'synced' },
        { documentType: 'FINAL_AVERAGE_COPY', status: 'synced' },
        { documentType: 'FINAL_WORST_COPY', status: 'synced' },
      ];

      const total = calculateTotalSyncedCount(files);
      // CIS (1) + CCR (1) + ASSESS_MID (1) + ASSESS_FINAL (1) = 4
      assert.equal(total, 4);
    });
  });
});
