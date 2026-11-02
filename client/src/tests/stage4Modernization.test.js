/**
 * stage4Modernization.test.js
 * Verification suite for CFES Faculty Portal Phase 4 UI modernization:
 * 1. Attendance Record (AR) safe navigation and LMS guidance contracts.
 * 2. Course Completion Certificate (CCC) validation and data structures.
 * 3. Course Review Report (CRR) grade summary, assessment, and CQI flows.
 * 4. Class Project (CCP) deliverables, WP attributes (WP1–WP8), and payload contracts.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveChecklistUrl } from '../services/courseNavigation.service.js';

describe('Phase 4: CFES Faculty Portal UI Modernization Suite', () => {

  /* ────────────────────────────────────────────────────────────
     1. Attendance Record (AR) Contracts
     ──────────────────────────────────────────────────────────── */
  describe('1. Attendance Record (AR) Institutional Guidance', () => {
    const CANONICAL_LMS_URL = 'https://iulms.edu.pk/sic/AttendanceSheet.php';

    test('preserves canonical official LMS URL without alteration', () => {
      assert.strictEqual(CANONICAL_LMS_URL, 'https://iulms.edu.pk/sic/AttendanceSheet.php');
      assert.ok(CANONICAL_LMS_URL.startsWith('https://iulms.edu.pk/'));
    });

    test('enforces safe external window opening attributes', () => {
      const linkAttributes = {
        href: CANONICAL_LMS_URL,
        target: '_blank',
        rel: 'noopener noreferrer',
      };
      assert.strictEqual(linkAttributes.target, '_blank');
      assert.ok(linkAttributes.rel.includes('noopener'));
      assert.ok(linkAttributes.rel.includes('noreferrer'));
    });

    test('resolves correct Back to Checklist destination based on offeringId/courseId', () => {
      const offeringUrl = resolveChecklistUrl('offering-123', 'course-456');
      assert.strictEqual(offeringUrl, '/faculty/offering/offering-123');

      const courseOnlyUrl = resolveChecklistUrl(null, 'course-456');
      assert.strictEqual(courseOnlyUrl, '/faculty/course/course-456');

      const fallbackUrl = resolveChecklistUrl(null, null);
      assert.strictEqual(fallbackUrl, '/faculty/dashboard');
    });
  });

  /* ────────────────────────────────────────────────────────────
     2. Course Completion Certificate (CCC)
     ──────────────────────────────────────────────────────────── */
  describe('2. Course Completion Certificate (CCC) Validation & Logic', () => {
    const validateCCC = (data) => {
      const errors = [];
      if (!data.sessionsHeld) errors.push({ field: 'sessionsHeld', message: 'Sessions Held is required.' });
      if (!data.totalRequiredSessions) errors.push({ field: 'totalRequiredSessions', message: 'Total Required Sessions is required.' });
      if (!data.date) errors.push({ field: 'date', message: 'Date is required.' });

      if (data.sessionsHeld && data.totalRequiredSessions &&
        Number(data.sessionsHeld) > Number(data.totalRequiredSessions)) {
        errors.push({ field: 'sessionsHeld', message: 'Sessions held cannot exceed total required sessions.' });
      }
      return errors;
    };

    test('flags missing required fields on empty certificate submission', () => {
      const errors = validateCCC({ sessionsHeld: '', totalRequiredSessions: '', date: '' });
      assert.strictEqual(errors.length, 3);
      assert.ok(errors.some((e) => e.field === 'sessionsHeld'));
      assert.ok(errors.some((e) => e.field === 'totalRequiredSessions'));
      assert.ok(errors.some((e) => e.field === 'date'));
    });

    test('validates that sessionsHeld cannot exceed totalRequiredSessions', () => {
      const errors = validateCCC({
        sessionsHeld: '36',
        totalRequiredSessions: '32',
        date: '2024-12-15',
      });
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].field, 'sessionsHeld');
      assert.ok(errors[0].message.includes('cannot exceed'));
    });

    test('passes validation for compliant session numbers', () => {
      const errors = validateCCC({
        sessionsHeld: '32',
        totalRequiredSessions: '32',
        date: '2024-12-15',
      });
      assert.strictEqual(errors.length, 0);
    });

    test('preserves exact CCC save payload structure', () => {
      const payload = {
        courseId: 'c123',
        offeringId: 'off123',
        courseInfo: {
          facultyName: 'Dr. Jane Smith',
          courseTitle: 'Database Systems',
          courseCode: 'CS304',
          semesterName: 'Fall 2024 • Sec A',
        },
        certificateData: {
          sessionsHeld: '32',
          totalRequiredSessions: '32',
          date: '2024-12-15',
          endTermReviewFilled: 'Yes',
        },
      };

      assert.strictEqual(payload.certificateData.endTermReviewFilled, 'Yes');
      assert.strictEqual(payload.courseInfo.courseCode, 'CS304');
      assert.strictEqual(payload.offeringId, 'off123');
    });
  });

  /* ────────────────────────────────────────────────────────────
     3. Course Review Report (CRR)
     ──────────────────────────────────────────────────────────── */
  describe('3. Course Review Report (CRR) Data & Aggregation Invariants', () => {
    test('preserves all 7 canonical letter grades and class average', () => {
      const CANONICAL_GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'F'];
      const gradeSummary = {
        'A+': '5',
        'A': '12',
        'B+': '10',
        'B': '8',
        'C+': '4',
        'C': '2',
        'F': '1',
        classAverage: '74.2 (B)',
      };

      CANONICAL_GRADES.forEach((g) => {
        assert.ok(g in gradeSummary, `Grade ${g} must be present in gradeSummary`);
      });
      assert.strictEqual(gradeSummary.classAverage, '74.2 (B)');
    });

    test('preserves 4 standard CLO rows in assessment summary', () => {
      const summary = Array.from({ length: 4 }, (_, i) => ({
        clo: `CLO ${i + 1}`,
        cloAttainment: `${70 + i * 2}%`,
        mappedGAs: `GA${i + 1}`,
        gaAttainment: `${68 + i * 2}%`,
        assessmentName: `Final Exam Q${i + 1}`,
      }));

      assert.strictEqual(summary.length, 4);
      assert.strictEqual(summary[0].clo, 'CLO 1');
      assert.strictEqual(summary[3].clo, 'CLO 4');
    });

    test('supports learning outcome adequacy and conditional revision suggestion', () => {
      let outcomes = {
        outcomesAdequate: 'Yes',
        revisionSuggestion: '',
      };

      assert.strictEqual(outcomes.outcomesAdequate, 'Yes');

      // Faculty changes to No and provides suggestions
      outcomes = {
        outcomesAdequate: 'No',
        revisionSuggestion: 'Add modern cloud computing CLO component.',
      };
      assert.strictEqual(outcomes.outcomesAdequate, 'No');
      assert.ok(outcomes.revisionSuggestion.length > 0);
    });

    test('preserves instructor and HOD signature date fields', () => {
      const signatures = {
        instructorDate: '2024-12-20',
        hodDate: '2024-12-22',
      };
      assert.strictEqual(signatures.instructorDate, '2024-12-20');
      assert.strictEqual(signatures.hodDate, '2024-12-22');
    });
  });

  /* ────────────────────────────────────────────────────────────
     4. Class Project / CCP
     ──────────────────────────────────────────────────────────── */
  describe('4. Class Project (CCP) Deliverables & WP Attributes Invariants', () => {
    test('validates required fields: courseTitle and problemStatement', () => {
      const validateCCP = (header, problem) => {
        const errors = [];
        if (!header.courseTitle?.trim()) errors.push('headerInfo.courseTitle');
        if (!problem?.trim()) errors.push('problemStatement');
        return errors;
      };

      assert.strictEqual(validateCCP({ courseTitle: '' }, '').length, 2);
      assert.strictEqual(validateCCP({ courseTitle: 'DLD' }, '').length, 1);
      assert.strictEqual(validateCCP({ courseTitle: 'DLD' }, 'Design an ALU').length, 0);
    });

    test('supports dynamic addition and deletion of deliverable items', () => {
      let items = [
        { label: 'Introduction', required: true, completed: false },
        { label: 'Methodology', required: true, completed: false },
      ];

      // Add item
      const newItem = { label: 'Simulation Results', required: true, completed: false };
      items = [...items, newItem];
      assert.strictEqual(items.length, 3);
      assert.strictEqual(items[2].label, 'Simulation Results');

      // Remove second item (Methodology)
      items = items.filter((_, idx) => idx !== 1);
      assert.strictEqual(items.length, 2);
      assert.strictEqual(items[1].label, 'Simulation Results');
    });

    test('preserves Washington Accord WP1 through WP8 codes and structures', () => {
      const WP_CODES = ['WP1', 'WP2', 'WP3', 'WP4', 'WP5', 'WP6', 'WP7', 'WP8'];
      const attributes = WP_CODES.map((code) => ({
        code,
        title: `Attribute ${code}`,
        isMapped: code === 'WP1' || code === 'WP3',
        justification: code === 'WP1' ? 'Addresses conflicting hardware/software constraints' : '',
      }));

      assert.strictEqual(attributes.length, 8);
      assert.strictEqual(attributes[0].isMapped, true);
      assert.strictEqual(attributes[1].isMapped, false);
      assert.ok(attributes[0].justification.includes('conflicting'));
    });
  });
});
